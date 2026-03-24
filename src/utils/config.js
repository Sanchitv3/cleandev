import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Load cleandev.config.js if it exists.
 * @param {string} cwd - Working directory
 * @returns {Promise<object>} Config object
 */
export async function loadConfig(cwd = process.cwd()) {
  const configPath = resolve(cwd, 'cleandev.config.js');

  try {
    await access(configPath);
    const configUrl = `file://${configPath}`;
    const config = await import(configUrl);
    return config.default || config;
  } catch {
    return {};
  }
}

/**
 * Merge CLI options with config file options.
 * CLI options take precedence.
 * @param {object} cliOptions - Options from commander
 * @param {object} config - Options from config file
 * @returns {object} Merged options
 */
export function mergeOptions(cliOptions, config) {
  return {
    path: cliOptions.path || config.path || process.cwd(),
    depth: cliOptions.depth ?? config.depth ?? 5,
    auto: cliOptions.auto ?? config.auto ?? false,
    types: cliOptions.types || config.types || null,
    ignore: [...(config.ignore || []), ...(cliOptions.ignore || [])],
    minSize: cliOptions.minSize ?? config.minSize ?? 0,
    safeDays: cliOptions.safeDays ?? config.safeDays ?? 30,
    sort: cliOptions.sort || config.sort || 'size',
    json: cliOptions.json ?? config.json ?? false,
    force: cliOptions.force ?? config.force ?? false,
    dryRun: cliOptions.dryRun ?? config.dryRun ?? false,
  };
}
