/**
 * Firecrawl agent display — inline terminal output, no ANSI tricks.
 *
 * Prints tool calls and status summaries in the normal terminal flow.
 * Works in any terminal, pipeable, agent-friendly.
 */

import type { ToolCallInfo } from './client';

// ─── Dim helper (only if TTY) ───────────────────────────────────────────────

const isTTY = process.stderr.isTTY;
const dim = (s: string) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s);

// ─── Tool call label extraction ─────────────────────────────────────────────

function extractUrl(cmd: string, prefix: string): string | null {
  const quoted = cmd.match(
    new RegExp(`${prefix}\\s+["'](https?://[^"']+)["']`)
  );
  if (quoted) return quoted[1];
  const parts = cmd.replace(new RegExp(`^${prefix}\\s*`), '').split(/\s+/);
  for (const part of parts) {
    const clean = part.replace(/^["']|["']$/g, '');
    if (clean.startsWith('http')) return clean;
  }
  return null;
}

function describeCall(call: ToolCallInfo, sessionDir: string): string | null {
  const input = call.rawInput as Record<string, unknown> | undefined;

  if (input?.command && typeof input.command === 'string') {
    const cmd = input.command.trim();

    if (cmd.startsWith('firecrawl search')) {
      const match = cmd.match(/firecrawl search\s+["']([^"']+)["']/);
      if (match) return `Searching "${match[1]}"`;
      return 'Searching';
    }
    if (cmd.startsWith('firecrawl scrape')) {
      const url = extractUrl(cmd, 'firecrawl scrape');
      return url ? `Scraping ${url}` : null;
    }
    if (cmd.startsWith('firecrawl map')) {
      const url = extractUrl(cmd, 'firecrawl map');
      return url ? `Mapping ${url}` : null;
    }
    if (cmd.startsWith('firecrawl crawl')) {
      const url = extractUrl(cmd, 'firecrawl crawl');
      return url ? `Crawling ${url}` : null;
    }
    if (cmd.startsWith('firecrawl agent')) {
      return 'Running extraction agent';
    }
    return null;
  }

  if (input?.path && typeof input.path === 'string') {
    if (
      input.path.startsWith(sessionDir) &&
      call.title.toLowerCase().includes('write')
    ) {
      const basename = input.path.split('/').pop() || input.path;
      return `Writing ${basename}`;
    }
    return null;
  }

  return null;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface TUIHandle {
  onText: (text: string) => void;
  onToolCall: (call: ToolCallInfo) => void;
  onToolCallUpdate: (call: ToolCallInfo) => void;
  addCredits: (n: number) => void;
  /** Print a status summary line */
  printStatus: () => void;
  pause: () => void;
  resume: () => void;
  cleanup: () => void;
}

export function startTUI(opts: {
  sessionId: string;
  agentName: string;
  format: string;
  sessionDir: string;
}): TUIHandle {
  const pending = new Map<string, string>();
  let credits = 0;
  const startedAt = Date.now();

  function elapsed(): string {
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function statusLine(): string {
    const fmt = opts.format.toUpperCase();
    return dim(
      `── ${opts.sessionId} · ${opts.agentName} · ${credits} credits · ${elapsed()} · ${fmt}`
    );
  }

  return {
    onText(text: string) {
      process.stdout.write(text);
    },

    onToolCall(call: ToolCallInfo) {
      const label = describeCall(call, opts.sessionDir);
      if (!label) return;
      pending.set(call.id, label);
      process.stderr.write(`  ${dim('·')} ${label}\n`);
    },

    onToolCallUpdate(call: ToolCallInfo) {
      if (!pending.has(call.id)) return;
      const label = pending.get(call.id)!;
      if (call.status === 'completed' || call.status === 'errored') {
        pending.delete(call.id);
        const icon = call.status === 'completed' ? green('✓') : red('✗');
        process.stderr.write(`  ${icon} ${label}\n`);
      }
    },

    addCredits(n: number) {
      credits += n;
    },

    printStatus() {
      process.stderr.write(`\n${statusLine()}\n\n`);
    },

    pause() {
      // Print status before handing to user input
      process.stderr.write(`\n${statusLine()}\n`);
    },

    resume() {
      // Nothing to do — we print inline
    },

    cleanup() {
      // Final status
      process.stderr.write(`\n${statusLine()}\n`);
    },
  };
}
