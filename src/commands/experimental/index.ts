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
import { register as registerCompetitiveIntel } from './workflows/competitive-intel';
import { register as registerCompanyDirectories } from './workflows/company-directories';
import { register as registerDashboardReporting } from './workflows/dashboard-reporting';
import { register as registerDeepResearch } from './workflows/deep-research';
import { register as registerKnowledgeBase } from './workflows/knowledge-base';
import { register as registerKnowledgeIngest } from './workflows/knowledge-ingest';
import { register as registerLeadGen } from './workflows/lead-gen';
import { register as registerLeadResearch } from './workflows/lead-research';
import { register as registerMarketResearch } from './workflows/market-research';
import { register as registerSeoAudit } from './workflows/seo-audit';
import { register as registerQa } from './workflows/qa';
import { register as registerResearchPapers } from './workflows/research-papers';
import { register as registerDemo } from './workflows/demo';
import { register as registerShop } from './workflows/shop';

// ─── Workflow Registration (shared across backends) ──────────────────────────

function registerWorkflows(parentCmd: Command, backend: Backend): void {
  registerCompetitorAnalysis(parentCmd, backend);
  registerCompetitiveIntel(parentCmd, backend);
  registerCompanyDirectories(parentCmd, backend);
  registerDashboardReporting(parentCmd, backend);
  registerDeepResearch(parentCmd, backend);
  registerKnowledgeBase(parentCmd, backend);
  registerKnowledgeIngest(parentCmd, backend);
  registerLeadGen(parentCmd, backend);
  registerLeadResearch(parentCmd, backend);
  registerMarketResearch(parentCmd, backend);
  registerSeoAudit(parentCmd, backend);
  registerQa(parentCmd, backend);
  registerResearchPapers(parentCmd, backend);
  registerDemo(parentCmd, backend);
  registerShop(parentCmd, backend);
}

// ─── Help text (shared) ─────────────────────────────────────────────────────

function buildHelpText(cmdName: string): string {
  return `
Workflows:
  competitor-analysis    Scrape a site + competitors, compare features, pricing, positioning
  competitive-intel      Monitor competitor dashboards, pricing tiers, and feature changes
  company-directories    Scrape startup directories (YC, Crunchbase, etc.) into structured lists
  dashboard-reporting    Pull metrics from analytics dashboards and internal tools via browser
  deep-research          Multi-source research with configurable depth (5-25+ sources)
  knowledge-base         Build a knowledge base from web content (docs, RAG, fine-tuning)
  knowledge-ingest       Extract auth-gated docs portals into structured JSON or markdown
  lead-gen               Extract prospect contact details from databases at scale via browser
  lead-research          Pre-meeting intelligence brief on a company or person
  market-research        Extract financial data, earnings, and market metrics via browser
  seo-audit              Map a site, check meta/headings, compare to competitors
  qa                     Spawn parallel browser agents to QA test a live site
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

  Monitor competitor pricing and feature changes weekly:
  $ firecrawl ${cmdName} competitive-intel "Linear, Asana, Monday.com"
  $ firecrawl ${cmdName} competitive-intel https://openai.com https://anthropic.com

  Build targeted company lists from startup directories:
  $ firecrawl ${cmdName} company-directories "YC Series A B2B SaaS"
  $ firecrawl ${cmdName} company-directories

  Ingest auth-gated docs portals into structured data:
  $ firecrawl ${cmdName} knowledge-ingest https://docs.internal.company.com
  $ firecrawl ${cmdName} knowledge-ingest https://notion.so/team-wiki

  Extract financial data and market metrics:
  $ firecrawl ${cmdName} market-research "cloud infrastructure market"
  $ firecrawl ${cmdName} market-research "AI SaaS companies"

  Generate leads from prospect databases at scale:
  $ firecrawl ${cmdName} lead-gen "CTOs at Series B fintech startups"
  $ firecrawl ${cmdName} lead-gen "VP Engineering at healthcare companies"

  Pull metrics from analytics dashboards behind login walls:
  $ firecrawl ${cmdName} dashboard-reporting "analytics.google.com, app.mixpanel.com"
  $ firecrawl ${cmdName} dashboard-reporting https://app.stripe.com/dashboard

  Run any workflow fully interactive (no args, prompts guide you):
  $ firecrawl ${cmdName} competitor-analysis
  $ firecrawl ${cmdName} deep-research

Pass -y to auto-approve all tool permissions.
`;
}

// ─── Passthrough (natural language fallback) ─────────────────────────────────

function buildPassthroughSystemPrompt(_userInput: string): string {
  return `You are a Firecrawl power user. You have the full Firecrawl CLI at your disposal to accomplish any web task the user describes.

## First Steps

**Run \`firecrawl --help\` to see all available commands and capabilities.** This is critical -- read the output carefully before proceeding.

Then run \`firecrawl <command> --help\` for whichever specific commands you need.

## Available Tools

Use ONLY \`firecrawl\` for ALL web operations. It is already installed and authenticated. Run firecrawl commands via Bash. Do not use any other tools, skills, plugins, or built-in web features for web access -- only \`firecrawl\`. If the CLI has issues, you may fall back to Firecrawl MCP tools if available.

Quick reference:
- \`firecrawl search "<query>"\` -- Search the web
- \`firecrawl scrape <url>\` -- Scrape a page as markdown
- \`firecrawl scrape <url> --format html\` -- Scrape as HTML
- \`firecrawl map <url>\` -- Discover all URLs on a site
- \`firecrawl crawl <url>\` -- Crawl an entire site
- \`firecrawl interact "Click the login button"\` -- Interact with a scraped page
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
