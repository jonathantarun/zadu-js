# Hyperparameter Tuning Experiment Report

**Project:** ZADU.js — Dimensionality Reduction Quality Assessment
**Author:** Jonathan Tarunraja Sekaran
**Date:** February 2026
**Status:** In Progress (will be updated as new experiments are run)

---

## 1. Overview

This document records the experiments conducted to tune UMAP hyperparameters using the ZADU.js quality metrics framework. The goal is to find parameter configurations that maximize embedding quality as measured by four complementary metrics:

| Metric | Abbreviation | What It Measures |
|--------|-------------|------------------|
| Trustworthiness | T | Whether points close in the embedding were also close in the original space (detects **false neighbors**) |
| Continuity | C | Whether points close in the original space remain close in the embedding (detects **missing neighbors**) |
| Steadiness | S | Whether clusters in the embedding correspond to real structure (detects **false clusters**) |
| Cohesiveness | Co | Whether real clusters in the original space remain intact in the embedding (detects **dispersed clusters**) |

All metrics are normalized to [0, 1], where 1 is perfect preservation.

### Datasets Used

| Dataset | Samples | Original Dims | Embedding Dims | Classes | Source |
|---------|---------|--------------|----------------|---------|--------|
| MNIST digits | 200 (20/digit) | 784 | 2 | 10 | `mnist` npm package |
| Iris flowers | 150 (50/species) | 4 | 2 | 3 | Fisher (1936), hardcoded |

### UMAP Parameters Under Investigation

| Parameter | Description | Default | Range Explored |
|-----------|-------------|---------|----------------|
| `n_neighbors` | Size of local neighborhood for manifold approximation | 15 | 5–50 |
| `min_dist` | Minimum distance between embedded points | 0.1 | 0.01–0.5 |
| `n_components` | Output dimensionality | 2 | Fixed at 2 |

### UMAP Implementations

- **umap-js** (npm): Used in iterative improvement and grid search experiments
- **DruidJS** (`@saehrimnir/druidjs` v0.7.3): Used for the final MNIST visualization embedding; snake_case API (`n_neighbors`, `min_dist`, `d`, `_n_epochs`, `seed`)

---

## 2. Baseline Results

### MNIST (200 samples, k=7, DruidJS UMAP)

Default parameters: `n_neighbors=15, min_dist=0.1, d=2, _n_epochs=350, seed=42`

| Metric | Score |
|--------|-------|
| Trustworthiness | **0.9320** |
| Continuity | **0.9506** |
| Steadiness | **0.7913** |
| Cohesiveness | **0.6432** |
| Overall (avg) | **0.8293** |

![MNIST Baseline Metrics — terminal output from export-mnist-embedding.js](screenshots/01-mnist-baseline-metrics.png)

**Observations:**
- T and C are strong (>0.93), indicating good local neighborhood preservation
- S is moderate (0.79) — some false cluster structure in the embedding
- Co is notably weak (0.64) — real digit clusters are being dispersed
- The S-Co gap of 0.148 indicates a cluster structure trade-off

### Iris (150 samples, k=15, umap-js)

Default parameters: `nNeighbors=15, minDist=0.1, nComponents=2`

Baseline scores computed via the iterative improver with adaptive thresholds. Exact numbers vary per run due to UMAP's stochastic nature (umap-js uses random initialization, not spectral).

---

## 3. What Worked

### 3.1 Paired Parameter Adjustments (n_neighbors + min_dist together)

**Strategy:** When a metric is below threshold, adjust BOTH `n_neighbors` and `min_dist` simultaneously rather than one at a time.

**Implementation** (from `parameterRecommender.js`):
- Low cohesiveness → increase `n_neighbors` by 5 AND decrease `min_dist` by 0.02
- Low steadiness → increase `n_neighbors` by 5 AND decrease `min_dist` by 0.02
- Low continuity → decrease `n_neighbors` by 5 AND increase `min_dist` by 0.02

**Why it works:** The two parameters interact. `n_neighbors` controls how much global vs. local structure UMAP preserves. `min_dist` controls how tightly points pack. Changing one without the other often creates a new imbalance — e.g., increasing `n_neighbors` alone gives broader neighborhoods but the existing `min_dist` may prevent the tighter packing needed to keep those broader neighborhoods intact.

**Evidence:** The iterative improver converges faster with paired adjustments than when we tried single-parameter steps (see Section 4.1 for the failure case).

