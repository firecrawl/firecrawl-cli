/**
 * Workflow: Competitor Analysis
 *
 * Spawns parallel agents -- one per company -- to scrape and profile the target
 * and each competitor simultaneously. Synthesizes into a full competitive report.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import {
  FIRECRAWL_TOOLS_BLOCK,
  SUBAGENT_INSTRUCTIONS,
  askPermissionMode,
  buildMessage,
  normalizeUrl,
  validateUrl,
} from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  url: string;
  competitors: string;
  context: string;
  output: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { url?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const rawUrl =
    prefill?.url ||
    (await input({
      message: "What's the URL of the site you want to analyze?",
      validate: validateUrl,
    }));

  const competitors = await input({
    message:
      'Are there particular competitors you want to flag? (leave blank to auto-discover)',
    default: '',
  });

  const context = await input({
    message: 'Anything else I should know? (leave blank to skip)',
    default: '',
  });

  const output = await select({
    message: 'How should the report be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as Markdown file', value: 'markdown' },
      { name: 'Save as JSON (structured data)', value: 'json' },
    ],
  });

  return { url: normalizeUrl(rawUrl), competitors, context, output };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: { output: string }): string {
  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the full report to the terminal in well-formatted markdown.',
    markdown:
      'Save the report to a file called `competitor-analysis.md` in the current directory. Tell the user the file path when done.',
    json: `Save the report as structured JSON to \`competitor-analysis.json\` in the current directory. Tell the user the file path when done.

Use this exact schema:
\`\`\`json
{
  "target": {
    "name": "string",
    "url": "string",
    "description": "string",
    "features": ["string"],
    "pricing": { "model": "string", "tiers": [{ "name": "string", "price": "string", "features": ["string"] }] },
    "targetAudience": "string",
    "valueProposition": "string",
    "sources": ["url"]
  },
  "competitors": [
    {
      "name": "string",
      "url": "string",
      "description": "string",
      "features": ["string"],
      "pricing": { "model": "string", "tiers": [{ "name": "string", "price": "string", "features": ["string"] }] },
      "targetAudience": "string",
      "sources": ["url"]
    }
  ],
  "featureMatrix": {
    "features": ["string"],
    "comparison": { "companyName": { "featureName": "yes | no | partial | string" } }
  },
  "positioning": [{ "company": "string", "tone": "string", "keyClaims": ["string"], "differentiators": ["string"] }],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "opportunities": ["string"],
  "sources": [{ "url": "string", "title": "string", "usedFor": "string" }]
}
\`\`\``,
  };

  return `You are a competitive analysis team lead powered by Firecrawl. You orchestrate parallel research agents to analyze a target company and its competitors simultaneously.

${FIRECRAWL_TOOLS_BLOCK}

## Your Strategy

You are a **team lead**, not a solo researcher. Your job is to:

1. **Identify the landscape** -- Do a quick search yourself to find competitors if not provided. Search for "<product> alternatives", "<product> vs", "<industry> tools".
2. **Spawn parallel subagents** -- Launch one agent per company (target + each competitor). Each agent scrapes and profiles one company in depth.
3. **Collect results** -- Each agent reports back structured company data with source URLs.
4. **Synthesize** -- Build the comparative analysis, feature matrix, positioning breakdown, and recommendations from all agent findings.

## Agent Assignments

Spawn these agents in parallel:
1. **Target Company Agent** -- Scrape the target site thoroughly. Extract: features, pricing, positioning, messaging, target audience, value proposition, content strategy. Return all findings with source URLs.
2. **Competitor Agent** (one per competitor) -- Each agent scrapes one competitor's site. Extract: company name, URL, what they do, key features, pricing (if public), target audience, value proposition. Return findings with source URLs.

${SUBAGENT_INSTRUCTIONS}

## Output Format

${outputInstructions[opts.output]}

Produce a comprehensive competitive analysis report with:

### 1. Target Company Overview
- What they do (one paragraph)
- Key features / product offerings
- Pricing model (if public)
- Target audience
- Unique value proposition

### 2. Competitor Profiles
For each competitor:
- Company name & URL
- What they do
- Key features
- Pricing (if public)
- Target audience

### 3. Feature Comparison Matrix
A markdown table comparing features across all companies.

### 4. Positioning & Messaging Analysis
How each company positions itself -- tone, key claims, differentiators.

### 5. Strengths & Weaknesses
For the target company relative to competitors.

### 6. Opportunities & Recommendations
Actionable insights based on competitive gaps.

### 7. Sources & Citations
For every claim, cite the source URL where you found the information. List all URLs scraped at the end with a one-line note on what was found there.

---

Be thorough. Scrape real pages, extract real data. Do not make things up -- if pricing isn't public, say so. If a page fails to scrape, try an alternative URL or note the limitation.

Start working immediately when given a target.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('competitor-analysis')
    .description('Analyze a website and its competitive landscape')
    .argument('[url]', 'URL to analyze')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (url, options) => {
      const inputs = await gatherInputs(url ? { url } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ output: inputs.output }),
        buildMessage([
          `Analyze ${inputs.url}`,
          inputs.competitors && `Competitors to include: ${inputs.competitors}`,
          inputs.context,
        ]),
        skipPermissions
      );
    });
}
