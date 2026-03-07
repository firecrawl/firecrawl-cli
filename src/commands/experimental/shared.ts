/**
 * Shared constants and helpers for AI workflows.
 */

import { type Backend, BACKENDS } from './backends';

// ─── Validators ─────────────────────────────────────────────────────────────

export const validateUrl = (value: string): true | string => {
  if (!value.trim()) return 'URL is required';
  try {
    new URL(value.startsWith('http') ? value : `https://${value}`);
    return true;
  } catch {
    return 'Please enter a valid URL';
  }
};

export const validateRequired =
  (label: string) =>
  (value: string): true | string =>
    value.trim() ? true : `${label} is required`;

// ─── URL helpers ────────────────────────────────────────────────────────────

/** Ensure a URL has a protocol prefix. */
export function normalizeUrl(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

/** Normalize a source that might be a URL or a plain topic string. */
export function normalizeSource(source: string): string {
  if (source.startsWith('http')) return source;
  if (/\.\w{2,}/.test(source)) return `https://${source}`;
  return source;
}

// ─── Prompt blocks ──────────────────────────────────────────────────────────

export const FIRECRAWL_TOOLS_BLOCK = `## Your Tools -- READ THIS FIRST

Use ONLY \`firecrawl\` for ALL web operations. It is already installed and authenticated. Run firecrawl commands via Bash. Do not use any other tools, skills, plugins, or built-in web features for web access -- only \`firecrawl\`. If the CLI has issues, you may fall back to Firecrawl MCP tools if available.

**First step: run \`firecrawl --help\` to see all available commands.** Then run \`firecrawl <command> --help\` for any command you plan to use heavily.

Quick reference:
- \`firecrawl search "<query>"\` -- Search the web
- \`firecrawl scrape <url>\` -- Scrape a page as markdown
- \`firecrawl map <url>\` -- Discover all URLs on a site
- \`firecrawl crawl <url>\` -- Crawl an entire site
- \`firecrawl browser "open <url>"\` -- Cloud browser session
- \`firecrawl browser "snapshot"\` -- Get page state
- \`firecrawl browser "click @<ref>"\` -- Click an element
- \`firecrawl browser "type @<ref> <text>"\` -- Type into an input`;

export const QA_TOOLS_BLOCK = `## Your Tools -- READ THIS FIRST

Use ONLY \`firecrawl\` for ALL web operations. It is already installed and authenticated. Run firecrawl commands via Bash. Do not use any other tools, skills, plugins, or built-in web features for web access -- only \`firecrawl\`. If the CLI has issues, you may fall back to Firecrawl MCP tools if available.

**First step: run \`firecrawl --help\` and \`firecrawl browser --help\` to see all commands.** Tell each subagent to do the same.

## IMPORTANT: Launch Browser with Live View FIRST

Before doing anything else, launch a browser session with streaming enabled so the user can watch in real-time:

\`\`\`bash
firecrawl browser launch-session --json
\`\`\`

This prints a **Live View URL**. Try to open it automatically for the user:

\`\`\`bash
open "<liveViewUrl>"          # macOS
xdg-open "<liveViewUrl>"     # Linux
\`\`\`

If the \`open\` command fails or errors, just print the URL clearly so the user can copy-paste it into their browser. Either way, make sure the user sees the live view URL before you start working.

Quick reference:
- \`firecrawl browser "open <url>"\` -- Navigate to a URL in a cloud browser
- \`firecrawl browser "snapshot"\` -- Get the current page state (accessibility tree)
- \`firecrawl browser "click @<ref>"\` -- Click an element by its reference ID
- \`firecrawl browser "type @<ref> <text>"\` -- Type text into an input
- \`firecrawl browser "scrape"\` -- Get the full page content as markdown
- \`firecrawl browser "scroll down"\` / \`"scroll up"\` -- Scroll the page
- \`firecrawl scrape <url>\` -- Quick scrape without browser session
- \`firecrawl map <url>\` -- Discover all URLs on the site`;

export const SUBAGENT_INSTRUCTIONS = `**IMPORTANT:** When spawning agents with the Agent tool:
- Use \`subagent_type: "general-purpose"\` for each agent
- Give each agent a clear, specific mandate in the prompt
- Tell each agent: "Use ONLY firecrawl for all web access via Bash. Do not use any other tools, skills, or plugins for web access. If the CLI has issues, fall back to Firecrawl MCP tools. Run \`firecrawl --help\` first."
- Launch ALL agents in a SINGLE message (parallel, not sequential)
- Each agent should return structured findings with source URLs`;

// ─── Message builder ────────────────────────────────────────────────────────

/** Join non-empty parts into a message string. */
export function buildMessage(parts: string[]): string {
  return parts.filter(Boolean).join('. ') + '.';
}

// ─── Permission helper ──────────────────────────────────────────────────────

export async function askPermissionMode(backend: Backend): Promise<boolean> {
  const { select } = await import('@inquirer/prompts');
  const config = BACKENDS[backend];

  const skipLabel =
    backend === 'codex' ? '--full-auto' : '--dangerously-skip-permissions';

  const mode = await select({
    message: 'How should the agent handle tool permissions?',
    choices: [
      {
        name: 'Auto-approve all (recommended)',
        value: 'skip',
        description: `Runs fully autonomous, no manual approvals. Uses ${skipLabel}.`,
      },
      {
        name: 'Ask me each time',
        value: 'ask',
        description: `${config.displayName} will prompt before running each tool (slower but more control).`,
      },
    ],
  });

  return mode === 'skip';
}
