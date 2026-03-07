/**
 * Workflow: Competitive Intelligence
 *
 * Logs into competitor dashboards using saved browser profiles, clicks through
 * pricing tiers, feature pages, and changelogs to detect plan changes.
 * Designed for weekly monitoring runs with structured diff output.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  competitors: string;
  focus: string;
  profile: string;
  output: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: {
  competitors?: string;
}): Promise<Inputs> {
  if (prefill?.competitors) {
    return {
      competitors: prefill.competitors,
      focus: 'all',
      profile: '',
      output: 'json',
      context: '',
    };
  }

  const { input, select } = await import('@inquirer/prompts');

  const competitors = await input({
    message: 'Which competitors to monitor? (URLs or names, comma-separated)',
    validate: validateRequired('At least one competitor'),
  });

  const focus = await select({
    message: 'What should the agent focus on?',
    choices: [
      { name: 'Everything (pricing, features, changelog)', value: 'all' },
      { name: 'Pricing tiers & plan changes only', value: 'pricing' },
      { name: 'Feature pages & product updates', value: 'features' },
      { name: 'Blog / changelog / release notes', value: 'changelog' },
    ],
  });

  const profile = await input({
    message:
      'Browser profile to use for auth? (leave blank for anonymous browsing)',
    default: '',
  });

  const output = await select({
    message: 'How should the report be delivered?',
    choices: [
      { name: 'Print to terminal', value: 'terminal' },
      { name: 'Save as JSON (structured diffs)', value: 'json' },
      { name: 'Save as Markdown file', value: 'markdown' },
    ],
  });

  const context = await input({
    message:
      'Any other context? (e.g., "compare to our Pro plan", "focus on API limits")',
    default: '',
  });

  return { competitors, focus, profile, output, context };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  focus: string;
  profile: string;
  output: string;
}): string {
  const focusInstructions: Record<string, string> = {
    all: 'Extract pricing tiers (plan names, prices, feature lists, limits), product feature pages, and recent changelog/blog entries.',
    pricing:
      'Focus exclusively on pricing pages. Extract every plan name, price, billing period, feature list, and usage limit. Note any "Contact Sales" tiers.',
    features:
      'Focus on product/feature pages. Extract feature names, descriptions, availability per plan, and any recent additions or deprecations.',
    changelog:
      'Focus on blogs, changelogs, and release notes. Extract recent product updates, new features, breaking changes, and deprecation notices.',
  };

  const profileBlock = opts.profile
    ? `\n### Browser Profile\n\nUse the saved browser profile \`${opts.profile}\` to access auth-gated pages:\n\`\`\`bash\nfirecrawl browser "open <url>" --profile ${opts.profile}\n\`\`\`\nAfter the first \`open\` with \`--profile\`, subsequent browser commands don't need the flag.`
    : '';

  const outputInstructions: Record<string, string> = {
    terminal:
      'Print the full intelligence report to the terminal in well-formatted markdown.',
    json: `Save the report as structured JSON to \`competitive-intel.json\` in the current directory. Tell the user the file path when done.

Use this schema:
\`\`\`json
{
  "generatedAt": "ISO-8601",
  "competitors": [
    {
      "name": "string",
      "url": "string",
      "pricing": {
        "lastChecked": "ISO-8601",
        "tiers": [{ "name": "string", "price": "string", "period": "string", "features": ["string"], "limits": {} }]
      },
      "recentChanges": [{ "date": "string", "type": "pricing | feature | deprecation", "summary": "string", "details": "string", "source": "url" }],
      "features": [{ "name": "string", "description": "string", "availableOn": ["plan names"] }],
      "sources": ["url"]
    }
  ]
}
\`\`\``,
    markdown:
      'Save the report to a file called `competitive-intel.md` in the current directory. Tell the user the file path when done.',
  };

  return `You are a competitive intelligence agent powered by Firecrawl. You use a real cloud browser to visit competitor sites, navigate dashboards, and extract pricing and feature data.

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

If the \`open\` command fails, print the URL clearly so the user can copy-paste it.
${profileBlock}

## STEP 2: Visit Each Competitor

For each competitor:

1. Navigate to their main site
2. Find and visit their **pricing page** -- click through every tier, toggle annual/monthly, expand feature comparison tables
3. Find **feature/product pages** -- click into each feature, note capabilities and limits
4. Find **changelog / blog / release notes** -- look for recent updates in the last 30 days
5. Take snapshots at each step to extract data

### Browser commands:
\`\`\`bash
firecrawl browser "open <url>"
firecrawl browser "snapshot"
firecrawl browser "click @<ref>"
firecrawl browser "type @<ref> <text>"
firecrawl browser "scroll down"
firecrawl browser "scrape"
\`\`\`

You can also use \`firecrawl scrape <url>\` for quick page grabs when browser interaction isn't needed.

## Focus

${focusInstructions[opts.focus]}

## Output Format

${outputInstructions[opts.output]}

Structure your report with:

### Per-Competitor Breakdown
- Company name & URL
- Pricing tiers (plan name, price, billing period, key features, limits)
- Recent changes detected (with dates and source URLs)
- Feature inventory

### Cross-Competitor Comparison
- Pricing comparison table (plans side-by-side)
- Feature matrix
- Key differentiators

### Alerts & Insights
- Notable pricing changes or new tiers
- Feature gaps or opportunities
- Market positioning shifts

### Sources
- Every URL visited with what was found

---

Do everything sequentially -- visit one competitor at a time. Be thorough: click toggle switches, expand accordions, scroll to load lazy content. Extract real data, not summaries of page titles.

Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('competitive-intel')
    .description(
      'Monitor competitor pricing, features, and changes via browser'
    )
    .argument('[competitors...]', 'Competitor URLs or names')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (competitorParts: string[], options) => {
      const prefillCompetitors =
        competitorParts.length > 0 ? competitorParts.join(' ') : undefined;
      const inputs = await gatherInputs(
        prefillCompetitors ? { competitors: prefillCompetitors } : undefined
      );

      const parts = [`Monitor these competitors: ${inputs.competitors}`];
      if (inputs.context) parts.push(inputs.context);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          focus: inputs.focus,
          profile: inputs.profile,
          output: inputs.output,
        }),
        userMessage,
        skipPermissions
      );
    });
}
