/**
 * Format bytes into human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

/**
 * Format a relative time string.
 * @param {Date} date
 * @returns {string}
 */
export function formatAge(date) {
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Get the number of days since a date.
 * @param {Date} date
 * @returns {number}
 */
export function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Truncate a path for display, keeping the most relevant parts.
 * @param {string} fullPath
 * @param {number} maxLen
 * @returns {string}
 */
export function truncatePath(fullPath, maxLen = 60) {
  if (fullPath.length <= maxLen) return fullPath;
  const parts = fullPath.split('/');
  let result = parts[parts.length - 1];
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = join(parts[i], result);
    if (candidate.length > maxLen - 3) break;
    result = candidate;
  }
  return '.../' + result;
}
