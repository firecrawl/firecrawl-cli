/**
 * ACP agent registry — detect installed ACP-compatible agents.
 */

import { execSync } from 'child_process';

export interface ACPAgent {
  name: string;
  bin: string;
  displayName: string;
  available: boolean;
}

const KNOWN_AGENTS: Omit<ACPAgent, 'available'>[] = [
  { name: 'claude', bin: 'claude-agent-acp', displayName: 'Claude Code' },
  { name: 'codex', bin: 'codex-acp', displayName: 'Codex' },
  { name: 'gemini', bin: 'gemini', displayName: 'Gemini CLI' },
  { name: 'opencode', bin: 'opencode', displayName: 'OpenCode' },
  { name: 'goose', bin: 'goose', displayName: 'Goose' },
  { name: 'kimi', bin: 'kimi', displayName: 'Kimi CLI' },
  { name: 'augment', bin: 'augment', displayName: 'Augment Code' },
];

function isBinAvailable(bin: string): boolean {
  try {
    execSync(`which ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function detectAgents(): ACPAgent[] {
  return KNOWN_AGENTS.map((a) => ({
    ...a,
    available: isBinAvailable(a.bin),
  }));
}