![MNIST iterative improvement — paired parameter adjustments in action](screenshots/02-mnist-iterative-improvement.png)

The interactive visualization at `examples/visualize-tuning-digits.html` renders the MNIST embedding as a scatter plot colored by digit class, alongside a live quality metrics panel. It can be used to manually explore how changing `n_neighbors` and `min_dist` affects the embedding layout and ZADU scores in real time.

**Before (default params: n_neighbors=15, min_dist=0.1):**

![MNIST digit scatter — default parameters](screenshots/05-visualize-tuning-digits-default.png)

**After (tuned params: n_neighbors=20, min_dist=0.08):**

![MNIST digit scatter — tuned parameters](screenshots/06-visualize-tuning-digits-tuned.png)

### 3.2 Adaptive Quality Thresholds (baseline + 5%)

**Strategy:** Instead of using fixed quality targets (e.g., T=0.90, C=0.90, S=0.85, Co=0.85), compute a baseline embedding first, then set thresholds as `min(0.95, baseline_score + 0.05)`.

**Implementation** (from `iterativeImprover.js`, lines 48–103):
```
adaptiveThresholds = {
  trustworthiness: min(0.95, baselineT + 0.05),
  continuity:      min(0.95, baselineC + 0.05),
  steadiness:      min(0.95, baselineS + 0.05),
  cohesiveness:    min(0.95, baslineCo + 0.05)
}
```

**Why it works:** Fixed thresholds are often unreachable for certain datasets. MNIST with 200 samples at k=7 yields Co=0.64 baseline — a target of Co=0.85 is unrealistic and causes the optimizer to loop endlessly trying to reach an impossible goal. Adaptive thresholds set a realistic 5% improvement target that the optimizer can actually achieve.

**Evidence:** Before this fix, the iterative improver would exhaust all `maxIterations` without converging for MNIST. After, it either converges quickly or correctly identifies a trade-off and stops early.

![Iris adaptive thresholds — iterative improvement converging with plateau detection](screenshots/03-iris-iterative-improvement.png)

### 3.3 Best-Found Guarantee

**Strategy:** Track the best embedding seen across ALL iterations (not just the final one) and return that as the result.

**Implementation** (from `iterativeImprover.js`, lines 152–156):
```
let bestScore = baselineScore;
let bestEmbedding = baselineEmbedding;
// ... updated inside the loop whenever currentScore > bestScore
```

**Why it works:** Parameter recommendations don't always improve quality — sometimes iteration N+1 is worse than iteration N because the recommendation overshoots. Without this guarantee, the optimizer could return a degraded embedding. With it, the user always gets the best result found during the search.

**Evidence:** In MNIST experiments, the best embedding was sometimes found at iteration 1 or 2, while iteration 3 showed slight degradation due to the S-C trade-off. The guarantee ensured the optimal result was returned.

### 3.4 Oscillation Detection (2-Cycle Pattern Prevention)

**Strategy:** Before applying a parameter recommendation, check if those exact parameters were already tried in any previous iteration. Also detect alternating patterns (A→B→A).

**Implementation** (from `iterativeImprover.js`, lines 296–314):
- Exact match: check if `nextParams` matches any previous iteration's params
- 2-cycle: check if `nextParams` matches the iteration two steps back (A→B→A pattern)

**Why it works:** When T and Co have conflicting recommendations (one wants higher `n_neighbors`, the other wants lower), the optimizer oscillates between two parameter sets without progress. Detection breaks the cycle immediately.

**Evidence:** Without this fix, experiments with both low S and low Co would alternate between `n_neighbors=20, min_dist=0.08` and `n_neighbors=15, min_dist=0.10` indefinitely until `maxIterations` was reached.

### 3.5 Plateau Detection

**Strategy:** Stop iterating when the last 2 consecutive iterations each show less than 0.5% improvement in overall score.

**Implementation** (from `iterativeImprover.js`, lines 237–250):
```
if (Math.abs(improvement1) < 0.005 && Math.abs(improvement2) < 0.005) {
  // Plateau — stop
}
```

**Why it works:** Diminishing returns are common in iterative optimization. Once improvements become negligible, continuing wastes computation without meaningful quality gain. This is especially important for larger datasets where each UMAP run takes seconds to minutes.

### 3.6 Trade-Off Early Stopping

**Strategy:** When both steadiness and cohesiveness are below the "fair" threshold (0.80), flag it as a fundamental trade-off and stop iterating.

