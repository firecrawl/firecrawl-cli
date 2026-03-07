/**
 * Workflow: Market Research
 *
 * Browses financial portals, earnings pages, and market data sites using a
 * cloud browser. Interacts with charts, filters, and dropdowns to extract
 * earnings data, market metrics, and financial comparisons across companies.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  query: string;
  companies: string;
  dataPoints: string;
  output: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { query?: string }): Promise<Inputs> {
  if (prefill?.query) {
    return {
      query: prefill.query,
      companies: '',
      dataPoints: 'all',
      output: 'json',
      context: '',
    };
  }

  const { input, select } = await import('@inquirer/prompts');

  const query = await input({
    message:
      'What market or industry to research? (e.g., "cloud infrastructure", "AI SaaS")',
    validate: validateRequired('Market or industry'),
  });

  const companies = await input({
    message:
      'Specific companies to include? (comma-separated, leave blank to discover)',
    default: '',
  });

  const dataPoints = await select({
    message: 'What data are you looking for?',
    choices: [
      { name: 'Everything (revenue, earnings, metrics, news)', value: 'all' },
      {
        name: 'Financial data (revenue, earnings, margins)',
        value: 'financial',
      },
      {
        name: 'Market metrics (market cap, P/E, growth rates)',
        value: 'metrics',
      },
      { name: 'Industry trends and news', value: 'trends' },
    ],
  });

  const output = await select({
    message: 'Output format?',
    choices: [
      { name: 'JSON (structured data)', value: 'json' },
      { name: 'Markdown report', value: 'markdown' },
      { name: 'Print to terminal', value: 'terminal' },
    ],
  });

  const context = await input({
    message:
      'Any specific angle? (e.g., "focus on Q4 2024 earnings", "compare gross margins")',
    default: '',
  });

  return { query, companies, dataPoints, output, context };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  dataPoints: string;
  output: string;
}): string {
  const focusInstructions: Record<string, string> = {
    all: 'Extract comprehensive data: revenue, earnings, margins, market cap, P/E ratio, growth rates, recent news, and analyst estimates.',
    financial:
      'Focus on financial statements: quarterly/annual revenue, net income, gross margin, operating margin, EPS, and YoY growth.',
    metrics:
      'Focus on market metrics: market cap, P/E ratio, P/S ratio, EV/EBITDA, 52-week range, average volume, and beta.',
    trends:
      'Focus on industry trends: market size estimates, growth forecasts, major deals/acquisitions, regulatory changes, and emerging players.',
  };

  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the full market research report to the terminal in well-formatted markdown with data tables.',
    json: `Save the report to \`market-research.json\` in the current directory. Tell the user the file path when done.

Use this schema:
\`\`\`json
{
  "market": "string",
  "researchedAt": "ISO-8601",
  "companies": [
    {
      "name": "string",
      "ticker": "string",
      "sector": "string",
      "financials": {
        "revenue": { "value": "string", "period": "string", "yoyGrowth": "string" },
        "netIncome": { "value": "string", "period": "string" },
        "grossMargin": "string",
        "operatingMargin": "string",
        "eps": "string"
      },
      "marketMetrics": {
        "marketCap": "string",
        "peRatio": "string",
        "psRatio": "string",
        "52weekHigh": "string",
        "52weekLow": "string"
      },
      "recentNews": [{ "date": "string", "headline": "string", "source": "string", "url": "string" }],
      "sources": ["url"]
    }
  ],
  "industryTrends": [{ "trend": "string", "details": "string", "source": "url" }],
  "sources": [{ "url": "string", "type": "string", "dataExtracted": "string" }]
}
\`\`\``,
    markdown:
      'Save the report to `market-research.md` in the current directory. Tell the user the file path when done.',
  };

  return `You are a market research agent powered by Firecrawl. You use a real cloud browser to navigate financial portals, interact with data visualizations, and extract structured market data.

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

## STEP 2: Identify Target Companies

If the user didn't specify companies, search for key players in the market:

\`\`\`bash
firecrawl search "<market> top public companies"
firecrawl search "<market> industry leaders revenue"
\`\`\`

## STEP 3: Extract Data from Financial Portals

For each company, visit financial data sources and interact with their UIs:

### Primary sources to visit:
- **Yahoo Finance** (finance.yahoo.com) -- Company profile, financials, statistics
- **Macrotrends** (macrotrends.net) -- Historical financials, charts
- **SEC filings** (sec.gov/cgi-bin/browse-edgar) -- For US public companies
- **Company investor relations pages** -- Direct earnings reports

### How to extract data:
1. Navigate to the company's financial page
2. Snapshot to see available data sections
3. Click tabs like "Financials", "Statistics", "Historical Data"
4. Interact with period selectors (quarterly/annual toggles)
5. Scroll through data tables and extract values
6. Click into earnings reports or press releases for details

### Browser commands:
\`\`\`bash
firecrawl browser "open <url>"
firecrawl browser "snapshot"
firecrawl browser "click @<ref>"
firecrawl browser "type @<ref> <text>"
firecrawl browser "scroll down"
firecrawl browser "scrape"
\`\`\`

Also use \`firecrawl scrape <url>\` for quick page grabs when browser interaction isn't needed.

## Data Focus

${focusInstructions[opts.dataPoints]}

## Output Format

${outputInstructions[opts.output]}

Structure your report with:

### Market Overview
- Industry description, size, and growth trajectory
- Key players and market share (if available)

### Company Profiles
For each company:
- Financial summary (revenue, margins, growth)
- Market metrics (cap, ratios)
- Recent developments

### Comparison Tables
- Revenue comparison across companies
- Margin comparison
- Valuation multiples side-by-side

### Trends & Outlook
- Industry trends and forecasts
- Analyst consensus if available

### Sources
- Every URL visited with what data was extracted

---

Do everything sequentially. Cross-reference data across sources when possible. Note any conflicting numbers. Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('market-research')
    .description(
      'Extract financial data, earnings, and market metrics via browser'
    )
    .argument('[query...]', 'Market, industry, or company to research')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (queryParts: string[], options) => {
      const prefillQuery =
        queryParts.length > 0 ? queryParts.join(' ') : undefined;
      const inputs = await gatherInputs(
        prefillQuery ? { query: prefillQuery } : undefined
      );

      const parts = [`Research market: ${inputs.query}`];
      if (inputs.companies)
        parts.push(`Include these companies: ${inputs.companies}`);
      if (inputs.context) parts.push(inputs.context);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          dataPoints: inputs.dataPoints,
          output: inputs.output,
        }),
        userMessage,
        skipPermissions
      );
    });
}
