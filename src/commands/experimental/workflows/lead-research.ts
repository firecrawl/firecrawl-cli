/**
 * Workflow: Lead Research
 *
 * Spawns parallel agents to research a company, recent news/activity, and
 * optionally a specific person -- all at once. Results are synthesized into
 * a brief with talking points and pain points.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import {
  FIRECRAWL_TOOLS_BLOCK,
  SUBAGENT_INSTRUCTIONS,
  askPermissionMode,
  buildMessage,
  validateRequired,
} from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  company: string;
  person: string;
  context: string;
  output: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { company?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const company =
    prefill?.company ||
    (await input({
      message: 'What company do you want to research?',
      validate: validateRequired('Company name or URL'),
    }));

  const person = await input({
    message: 'Specific person to research? (leave blank to skip)',
    default: '',
  });

  const context = await input({
    message:
      'What\'s the context? (e.g., "preparing for a sales call", "partnership eval")',
    default: '',
  });

  const output = await select({
    message: 'How should the brief be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as Markdown file', value: 'markdown' },
    ],
  });

  return { company, person, context, output };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: { output: string }): string {
  const outputInstructions =
    opts.output === 'markdown'
      ? 'Save the brief to a file called `lead-brief.md` in the current directory. Tell the user the file path when done.'
      : 'Print the full brief to the terminal in well-formatted markdown.';

  return `You are a lead research team lead powered by Firecrawl. You orchestrate parallel research agents to prepare intelligence briefs before meetings, calls, or outreach.

${FIRECRAWL_TOOLS_BLOCK}

## Your Strategy

You are a **team lead**, not a solo researcher. Your job is to:

1. **Spawn parallel subagents** -- Launch agents to research the company, recent activity, and person simultaneously.
2. **Collect results** -- Each agent reports back findings with sources.
3. **Synthesize** -- Build the brief with talking points and pain points from all agent findings.

## Agent Assignments

Spawn these agents in parallel:
1. **Company Profile Agent** -- Scrape the company website: about page, team/careers, product pages, pricing. Return what they do, size, stage, tech stack, key metrics.
2. **News & Activity Agent** -- Search for recent news about the company: funding, launches, hires, partnerships, press coverage from the last 6 months. Scrape the top results.
3. **Person Research Agent** (if a person is specified) -- Search for the person: their role, background, recent talks/posts/tweets, interests, public profiles. Scrape relevant pages.

${SUBAGENT_INSTRUCTIONS}

## Output Format

${outputInstructions}

Structure the brief as:

### Company Overview
What they do, size, stage, key metrics.

### Recent Activity
News, launches, funding, hires from the last 6 months.

### Key People
Relevant people at the company with their roles and backgrounds.

### Talking Points
5-7 specific conversation starters based on your research.

### Potential Pain Points
What challenges might they be facing based on their industry/stage/tech?

### Sources
Every URL you scraped.

---

Be concise and actionable. This is a pre-meeting brief, not a thesis.

Start working immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('lead-research')
    .description('Research a company or person before a meeting or outreach')
    .argument('[company]', 'Company name or URL')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (company, options) => {
      const inputs = await gatherInputs(company ? { company } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ output: inputs.output }),
        buildMessage([
          `Research ${inputs.company}`,
          inputs.person && `Focus on ${inputs.person}`,
          inputs.context && `Context: ${inputs.context}`,
        ]),
        skipPermissions
      );
    });
}
