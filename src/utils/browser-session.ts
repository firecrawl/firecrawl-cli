/**
 * Browser session persistence utility
 * Stores active browser session info in platform-specific config directory
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface StoredBrowserSession {
  id: string;
  cdpUrl: string;
  createdAt: string;
}

/**
 * Get the platform-specific config directory
 */
function getConfigDir(): string {
  const homeDir = os.homedir();
  const platform = os.platform();

  switch (platform) {
    case 'darwin':
      return path.join(
        homeDir,
        'Library',
        'Application Support',
        'firecrawl-cli'
      );
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', 'firecrawl-cli');
    default:
      return path.join(homeDir, '.config', 'firecrawl-cli');
  }
}

/**
 * Get the browser session file path
 */
function getSessionPath(): string {
  return path.join(getConfigDir(), 'browser-session.json');
}

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Save active browser session to disk
 */
export function saveBrowserSession(session: StoredBrowserSession): void {
  ensureConfigDir();
  const sessionPath = getSessionPath();
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
}

/**
 * Load stored browser session from disk
 */
export function loadBrowserSession(): StoredBrowserSession | null {
  try {
    const sessionPath = getSessionPath();
    if (!fs.existsSync(sessionPath)) {
      return null;
    }
    const data = fs.readFileSync(sessionPath, 'utf-8');
    return JSON.parse(data) as StoredBrowserSession;
  } catch {
    return null;
  }
}

/**
 * Clear stored browser session from disk
 */
export function clearBrowserSession(): void {
  try {
    const sessionPath = getSessionPath();
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Resolve session ID from override flag or stored session
 */
export function getSessionId(overrideId?: string): string {
  if (overrideId) return overrideId;

  const stored = loadBrowserSession();
  if (stored) return stored.id;

  throw new Error(
    'No active browser session. Launch one with: firecrawl browser launch\n' +
      'Or specify a session ID with: --session <id>'
  );
}
