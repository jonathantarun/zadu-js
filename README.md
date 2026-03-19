# ZADU.js

A JavaScript library for evaluating dimensionality reduction quality. This is a JavaScript port of the Python [ZADU](https://github.com/hj-n/zadu) library.

**Metrics:**
- **Trustworthiness & Continuity** - Point-level neighborhood preservation
- **Steadiness & Cohesiveness** - Cluster-level structure preservation

📖 **[Full Metrics Guide](docs/METRICS_GUIDE.md)** - Detailed explanations, hyperparameter tuning, and interpretation guidance.

## Interactive Demo

**[Try it on Observable](https://observablehq.com/d/52c1da95fde0bdc9)** — a live notebook showing how to import and use `zadu-js` metrics directly from npm in the browser. Computes a UMAP embedding on 200 MNIST samples using DruidJS, then evaluates it with Trustworthiness & Continuity. No installation required.

## Deployed Example
Check out the deployed example: https://jonathantarun.github.io/zadu-js/examples/visualize-tuning-digits.html



## Installation

### Option 1: Install npm package

```bash
npm install zadu-js
```

### Option 2: Install from GitHub

```bash
npm install jonathantarun/zadu-js
```

### Option 3: Clone the Repository

```bash
git clone https://github.com/jonathantarun/zadu-js.git
cd zadu-js
npm install
```

### Option 4: Download and Use Locally

1. Download the repository
2. Copy the `src/` folder to your project
3. Import directly:

```javascript
import ZADU from './src/zadu.js';
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
import { trustworthiness, continuity, steadinessCohesiveness } from 'zadu-js';

const trustScore = trustworthiness(highDimData, lowDimData, 20);
const contScore = continuity(highDimData, lowDimData, 20);
const sncResult = steadinessCohesiveness(highDimData, lowDimData, { k: 15 });
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

### `ZADU.steadinessCohesiveness(highDim, lowDim, options)`

Measures cluster structure preservation between original and projected spaces.

- **Steadiness**: Detects "false groups" - clusters in the projection that don't exist in original space
- **Cohesiveness**: Detects "missing groups" - clusters in original space torn apart by projection

**Parameters:**
- `highDim` (Array): High-dimensional data as array of arrays
- `lowDim` (Array): Low-dimensional embedding as array of arrays
- `options` (Object): Configuration options
  - `k` (Number): Number of nearest neighbors (default: `Math.sqrt(n)`)
  - `iteration` (Number): Number of sampling iterations (default: 150)
  - `walkNumRatio` (Number): Random walk length ratio (default: 0.3)
  - `alpha` (Number): Distance penalty parameter (default: 0.1)

**Returns:**
```javascript
{
  steadiness: { score, localScores, k, n, iteration },
  cohesiveness: { score, localScores, k, n, iteration }
}
```

**Example:**
```javascript
const result = ZADU.steadinessCohesiveness(highDimData, lowDimData, { k: 15 });
console.log('Steadiness:', result.steadiness.score);
console.log('Cohesiveness:', result.cohesiveness.score);
```

### `ZADU.measure(spec, highDim, lowDim)`

Python ZADU-compatible interface for batch metric calculation.

**Parameters:**
- `spec` (Array): Array of metric specifications
```javascript
  [
    { id: 'trustworthiness', params: { k: 20 } },
    { id: 'continuity', params: { k: 15 } },
    { id: 'tnc', params: { k: 20 } },
    { id: 'snc', params: { k: 15, iteration: 100 } },
    { id: 'steadiness', params: { k: 15 } },
    { id: 'cohesiveness', params: { k: 15 } }
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

### Steadiness (S)
- Measures **false groups** in the embedding
- High score = clusters in 2D also existed in original space
- Low score = embedding creates artificial clusters

### Cohesiveness (C)
- Measures **missing groups** in the embedding
- High score = clusters in original space remain intact in 2D
- Low score = embedding splits real clusters apart

### Interpretation
- **Both T&C high (>0.9)**: Excellent local neighborhood preservation
- **Both S&C high (>0.9)**: Excellent cluster structure preservation
- **T&C high, S&C low**: Good local, bad cluster structure
- **T&C low, S&C high**: Good clusters, bad local detail

For detailed guidance, see [docs/METRICS_GUIDE.md](docs/METRICS_GUIDE.md).

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

## Citation

If you use ZADU.js in your research, please cite the original ZADU paper:
```bibtex
@article{hj2023zadu,
  title={ZADU: A Python Library for Evaluating the Reliability of Dimensionality Reduction Embeddings},
  author={Hyeon Jeon and others},
  year={2023}
}
```

## NOTE

This is a JavaScript port of the [Python ZADU library](https://github.com/hj-n/zadu) for dimensionality reduction evaluation.