**Implementation** (from `parameterRecommender.js`, lines 222–233):
```
if (steadiness < thresholds.fair && cohesiveness < thresholds.fair) {
  tradeOff = true;  // Signals iterativeImprover to stop
}
```

**Why it works:** S and Co have conflicting parameter requirements — improving one tends to worsen the other (see Section 5.1). When both are low, no single parameter adjustment can fix both. Continuing to iterate just wastes time oscillating. The optimizer correctly identifies this as a hard limit and returns the best result found.

---

## 4. What Did NOT Work

### 4.1 Decreasing Only min_dist to Improve Cohesiveness

**Experiment:** When cohesiveness was low (e.g., Co=0.64 on MNIST), we tried decreasing `min_dist` alone by 0.05 (from 0.10 to 0.05) without changing `n_neighbors`.

**Result:** Cohesiveness did NOT improve meaningfully. In some cases it slightly worsened.

**Why it failed:** `min_dist` controls the minimum separation between points in the embedding, but it doesn't change which points are considered neighbors. With `n_neighbors` still at 15, UMAP's neighborhood graph is unchanged — the same local connections are being optimized, just with tighter packing. Tighter packing alone doesn't help if the neighborhood is too small to capture full cluster structure.

**What works instead:** Increase `n_neighbors` simultaneously (e.g., to 20) so UMAP "sees" more of the cluster while also packing tighter. The paired adjustment (n_neighbors +5, min_dist -0.02) is more effective.

### 4.2 Fixed Quality Thresholds for All Datasets

**Experiment:** Set universal quality targets of T=0.90, C=0.90, S=0.85, Co=0.85 for the iterative improver.

**Result:** The optimizer ran all 5 (later 8) iterations without converging on MNIST, because the targets were unreachable given the dataset's properties.

**Why it failed:** Different datasets have different achievable quality ceilings. MNIST digits (784D → 2D, 10 overlapping classes) inherently loses more structure than Iris (4D → 2D, 3 well-separated classes). A Co=0.85 target may be easy for Iris but impossible for MNIST at 200 samples.

**What works instead:** Adaptive thresholds (see Section 3.2). Compute baseline first, then target baseline + 5%, capped at 0.95. This gives a realistic, dataset-specific improvement target.

### 4.3 Single-Metric Greedy Optimization

**Experiment:** Focus on improving the worst-performing metric (e.g., Co=0.64) by applying recommendations targeting only that metric.

**Result:** Improving Co by increasing `n_neighbors` and decreasing `min_dist` degraded continuity (C dropped from 0.95 to ~0.91) because larger neighborhoods shift the balance from local to global structure preservation.

**Why it failed:** The four metrics are not independent. They form two pairs with internal tension:
- **T vs C:** Trustworthiness and continuity both measure neighborhood preservation but from opposite directions. Aggressively optimizing one can harm the other.
- **S vs Co:** Steadiness (false clusters) and cohesiveness (dispersed clusters) are fundamentally at odds — tighter clusters (better Co) can create artificial boundaries (worse S).

**What works instead:** The weighted scoring approach in `smartGridSearch.js` (T: 0.3, C: 0.3, S: 0.2, Co: 0.2) balances all four metrics simultaneously. The trade-off detection in `parameterRecommender.js` correctly identifies when single-metric optimization would be counterproductive.

### 4.4 Small Fixed Increments (n_neighbors ±5)

**Experiment:** The parameter recommender uses fixed step sizes: `n_neighbors ± 5` and `min_dist ± 0.02`.

**Result:** Sometimes too coarse, sometimes too fine.
- For MNIST (200 samples): jumping from `n_neighbors=15` to `n_neighbors=20` is a 33% increase — quite aggressive. This can overshoot the optimum.
- For larger datasets: `n_neighbors ± 5` may be too small a step to make a meaningful difference, requiring many iterations.

**Why it's a limitation:** Fixed step sizes don't scale with the dataset or the current parameter values. A percentage-based step (e.g., ±20%) would adapt better, but adds complexity.

**Current mitigation:** The oscillation and plateau detectors catch the cases where steps are too large (oscillation) or too small (plateau). The `smartGridSearch` approach avoids this entirely by evaluating a predefined grid.

### 4.5 Ignoring the S-C Trade-Off (No Early Stopping)

**Experiment (early version):** The iterative improver had no trade-off detection and would run all `maxIterations` even when S and Co were both low.

