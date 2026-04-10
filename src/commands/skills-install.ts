/**
 * Repos to pull skills from during install.
 *
 * - firecrawl/cli: core CLI skills bundled with this repo
 * - firecrawl/skills: additional "build" skills for working with Firecrawl
 *
 * Both are installed during `firecrawl init` and `firecrawl setup skills`.
 */
export const SKILL_REPOS = ['firecrawl/cli', 'firecrawl/skills'] as const;

export interface SkillsInstallCommandOptions {
  agent?: string;
  all?: boolean;
  yes?: boolean;
  global?: boolean;
  includeNpxYes?: boolean;
  /** Repo to install from (defaults to firecrawl/cli) */
  repo?: string;
}

export function buildSkillsInstallArgs(
  options: SkillsInstallCommandOptions = {}
): string[] {
  const args = ['npx'];

  if (options.includeNpxYes) {
    args.push('-y');
  }

  args.push('skills', 'add', options.repo ?? 'firecrawl/cli', '--full-depth');

  if (options.global ?? true) {
    args.push('--global');
  }

  const installToAllAgents = options.agent ? false : (options.all ?? true);
  if (installToAllAgents) {
    args.push('--all');
  }

  if (options.yes) {
    args.push('--yes');
  }

  if (options.agent) {
    args.push('--agent', options.agent);
  }

  return args;
}

/**
 * Build a clean env for `execSync('npx ...')` calls.
 *
 * When this CLI is itself launched by `npx -y firecrawl-cli@VERSION ...`, npm
 * injects env vars (`npm_command=exec`, `npm_lifecycle_event=npx`,
 * `npm_execpath`, `INIT_CWD`, etc.) that leak into nested npx subprocesses
 * and cause them to exit the parent process after the first invocation —
 * which silently breaks any loop that runs `npx skills add` more than once.
 *
 * Strip those vars so each nested npx call runs in a fresh-looking shell.
 */
export function cleanNpmEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_') || key === 'INIT_CWD' || key === 'PROJECT_CWD') {
      delete env[key];
    }
  }
  return env;
}
