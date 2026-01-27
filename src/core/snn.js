/**
 * src/core/snn.js
 * Shared Nearest Neighbor (SNN) utilities for Steadiness & Cohesiveness metrics
 */

/**
 * Get k-nearest neighbor indices for each point
 * @param {number[][]} distMatrix - n×n distance matrix
 * @param {number} k - number of neighbors
 * @returns {number[][]} - array of k neighbor indices for each point
 */
function getKNNIndices(distMatrix, k) {
  const n = distMatrix.length;
  const knnIndices = [];

  for (let i = 0; i < n; i++) {
    const distances = distMatrix[i]
      .map((dist, idx) => ({ idx, dist }))
      .filter(item => item.idx !== i);

    distances.sort((a, b) => a.dist - b.dist);
    knnIndices.push(distances.slice(0, k).map(item => item.idx));
  }

  return knnIndices;
}

/**
 * Compute weighted SNN similarity matrix
 * For pair (i,j): sum over shared neighbors m of (k+1-rank_i(m)) * (k+1-rank_j(m))
 * @param {number[][]} knnIndices - k-NN indices for each point
 * @param {number} k - number of neighbors
 * @returns {number[][]} - n×n SNN similarity matrix
 */
function computeSNNMatrix(knnIndices, k) {
  const n = knnIndices.length;
  const snnMatrix = Array(n).fill(null).map(() => Array(n).fill(0));

  // Build rank maps for each point
  const rankMaps = knnIndices.map(neighbors => {
    const map = new Map();
    neighbors.forEach((neighborIdx, rank) => {
      map.set(neighborIdx, rank);
    });
    return map;
  });

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let similarity = 0;

      // Check all neighbors of i
      for (const [neighborIdx, rankI] of rankMaps[i]) {
        // Check if this neighbor is also a neighbor of j
        if (rankMaps[j].has(neighborIdx)) {
          const rankJ = rankMaps[j].get(neighborIdx);
          // Weight: higher for neighbors that are close to both points
          similarity += (k - rankI) * (k - rankJ);
        }
      }

      // Also check if i is a neighbor of j and vice versa
      if (rankMaps[i].has(j)) {
        const rankIJ = rankMaps[i].get(j);
        if (rankMaps[j].has(i)) {
          const rankJI = rankMaps[j].get(i);
          similarity += (k - rankIJ) * (k - rankJI);
        }
      }

      snnMatrix[i][j] = similarity;
      snnMatrix[j][i] = similarity;
    }
  }

  return snnMatrix;
}

export { getKNNIndices, computeSNNMatrix };
