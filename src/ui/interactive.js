import inquirer from 'inquirer';
import chalk from 'chalk';
import { formatSize, daysSince } from '../utils/format.js';

// Box drawing
const B = {
  h: '─',
  v: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  teeD: '┬',
  teeU: '┴',
  teeR: '├',
  teeL: '┤',
  cross: '┼',
};

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function padAnsi(str, len) {
  const plain = stripAnsi(str);
  const diff = len - plain.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

/**
 * Professional interactive folder selection with grouped display,
 * column alignment, live summary, and keyboard shortcuts.
 *
 * @param {object[]} results - Enriched scan results
 * @returns {Promise<object[]>} Selected items
 */
export async function selectItems(results, opts = {}) {
  const { force = false } = opts;
  if (results.length === 0) return [];

  const safe = results.filter((r) => r.analysis.recommendation === 'safe');
  const review = results.filter((r) => r.analysis.recommendation === 'review');
  const dangerous = results.filter((r) => r.analysis.recommendation === 'dangerous');

  // With force: everything is selectable. Without: only safe + review.
  const cleanable = force
    ? results
    : results.filter((r) => r.analysis.recommendation !== 'dangerous');

  // Pre-select safe items
  const preSelectedValues = new Set();
  cleanable.forEach((r) => {
    if (r.analysis.recommendation === 'safe') {
      preSelectedValues.add(results.indexOf(r));
    }
  });

  // Build choices with rich formatting
  const choices = buildChoices(results, cleanable, dangerous, preSelectedValues, force);

  // Print the selection header
  printSelectionHeader(safe, review, dangerous, force);

  // Print keyboard shortcuts
  printKeyboardShortcuts();

  // Interactive prompt — let inquirer handle stdin entirely
  let selected;
  try {
    const result = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: chalk.bold('  Select folders to clean:'),
        choices,
        pageSize: Math.min(cleanable.length + 2, 20),
        loop: false,
        validate: () => true,
      },
    ]);
    selected = result.selected;
  } catch {
    // Ctrl+C or prompt error
    console.log(chalk.dim('\n\n  Exiting. Nothing was deleted.\n'));
    process.exit(0);
  }

  return selected.map((i) => results[i]);
}

/**
 * Build formatted choices for the checkbox prompt.
 */
function buildChoices(results, cleanable, dangerous, preSelectedValues, force = false) {
  const choices = [];
  const col = { type: 16, size: 10, age: 14 };

  // Safe items first
  const safe = cleanable.filter((r) => r.analysis.recommendation === 'safe');
  const review = cleanable.filter((r) => r.analysis.recommendation === 'review');
  const forceDangerous = force ? dangerous : [];

  if (safe.length > 0) {
    choices.push(
      new inquirer.Separator(
        chalk.green(`  ── Safe to Delete (${safe.length} items, ${formatSize(safe.reduce((s, r) => s + r.size, 0))}) ──`)
      )
    );
    for (const item of safe) {
      const idx = results.indexOf(item);
      choices.push(buildChoice(item, idx, 'safe', col, preSelectedValues.has(idx)));
    }
  }

  if (review.length > 0) {
    choices.push(
      new inquirer.Separator(
        chalk.yellow(`  ── Recently Used — Review (${review.length} items, ${formatSize(review.reduce((s, r) => s + r.size, 0))}) ──`)
      )
    );
    for (const item of review) {
      const idx = results.indexOf(item);
      choices.push(buildChoice(item, idx, 'review', col, preSelectedValues.has(idx)));
    }
  }

  // With --force: dangerous items become selectable (shown in red, unchecked)
  if (forceDangerous.length > 0) {
    choices.push(
      new inquirer.Separator(
        chalk.red(`  ── Protected — Force Enabled (${forceDangerous.length} items) ──`)
      )
    );
    for (const item of forceDangerous) {
      const idx = results.indexOf(item);
      choices.push(buildChoice(item, idx, 'force-dangerous', col, false));
    }
  }

  // Without --force: dangerous items shown as disabled
  if (!force && dangerous.length > 0) {
    choices.push(
      new inquirer.Separator(
        chalk.red(`  ── Protected — Cannot Delete (${dangerous.length} items) ──`)
      )
    );
    for (const item of dangerous) {
      const idx = results.indexOf(item);
      choices.push({
        name: chalk.dim.strikethrough(
          `  ${item.icon} ${item.typeName.padEnd(col.type)} ${formatSize(item.size).padStart(col.size)}  ${formatAge(item.lastModified).padStart(col.age)}  ${item.relativePath}`
        ),
        value: idx,
        disabled: chalk.red('protected'),
      });
    }
  }

  // Add footer separator
  choices.push(new inquirer.Separator(chalk.dim('  ' + '─'.repeat(70))));
  choices.push(
    new inquirer.Separator(
      chalk.dim(`  ${cleanable.length} items available  |  ${preSelectedValues.size} pre-selected  |  Ctrl+C to exit`)
    )
  );

  return choices;
}

/**
 * Build a single choice item with aligned columns.
 */
