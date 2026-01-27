/**
 * src/metrics/local/steadiness_cohesiveness.js
 * Steadiness & Cohesiveness metrics for inter-cluster reliability
 *
 * Ported from Python steadiness-cohesiveness package:
 * https://github.com/hj-n/steadiness-cohesiveness
 */

import { calculateDistanceMatrix } from '../../core/distance.js';
import { getKNNIndices, computeSNNMatrix } from '../../core/snn.js';
import { extractCluster } from '../../core/randomWalk.js';

/**
 * Compute inter-cluster distance distortion
 * Measures how much the cluster structure changes between spaces
 *
 * @param {number[]} clusterIndices - indices of points in the cluster
 * @param {number[][]} sourceDistMatrix - distance matrix of source space
 * @param {number[][]} targetDistMatrix - distance matrix of target space
 * @param {number} alpha - SNN distance penalty parameter
 * @returns {Object} - { distortion, weight }
 */
function computeDistortion(clusterIndices, sourceDistMatrix, targetDistMatrix, alpha) {
  if (clusterIndices.length < 2) {
    return { distortion: 0, weight: 0 };
  }

  let distortion = 0;
  let weight = 0;
  const clusterSet = new Set(clusterIndices);

  // For each point in the cluster, compute distance to points outside the cluster
  for (const i of clusterIndices) {
    let inClusterDist = 0;
    let inClusterCount = 0;

    // Average distance to other points IN the cluster (in source space)
    for (const j of clusterIndices) {
      if (i !== j) {
        inClusterDist += sourceDistMatrix[i][j];
        inClusterCount++;
      }
    }

    if (inClusterCount === 0) continue;
    const avgInClusterDist = inClusterDist / inClusterCount;

    // For points outside cluster, measure distortion
    for (let j = 0; j < sourceDistMatrix.length; j++) {
      if (!clusterSet.has(j)) {
        // Distance in source space
        const sourceDist = sourceDistMatrix[i][j];
        // Distance in target space
        const targetDist = targetDistMatrix[i][j];

        // Relative distance change (normalized by cluster spread)
        if (avgInClusterDist > 0) {
          const sourceRelative = sourceDist / avgInClusterDist;
          const targetRelative = targetDist > 0 ?
            targetDistMatrix[i][clusterIndices.filter(k => k !== i)[0]] / avgInClusterDist : 1;

          // Penalize when distant points in source become close in target
          // (for steadiness: points outside cluster in high-dim appear in low-dim cluster)
          const dist = Math.abs(sourceRelative - targetRelative);
          distortion += dist * Math.exp(-alpha * sourceDist);
          weight += Math.exp(-alpha * sourceDist);
        }
      }
    }
  }

  return { distortion, weight };
}

/**
 * Compute cluster-based distortion for one direction (steadiness or cohesiveness)
 *
 * @param {number[][]} sourceDistMatrix - distance matrix to extract clusters from
 * @param {number[][]} targetDistMatrix - distance matrix to measure distortion in
 * @param {number[][]} sourceSNNMatrix - SNN matrix for cluster extraction
 * @param {number} n - number of points
 * @param {number} iteration - number of iterations
 * @param {number} walkLength - random walk length
 * @param {number} alpha - distance penalty parameter
 * @returns {Object} - { score, localScores }
 */
function computeMetric(sourceDistMatrix, targetDistMatrix, sourceSNNMatrix, n, iteration, walkLength, alpha) {
  const localDistortions = Array(n).fill(0);
  const localWeights = Array(n).fill(0);
  let totalDistortion = 0;
  let totalWeight = 0;

  for (let iter = 0; iter < iteration; iter++) {
    // Random starting point
    const startIdx = Math.floor(Math.random() * n);

    // Extract cluster using random walk on source space SNN
    const clusterIndices = extractCluster(sourceSNNMatrix, startIdx, walkLength);

    if (clusterIndices.length < 2) continue;

    // Compute how well the cluster preserves structure in target space
    // Here we measure: given a cluster in source, how spread out is it in target?
    let clusterDistortion = 0;
    let clusterWeight = 0;

    // Compute pairwise distances within cluster in both spaces
    const clusterPairs = [];
    for (let i = 0; i < clusterIndices.length; i++) {
      for (let j = i + 1; j < clusterIndices.length; j++) {
        const idx1 = clusterIndices[i];
        const idx2 = clusterIndices[j];
        clusterPairs.push({ idx1, idx2 });
      }
    }

    if (clusterPairs.length === 0) continue;

    // Compute average distances in both spaces
    let avgSourceDist = 0;
    let avgTargetDist = 0;
    for (const { idx1, idx2 } of clusterPairs) {
      avgSourceDist += sourceDistMatrix[idx1][idx2];
      avgTargetDist += targetDistMatrix[idx1][idx2];
    }
    avgSourceDist /= clusterPairs.length;
    avgTargetDist /= clusterPairs.length;

    // Avoid division by zero
    if (avgSourceDist === 0) avgSourceDist = 1e-10;
    if (avgTargetDist === 0) avgTargetDist = 1e-10;

    // Compute normalized distortion for each pair
    for (const { idx1, idx2 } of clusterPairs) {
      const sourceNorm = sourceDistMatrix[idx1][idx2] / avgSourceDist;
      const targetNorm = targetDistMatrix[idx1][idx2] / avgTargetDist;

      // Distortion: how much the relative distances change
      const pairDistortion = Math.abs(sourceNorm - targetNorm);
      const pairWeight = Math.exp(-alpha * sourceDistMatrix[idx1][idx2]);

      clusterDistortion += pairDistortion * pairWeight;
      clusterWeight += pairWeight;

      // Accumulate local scores
      localDistortions[idx1] += pairDistortion * pairWeight;
      localWeights[idx1] += pairWeight;
      localDistortions[idx2] += pairDistortion * pairWeight;
      localWeights[idx2] += pairWeight;
    }

    totalDistortion += clusterDistortion;
    totalWeight += clusterWeight;
  }

  // Normalize final score
  const score = totalWeight > 0 ? 1 - (totalDistortion / totalWeight) : 1;

  // Compute local scores
  const localScores = localDistortions.map((distortion, i) => {
    if (localWeights[i] > 0) {
      return 1 - (distortion / localWeights[i]);
    }
    return 1; // No data for this point, assume perfect
  });

  return { score: Math.max(0, Math.min(1, score)), localScores };
}

