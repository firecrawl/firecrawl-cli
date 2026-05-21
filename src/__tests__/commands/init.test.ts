import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'child_process';
import { handleInitCommand } from '../../commands/init';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('handleInitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs skills from all repos globally across all detected agents in non-interactive mode', async () => {
    await handleInitCommand({
      yes: true,
      skipInstall: true,
      skipAuth: true,
    });

    expect(execSync).toHaveBeenCalledWith(
      'npx -y skills add firecrawl/cli --full-depth --global --all --yes',
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
    expect(execSync).toHaveBeenCalledWith(
      'npx -y skills add firecrawl/skills --full-depth --global --all --yes',
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
    expect(execSync).toHaveBeenCalledWith(
      'npx -y skills add firecrawl/firecrawl-workflows --full-depth --global --all --yes',
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
  });

  it('scopes non-interactive skills install to one agent across all repos when provided', async () => {
    await handleInitCommand({
      yes: true,
      skipInstall: true,
      skipAuth: true,
      agent: 'cursor',
    });

    expect(execSync).toHaveBeenCalledWith(
      'npx -y skills add firecrawl/cli --full-depth --global --yes --agent cursor',
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
    expect(execSync).toHaveBeenCalledWith(
      'npx -y skills add firecrawl/skills --full-depth --global --yes --agent cursor',
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
    expect(execSync).toHaveBeenCalledWith(
      'npx -y skills add firecrawl/firecrawl-workflows --full-depth --global --yes --agent cursor',
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
  });
});
