/**
 * Workflow: Deep Research
 *
 * Breaks a topic into research angles, then spawns parallel agents -- one per
 * angle (overview, technical, market, contrarian). Results are cross-referenced
 * and synthesized into a structured report.
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
  topic: string;
  depth: string;
  context: string;
  output: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { topic?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const topic =
    prefill?.topic ||
    (await input({
      message: 'What topic do you want to research?',
      validate: validateRequired('Topic'),
    }));

  const depth = await select({
    message: 'How deep should the research go?',
    choices: [
      { name: 'Quick overview (5-10 sources)', value: 'quick' },
      { name: 'Thorough analysis (15-25 sources)', value: 'thorough' },
      { name: 'Exhaustive deep-dive (25+ sources)', value: 'exhaustive' },
    ],
  });

  const context = await input({
    message:
      'Any specific angles or questions to focus on? (leave blank to skip)',
    default: '',
  });

  const output = await select({
    message: 'How should the research be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as Markdown file', value: 'markdown' },
      { name: 'Save as JSON (structured data)', value: 'json' },
    ],
  });

  return { topic, depth, context, output };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: { depth: string; output: string }): string {
  const depthInstructions: Record<string, string> = {
    quick: 'Search 3-5 queries and scrape 5-10 of the most relevant pages.',
    thorough:
      'Search 5-10 queries from different angles and scrape 15-25 pages. Cross-reference claims across sources.',
    exhaustive:
      'Search 10+ queries covering every angle. Scrape 25+ pages including primary sources, research papers, expert opinions, and contrarian views. Cross-reference everything.',
  };

  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the full research report to the terminal in well-formatted markdown.',
    markdown:
      'Save the report to a file called `research-report.md` in the current directory. Tell the user the file path when done.',
    json: 'Save the report as structured JSON to `research-report.json` in the current directory. Tell the user the file path when done.',
  };

  return `You are a deep research team lead powered by Firecrawl. You orchestrate parallel research agents to investigate a topic from every angle simultaneously.

${FIRECRAWL_TOOLS_BLOCK}

## Research Depth

${depthInstructions[opts.depth]}

## Your Strategy

You are a **team lead**, not a solo researcher. Your job is to:

1. **Break the topic into angles** -- Identify 3-5 distinct research angles or subtopics.
2. **Spawn parallel subagents** -- One agent per angle. Each searches, scrapes, and analyzes from their specific perspective.
3. **Collect results** -- Each agent reports back findings with sources.
4. **Cross-reference and synthesize** -- Merge findings, resolve conflicting claims, build the unified report.

## Agent Assignments

Based on the topic, spawn agents like:
1. **Overview Agent** -- Broad searches, foundational context, definitions, key players. Scrape Wikipedia, encyclopedia-style sources, overview articles.
2. **Technical Deep-Dive Agent** -- Technical details, documentation, specifications, architecture. Scrape docs, technical blogs, research papers.
3. **Market & Industry Agent** -- Market size, trends, adoption, industry analyst perspectives. Scrape reports, news articles, industry publications.
4. **Contrarian & Risks Agent** -- Counterarguments, criticisms, failure cases, limitations. Search for "<topic> problems", "<topic> criticism", "<topic> limitations".

Adjust the number and focus of agents based on the topic and depth level.

${SUBAGENT_INSTRUCTIONS}

## Output Format

${outputInstructions[opts.output]}

Structure the report as:

### Executive Summary
2-3 paragraph overview of key findings.

### Key Findings
Numbered list of the most important discoveries, each with supporting evidence.

### Detailed Analysis
Deep dive into each major theme or subtopic.

### Contrarian Views & Risks
What are the counterarguments? What could go wrong?

### Sources
Every URL you scraped, with a one-line summary of what you found there.

---

Be thorough and honest. Cite your sources. Flag uncertainty. Do not fabricate information.

Start working immediately when given a topic.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('deep-research')
    .description('Deep research any topic using web search and scraping')
    .argument('[topic]', 'Topic to research')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (topic, options) => {
      const inputs = await gatherInputs(topic ? { topic } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ depth: inputs.depth, output: inputs.output }),
        buildMessage([inputs.topic, inputs.context]),
        skipPermissions
      );
    });
}
