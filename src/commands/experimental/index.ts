/**
 * Experimental: AI Workflow commands
 *
 * Launches interactive coding agent sessions with pre-built system prompts.
 * Similar to `ollama run <model>` -- one command spins up a specialized agent.
 *
 * Supports multiple backends: Claude Code, Codex (OpenAI), OpenCode.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from './backends';

import { register as registerCompetitorAnalysis } from './workflows/competitor-analysis';
import { register as registerDeepResearch } from './workflows/deep-research';
import { register as registerLeadResearch } from './workflows/lead-research';
import { register as registerSeoAudit } from './workflows/seo-audit';
import { register as registerQa } from './workflows/qa';
import { register as registerKnowledgeBase } from './workflows/knowledge-base';
import { register as registerResearchPapers } from './workflows/research-papers';
import { register as registerDemo } from './workflows/demo';
import { register as registerShop } from './workflows/shop';

// ─── Workflow Registration (shared across backends) ──────────────────────────

function registerWorkflows(parentCmd: Command, backend: Backend): void {
  registerCompetitorAnalysis(parentCmd, backend);
  registerDeepResearch(parentCmd, backend);
  registerLeadResearch(parentCmd, backend);
  registerSeoAudit(parentCmd, backend);
  registerQa(parentCmd, backend);
  registerKnowledgeBase(parentCmd, backend);
  registerResearchPapers(parentCmd, backend);
  registerDemo(parentCmd, backend);
  registerShop(parentCmd, backend);
}

// ─── Help text (shared) ─────────────────────────────────────────────────────

function buildHelpText(cmdName: string): string {
  return `
Workflows:
  competitor-analysis    Scrape a site + competitors, compare features, pricing, positioning
  deep-research          Multi-source research with configurable depth (5-25+ sources)
  lead-research          Pre-meeting intelligence brief on a company or person
  seo-audit              Map a site, check meta/headings, compare to competitors
  qa                     Spawn parallel browser agents to QA test a live site
  knowledge-base         Build a knowledge base from web content (docs, RAG, fine-tuning)
  research-papers        Find and synthesize research papers, whitepapers, and PDFs
  demo                   Walk through a product's key flows using cloud browser
  shop                   Research products across the web, then buy using your saved Amazon session

Examples:

  Prep for a sales call -- research the company, key people, and talking points:
  $ firecrawl ${cmdName} lead-research "Vercel"
  $ firecrawl ${cmdName} lead-research "Stripe"

  Scope out the competition before a pitch:
  $ firecrawl ${cmdName} competitor-analysis https://firecrawl.dev
  $ firecrawl ${cmdName} competitor-analysis https://crawlee.dev

  Research a market, integration opportunity, or partnership angle:
  $ firecrawl ${cmdName} deep-research "RAG pipeline data ingestion tools landscape"
  $ firecrawl ${cmdName} deep-research "Cursor AI editor architecture and extensions"

  Scrape docs so you actually understand a product before the call:
  $ firecrawl ${cmdName} knowledge-base https://docs.langchain.com
  $ firecrawl ${cmdName} knowledge-base https://sdk.vercel.ai/docs

  Build a fine-tuning dataset or RAG corpus from web content:
  $ firecrawl ${cmdName} knowledge-base "Neon serverless postgres"

  Walk through a product's UX -- signup, pricing, docs, dashboard:
  $ firecrawl ${cmdName} demo https://resend.com
  $ firecrawl ${cmdName} demo https://neon.tech

  QA test a site before a demo or client handoff:
  $ firecrawl ${cmdName} qa https://myapp.com

  Audit a site's SEO and get specific fix recommendations:
  $ firecrawl ${cmdName} seo-audit https://example.com

  Find and synthesize research papers on a topic:
  $ firecrawl ${cmdName} research-papers "web scraping compliance healthcare HIPAA"

  Research and shop -- find the best deal, then add to your Amazon cart:
  $ firecrawl ${cmdName} shop "mac mini for SF office delivery"
  $ firecrawl ${cmdName} shop "best mechanical keyboard for developers"
  $ firecrawl ${cmdName} shop "noise cancelling earbuds under 200"

  Run any workflow fully interactive (no args, prompts guide you):
  $ firecrawl ${cmdName} competitor-analysis
  $ firecrawl ${cmdName} deep-research

Pass -y to auto-approve all tool permissions.
`;
}

// ─── Passthrough (natural language fallback) ─────────────────────────────────

const BROWSER_KEYWORDS = [
  'browser',
  'session',
  'profile',
  'click',
  'snapshot',
  'navigate',
  'login',
  'signup',
  'sign up',
  'fill',
  'form',
  'interact',
  'automate',
  'playwright',
  'cdp',
  'cloud browser',
  'cart',
  'add to cart',
  'wishlist',
  'checkout',
  'purchase',
  'buy',
  'order',
  'book',
  'reserve',
  'amazon',
  'account',
];

function isBrowserRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return BROWSER_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildPassthroughSystemPrompt(userInput: string): string {
  const browserSpecific = isBrowserRelated(userInput);

  const browserBlock = browserSpecific
    ? `\n\n**Since this task involves browser interactions**, first launch a browser session with live view so the user can watch:

\`\`\`bash
firecrawl browser launch-session --json
\`\`\`

Show the **Live View URL** to the user immediately so they can open it and watch you work in real-time.

Then run \`firecrawl browser --help\` to understand sessions, profiles, execute commands, and all browser capabilities.

### Profiles (persistent Chrome profiles -- NOT sessions)

A profile is a persistent Chrome profile (cookies, login state, localStorage). It is NOT a session -- it exists independently and survives across sessions.

- **Use a profile:** \`firecrawl browser "open <url>" --profile <name>\` -- creates a new session using the saved Chrome profile data (cookies, auth, etc.)
- **DO NOT** run \`firecrawl browser list\` to look for profiles. Just use \`--profile <name>\` directly.
- After the first \`open\` with \`--profile\`, subsequent browser commands don't need the flag.

If the user mentions "my amazon profile" or "amazon account", just run:
\`firecrawl browser "open https://www.amazon.com" --profile amazon\`

### Browser commands
- \`firecrawl browser "open <url>"\` -- Navigate (auto-launches session if needed)
- \`firecrawl browser "snapshot"\` -- Get page state (accessibility tree)
- \`firecrawl browser "click @<ref>"\` -- Click an element
- \`firecrawl browser "type @<ref> <text>"\` -- Type into an input
- \`firecrawl browser "scrape"\` -- Get full page content as markdown
- \`firecrawl browser "scroll down"\` / \`"scroll up"\` -- Scroll`
    : '';

  return `You are a Firecrawl power user. You have the full Firecrawl CLI at your disposal to accomplish any web task the user describes.

## First Steps

**Run \`firecrawl --help\` to see all available commands and capabilities.** This is critical -- read the output carefully before proceeding.${browserBlock}

Then run \`firecrawl <command> --help\` for whichever specific commands you need.

## Available Tools

Use ONLY \`firecrawl\` for ALL web operations. It is already installed and authenticated. Run firecrawl commands via Bash. Do not use any other tools, skills, plugins, or built-in web features for web access -- only \`firecrawl\`. If the CLI has issues, you may fall back to Firecrawl MCP tools if available.

Quick reference:
- \`firecrawl search "<query>"\` -- Search the web
- \`firecrawl scrape <url>\` -- Scrape a page as markdown
- \`firecrawl scrape <url> --format html\` -- Scrape as HTML
- \`firecrawl map <url>\` -- Discover all URLs on a site
- \`firecrawl crawl <url>\` -- Crawl an entire site
- \`firecrawl download <url>\` -- Download a site into .firecrawl/
- \`firecrawl browser "open <url>"\` -- Cloud browser session
- \`firecrawl browser "snapshot"\` -- Get page state
- \`firecrawl browser "click @<ref>"\` -- Click an element
- \`firecrawl browser "type @<ref> <text>"\` -- Type into an input
- \`firecrawl agent "<prompt>"\` -- AI agent for complex extraction

## Guidelines

- Figure out the right firecrawl commands for the task by reading --help output
- Be resourceful -- combine multiple commands if needed
- Show your work and explain what you're doing
- Start working immediately`;
}

function createBackendCommand(
  name: string,
  description: string,
  backend: Backend
): Command {
  const cmd = new Command(name)
    .description(description)
    .argument('[input...]', 'Natural language task or workflow name')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .allowUnknownOption()
    .addHelpText('after', buildHelpText(name));

  registerWorkflows(cmd, backend);

  // Catch-all: if no subcommand matched, treat args as natural language
  cmd.action(async (input: string[], options: { yes?: boolean }) => {
    const userInput = input.join(' ').trim();
    if (!userInput) {
      cmd.outputHelp();
      return;
    }

    const config = BACKENDS[backend];
    const skipPermissions = true;
    console.log(`\nLaunching ${config.displayName}...\n`);

    launchAgent(
      backend,
      buildPassthroughSystemPrompt(userInput),
      userInput,
      skipPermissions
    );
  });

  return cmd;
}

// ─── Command Exports ─────────────────────────────────────────────────────────

export function createClaudeCommand(): Command {
  return createBackendCommand(
    'claude',
    'AI workflows powered by Claude Code',
    'claude'
  );
}

export function createCodexCommand(): Command {
  return createBackendCommand(
    'codex',
    'AI workflows powered by Codex (coming soon)',
    'codex'
  );
}

export function createOpenCodeCommand(): Command {
  return createBackendCommand(
    'opencode',
    'AI workflows powered by OpenCode (coming soon)',
    'opencode'
  );
}
