"""
Generate test data and Python SNC results for JavaScript validation.

Prerequisites:
    pip install steadiness-cohesiveness numpy

Usage:
    python generate_test_data.py
"""
import numpy as np
import json

try:
    from snc import SNC
except ImportError:
    print("Error: steadiness-cohesiveness package not installed.")
    print("Install with: pip install steadiness-cohesiveness")
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

# Run Python SNC with specific params
print(f"Running SNC with n={n}, k={k}, iteration=50...")
snc = SNC(
    raw=high_dim,
    emb=low_dim,
    iteration=50,  # fewer for faster tests
    walk_num_ratio=0.3
)
snc.fit()

steadiness = snc.steadiness()
cohesiveness = snc.cohesiveness()

print(f"Python results:")
print(f"  Steadiness:   {steadiness:.4f}")
print(f"  Cohesiveness: {cohesiveness:.4f}")

# Save test fixture
fixture = {
    "high_dim": high_dim.tolist(),
    "low_dim": low_dim.tolist(),
    "params": {
        "k": k,
        "iteration": 50,
        "walkNumRatio": 0.3
    },
    "expected": {
        "steadiness": float(steadiness),
        "cohesiveness": float(cohesiveness)
    }
}

with open("test_fixture.json", "w") as f:
    json.dump(fixture, f, indent=2)

print("\nTest fixture saved to test_fixture.json")
