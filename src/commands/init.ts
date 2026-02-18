/**
 * Init command — single command to install the CLI, authenticate, and add skills.
 *
 * Usage:  npx -y firecrawl-cli init
 */

import { execSync } from 'child_process';
import { isAuthenticated, browserLogin, interactiveLogin } from '../utils/auth';
import { saveCredentials } from '../utils/credentials';
import { updateConfig } from '../utils/config';

export interface InitOptions {
  global?: boolean;
  agent?: string;
  all?: boolean;
  yes?: boolean;
  skipInstall?: boolean;
  skipSkills?: boolean;
  skipAuth?: boolean;
  apiKey?: string;
  browser?: boolean;
}

export async function handleInitCommand(
  options: InitOptions = {}
): Promise<void> {
  const orange = '\x1b[38;5;208m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  const green = '\x1b[32m';

  const steps: string[] = [];
  if (!options.skipInstall) steps.push('install');
  if (!options.skipAuth) steps.push('auth');
  if (!options.skipSkills) steps.push('skills');
  const total = steps.length;
  let current = 0;

  const stepLabel = () => {
    current++;
    return `${bold}[${current}/${total}]${reset}`;
  };

  console.log('');
  console.log(`  ${orange}🔥 ${bold}firecrawl${reset} ${dim}init${reset}`);
  console.log('');

  // Step: Install CLI globally
  if (!options.skipInstall) {
    console.log(`${stepLabel()} Installing firecrawl-cli globally...`);
    try {
      execSync('npm install -g firecrawl-cli', { stdio: 'inherit' });
      console.log(`${green}✓${reset} CLI installed globally\n`);
    } catch {
      console.error(
        '\nFailed to install firecrawl-cli globally. You may need to run with sudo or fix npm permissions.'
      );
      process.exit(1);
    }
  }

  // Step: Authenticate
  if (!options.skipAuth) {
    if (isAuthenticated()) {
      console.log(`${stepLabel()} Authenticating...`);
      console.log(`${green}✓${reset} Already authenticated\n`);
    } else if (options.apiKey) {
      console.log(`${stepLabel()} Authenticating with API key...`);
      try {
        saveCredentials({ apiKey: options.apiKey });
        updateConfig({ apiKey: options.apiKey });
        console.log(`${green}✓${reset} Authenticated\n`);
      } catch (error) {
        console.error(
          'Failed to save credentials:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    } else {
      console.log(`${stepLabel()} Authenticating with Firecrawl...`);
      try {
        let result: { apiKey: string; apiUrl?: string; teamName?: string };

        if (options.browser) {
          result = await browserLogin();
        } else {
          result = await interactiveLogin();
        }

        saveCredentials({
          apiKey: result.apiKey,
          apiUrl: result.apiUrl,
        });
        updateConfig({
          apiKey: result.apiKey,
          apiUrl: result.apiUrl,
        });

        if (result.teamName) {
          console.log(
            `${green}✓${reset} Authenticated (Team: ${result.teamName})\n`
          );
        } else {
          console.log(`${green}✓${reset} Authenticated\n`);
        }
      } catch (error) {
        console.error(
          '\nAuthentication failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        console.log('You can authenticate later with: firecrawl login\n');
      }
    }
  }

  // Step: Install skills
  if (!options.skipSkills) {
    console.log(
      `${stepLabel()} Installing firecrawl skill for AI coding agents...`
    );

    const args = ['npx', '-y', 'skills', 'add', 'firecrawl/cli'];

    if (options.all) {
      args.push('--all');
    }

    if (options.yes || options.all) {
      args.push('--yes');
    }

    if (options.global) {
      args.push('--global');
    }

    if (options.agent) {
      args.push('--agent', options.agent);
    }

    const cmd = args.join(' ');

    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`${green}✓${reset} Skills installed\n`);
    } catch {
      console.error(
        '\nFailed to install skills. You can retry with: firecrawl setup skills'
      );
      process.exit(1);
    }
  }

  console.log(
    `${green}${bold}Setup complete!${reset} Run ${dim}firecrawl --help${reset} to get started.\n`
  );
}
