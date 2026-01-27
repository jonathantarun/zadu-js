# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Build a library/tool that helps experts choose the best dimensionality reduction algorithm and hyperparameters. The library should:
1. Provide metrics to evaluate DR quality (trustworthiness, continuity, steadiness, cohesiveness, etc.)
2. Work with various DR algorithms (potentially via druid.js which implements UMAP, t-SNE, PCA, etc.)
3. Enable comparison and optimization of DR results

## Project Overview

ZADU.js is a JavaScript library for evaluating dimensionality reduction quality using Trustworthiness and Continuity metrics. It is a JavaScript port of the Python [ZADU](https://github.com/hj-n/zadu) library.

## Commands

```bash
npm test          # Run tests
npm run demo      # Run demo example
```

## Architecture

```
src/
├── zadu.js                         # Main entry point and ZADU class with static API
├── core/
│   ├── distance.js                 # Euclidean distance and pairwise distance matrix
│   └── neighbors.js                # K-nearest neighbors and ranking utilities
└── metrics/local/
    ├── trustworthiness.js          # Trustworthiness metric (false neighbors in embedding)
    └── continuity.js               # Continuity metric (missing neighbors in embedding)
```

### Core Concepts

- **Trustworthiness**: Measures false neighbors - whether points close in low-dimensional space were also close in high-dimensional space
- **Continuity**: Measures missing neighbors - whether points close in high-dimensional space remain close in low-dimensional space

Both metrics use the same algorithm structure:
1. Compute pairwise distance matrices for both spaces
2. Find k-nearest neighbors in one space
3. Compute rankings in the other space
4. Calculate penalty for neighbors that exceed rank k
5. Normalize to [0, 1] range

### Module System

Uses ES modules (`"type": "module"` in package.json). All imports require `.js` extensions.
