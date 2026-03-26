/**
 * Lightweight TUI for the Firecrawl agent — no dependencies.
 *
 * Shows:
 * - Agent text streaming to stdout
 * - Tool calls as start/done lines (only firecrawl ops)
 * - A persistent status bar on the last line: session | agent | credits | time | format
 */

import type { ToolCallInfo } from './client';

// ─── ANSI helpers ───────────────────────────────────────────────────────────

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const SAVE = '\x1b[s';
const RESTORE = '\x1b[u';
const CLEAR_LINE = '\x1b[2K';

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

// ─── Status bar ─────────────────────────────────────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface TUIState {
  pending: Map<string, string>;
  credits: number;
  startedAt: number;
  sessionId: string;
  agentName: string;
  format: string;
  sessionDir: string;
  spinnerFrame: number;
  statusVisible: boolean;
  interval: ReturnType<typeof setInterval> | null;
}

function formatStatusBar(state: TUIState): string {
  const elapsed = Math.round((Date.now() - state.startedAt) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const time = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const fmt = state.format.toUpperCase();
  const active = state.pending.size;

  const spinner =
    active > 0 ? `${YELLOW}${SPINNER[state.spinnerFrame]}${RESET} ` : '';

  return (
    `${DIM}─${RESET} ` +
    `${spinner}` +
    `${BOLD}${state.sessionId}${RESET}` +
    `${DIM} · ${RESET}${state.agentName}` +
    `${DIM} · ${RESET}${CYAN}${state.credits} credits${RESET}` +
    `${DIM} · ${RESET}${time}` +
    `${DIM} · ${RESET}${YELLOW}${fmt}${RESET}` +
    (active > 0 ? `${DIM} · ${RESET}${active} active` : '')
  );
}

function writeStatusBar(state: TUIState): void {
  // Move to bottom, write status, restore cursor
  const rows = process.stdout.rows || 24;
  process.stderr.write(
    `${SAVE}\x1b[${rows};0H${CLEAR_LINE}${formatStatusBar(state)}${RESTORE}`
  );
  state.statusVisible = true;
}

function clearStatusBar(state: TUIState): void {
  if (!state.statusVisible) return;
  const rows = process.stdout.rows || 24;
  process.stderr.write(`${SAVE}\x1b[${rows};0H${CLEAR_LINE}${RESTORE}`);
  state.statusVisible = false;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface TUIHandle {
  onText: (text: string) => void;
  onToolCall: (call: ToolCallInfo) => void;
  onToolCallUpdate: (call: ToolCallInfo) => void;
  addCredits: (n: number) => void;
  /** Call before user input prompts */
  pause: () => void;
  /** Call after user input to resume */
  resume: () => void;
  /** Final cleanup */
  cleanup: () => void;
}

export function startTUI(opts: {
  sessionId: string;
  agentName: string;
  format: string;
  sessionDir: string;
}): TUIHandle {
  const state: TUIState = {
    pending: new Map(),
    credits: 0,
    startedAt: Date.now(),
    sessionId: opts.sessionId,
    agentName: opts.agentName,
    format: opts.format,
    sessionDir: opts.sessionDir,
    spinnerFrame: 0,
    statusVisible: false,
    interval: null,
  };

  // Reserve bottom line by setting scroll region
  const rows = process.stdout.rows || 24;
  process.stderr.write(`\x1b[1;${rows - 1}r`); // scroll region = all but last line

  // Start status bar ticker
  state.interval = setInterval(() => {
    state.spinnerFrame = (state.spinnerFrame + 1) % SPINNER.length;
    writeStatusBar(state);
  }, 80);

  // Initial render
  writeStatusBar(state);

  return {
    onText(text: string) {
      process.stdout.write(text);
    },

    onToolCall(call: ToolCallInfo) {
      const label = describeCall(call, state.sessionDir);
      if (!label) return;
      state.pending.set(call.id, label);
      process.stderr.write(`  ${DIM}·${RESET} ${label}\n`);
    },

    onToolCallUpdate(call: ToolCallInfo) {
      if (!state.pending.has(call.id)) return;
      const label = state.pending.get(call.id)!;
      if (call.status === 'completed' || call.status === 'errored') {
        state.pending.delete(call.id);
        const icon =
          call.status === 'completed' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
        process.stderr.write(`  ${icon} ${label}\n`);
      }
    },

    addCredits(n: number) {
      state.credits += n;
    },

    pause() {
      // Stop ticker and clear status bar for user input
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
      }
      clearStatusBar(state);
      // Reset scroll region to full terminal
      const r = process.stdout.rows || 24;
      process.stderr.write(`\x1b[1;${r}r`);
    },

    resume() {
      // Re-reserve bottom line and restart ticker
      const r = process.stdout.rows || 24;
      process.stderr.write(`\x1b[1;${r - 1}r`);
      state.interval = setInterval(() => {
        state.spinnerFrame = (state.spinnerFrame + 1) % SPINNER.length;
        writeStatusBar(state);
      }, 80);
      writeStatusBar(state);
    },

    cleanup() {
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
      }
      clearStatusBar(state);
      // Reset scroll region
      const r = process.stdout.rows || 24;
      process.stderr.write(`\x1b[1;${r}r`);
    },
  };
}
