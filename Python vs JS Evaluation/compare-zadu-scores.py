"""
Compare Python ZADU vs JavaScript ZADU scores on the MNIST-200 embedding.

Reads pre-computed JS scores from mnist-200-embedding.json, runs Python ZADU
on the same high-dim data and embedding, then writes a comparison table to
zadu-comparison.md.
"""

import json
import math
import time
import os
import numpy as np
import zadu

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH  = os.path.join(SCRIPT_DIR, "mnist-200-embedding.json")
OUT_PATH   = os.path.join(SCRIPT_DIR, "zadu-comparison.md")


RUNS = 3


def local_stats(scores):
    arr = np.array(scores)
    return arr.min(), arr.max(), arr.mean()


def bench(fn):
    times, result = [], None
    for _ in range(RUNS):
        t0 = time.perf_counter()
        result = fn()
        times.append((time.perf_counter() - t0) * 1000)
    return result, min(times), sum(times) / RUNS, max(times)


def fmt(v, decimals=6):
    return f"{v:.{decimals}f}"


def main():
    # ── Load data ──────────────────────────────────────────────────────────
    with open(JSON_PATH) as f:
        data = json.load(f)

    high_dim  = np.array(data["highDimData"], dtype=np.float64)
    embedding = np.array(data["embedding"],   dtype=np.float64)
    js        = data["metrics"]
    k_tnc     = data["metadata"]["metric_k"]          # 7
    n         = high_dim.shape[0]                     # 200
    k_snc     = math.floor(math.sqrt(n))              # 14 (JS default)

    params = data["metadata"]["parameters"]
    print(f"Dataset: MNIST-200, UMAP n_neighbors={params['n_neighbors']}, "
          f"min_dist={params['min_dist']}")
    print(f"TNC k={k_tnc}, SNC k={k_snc}, n={n}\n")

    # ── Run Python ZADU: TNC ───────────────────────────────────────────────
    print(f"Running Python ZADU TNC ({RUNS} runs)...")
    tnc_zadu = zadu.ZADU(
        [{"id": "tnc", "params": {"k": k_tnc}}],
        high_dim,
        return_local=True
    )
    (tnc_scores, tnc_local), tnc_min, tnc_mean, tnc_max = bench(
        lambda: tnc_zadu.measure(embedding)
    )

    py_trust = tnc_scores[0]["trustworthiness"]
    py_cont  = tnc_scores[0]["continuity"]
    py_trust_local = tnc_local[0]["local_trustworthiness"]
    py_cont_local  = tnc_local[0]["local_continuity"]

    # ── Run Python ZADU: SNC ───────────────────────────────────────────────
    print(f"Running Python ZADU SNC ({RUNS} runs, 150 iterations each)...")
    snc_zadu = zadu.ZADU(
        [{"id": "snc", "params": {"k": k_snc, "iteration": 150}}],
        high_dim,
        return_local=True
    )
    (snc_scores, snc_local), snc_min, snc_mean, snc_max = bench(
        lambda: snc_zadu.measure(embedding)
    )

    py_stead = snc_scores[0]["steadiness"]
    py_cohes = snc_scores[0]["cohesiveness"]
    py_stead_local = snc_local[0]["local_steadiness"]  if snc_local[0] else []
    py_cohes_local = snc_local[0]["local_cohesiveness"] if snc_local[0] else []

    # ── Pull JS scores ─────────────────────────────────────────────────────
    js_trust = js["trustworthiness"]["global"]
    js_cont  = js["continuity"]["global"]
    js_stead = js["steadiness"]["global"]
    js_cohes = js["cohesiveness"]["global"]

    js_trust_local = js["trustworthiness"]["local"]
    js_cont_local  = js["continuity"]["local"]
    js_stead_local = js["steadiness"]["local"]
    js_cohes_local = js["cohesiveness"]["local"]

    # JS runtimes from benchmark-metrics.js (3-run average via performance.now())
    # Trust: min=17.6 mean=24.2 max=36.8 | Cont: min=17.1 mean=18.1 max=19.4
    # S+Co:  min=221.2 mean=232.8 max=247.6
    js_trust_ms = {"min": 17.6, "mean": 24.2, "max": 36.8}
    js_cont_ms  = {"min": 17.1, "mean": 18.1, "max": 19.4}
    js_snc_ms   = {"min": 221.2, "mean": 232.8, "max": 247.6}

    # ── Build markdown ─────────────────────────────────────────────────────
    lines = [
        "# ZADU Score Comparison: Python vs JavaScript",
        "",
        f"**Dataset:** MNIST-200 &nbsp;|&nbsp; "
        f"**Embedding:** UMAP (n_neighbors={params['n_neighbors']}, min_dist={params['min_dist']}) &nbsp;|&nbsp; "
        f"**TNC k:** {k_tnc} &nbsp;|&nbsp; **SNC k:** {k_snc}",
        "",
        "---",
        "",
        "## Global Scores",
        "",
        "| Metric | Python | JavaScript | Difference |",
        "|--------|--------|------------|------------|",
        f"| Trustworthiness | {fmt(py_trust)} | {fmt(js_trust)} | {py_trust - js_trust:+.6f} |",
        f"| Continuity      | {fmt(py_cont)}  | {fmt(js_cont)}  | {py_cont  - js_cont:+.6f} |",
        f"| Steadiness      | {fmt(py_stead)} | {fmt(js_stead)} | {py_stead - js_stead:+.6f} |",
        f"| Cohesiveness    | {fmt(py_cohes)} | {fmt(js_cohes)} | {py_cohes - js_cohes:+.6f} |",
        "",
        "---",
        "",
        "## Local Score Statistics",
        "",
        "| Metric | Implementation | Min | Max | Mean |",
        "|--------|----------------|-----|-----|------|",
    ]

    for label, py_loc, js_loc in [
        ("Trustworthiness", py_trust_local, js_trust_local),
        ("Continuity",      py_cont_local,  js_cont_local),
        ("Steadiness",      py_stead_local, js_stead_local),
        ("Cohesiveness",    py_cohes_local, js_cohes_local),
    ]:
        if len(py_loc) > 0:
            mn, mx, me = local_stats(py_loc)
            lines.append(f"| {label} | Python | {fmt(mn,4)} | {fmt(mx,4)} | {fmt(me,4)} |")
        else:
            lines.append(f"| {label} | Python | N/A | N/A | N/A |")

        mn, mx, me = local_stats(js_loc)
        lines.append(f"| {label} | JavaScript | {fmt(mn,4)} | {fmt(mx,4)} | {fmt(me,4)} |")

    lines += [
        "",
        "---",
        "",
        "## Runtime",
        "",
        f"_Python: {RUNS} runs via time.perf_counter(). JS: {RUNS} runs via performance.now() from benchmark-metrics.js._",
        "",
        "| Metric | Py min | Py mean | Py max | JS min | JS mean | JS max |",
        "|--------|--------|---------|--------|--------|---------|--------|",
        f"| Trustworthiness       | {tnc_min:.1f} ms | {tnc_mean:.1f} ms | {tnc_max:.1f} ms | {js_trust_ms['min']} ms | {js_trust_ms['mean']} ms | {js_trust_ms['max']} ms |",
        f"| Continuity            | {tnc_min:.1f} ms | {tnc_mean:.1f} ms | {tnc_max:.1f} ms | {js_cont_ms['min']} ms | {js_cont_ms['mean']} ms | {js_cont_ms['max']} ms |",
        f"| Steadiness+Cohesiveness | {snc_min:.1f} ms | {snc_mean:.1f} ms | {snc_max:.1f} ms | {js_snc_ms['min']} ms | {js_snc_ms['mean']} ms | {js_snc_ms['max']} ms |",
        "",
    ]

    out = "\n".join(lines)
    with open(OUT_PATH, "w") as f:
        f.write(out)

    print(f"\nWrote {OUT_PATH}")
    print("\n" + out)


if __name__ == "__main__":
    main()
