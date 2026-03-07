/**
 * Workflow: Dashboard Reporting
 *
 * Uses saved browser profiles to log into analytics platforms and internal
 * tools, navigate dashboards, extract metrics, trigger exports, and compile
 * cross-platform reports. Supports any login-gated web dashboard.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  dashboards: string;
  profile: string;
  metrics: string;
  dateRange: string;
  output: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: {
  dashboards?: string;
}): Promise<Inputs> {
  if (prefill?.dashboards) {
    return {
      dashboards: prefill.dashboards,
      profile: '',
      metrics: '',
      dateRange: 'last 7 days',
      output: 'json',
      context: '',
    };
  }

  const { input, select } = await import('@inquirer/prompts');

  const dashboards = await input({
    message:
      'Which dashboards to pull from? (URLs, comma-separated -- e.g., "analytics.google.com, app.mixpanel.com")',
    validate: validateRequired('At least one dashboard URL'),
  });

  const profile = await input({
    message: 'Browser profile for auth? (required for most dashboards)',
    default: '',
  });

  const metrics = await input({
    message:
      'What metrics or data to extract? (leave blank for "everything visible")',
    default: '',
  });

  const dateRange = await select({
    message: 'Date range?',
    choices: [
      { name: 'Last 7 days', value: 'last 7 days' },
      { name: 'Last 30 days', value: 'last 30 days' },
      { name: 'Last 90 days', value: 'last 90 days' },
      { name: 'Month to date', value: 'month to date' },
      { name: 'Year to date', value: 'year to date' },
      { name: 'Custom (specify in context)', value: 'custom' },
    ],
  });

  const output = await select({
    message: 'Output format?',
    choices: [
      { name: 'JSON (structured metrics)', value: 'json' },
      { name: 'Markdown report', value: 'markdown' },
      { name: 'Print to terminal', value: 'terminal' },
    ],
  });

  const context = await input({
    message:
      'Any other instructions? (e.g., "compare to previous period", "focus on conversion funnel")',
    default: '',
  });

  return { dashboards, profile, metrics, dateRange, output, context };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  profile: string;
  dateRange: string;
  output: string;
}): string {
  const profileBlock = opts.profile
    ? `\n### Authentication\n\nUse the saved browser profile \`${opts.profile}\` to access dashboards:\n\`\`\`bash\nfirecrawl browser "open <url>" --profile ${opts.profile}\n\`\`\`\nAfter the first \`open\` with \`--profile\`, subsequent browser commands don't need the flag.\n\nIf you encounter a login page, use the profile's saved cookies/session. If those have expired, tell the user and ask them to re-authenticate the profile.`
    : `\n### Authentication\n\nNo browser profile was specified. If dashboards require login, tell the user they need to provide a browser profile with saved auth. You can still attempt to access public dashboards or demo instances.`;

  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the full dashboard report to the terminal in well-formatted markdown with data tables.',
    json: `Save the report to \`dashboard-report.json\` in the current directory. Tell the user the file path when done.

Use this schema:
\`\`\`json
{
  "reportedAt": "ISO-8601",
  "dateRange": "string",
  "dashboards": [
    {
      "name": "string (platform name)",
      "url": "string",
      "metrics": [
        {
          "name": "string",
          "value": "string | number",
          "unit": "string (e.g. %, users, $)",
          "change": "string (e.g. +12% vs previous period)",
          "period": "string"
        }
      ],
      "tables": [
        {
          "title": "string",
          "headers": ["string"],
          "rows": [["string"]]
        }
      ],
      "exports": [{ "filename": "string", "description": "string" }],
      "notes": "string"
    }
  ],
  "summary": {
    "highlights": ["string"],
    "alerts": ["string"],
    "trends": ["string"]
  }
}
\`\`\``,
    markdown:
      'Save the report to `dashboard-report.md` in the current directory. Tell the user the file path when done.',
  };

  return `You are a dashboard reporting agent powered by Firecrawl. You use a real cloud browser to log into analytics platforms and internal tools, navigate dashboards, extract metrics, and compile cross-platform reports.

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

## STEP 2: Visit Each Dashboard

For each dashboard URL the user provides:

1. **Navigate** to the dashboard
2. **Snapshot** to see the current state
3. **Set the date range** to "${opts.dateRange}" -- look for date pickers, dropdowns, or preset buttons and click them
4. **Extract visible metrics** -- KPIs, summary cards, headline numbers
5. **Explore data tables** -- click through tabs, expand sections, scroll tables
6. **Look for exports** -- if there's a "Download CSV", "Export", or "Report" button, click it
7. **Screenshot key views** by scraping the page content

### Browser commands:
\`\`\`bash
firecrawl browser "open <url>"
firecrawl browser "snapshot"
firecrawl browser "click @<ref>"
firecrawl browser "type @<ref> <text>"
firecrawl browser "scroll down"
firecrawl browser "scrape"
\`\`\`

### Common dashboard patterns:
- **Google Analytics**: Navigate to Reports > Engagement, Acquisition, etc.
- **Mixpanel / Amplitude**: Click through funnels, retention, user flows
- **Stripe / Billing dashboards**: Revenue, MRR, churn, customer counts
- **Internal tools**: Look for nav menus, sidebar items, tab strips
- **Grafana / Datadog**: Expand panels, hover charts for values, adjust time range

### Handling charts and visualizations:
- Charts can't be "read" visually -- instead, look for:
  - Data tables below/beside charts
  - Hover tooltips (snapshot after hovering)
  - "View as table" or "Show data" toggles
  - Export/download buttons for raw data
- If a metric is only in a chart, describe what you can see from the page content

## STEP 3: Compile Report

After visiting all dashboards, compile findings into a unified report:

### Dashboard-by-Dashboard Breakdown
For each platform:
- Platform name and URL
- All metrics extracted with values and units
- Any data tables captured
- Files exported (if any)

### Cross-Platform Summary
- Key highlights across all dashboards
- Alerts (metrics that changed significantly)
- Trends (patterns across platforms)

## Output Format

${outputInstructions[opts.output]}

---

Do everything sequentially -- visit one dashboard at a time. Be thorough: click through tabs, expand sections, scroll to load lazy content. Extract actual numbers, not just labels.

Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('dashboard-reporting')
    .description(
      'Pull metrics from analytics dashboards and internal tools via browser'
    )
    .argument('[dashboards...]', 'Dashboard URLs to pull from')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (dashboardParts: string[], options) => {
      const prefillDashboards =
        dashboardParts.length > 0 ? dashboardParts.join(' ') : undefined;
      const inputs = await gatherInputs(
        prefillDashboards ? { dashboards: prefillDashboards } : undefined
      );

      const parts = [`Pull reports from: ${inputs.dashboards}`];
      if (inputs.metrics)
        parts.push(`Focus on these metrics: ${inputs.metrics}`);
      if (inputs.dateRange !== 'custom')
        parts.push(`Date range: ${inputs.dateRange}`);
      if (inputs.context) parts.push(inputs.context);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          profile: inputs.profile,
          dateRange: inputs.dateRange,
          output: inputs.output,
        }),
        userMessage,
        skipPermissions
      );
    });
}
