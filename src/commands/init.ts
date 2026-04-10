/**
 * Init command — interactive step-by-step wizard to set up Firecrawl.
 *
 * Usage:  npx -y firecrawl-cli init
 */

import { execSync } from 'child_process';
import { isAuthenticated, browserLogin, interactiveLogin } from '../utils/auth';
import { saveCredentials } from '../utils/credentials';
import { updateConfig, getApiKey } from '../utils/config';
import {
  buildSkillsInstallArgs,
  cleanNpmEnv,
  SKILL_REPOS,
} from './skills-install';
import { hasNpx, installSkillsNative } from './skills-native';

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
  template?: string;
}

const orange = '\x1b[38;5;208m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const green = '\x1b[32m';

const TEMPLATES_REPO = 'firecrawl/cli-templates';

interface TemplateEntry {
  name: string;
  description: string;
  path: string; // subdirectory within the templates repo
}

export const TEMPLATES: TemplateEntry[] = [
  // Scraping
  {
    name: 'Scrape / Basic',
    description: 'Simple scrape + crawl scripts',
    path: 'scrape-basic',
  },
  {
    name: 'Scrape / Express',
    description: 'Express server with scrape, crawl, and search endpoints',
    path: 'scrape-express',
  },
  {
    name: 'Scrape / Next.js',
    description: 'Next.js app with server actions for scraping',
    path: 'scrape-nextjs',
  },

  // Browser
  {
    name: 'Browser / Basic',
    description: 'Playwright and Puppeteer CDP scripts with Firecrawl browser',
    path: 'browser-basic',
  },
  {
    name: 'Browser / Express',
    description: 'Express server with browser automation endpoints',
    path: 'browser-express',
  },
  {
    name: 'Browser / AI SDK',
    description:
      'Next.js browser co-pilot with Vercel AI SDK and live session UI',
    path: '_external:firecrawl/browser-ai-sdk',
  },

  // AI Frameworks
  {
    name: 'AI / Vercel AI SDK',
    description: 'Firecrawl tools with Vercel AI SDK',
    path: 'ai-vercel',
  },
  {
    name: 'AI / LangChain',
    description: 'Firecrawl tools with LangChain agents',
    path: 'ai-langchain',
  },

  // Full apps
  {
    name: 'Open Lovable',
    description: 'Clone and recreate any website as a modern React app',
    path: '_external:firecrawl/open-lovable',
  },
];

async function stepInstall(): Promise<boolean> {
  const { confirm } = await import('@inquirer/prompts');
  const shouldInstall = await confirm({
    message: 'Install firecrawl-cli globally?',
    default: true,
  });

  if (!shouldInstall) return true;

  console.log(`\n  Installing firecrawl-cli globally...`);
  try {
    execSync('npm install -g firecrawl-cli', { stdio: 'inherit' });
    console.log(`  ${green}✓${reset} CLI installed globally\n`);
    return true;
  } catch {
    console.error(
      '\n  Failed to install globally. You may need sudo or fix npm permissions.'
    );
    return false;
  }
}

async function stepAuth(options: InitOptions): Promise<boolean> {
  if (isAuthenticated()) {
    console.log(`  ${green}✓${reset} Already authenticated\n`);
    return true;
  }

  if (options.apiKey) {
    try {
      saveCredentials({ apiKey: options.apiKey });
      updateConfig({ apiKey: options.apiKey });
      console.log(`  ${green}✓${reset} Authenticated with provided API key\n`);
      return true;
    } catch (error) {
      console.error(
        '  Failed to save credentials:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  const { select } = await import('@inquirer/prompts');
  const method = await select({
    message: 'How would you like to authenticate?',
    choices: [
      { name: 'Login via browser (recommended)', value: 'browser' },
      { name: 'Enter API key manually', value: 'manual' },
      { name: 'Skip for now', value: 'skip' },
    ],
  });

  if (method === 'skip') {
    console.log(`  ${dim}Skipped. Run "firecrawl login" later.${reset}\n`);
    return true;
  }

  try {
    let result: { apiKey: string; apiUrl?: string; teamName?: string };
    if (method === 'browser') {
      result = await browserLogin();
    } else {
      result = await interactiveLogin();
    }

    saveCredentials({ apiKey: result.apiKey, apiUrl: result.apiUrl });
    updateConfig({ apiKey: result.apiKey, apiUrl: result.apiUrl });

    const teamSuffix = result.teamName ? ` (Team: ${result.teamName})` : '';
    console.log(`  ${green}✓${reset} Authenticated${teamSuffix}\n`);
    return true;
  } catch (error) {
    console.error(
      '  Authentication failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.log(
      `  ${dim}You can authenticate later with: firecrawl login${reset}\n`
    );
    return true;
  }
}

async function stepIntegrations(options: InitOptions): Promise<void> {
  const { checkbox, confirm } = await import('@inquirer/prompts');

  const wantIntegrations = await confirm({
    message: 'Set up integrations (skills, MCP, env)?',
    default: true,
  });

  if (!wantIntegrations) return;

  const integrations = await checkbox<string>({
    message: 'Which integrations?',
    choices: [
      {
        name: 'Skills — install firecrawl skill for AI coding agents',
        value: 'skills',
        checked: true,
      },
      {
        name: 'MCP — install firecrawl MCP server for editors (Cursor, Claude Code, VS Code)',
        value: 'mcp',
      },
      {
        name: 'Env — pull FIRECRAWL_API_KEY into local .env file',
        value: 'env',
      },
    ],
  });

  if (integrations.length === 0) {
    console.log(`  ${dim}No integrations selected.${reset}\n`);
    return;
  }

  for (const integration of integrations) {
    switch (integration) {
      case 'skills': {
        console.log(`\n  Setting up skills...`);
        for (const repo of SKILL_REPOS) {
          if (hasNpx()) {
            const args = buildSkillsInstallArgs({
              repo,
              agent: options.agent,
              yes: options.yes || options.all,
              global: true,
              includeNpxYes: true,
            });
            try {
              execSync(args.join(' '), {
                stdio: 'inherit',
                env: cleanNpmEnv(),
              });
              console.log(`  ${green}✓${reset} Skills installed from ${repo}`);
            } catch {
              console.error(
                `  Failed to install skills from ${repo}. Run "firecrawl setup skills" later.`
              );
            }
          } else {
            try {
              await installSkillsNative(repo);
            } catch {
              console.error(
                `  Failed to install skills from ${repo}. Run "firecrawl setup skills" later.`
              );
            }
          }
        }
        break;
      }
      case 'mcp': {
        console.log(`\n  Setting up MCP server...`);
        const apiKey = getApiKey();
        if (!apiKey) {
          console.log(
            `  ${dim}Skipped — no API key found. Run "firecrawl login" first, then "firecrawl setup mcp".${reset}`
          );
          break;
        }
        const args = [
          'npx',
          '-y',
          'add-mcp',
          '"npx -y firecrawl-mcp"',
          '--name',
          'firecrawl',
        ];
        if (options.global) args.push('--global');
        if (options.agent) args.push('--agent', options.agent);
        try {
          execSync(args.join(' '), {
            stdio: 'inherit',
            env: { ...cleanNpmEnv(), FIRECRAWL_API_KEY: apiKey },
          });
          console.log(`  ${green}✓${reset} MCP server installed`);
        } catch {
          console.error(
            '  Failed to install MCP. Run "firecrawl setup mcp" later.'
          );
        }
        break;
      }
      case 'env': {
        console.log(`\n  Pulling API key into .env...`);
        try {
          const { handleEnvPullCommand } = await import('./env');
          await handleEnvPullCommand({});
          console.log(`  ${green}✓${reset} .env updated`);
        } catch {
          console.error('  Failed to update .env. Run "firecrawl env" later.');
        }
        break;
      }
    }
  }
  console.log('');
}

function copyTemplateFiles(
  srcDir: string,
  targetDir: string,
  fs: typeof import('fs'),
  path: typeof import('path')
): void {
  const entries = fs.readdirSync(srcDir);
  for (const entry of entries) {
    if (entry === '.git') continue;
    const src = path.join(srcDir, entry);
    const dest = path.join(targetDir, entry);
    if (fs.existsSync(dest)) {
      console.log(`  ${dim}skip${reset}  ${entry} (already exists)`);
      continue;
    }
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  ${green}+${reset}     ${entry}`);
  }
}

async function downloadFromRepo(
  repo: string,
  subdir: string | null
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { execSync: exec } = await import('child_process');
  const targetDir = process.cwd();
  const tmpDir = path.join(targetDir, `.firecrawl-template-${Date.now()}`);

  // Try sparse checkout for subdirectory, full clone for whole repo
  try {
    if (subdir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      exec(
        `git clone --depth 1 --filter=blob:none --sparse https://github.com/${repo}.git "${tmpDir}"`,
        { stdio: 'pipe' }
      );
      exec(`git -C "${tmpDir}" sparse-checkout set "${subdir}"`, {
        stdio: 'pipe',
      });
      const srcDir = path.join(tmpDir, subdir);
      if (!fs.existsSync(srcDir)) {
        throw new Error(`Template directory "${subdir}" not found in ${repo}`);
      }
      copyTemplateFiles(srcDir, targetDir, fs, path);
    } else {
      exec(`git clone --depth 1 https://github.com/${repo}.git "${tmpDir}"`, {
        stdio: 'pipe',
      });
      copyTemplateFiles(tmpDir, targetDir, fs, path);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
    return;
  } catch (gitError) {
    // Clean up failed git attempt
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Fallback: download tarball and extract
  const https = await import('https');
  const tarballUrl = `https://api.github.com/repos/${repo}/tarball`;

  await new Promise<void>((resolve, reject) => {
    const request = (url: string) => {
      https.get(
        url,
        {
          headers: {
            'User-Agent': 'firecrawl-cli',
            Accept: 'application/vnd.github+json',
          },
        },
        (res) => {
          if (res.statusCode === 302 && res.headers.location) {
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}`));
            return;
          }

          const tmpTar = path.join(
            targetDir,
            `.firecrawl-template-${Date.now()}.tar.gz`
          );
          const fileStream = fs.createWriteStream(tmpTar);
          res.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            try {
              const extractDir = path.join(
                targetDir,
                `.firecrawl-template-extract-${Date.now()}`
              );
              fs.mkdirSync(extractDir, { recursive: true });
              exec(
                `tar -xzf "${tmpTar}" -C "${extractDir}" --strip-components=1`,
                { stdio: 'pipe' }
              );

              const srcDir = subdir
                ? path.join(extractDir, subdir)
                : extractDir;
              if (!fs.existsSync(srcDir)) {
                throw new Error(
                  `Template directory "${subdir}" not found in tarball`
                );
              }
              copyTemplateFiles(srcDir, targetDir, fs, path);

              fs.rmSync(tmpTar, { force: true });
              fs.rmSync(extractDir, { recursive: true, force: true });
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        }
      );
    };
    request(tarballUrl);
  });
}

async function stepTemplate(): Promise<void> {
  const { select, confirm: confirmPrompt } = await import('@inquirer/prompts');

  const wantTemplate = await confirmPrompt({
    message: 'Start from a template?',
    default: false,
  });

  if (!wantTemplate) return;

  const template = await select({
    message: 'Choose a template',
    choices: TEMPLATES.map((t) => ({
      name: `${t.name}  ${dim}${t.description}${reset}`,
      value: t,
    })),
  });

  const isExternal = template.path.startsWith('_external:');
  const repo = isExternal
    ? template.path.replace('_external:', '')
    : TEMPLATES_REPO;
  const subdir = isExternal ? null : template.path;

  console.log(`\n  Downloading ${bold}${template.name}${reset}...`);
  console.log(
    `  ${dim}github.com/${repo}${subdir ? '/' + subdir : ''}${reset}\n`
  );
  try {
    await downloadFromRepo(repo, subdir);
    console.log(`\n  ${green}✓${reset} Template ready\n`);
  } catch (error) {
    console.error(`\n  ${bold}Could not download template.${reset}`);
    console.error(
      `  ${dim}${error instanceof Error ? error.message : 'Unknown error'}${reset}\n`
    );
    console.log(`  Clone it manually:\n`);
    console.log(
      `    git clone https://github.com/${repo}.git${subdir ? ' && cp -r ' + repo.split('/')[1] + '/' + subdir + '/* .' : ''}\n`
    );
  }
}

export function findTemplate(name: string): TemplateEntry | undefined {
  const lower = name.toLowerCase();
  return TEMPLATES.find((t) => {
    const path = t.path.replace('_external:', '').split('/').pop() ?? '';
    return path === lower || t.name.toLowerCase() === lower;
  });
}

export async function scaffoldTemplate(templatePath: string): Promise<void> {
  const template = findTemplate(templatePath);
  if (!template) {
    console.error(`\n  Unknown template: ${bold}${templatePath}${reset}\n`);
    console.log(`  Available templates:\n`);
    for (const t of TEMPLATES) {
      const key = t.path.replace('_external:', '').split('/').pop() ?? '';
      console.log(`    ${bold}${key}${reset}  ${dim}${t.description}${reset}`);
    }
    console.log('');
    process.exit(1);
  }

  const isExternal = template.path.startsWith('_external:');
  const repo = isExternal
    ? template.path.replace('_external:', '')
    : TEMPLATES_REPO;
  const subdir = isExternal ? null : template.path;

  console.log('');
  console.log(
    `  ${orange}🔥 ${bold}firecrawl${reset} ${dim}${template.name}${reset}`
  );
  console.log(
    `  ${dim}github.com/${repo}${subdir ? '/' + subdir : ''}${reset}\n`
  );
  try {
    await downloadFromRepo(repo, subdir);
    console.log(`\n  ${green}✓${reset} Template ready\n`);
  } catch (error) {
    console.error(`\n  ${bold}Could not download template.${reset}`);
    console.error(
      `  ${dim}${error instanceof Error ? error.message : 'Unknown error'}${reset}\n`
    );
    console.log(`  Clone it manually:\n`);
    console.log(
      `    git clone https://github.com/${repo}.git${subdir ? ' && cp -r ' + repo.split('/')[1] + '/' + subdir + '/* .' : ''}\n`
    );
    process.exit(1);
  }
}

export async function handleInitCommand(
  options: InitOptions = {}
): Promise<void> {
  // Direct template scaffold: firecrawl init browser-nextjs
  if (options.template) {
    await scaffoldTemplate(options.template);
    return;
  }

  console.log('');
  console.log(`  ${orange}🔥 ${bold}firecrawl${reset} ${dim}init${reset}`);
  console.log('');

  // Non-interactive mode (--yes or --all skips all prompts)
  if (options.yes || options.all) {
    await runNonInteractive(options);
    return;
  }

  // Step 1: Install
  if (!options.skipInstall) {
    const ok = await stepInstall();
    if (!ok) {
      console.log(`  ${dim}Continuing with setup...${reset}\n`);
    }
  }

  // Step 2: Auth
  if (!options.skipAuth) {
    await stepAuth(options);
  }

  // Step 3: Integrations (skills, MCP, env)
  if (!options.skipSkills) {
    await stepIntegrations(options);
  }

  // Step 4: Template
  await stepTemplate();

  console.log(
    `${green}${bold}  Setup complete!${reset} Run ${dim}firecrawl --help${reset} to get started.\n`
  );
}

async function runNonInteractive(options: InitOptions): Promise<void> {
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
        saveCredentials({ apiKey: result.apiKey, apiUrl: result.apiUrl });
        updateConfig({ apiKey: result.apiKey, apiUrl: result.apiUrl });
        const teamSuffix = result.teamName ? ` (Team: ${result.teamName})` : '';
        console.log(`${green}✓${reset} Authenticated${teamSuffix}\n`);
      } catch (error) {
        console.error(
          '\nAuthentication failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        console.log('You can authenticate later with: firecrawl login\n');
      }
    }
  }

  if (!options.skipSkills) {
    console.log(
      `${stepLabel()} Installing firecrawl skills for AI coding agents...`
    );
    for (const repo of SKILL_REPOS) {
      if (hasNpx()) {
        const args = buildSkillsInstallArgs({
          repo,
          agent: options.agent,
          yes: true,
          global: true,
          includeNpxYes: true,
        });
        try {
          execSync(args.join(' '), {
            stdio: 'inherit',
            env: cleanNpmEnv(),
          });
          console.log(`${green}✓${reset} Skills installed from ${repo}`);
        } catch {
          console.error(
            `\nFailed to install skills from ${repo}. You can retry with: firecrawl setup skills`
          );
          process.exit(1);
        }
      } else {
        try {
          await installSkillsNative(repo);
        } catch {
          console.error(
            `\nFailed to install skills from ${repo}. You can retry with: firecrawl setup skills`
          );
          process.exit(1);
        }
      }
    }
    console.log('');
  }

  console.log(
    `${green}${bold}Setup complete!${reset} Run ${dim}firecrawl --help${reset} to get started.\n`
  );
}
