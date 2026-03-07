/**
 * Workflow: Knowledge Base Ingestion
 *
 * Navigates auth-gated documentation portals using saved browser profiles,
 * paginates through articles and sections, and extracts everything into
 * structured JSON. Built for portals that require login, have pagination,
 * or use JS-heavy rendering that static scraping can't handle.
 */

import { Command } from 'commander';
import { type Backend, BACKENDS, launchAgent } from '../backends';
import { validateRequired } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  url: string;
  profile: string;
  format: string;
  maxPages: string;
  context: string;
}

// ─── Input gathering ────────────────────────────────────────────────────────

async function gatherInputs(prefill?: { url?: string }): Promise<Inputs> {
  if (prefill?.url) {
    return {
      url: prefill.url,
      profile: '',
      format: 'json',
      maxPages: '100',
      context: '',
    };
  }

  const { input, select } = await import('@inquirer/prompts');

  const url = await input({
    message: 'URL of the docs portal or knowledge base?',
    validate: validateRequired('URL'),
  });

  const profile = await input({
    message:
      'Browser profile for auth? (leave blank for public/anonymous access)',
    default: '',
  });

  const format = await select({
    message: 'Output format?',
    choices: [
      {
        name: 'Structured JSON (articles with metadata)',
        value: 'json',
      },
      {
        name: 'Markdown files (one per article, .firecrawl/ convention)',
        value: 'markdown',
      },
      {
        name: 'Single merged file (all content in one document)',
        value: 'merged',
      },
    ],
  });

  const maxPages = await input({
    message: 'Max pages to extract?',
    default: '100',
  });

  const context = await input({
    message:
      'Any specific sections or topics to focus on? (leave blank for everything)',
    default: '',
  });

  return { url, profile, format, maxPages, context };
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  profile: string;
  format: string;
  maxPages: string;
}): string {
  const profileBlock = opts.profile
    ? `\n### Authentication\n\nUse the saved browser profile \`${opts.profile}\` to access auth-gated content:\n\`\`\`bash\nfirecrawl browser "open <url>" --profile ${opts.profile}\n\`\`\`\nAfter the first \`open\` with \`--profile\`, subsequent browser commands don't need the flag.`
    : '';

  const outputInstructions: Record<string, string> = {
    json: `Save results to \`knowledge-base.json\` in the current directory. Tell the user the file path when done.

Use this schema:
\`\`\`json
{
  "source": "string (portal name)",
  "url": "string (base URL)",
  "extractedAt": "ISO-8601",
  "totalArticles": 0,
  "sections": [
    {
      "name": "string",
      "articles": [
        {
          "title": "string",
          "url": "string",
          "section": "string",
          "content": "string (full markdown content)",
          "metadata": {
            "lastUpdated": "string",
            "author": "string",
            "tags": ["string"]
          }
        }
      ]
    }
  ]
}
\`\`\``,
    markdown: `Save each article as a separate markdown file following the .firecrawl/ convention:
\`\`\`
.firecrawl/<hostname>/<path>/index.md
\`\`\`

Each file should have frontmatter:
\`\`\`yaml
---
title: "Article Title"
url: "https://..."
section: "Section Name"
lastUpdated: "date if available"
---
\`\`\`

Also create \`.firecrawl/index.md\` as a table of contents. Tell the user the output path when done.`,
    merged: `Save all content to a single \`knowledge-base.md\` file in the current directory with a table of contents at the top. Each article should be a section with its title as a heading. Tell the user the file path when done.`,
  };

  return `You are a knowledge base ingestion agent powered by Firecrawl. You use a real cloud browser to navigate documentation portals -- including auth-gated ones -- paginate through all articles, and extract content into structured formats.

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

## STEP 2: Map the Portal Structure

1. Open the portal's main page / table of contents / sidebar
2. Snapshot to see the navigation structure
3. Identify all sections, categories, or sidebar nav items
4. Build a list of all article URLs to visit

If the portal has a sitemap or API docs index, use that. Otherwise, click through sidebar/nav items to discover pages.

\`\`\`bash
firecrawl browser "open <url>"
firecrawl browser "snapshot"
firecrawl browser "scrape"
\`\`\`

Also try \`firecrawl map <url>\` to discover URLs programmatically -- combine with browser navigation for auth-gated content.

## STEP 3: Extract Articles

For each article/page:

1. **Navigate** to the article URL
2. **Wait** for content to fully render (some portals are JS-heavy)
3. **Scrape** the full page content as markdown
4. **Extract metadata** -- title, section, last updated date, author, tags
5. **Handle pagination** within articles (multi-page docs, "Next" buttons)
6. **Navigate** to the next article

### Pagination strategies:
- **Sidebar navigation**: Click through each sidebar item systematically
- **"Next article" links**: Follow sequential article links
- **Paginated lists**: Click page numbers or "Load More"
- **Infinite scroll**: Scroll down and snapshot to load more items
- **Search/filter**: If the portal has search, use it to find specific sections

### Browser commands:
\`\`\`bash
firecrawl browser "open <url>"
firecrawl browser "snapshot"
firecrawl browser "click @<ref>"
firecrawl browser "scroll down"
firecrawl browser "scrape"
\`\`\`

## Limits

Extract up to ${opts.maxPages} pages. Prioritize breadth (cover all sections) over depth (every sub-article) if you're approaching the limit.

## Output Format

${outputInstructions[opts.format]}

## Quality Guidelines

- Preserve code examples, tables, and formatting
- Strip navigation chrome, headers, footers -- extract only article content
- Note any pages that failed to load or were access-restricted
- Track progress: print "Extracted X/Y articles..." periodically

Do everything sequentially. Start immediately.`;
}

// ─── Command registration ───────────────────────────────────────────────────

export function register(parentCmd: Command, backend: Backend): void {
  const config = BACKENDS[backend];

  parentCmd
    .command('knowledge-ingest')
    .description(
      'Extract auth-gated docs portals into structured JSON or markdown'
    )
    .argument('[url]', 'URL of the docs portal or knowledge base')
    .option('-y, --yes', 'Auto-approve all tool permissions')
    .action(async (url, options) => {
      const inputs = await gatherInputs(url ? { url } : undefined);

      const parts = [`Ingest knowledge base from: ${inputs.url}`];
      if (inputs.context) parts.push(`Focus on: ${inputs.context}`);
      const userMessage = parts.join('. ') + '.';

      const skipPermissions = true;
      console.log(`\nLaunching ${config.displayName}...\n`);

      launchAgent(
        backend,
        buildSystemPrompt({
          profile: inputs.profile,
          format: inputs.format,
          maxPages: inputs.maxPages,
        }),
        userMessage,
        skipPermissions
      );
    });
}
