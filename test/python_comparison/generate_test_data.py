"""
Generate test data and Python ZADU results for JavaScript validation.

Prerequisites:
    pip install zadu numpy

Usage:
    python generate_test_data.py
"""
import numpy as np
import json
import time

try:
    from zadu.zadu import steadiness_cohesiveness
except ImportError:
    print("Error: zadu package not installed.")
    print("Install with: pip install zadu")
    exit(1)

# Generate reproducible test data
np.random.seed(42)

# Create clustered data: two groups
n = 50
group1 = np.random.randn(n // 2, 10) + np.array([0] * 10)
group2 = np.random.randn(n // 2, 10) + np.array([5] * 10)
high_dim = np.vstack([group1, group2])

# Create low-dim embedding that roughly preserves structure
group1_low = np.random.randn(n // 2, 2) * 0.5 + np.array([0, 0])
group2_low = np.random.randn(n // 2, 2) * 0.5 + np.array([3, 3])
low_dim = np.vstack([group1_low, group2_low])

# Calculate k as sqrt(n) to match JS default
k = int(np.sqrt(n))

# Run Python ZADU SNC with specific params
print(f"Running SNC with n={n}, k={k}, iteration=200...")
start_time = time.time()
result = steadiness_cohesiveness.measure(
    orig=high_dim,
    emb=low_dim,
    k=k,
    iteration=200,  # more iterations for stability
    walk_num_ratio=0.3,
    alpha=0.1
)
python_time = (time.time() - start_time) * 1000

steadiness = result['steadiness']
cohesiveness = result['cohesiveness']

print(f"Python ZADU results:")
print(f"  Steadiness:   {steadiness:.4f}")
print(f"  Cohesiveness: {cohesiveness:.4f}")
print(f"  Time:         {python_time:.2f}ms")

# Save test fixture
fixture = {
    "high_dim": high_dim.tolist(),
    "low_dim": low_dim.tolist(),
    "params": {
        "k": k,
        "iteration": 200,
        "walkNumRatio": 0.3,
        "alpha": 0.1
    },
    "expected": {
        "steadiness": float(steadiness),
        "cohesiveness": float(cohesiveness),
        "time_ms": python_time
    }
}

with open("test_fixture.json", "w") as f:
    json.dump(fixture, f, indent=2)

print("\nTest fixture saved to test_fixture.json")
