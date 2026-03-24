import { AGE_THRESHOLDS } from './constants.js';
import { daysSince } from '../utils/format.js';

/**
 * @typedef {'safe' | 'review' | 'dangerous'} Recommendation
 */

/**
 * Analyze a scan result and generate a recommendation.
 *
 * @param {object} item - Scan result from scanner
 * @param {object} options
 * @param {number} options.safeDays - Days of inactivity before marking safe (default 30)
 * @param {object|null} options.monorepo - Monorepo info if detected
 * @returns {{ recommendation: Recommendation, reason: string, priority: number }}
 */
export function analyze(item, options = {}) {
  const { safeDays = AGE_THRESHOLDS.SAFE_DAYS, monorepo = null, force = false } = options;
  const age = daysSince(item.lastModified);

  // Protect shared monorepo root dependencies (unless --force)
  if (
    !force &&
    monorepo?.isMonorepo &&
    monorepo.root &&
    item.path === `${monorepo.root}/node_modules`
  ) {
    return {
      recommendation: 'dangerous',
      reason: 'Shared monorepo dependencies',
      priority: -1,
    };
  }

  // Protect current project's own node_modules (unless --force)
  // Only protect if package.json exists directly in cwd (i.e. you're developing this project)
  if (!force && item.typeName === 'node_modules' && item.projectRoot) {
    try {
      const cwd = process.cwd();
      if (item.path === `${cwd}/node_modules`) {
        return {
          recommendation: 'dangerous',
          reason: 'Current project dependencies',
          priority: -1,
        };
      }
    } catch {}
  }

  // Safe: old + large = high priority for cleanup
  if (age >= safeDays) {
    return {
      recommendation: 'safe',
      reason: `Not used for ${age} days`,
      priority: calculatePriority(item.size, age),
    };
  }

  // Review: recently used
  if (age >= AGE_THRESHOLDS.REVIEW_DAYS) {
    return {
      recommendation: 'review',
      reason: `Used ${age} days ago`,
      priority: calculatePriority(item.size, age) * 0.5,
    };
  }

  // Very recent
  return {
    recommendation: 'review',
    reason: 'Used recently',
    priority: calculatePriority(item.size, age) * 0.2,
  };
}

/**
 * Calculate cleanup priority (higher = more beneficial to delete).
 * Factors: size, age, folder type.
 *
 * @param {number} size - Size in bytes
 * @param {number} age - Age in days
 * @returns {number}
 */
function calculatePriority(size, age) {
  // Size in GB * age factor
  const sizeGB = size / (1024 * 1024 * 1024);
  const ageFactor = Math.min(age / 30, 3); // Cap at 3x
  return sizeGB * ageFactor;
}

/**
 * Sort scan results by priority (highest first).
 *
 * @param {object[]} items - Scan results with analysis
 * @param {string} sortBy - Sort field: 'size', 'age', 'priority', 'type'
 * @returns {object[]}
 */
export function sortByPriority(items, sortBy = 'size') {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'size':
        return b.size - a.size;
      case 'age':
        return b.lastModified - a.lastModified;
      case 'priority':
        return b.analysis.priority - a.analysis.priority;
      case 'type':
        return a.typeName.localeCompare(b.typeName);
      default:
        return b.size - a.size;
    }
  });
}

/**
 * Enrich scan results with analysis.
 *
 * @param {object[]} scanResults
 * @param {object} options
 * @returns {object[]}
 */
export function enrichResults(scanResults, options = {}) {
  return scanResults.map((item) => ({
    ...item,
    analysis: analyze(item, options),
  }));
}
