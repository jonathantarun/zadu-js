/**
 * src/metrics/cluster/steadiness_cohesiveness.js
 * Steadiness & Cohesiveness metrics for inter-cluster reliability
 *
 * Ported from Python ZADU library which uses the SNC package:
 * https://github.com/hj-n/zadu
 * https://github.com/hj-n/steadiness-cohesiveness
 */

import { HDBSCAN } from 'hdbscan-ts';
import { calculateDistanceMatrix } from '../../core/distance.js';
import { getKNNIndices, computeSNNMatrix, normalizeSNNMatrix, computeSNNDistanceMatrix } from '../../core/snn.js';
import { extractCluster } from '../../core/randomWalk.js';

/**
 * Normalize a distance matrix by its maximum value
 * @param {number[][]} distMatrix - distance matrix
 * @returns {{ normalized: number[][], max: number }}
 */
function normalizeDistMatrix(distMatrix) {
  const n = distMatrix.length;
  let maxVal = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (distMatrix[i][j] > maxVal) {
        maxVal = distMatrix[i][j];
      }
    }
  }

  if (maxVal === 0) maxVal = 1;

  const normalized = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      normalized[i][j] = distMatrix[i][j] / maxVal;
    }
  }

  return { normalized, max: maxVal };
}

/**
 * Cluster points using HDBSCAN
 * @param {number[][]} data - full dataset
 * @param {number[]} indices - indices of points to cluster
 * @returns {number[][]} - array of clusters, each containing point indices
 */
function clusterWithHdbscan(data, indices) {
  if (indices.length < 3) {
    return [indices]; // Too small to cluster
  }

  const points = indices.map(i => data[i]);
  const hdbscan = new HDBSCAN({ minClusterSize: 2, minSamples: 2 });
  hdbscan.fit(points);
  const labels = hdbscan.labels_;

  // Separate into clusters (noise points become individual clusters)
  const clusters = new Map();
  labels.forEach((label, i) => {
    const key = label === -1 ? `noise_${i}` : label;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(indices[i]);
  });

  return [...clusters.values()];
}

/**
 * Compute average SNN-based distance between two clusters
 * @param {number[]} clusterA - indices of points in cluster A
 * @param {number[]} clusterB - indices of points in cluster B
 * @param {number[][]} rawSNNMatrix - normalized SNN similarity matrix for raw space
 * @param {number[][]} embSNNMatrix - normalized SNN similarity matrix for emb space
 * @param {number} alpha - distance parameter
 * @returns {{ rawDist: number, embDist: number }}
 */
function computeClusterDistance(clusterA, clusterB, rawSNNMatrix, embSNNMatrix, alpha) {
  const pairNum = clusterA.length * clusterB.length;

  let rawSim = 0;
  let embSim = 0;

  for (const i of clusterA) {
    for (const j of clusterB) {
      rawSim += rawSNNMatrix[i][j];
      embSim += embSNNMatrix[i][j];
    }
  }

  rawSim /= pairNum;
  embSim /= pairNum;

  const rawDist = 1 / (rawSim + alpha);
  const embDist = 1 / (embSim + alpha);

  return { rawDist, embDist };
}

/**
 * Precompute min/max distortion values for normalization
 * @param {number[][]} rawSNNDistMatrix - SNN distance matrix for raw space
 * @param {number[][]} embSNNDistMatrix - SNN distance matrix for embedded space
 * @returns {{ maxCompress: number, minCompress: number, maxStretch: number, minStretch: number }}
 */
function computeDistortionBounds(rawSNNDistMatrix, embSNNDistMatrix) {
  const n = rawSNNDistMatrix.length;

  let dissimMax = -Infinity;
  let dissimMin = Infinity;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dissim = rawSNNDistMatrix[i][j] - embSNNDistMatrix[i][j];
      if (dissim > dissimMax) dissimMax = dissim;
      if (dissim < dissimMin) dissimMin = dissim;
    }
  }

  const maxCompress = dissimMax > 0 ? dissimMax : 0;
  const minCompress = dissimMin > 0 ? dissimMin : 0;
  const maxStretch = dissimMin < 0 ? -dissimMin : 0;
  const minStretch = dissimMax < 0 ? -dissimMax : 0;

  return { maxCompress, minCompress, maxStretch, minStretch };
}

