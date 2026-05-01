# ZADU Score Comparison: Python vs JavaScript

**Dataset:** MNIST-200 &nbsp;|&nbsp; **Embedding:** UMAP (n_neighbors=15, min_dist=0.1) &nbsp;|&nbsp; **TNC k:** 7 &nbsp;|&nbsp; **SNC k:** 14

---

## Global Scores

| Metric | Python | JavaScript | Difference |
|--------|--------|------------|------------|
| Trustworthiness | 0.923466 | 0.925805 | -0.002339 |
| Continuity      | 0.947264  | 0.949603  | -0.002339 |
| Steadiness      | 0.819070 | 0.764629 | +0.054441 |
| Cohesiveness    | 0.603959 | 0.673061 | -0.069102 |

---

## Local Score Statistics

| Metric | Implementation | Min | Max | Mean |
|--------|----------------|-----|-----|------|
| Trustworthiness | Python | 0.5019 | 1.0000 | 0.9235 |
| Trustworthiness | JavaScript | 0.5057 | 1.0000 | 0.9258 |
| Continuity | Python | 0.4460 | 1.0000 | 0.9473 |
| Continuity | JavaScript | 0.4497 | 1.0000 | 0.9496 |
| Steadiness | Python | 0.0000 | 0.9951 | 0.8806 |
| Steadiness | JavaScript | 0.0000 | 1.0000 | 0.8688 |
| Cohesiveness | Python | 0.0000 | 1.0000 | 0.6162 |
| Cohesiveness | JavaScript | 0.0000 | 1.0000 | 0.7785 |

---

## Runtime

_Python: 3 runs via time.perf_counter(). JS: 3 runs via performance.now() from benchmark-metrics.js._

| Metric | Py min | Py mean | Py max | JS min | JS mean | JS max |
|--------|--------|---------|--------|--------|---------|--------|
| Trustworthiness       | 5.8 ms | 6.1 ms | 6.5 ms | 17.6 ms | 24.2 ms | 36.8 ms |
| Continuity            | 5.8 ms | 6.1 ms | 6.5 ms | 17.1 ms | 18.1 ms | 19.4 ms |
| Steadiness+Cohesiveness | 224.2 ms | 236.3 ms | 247.2 ms | 221.2 ms | 232.8 ms | 247.6 ms |
