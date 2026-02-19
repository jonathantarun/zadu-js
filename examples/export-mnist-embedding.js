/**
 * Export MNIST Embedding Data for Visualization
 *
 * Generates a UMAP embedding of 200 MNIST samples (20 per digit)
 * using DruidJS, computes real ZADU quality metrics, and exports
 * to both JSON and JS for use in the interactive visualization.
 *
 * Run with: node examples/export-mnist-embedding.js
 */

import mnist from 'mnist';
import * as druid from '@saehrimnir/druidjs';
import ZADU from '../src/zadu.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Exporting MNIST Embedding Data for Visualization');
console.log('='.repeat(70));

// 1. Load 200 MNIST samples (20 per digit)
console.log('\nLoading MNIST data...');
const set = mnist.set(200, 0);
const mnistData = set.training.map(item => item.input);   // 200 x 784
const mnistLabels = set.training.map(item => item.output.indexOf(1)); // 0-9

console.log(`Loaded ${mnistData.length} samples (${mnistData[0].length}D)`);

// Verify balanced distribution
const classCounts = {};
for (const label of mnistLabels) {
  classCounts[label] = (classCounts[label] || 0) + 1;
}
console.log('Class distribution:');
for (let i = 0; i < 10; i++) {
  console.log(`  Digit ${i}: ${classCounts[i] || 0} samples`);
}

// 2. Generate UMAP embedding using DruidJS
console.log('\nGenerating UMAP embedding with DruidJS...');
const X = druid.Matrix.from(mnistData);
const umap = new druid.UMAP(X, {
  n_neighbors: 15,
  min_dist: 0.1,
  d: 2,
  _n_epochs: 350,
  seed: 42
});
const embeddingMatrix = umap.transform();
console.log('UMAP embedding complete.');

// 3. Convert DruidJS Matrix to 2D array
const N = embeddingMatrix.shape[0];
const D = embeddingMatrix.shape[1];
const embeddingArray = [];
for (let i = 0; i < N; i++) {
  const row = [];
  for (let j = 0; j < D; j++) {
    row.push(embeddingMatrix.entry(i, j));
  }
  embeddingArray.push(row);
}
console.log(`Embedding: ${embeddingArray.length} points x ${embeddingArray[0].length}D`);

// 4. Compute real ZADU metrics (all 4 with per-point localScores)
const k = 7;

console.log('\nComputing ZADU metrics (k=%d)...', k);

console.log('  Trustworthiness...');
const tResult = ZADU.trustworthiness(mnistData, embeddingArray, k);
console.log(`    Global score: ${tResult.score.toFixed(4)}`);

console.log('  Continuity...');
const cResult = ZADU.continuity(mnistData, embeddingArray, k);
console.log(`    Global score: ${cResult.score.toFixed(4)}`);

console.log('  Steadiness & Cohesiveness...');
const scResult = ZADU.steadinessCohesiveness(mnistData, embeddingArray, { k });
console.log(`    Steadiness: ${scResult.steadiness.score.toFixed(4)}`);
console.log(`    Cohesiveness: ${scResult.cohesiveness.score.toFixed(4)}`);

// 5. Build export data
const exportData = {
  metadata: {
    dataset: 'MNIST',
    samples: mnistData.length,
    dimensions: 784,
    classes: 10,
    embedding_method: 'UMAP (DruidJS)',
    parameters: {
      n_neighbors: 15,
      min_dist: 0.1,
      d: 2,
      _n_epochs: 350,
      seed: 42
    },
    metric_k: k,
    generated: new Date().toISOString()
  },
  embedding: embeddingArray,
  labels: mnistLabels,
  highDimData: mnistData,
  metrics: {
    trustworthiness: { global: tResult.score, local: tResult.localScores },
    continuity: { global: cResult.score, local: cResult.localScores },
    steadiness: { global: scResult.steadiness.score, local: scResult.steadiness.localScores },
    cohesiveness: { global: scResult.cohesiveness.score, local: scResult.cohesiveness.localScores }
  }
};

// 6. Export as JSON
const jsonPath = join(__dirname, 'mnist-200-embedding.json');
writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
console.log(`\nExported JSON: ${jsonPath}`);

// 7. Export as JS (for file:// protocol compatibility in HTML)
const jsPath = join(__dirname, 'mnist-200-data.js');
writeFileSync(jsPath, `const MNIST_DATA = ${JSON.stringify(exportData)};`);
console.log(`Exported JS:   ${jsPath}`);

console.log('\n' + '='.repeat(70));
console.log('Done! Open visualize-quality.html in a browser to view.');
console.log('='.repeat(70));
