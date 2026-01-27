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

// ==========================================
// Steadiness & Cohesiveness Tests
// ==========================================

console.log('\n' + '='.repeat(50));
console.log('Steadiness & Cohesiveness Tests');
console.log('='.repeat(50));

// Test 9: S&C Return Structure
console.log('\nTest Set 9: S&C Return Structure');
const sncData = [
  [0,0,0], [1,0,0], [0,1,0], [1,1,0],
  [5,5,5], [6,5,5], [5,6,5], [6,6,5]
];
const sncLow = [
  [0,0], [1,0], [0,1], [1,1],
  [5,5], [6,5], [5,6], [6,6]
];
const sncResult = ZADU.steadinessCohesiveness(sncData, sncLow, { iteration: 30 });

assert('steadiness' in sncResult, 'S&C result has steadiness');
assert('cohesiveness' in sncResult, 'S&C result has cohesiveness');
assert('score' in sncResult.steadiness, 'Steadiness has score');
assert('localScores' in sncResult.steadiness, 'Steadiness has localScores');
assert('k' in sncResult.steadiness, 'Steadiness has k');
assert('n' in sncResult.steadiness, 'Steadiness has n');
assert('iteration' in sncResult.steadiness, 'Steadiness has iteration');
assert('score' in sncResult.cohesiveness, 'Cohesiveness has score');
assert('localScores' in sncResult.cohesiveness, 'Cohesiveness has localScores');

// Test 10: S&C Score Ranges
console.log('\nTest Set 10: S&C Score Ranges');
assert(sncResult.steadiness.score >= 0 && sncResult.steadiness.score <= 1, 'Steadiness score in [0, 1]');
assert(sncResult.cohesiveness.score >= 0 && sncResult.cohesiveness.score <= 1, 'Cohesiveness score in [0, 1]');

// Test 11: S&C Local Scores Length
console.log('\nTest Set 11: S&C Local Scores');
assert(sncResult.steadiness.localScores.length === sncData.length, 'Steadiness local scores length matches n');
assert(sncResult.cohesiveness.localScores.length === sncData.length, 'Cohesiveness local scores length matches n');
sncResult.steadiness.localScores.forEach((score, i) => {
  assert(score >= 0 && score <= 1, `Steadiness local score ${i} in [0, 1]`);
});

// Test 12: Perfect S&C Mapping
console.log('\nTest Set 12: Perfect S&C Mapping');
const perfectSNC = ZADU.steadinessCohesiveness(sncData, sncData, { iteration: 30 });
assert(perfectSNC.steadiness.score > 0.8, 'Perfect mapping has high steadiness');
assert(perfectSNC.cohesiveness.score > 0.8, 'Perfect mapping has high cohesiveness');

// Test 13: Individual S&C Methods
console.log('\nTest Set 13: Individual S&C Methods');
const steadinessOnly = ZADU.steadiness(sncData, sncLow, { iteration: 30 });
const cohesivenessOnly = ZADU.cohesiveness(sncData, sncLow, { iteration: 30 });

assert('score' in steadinessOnly, 'Steadiness method works');
assert('score' in cohesivenessOnly, 'Cohesiveness method works');
assert(steadinessOnly.localScores.length === sncData.length, 'Steadiness method returns correct local scores');
assert(cohesivenessOnly.localScores.length === sncData.length, 'Cohesiveness method returns correct local scores');

// Test 14: S&C Main Interface
console.log('\nTest Set 14: S&C Main Interface');
const sncSpec = [
  { id: 'snc', params: { iteration: 30 } },
  { id: 'steadiness', params: { iteration: 30 } },
  { id: 'cohesiveness', params: { iteration: 30 } }
];
const sncResults = ZADU.measure(sncSpec, sncData, sncLow);

assert(sncResults.length === 3, 'S&C spec returns correct number of results');
assert('steadiness' in sncResults[0], 'SNC result has steadiness');
assert('cohesiveness' in sncResults[0], 'SNC result has cohesiveness');
assert('score' in sncResults[1], 'Steadiness-only result has score');
assert('score' in sncResults[2], 'Cohesiveness-only result has score');

// Test 15: S&C Error Handling
console.log('\nTest Set 15: S&C Error Handling');
try {
  ZADU.steadinessCohesiveness(sncData, sncLow, { k: 100 });
  assert(false, 'S&C should throw error for k >= n');
} catch (e) {
  assert(true, 'S&C throws error for k >= n');
}

try {
  ZADU.steadinessCohesiveness(sncData, sncLow, { k: 0 });
  assert(false, 'S&C should throw error for k < 1');
} catch (e) {
  assert(true, 'S&C throws error for k < 1');
}

try {
  ZADU.steadinessCohesiveness([[1,2]], [[1]], {});
  assert(false, 'S&C should throw error for n < 3');
} catch (e) {
  assert(true, 'S&C throws error for n < 3');
}

try {
  ZADU.steadinessCohesiveness(sncData, sncLow.slice(0, 4), {});
  assert(false, 'S&C should throw error for mismatched lengths');
} catch (e) {
  assert(true, 'S&C throws error for mismatched lengths');
}

// Test 16: S&C Parameters
console.log('\nTest Set 16: S&C Parameters');
const customParams = ZADU.steadinessCohesiveness(sncData, sncLow, {
  k: 3,
  iteration: 50,
  walkNumRatio: 0.5,
  alpha: 0.2
});
assert(customParams.steadiness.k === 3, 'Custom k stored correctly');
assert(customParams.steadiness.iteration === 50, 'Custom iteration stored correctly');
assert(customParams.steadiness.n === sncData.length, 'n stored correctly with custom params');

// Test 17: Default k calculation
console.log('\nTest Set 17: Default k Calculation');
const defaultK = ZADU.steadinessCohesiveness(sncData, sncLow, { iteration: 30 });
const expectedK = Math.floor(Math.sqrt(sncData.length));
assert(defaultK.steadiness.k === expectedK, `Default k is sqrt(n) = ${expectedK}`);

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