**Result:** The optimizer would oscillate endlessly:
1. Low Co → increase `n_neighbors` to 20, decrease `min_dist` to 0.08
2. Co improves slightly, but S drops below threshold
3. Low S → increase `n_neighbors` to 25, decrease `min_dist` to 0.06
4. S improves slightly, but now Co drops again
5. Repeat until `maxIterations` exhausted

**Why it failed:** S and Co have a fundamental trade-off that cannot be resolved by univariate parameter adjustments. Making clusters tighter (better Co) creates clearer boundaries that may not exist in the data (worse S). Making clusters looser (better S) disperses real cluster structure (worse Co).

**What works instead:** Trade-off early stopping (see Section 3.6). When both S and Co are below 0.80, flag as a fundamental trade-off, return the best result found, and recommend grid search for more thorough exploration.

---

## 5. Trade-Offs Discovered

### 5.1 Steadiness vs. Cohesiveness (S-C Trade-Off)

This is the most significant trade-off discovered during experiments.

**Nature of the trade-off:**
- **Cohesiveness** wants tight, well-defined clusters → favors higher `n_neighbors` and lower `min_dist`
- **Steadiness** wants no artificial cluster boundaries → favors moderate parameters that don't over-separate

**Observed on MNIST:**
- Baseline: S=0.7913, Co=0.6432 (gap of 0.148)
- Increasing `n_neighbors` from 15 to 20: Co improved ~2-3%, but S dropped ~1-2%
- The S-Co gap narrowed but neither reached "good" (0.85) simultaneously

**Implication:** For datasets with overlapping classes (like MNIST digits 4/9, 3/8), there is a hard limit on how much both S and Co can be simultaneously optimized. Accept the trade-off and optimize the weighted average instead.

### 5.2 Trustworthiness vs. Continuity (T-C Gap)

**Nature of the trade-off:**
- **Trustworthiness** measures false neighbors in the embedding — favors global accuracy
- **Continuity** measures missing neighbors — favors local accuracy
- A gap > 0.15 between T and C suggests the `n_neighbors` parameter is suboptimal

**Observed behavior:**
- Too small `n_neighbors` (e.g., 5): High C but lower T — very local neighborhoods are preserved but global structure is lost
- Too large `n_neighbors` (e.g., 50): High T but lower C — global structure is well-preserved but local neighborhoods get distorted
- The sweet spot is dataset-dependent

**Recommendation from `parameterRecommender.js`:** When T-C gap > 0.15, explore a range of `n_neighbors` values [10, 20, 30] rather than making a single adjustment.

### 5.3 Local vs. Global Structure Preservation

**General principle:** UMAP's `n_neighbors` parameter controls the balance between local and global structure:
- Low `n_neighbors` (5-10): Preserves fine-grained local neighborhoods (good for T&C) but may create false clusters (bad for S)
- High `n_neighbors` (30-50): Preserves global cluster relationships (good for S&Co) but may distort local neighborhoods (bad for C)

**Practical finding:** For MNIST at 200 samples, `n_neighbors=15` provides a reasonable compromise. Grid search did not find a dramatically better value — the improvement was typically <2% in overall score.

---

## 6. Grid Search vs. Iterative Improvement

### Smart Grid Search (`smartGridSearch.js`)

**Approach:** 3-phase systematic exploration:
1. Phase 1: Sweep `n_neighbors` in [5, 15, 30, 50] with fixed `min_dist` (middle of range)
2. Phase 2: Sweep `min_dist` in [0.01, 0.05, 0.1, 0.3] with best `n_neighbors` from Phase 1
3. Phase 3: Refine around best combination

**Pros:**
- Explores a broader parameter space
- Finds global optimum within the grid
- Weighted scoring (T:0.3, C:0.3, S:0.2, Co:0.2) balances all metrics
- No risk of oscillation

**Cons:**
- Computationally expensive: 8-10 UMAP runs minimum
- For 200-point MNIST: ~20-30 seconds total
- For 1k+ points: minutes to tens of minutes
- Grid may miss optima between grid points

### Iterative Improvement (`iterativeImprover.js`)

**Approach:** Start from defaults, evaluate metrics, apply intelligent recommendations, repeat.

**Pros:**
- Fewer UMAP runs (typically 3-5)
- Adaptive thresholds automatically scale to dataset
- Early stopping prevents wasted computation
- Good for quick refinement from a known starting point

