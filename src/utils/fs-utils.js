import { stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Calculate total size of a directory recursively using parallel traversal.
 * @param {string} dirPath - Directory to measure
 * @param {number} concurrency - Max parallel operations
 * @returns {Promise<{size: number, fileCount: number}>}
 */
export async function getDirSize(dirPath, concurrency = 50) {
  let totalSize = 0;
  let fileCount = 0;
  const queue = [dirPath];
  const active = new Set();

  return new Promise((resolve, reject) => {
    let completed = 0;
    let totalTasks = 1;

    function processNext() {
      while (active.size < concurrency && queue.length > 0) {
        const path = queue.shift();
        active.add(path);

        stat(path)
          .then((s) => {
            if (s.isFile()) {
              totalSize += s.size;
              fileCount++;
            } else if (s.isDirectory()) {
              return readdir(path, { withFileTypes: true }).then((entries) => {
                for (const entry of entries) {
                  const fullPath = join(path, entry.name);
                  if (entry.isSymbolicLink()) continue;
                  if (entry.isDirectory()) {
                    queue.push(fullPath);
                    totalTasks++;
                  } else if (entry.isFile()) {
                    queue.push(fullPath);
                    totalTasks++;
                  }
                }
              });
            }
          })
          .catch(() => {
            // Permission errors or broken symlinks — skip silently
          })
          .finally(() => {
            active.delete(path);
            completed++;
            if (completed === totalTasks && active.size === 0) {
              resolve({ size: totalSize, fileCount });
            } else {
              processNext();
            }
          });
      }

      // If queue is empty but tasks might still be pending
      if (queue.length === 0 && active.size === 0 && completed === totalTasks) {
        resolve({ size: totalSize, fileCount });
      }
    }

    processNext();
  });
}

/**
 * Get the last modified time of a directory (recursive — checks all files).
 * Uses sampling for performance on large directories.
 * @param {string} dirPath
 * @returns {Promise<Date>}
 */
export async function getLastModified(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let latestMtime = (await stat(dirPath)).mtime;

    // Sample up to 20 entries for performance
    const sample = entries.slice(0, 20);
    for (const entry of sample) {
      try {
        const fullPath = join(dirPath, entry.name);
        const s = await stat(fullPath);
        if (s.mtime > latestMtime) {
          latestMtime = s.mtime;
        }
      } catch {
        // skip
      }
    }
    return latestMtime;
  } catch {
    return new Date(0);
  }
}
