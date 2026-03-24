import fg from 'fast-glob';
import { stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { FOLDER_TYPES, IGNORE_DIRS, MAX_CONCURRENCY } from './constants.js';
import { getDirSize, getLastModified } from '../utils/fs-utils.js';

/**
 * @typedef {Object} ScanResult
 * @property {string} path - Full path to the folder
 * @property {string} relativePath - Path relative to scan root
 * @property {string} typeName - Folder type name (e.g. 'node_modules')
 * @property {string} description - Human-readable description
 * @property {string} icon - Display icon
 * @property {string} category - Category classification
 * @property {number} size - Size in bytes
 * @property {number} fileCount - Number of files
 * @property {Date} lastModified - Last modification date
 * @property {string} projectRoot - Nearest project root (contains package.json)
 */

/**
 * Scan a directory for cleanable folders.
 * Uses parallel glob matching + parallel size calculation.
 *
 * @param {object} options
 * @param {string} options.path - Root path to scan
 * @param {number} options.depth - Max scan depth (default 5)
 * @param {string[]|null} options.types - Filter to specific folder types
 * @param {string[]} options.ignore - Additional ignore patterns
 * @param {number} options.minSize - Minimum size in bytes to include
 * @param {boolean} options.verbose - Log progress
 * @returns {Promise<ScanResult[]>}
 */
export async function scan(options) {
  const {
    path: rootPath,
    depth = 5,
    types: filterTypes = null,
    ignore: ignorePatterns_ = [],
    minSize = 0,
    verbose = false,
  } = options;

  const absoluteRoot = resolve(rootPath);

  // Build glob patterns from folder types
  const typesToScan = filterTypes
    ? FOLDER_TYPES.filter((t) => filterTypes.includes(t.name))
    : FOLDER_TYPES;

  const patterns = typesToScan.flatMap((t) =>
    t.patterns.map((p) => {
      // Ensure patterns are relative and handle depth
      return p.includes('**') ? p : p;
    })
  );

  // Build ignore patterns
  const ignorePatterns = [
    ...IGNORE_DIRS.map((d) => `**/${d}/**`),
    ...(ignorePatterns_ || []),
    'node_modules/**/node_modules/**', // Don't go deeper than first node_modules
  ];

  // Find all matching directories
  const globOptions = {
    cwd: absoluteRoot,
    onlyDirectories: true,
    dot: true,
    deep: depth,
    ignore: ignorePatterns,
    absolute: true,
    followSymbolicLinks: false,
    suppressErrors: true,
  };

  const matches = await fg(patterns, globOptions);

  // Deduplicate (nested matches)
  const dedupedMatches = deduplicatePaths(matches);

  // Process matches in parallel batches with concurrency control
  const results = [];
  const batchSize = MAX_CONCURRENCY;

  for (let i = 0; i < dedupedMatches.length; i += batchSize) {
    const batch = dedupedMatches.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (matchPath) => {
        const typeName = identifyType(matchPath, typesToScan);
        if (!typeName) return null;

        const typeInfo = typesToScan.find((t) => t.name === typeName);
        const relPath = relative(absoluteRoot, matchPath);
        const projectRoot = findProjectRoot(matchPath);

        const [{ size, fileCount }, lastModified] = await Promise.all([
          getDirSize(matchPath, 10),
          getLastModified(matchPath),
        ]);

        if (size < minSize) return null;

        return {
          path: matchPath,
          relativePath: relPath,
          typeName: typeInfo.name,
          description: typeInfo.description,
          icon: typeInfo.icon,
          category: typeInfo.category,
          size,
          fileCount,
          lastModified,
          projectRoot,
        };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

/**
 * Remove paths that are nested inside another match.
 * @param {string[]} paths
 * @returns {string[]}
 */
function deduplicatePaths(paths) {
  const sorted = [...paths].sort((a, b) => a.length - b.length);
  const result = [];

  for (const p of sorted) {
    const isNested = result.some(
      (existing) => p.startsWith(existing) && p !== existing
    );
    if (!isNested) {
      result.push(p);
    }
  }

  return result;
}

/**
 * Identify which folder type a path matches.
 * @param {string} path
 * @param {Array} types
 * @returns {string|null}
 */
function identifyType(path, types) {
  const pathSegments = path.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];

  // First pass: multi-segment pattern match (e.g. "android/build")
  // These are more specific and should take priority
  for (const type of types) {
    if (!type.name.includes('/')) continue;

    for (const pattern of type.patterns) {
      const patternSegments = pattern.split('/');
      const patternLen = patternSegments.length;

      if (pathSegments.length >= patternLen) {
        const slice = pathSegments.slice(pathSegments.length - patternLen);
        if (slice.join('/') === patternSegments.join('/')) {
          return type.name;
        }
      }
    }
  }

  // Second pass: exact type name match (e.g. "node_modules", ".next", "build")
  for (const type of types) {
    if (type.name === lastSegment) {
      return type.name;
    }
  }

  return null;
}

/**
 * Find the nearest project root (directory with package.json or similar).
 * @param {string} startPath
 * @returns {string|null}
 */
function findProjectRoot(startPath) {
  const segments = startPath.split('/');
  for (let i = segments.length - 1; i >= 0; i--) {
    const candidate = segments.slice(0, i + 1).join('/');
    if (
      candidate.endsWith('/node_modules') ||
      candidate.endsWith('/.next') ||
      candidate.endsWith('/.expo') ||
      candidate.endsWith('/DerivedData') ||
      candidate.endsWith('/.gradle') ||
      candidate.endsWith('/dist') ||
      candidate.endsWith('/build')
    ) {
      continue;
    }
    return candidate;
  }
  return startPath;
}
