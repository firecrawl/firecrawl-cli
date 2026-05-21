/**
 * Setup command implementation
 * Installs firecrawl skill files and MCP server into AI coding agents
 */

import { execSync } from 'child_process';
import { getApiKey } from '../utils/config';
import {
  buildSkillsInstallArgs,
  cleanNpmEnv,
  SKILL_REPOS,
  WORKFLOW_SKILL_REPOS,
} from './skills-install';
import { hasNpx, installSkillsNative } from './skills-native';

export type SetupSubcommand = 'skills' | 'workflows' | 'mcp';

export interface SetupOptions {
  global?: boolean;
  agent?: string;
}

/**
 * Main setup command handler
 */
export async function handleSetupCommand(
  subcommand: SetupSubcommand,
  options: SetupOptions = {}
): Promise<void> {
  switch (subcommand) {
    case 'skills':
      await installSkills(options, SKILL_REPOS);
      break;
    case 'workflows':
      await installSkills(options, WORKFLOW_SKILL_REPOS);
      break;
    case 'mcp':
      await installMcp(options);
      break;
    default:
      console.error(`Unknown setup subcommand: ${subcommand}`);
      console.log('\nAvailable subcommands:');
      console.log(
        '  skills     Install core/build Firecrawl skills into AI coding agents'
      );
      console.log(
        '  workflows  Install Firecrawl workflow skills into AI coding agents'
      );
      console.log(
        '  mcp        Install firecrawl MCP server into editors (Cursor, Claude Code, VS Code, etc.)'
      );
      process.exit(1);
  }
}

async function installSkills(
  options: SetupOptions,
  repos: readonly string[]
): Promise<void> {
  for (const repo of repos) {
    if (hasNpx()) {
      const args = buildSkillsInstallArgs({
        repo,
        agent: options.agent,
        global: true,
        includeNpxYes: true,
      });

      const cmd = args.join(' ');
      console.log(`Running: ${cmd}\n`);

      try {
        execSync(cmd, { stdio: 'inherit', env: cleanNpmEnv() });
        continue;
      } catch {
        process.exit(1);
      }
    }

    // Fallback: native install (no npx/Node required)
    try {
      await installSkillsNative(repo);
    } catch (error) {
      console.error(
        `Failed to install skills from ${repo}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }
}

async function installMcp(options: SetupOptions): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error(
      'No API key found. Please run `firecrawl login` first, or set FIRECRAWL_API_KEY.'
    );
    process.exit(1);
  }

  const args = [
    'npx',
    'add-mcp',
    `"npx -y firecrawl-mcp"`,
    '--name',
    'firecrawl',
  ];

  if (options.global) {
    args.push('--global');
  }

  if (options.agent) {
    args.push('--agent', options.agent);
  }

  const cmd = args.join(' ');
  console.log(`Running: ${cmd}\n`);

  try {
    execSync(cmd, {
      stdio: 'inherit',
      env: { ...cleanNpmEnv(), FIRECRAWL_API_KEY: apiKey },
    });
  } catch {
    process.exit(1);
  }
}
