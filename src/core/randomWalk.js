/**
 * src/core/randomWalk.js
 * Random walk cluster extraction for Steadiness & Cohesiveness metrics
 */

/**
 * Extract a cluster via SNN-guided random walk
 * @param {number[][]} snnMatrix - SNN similarity matrix
 * @param {number} startIdx - starting point index
 * @param {number} walkLength - number of steps
 * @returns {number[]} - indices of visited points (the cluster)
 */
function extractCluster(snnMatrix, startIdx, walkLength) {
  const n = snnMatrix.length;
  const visited = new Set([startIdx]);
  let currentIdx = startIdx;

  for (let step = 0; step < walkLength; step++) {
    // Get SNN similarities to all other points from current point
    const similarities = snnMatrix[currentIdx];

    // Calculate transition probabilities (proportional to SNN similarity)
    const weights = [];
    let totalWeight = 0;

    for (let i = 0; i < n; i++) {
      if (i !== currentIdx) {
        // Add small epsilon to avoid division by zero and allow some exploration
        const weight = similarities[i] + 0.001;
        weights.push({ idx: i, weight });
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) {
      // No valid transitions, stay at current position
      continue;
    }

    // Sample next point based on probabilities
    const rand = Math.random() * totalWeight;
    let cumulative = 0;
    let nextIdx = currentIdx;

    for (const { idx, weight } of weights) {
      cumulative += weight;
      if (rand <= cumulative) {
        nextIdx = idx;
        break;
      }
    }

    visited.add(nextIdx);
    currentIdx = nextIdx;
  }

  return Array.from(visited);
}

export { extractCluster };