**Cons:**
- Can get stuck in local optima
- Susceptible to trade-off oscillation (mitigated by detection)
- Fixed step sizes may not be optimal for all datasets

### Recommendation

Use **iterative improvement first** for quick results (< 5 UMAP runs). If it converges with satisfactory scores, stop. If it hits a trade-off or plateau, use **grid search** for more thorough exploration. This hybrid approach balances speed and thoroughness.

![Full test suite — MNIST and Synthetic datasets, both passing](screenshots/04-run-all-tests.png)

---

## 7. Recommendations for Future Experiments

### 7.1 Parameter Exploration

- **Try percentage-based step sizes** instead of fixed ±5/±0.02: e.g., `n_neighbors *= 1.2` or `min_dist *= 0.8`. This would scale better across datasets of different sizes.
- **Explore `_n_epochs` (DruidJS)**: More training epochs may improve embedding quality at the cost of computation time. The current value of 350 was not systematically evaluated.
- **Seed sensitivity**: UMAP is stochastic. Running the same parameters with different seeds (e.g., seed=1..5) and averaging metrics would give more robust estimates. Currently, single-seed results may have significant variance.

### 7.2 Metric Evaluation

- **Vary k for metric computation**: Current experiments use k=7 (MNIST visualization) and k=15 (optimization). The choice of k significantly affects scores — lower k emphasizes very local structure, higher k includes more global context. A systematic sweep of k would be informative.
- **Per-class analysis**: The current per-point `localScores` could be aggregated by class to identify which digit classes are hardest to embed. This would inform class-specific parameter tuning.

### 7.3 Dataset Scaling

- **Increase MNIST from 200 to 1000+ samples**: With more samples, UMAP has more data to learn the manifold, which should improve all metrics. However, computation time increases significantly (distance matrices are O(n^2)).
- **Test on higher-dimensional datasets**: MNIST (784D) is relatively well-studied. Testing on datasets with more features or more complex structure would validate the optimization framework.

### 7.4 Algorithm Comparison

- **t-SNE vs UMAP**: DruidJS also implements t-SNE (`druid.TSNE`). Running the same quality evaluation pipeline on t-SNE embeddings would provide a useful comparison for the thesis.
- **PCA as baseline**: Including PCA (a linear method) as a lower bound would contextualize how much UMAP's nonlinearity helps.

---

## Appendix A: Key Code References

| Component | File | Purpose |
|-----------|------|---------|
| Parameter Recommender | `src/optimizer/parameterRecommender.js` | Rules for parameter adjustments based on metric scores |
| Iterative Improver | `src/optimizer/iterativeImprover.js` | Adaptive threshold-based iterative optimization |
| Smart Grid Search | `src/optimizer/smartGridSearch.js` | 3-phase systematic parameter exploration |
| Embedding Comparator | `src/optimizer/comparator.js` | Side-by-side comparison of embeddings |
| Quality Report | `src/reporting/qualityReport.js` | Structured quality analysis with action items |
| Quality Map | `src/visualization/qualityMap.js` | Per-point quality visualization data |
| MNIST Experiment | `examples/test-mnist-200.js` | MNIST optimization pipeline |
| Iris Experiment | `examples/interactive-improvement.js` | Iris optimization pipeline |
| MNIST Export | `examples/export-mnist-embedding.js` | DruidJS UMAP + ZADU metric computation |

## Appendix B: Metric Thresholds Used

| Quality Level | Score Range | Interpretation |
|---------------|-------------|----------------|
| Excellent | >= 0.90 | Minimal information loss |
| Good | 0.85 - 0.90 | Acceptable for most applications |
| Fair | 0.80 - 0.85 | Noticeable artifacts, improvement recommended |
| Poor | < 0.70 | Significant distortion, parameter changes needed |

## Appendix C: MNIST Visualization Metrics (Final)

From `examples/export-mnist-embedding.js` using DruidJS UMAP:

```
Parameters: n_neighbors=15, min_dist=0.1, d=2, _n_epochs=350, seed=42
Metric k=7

Trustworthiness:  0.9320  (Excellent)
Continuity:       0.9506  (Excellent)
Steadiness:       0.7913  (Fair)
Cohesiveness:     0.6432  (Poor)
Overall:          0.8293
```

Per-point local scores are stored in `examples/mnist-200-data.js` and visualized in `examples/visualize-single.html` (black circle overlay for below-threshold points).
