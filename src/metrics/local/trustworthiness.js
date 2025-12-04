/**
 * src/metrics/local/trustworthiness.js
 * Trustworthiness metric
 */

import { calculateDistanceMatrix } from '../../core/distance.js';
import { getKNearestNeighbors, getRankings } from '../../core/neighbors.js';

/**
 * Calculate Trustworthiness metric
 * 
 * Measures whether points that are close in the low-dimensional projection
 * were also close in the high-dimensional space.
 */
function trustworthiness(highDim, lowDim, k = 20) {
  const n = highDim.length;
  
  if (k >= n) {
    throw new Error(`k (${k}) must be less than number of samples (${n})`);
  }
  
  // Calculate distance matrices
  const highDistMatrix = calculateDistanceMatrix(highDim);
  const lowDistMatrix = calculateDistanceMatrix(lowDim);
  
  // Get k-nearest neighbors in low-dimensional space
  const lowNeighbors = getKNearestNeighbors(lowDistMatrix, k);
  
  // Get rankings in high-dimensional space
  const highRankings = highDistMatrix.map((distances, i) => 
    getRankings(distances, i)
  );
  
  let totalError = 0;
  const localErrors = [];
  
  for (let i = 0; i < n; i++) {
    let pointError = 0;
    const lowNeighborSet = new Set(lowNeighbors[i]);
    
    // Find points in low-dim k-neighborhood but not in high-dim k-neighborhood
    for (let j of lowNeighborSet) {
      const rankInHigh = highRankings[i][j];
      
      if (rankInHigh >= k) {
        pointError += rankInHigh - k;
      }
    }
    
    localErrors.push(pointError);
    totalError += pointError;
  }
  
  // Normalization
  const normFactor = (2 / (n * k * (2 * n - 3 * k - 1)));
  const score = 1 - normFactor * totalError;
  
  const localScores = localErrors.map(err => 
    1 - (2 * err / (k * (2 * n - 3 * k - 1)))
  );
  
  return {
    score,
    localScores,
    k,
    n
  };
}

export default trustworthiness;