import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

/**
 * Detect if the given path is inside a monorepo.
 * Checks for workspaces in package.json, pnpm-workspace.yaml, turbo.json, lerna.json.
 * @param {string} startPath - Path to start searching from
 * @returns {Promise<{isMonorepo: boolean, type: string|null, root: string|null}>}
 */
export async function detectMonorepo(startPath) {
  let current = resolve(startPath);

  while (true) {
    // Check package.json for workspaces
    const pkgPath = resolve(current, 'package.json');
    try {
      await access(pkgPath);
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return { isMonorepo: true, type: 'npm/yarn', root: current };
      }
    } catch {
      // Not found or unreadable
    }

    // Check pnpm-workspace.yaml
    try {
      await access(resolve(current, 'pnpm-workspace.yaml'));
      return { isMonorepo: true, type: 'pnpm', root: current };
    } catch {}

    // Check turbo.json
    try {
      await access(resolve(current, 'turbo.json'));
      return { isMonorepo: true, type: 'turbo', root: current };
    } catch {}

    // Check lerna.json
    try {
      await access(resolve(current, 'lerna.json'));
      return { isMonorepo: true, type: 'lerna', root: current };
    } catch {}

    // Move up one directory
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return { isMonorepo: false, type: null, root: null };
}

/**
 * Check if a path is a shared dependency in a monorepo root.
 * Shared node_modules in root should be treated with extra care.
 * @param {string} folderPath
 * @param {string} monorepoRoot
 * @returns {boolean}
 */
export function isSharedDependency(folderPath, monorepoRoot) {
  if (!monorepoRoot) return false;
  const rootNodeModules = resolve(monorepoRoot, 'node_modules');
  return folderPath === rootNodeModules;
}