/**
 * Run a single iteration of the SNC measurement
 * @param {string} mode - 'steadiness' or 'cohesiveness'
 * @param {Object} infos - precomputed info objects
 * @param {number[][]} highDim - high-dimensional data
 * @param {number[][]} lowDim - low-dimensional embedding
 * @param {number} walkNum - walk length for cluster extraction
 * @param {number} alpha - distance parameter
 * @param {number} maxVal - max distortion for normalization
 * @param {number} minVal - min distortion for normalization
 * @param {number[]} localDistortions - accumulator for local scores
 * @param {number[]} localWeights - accumulator for local weights
 * @returns {{ distortionSum: number, weightSum: number }}
 */
function measureSingleIteration(mode, infos, highDim, lowDim, walkNum, alpha, maxVal, minVal, localDistortions, localWeights) {
  const n = infos.n;

  // Select which space to extract from
  let extractKNN, extractSNN, clusterData;
  if (mode === 'steadiness') {
    // Extract from embedded space, cluster in raw space
    extractKNN = infos.embKNN;
    extractSNN = infos.embSNNNorm;
    clusterData = highDim;
  } else {
    // Extract from raw space, cluster in embedded space
    extractKNN = infos.rawKNN;
    extractSNN = infos.rawSNNNorm;
    clusterData = lowDim;
  }

  // Random seed point
  const seedIdx = Math.floor(Math.random() * n);

  // Extract cluster via SNN-guided BFS
  let clusterIndices = extractCluster(extractKNN, extractSNN, seedIdx, walkNum);

  // Need at least 2 points
  if (clusterIndices.length < 2) {
    return { distortionSum: 0, weightSum: 0 };
  }

  // Cluster the extracted points using HDBSCAN
  const separatedClusters = clusterWithHdbscan(clusterData, clusterIndices);

  let distortionSum = 0;
  let weightSum = 0;

  // Compute distortion between all pairs of clusters
  for (let i = 0; i < separatedClusters.length; i++) {
    for (let j = 0; j < i; j++) {
      const { rawDist, embDist } = computeClusterDistance(
        separatedClusters[i],
        separatedClusters[j],
        infos.rawSNNNorm,
        infos.embSNNNorm,
        alpha
      );

      // Compute distance difference
      let distance;
      if (mode === 'steadiness') {
        distance = rawDist - embDist; // Points close in emb but far in raw
      } else {
        distance = embDist - rawDist; // Points close in raw but far in emb
      }

      // Only count positive distortion (actual compression/stretching)
      if (distance <= 0) continue;

      // Normalize distortion
      const range = maxVal - minVal;
      const distortion = range > 0 ? (distance - minVal) / range : 0;
      const weight = separatedClusters[i].length * separatedClusters[j].length;

      distortionSum += distortion * weight;
      weightSum += weight;

      // Accumulate local scores
      for (const idx of separatedClusters[i]) {
        localDistortions[idx] += distortion * weight;
        localWeights[idx] += weight;
      }
      for (const idx of separatedClusters[j]) {
        localDistortions[idx] += distortion * weight;
        localWeights[idx] += weight;
      }
    }
  }

  return { distortionSum, weightSum };
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

  // Calculate Euclidean distance matrices
  const rawDistMatrix = calculateDistanceMatrix(highDim);
  const embDistMatrix = calculateDistanceMatrix(lowDim);

  // Normalize distance matrices
  const { normalized: rawDistNorm } = normalizeDistMatrix(rawDistMatrix);
  const { normalized: embDistNorm } = normalizeDistMatrix(embDistMatrix);

  // Get k-nearest neighbors
  const rawKNN = getKNNIndices(rawDistNorm, k);
  const embKNN = getKNNIndices(embDistNorm, k);

  // Compute SNN matrices
  const rawSNN = computeSNNMatrix(rawKNN, k);
  const embSNN = computeSNNMatrix(embKNN, k);

  // Normalize SNN matrices
  const rawSNNNorm = normalizeSNNMatrix(rawSNN);
  const embSNNNorm = normalizeSNNMatrix(embSNN);

  // Compute SNN distance matrices
  const rawSNNDistMatrix = computeSNNDistanceMatrix(rawSNNNorm, alpha);
  const embSNNDistMatrix = computeSNNDistanceMatrix(embSNNNorm, alpha);

  // Compute distortion bounds for normalization
  const { maxCompress, minCompress, maxStretch, minStretch } =
    computeDistortionBounds(rawSNNDistMatrix, embSNNDistMatrix);

  // Package info for iterations
  const infos = {
    n,
    rawKNN,
    embKNN,
    rawSNNNorm,
    embSNNNorm,
    rawSNNDistMatrix,
    embSNNDistMatrix
  };

  // Calculate walk length
  const walkNum = Math.max(2, Math.floor(n * walkNumRatio));

  // Initialize accumulators
  const steadinessLocalDistortions = Array(n).fill(0);
  const steadinessLocalWeights = Array(n).fill(0);
  const cohesivenessLocalDistortions = Array(n).fill(0);
  const cohesivenessLocalWeights = Array(n).fill(0);

  let steadinessDistortionSum = 0;
  let steadinessWeightSum = 0;
  let cohesivenessDistortionSum = 0;
  let cohesivenessWeightSum = 0;

  // Run iterations
  for (let iter = 0; iter < iteration; iter++) {
    // Steadiness: extract from emb, measure distortion in raw
    const steadResult = measureSingleIteration(
      'steadiness', infos, highDim, lowDim, walkNum, alpha,
      maxCompress, minCompress,
      steadinessLocalDistortions, steadinessLocalWeights
    );
    steadinessDistortionSum += steadResult.distortionSum;
    steadinessWeightSum += steadResult.weightSum;

    // Cohesiveness: extract from raw, measure distortion in emb
    const cohevResult = measureSingleIteration(
      'cohesiveness', infos, highDim, lowDim, walkNum, alpha,
      maxStretch, minStretch,
      cohesivenessLocalDistortions, cohesivenessLocalWeights
    );
    cohesivenessDistortionSum += cohevResult.distortionSum;
    cohesivenessWeightSum += cohevResult.weightSum;
  }

  // Compute final scores
  const steadinessScore = steadinessWeightSum > 0
    ? 1 - (steadinessDistortionSum / steadinessWeightSum)
    : 1;

  const cohesivenessScore = cohesivenessWeightSum > 0
    ? 1 - (cohesivenessDistortionSum / cohesivenessWeightSum)
    : 1;

  // Compute local scores
  const steadinessLocalScores = steadinessLocalDistortions.map((dist, i) => {
    if (steadinessLocalWeights[i] > 0) {
      return Math.max(0, Math.min(1, 1 - (dist / steadinessLocalWeights[i])));
    }
    return 1;
  });

  const cohesivenessLocalScores = cohesivenessLocalDistortions.map((dist, i) => {
    if (cohesivenessLocalWeights[i] > 0) {
      return Math.max(0, Math.min(1, 1 - (dist / cohesivenessLocalWeights[i])));
    }
    return 1;
  });

  return {
    steadiness: {
      score: Math.max(0, Math.min(1, steadinessScore)),
      localScores: steadinessLocalScores,
      k,
      n,
      iteration
    },
    cohesiveness: {
      score: Math.max(0, Math.min(1, cohesivenessScore)),
      localScores: cohesivenessLocalScores,
      k,
      n,
      iteration
    }
  };
}

export default steadinessCohesiveness;
