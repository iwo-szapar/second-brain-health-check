/**
 * Single source of truth for the package version.
 * Reads from package.json at runtime using createRequire (ESM-safe).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export const VERSION = pkg.version;
