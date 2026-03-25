import chalk from 'chalk';
import { formatSize, formatAge, daysSince } from '../utils/format.js';

// Unicode box drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
  cross: '┼',
  thickHorizontal: '━',
  thickVertical: '┃',
  thickTopLeft: '┏',
  thickTopRight: '┓',
  thickBottomLeft: '┗',
  thickBottomRight: '┛',
  thickTeeDown: '┳',
  thickTeeUp: '┻',
  thickTeeRight: '┣',
  thickTeeLeft: '┫',
  thickCross: '╋',
};

/**
 * Draw a horizontal line.
 */
function hLine(left, right, char, width) {
  return left + char.repeat(width) + right;
}

/**
 * Draw a box around content.
 */
function box(lines, opts = {}) {
  const {
    title = '',
    titleColor = chalk.white,
    borderColor = chalk.dim,
    padding = 1,
    width: forcedWidth,
  } = opts;

  // Calculate width
  const maxContentLen = Math.max(
    ...lines.map((l) => stripAnsi(l).length),
    title ? stripAnsi(title).length + 2 : 0
  );
  const innerWidth = forcedWidth ? forcedWidth - 4 : maxContentLen + padding * 2;
  const totalWidth = innerWidth + 2;

  const b = borderColor;
  const result = [];

  // Top border
  if (title) {
    const titleStr = ` ${title} `;
    const titleLen = stripAnsi(titleStr).length;
    const leftPad = Math.max(0, Math.floor((totalWidth - titleLen) / 2));
    const rightPad = Math.max(0, totalWidth - titleLen - leftPad);
    result.push(
      b(BOX.topLeft + BOX.horizontal.repeat(leftPad)) +
        titleColor(titleStr) +
        b(BOX.horizontal.repeat(rightPad) + BOX.topRight)
    );
  } else {
    result.push(b(hLine(BOX.topLeft, BOX.topRight, BOX.horizontal, totalWidth)));
  }

  // Content lines
  for (const line of lines) {
    const plainLen = stripAnsi(line).length;
    const pad = Math.max(0, innerWidth - plainLen);
    result.push(
      b(BOX.vertical) +
        ' '.repeat(padding) +
        line +
        ' '.repeat(pad - padding) +
        b(BOX.vertical)
    );
  }

  // Bottom border
  result.push(b(hLine(BOX.bottomLeft, BOX.bottomRight, BOX.horizontal, totalWidth)));

  return result.join('\n');
}

/**
 * Strip ANSI escape codes for length calculation.
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Print the cleandev banner.
 */
export function printBanner() {
  const lines = [
    chalk.bold.cyan('🧹 cleandev') +
      chalk.dim('  —  ') +
      chalk.white('next-gen disk cleanup for developers'),
    '',
    chalk.dim('Reclaim disk space from unused build artifacts'),
  ];

  console.log();
  console.log(box(lines, { title: '🧹 CLEANDEV', titleColor: chalk.bold.cyan, borderColor: chalk.cyan }));
  console.log();
}

/**
 * Print scan results in a professional table format.
 *
 * @param {object[]} results - Enriched scan results
 * @param {object} options
 */
