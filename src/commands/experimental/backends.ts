/**
 * Backend definitions for AI workflow agents.
 *
 * Each backend (Claude Code, Codex, OpenCode) has its own CLI binary,
 * argument builder, and spawn configuration.
 */

import { spawn } from 'child_process';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Backend = 'claude' | 'codex' | 'opencode';

export interface BackendConfig {
  bin: string;
  displayName: string;
  installHint: string;
  buildArgs: (
    systemPrompt: string,
    userMessage: string,
    skipPermissions: boolean
  ) => string[];
}

// ─── Backend registry ───────────────────────────────────────────────────────

export const BACKENDS: Record<Backend, BackendConfig> = {
  claude: {
    bin: 'claude',
    displayName: 'Claude Code',
    installHint: 'npm install -g @anthropic-ai/claude-code',
    buildArgs: (systemPrompt, userMessage, skipPermissions) => {
      const args = ['--append-system-prompt', systemPrompt];
      if (skipPermissions) args.push('--dangerously-skip-permissions');
      args.push(userMessage);
      return args;
    },
  },
  codex: {
    bin: 'codex',
    displayName: 'Codex',
    installHint: 'npm install -g @openai/codex',
    buildArgs: (systemPrompt, userMessage, skipPermissions) => {
      const args: string[] = [];
      if (skipPermissions) args.push('--full-auto');
      // Codex takes the prompt as a positional arg; system prompt via config override
      args.push('--config', `instructions=${systemPrompt}`);
      args.push(userMessage);
      return args;
    },
  },
  opencode: {
    bin: 'opencode',
    displayName: 'OpenCode',
    installHint: 'See https://opencode.ai/docs/cli/',
    buildArgs: (systemPrompt, userMessage, skipPermissions) => {
      const args = ['run', '--prompt', systemPrompt];
      args.push(userMessage);
      return args;
    },
  },
};

// ─── Launch helper ──────────────────────────────────────────────────────────

/**
 * Launch an interactive agent session
 */
export function launchAgent(
  backend: Backend,
  systemPrompt: string,
  userMessage: string,
  skipPermissions: boolean
): void {
  const config = BACKENDS[backend];
  const args = config.buildArgs(systemPrompt, userMessage, skipPermissions);

  const child = spawn(config.bin, args, {
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(
        `\nError: ${config.displayName} CLI not found. Install it with:\n\n  ${config.installHint}\n`
      );
    } else {
      console.error(`Error launching ${config.displayName}:`, error.message);
    }
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
