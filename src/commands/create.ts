/**
 * `firecrawl create` command — scaffolds Firecrawl starter projects.
 *
 * Hidden from --help until the flow is battle-tested in the wild. The
 * scaffolder is vendored under `src/utils/agent-scaffold/` (mirrored from
 * `firecrawl/web-agent`). At runtime it clones the public agent repo
 * to get templates — no separate npm package for the agent CLI.
 *
 * Once visible, the command tree will grow to include additional kinds
 * (scrape, browser, ai, app). For now, `agent` is the only kind.
 */

import { Command } from 'commander';
import type { CreateOptions } from '../utils/agent-scaffold/create-flow';

function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

/**
 * Build the `agent` subcommand. Flag surface mirrors the upstream agent CLI.
 * The scaffold flow itself lives in `utils/agent-scaffold/create-flow.ts`.
 */
function createAgentSubcommand(): Command {
  return new Command('agent')
    .description(
      'Scaffold a Firecrawl Agent project (defaults to the Next.js template)'
    )
    .argument('[project-name]', 'Project directory name')
    .option(
      '-t, --template <id>',
      'Template variant (next, express, library)',
      'next'
    )
    .option(
      '--provider <id>',
      'Orchestrator model provider (anthropic, openai, google, gateway, custom-openai)'
    )
    .option('--model <id>', 'Orchestrator model ID')
    .option(
      '--sub-agent-provider <id>',
      'Sub-agent model provider (defaults to orchestrator)'
    )
    .option(
      '--sub-agent-model <id>',
      'Sub-agent model ID (defaults to orchestrator)'
    )
    .option(
      '--from <source>',
      'External repo (user/repo) or local path with agent-manifest.json'
    )
    .option('--api-key <key>', 'Firecrawl API key')
    .option(
      '--key <provider=key>',
      'Provider API key (repeatable, e.g. --key anthropic=sk-...)',
      collect,
      []
    )
    .option('--skip-install', 'Skip npm install')
    .action(
      async (
        projectName: string | undefined,
        options: CreateOptions & Record<string, unknown>
      ) => {
        // Lazy-load the scaffolder so startup cost (inquirer, git) only hits
        // users who actually invoke `create`. Keeps the rest of the CLI snappy.
        const { handleCreate } =
          await import('../utils/agent-scaffold/create-flow');
        await handleCreate(projectName, {
          template: options.template,
          provider: options.provider,
          model: options.model,
          subAgentProvider: options.subAgentProvider,
          subAgentModel: options.subAgentModel,
          from: options.from,
          apiKey: options.apiKey,
          key: Array.isArray(options.key)
            ? (options.key as string[])
            : undefined,
          skipInstall: options.skipInstall as boolean | undefined,
        });
      }
    );
}

/**
 * Top-level `firecrawl create` command. For now it only wires the `agent`
 * subcommand; future kinds (scrape, browser, ai, app) register here.
 */
export function createCreateCommand(): Command {
  const cmd = new Command('create').description(
    'Scaffold a Firecrawl starter project'
  );

  cmd.addCommand(createAgentSubcommand());

  return cmd;
}