export function printResults(results, options = {}) {
  const { showIndex = false, selected = null } = options;

  if (results.length === 0) {
    console.log(
      box(
        [
          chalk.green('✓ Your workspace is already clean!'),
          '',
          chalk.dim('No cleanable development artifacts found.'),
        ],
        { title: 'SCAN RESULTS', titleColor: chalk.bold.green, borderColor: chalk.green }
      )
    );
    return;
  }

  // Group by recommendation
  const safe = results.filter((r) => r.analysis.recommendation === 'safe');
  const review = results.filter((r) => r.analysis.recommendation === 'review');
  const dangerous = results.filter(
    (r) => r.analysis.recommendation === 'dangerous'
  );

  // Calculate totals
  const totalSize = results.reduce((sum, r) => sum + r.size, 0);
  const safeSize = safe.reduce((sum, r) => sum + r.size, 0);
  const reviewSize = review.reduce((sum, r) => sum + r.size, 0);

  // ── Summary header ──
  const summaryLines = [
    chalk.white(`Found ${chalk.bold(results.length + ' cleanable folders')}`),
    chalk.white(`Total reclaimable: ${chalk.bold(formatSize(totalSize))}`),
    '',
    chalk.green(`  ✔ Safe:   ${safe.length} items (${formatSize(safeSize)})`),
    chalk.yellow(`  ⚠ Review: ${review.length} items (${formatSize(reviewSize)})`),
  ];
  if (dangerous.length > 0) {
    summaryLines.push(
      chalk.red(`  ✖ Skipped: ${dangerous.length} items (protected)`)
    );
  }

  console.log(
    box(summaryLines, {
      title: 'SCAN RESULTS',
      titleColor: chalk.bold.white,
      borderColor: chalk.blue,
    })
  );
  console.log();

  // ── Results table ──
  printTable(results, { showIndex, selected, safe, review, dangerous });
}

/**
 * Print a properly aligned table of results.
 */
function printTable(results, options) {
  const { showIndex, selected, safe, review, dangerous } = options;

  // Column widths (for alignment)
  const col = {
    select: 3,
    icon: 3,
    type: 16,
    size: 12,
    age: 14,
    status: 10,
    path: 0, // flexible
  };

  // Header
  const headerParts = [
    showIndex ? chalk.dim('   ') : '',
    chalk.dim(' '.repeat(col.icon)),
    chalk.bold('TYPE'.padEnd(col.type)),
    chalk.bold('SIZE'.padStart(col.size)),
    chalk.bold('LAST USED'.padStart(col.age)),
    chalk.bold('STATUS'.padEnd(col.status)),
    chalk.bold('PATH'),
  ];
  const header = headerParts.join('');

  const separator = chalk.dim(
    BOX.horizontal.repeat(col.select + col.icon + col.type + col.size + col.age + col.status + 20)
  );

  // Print safe section
  if (safe.length > 0) {
    console.log(chalk.green.bold(`  ✅ SAFE TO DELETE (${safe.length})`));
    console.log(chalk.dim(`  Unused for 30+ days — recommended for cleanup`));
    console.log();
    console.log(`  ${header}`);
    console.log(`  ${separator}`);
    for (const item of safe) {
      printTableRow(item, results.indexOf(item), { showIndex, selected, style: 'safe', col });
    }
    console.log();
  }

  // Print review section
  if (review.length > 0) {
    console.log(chalk.yellow.bold(`  ⚠️  RECENTLY USED (${review.length})`));
    console.log(chalk.dim(`  Used within 30 days — review before deleting`));
    console.log();
    console.log(`  ${header}`);
    console.log(`  ${separator}`);
    for (const item of review) {
      printTableRow(item, results.indexOf(item), { showIndex, selected, style: 'review', col });
    }
    console.log();
  }

  // Print dangerous section
  if (dangerous.length > 0) {
    console.log(chalk.red.bold(`  🚫 PROTECTED (${dangerous.length})`));
    console.log(chalk.dim(`  Critical paths — cannot be deleted`));
    console.log();
    console.log(`  ${header}`);
    console.log(`  ${separator}`);
    for (const item of dangerous) {
      printTableRow(item, null, { showIndex: false, selected: null, style: 'dangerous', col });
    }
    console.log();
  }
}

/**
 * Print a single table row.
 */
