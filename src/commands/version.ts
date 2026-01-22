/**
 * Version command implementation
 * Displays the CLI version and optionally auth status
 */

import packageJson from '../../package.json';
import { isAuthenticated } from '../utils/auth';

export interface VersionOptions {
  authStatus?: boolean;
}

/**
 * Display version information
 */
export function handleVersionCommand(options: VersionOptions = {}): void {
  console.log(`version: ${packageJson.version}`);

  if (options.authStatus) {
    const authenticated = isAuthenticated();
    console.log(`authenticated: ${authenticated}`);
  }
}
