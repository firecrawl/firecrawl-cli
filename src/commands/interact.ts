/**
 * Interact command implementation
 * Execute AI prompts or code against a scraped page in a live browser session
 */

import { getClient } from '../utils/client';
import { getConfig, validateConfig } from '../utils/config';
import {
  getScrapeId,
  loadInteractSession,
  clearInteractSession,
} from '../utils/interact-session';
import { writeOutput } from '../utils/output';

export interface InteractExecuteOptions {
  scrapeId?: string;
  prompt?: string;
  code?: string;
  language?: 'python' | 'node' | 'bash';
  timeout?: number;
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  json?: boolean;
}

export interface InteractStopOptions {
  scrapeId?: string;
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  json?: boolean;
}

function resolveApiConfig(options: { apiKey?: string; apiUrl?: string }) {
  if (options.apiKey || options.apiUrl) {
    getClient({ apiKey: options.apiKey, apiUrl: options.apiUrl });
  }
  const config = getConfig();
  const apiKey = options.apiKey || config.apiKey;
  validateConfig(apiKey);
  const apiUrl = options.apiUrl || config.apiUrl || 'https://api.firecrawl.dev';
  return { apiKey: apiKey!, apiUrl: apiUrl.replace(/\/$/, '') };
}

/**
 * Execute a prompt or code in an interactive browser session bound to a scrape
 */
export async function handleInteractExecute(
  options: InteractExecuteOptions
): Promise<void> {
  try {
    const scrapeId = getScrapeId(options.scrapeId);
    const { apiKey, apiUrl } = resolveApiConfig(options);

    const stored = loadInteractSession();
    if (!options.scrapeId && stored) {
      process.stderr.write(
        `Using scrape ${scrapeId}` +
          (stored.url ? ` (${stored.url})` : '') +
          '\n'
      );
    }

    const body: Record<string, unknown> = { origin: 'cli', integration: 'cli' };

    if (options.code) {
      body.code = options.code;
      body.language = options.language || 'node';
    } else if (options.prompt) {
      body.prompt = options.prompt;
    }

    if (options.timeout !== undefined) body.timeout = options.timeout;

    const url = `${apiUrl}/v2/scrape/${scrapeId}/interact`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as any).error ||
          `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as Record<string, any>;

    if (!data.success) {
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    if (options.json) {
      const output = JSON.stringify(data, null, 2);
      writeOutput(output, options.output, !!options.output);
      return;
    }

    if (data.liveViewUrl) {
      process.stderr.write(`Live View: ${data.liveViewUrl}\n`);
    }
    if (data.interactiveLiveViewUrl) {
      process.stderr.write(
        `Interactive Live View: ${data.interactiveLiveViewUrl}\n`
      );
    }

    if (options.prompt && data.output) {
      writeOutput(data.output, options.output, !!options.output);
    } else {
      const result = data.stdout || data.result || '';
      if (result) {
        writeOutput(result.trimEnd(), options.output, !!options.output);
      }
    }

    if (data.stderr) {
      process.stderr.write(data.stderr);
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
 * Stop an interactive browser session bound to a scrape
 */
export async function handleInteractStop(
  options: InteractStopOptions
): Promise<void> {
  try {
    const scrapeId = getScrapeId(options.scrapeId);
    const { apiKey, apiUrl } = resolveApiConfig(options);

    const url = `${apiUrl}/v2/scrape/${scrapeId}/interact`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as any).error ||
          `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as Record<string, any>;

    if (!data.success) {
      console.error('Error:', data.error || 'Unknown error');
      process.exit(1);
    }

    // Clear the stored session
    const stored = loadInteractSession();
    if (stored && stored.scrapeId === scrapeId) {
      clearInteractSession();
    }

    if (options.json) {
      const output = JSON.stringify(data, null, 2);
      writeOutput(output, options.output, !!options.output);
    } else {
      const lines: string[] = [`Session stopped (${scrapeId})`];
      if (data.sessionDurationMs !== undefined) {
        const seconds = (data.sessionDurationMs / 1000).toFixed(1);
        lines.push(`Duration: ${seconds}s`);
      }
      if (data.creditsBilled !== undefined) {
        lines.push(`Credits billed: ${data.creditsBilled}`);
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
