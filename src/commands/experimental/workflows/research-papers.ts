/**
 * Workflow: Research Papers
 *
 * Spawns parallel agents by source type (academic, industry, technical) to find,
 * scrape, and synthesize research papers, whitepapers, and PDFs into a
 * structured literature review.
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
  count: string;
  context: string;
  output: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { topic?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const topic =
    prefill?.topic ||
    (await input({
      message: 'What topic do you want to find papers on?',
      validate: validateRequired('Topic'),
    }));

  const count = await input({
    message: 'How many papers/sources to target? (default: 10)',
    default: '10',
  });

  const context = await input({
    message: 'Any specific angles or questions? (leave blank to skip)',
    default: '',
  });

  const output = await select({
    message: 'How should the literature review be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as Markdown file', value: 'markdown' },
    ],
  });

  return { topic, count, context, output };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: { output: string }): string {
  const outputInstructions =
    opts.output === 'markdown'
      ? 'Save the literature review to `literature-review.md` in the current directory. Tell the user the file path when done.'
      : 'Print the full literature review to the terminal in well-formatted markdown.';

  return `You are a research papers team lead powered by Firecrawl. You find, scrape, and synthesize research papers, whitepapers, and PDFs into a structured literature review.

${FIRECRAWL_TOOLS_BLOCK}

## Your Strategy

You are a **team lead**. Your job is to:

1. **Find papers and PDFs** -- Search for research papers, whitepapers, technical reports, and PDFs on the topic. Target sources like arXiv, Google Scholar, IEEE, ACM, company research blogs, and PDF links.
2. **Spawn parallel subagents** -- Each agent scrapes and analyzes a subset of papers.
3. **Synthesize** -- Build a structured literature review from all agent findings.

## Agent Assignments

Spawn agents by source type:
1. **Academic Papers Agent** -- Search for and scrape research papers from arXiv, Google Scholar links, university sites. Use \`firecrawl scrape\` on PDF URLs directly -- Firecrawl handles PDFs natively.
2. **Industry Reports Agent** -- Search for whitepapers, technical reports, and industry publications. Scrape company research blogs and report PDFs.
3. **Technical Articles Agent** -- Search for in-depth technical articles, blog posts from researchers, and conference talk summaries.

${SUBAGENT_INSTRUCTIONS}

## Output Format

${outputInstructions}

Structure the literature review as:

### Abstract
2-3 paragraph summary of the research landscape.

### Key Papers
For each paper/source:
- **Title** and authors (if available)
- **Source URL**
- **Key findings** (2-3 bullet points)
- **Methodology** (if applicable)
- **Relevance** to the topic

### Themes & Consensus
What do the papers agree on? What are the established findings?

### Open Questions & Debates
Where do papers disagree? What's unresolved?

### Emerging Trends
Recent developments and where the field is heading.

### Sources
Every URL scraped, organized by type (paper, report, article).

---

Be thorough with citations. Every claim should trace back to a specific source. If a PDF fails to scrape, note it and try an alternative.

Start by searching for papers on the topic.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('research-papers')
    .description('Find and synthesize research papers, whitepapers, and PDFs')
    .argument('[topic]', 'Research topic')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (topic, options) => {
      const inputs = await gatherInputs(topic ? { topic } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ output: inputs.output }),
        buildMessage([
          `Research papers on: ${inputs.topic}`,
          `Target ~${inputs.count} papers`,
          inputs.context,
        ]),
        skipPermissions
      );
    });
}
