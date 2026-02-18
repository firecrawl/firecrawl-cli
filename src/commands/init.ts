/**
 * Init command implementation
 * Installs firecrawl skill files and MCP server into AI coding agents
 */

import { execSync } from 'child_process';
import { getApiKey } from '../utils/config';

export type InitSubcommand = 'skills' | 'mcp';

export interface InitOptions {
  global?: boolean;
  agent?: string;
}

/**
 * Main init command handler
 */
export async function handleInitCommand(
  subcommand: InitSubcommand,
  options: InitOptions = {}
): Promise<void> {
  switch (subcommand) {
    case 'skills':
      await installSkills(options);
      break;
    case 'mcp':
      await installMcp(options);
      break;
    default:
      console.error(`Unknown init subcommand: ${subcommand}`);
      console.log('\nAvailable subcommands:');
      console.log('  skills    Install firecrawl skill into AI coding agents');
      console.log(
        '  mcp       Install firecrawl MCP server into editors (Cursor, Claude Code, VS Code, etc.)'
      );
      process.exit(1);
  }
}

async function installSkills(options: InitOptions): Promise<void> {
  const args = ['npx', 'skills', 'add', 'firecrawl/cli'];

  if (options.global) {
    args.push('--global');
  }

  if (options.agent) {
    args.push('--agent', options.agent);
  }

  const cmd = args.join(' ');
  console.log(`Running: ${cmd}\n`);

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

async function installMcp(options: InitOptions): Promise<void> {
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
      env: { ...process.env, FIRECRAWL_API_KEY: apiKey },
    });
  } catch {
    process.exit(1);
  }
}
