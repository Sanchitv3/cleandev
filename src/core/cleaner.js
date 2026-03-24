import { rm } from 'node:fs/promises';
import { PROTECTED_PATTERNS } from './constants.js';

/**
 * Delete a folder safely.
 *
 * @param {string} folderPath - Absolute path to delete
 * @returns {Promise<{success: boolean, freed: number, error: string|null}>}
 */
export async function cleanFolder(folderPath) {
  try {
    if (isProtected(folderPath)) {
      return {
        success: false,
        freed: 0,
        error: 'Path is protected and cannot be deleted',
      };
    }

    // Use recursive removal with force
    await rm(folderPath, { recursive: true, force: true });
    return { success: true, freed: 0, error: null };
  } catch (err) {
    return {
      success: false,
      freed: 0,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Clean multiple folders in sequence.
 *
 * @param {object[]} items - Items with path and size
 * @param {object} options
 * @param {boolean} options.dryRun - If true, don't actually delete
 * @param {function} options.onProgress - Progress callback
 * @returns {Promise<{totalFreed: number, results: object[]}>}
 */
export async function cleanAll(items, options = {}) {
  const { dryRun = false, onProgress } = options;
  let totalFreed = 0;
  const results = [];

  for (const item of items) {
    if (dryRun) {
      results.push({
        path: item.path,
        freed: item.size,
        success: true,
        dryRun: true,
      });
      totalFreed += item.size;
      if (onProgress) onProgress(item, results.length, items.length);
      continue;
    }

    if (isProtected(item.path)) {
      results.push({
        path: item.path,
        freed: 0,
        success: false,
        error: 'Protected path',
      });
      if (onProgress) onProgress(item, results.length, items.length);
      continue;
    }

    const result = await cleanFolder(item.path);
    if (result.success) {
      totalFreed += item.size;
    }
    results.push({
      path: item.path,
      freed: result.success ? item.size : 0,
      ...result,
    });
    if (onProgress) onProgress(item, results.length, items.length);
  }

  return { totalFreed, results };
}

/**
 * Check if a path matches any protected pattern.
 *
 * @param {string} path
 * @returns {boolean}
 */
function isProtected(path) {
  for (const pattern of PROTECTED_PATTERNS) {
    if (matchGlob(path, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Simple glob matching for protection patterns.
 *
 * @param {string} path
 * @param {string} pattern
 * @returns {boolean}
 */
function matchGlob(path, pattern) {
  // Convert glob pattern to regex
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regex}$`).test(path);
}
