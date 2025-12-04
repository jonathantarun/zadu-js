# zadu-js
A re-implementation of the ZADU library from python in JavaScript for computing distortion measures to evaluate the reliability of dimensionality reduction visualizations

# ZADU.js

A JavaScript library for evaluating dimensionality reduction quality using **Trustworthiness** and **Continuity** metrics.

## Installation
```bash
npm install zadu-js
```

## Quick Start
```javascript
import ZADU from 'zadu-js';

// Your high-dimensional data (e.g., 100 points in 50 dimensions)
const highDimData = [...]; // Array of arrays: [[x1,y1,z1,...], [x2,y2,z2,...], ...]

// Your low-dimensional embedding (e.g., same 100 points in 2 dimensions)
const lowDimData = [...];  // Array of arrays: [[x1,y1], [x2,y2], ...]

// Calculate both metrics
const result = ZADU.trustworthinessAndContinuity(highDimData, lowDimData, 20);

console.log('Trustworthiness:', result.trustworthiness.score);
console.log('Continuity:', result.continuity.score);
```

## Usage

### Calculate Both Metrics
```javascript
import ZADU from 'zadu-js';

const result = ZADU.trustworthinessAndContinuity(highDimData, lowDimData, k);

console.log(result.trustworthiness.score);  // Overall trustworthiness score
console.log(result.continuity.score);       // Overall continuity score
console.log(result.trustworthiness.localScores); // Per-point scores
```

### Calculate Individual Metrics
```javascript
import ZADU from 'zadu-js';

// Only trustworthiness
const trust = ZADU.trustworthiness(highDimData, lowDimData, 20);
console.log('Trustworthiness:', trust.score);

// Only continuity
const cont = ZADU.continuity(highDimData, lowDimData, 20);
console.log('Continuity:', cont.score);
```

### Import Specific Functions
```javascript
import { trustworthiness, continuity } from 'zadu-js';

const trustScore = trustworthiness(highDimData, lowDimData, 20);
const contScore = continuity(highDimData, lowDimData, 20);
```

### `ZADU.trustworthiness(highDim, lowDim, k)`

Measures whether points close in the low-dimensional projection were also close in the high-dimensional space.

**Parameters:**
- `highDim` (Array): High-dimensional data as array of arrays
- `lowDim` (Array): Low-dimensional embedding as array of arrays
- `k` (Number): Number of nearest neighbors to consider (default: 20)

**Returns:**
```javascript
{
  score: 0.95,              // Overall trustworthiness score [0, 1]
  localScores: [...],       // Per-point trustworthiness scores (has the same order as your input data)
  k: 20,                    // Number of neighbors used (to check for false neighbors)
  n: 1000                   // Number of data points
}
```

### `ZADU.continuity(highDim, lowDim, k)`

Measures whether points close in the high-dimensional space remain close in the low-dimensional projection.

**Parameters:** Same as `trustworthiness`

- `highDim` (Array): High-dimensional data as array of arrays
- `lowDim` (Array): Low-dimensional embedding as array of arrays
- `k` (Number): Number of nearest neighbors to consider (default: 20)

**Returns:** Same structure as `trustworthiness`

```javascript
{
  score: 0.95,              // Overall trustworthiness score [0, 1]
  localScores: [...],       // Per-point trustworthiness scores (has the same order as your input data)
  k: 20,                    // Number of neighbors used (to check for false neighbors)
  n: 1000                   // Number of data points
}
```

### `ZADU.trustworthinessAndContinuity(highDim, lowDim, k)`

Calculates both metrics simultaneously.

**Returns:**
```javascript
{
  trustworthiness: { score, localScores, k, n },
  continuity: { score, localScores, k, n }
}
```

### `ZADU.measure(spec, highDim, lowDim)`

Python ZADU-compatible interface for batch metric calculation.

**Parameters:**
- `spec` (Array): Array of metric specifications
```javascript
  [
    { id: 'trustworthiness', params: { k: 20 } },
    { id: 'continuity', params: { k: 15 } },
    { id: 'tnc', params: { k: 20 } }
  ]
```
- `highDim` (Array): High-dimensional data
- `lowDim` (Array): Low-dimensional embedding

**Returns:** Array of results matching the specification order

## Understanding the Metrics

### Trustworthiness (T)
- Measures **false neighbors** in the embedding
- High score = points close in 2D were also close in original space
- Low score = embedding brings together points that were far apart

### Continuity (C)
- Measures **missing neighbors** in the embedding  
- High score = points close in original space stayed close in 2D
- Low score = embedding separates points that were close together

### Interpretation
- **Both high (>0.9)**: Excellent embedding quality
- **T high, C low**: Embedding preserves local structure but tears apart some clusters
- **T low, C high**: Embedding creates false clusters but preserves distances
- **Both low (<0.8)**: Poor embedding quality

### Choosing k
- **k = 10-20**: Good default for most datasets
- **Smaller k**: More sensitive to very local structure
- **Larger k**: Captures more global structure
- Rule of thumb: k should be much smaller than n (number of points)

## Browser Usage
```html
<script type="module">
  import ZADU from './node_modules/zadu-js/src/zadu.js';
  
  const result = ZADU.trustworthiness(highDim, lowDim, 20);
  console.log(result);
</script>
```

## Running Tests
```bash
npm test
```

## License

MIT

## Author

Jonathan Tarun Rajasekaran

## NOTE

This is a JavaScript port of the Python [ZADU library](https://github.com/hj-n/zadu) for dimensionality reduction evaluation.