function buildChoice(item, idx, style, col, checked) {
  const ageStr = formatAge(item.lastModified);
  const sizeStr = formatSize(item.size);

  const colors = {
    safe: chalk.green,
    review: chalk.yellow,
    'force-dangerous': chalk.red,
  };
  const color = colors[style] || chalk.white;

  const statusIcons = {
    safe: '✔',
    review: '⚠',
    'force-dangerous': '⚡',
  };
  const statusIcon = statusIcons[style] || '●';

  // Build aligned row
  const parts = [
    ` ${item.icon} `,
    color(item.typeName.padEnd(col.type)),
    chalk.white.bold(sizeStr.padStart(col.size)),
    chalk.dim(ageStr.padStart(col.age)),
    color(` ${statusIcon}`),
    chalk.dim(` ${item.relativePath}`),
  ];

  return {
    name: parts.join(''),
    value: idx,
    checked,
    short: `${item.typeName} (${sizeStr})`,
  };
}

/**
 * Print the selection header with summary box.
 */
function printSelectionHeader(safe, review, dangerous, force = false) {
  const safeSize = safe.reduce((s, r) => s + r.size, 0);
  const reviewSize = review.reduce((s, r) => s + r.size, 0);
  const dangerousSize = dangerous.reduce((s, r) => s + r.size, 0);
  const totalSize = safeSize + reviewSize + (force ? dangerousSize : 0);

  const lines = [];

  if (safe.length > 0) {
    lines.push(
      chalk.green(`  ✔ Safe (pre-selected): ${safe.length} items — ${formatSize(safeSize)}`)
    );
  }
  if (review.length > 0) {
    lines.push(
      chalk.yellow(`  ⚠ Review (manual):     ${review.length} items — ${formatSize(reviewSize)}`)
    );
  }
  if (dangerous.length > 0) {
    if (force) {
      lines.push(
        chalk.red(`  ⚡ Force (selectable):  ${dangerous.length} items — ${formatSize(dangerousSize)}`)
      );
    } else {
      lines.push(
        chalk.red(`  ✖ Protected (locked):  ${dangerous.length} items`)
      );
    }
  }
  lines.push('');
  if (force) {
    lines.push(
      chalk.white(`  Potential savings: ${chalk.bold(formatSize(totalSize))}`) +
        chalk.red('  ⚡ --force enabled')
    );
  } else {
    lines.push(
      chalk.white(`  Potential savings: ${chalk.bold(formatSize(totalSize))}`)
    );
  }

  const border = chalk.cyan;
  const width = 58;

  console.log();
  console.log(border('  ' + B.tl + B.h.repeat(width) + B.tr));
  for (const line of lines) {
    const plainLen = stripAnsi(line).length;
    const pad = Math.max(0, width - plainLen + 2);
    console.log(border(`  ${B.v}`) + line + ' '.repeat(pad) + border(B.v));
  }
  console.log(border('  ' + B.bl + B.h.repeat(width) + B.br));
  console.log();
}

/**
 * Print keyboard shortcuts legend.
 */
function printKeyboardShortcuts() {
  const shortcuts = [
    ['Space', 'Toggle'],
    ['a', 'Select all'],
    ['i', 'Invert'],
    ['Ctrl+C', 'Exit'],
    ['Enter', 'Confirm'],
  ];

  const parts = shortcuts.map(
    ([key, desc]) => `${chalk.bold.bgCyan.black(` ${key} `)} ${chalk.dim(desc)}`
  );

  console.log(chalk.dim('  Keyboard: ') + parts.join(chalk.dim('  │  ')));
  console.log();
}

/**
 * Confirm deletion with a professional summary box.
 *
 * @param {object[]} items - Selected items to delete
 * @returns {Promise<boolean>}
 */
export async function confirmDeletion(items) {
  if (items.length === 0) {
    console.log(
      chalk.yellow('\n  Nothing selected. Cleanup cancelled.\n')
    );
    return false;
  }

  const totalSize = items.reduce((sum, r) => sum + r.size, 0);
  const safeCount = items.filter((i) => i.analysis.recommendation === 'safe').length;
  const reviewCount = items.filter((i) => i.analysis.recommendation === 'review').length;

  const lines = [
    chalk.white(`Folders to delete: ${chalk.bold(items.length)}`),
    chalk.white(`Space to free:     ${chalk.bold.green(formatSize(totalSize))}`),
  ];

  if (safeCount > 0) {
    lines.push(chalk.green(`  ✔ ${safeCount} safe`));
  }
  if (reviewCount > 0) {
    lines.push(chalk.yellow(`  ⚠ ${reviewCount} review (recently used)`));
  }

  lines.push('');
  lines.push(chalk.dim('This action cannot be undone.'));

  const border = chalk.yellow;
  const width = 52;

  console.log();
  console.log(border('  ' + B.tl + B.h.repeat(width) + B.tr));
  for (const line of lines) {
    const plainLen = stripAnsi(line).length;
    const pad = Math.max(0, width - plainLen + 2);
    console.log(border(`  ${B.v}`) + line + ' '.repeat(pad) + border(B.v));
  }
  console.log(border('  ' + B.bl + B.h.repeat(width) + B.br));
  console.log();

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.bold.red('Delete these folders?'),
      default: false,
    },
  ]);

  return confirmed;
}

/**
 * Format age for display.
 */
function formatAge(date) {
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
