/**
 * Folder types that cleandev can detect and clean.
 * Each pattern maps to metadata about the folder type.
 */
export const FOLDER_TYPES = [
  {
    name: 'node_modules',
    patterns: ['node_modules', '**/node_modules'],
    description: 'Node.js dependencies',
    icon: '📦',
    category: 'dependencies',
  },
  {
    name: '.next',
    patterns: ['.next', '**/.next'],
    description: 'Next.js build cache',
    icon: '▲',
    category: 'build-cache',
  },
  {
    name: '.expo',
    patterns: ['.expo', '**/.expo'],
    description: 'Expo development cache',
    icon: '📱',
    category: 'build-cache',
  },
  {
    name: 'DerivedData',
    patterns: ['DerivedData', '**/DerivedData'],
    description: 'Xcode derived data',
    icon: '🍎',
    category: 'build-cache',
  },
  {
    name: '.gradle',
    patterns: ['.gradle', '**/.gradle'],
    description: 'Gradle build cache',
    icon: '🤖',
    category: 'build-cache',
  },
  {
    name: 'android/build',
    patterns: ['android/build', '**/android/build', 'android/app/build', '**/android/app/build'],
    description: 'Android build output',
    icon: '🤖',
    category: 'build-output',
  },
  {
    name: 'dist',
    patterns: ['dist', '**/dist'],
    description: 'Distribution build output',
    icon: '📦',
    category: 'build-output',
  },
  {
    name: 'build',
    patterns: ['build', '**/build'],
    description: 'Build output',
    icon: '🔨',
    category: 'build-output',
  },
  {
    name: '.turbo',
    patterns: ['.turbo', '**/.turbo'],
    description: 'Turborepo cache',
    icon: '⚡',
    category: 'build-cache',
  },
  {
    name: '.svelte-kit',
    patterns: ['.svelte-kit', '**/.svelte-kit'],
    description: 'SvelteKit build cache',
    icon: '🔥',
    category: 'build-cache',
  },
  {
    name: '.nuxt',
    patterns: ['.nuxt', '**/.nuxt'],
    description: 'Nuxt build cache',
    icon: '💚',
    category: 'build-cache',
  },
  {
    name: '.cache',
    patterns: ['.cache', '**/.cache'],
    description: 'Generic cache directory',
    icon: '💾',
    category: 'build-cache',
  },
  {
    name: '.parcel-cache',
    patterns: ['.parcel-cache', '**/.parcel-cache'],
    description: 'Parcel bundler cache',
    icon: '📦',
    category: 'build-cache',
  },
  {
    name: 'coverage',
    patterns: ['coverage', '**/coverage'],
    description: 'Test coverage reports',
    icon: '🧪',
    category: 'test',
  },
  {
    name: '.output',
    patterns: ['.output', '**/.output'],
    description: 'Framework output directory',
    icon: '🚀',
    category: 'build-output',
  },
];

/**
 * Folder names that should NEVER be deleted.
 */
export const PROTECTED_PATTERNS = [
  '**/node_modules/.package-lock.json',
  '/usr/**',
  '/System/**',
  '/Windows/**',
  '/Program Files/**',
  'C:\\Windows\\**',
  'C:\\Program Files\\**',
  '/var/**',
  '/etc/**',
  '/opt/**',
  '/bin/**',
  '/sbin/**',
];

/**
 * Directories to never scan (performance).
 */
export const IGNORE_DIRS = [
  '.git',
  '.svn',
  '.hg',
  'proc',
  'sys',
  'dev',
  '.Trash',
  'Library',
  '.npm/_npx',
  'node_modules/.cache',
];

/**
 * Age thresholds in milliseconds.
 */
export const AGE_THRESHOLDS = {
  SAFE_DAYS: 30,
  REVIEW_DAYS: 7,
  MS_PER_DAY: 24 * 60 * 60 * 1000,
};

/**
 * Max concurrent stat operations.
 */
export const MAX_CONCURRENCY = 50;
