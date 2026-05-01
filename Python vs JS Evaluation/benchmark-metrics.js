/**
 * examples/benchmark-metrics.js
 * Benchmark running time for each ZADU metric on MNIST-200
 *
 * Run with: node examples/benchmark-metrics.js
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import ZADU from '../src/zadu.js';
import { distanceConsistency } from '../src/metrics/cluster/distanceConsistency.js';

const require = createRequire(import.meta.url);
const data = JSON.parse(readFileSync(new URL('./mnist-200-embedding.json', import.meta.url)));

const { highDimData, embedding, labels } = data;
const K = 7;
const RUNS = 3;

function benchmarkFn(fn) {
  const times = [];
  let result;
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / RUNS;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { result, avg, min, max };
}

const pad = (str, len) => String(str).padEnd(len);
const fmt = (ms) => `${ms.toFixed(1)}ms`.padStart(9);

console.log(`\nZADU Metric Benchmark — MNIST 200 samples (784D → 2D)`);
console.log(`Dataset: ${highDimData.length} points, k=${K} (T/C), k=~${Math.floor(Math.sqrt(highDimData.length))} (S/Co)`);
console.log(`Runs per metric: ${RUNS}`);
console.log('='.repeat(66));
console.log(pad('Metric', 24) + pad('Score', 8) + pad('Min', 10) + pad('Avg', 10) + pad('Max', 10));
console.log('-'.repeat(66));

const totalStart = performance.now();

// Trustworthiness
let b = benchmarkFn(() => ZADU.trustworthiness(highDimData, embedding, K));
console.log(pad('Trustworthiness', 24) + pad(b.result.score.toFixed(4), 8) + fmt(b.min) + fmt(b.avg) + fmt(b.max));

// Continuity
b = benchmarkFn(() => ZADU.continuity(highDimData, embedding, K));
console.log(pad('Continuity', 24) + pad(b.result.score.toFixed(4), 8) + fmt(b.min) + fmt(b.avg) + fmt(b.max));

// Steadiness & Cohesiveness (always computed together)
b = benchmarkFn(() => ZADU.steadinessCohesiveness(highDimData, embedding));
console.log(pad('Steadiness', 24) + pad(b.result.steadiness.score.toFixed(4), 8) + fmt(b.min) + fmt(b.avg) + fmt(b.max));
console.log(pad('Cohesiveness', 24) + pad(b.result.cohesiveness.score.toFixed(4), 8) + '  (shared with Steadiness run)');

// Distance Consistency
b = benchmarkFn(() => distanceConsistency(embedding, labels));
console.log(pad('Distance Consistency', 24) + pad(b.result.score.toFixed(4), 8) + fmt(b.min) + fmt(b.avg) + fmt(b.max));

const totalMs = performance.now() - totalStart;
console.log('='.repeat(66));
console.log(`Total benchmark time: ${(totalMs / 1000).toFixed(2)}s`);
console.log(`Note: S/Co are computed jointly — their times reflect a single steadinessCohesiveness() call.\n`);
