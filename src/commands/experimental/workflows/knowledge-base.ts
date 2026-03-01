/**
 * Workflow: Knowledge Base
 *
 * A single command that adapts based on the user's goal: local reference docs,
 * RAG-ready chunks, fine-tuning datasets, or full doc site mirrors. All output
 * follows the `.firecrawl/<hostname>/<path>/index.md` convention.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import {
  FIRECRAWL_TOOLS_BLOCK,
  SUBAGENT_INSTRUCTIONS,
  askPermissionMode,
  buildMessage,
  normalizeSource,
  validateRequired,
} from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  source: string;
  goal: string;
  depth: string;
  context: string;
  outputDir: string;
  trainFormat: string;
  trainExamples: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { source?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const rawSource =
    prefill?.source ||
    (await input({
      message:
        'What do you want to build a knowledge base from? (URL or topic)',
      validate: validateRequired('URL or topic'),
    }));

  const goal = await select({
    message: 'What are you building this for?',
    choices: [
      {
        name: 'Local reference (organized markdown files)',
        value: 'reference',
      },
      {
        name: 'RAG / embedding pipeline (chunked, with metadata)',
        value: 'rag',
      },
      { name: 'Fine-tuning dataset (JSONL training data)', value: 'train' },
      { name: 'Documentation scrape (mirror a doc site)', value: 'docs' },
    ],
  });

  let trainFormat = '';
  let trainExamples = '';

  if (goal === 'train') {
    trainFormat = (await select({
      message: 'Training data format?',
      choices: [
        { name: 'OpenAI JSONL (messages array)', value: 'openai' },
        { name: 'Alpaca (instruction/input/output)', value: 'alpaca' },
        { name: 'ShareGPT (conversations)', value: 'sharegpt' },
      ],
    })) as string;

    trainExamples = await input({
      message: 'Roughly how many training examples?',
      default: '100',
    });
  }

  const depth = await select({
    message: 'How thorough?',
    choices: [
      { name: 'Quick (5-10 sources)', value: 'quick' },
      { name: 'Thorough (15-25 sources)', value: 'thorough' },
      { name: 'Exhaustive (25+ sources)', value: 'exhaustive' },
    ],
  });

  const context = await input({
    message: 'Any specific focus or instructions? (leave blank to skip)',
    default: '',
  });

  const outputDir = await input({
    message: 'Output directory?',
    default: '.firecrawl/',
  });

  return {
    source: normalizeSource(rawSource),
    goal,
    depth,
    context,
    outputDir,
    trainFormat,
    trainExamples,
  };
}

// ─── System prompt ──────────────────────────────────────────────────────────

const FILE_CONVENTION = `## File Organization

**IMPORTANT:** Follow the same structure as \`firecrawl download\`. Save all files under \`.firecrawl/\` using nested directories that mirror each URL's hostname and path:

\`\`\`
.firecrawl/
  <hostname>/
    <path>/
      index.md          # Page content as clean markdown
\`\`\`

For example, \`https://docs.stripe.com/api/charges\` becomes:
\`\`\`
.firecrawl/docs.stripe.com/api/charges/index.md
\`\`\`

Strip \`www.\` from hostnames. Each page gets its own directory with an \`index.md\` inside it.`;

function buildGoalInstructions(opts: {
  goal: string;
  outputDir: string;
  trainFormat: string;
  trainExamples: string;
}): string {
  switch (opts.goal) {
    case 'reference':
      return `${FILE_CONVENTION}

Also create these at the root of \`${opts.outputDir}\`:
- \`index.md\` -- Table of contents with links to all scraped pages
- \`sources.json\` -- All URLs scraped with metadata (title, type, url)

Each markdown file should have frontmatter:
\`\`\`yaml
---
title: "Page Title"
url: "https://..."
source: "Source Name"
type: "docs | article | tutorial | reference | discussion"
---
\`\`\`

Focus on clean, readable markdown. Preserve code examples and formatting.`;

    case 'rag':
      return `${FILE_CONVENTION}

After scraping, chunk each page into embedding-ready pieces (500-1500 tokens). Save chunks alongside the source:
\`\`\`
.firecrawl/<hostname>/<path>/
  index.md              # Full page content
  chunks/
    001.md              # Chunk 1
    002.md              # Chunk 2
\`\`\`

Each chunk file should have frontmatter:
\`\`\`yaml
---
title: "Page Title"
url: "https://..."
chunk: 1
total_chunks: 5
section: "Section Name"
---
\`\`\`

Also create \`${opts.outputDir}/manifest.json\` listing every chunk with its metadata for easy ingestion into a vector store.`;

    case 'train':
      return `${FILE_CONVENTION}

Scrape source pages into the \`.firecrawl/\` directory structure first, then generate training data from the scraped content.

## Training Data Format

${
  opts.trainFormat === 'openai'
    ? `OpenAI fine-tuning JSONL. Each line:
\`\`\`json
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
\`\`\``
    : opts.trainFormat === 'alpaca'
      ? `Alpaca format JSONL. Each line:
\`\`\`json
{"instruction": "...", "input": "...", "output": "..."}
\`\`\``
      : `ShareGPT conversation JSONL. Each line:
\`\`\`json
{"conversations": [{"from": "human", "value": "..."}, {"from": "gpt", "value": "..."}]}
\`\`\``
}

Target ~${opts.trainExamples} examples.

Save the dataset to \`training-data.jsonl\` in the current directory.

Also save \`training-metadata.json\` with:
- Total examples generated
- Sources used (URLs)
- Topic coverage breakdown
- Format used

### Quality Guidelines

- Each example should be self-contained and accurate
- Vary the instruction style (questions, commands, scenarios)
- Include code examples where relevant
- Remove boilerplate, navigation, and ads from scraped content
- Cite the source URL in a metadata field for traceability
- Deduplicate similar examples`;

    case 'docs':
      return `${FILE_CONVENTION}

Also create \`${opts.outputDir}/index.md\` as a table of contents linking to all scraped pages, organized by section.

Each markdown file should have frontmatter:
\`\`\`yaml
---
title: "Page Title"
url: "https://..."
section: "Section Name"
---
\`\`\`

Be thorough. Scrape every page, preserve all code examples. This content will be used as LLM context, so accuracy matters.`;

    default:
      return FILE_CONVENTION;
  }
}

function buildAgentStrategy(goal: string): string {
  switch (goal) {
    case 'docs':
      return `## Agent Assignments

Spawn agents based on the doc structure:
1. **Section Agent** (one per major section) -- Scrape all pages in the section. Save each page as clean markdown. Preserve code examples and formatting.

Start by mapping the site with \`firecrawl map\` to discover all pages, then divide by section.`;

    case 'train':
      return `## Agent Assignments

Spawn agents by source type:
1. **Documentation Agent** -- Scrape official docs. Generate instruction/response pairs from doc sections (e.g., "How do I X?" with the answer from docs).
2. **Tutorial Agent** -- Scrape tutorials and how-to articles. Generate step-by-step instruction pairs.
3. **Q&A Agent** -- Scrape Stack Overflow, GitHub discussions, forums. Extract real question/answer pairs.
4. **Reference Agent** -- Scrape reference material. Generate factual Q&A pairs.`;

    default:
      return `## Agent Assignments

Spawn agents by source type:
1. **Official Docs Agent** -- Find and scrape official documentation, reference material, specs.
2. **Articles & Tutorials Agent** -- Find and scrape the best articles, blog posts, tutorials.
3. **Community & Discussions Agent** -- Find and scrape relevant forum posts, Stack Overflow answers, GitHub discussions.
4. **Reference Agent** -- Wikipedia, glossaries, standards documents, whitepapers.

Adjust agents based on what sources exist for the topic.`;
  }
}

function buildSystemPrompt(opts: {
  goal: string;
  depth: string;
  outputDir: string;
  trainFormat: string;
  trainExamples: string;
}): string {
  const depthInstructions: Record<string, string> = {
    quick: 'Find and scrape 5-10 of the best sources.',
    thorough: 'Find and scrape 15-25 sources covering different perspectives.',
    exhaustive:
      'Find and scrape 25+ sources including primary docs, articles, tutorials, and reference material.',
  };

  return `You are a knowledge base team lead powered by Firecrawl. You scrape web content and organize it into structured, LLM-ready formats.

${FIRECRAWL_TOOLS_BLOCK}

## Depth

${depthInstructions[opts.depth]}

## Your Strategy

You are a **team lead**. Your job is to:

1. **Find the best sources** -- ${opts.goal === 'docs' ? 'Map the documentation site to discover all pages.' : 'Search broadly to identify the most valuable sources on the topic.'}
2. **Spawn parallel subagents** -- Divide the work across agents. Each scrapes their assigned sources.
3. **Collect and organize** -- Build the final output structure from all agent results.

${buildAgentStrategy(opts.goal)}

${SUBAGENT_INSTRUCTIONS}

${buildGoalInstructions(opts)}

---

Tell the user the output path when done.

Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('knowledge-base')
    .description(
      'Build a knowledge base from web content (docs, RAG, fine-tuning)'
    )
    .argument('[source]', 'URL or topic to build from')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (source, options) => {
      const inputs = await gatherInputs(source ? { source } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          goal: inputs.goal,
          depth: inputs.depth,
          outputDir: inputs.outputDir,
          trainFormat: inputs.trainFormat,
          trainExamples: inputs.trainExamples,
        }),
        buildMessage([
          `Build a knowledge base from: ${inputs.source}`,
          inputs.context,
        ]),
        skipPermissions
      );
    });
}
