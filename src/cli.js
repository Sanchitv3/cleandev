import { Command } from 'commander';
import { homedir } from 'node:os';
import ora from 'ora';
import chalk from 'chalk';
import { scan } from './core/scanner.js';
import { enrichResults, sortByPriority } from './core/recommender.js';
import { cleanAll } from './core/cleaner.js';
import { detectMonorepo } from './core/monorepo.js';
import { loadConfig, mergeOptions } from './utils/config.js';
import { printBanner, printResults, printCleanupResult, printMonorepoInfo, printJson } from './ui/display.js';
import { selectItems, confirmDeletion } from './ui/interactive.js';

const pkg = { version: '1.0.0' };
const DEFAULT_PATH = homedir();

function parseDepth(value) {
  if (value === 'true' || value === true) return true;
  const n = parseInt(value);
  return isNaN(n) ? 10 : n;
}

function parseList(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.length > 0 ? value : null;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const program = new Command();

program
  .name('cleandev')
  .description('Next-gen disk cleanup tool for developers')
  .version(pkg.version);

// Default command — interactive mode
program
  .command('clean', { isDefault: true })
  .description('Scan and interactively clean development artifacts')
  .option('-p, --path <path>', 'Path to scan', DEFAULT_PATH)
  .option('-d, --depth <number>', 'Max scan depth (default: 10)', '10')
  .option('-a, --auto', 'Auto-delete safe folders (no confirmation)')
  .option('-t, --types <types>', 'Comma-separated folder types to scan')
  .option('-i, --ignore <patterns>', 'Comma-separated patterns to ignore')
  .option('--min-size <bytes>', 'Minimum folder size in bytes', '0')
  .option('--safe-days <days>', 'Days of inactivity to consider safe', '30')
  .option('--sort <field>', 'Sort by: size, age, priority, type', 'size')
  .option('--json', 'Output results as JSON')
  .option('--dry-run', 'Show what would be deleted without deleting')
  .option('--force', 'Allow deleting protected folders (use with caution)')
  .action(async (options) => {
    await runClean(options);
  });

// Scan command — dry run
program
  .command('scan')
  .description('Scan for cleanable folders (dry run)')
  .option('-p, --path <path>', 'Path to scan', DEFAULT_PATH)
  .option('-d, --depth <number>', 'Max scan depth (default: 10)', '10')
  .option('-t, --types <types>', 'Comma-separated folder types to scan')
  .option('-i, --ignore <patterns>', 'Comma-separated patterns to ignore')
  .option('--min-size <bytes>', 'Minimum folder size in bytes', '0')
  .option('--safe-days <days>', 'Days of inactivity to consider safe', '30')
  .option('--sort <field>', 'Sort by: size, age, priority, type', 'size')
  .option('--json', 'Output results as JSON')
  .option('--force', 'Show protected folders as selectable')
  .action(async (options) => {
    await runScan(options);
  });

program.parse();

/**
 * Main clean flow — scan, interactive select, confirm, delete.
 */
async function runClean(cliOptions) {
  const config = await loadConfig(cliOptions.path);
  const options = mergeOptions(cliOptions, config);
  const force = !!options.force;

  if (!options.json) printBanner();

  // Detect monorepo
  const monorepo = await detectMonorepo(options.path);
  if (!options.json && monorepo.isMonorepo) {
    printMonorepoInfo(monorepo);
  }

  // Scan
  const spinner = options.json ? null : ora('Scanning for cleanable folders...').start();
  let results;
  try {
    results = await scan({
      path: options.path,
      depth: parseDepth(options.depth),
      types: parseList(options.types),
      ignore: parseList(options.ignore),
      minSize: parseInt(options.minSize),
    });
    if (spinner) spinner.succeed(`Found ${results.length} cleanable folders`);
  } catch (err) {
    if (spinner) spinner.fail('Scan failed');
    console.error(chalk.red(`  Error: ${err.message}`));
    process.exit(1);
  }

  // Enrich with recommendations (force downgrades dangerous to review)
  results = enrichResults(results, {
    safeDays: parseInt(options.safeDays),
    monorepo,
    force,
  });

  // Sort
  results = sortByPriority(results, options.sort);

  if (results.length === 0) {
    if (options.json) {
      printJson(results);
    } else {
      console.log(chalk.yellow('\n  No cleanable folders found. Your workspace is clean! 🎉\n'));
    }
    return;
  }

  if (options.json) {
    printJson(results);
    return;
  }

  // Display results
  printResults(results, { showIndex: true });

  // If auto mode or dry run
  if (options.auto) {
    const safeItems = results.filter((r) => r.analysis.recommendation === 'safe');
    if (safeItems.length === 0) {
      console.log(chalk.yellow('\n  No safe items to auto-delete.\n'));
      return;
    }

    console.log(chalk.bold(`\n  Auto-deleting ${safeItems.length} safe item(s)...\n`));
    const cleanupResult = await cleanAll(safeItems, { dryRun: options.dryRun });
    printCleanupResult(cleanupResult);
    return;
  }

  if (options.dryRun) {
    console.log(chalk.dim('\n  Dry run — nothing was deleted.\n'));
    return;
  }

  // Interactive selection — with force, all items are selectable
  const selected = await selectItems(results, { force });
  if (selected.length === 0) return;

  const confirmed = await confirmDeletion(selected);
  if (!confirmed) {
    console.log(chalk.yellow('\n  Cancelled. Nothing was deleted.\n'));
    return;
  }

  // Clean
  const cleanSpinner = ora('Deleting folders...').start();
  const cleanupResult = await cleanAll(selected, {
    onProgress: (item, current, total) => {
      cleanSpinner.text = `Deleting ${current}/${total}: ${item.path}`;
    },
  });
  cleanSpinner.stop();

  printCleanupResult(cleanupResult);
}

/**
 * Scan-only flow — no deletion.
 */
async function runScan(cliOptions) {
  const config = await loadConfig(cliOptions.path);
  const options = mergeOptions(cliOptions, config);
  const force = !!options.force;

  if (!options.json) printBanner();

  const monorepo = await detectMonorepo(options.path);
  if (!options.json && monorepo.isMonorepo) {
    printMonorepoInfo(monorepo);
  }

  const spinner = options.json ? null : ora('Scanning...').start();

  let results;
  try {
    results = await scan({
      path: options.path,
      depth: parseDepth(options.depth),
      types: parseList(options.types),
      ignore: parseList(options.ignore),
      minSize: parseInt(options.minSize),
    });
    if (spinner) spinner.succeed(`Found ${results.length} cleanable folders`);
  } catch (err) {
    if (spinner) spinner.fail('Scan failed');
    console.error(chalk.red(`  Error: ${err.message}`));
    process.exit(1);
  }

  results = enrichResults(results, {
    safeDays: parseInt(options.safeDays),
    monorepo,
    force,
  });

  results = sortByPriority(results, options.sort);

  if (options.json) {
    printJson(results);
  } else {
    printResults(results);
  }
}
