/**
 * src/core/neighbors.js
 * K-nearest neighbor utilities
 */

/**
 * Get k-nearest neighbors for each point
 */
function getKNearestNeighbors(distMatrix, k) {
  const n = distMatrix.length;
  const neighbors = [];
  
  for (let i = 0; i < n; i++) {
    const distances = distMatrix[i]
      .map((dist, idx) => ({ idx, dist }))
      .filter(item => item.idx !== i);
    
    distances.sort((a, b) => a.dist - b.dist);
    neighbors.push(distances.slice(0, k).map(item => item.idx));
  }
  
  return neighbors;
}

/**
 * Get ranking of all points by distance from a given point
 */
function getRankings(distances, selfIdx) {
  const distPairs = distances
    .map((dist, idx) => ({ idx, dist }))
    .filter(item => item.idx !== selfIdx);
  
  distPairs.sort((a, b) => a.dist - b.dist);
  
  const rankings = Array(distances.length).fill(-1);
  distPairs.forEach((item, rank) => {
    rankings[item.idx] = rank;
  });
  
  return rankings;
}

export {
  getKNearestNeighbors,
  getRankings
};