/**
 * Calculate Steadiness and Cohesiveness metrics
 *
 * - Steadiness: Whether clusters in the projected (low-dim) space form cohesive
 *   groups in the original (high-dim) space. Detects "false groups" created by projection.
 * - Cohesiveness: Whether clusters in the original space remain intact in the projection.
 *   Detects "missing groups" torn apart by the projection.
 *
 * @param {number[][]} highDim - high-dimensional data (n points × d dimensions)
 * @param {number[][]} lowDim - low-dimensional embedding (n points × d' dimensions)
 * @param {Object} options - configuration options
 * @param {number} [options.k] - nearest neighbors (default: Math.floor(Math.sqrt(n)))
 * @param {number} [options.iteration=150] - number of iterations
 * @param {number} [options.walkNumRatio=0.3] - walk length ratio
 * @param {number} [options.alpha=0.1] - SNN distance parameter
 * @returns {Object} { steadiness: {...}, cohesiveness: {...} }
 */
function steadinessCohesiveness(highDim, lowDim, options = {}) {
  const n = highDim.length;

  // Validate inputs
  if (n !== lowDim.length) {
    throw new Error(`High-dim and low-dim data must have same number of points (${n} vs ${lowDim.length})`);
  }

  if (n < 3) {
    throw new Error(`Need at least 3 points for steadiness/cohesiveness (got ${n})`);
  }

  // Set defaults
  const k = options.k ?? Math.floor(Math.sqrt(n));
  const iteration = options.iteration ?? 150;
  const walkNumRatio = options.walkNumRatio ?? 0.3;
  const alpha = options.alpha ?? 0.1;

  // Validate k
  if (k >= n) {
    throw new Error(`k (${k}) must be less than number of samples (${n})`);
  }

  if (k < 1) {
    throw new Error(`k must be at least 1 (got ${k})`);
  }

  // Calculate distance matrices
  const highDistMatrix = calculateDistanceMatrix(highDim);
  const lowDistMatrix = calculateDistanceMatrix(lowDim);

  // Get k-nearest neighbors
  const highKNN = getKNNIndices(highDistMatrix, k);
  const lowKNN = getKNNIndices(lowDistMatrix, k);

  // Compute SNN matrices
  const highSNNMatrix = computeSNNMatrix(highKNN, k);
  const lowSNNMatrix = computeSNNMatrix(lowKNN, k);

  // Calculate walk length
  const walkLength = Math.max(2, Math.floor(n * walkNumRatio));

  // Compute steadiness: extract clusters from LOW-dim, measure distortion in HIGH-dim
  // (Detects false groups: points clustered in low-dim but not in high-dim)
  const steadinessResult = computeMetric(
    lowDistMatrix, highDistMatrix, lowSNNMatrix,
    n, iteration, walkLength, alpha
  );

  // Compute cohesiveness: extract clusters from HIGH-dim, measure distortion in LOW-dim
  // (Detects missing groups: points clustered in high-dim but spread in low-dim)
  const cohesivenessResult = computeMetric(
    highDistMatrix, lowDistMatrix, highSNNMatrix,
    n, iteration, walkLength, alpha
  );

  return {
    steadiness: {
      score: steadinessResult.score,
      localScores: steadinessResult.localScores,
      k,
      n,
      iteration
    },
    cohesiveness: {
      score: cohesivenessResult.score,
      localScores: cohesivenessResult.localScores,
      k,
      n,
      iteration
    }
  };
}

export default steadinessCohesiveness;
