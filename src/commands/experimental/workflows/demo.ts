/**
 * Workflow: Demo Walkthrough
 *
 * Uses Firecrawl's cloud browser to walk through a product's key flows --
 * signup, onboarding, pricing, docs -- step by step. Captures every screen,
 * documents interactions, and produces a structured walkthrough report.
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
      message: 'What product do you want to walk through?',
      validate: validateUrl,
    }));

  const focus = await select({
    message: 'What flows should the agent explore?',
    choices: [
      { name: 'Full product walkthrough (all key flows)', value: 'full' },
      { name: 'Signup and onboarding flow', value: 'signup' },
      { name: 'Pricing and plans', value: 'pricing' },
      { name: 'Documentation and developer experience', value: 'docs' },
      { name: 'Dashboard and core product', value: 'dashboard' },
    ],
  });

  const context = await input({
    message: 'Anything specific to look for? (leave blank to skip)',
    default: '',
  });

  const output = await select({
    message: 'How should the walkthrough be delivered?',
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
      ? 'Save the walkthrough to a file called `demo-walkthrough.md` in the current directory. Tell the user the file path when done.'
      : 'Print the full walkthrough to the terminal in well-formatted markdown.';

  const focusInstructions: Record<string, string> = {
    full: `Spawn these parallel agents, each walking a different flow:
1. **Homepage & Marketing Agent** -- Open the homepage. Click through marketing pages (features, about, use cases). Document the messaging, value prop, key claims, and CTAs. Note what's above the fold vs below.
2. **Signup & Onboarding Agent** -- Find the signup/get-started flow. Walk through every step of signup and onboarding. Document each screen, what's required, friction points, and the first-run experience. Do NOT submit real credentials -- just document the flow.
3. **Pricing & Plans Agent** -- Navigate to pricing. Click to expand tiers, toggle monthly/annual, check feature comparisons. Document every plan, price, and feature. Look for hidden costs or confusing language.
4. **Docs & Developer Experience Agent** -- Navigate to docs. Walk through the quickstart guide. Check navigation, code examples, search functionality. Document the developer onboarding experience.`,

    signup: `Spawn these parallel agents to thoroughly explore the signup and onboarding experience:
1. **Signup Discovery Agent** -- Find every signup entry point (header CTA, pricing page, landing pages). Document how many clicks to get to signup from different starting points.
2. **Signup Flow Agent** -- Walk through the signup form step by step. Document every field, validation message, and screen transition. Note required vs optional fields. Do NOT submit real credentials.
3. **Onboarding Agent** -- After signup screens, document the onboarding flow: welcome screens, setup wizards, tutorials, first-run experience. Walk through every step.
4. **Social Proof Agent** -- Look for trust signals during signup: testimonials, logos, security badges, terms. Document what reassurance the user gets during the flow.`,

    pricing: `Spawn these parallel agents to deeply analyze the pricing experience:
1. **Pricing Page Agent** -- Navigate to the pricing page. Snapshot the full layout. Toggle between monthly/annual. Click to expand feature lists. Document every plan name, price, and feature.
2. **Feature Comparison Agent** -- Find the feature comparison table or matrix. Click through each tier's detail page. Document what's included and excluded at each level.
3. **Pricing Discovery Agent** -- Check multiple entry points to pricing (nav, footer, CTAs). Look for different pricing shown to different segments. Check if pricing changes based on region or plan selection.
4. **Competitor Pricing Agent** -- Search for and scrape competitor pricing pages. Build a side-by-side comparison of pricing tiers and features.`,

    docs: `Spawn these parallel agents to walk through the documentation experience:
1. **Quickstart Agent** -- Find and follow the quickstart guide from start to finish. Try every step. Document the experience: was it clear? Were code examples correct? How long would it take a new developer?
2. **Navigation Agent** -- Explore the doc structure. Click through the sidebar, use search, check breadcrumbs. Document the information architecture and how easy it is to find things.
3. **Code Examples Agent** -- Find code examples across the docs. Check multiple languages/SDKs. Document which are available, their quality, and whether they look copy-pasteable.
4. **API Reference Agent** -- Find the API reference. Walk through endpoints, check request/response examples, look for interactive "try it" features. Document completeness and usability.`,

    dashboard: `Spawn these parallel agents to explore the core product experience:
1. **Entry Point Agent** -- Find the login/dashboard entry. Document what the user sees on first login. Walk through the main navigation. Map out the product sections.
2. **Core Flow Agent** -- Identify the primary user action (create something, configure something). Walk through it step by step. Document each screen and interaction.
3. **Settings & Config Agent** -- Explore settings, integrations, API keys, team management. Document what's configurable and how.
4. **Help & Support Agent** -- Find help resources within the product: tooltips, help center links, chat widgets, documentation links. Document what support is available in-context.`,
  };

  return `You are a product demo team lead powered by Firecrawl. You walk through a product's key flows using cloud browser automation, documenting every screen and interaction.

${QA_TOOLS_BLOCK}

## Your Strategy

You are a **team lead**. Your job is to:

1. **Open the site first** -- Run \`firecrawl browser "open <url>"\` yourself to get the initial page state and understand the site structure.
2. **Spawn parallel subagents** -- Each agent walks through a different flow using \`firecrawl browser\`. They click, scroll, type, and snapshot their way through the product.
3. **Collect results** -- Each agent reports back a step-by-step walkthrough of their flow.
4. **Synthesize** -- Merge all walkthroughs into one structured report.

## Agent Assignments

${focusInstructions[opts.focus]}

${SUBAGENT_INSTRUCTIONS}

- Tell each agent to use \`firecrawl browser\` commands to navigate interactively
- Each agent should describe every screen they see: layout, content, CTAs, forms
- Agents should \`firecrawl browser "snapshot"\` at each step to see interactive elements
- Agents should note the user experience: what's clear, what's confusing, what's missing

## Output Format

${outputInstructions}

Structure the walkthrough as:

### Product Overview
One paragraph summary of what the product does based on exploring it.

### Flow Walkthroughs

For each flow explored:

#### [Flow Name]
Step-by-step walkthrough:
1. **[Screen/Page Name]** -- What's on screen, key elements, what the user would do next
2. **[Next Screen]** -- What changed, new elements, user actions available
...

Key observations:
- What works well
- What's confusing or could be improved
- Notable UX patterns

### Key Findings
- First impression and overall UX quality
- Standout features or patterns
- Friction points or usability issues
- How the product compares to typical products in the space

### Recommendations
What could be improved, from a user experience perspective.

### Pages Visited
Full list of every URL the agents navigated to.

---

Be specific and descriptive. Don't just say "the pricing page looks good" -- describe what's on it, how it's organized, and what makes it effective or not.

Start by opening the site, then immediately fan out your agents to walk through different flows in parallel.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('demo')
    .description("Walk through a product's key flows using cloud browser")
    .argument('[url]', 'Product URL to explore')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (url, options) => {
      const inputs = await gatherInputs(url ? { url } : undefined);

      const skipPermissions = options.yes || (await askPermissionMode(backend));
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({ focus: inputs.focus, output: inputs.output }),
        buildMessage([`Walk through ${inputs.url}`, inputs.context]),
        skipPermissions
      );
    });
}
