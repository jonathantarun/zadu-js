/**
 * src/core/clustering.js
 * DBSCAN clustering with precomputed distance matrix support
 * Used for Steadiness & Cohesiveness metrics
 */

/**
 * DBSCAN clustering algorithm with precomputed distance matrix
 * Similar to sklearn's HDBSCAN(metric="precomputed", allow_single_cluster=True)
 *
 * @param {number[][]} distMatrix - precomputed distance matrix (n × n)
 * @param {number[]} indices - indices of points to cluster
 * @param {Object} options - clustering options
 * @param {number} [options.minClusterSize=2] - minimum points to form a cluster
 * @returns {number[]} - cluster labels for each point (-1 for noise)
 */
function dbscan(distMatrix, indices, options = {}) {
  const n = indices.length;

  if (n < 2) {
    return [0]; // Single point is its own cluster
  }

  const minClusterSize = options.minClusterSize || 2;

  // Extract submatrix for cluster indices
  const subDist = [];
  for (let i = 0; i < n; i++) {
    subDist[i] = [];
    for (let j = 0; j < n; j++) {
      subDist[i][j] = distMatrix[indices[i]][indices[j]];
    }
  }

  // Compute eps automatically as a percentile of distances (similar to HDBSCAN behavior)
  const allDists = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isFinite(subDist[i][j])) {
        allDists.push(subDist[i][j]);
      }
    }
  }

  if (allDists.length === 0) {
    // All distances are infinite or NaN, treat all as one cluster
    return Array(n).fill(0);
  }

  allDists.sort((a, b) => a - b);

  // Use a percentile-based eps (similar to HDBSCAN's approach)
  // Using 50th percentile as default threshold
  const eps = allDists[Math.floor(allDists.length * 0.5)] || allDists[0];

  const labels = Array(n).fill(-1); // -1 = unvisited/noise
  const visited = Array(n).fill(false);
  let clusterId = 0;

  // Find neighbors within eps distance
  function getNeighbors(pointIdx) {
    const neighbors = [];
    for (let j = 0; j < n; j++) {
      if (subDist[pointIdx][j] <= eps) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;

    const neighbors = getNeighbors(i);

    if (neighbors.length < minClusterSize) {
      // Mark as noise (label stays -1)
      continue;
    }

    // Start a new cluster
    labels[i] = clusterId;
    const seedSet = [...neighbors];
    let seedIdx = 0;

    while (seedIdx < seedSet.length) {
      const q = seedSet[seedIdx];
      seedIdx++;

      if (!visited[q]) {
        visited[q] = true;
        const qNeighbors = getNeighbors(q);

        if (qNeighbors.length >= minClusterSize) {
          // Add new neighbors to seed set
          for (const neighbor of qNeighbors) {
            if (!seedSet.includes(neighbor)) {
              seedSet.push(neighbor);
            }
          }
        }
      }

      // Assign to cluster if not already assigned
      if (labels[q] === -1) {
        labels[q] = clusterId;
      }
    }

    clusterId++;
  }

  // If allow_single_cluster behavior: if all points are noise, make them one cluster
  if (labels.every(l => l === -1)) {
    return Array(n).fill(0);
  }

  return labels;
}

/**
 * Separate cluster indices by their labels
 * Points with label -1 (noise) each become their own cluster
 *
 * @param {number[]} clusterIndices - original point indices
 * @param {number[]} labels - cluster labels from DBSCAN
 * @returns {number[][]} - array of clusters, each containing point indices
 */
function separateClusters(clusterIndices, labels) {
  const maxLabel = Math.max(...labels);
  const clusters = [];

  // Create clusters for each label >= 0
  for (let c = 0; c <= Math.max(0, maxLabel); c++) {
    clusters.push([]);
  }

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] >= 0) {
      clusters[labels[i]].push(clusterIndices[i]);
    } else {
      // Noise points: each becomes its own cluster
      clusters.push([clusterIndices[i]]);
    }
  }

  // Filter out empty clusters
  return clusters.filter(c => c.length > 0);
}

export { dbscan, separateClusters };
