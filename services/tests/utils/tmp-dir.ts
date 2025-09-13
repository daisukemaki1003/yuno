import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { TEST_DIR } from '../setup.js';

/**
 * Create a temporary directory for a test
 * @param prefix - Prefix for the directory name
 * @returns Path to the created directory
 */
export function createTempDir(prefix: string = 'test'): string {
  const dirName = `${prefix}-${randomBytes(4).toString('hex')}`;
  const dirPath = join(TEST_DIR, dirName);
  
  mkdirSync(dirPath, { recursive: true });
  
  return dirPath;
}

/**
 * Clean up a temporary directory
 * @param dirPath - Path to the directory to clean up
 */
export function cleanupTempDir(dirPath: string): void {
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Create a temporary directory that's automatically cleaned up after the test
 * @param prefix - Prefix for the directory name
 * @returns Object with the directory path and cleanup function
 */
export function useTempDir(prefix: string = 'test'): {
  path: string;
  cleanup: () => void;
} {
  let dirPath: string;
  
  beforeEach(() => {
    dirPath = createTempDir(prefix);
  });
  
  afterEach(() => {
    if (dirPath) {
      cleanupTempDir(dirPath);
    }
  });
  
  return {
    get path() {
      return dirPath;
    },
    cleanup: () => cleanupTempDir(dirPath),
  };
}