function printTableRow(item, idx, options) {
  const { showIndex, selected, style, col } = options;
  const ageStr = formatAge(item.lastModified);
  const sizeStr = formatSize(item.size);

  const colors = {
    safe: chalk.green,
    review: chalk.yellow,
    dangerous: chalk.red.dim,
  };
  const color = colors[style];

  // Selection indicator
  let selChar = '  ';
  if (showIndex && selected !== null) {
    selChar = selected.has(idx)
      ? chalk.green(' ◉ ')
      : chalk.dim(' ○ ');
  }

  // Icon
  const icon = ` ${item.icon || '📁'} `;

  // Type name
  const typeName = color(item.typeName.padEnd(col.type).slice(0, col.type));

  // Size
  const size = chalk.white(sizeStr.padStart(col.size));

  // Age
  const age = chalk.dim(ageStr.padStart(col.age));

  // Status label
  const statusLabels = {
    safe: chalk.green.bold('✔ SAFE'),
    review: chalk.yellow.bold('⚠ REVIEW'),
    dangerous: chalk.red.dim('✖ LOCKED'),
  };
  const status = (statusLabels[style] || '').padEnd(col.status + 9); // +9 for ANSI codes

  // Path
  const path = chalk.dim(item.relativePath);

  console.log(`  ${selChar}${icon}${typeName}${size}  ${age}  ${status}${path}`);
}

/**
 * Print cleanup results.
 */
export function printCleanupResult(cleanupResult) {
  const { totalFreed, results } = cleanupResult;
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  console.log();

  if (succeeded > 0) {
    const lines = [
      chalk.green.bold(`Successfully cleaned ${succeeded} folder${succeeded > 1 ? 's' : ''}`),
      '',
      chalk.white(`Space freed: ${chalk.bold.green(formatSize(totalFreed))}`),
    ];

    // List cleaned items
    if (results.length <= 10) {
      lines.push('');
      for (const r of results.filter((x) => x.success)) {
        lines.push(chalk.dim(`  ✔ ${r.path}`));
      }
    }

    console.log(
      box(lines, {
        title: '🧹 CLEANUP COMPLETE',
        titleColor: chalk.bold.green,
        borderColor: chalk.green,
      })
    );
  }

  if (failed.length > 0) {
    console.log();
    const failLines = [
      chalk.yellow(`${failed.length} folder(s) could not be deleted:`),
      '',
    ];
    for (const f of failed) {
      failLines.push(chalk.dim(`  ✖ ${f.path}`));
      failLines.push(chalk.dim(`    ${f.error}`));
    }
    console.log(
      box(failLines, {
        title: '⚠️ WARNINGS',
        titleColor: chalk.bold.yellow,
        borderColor: chalk.yellow,
      })
    );
  }

  console.log();
}

/**
 * Print monorepo info.
 */
export function printMonorepoInfo(monorepoInfo) {
  if (monorepoInfo.isMonorepo) {
    const lines = [
      chalk.white(
        `Detected ${chalk.bold(monorepoInfo.type)} monorepo`
      ),
      chalk.dim(`Root: ${monorepoInfo.root}`),
      '',
      chalk.green('Shared dependencies will be protected.'),
    ];

    console.log(
      box(lines, {
        title: '🔗 MONOREPO',
        titleColor: chalk.bold.blue,
        borderColor: chalk.blue,
      })
    );
    console.log();
  }
}

/**
 * Print JSON output.
 */
export function printJson(results) {
  const output = results.map((r) => ({
    path: r.path,
    type: r.typeName,
    size: r.size,
    sizeHuman: formatSize(r.size),
    lastModified: r.lastModified.toISOString(),
    daysSinceModified: daysSince(r.lastModified),
    recommendation: r.analysis.recommendation,
    reason: r.analysis.reason,
  }));
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Print a spinner-like status message.
 */
export function printStatus(message) {
  process.stdout.write(chalk.dim(`  ${message}...`));
}

export function printStatusDone(message) {
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  if (message) {
    console.log(chalk.green(`  ✔ ${message}`));
  }
}

export function printStatusFail(message) {
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  if (message) {
    console.log(chalk.red(`  ✖ ${message}`));
  }
}
