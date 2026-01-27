# ZADU.js Metrics Guide

Guide for using ZADU.js metrics to evaluate and optimize dimensionality reduction.

## Overview

ZADU.js provides four metrics for evaluating dimensionality reduction quality:

| Metric | Level | Measures | Detects |
|--------|-------|----------|---------|
| **Trustworthiness** | Point | False neighbors | Unrelated points becoming close |
| **Continuity** | Point | Missing neighbors | Related points getting separated |
| **Steadiness** | Cluster | False groups | Fake clusters appearing |
| **Cohesiveness** | Cluster | Missing groups | Real clusters being torn apart |

## Metric Details

### Trustworthiness & Continuity (T&C)

These metrics evaluate **local neighborhood preservation**:

- **Trustworthiness**: For each point in the low-dim embedding, checks if its k-nearest neighbors were also nearby in the high-dim space. Low trustworthiness means the projection is introducing "false neighbors" - points that weren't related are now close together.

- **Continuity**: For each point in the high-dim space, checks if its k-nearest neighbors are still nearby in the projection. Low continuity means the projection is "tearing apart" neighborhoods - points that were related are now far apart.

```javascript
import ZADU from 'zadu-js';

const result = ZADU.trustworthinessAndContinuity(highDim, lowDim, k);
// result.trustworthiness.score - global trustworthiness [0, 1]
// result.trustworthiness.localScores - per-point scores
// result.continuity.score - global continuity [0, 1]
// result.continuity.localScores - per-point scores
```

### Steadiness & Cohesiveness (S&C)

These metrics evaluate **cluster structure preservation**:

- **Steadiness**: Extracts clusters from the low-dim embedding and measures if those points formed cohesive groups in the original space. Low steadiness means the projection is creating "false groups" - clusters that don't exist in the original data.

- **Cohesiveness**: Extracts clusters from the high-dim space and measures if those points remain together in the projection. Low cohesiveness means the projection is "splitting" real clusters.

```javascript
import ZADU from 'zadu-js';

const result = ZADU.steadinessCohesiveness(highDim, lowDim, {
  k: 7,           // Number of nearest neighbors (default: sqrt(n))
  iteration: 150, // Number of sampling iterations (default: 150)
  walkNumRatio: 0.3, // Random walk length ratio (default: 0.3)
  alpha: 0.1      // Distance penalty parameter (default: 0.1)
});
// result.steadiness.score - global steadiness [0, 1]
// result.steadiness.localScores - per-point scores
// result.cohesiveness.score - global cohesiveness [0, 1]
// result.cohesiveness.localScores - per-point scores
```

## When to Use Each Metric

### Always Use: T&C
Trustworthiness and Continuity are baseline quality measures. Use them for any dimensionality reduction evaluation.

### When Cluster Structure Matters: S&C
Use Steadiness and Cohesiveness when:
- Your data has meaningful cluster structure
- You care about preserving group relationships
- You want to detect if the DR algorithm is creating artificial clusters or splitting real ones

## Hyperparameter Tuning Guide

### UMAP `min_dist`

| Value | Effect | Risk | Check |
|-------|--------|------|-------|
| Low (0.0-0.1) | Tight clusters | False groups | Steadiness |
| High (0.3-0.5) | Spread out | Missing groups | Cohesiveness |

### UMAP `n_neighbors`

| Value | Effect | Risk | Check |
|-------|--------|------|-------|
| Low (5-15) | Local structure | May miss global clusters | S&C |
| High (50-200) | Global structure | May blur local details | T&C |

### t-SNE `perplexity`

| Value | Effect | Risk | Check |
|-------|--------|------|-------|
| Low (5-20) | Fine detail | May fragment clusters | Cohesiveness |
| High (30-50) | Broader view | May merge clusters | Steadiness |

## Interpretation Guide

### Score Combinations

| T&C | S&C | Interpretation |
|-----|-----|----------------|
| High (>0.9) | High (>0.9) | Excellent preservation |
| High | Low | Good local, bad cluster structure |
| Low | High | Good clusters, bad local detail |
| Low | Low | Poor embedding, try different algorithm/params |

### Common Patterns

**High Trustworthiness, Low Cohesiveness**
The projection preserves local neighborhoods but is splitting real clusters. Try:
- Lower `min_dist` in UMAP
- Higher `perplexity` in t-SNE

**High Cohesiveness, Low Steadiness**
Clusters stay together, but fake clusters are appearing. Try:
- Higher `min_dist` in UMAP
- Different initialization

**Both T&C High, Both S&C Low**
Local structure is preserved but cluster structure is distorted. The data may not have clear clusters, or the DR algorithm isn't suited for your data.

## Algorithm Selection Guide

| Data Characteristic | Recommended Algorithm | Key Metrics |
|---------------------|----------------------|-------------|
| Clear clusters | UMAP | S&C |
| Continuous manifold | t-SNE | T&C |
| Linear structure | PCA | T&C |
| Hierarchical clusters | UMAP with low `min_dist` | S&C |
| Mixed | Try multiple, compare all metrics | All |

## Example Workflow

```javascript
import ZADU from 'zadu-js';

// Your high-dimensional data and embedding
const highDim = [...]; // n × d array
const lowDim = [...];  // n × 2 array (UMAP/t-SNE output)

// 1. Compute all metrics
const tnc = ZADU.trustworthinessAndContinuity(highDim, lowDim, 15);
const snc = ZADU.steadinessCohesiveness(highDim, lowDim, { k: 15 });

// 2. Print summary
console.log('Quality Summary:');
console.log(`  Trustworthiness: ${tnc.trustworthiness.score.toFixed(3)}`);
console.log(`  Continuity:      ${tnc.continuity.score.toFixed(3)}`);
console.log(`  Steadiness:      ${snc.steadiness.score.toFixed(3)}`);
console.log(`  Cohesiveness:    ${snc.cohesiveness.score.toFixed(3)}`);

// 3. Find problematic points using local scores
const problemPoints = tnc.trustworthiness.localScores
  .map((score, i) => ({ i, score }))
  .filter(p => p.score < 0.8)
  .sort((a, b) => a.score - b.score);

console.log(`\nPoints with low trustworthiness: ${problemPoints.length}`);
```

## Using with measure() API

```javascript
const spec = [
  { id: 'tnc', params: { k: 15 } },
  { id: 'snc', params: { k: 15, iteration: 100 } }
];

const results = ZADU.measure(spec, highDim, lowDim);
// results[0] = { trustworthiness: {...}, continuity: {...} }
// results[1] = { steadiness: {...}, cohesiveness: {...} }
```

## References

- Trustworthiness & Continuity: Venna & Kaski (2006) "Local multidimensional scaling"
- Steadiness & Cohesiveness: Jeon et al. "Measuring and Interpreting the Reliability of DR"
