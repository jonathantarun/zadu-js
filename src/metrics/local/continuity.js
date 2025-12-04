/**
 * src/metrics/local/continuity.js
 * Continuity metric
 */

import { calculateDistanceMatrix } from '../../core/distance.js';
import { getKNearestNeighbors, getRankings } from '../../core/neighbors.js';

/**
 * Calculate Continuity metric
 * 
 * Measures whether points that were close in the high-dimensional space
 * remain close in the low-dimensional projection.
 */
function continuity(highDim, lowDim, k = 20) {
  const n = highDim.length;
  
  if (k >= n) {
    throw new Error(`k (${k}) must be less than number of samples (${n})`);
  }
  
  // Calculate distance matrices
  const highDistMatrix = calculateDistanceMatrix(highDim);
  const lowDistMatrix = calculateDistanceMatrix(lowDim);
  
  // Get k-nearest neighbors in high-dimensional space
  const highNeighbors = getKNearestNeighbors(highDistMatrix, k);
  
  // Get rankings in low-dimensional space
  const lowRankings = lowDistMatrix.map((distances, i) => 
    getRankings(distances, i)
  );
  
  let totalError = 0;
  const localErrors = [];
  
  for (let i = 0; i < n; i++) {
    let pointError = 0;
    const highNeighborSet = new Set(highNeighbors[i]);
    
    // Find points in high-dim k-neighborhood but not in low-dim k-neighborhood
    for (let j of highNeighborSet) {
      const rankInLow = lowRankings[i][j];
      
      if (rankInLow >= k) {
        pointError += rankInLow - k;
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

export default continuity;