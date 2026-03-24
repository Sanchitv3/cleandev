# 🧹 devclean

**Next-gen disk cleanup tool for developers.** Reclaim tens of GBs by intelligently detecting and cleaning unnecessary development artifacts.

Goes beyond `npkill` — detects `node_modules`, `.next`, `.expo`, `.gradle`, `DerivedData`, `dist`, `build` and more. Smart recommendations based on last-modified time. Monorepo-aware. Safe by default.

## Install

```bash
npm install -g devclean
```

Or run without installing:

```bash
npx devclean
```

## Quick Start

```bash
# Scan your entire home directory — find and clean dev artifacts anywhere
devclean

# Scan a specific path
devclean --path ~/projects

# Scan only (dry run — nothing deleted)
devclean scan

# Auto-delete safe folders (unused 30+ days)
devclean clean --auto

# Force mode — even protected folders become selectable
devclean --force
```

## Commands

### `devclean` (default — interactive)

Scans the current directory, shows results, and lets you select folders to delete.

```bash
devclean                    # Interactive cleanup in current directory
devclean --path ~/projects  # Scan a different path
```

### `devclean scan` (dry run)

Only shows what's found — never deletes anything.

```bash
devclean scan                         # Scan home directory
devclean scan --path ~/projects       # Scan a specific path
devclean scan --json                  # JSON output (pipe to jq, scripts, etc.)
devclean scan --min-size 1048576      # Only show folders > 1 MB
devclean scan --types node_modules,.next  # Only scan specific types
devclean scan --force                 # Show protected folders as selectable
```

### `devclean clean` (with options)

```bash
devclean clean --auto             # Auto-delete safe items (no prompt)
devclean clean --auto --dry-run   # Show what auto-delete would remove
devclean clean --safe-days 14     # Items unused 14+ days = safe
devclean clean --force            # Even protected folders become selectable
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Root path to scan | `~/` (home dir) |
| `-d, --depth <number>` | Max directory depth | `5` |
| `-a, --auto` | Auto-delete safe folders | `false` |
| `-t, --types <types>` | Comma-separated folder types | all |
| `-i, --ignore <patterns>` | Comma-separated ignore patterns | — |
| `--min-size <bytes>` | Minimum folder size in bytes | `0` |
| `--safe-days <days>` | Days unused before considered safe | `30` |
| `--sort <field>` | Sort by: `size`, `age`, `priority`, `type` | `size` |
| `--json` | Output as JSON | `false` |
| `--dry-run` | Show what would be deleted | `false` |
| `--force` | Allow deleting protected folders | `false` |

## Supported Folder Types

| Type | Description |
|------|-------------|
| `node_modules` | Node.js dependencies |
| `.next` | Next.js build cache |
| `.expo` | Expo development cache |
| `DerivedData` | Xcode derived data |
| `.gradle` | Gradle build cache |
| `android/build` | Android build output |
| `dist` | Distribution build output |
| `build` | Build output |
| `.turbo` | Turborepo cache |
| `.svelte-kit` | SvelteKit build cache |
| `.nuxt` | Nuxt build cache |
| `.cache` | Generic cache |
| `.parcel-cache` | Parcel bundler cache |
| `coverage` | Test coverage reports |
| `.output` | Framework output |

## Smart Recommendations

devclean analyzes each folder and recommends:

- **✅ SAFE** — Not modified in 30+ days. Pre-selected for deletion.
- **⚠️ REVIEW** — Modified recently. Shown but not pre-selected.
- **🚫 PROTECTED** — Critical path (monorepo root, current project). Never deleted.

## Monorepo Support

devclean automatically detects:
- **npm/yarn** workspaces
- **pnpm** workspaces
- **Turborepo** projects
- **Lerna** monorepos

Shared root-level `node_modules` in monorepos are protected from deletion.

## Config File

Create `devclean.config.js` in your project root:

```js
export default {
  depth: 8,
  safeDays: 14,
  ignore: ['**/fixtures/**'],
  types: ['node_modules', '.next', 'dist'],
  minSize: 1048576, // 1 MB minimum
};
```

CLI flags override config file values.

## Example Output

```
  🧹 devclean — reclaim your disk space
  ══════════════════════════════════════════

  Found 8 cleanable folders
  Total size: 4.2 GB

  ✅ SAFE TO DELETE (3 items)
  These haven't been used recently.

  ○ 📦 node_modules (2.3 GB) — 45 days ago → SAFE
      projects/old-app/node_modules
  ○ ▲ .next (800 MB) — 2 months ago → SAFE
      projects/old-next/.next
  ○ 📱 .expo (450 MB) — 60 days ago → SAFE
      projects/expo-test/.expo

  ⚠️  REVIEW (2 items)
  These were used recently — double-check.

  ○ 📦 node_modules (320 MB) — 5 days ago → REVIEW
      projects/active-app/node_modules
  ○ 🔨 build (180 MB) — 12 days ago → REVIEW
      projects/active-app/build

  💡 You could free up 3.5 GB by deleting safe items.
```

## Programmatic API

```js
import { scan, enrichResults, cleanAll } from 'devclean';

// Scan
const results = await scan({ path: '/projects', depth: 5 });

// Analyze
const enriched = enrichResults(results, { safeDays: 30 });

// Clean
const { totalFreed } = await cleanAll(enriched.filter(r => r.analysis.recommendation === 'safe'));
console.log(`Freed ${totalFreed} bytes`);
```

## Safety

- Never deletes system directories
- Protects monorepo shared dependencies
- Protects current project's `node_modules`
- Always confirms before deleting (unless `--auto`)
- Handles permission errors gracefully

## License

MIT
