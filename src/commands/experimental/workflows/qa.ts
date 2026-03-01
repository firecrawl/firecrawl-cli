/**
 * Workflow: QA / Dogfood
 *
 * Acts as a QA team lead: maps the site, then spawns 3-4 parallel subagents
 * that use Firecrawl's cloud browser to click around, fill forms, test
 * interactions, and find bugs simultaneously.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import {
  QA_TOOLS_BLOCK,
  SUBAGENT_INSTRUCTIONS,
  askPermissionMode,
  buildMessage,
  normalizeUrl,
  validateUrl,
} from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  url: string;
  focus: string;
  context: string;
  output: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { url?: string }): Promise<Inputs> {
  const { input, select } = await import('@inquirer/prompts');

  const rawUrl =
    prefill?.url ||
    (await input({
      message: "What's the URL of the site to test?",
      validate: validateUrl,
    }));

  const focus = await select({
    message: 'What should the QA focus on?',
    choices: [
      { name: 'Full exploratory test (everything)', value: 'full' },
      { name: 'Forms and user flows', value: 'forms' },
      { name: 'Navigation and links', value: 'navigation' },
      { name: 'Responsive / mobile issues', value: 'responsive' },
      { name: 'Performance and load times', value: 'performance' },
    ],
  });

  const context = await input({
    message:
      'Any specific areas or known issues to check? (leave blank to skip)',
    default: '',
  });

  const output = await select({
    message: 'How should the report be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as Markdown file', value: 'markdown' },
    ],
  });

  return { url: normalizeUrl(rawUrl), focus, context, output };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: { focus: string; output: string }): string {
  const outputInstructions =
    opts.output === 'markdown'
      ? 'Save the QA report to a file called `qa-report.md` in the current directory. Tell the user the file path when done.'
      : 'Print the final unified QA report to the terminal in well-formatted markdown.';

  const focusInstructions: Record<string, string> = {
    full: `Spawn ALL of these parallel agents:
1. **Navigation & Links Agent** -- Map the site, visit every nav item, check footer links, breadcrumbs, 404s, broken links.
2. **Forms & Interactions Agent** -- Find every form, test valid/invalid submissions, check validation messages, test edge cases (empty, too long, special chars).
3. **Content & Visual Agent** -- Check content quality, heading hierarchy, image alt tags, visual consistency, scroll through all pages.
4. **Error States Agent** -- Hit invalid URLs, test error pages, try unauthorized access, check API error responses visible in the UI.`,
    forms: `Spawn these parallel agents:
1. **Form Discovery Agent** -- Map the site and find every form, input, and interactive element.
2. **Happy Path Agent** -- Test every form with valid data, verify success states.
3. **Edge Case Agent** -- Test with empty fields, max-length inputs, special characters, SQL injection strings, XSS payloads.
4. **Validation Agent** -- Test field-level validation, required fields, format validation (email, phone, etc).`,
    navigation: `Spawn these parallel agents:
1. **Sitemap Agent** -- Map the full site, check sitemap.xml, compare discovered vs listed URLs.
2. **Nav Testing Agent** -- Click every nav item, dropdown, mega menu. Test mobile nav if responsive.
3. **Link Checker Agent** -- Scrape every page for links, verify each one returns 200.
4. **Routing Agent** -- Test back/forward, deep linking, query params, hash routing.`,
    responsive: `Spawn these parallel agents:
1. **Desktop Agent** -- Test at 1920px, 1440px, 1024px widths.
2. **Tablet Agent** -- Test at 768px and 1024px portrait/landscape.
3. **Mobile Agent** -- Test at 375px and 390px widths.
4. **Interaction Agent** -- Test touch targets, overflow, horizontal scroll, zoom behavior.`,
    performance: `Spawn these parallel agents:
1. **Page Load Agent** -- Measure load times for key pages (homepage, product, blog, pricing).
2. **Asset Audit Agent** -- Check image sizes, unoptimized assets, render-blocking scripts.
3. **Content Efficiency Agent** -- Check for lazy loading, pagination, infinite scroll behavior.
4. **Comparison Agent** -- Load competitor sites, compare performance characteristics.`,
  };

  return `You are a QA team lead powered by Firecrawl. You orchestrate parallel testing agents to thoroughly test live websites.

${QA_TOOLS_BLOCK}

## Your Strategy

You are a **team lead**, not a solo tester. Your job is to:

1. **Map the site first** -- Run \`firecrawl map\` yourself to discover all pages.
2. **Spawn parallel subagents** -- Use the Agent tool to launch multiple testing agents simultaneously. Each agent gets a specific testing mandate and a subset of pages.
3. **Collect results** -- Each agent reports back its findings.
4. **Synthesize** -- Merge all agent findings into one unified report, deduplicate issues, and assign severity.

## Agent Assignments

${focusInstructions[opts.focus]}

${SUBAGENT_INSTRUCTIONS}

- Tell each agent which pages to test (divide the sitemap between them)
- Tell each agent to use \`firecrawl browser\` and \`firecrawl scrape\` commands
- Each agent should report findings as: severity (critical/major/minor), URL, description, steps to reproduce

## Output Format

${outputInstructions}

Structure the unified QA report as:

### Summary
- Overall health score (out of 10)
- Pages tested: X
- Issues found: X critical, X major, X minor
- Agents deployed: X

### Critical Issues
Bugs that break functionality or block users:
- **[C-1]** URL | Description | Steps to reproduce | Expected vs actual

### Major Issues
Significant UX problems or broken features:
- **[M-1]** URL | Description | Steps to reproduce

### Minor Issues
Visual glitches, inconsistencies, polish items:
- **[m-1]** URL | Description

### Positive Observations
Things that work particularly well.

### Pages Tested
Full list of every URL visited across all agents.

### Agent Summary
Which agent found what -- brief summary of each agent's work.

---

Start by mapping the site, then immediately fan out your testing agents in parallel.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('qa')
    .description('QA test a live website using Firecrawl cloud browser')
    .argument('[url]', 'URL to test')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (url, options) => {
      const inputs = await gatherInputs(url ? { url } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ focus: inputs.focus, output: inputs.output }),
        buildMessage([`Test ${inputs.url}`, inputs.context]),
        skipPermissions
      );
    });
}
