/**
 * Workflow: Company Directories
 *
 * Browses startup directories (YC, Crunchbase, Product Hunt, etc.), applies
 * filters, paginates through results, and builds targeted company lists
 * with structured data for outreach, research, or CRM import.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  directory: string;
  filters: string;
  maxResults: string;
  output: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { directory?: string }): Promise<Inputs> {
  if (prefill?.directory) {
    return {
      directory: prefill.directory,
      filters: '',
      maxResults: '50',
      output: 'json',
      context: '',
    };
  }

  const { input, select } = await import('@inquirer/prompts');

  const directory = await select({
    message: 'Which directory do you want to scrape?',
    choices: [
      { name: 'Y Combinator (ycombinator.com/companies)', value: 'yc' },
      { name: 'Crunchbase', value: 'crunchbase' },
      { name: 'Product Hunt', value: 'producthunt' },
      { name: 'G2', value: 'g2' },
      { name: 'Custom URL', value: 'custom' },
    ],
  });

  let directoryValue = directory;
  if (directory === 'custom') {
    directoryValue = await input({
      message: 'Enter the directory URL:',
      validate: validateRequired('URL'),
    });
  }

  const filters = await input({
    message:
      'What filters should the agent apply? (e.g., "Series A, B2B SaaS, founded 2023+")',
    default: '',
  });

  const maxResults = await input({
    message: 'How many companies to extract?',
    default: '50',
  });

  const output = await select({
    message: 'Output format?',
    choices: [
      { name: 'JSON (structured, CRM-ready)', value: 'json' },
      { name: 'CSV (spreadsheet-ready)', value: 'csv' },
      { name: 'Print to terminal', value: 'terminal' },
    ],
  });

  const context = await input({
    message:
      'Any other criteria? (e.g., "only companies with pricing pages", "must have API")',
    default: '',
  });

  return {
    directory: directoryValue,
    filters,
    maxResults,
    output,
    context,
  };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  directory: string;
  output: string;
  maxResults: string;
}): string {
  const directoryUrls: Record<string, string> = {
    yc: 'https://www.ycombinator.com/companies',
    crunchbase: 'https://www.crunchbase.com/discover/organization.companies',
    producthunt: 'https://www.producthunt.com',
    g2: 'https://www.g2.com/categories',
  };

  const startUrl = directoryUrls[opts.directory] || opts.directory;

  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the full company list to the terminal as a formatted markdown table.',
    json: `Save the results to \`company-list.json\` in the current directory. Tell the user the file path when done.

Use this schema:
\`\`\`json
{
  "source": "string (directory name)",
  "filters": "string (filters applied)",
  "extractedAt": "ISO-8601",
  "totalResults": 0,
  "companies": [
    {
      "name": "string",
      "url": "string",
      "description": "string",
      "industry": "string",
      "stage": "string (e.g. Seed, Series A)",
      "founded": "string",
      "location": "string",
      "teamSize": "string",
      "funding": "string",
      "tags": ["string"],
      "profileUrl": "string (directory listing URL)",
      "websiteUrl": "string (company website)"
    }
  ]
}
\`\`\``,
    csv: `Save the results to \`company-list.csv\` in the current directory with columns: name, url, description, industry, stage, founded, location, teamSize, funding, tags, profileUrl, websiteUrl. Tell the user the file path when done.`,
  };

  return `You are a company directory scraping agent powered by Firecrawl. You use a real cloud browser to navigate startup directories, apply filters, paginate through results, and extract structured company data.

## STEP 1: Launch Browser and Open Live View

Before anything else, launch a browser session so the user can watch:

\`\`\`bash
firecrawl browser launch-session --json
\`\`\`

Extract the \`interactiveLiveViewUrl\` from the JSON output and open it (NOT the regular \`liveViewUrl\` -- the interactive one lets the user click and interact):

\`\`\`bash
open "<interactiveLiveViewUrl>"          # macOS
xdg-open "<interactiveLiveViewUrl>"     # Linux
\`\`\`

If the \`open\` command fails, print the URL clearly.

## STEP 2: Navigate to Directory

Open the directory:
\`\`\`bash
firecrawl browser "open ${startUrl}"
\`\`\`

## STEP 3: Apply Filters

Take a snapshot to see the page layout:
\`\`\`bash
firecrawl browser "snapshot"
\`\`\`

Look for filter controls (dropdowns, checkboxes, search fields, sidebar filters) and apply the user's requested filters by clicking and typing.

### Browser commands:
\`\`\`bash
firecrawl browser "click @<ref>"
firecrawl browser "type @<ref> <text>"
firecrawl browser "scroll down"
firecrawl browser "snapshot"
firecrawl browser "scrape"
\`\`\`

## STEP 4: Paginate and Extract

After applying filters:

1. **Snapshot** the results page to see company listings
2. **Extract** data from each visible company (name, description, tags, etc.)
3. **Click into** individual company profiles if the listing doesn't have enough detail
4. **Navigate back** and continue to the next listing
5. **Paginate** -- find and click "Next", "Load More", or scroll to trigger infinite scroll
6. Repeat until you've collected ~${opts.maxResults} companies or exhausted results

### Pagination tips:
- Look for "Next" / ">" buttons, page number links, or "Load More"
- Some directories use infinite scroll -- keep scrolling down and snapshotting
- Track how many companies you've extracted to know when to stop
- If a page loads slowly, wait a moment and snapshot again

## Output Format

${outputInstructions[opts.output]}

## Quality Guidelines

- Extract real data from the page, don't infer or guess
- If a field isn't visible, leave it empty rather than fabricating
- Deduplicate companies (same company might appear in multiple pages)
- For each company, try to get at minimum: name, description, and URL

Do everything sequentially. Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('company-directories')
    .description(
      'Scrape startup directories (YC, Crunchbase, etc.) into structured lists'
    )
    .argument('[query...]', 'Directory name or filters to apply')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (queryParts: string[], options) => {
      const prefillDir =
        queryParts.length > 0 ? queryParts.join(' ') : undefined;
      const inputs = await gatherInputs(
        prefillDir ? { directory: prefillDir } : undefined
      );

      const parts = [`Scrape directory: ${inputs.directory}`];
      if (inputs.filters) parts.push(`Filters: ${inputs.filters}`);
      if (inputs.maxResults)
        parts.push(`Extract up to ${inputs.maxResults} companies`);
      if (inputs.context) parts.push(inputs.context);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          directory: inputs.directory,
          output: inputs.output,
          maxResults: inputs.maxResults,
        }),
        userMessage,
        skipPermissions
      );
    });
}
