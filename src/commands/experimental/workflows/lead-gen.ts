/**
 * Workflow: Lead Generation
 *
 * Uses a cloud browser to fill search forms on prospect databases (Apollo,
 * LinkedIn Sales Nav, ZoomInfo, etc.), apply filters, paginate through
 * results, and extract contact details at scale into structured formats.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  target: string;
  source: string;
  profile: string;
  maxLeads: string;
  output: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { target?: string }): Promise<Inputs> {
  if (prefill?.target) {
    return {
      target: prefill.target,
      source: 'auto',
      profile: '',
      maxLeads: '50',
      output: 'json',
      context: '',
    };
  }

  const { input, select } = await import('@inquirer/prompts');

  const target = await input({
    message:
      'Describe your ideal prospects (e.g., "CTOs at Series B fintech startups in NYC")',
    validate: validateRequired('Target description'),
  });

  const source = await select({
    message: 'Where should the agent search?',
    choices: [
      { name: 'Auto-detect best sources', value: 'auto' },
      { name: 'Apollo.io', value: 'apollo' },
      { name: 'LinkedIn (requires profile)', value: 'linkedin' },
      { name: 'Crunchbase', value: 'crunchbase' },
      { name: 'Custom URL / database', value: 'custom' },
    ],
  });

  let sourceValue = source;
  if (source === 'custom') {
    sourceValue = await input({
      message: 'Enter the database URL:',
      validate: validateRequired('URL'),
    });
  }

  const profile = await input({
    message: 'Browser profile for auth? (leave blank for anonymous access)',
    default: '',
  });

  const maxLeads = await input({
    message: 'How many leads to extract?',
    default: '50',
  });

  const output = await select({
    message: 'Output format?',
    choices: [
      { name: 'JSON (structured, CRM-ready)', value: 'json' },
      { name: 'CSV (spreadsheet/CRM import)', value: 'csv' },
      { name: 'Print to terminal', value: 'terminal' },
    ],
  });

  const context = await input({
    message:
      'Any other criteria? (e.g., "must have email", "exclude consultants")',
    default: '',
  });

  return {
    target,
    source: sourceValue,
    profile,
    maxLeads,
    output,
    context,
  };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  source: string;
  profile: string;
  maxLeads: string;
  output: string;
}): string {
  const sourceUrls: Record<string, string> = {
    apollo: 'https://app.apollo.io',
    linkedin: 'https://www.linkedin.com/sales',
    crunchbase: 'https://www.crunchbase.com/discover/people',
  };

  const sourceHint =
    opts.source === 'auto'
      ? 'Start by searching the web to find the best prospect databases for this target audience. Try Apollo.io, LinkedIn, Crunchbase, industry directories, or any relevant databases.'
      : `Start at: ${sourceUrls[opts.source] || opts.source}`;

  const profileBlock = opts.profile
    ? `\n### Authentication\n\nUse the saved browser profile \`${opts.profile}\`:\n\`\`\`bash\nfirecrawl browser "open <url>" --profile ${opts.profile}\n\`\`\`\nAfter the first \`open\` with \`--profile\`, subsequent browser commands don't need the flag.`
    : '';

  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the lead list to the terminal as a formatted markdown table.',
    json: `Save results to \`leads.json\` in the current directory. Tell the user the file path when done.

Use this schema:
\`\`\`json
{
  "query": "string (target description)",
  "source": "string (database used)",
  "extractedAt": "ISO-8601",
  "totalLeads": 0,
  "leads": [
    {
      "name": "string",
      "title": "string",
      "company": "string",
      "companyUrl": "string",
      "location": "string",
      "email": "string (if available)",
      "linkedin": "string (if available)",
      "phone": "string (if available)",
      "industry": "string",
      "companySize": "string",
      "fundingStage": "string",
      "notes": "string",
      "profileUrl": "string (source listing URL)"
    }
  ]
}
\`\`\``,
    csv: `Save results to \`leads.csv\` in the current directory with columns: name, title, company, companyUrl, location, email, linkedin, phone, industry, companySize, fundingStage, notes, profileUrl. Tell the user the file path when done.`,
  };

  return `You are a lead generation agent powered by Firecrawl. You use a real cloud browser to search prospect databases, fill in filters, paginate through results, and extract structured contact data.

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
${profileBlock}

## STEP 2: Navigate to Prospect Database

${sourceHint}

## STEP 3: Apply Filters and Search

1. **Snapshot** the page to see available search/filter controls
2. **Fill search forms** -- type the target criteria into search bars
3. **Apply filters** -- click dropdowns, checkboxes, sliders for:
   - Job title / role
   - Company size
   - Industry / sector
   - Location / geography
   - Funding stage
   - Technologies used
4. **Execute the search** -- click "Search" or wait for auto-results

### Browser commands:
\`\`\`bash
firecrawl browser "open <url>"
firecrawl browser "snapshot"
firecrawl browser "click @<ref>"
firecrawl browser "type @<ref> <text>"
firecrawl browser "scroll down"
firecrawl browser "scrape"
\`\`\`

## STEP 4: Extract and Paginate

After filtering:

1. **Snapshot** the results to see lead listings
2. **Extract** visible data from each lead (name, title, company, etc.)
3. **Click into profiles** if the listing doesn't have enough detail
4. **Navigate back** to the results list
5. **Paginate** -- click "Next", page numbers, or scroll for more
6. Repeat until you've collected ~${opts.maxLeads} leads or exhausted results

### Tips:
- Some databases show partial info (e.g., masked emails) -- extract what's visible
- If you get rate-limited or CAPTCHAed, note it and move to the next result
- Track progress: print "Extracted X/${opts.maxLeads} leads..." periodically
- Deduplicate leads that appear in multiple pages

## Output Format

${outputInstructions[opts.output]}

## Important

- Only extract publicly visible or legitimately accessible data
- Note any fields that were partially masked or unavailable
- If a source requires paid access for full data, note what's behind the paywall

Do everything sequentially. Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('lead-gen')
    .description(
      'Extract prospect contact details from databases at scale via browser'
    )
    .argument(
      '[target...]',
      'Describe ideal prospects (e.g., "CTOs at B2B SaaS startups")'
    )
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (targetParts: string[], options) => {
      const prefillTarget =
        targetParts.length > 0 ? targetParts.join(' ') : undefined;
      const inputs = await gatherInputs(
        prefillTarget ? { target: prefillTarget } : undefined
      );

      const parts = [`Find leads matching: ${inputs.target}`];
      if (inputs.source !== 'auto') parts.push(`Search on: ${inputs.source}`);
      if (inputs.context) parts.push(inputs.context);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          source: inputs.source,
          profile: inputs.profile,
          maxLeads: inputs.maxLeads,
          output: inputs.output,
        }),
        userMessage,
        skipPermissions
      );
    });
}
