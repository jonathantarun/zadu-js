"""
Generate MNIST test fixture with timing for JavaScript validation.
"""
import numpy as np
import json
import time
from sklearn.datasets import fetch_openml
from sklearn.decomposition import PCA
from umap import UMAP

try:
    from zadu.zadu import steadiness_cohesiveness
except ImportError:
    print("Error: zadu package not installed.")
    print("Install with: pip install zadu umap-learn scikit-learn")
    exit(1)

print("Loading MNIST dataset...")
mnist = fetch_openml('mnist_784', version=1, as_frame=False, parser='liac-arff')
X, y = mnist.data, mnist.target.astype(int)

# Sample 200 points (20 from each digit)
np.random.seed(42)
n_per_class = 20
indices = []
for digit in range(10):
    digit_indices = np.where(y == digit)[0]
    sampled = np.random.choice(digit_indices, n_per_class, replace=False)
    indices.extend(sampled)
indices = np.array(indices)

X_sample = X[indices]
y_sample = y[indices]

print(f"Sampled {len(X_sample)} points (20 per digit)")

# Normalize BEFORE creating embedding (important for consistency)
X_sample = X_sample / 255.0  # Scale to [0,1]

# Create 2D embedding with UMAP
print("Creating UMAP embedding...")
umap = UMAP(n_components=2, random_state=42, n_neighbors=15, min_dist=0.1)
X_emb = umap.fit_transform(X_sample)

n = len(X_sample)
k = int(np.sqrt(n))

print(f"\nRunning SNC with n={n}, k={k}, iteration=200...")

# Time Python execution
start_time = time.time()
result = steadiness_cohesiveness.measure(
    orig=X_sample,
    emb=X_emb,
    k=k,
    iteration=200,
    walk_num_ratio=0.3,
    alpha=0.1
)
python_time = (time.time() - start_time) * 1000  # Convert to ms

steadiness = result['steadiness']
cohesiveness = result['cohesiveness']

print(f"Python ZADU results:")
print(f"  Steadiness:   {steadiness:.4f}")
print(f"  Cohesiveness: {cohesiveness:.4f}")
print(f"  Time:         {python_time:.2f}ms")

# Save fixture
fixture = {
    "description": "MNIST 200 samples (20 per digit), UMAP embedding",
    "high_dim": X_sample.tolist(),
    "low_dim": X_emb.tolist(),
    "labels": y_sample.tolist(),
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

import os
script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, "mnist_fixture.json")
with open(output_path, "w") as f:
    json.dump(fixture, f)

print(f"\nMNIST fixture saved to mnist_fixture.json ({len(X_sample[0])}D -> 2D)")
