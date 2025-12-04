/**
 * Simple tests for ZADU.js
 * Run with: node test/test.js
 */

import ZADU from '../src/zadu.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✓ ${testName}`);
    passed++;
  } else {
    console.error(`✗ ${testName}`);
    failed++;
  }
}

function assertClose(actual, expected, tolerance, testName) {
  const diff = Math.abs(actual - expected);
  if (diff < tolerance) {
    console.log(`✓ ${testName}`);
    passed++;
  } else {
    console.error(`✗ ${testName} (${actual} vs ${expected})`);
    failed++;
  }
}

console.log('Running ZADU.js tests...\n');

// Test 1: Perfect mapping
console.log('Test Set 1: Perfect Mapping');
const perfectData = [[0,0], [1,0], [0,1], [1,1]];
const perfectResult = ZADU.trustworthinessAndContinuity(perfectData, perfectData, 2);

assertClose(perfectResult.trustworthiness.score, 1.0, 0.0001, 'Perfect trustworthiness');
assertClose(perfectResult.continuity.score, 1.0, 0.0001, 'Perfect continuity');

// Test 2: Return structure
console.log('\nTest Set 2: Return Structure');
assert('score' in perfectResult.trustworthiness, 'Trustworthiness has score');
assert('localScores' in perfectResult.trustworthiness, 'Trustworthiness has localScores');
assert('k' in perfectResult.trustworthiness, 'Trustworthiness has k');
assert('n' in perfectResult.trustworthiness, 'Trustworthiness has n');
assert(perfectResult.trustworthiness.localScores.length === 4, 'Local scores length matches data');

// Test 3: Scores in valid range
console.log('\nTest Set 3: Valid Score Ranges');
const testHigh = [[1,2,3], [2,3,4], [1.5,2.5,3.5], [10,11,12], [11,12,13]];
const testLow = [[0.5,1], [1,1.5], [0.75,1.25], [5,6], [5.5,6.5]];
const testResult = ZADU.trustworthinessAndContinuity(testHigh, testLow, 2);

assert(testResult.trustworthiness.score >= 0.5 && testResult.trustworthiness.score <= 1.0, 'Trust score in [0.5, 1.0]');
assert(testResult.continuity.score >= 0.5 && testResult.continuity.score <= 1.0, 'Continuity score in [0.5, 1.0]');

// Test 4: Individual metrics
console.log('\nTest Set 4: Individual Metrics');
const trust = ZADU.trustworthiness(testHigh, testLow, 2);
const cont = ZADU.continuity(testHigh, testLow, 2);

assert('score' in trust, 'Trustworthiness method works');
assert('score' in cont, 'Continuity method works');
assertClose(trust.score, testResult.trustworthiness.score, 0.0001, 'Individual T matches combined');
assertClose(cont.score, testResult.continuity.score, 0.0001, 'Individual C matches combined');

// Test 5: Main interface
console.log('\nTest Set 5: Main Interface');
const spec = [
  { id: 'trustworthiness', params: { k: 2 } },
  { id: 'continuity', params: { k: 2 } },
  { id: 'tnc', params: { k: 2 } }
];
const results = ZADU.measure(spec, testHigh, testLow);

assert(results.length === 3, 'Returns correct number of results');
assert('score' in results[0], 'First result has score');
assert('trustworthiness' in results[2], 'TNC result has trustworthiness');
assert('continuity' in results[2], 'TNC result has continuity');

// Test 6: Error handling
console.log('\nTest Set 6: Error Handling');
try {
  ZADU.trustworthiness(testHigh, testLow, 100);
  assert(false, 'Should throw error for k >= n');
} catch (e) {
  assert(true, 'Throws error for k >= n');
}

// Test 7: Different k values
console.log('\nTest Set 7: Different k Values');
const k2 = ZADU.trustworthiness(testHigh, testLow, 2);
const k3 = ZADU.trustworthiness(testHigh, testLow, 3);

assert(k2.k === 2, 'Stores k=2 correctly');
assert(k3.k === 3, 'Stores k=3 correctly');
assert(k2.n === testHigh.length, 'Stores n correctly');

// Test 8: Local scores
console.log('\nTest Set 8: Local Scores');
perfectResult.trustworthiness.localScores.forEach((score, i) => {
  assert(score >= 0.5 && score <= 1.0, `Local score ${i} in valid range`);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n✓ All tests passed!');
  process.exit(0);
} else {
  console.error('\n✗ Some tests failed');
  process.exit(1);
}