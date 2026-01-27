/**
 * ZADU.js - Main Interface
 * A JavaScript library for evaluating dimensionality reduction quality
 */

import trustworthiness from './metrics/local/trustworthiness.js';
import continuity from './metrics/local/continuity.js';
import steadinessCohesiveness from './metrics/cluster/steadiness_cohesiveness.js';

/**
 * ZADU Main Class
 */
class ZADU {
  /**
   * Calculate Trustworthiness metric
   */
  static trustworthiness(highDim, lowDim, k = 20) {
    return trustworthiness(highDim, lowDim, k);
  }

  /**
   * Calculate Continuity metric
   */
  static continuity(highDim, lowDim, k = 20) {
    return continuity(highDim, lowDim, k);
  }

  /**
   * Calculate both Trustworthiness and Continuity
   */
  static trustworthinessAndContinuity(highDim, lowDim, k = 20) {
    return {
      trustworthiness: trustworthiness(highDim, lowDim, k),
      continuity: continuity(highDim, lowDim, k)
    };
  }

  /**
   * Calculate Steadiness metric
   * Measures whether clusters in the projection form cohesive groups in original space
   */
  static steadiness(highDim, lowDim, options = {}) {
    return steadinessCohesiveness(highDim, lowDim, options).steadiness;
  }

  /**
   * Calculate Cohesiveness metric
   * Measures whether clusters in original space remain intact in the projection
   */
  static cohesiveness(highDim, lowDim, options = {}) {
    return steadinessCohesiveness(highDim, lowDim, options).cohesiveness;
  }

  /**
   * Calculate both Steadiness and Cohesiveness
   */
  static steadinessCohesiveness(highDim, lowDim, options = {}) {
    return steadinessCohesiveness(highDim, lowDim, options);
  }

  /**
   * Main interface (Python ZADU compatible)
   */
  static measure(spec, highDim, lowDim) {
    const results = [];

    for (const metric of spec) {
      const { id, params = {} } = metric;
      const k = params.k || 20;

      switch (id) {
        case 'tnc':
          results.push(this.trustworthinessAndContinuity(highDim, lowDim, k));
          break;
        case 'trustworthiness':
          results.push(this.trustworthiness(highDim, lowDim, k));
          break;
        case 'continuity':
          results.push(this.continuity(highDim, lowDim, k));
          break;
        case 'snc':
          results.push(this.steadinessCohesiveness(highDim, lowDim, params));
          break;
        case 'steadiness':
          results.push(this.steadiness(highDim, lowDim, params));
          break;
        case 'cohesiveness':
          results.push(this.cohesiveness(highDim, lowDim, params));
          break;
        default:
          throw new Error(`Unknown metric: ${id}`);
      }
    }

    return results;
  }
}

// Default export
export default ZADU;

// Named exports for convenience
export { trustworthiness, continuity, steadinessCohesiveness };
