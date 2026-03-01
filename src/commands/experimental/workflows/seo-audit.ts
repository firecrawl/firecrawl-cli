/**
 * Workflow: SEO Audit
 *
 * Maps the site, then spawns parallel agents for site structure, on-page SEO,
 * and keyword/competitor analysis. Produces a prioritized audit with specific
 * (not generic) recommendations.
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
  keywords: string;
  output: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { url?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const rawUrl =
    prefill?.url ||
    (await input({
      message: 'What site do you want to audit?',
      validate: validateUrl,
    }));

  const keywords = await input({
    message: 'Target keywords? (comma-separated, leave blank to auto-detect)',
    default: '',
  });

  const output = await select({
    message: 'How should the audit be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as Markdown file', value: 'markdown' },
    ],
  });

  return { url: normalizeUrl(rawUrl), keywords, output };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: { output: string }): string {
  const outputInstructions =
    opts.output === 'markdown'
      ? 'Save the audit to a file called `seo-audit.md` in the current directory. Tell the user the file path when done.'
      : 'Print the full audit to the terminal in well-formatted markdown.';

  return `You are an SEO audit team lead powered by Firecrawl. You orchestrate parallel agents to thoroughly audit a website's search engine optimization.

${FIRECRAWL_TOOLS_BLOCK}

## Your Strategy

You are a **team lead**, not a solo auditor. Your job is to:

1. **Map the site first** -- Run \`firecrawl map\` yourself to discover all pages and understand the site structure.
2. **Spawn parallel subagents** -- Launch agents to audit different aspects simultaneously.
3. **Collect results** -- Each agent reports back findings.
4. **Synthesize** -- Build the prioritized audit with specific recommendations.

## Agent Assignments

Spawn these agents in parallel:
1. **Site Structure Agent** -- Analyze URL structure, check sitemap.xml, evaluate internal linking patterns. Use the sitemap from the map step. Check for orphan pages, redirect chains, broken internal links.
2. **On-Page SEO Agent** -- Scrape key pages (homepage, top product/service pages, blog, about). For each page: check title tag, meta description, heading hierarchy (H1/H2/H3), content length, image alt tags, schema markup.
3. **Keyword & Competitor Agent** -- Search for the site's target keywords. Find who's ranking above them. Scrape top competitors' pages and compare their on-page SEO tactics (titles, headings, content structure, meta).

${SUBAGENT_INSTRUCTIONS}

## Output Format

${outputInstructions}

Structure the audit as:

### Site Structure
- Total pages found
- URL structure quality
- Sitemap health

### On-Page SEO
For each key page:
- Title tag, meta description
- Heading hierarchy (H1, H2, etc.)
- Content length and quality
- Internal linking

### Keyword Analysis
- Current keyword targeting
- Missing keyword opportunities
- Competitor keyword comparison

### Technical Issues
- Broken links, redirects
- Missing meta tags
- Duplicate content concerns

### Competitor Comparison
Who's outranking them and why.

### Recommendations
Prioritized list of fixes (high/medium/low impact).

### Sources
Every URL scraped.

---

Be specific with recommendations. Don't just say "improve meta descriptions" -- say exactly what to change.

Start working immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('seo-audit')
    .description('Run an SEO audit on a website')
    .argument('[url]', 'URL to audit')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (url, options) => {
      const inputs = await gatherInputs(url ? { url } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ output: inputs.output }),
        buildMessage([
          `Audit ${inputs.url}`,
          inputs.keywords && `Target keywords: ${inputs.keywords}`,
        ]),
        skipPermissions
      );
    });
}
