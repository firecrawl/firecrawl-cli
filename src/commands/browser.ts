/**
 * Browser command implementation
 * Manages cloud browser sessions via the Firecrawl SDK
 */

import { spawn } from 'child_process';
import { getClient } from '../utils/client';
import {
  saveBrowserSession,
  loadBrowserSession,
  clearBrowserSession,
  getSessionId,
} from '../utils/browser-session';
import { writeOutput } from '../utils/output';

export interface BrowserLaunchOptions {
  ttl?: number;
  ttlInactivity?: number;
  stream?: boolean;
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  json?: boolean;
}

export interface BrowserExecuteOptions {
  code: string;
  language?: 'python' | 'node' | 'bash';
  session?: string;
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  json?: boolean;
}

export interface BrowserListOptions {
  status?: 'active' | 'destroyed';
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  json?: boolean;
}

export interface BrowserCloseOptions {
  session?: string;
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  json?: boolean;
}

/**
 * Launch a new browser session
 */
export async function handleBrowserLaunch(
  options: BrowserLaunchOptions
): Promise<void> {
  try {
    const app = getClient({ apiKey: options.apiKey, apiUrl: options.apiUrl });

    const args: {
      ttl?: number;
      activityTtl?: number;
      streamWebView?: boolean;
    } = {};
    if (options.ttl !== undefined) args.ttl = options.ttl;
    if (options.ttlInactivity !== undefined)
      args.activityTtl = options.ttlInactivity;
    if (options.stream !== undefined) args.streamWebView = options.stream;

    const data = await app.browser(args);

    if (!data.success) {
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    // Save session for future commands
    saveBrowserSession({
      id: data.id!,
      cdpUrl: data.cdpUrl!,
      createdAt: new Date().toISOString(),
    });

    if (options.json) {
      const output = JSON.stringify(data, null, 2);
      writeOutput(output, options.output, !!options.output);
    } else {
      const lines: string[] = [];
      lines.push(`Session ID:    ${data.id}`);
      lines.push(`CDP URL:       ${data.cdpUrl}`);
      if (data.liveViewUrl) {
        lines.push(`Live View URL: ${data.liveViewUrl}`);
      }
      writeOutput(lines.join('\n'), options.output, !!options.output);
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
    process.exit(1);
  }
}

/**
 * Execute a bash command locally with CDP_URL and SESSION_ID env vars.
 * Auto-injects --cdp for agent-browser commands.
 */
export function executeBashLocally(
  command: string,
  session: { id: string; cdpUrl: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    // Auto-inject --cdp for agent-browser commands
    let finalCommand = command;
    if (command.startsWith('agent-browser') && !command.includes('--cdp')) {
      const parts = command.split(' ');
      // Insert --cdp after "agent-browser <subcommand>"
      const insertIdx = Math.min(2, parts.length);
      parts.splice(insertIdx, 0, '--cdp', `'${session.cdpUrl}'`);
      finalCommand = parts.join(' ');
    }

    const child = spawn('sh', ['-c', finalCommand], {
      env: {
        ...process.env,
        CDP_URL: session.cdpUrl,
        SESSION_ID: session.id,
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

/**
 * Detect if an error indicates an expired or destroyed browser session.
 */
function isSessionExpiredError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  const status = (error as { status?: number }).status;
  if (status === 410 || status === 404) return true;
  return /destroyed|expired|not found|gone|session.*closed/i.test(msg);
}

/**
 * Execute code in a browser session
 */
export async function handleBrowserExecute(
  options: BrowserExecuteOptions
): Promise<void> {
  // Bash execution runs locally — skip the API entirely
  if (options.language === 'bash') {
    try {
      let session: { id: string; cdpUrl: string } | null = null;

      if (options.session) {
        const stored = loadBrowserSession();
        if (stored && stored.id === options.session) {
          session = stored;
        } else {
          // Fetch CDP URL from the API for the specified session
          const app = getClient({
            apiKey: options.apiKey,
            apiUrl: options.apiUrl,
          });
          const list = await app.listBrowsers({ status: 'active' });
          const match = list.sessions?.find(
            (s: { id: string }) => s.id === options.session
          );
          if (match && match.cdpUrl) {
            session = { id: match.id, cdpUrl: match.cdpUrl };
          } else {
            console.error(
              `Error: Session ${options.session} not found or not active.`
            );
            process.exit(1);
            return;
          }
        }
      } else {
        session = loadBrowserSession();
      }

      if (!session) {
        console.error(
          'Error: No active browser session. Run `firecrawl browser launch` first.'
        );
        process.exit(1);
        return;
      }

      const result = await executeBashLocally(options.code, session);

      if (result.exitCode !== 0) {
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.stdout) process.stdout.write(result.stdout);
        process.exit(1);
      }

      if (options.json) {
        const data = {
          success: true,
          result: result.stdout.trimEnd(),
          exitCode: result.exitCode,
        };
        const output = JSON.stringify(data, null, 2);
        writeOutput(output, options.output, !!options.output);
      } else {
        if (result.stdout) {
          writeOutput(
            result.stdout.trimEnd(),
            options.output,
            !!options.output
          );
        }
      }
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      process.exit(1);
    }

    return;
  }

  try {
    const sessionId = getSessionId(options.session);
    const app = getClient({ apiKey: options.apiKey, apiUrl: options.apiUrl });

    const data = await app.browserExecute(sessionId, {
      code: options.code,
      language: options.language || 'python',
    });

    if (!data.success) {
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    if (data.error) {
      // Execution succeeded but code had an error
      process.stderr.write(`Code error: ${data.error}\n`);
    }

    if (options.json) {
      const output = JSON.stringify(data, null, 2);
      writeOutput(output, options.output, !!options.output);
    } else {
      if (data.result !== undefined && data.result !== '') {
        writeOutput(data.result, options.output, !!options.output);
      }
    }
  } catch (error) {
    if (isSessionExpiredError(error)) {
      const sessionId =
        options.session || loadBrowserSession()?.id || 'unknown';
      console.error(
        `Error: Session ${sessionId} has expired or been destroyed.\n` +
          'The session may have exceeded its TTL or been closed.\n' +
          'Start a new session with: firecrawl browser launch'
      );
      // Clear stale stored session
      const stored = loadBrowserSession();
      if (stored && !options.session) {
        clearBrowserSession();
      }
    } else {
      console.error(
        'Error:',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
    process.exit(1);
  }
}

/**
 * List browser sessions
 */
export async function handleBrowserList(
  options: BrowserListOptions
): Promise<void> {
  try {
    const app = getClient({ apiKey: options.apiKey, apiUrl: options.apiUrl });

    const data = await app.listBrowsers(
      options.status ? { status: options.status } : undefined
    );

    if (!data.success) {
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    const sessions = data.sessions || [];

    if (options.json) {
      const output = JSON.stringify(data, null, 2);
      writeOutput(output, options.output, !!options.output);
    } else {
      if (sessions.length === 0) {
        writeOutput(
          'No active browser sessions.',
          options.output,
          !!options.output
        );
      } else {
        const lines: string[] = [];
        for (const s of sessions) {
          const age = s.createdAt
            ? `created ${new Date(s.createdAt).toLocaleString()}`
            : '';
          lines.push(`${s.id}  ${s.status}  ${age}`);
        }
        writeOutput(lines.join('\n'), options.output, !!options.output);
      }
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
    process.exit(1);
  }
}

/**
 * Close a browser session
 */
export async function handleBrowserClose(
  options: BrowserCloseOptions
): Promise<void> {
  try {
    const sessionId = getSessionId(options.session);
    const app = getClient({ apiKey: options.apiKey, apiUrl: options.apiUrl });

    const data = await app.deleteBrowser(sessionId);

    if (!data.success) {
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    // Clear stored session
    const stored = loadBrowserSession();
    if (stored && stored.id === sessionId) {
      clearBrowserSession();
    }

    console.log(`Session closed (${sessionId})`);

    if (options.json) {
      const output = JSON.stringify({ success: true, id: sessionId }, null, 2);
      writeOutput(output, options.output, !!options.output);
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
    process.exit(1);
  }
}
