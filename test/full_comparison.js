/**
 * Full comparison: Python vs JS (DBSCAN) vs JS (hdbscan-ts)
 * Tests on both synthetic and MNIST datasets
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { HDBSCAN } from 'hdbscan-ts';
import ZADU from '../src/zadu.js';
import { calculateDistanceMatrix } from '../src/core/distance.js';
import { getKNNIndices, computeSNNMatrix, normalizeSNNMatrix, computeSNNDistanceMatrix } from '../src/core/snn.js';
import { extractCluster } from '../src/core/randomWalk.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load fixtures
const syntheticFixture = JSON.parse(readFileSync(join(__dirname, 'python_comparison/test_fixture.json'), 'utf8'));
const mnistPath = join(__dirname, 'python_comparison/mnist_fixture.json');
const mnistFixture = existsSync(mnistPath) ? JSON.parse(readFileSync(mnistPath, 'utf8')) : null;

console.log('='.repeat(70));
console.log('ZADU.js Full Comparison: Python vs JS (DBSCAN) vs JS (hdbscan-ts)');
console.log('='.repeat(70));

// Helper to run SNC with hdbscan-ts
function runSNCWithHdbscan(highDim, lowDim, params) {
  const n = highDim.length;
  const k = params.k || Math.floor(Math.sqrt(n));
  const alpha = params.alpha || 0.1;
  const iteration = params.iteration || 200;
  const walkNumRatio = params.walkNumRatio || 0.3;
  const walkNum = Math.max(2, Math.floor(n * walkNumRatio));

  const normalize = (m) => {
    let max = 0;
    m.forEach(row => row.forEach(v => { if (v > max) max = v; }));
    if (max === 0) max = 1;
    return m.map(row => row.map(v => v / max));
  };

  const rawDist = normalize(calculateDistanceMatrix(highDim));
  const embDist = normalize(calculateDistanceMatrix(lowDim));
  const rawKNN = getKNNIndices(rawDist, k);
  const embKNN = getKNNIndices(embDist, k);
  const rawSNN = normalizeSNNMatrix(computeSNNMatrix(rawKNN, k));
  const embSNN = normalizeSNNMatrix(computeSNNMatrix(embKNN, k));
  const rawSNNDist = computeSNNDistanceMatrix(rawSNN, alpha);
  const embSNNDist = computeSNNDistanceMatrix(embSNN, alpha);

  let dissimMax = -Infinity, dissimMin = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = rawSNNDist[i][j] - embSNNDist[i][j];
      if (d > dissimMax) dissimMax = d;
      if (d < dissimMin) dissimMin = d;
    }
  }
  const maxCompress = dissimMax > 0 ? dissimMax : 0;
  const minCompress = dissimMin > 0 ? dissimMin : 0;
  const maxStretch = dissimMin < 0 ? -dissimMin : 0;
  const minStretch = dissimMax < 0 ? -dissimMax : 0;

  const clusterHdbscan = (data, indices) => {
    if (indices.length < 3) return [indices];
    const points = indices.map(i => data[i]);
    const hdb = new HDBSCAN({ minClusterSize: 2, minSamples: 2 });
    hdb.fit(points);
    const clusters = new Map();
    hdb.labels_.forEach((l, i) => {
      const key = l === -1 ? `n${i}` : l;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(indices[i]);
    });
    return [...clusters.values()];
  };

  const clusterDist = (a, b) => {
    const pn = a.length * b.length;
    let rs = 0, es = 0;
    for (const i of a) for (const j of b) { rs += rawSNN[i][j]; es += embSNN[i][j]; }
    return { rawDist: 1/(rs/pn+alpha), embDist: 1/(es/pn+alpha) };
  };

  let sds = 0, sws = 0, cds = 0, cws = 0;
  for (let iter = 0; iter < iteration; iter++) {
    // Steadiness
    const si = extractCluster(embKNN, embSNN, Math.floor(Math.random()*n), walkNum);
    if (si.length >= 2) {
      const sc = clusterHdbscan(highDim, si);
      for (let i = 0; i < sc.length; i++) {
        for (let j = 0; j < i; j++) {
          const { rawDist: rd, embDist: ed } = clusterDist(sc[i], sc[j]);
          const d = rd - ed;
          if (d > 0) {
            const r = maxCompress - minCompress;
            const dist = r > 0 ? (d - minCompress) / r : 0;
            const w = sc[i].length * sc[j].length;
            sds += dist * w; sws += w;
          }
        }
      }
    }
    // Cohesiveness
    const ci = extractCluster(rawKNN, rawSNN, Math.floor(Math.random()*n), walkNum);
    if (ci.length >= 2) {
      const cc = clusterHdbscan(lowDim, ci);
      for (let i = 0; i < cc.length; i++) {
        for (let j = 0; j < i; j++) {
          const { rawDist: rd, embDist: ed } = clusterDist(cc[i], cc[j]);
          const d = ed - rd;
          if (d > 0) {
            const r = maxStretch - minStretch;
            const dist = r > 0 ? (d - minStretch) / r : 0;
            const w = cc[i].length * cc[j].length;
            cds += dist * w; cws += w;
          }
        }
      }
    }
  }
  return {
    steadiness: sws > 0 ? 1 - sds/sws : 1,
    cohesiveness: cws > 0 ? 1 - cds/cws : 1
  };
}

// Run comparison for a dataset
function runComparison(name, fixture, runs = 3) {
  const { high_dim, low_dim, params, expected } = fixture;

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Dataset: ${name}`);
  console.log(`  Points: ${high_dim.length}, High-dim: ${high_dim[0].length}D, Low-dim: ${low_dim[0].length}D`);
  console.log(`  Params: k=${params.k}, iter=${params.iteration}`);
  console.log(`${'─'.repeat(70)}`);

  // Python results
  console.log(`\nPython ZADU (reference):`);
  console.log(`  Steadiness:   ${expected.steadiness.toFixed(4)}`);
  console.log(`  Cohesiveness: ${expected.cohesiveness.toFixed(4)}`);
  console.log(`  Time:         ${expected.time_ms?.toFixed(0) || '?'}ms`);

  // JS with our DBSCAN
  console.log(`\nJS (our DBSCAN):`);
  const dbscanResults = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const r = ZADU.steadinessCohesiveness(high_dim, low_dim, params);
    dbscanResults.push({ s: r.steadiness.score, c: r.cohesiveness.score, t: performance.now() - start });
  }
  const dbscanAvg = {
    s: dbscanResults.reduce((a,r) => a+r.s, 0) / runs,
    c: dbscanResults.reduce((a,r) => a+r.c, 0) / runs,
    t: dbscanResults.reduce((a,r) => a+r.t, 0) / runs
  };
  console.log(`  Steadiness:   ${dbscanAvg.s.toFixed(4)} (diff: ${Math.abs(dbscanAvg.s - expected.steadiness).toFixed(4)})`);
  console.log(`  Cohesiveness: ${dbscanAvg.c.toFixed(4)} (diff: ${Math.abs(dbscanAvg.c - expected.cohesiveness).toFixed(4)})`);
  console.log(`  Time:         ${dbscanAvg.t.toFixed(0)}ms`);

  // JS with hdbscan-ts
  console.log(`\nJS (hdbscan-ts):`);
  const hdbResults = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const r = runSNCWithHdbscan(high_dim, low_dim, params);
    hdbResults.push({ s: r.steadiness, c: r.cohesiveness, t: performance.now() - start });
  }
  const hdbAvg = {
    s: hdbResults.reduce((a,r) => a+r.s, 0) / runs,
    c: hdbResults.reduce((a,r) => a+r.c, 0) / runs,
    t: hdbResults.reduce((a,r) => a+r.t, 0) / runs
  };
  console.log(`  Steadiness:   ${hdbAvg.s.toFixed(4)} (diff: ${Math.abs(hdbAvg.s - expected.steadiness).toFixed(4)})`);
  console.log(`  Cohesiveness: ${hdbAvg.c.toFixed(4)} (diff: ${Math.abs(hdbAvg.c - expected.cohesiveness).toFixed(4)})`);
  console.log(`  Time:         ${hdbAvg.t.toFixed(0)}ms`);

  return {
    python: expected,
    dbscan: dbscanAvg,
    hdbscan: hdbAvg
  };
}

// Run comparisons
const syntheticResults = runComparison('Synthetic (50 pts, 10D→2D, 2 clusters)', syntheticFixture);

let mnistResults = null;
if (mnistFixture) {
  mnistResults = runComparison('MNIST (200 pts, 784D→2D, 10 digits)', mnistFixture);
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`
                      Synthetic (n=50)           MNIST (n=200)
                    Stead.  Cohes.  Time      Stead.  Cohes.  Time
Python ZADU         ${syntheticResults.python.steadiness.toFixed(2)}    ${syntheticResults.python.cohesiveness.toFixed(2)}    ${syntheticResults.python.time_ms?.toFixed(0) || '?'}ms     ${mnistResults ? mnistResults.python.steadiness.toFixed(2) : '-'}    ${mnistResults ? mnistResults.python.cohesiveness.toFixed(2) : '-'}    ${mnistResults?.python.time_ms?.toFixed(0) || '-'}ms
JS (DBSCAN)         ${syntheticResults.dbscan.s.toFixed(2)}    ${syntheticResults.dbscan.c.toFixed(2)}    ${syntheticResults.dbscan.t.toFixed(0)}ms       ${mnistResults ? mnistResults.dbscan.s.toFixed(2) : '-'}    ${mnistResults ? mnistResults.dbscan.c.toFixed(2) : '-'}    ${mnistResults?.dbscan.t.toFixed(0) || '-'}ms
JS (hdbscan-ts)     ${syntheticResults.hdbscan.s.toFixed(2)}    ${syntheticResults.hdbscan.c.toFixed(2)}    ${syntheticResults.hdbscan.t.toFixed(0)}ms       ${mnistResults ? mnistResults.hdbscan.s.toFixed(2) : '-'}    ${mnistResults ? mnistResults.hdbscan.c.toFixed(2) : '-'}    ${mnistResults?.hdbscan.t.toFixed(0) || '-'}ms

Accuracy (diff from Python):
  DBSCAN:           S: ${Math.abs(syntheticResults.dbscan.s - syntheticResults.python.steadiness).toFixed(3)}  C: ${Math.abs(syntheticResults.dbscan.c - syntheticResults.python.cohesiveness).toFixed(3)}         ${mnistResults ? `S: ${Math.abs(mnistResults.dbscan.s - mnistResults.python.steadiness).toFixed(3)}  C: ${Math.abs(mnistResults.dbscan.c - mnistResults.python.cohesiveness).toFixed(3)}` : ''}
  hdbscan-ts:       S: ${Math.abs(syntheticResults.hdbscan.s - syntheticResults.python.steadiness).toFixed(3)}  C: ${Math.abs(syntheticResults.hdbscan.c - syntheticResults.python.cohesiveness).toFixed(3)}         ${mnistResults ? `S: ${Math.abs(mnistResults.hdbscan.s - mnistResults.python.steadiness).toFixed(3)}  C: ${Math.abs(mnistResults.hdbscan.c - mnistResults.python.cohesiveness).toFixed(3)}` : ''}

Speed vs Python:
  DBSCAN:           ${(syntheticResults.python.time_ms / syntheticResults.dbscan.t).toFixed(0)}x faster         ${mnistResults ? `${(mnistResults.python.time_ms / mnistResults.dbscan.t).toFixed(0)}x faster` : ''}
  hdbscan-ts:       ${(syntheticResults.python.time_ms / syntheticResults.hdbscan.t).toFixed(0)}x faster         ${mnistResults ? `${(mnistResults.python.time_ms / mnistResults.hdbscan.t).toFixed(0)}x faster` : ''}
`);
