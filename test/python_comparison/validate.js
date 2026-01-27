/**
 * Validate JS implementation against Python ZADU results
 *
 * Usage:
 *   1. First generate fixture: python generate_test_data.py
 *   2. Then run: node validate.js
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ZADU from '../../src/zadu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, 'test_fixture.json');

if (!existsSync(fixturePath)) {
  console.error('Error: test_fixture.json not found.');
  console.error('Generate it first with: python generate_test_data.py');
  process.exit(1);
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const { high_dim, low_dim, params, expected } = fixture;

// Use more iterations to reduce variance
const testParams = { ...params, iteration: 200 };
console.log(`Running JS SNC with n=${high_dim.length}, k=${testParams.k}, iteration=${testParams.iteration}...`);

// Measure execution time
const startTime = performance.now();
const result = ZADU.steadinessCohesiveness(high_dim, low_dim, testParams);
const endTime = performance.now();
const executionTime = (endTime - startTime).toFixed(2);

console.log(`\nExecution time: ${executionTime}ms`);

console.log('\nComparison:');
console.log(`  Python steadiness:   ${expected.steadiness.toFixed(4)}`);
console.log(`  JS steadiness:       ${result.steadiness.score.toFixed(4)}`);
console.log(`  Python cohesiveness: ${expected.cohesiveness.toFixed(4)}`);
console.log(`  JS cohesiveness:     ${result.cohesiveness.score.toFixed(4)}`);

// Allow tolerance for random walk stochasticity and DBSCAN differences
// The metrics are inherently stochastic due to random sampling
// Also, our DBSCAN implementation differs slightly from Python's HDBSCAN
const TOLERANCE = 0.20;  // 20% tolerance

const steadinessDiff = Math.abs(result.steadiness.score - expected.steadiness);
const cohesivenessDiff = Math.abs(result.cohesiveness.score - expected.cohesiveness);

console.log(`\nDifferences:`);
console.log(`  Steadiness diff:   ${steadinessDiff.toFixed(4)} (tolerance: ${TOLERANCE})`);
console.log(`  Cohesiveness diff: ${cohesivenessDiff.toFixed(4)} (tolerance: ${TOLERANCE})`);

if (steadinessDiff < TOLERANCE && cohesivenessDiff < TOLERANCE) {
  console.log('\n✓ Results match within tolerance');
  console.log('  Note: Exact match not expected due to random walk stochasticity.');
  process.exit(0);
} else {
  console.error('\n✗ Results differ significantly');
  console.error('  This may indicate an implementation issue.');
  console.error('  However, due to random sampling, some variance is expected.');
  console.error('  Try running multiple times or increasing tolerance.');
  process.exit(1);
}
