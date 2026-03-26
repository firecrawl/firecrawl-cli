/**
 * Firecrawl Agent TUI — ink-based terminal UI for active turns.
 *
 * Renders a status bar while the agent is working, with credits,
 * elapsed time, and active tool calls. Unmounts between turns
 * so inquirer prompts work normally.
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text, Static } from 'ink';
import type { ToolCallInfo } from './client.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToolCallDisplay {
  id: string;
  label: string;
  status: 'active' | 'done' | 'error';
  startedAt: number;
}

// ─── Spinner ────────────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function Spinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <Text color="yellow">{FRAMES[frame]}</Text>;
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

function StatusBar({
  sessionId,
  agentName,
  credits,
  startedAt,
  outputFormat,
}: {
  sessionId: string;
  agentName: string;
  credits: number;
  startedAt: number;
  outputFormat: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const time = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold>{sessionId}</Text>
      <Text color="gray"> | </Text>
      <Text>{agentName}</Text>
      <Text color="gray"> | </Text>
      <Text color="cyan">{credits} credits</Text>
      <Text color="gray"> | </Text>
      <Text>{time}</Text>
      <Text color="gray"> | </Text>
      <Text color="yellow">{outputFormat.toUpperCase()}</Text>
    </Box>
  );
}

// ─── Tool Call Lines ────────────────────────────────────────────────────────

function ToolCallLine({ call }: { call: ToolCallDisplay }) {
  return (
    <Box>
      <Text>  </Text>
      {call.status === 'active' ? (
        <Spinner />
      ) : call.status === 'done' ? (
        <Text color="green">✓</Text>
      ) : (
        <Text color="red">✗</Text>
      )}
      <Text> {call.label}</Text>
    </Box>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

function App({
  stateRef,
}: {
  stateRef: { current: TUIState };
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    stateRef.current.rerender = () => setTick((t) => t + 1);
    return () => {
      stateRef.current.rerender = null;
    };
  }, []);

  const s = stateRef.current;

  // Completed and active tool calls
  const completed = s.toolCalls.filter((t) => t.status !== 'active');
  const active = s.toolCalls.filter((t) => t.status === 'active');

  return (
    <Box flexDirection="column">
      {/* Completed tool calls — static, won't re-render */}
      <Static items={completed}>
        {(call) => <ToolCallLine key={call.id} call={call} />}
      </Static>

      {/* Active tool calls — animated spinners */}
      {active.map((call) => (
        <ToolCallLine key={call.id} call={call} />
      ))}

      {/* Status bar */}
      <StatusBar
        sessionId={s.sessionId}
        agentName={s.agentName}
        credits={s.credits}
        startedAt={s.startedAt}
        outputFormat={s.outputFormat}
      />
    </Box>
  );
}

// ─── State + Controller ─────────────────────────────────────────────────────

interface TUIState {
  toolCalls: ToolCallDisplay[];
  credits: number;
  startedAt: number;
  sessionId: string;
  agentName: string;
  outputFormat: string;
  rerender: (() => void) | null;
}

/** Extract a display label from a tool call, or null to hide it. */
function describeCall(
  call: ToolCallInfo,
  sessionDir: string
): string | null {
  const input = call.rawInput as Record<string, unknown> | undefined;

  if (input?.command && typeof input.command === 'string') {
    const cmd = input.command.trim();

    if (cmd.startsWith('firecrawl search')) {
      const match = cmd.match(/firecrawl search\s+["']([^"']+)["']/);
      if (match) return `Searching "${match[1]}"`;
      return 'Searching';
    }
    if (cmd.startsWith('firecrawl scrape')) {
      const m = cmd.match(/["'](https?:\/\/[^"']+)["']/) || cmd.match(/(https?:\/\/\S+)/);
      if (m) return `Scraping ${m[1]}`;
      return null;
    }
    if (cmd.startsWith('firecrawl map')) {
      const m = cmd.match(/["'](https?:\/\/[^"']+)["']/) || cmd.match(/(https?:\/\/\S+)/);
      if (m) return `Mapping ${m[1]}`;
      return null;
    }
    if (cmd.startsWith('firecrawl crawl')) {
      const m = cmd.match(/["'](https?:\/\/[^"']+)["']/) || cmd.match(/(https?:\/\/\S+)/);
      if (m) return `Crawling ${m[1]}`;
      return null;
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
  /** Write agent text above the status bar */
  writeText: (text: string) => void;
  /** Register a new tool call */
  onToolCall: (call: ToolCallInfo) => void;
  /** Update tool call status */
  onToolCallUpdate: (call: ToolCallInfo) => void;
  /** Add credits */
  addCredits: (n: number) => void;
  /** Unmount the TUI (call between turns for user input) */
  unmount: () => void;
  /** Remount the TUI (call after user input to resume) */
  remount: () => void;
}

export function startTUI(opts: {
  sessionId: string;
  agentName: string;
  outputFormat: string;
  sessionDir: string;
}): TUIHandle {
  const stateRef: { current: TUIState } = {
    current: {
      toolCalls: [],
      credits: 0,
      startedAt: Date.now(),
      sessionId: opts.sessionId,
      agentName: opts.agentName,
      outputFormat: opts.outputFormat,
      rerender: null,
    },
  };

  let inkInstance = render(<App stateRef={stateRef} />);

  function update() {
    if (stateRef.current.rerender) stateRef.current.rerender();
  }

  return {
    writeText(text: string) {
      // Write text above ink's managed area
      process.stdout.write(text);
    },

    onToolCall(call: ToolCallInfo) {
      const label = describeCall(call, opts.sessionDir);
      if (!label) return;
      stateRef.current.toolCalls.push({
        id: call.id,
        label,
        status: 'active',
        startedAt: Date.now(),
      });
      update();
    },

    onToolCallUpdate(call: ToolCallInfo) {
      const existing = stateRef.current.toolCalls.find((t) => t.id === call.id);
      if (!existing) return;
      if (call.status === 'completed') existing.status = 'done';
      else if (call.status === 'errored') existing.status = 'error';
      update();
    },

    addCredits(n: number) {
      stateRef.current.credits += n;
      update();
    },

    unmount() {
      inkInstance.unmount();
    },

    remount() {
      // Reset tool calls for the new turn, keep credits and timer
      stateRef.current.toolCalls = [];
      inkInstance = render(<App stateRef={stateRef} />);
    },
  };
}
