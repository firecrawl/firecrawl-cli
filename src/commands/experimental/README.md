# Experimental: AI Workflows

Launch pre-built AI workflows powered by Firecrawl + your coding agent. One command gathers your inputs, then drops you into an interactive agent session with the right tools and instructions.

Think `ollama run` but for web research agents. All workflows spawn parallel subagents to divide the work and finish faster.

## Supported Backends

| Backend                                                       | Command                         | Status      |
| ------------------------------------------------------------- | ------------------------------- | ----------- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `firecrawl claude <workflow>`   | Available   |
| [Codex (OpenAI)](https://github.com/openai/codex)             | `firecrawl codex <workflow>`    | Coming soon |
| [OpenCode](https://github.com/opencode-ai/opencode)           | `firecrawl opencode <workflow>` | Coming soon |

The same workflows work across all backends - only the spawn command changes. System prompts, interactive flows, and output formats are shared.

## Prerequisites

- [Firecrawl CLI](../../README.md) installed and authenticated (`firecrawl login`)
- At least one supported backend installed:
  - Claude Code: `npm i -g @anthropic-ai/claude-code`
  - Codex: `npm i -g @openai/codex`
  - OpenCode: [install instructions](https://opencode.ai/docs/cli/)

## Available Workflows

### `competitor-analysis` - Competitive landscape analysis

Spawns parallel agents -- one per company -- to scrape and profile the target and each competitor simultaneously. The team lead synthesizes results into a full report: company overviews, feature comparison matrix, positioning analysis, strengths/weaknesses, and actionable recommendations. Citations included by default.

```bash
# Interactive (asks questions step by step)
firecrawl claude competitor-analysis

# One-liner
firecrawl claude competitor-analysis https://firecrawl.dev -y

# With specific competitors and JSON output
firecrawl claude competitor-analysis https://firecrawl.dev \
  --competitors "apify,scrapy,crawlee" \
  -o json -y
```

| Option                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `--competitors <list>`  | Comma-separated competitor names or URLs |
| `--context <text>`      | Additional context for the analysis      |
| `-o, --output <format>` | `terminal` (default), `markdown`, `json` |
| `-y, --yes`             | Auto-approve all tool permissions        |

---

### `deep-research` - Multi-source topic research

Breaks the topic into research angles, then spawns parallel agents -- one per angle (overview, technical, market, contrarian). Each agent searches and scrapes from their perspective. Results are cross-referenced and synthesized into a structured report. Three depth levels control how many sources are consulted.

```bash
# Interactive
firecrawl claude deep-research

# One-liner with depth
firecrawl claude deep-research "AI code generation landscape" --depth exhaustive -y

# Quick overview saved to file
firecrawl claude deep-research "WebSocket alternatives" --depth quick -o markdown -y
```

| Option                  | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `--depth <level>`       | `quick` (5-10 sources), `thorough` (15-25), `exhaustive` (25+) |
| `--context <text>`      | Specific angles or questions to focus on                       |
| `-o, --output <format>` | `terminal` (default), `markdown`, `json`                       |
| `-y, --yes`             | Auto-approve all tool permissions                              |

---

### `lead-research` - Pre-meeting intelligence brief

Spawns parallel agents to research a company, recent news/activity, and optionally a specific person -- all at once. Results are synthesized into a brief with talking points and pain points.

```bash
# Interactive
firecrawl claude lead-research

# One-liner
firecrawl claude lead-research "Stripe" --person "Patrick Collison" --context "partnership call" -y
```

| Option                  | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `--person <name>`       | Specific person to research                              |
| `--context <text>`      | Meeting context (e.g., "sales call", "partnership eval") |
| `-o, --output <format>` | `terminal` (default), `markdown`                         |
| `-y, --yes`             | Auto-approve all tool permissions                        |

---

### `seo-audit` - Full SEO audit

Maps the site, then spawns parallel agents for site structure, on-page SEO, and keyword/competitor analysis. Produces a prioritized audit with specific (not generic) recommendations.

```bash
# Interactive
firecrawl claude seo-audit

# One-liner
firecrawl claude seo-audit https://example.com --keywords "scraping,api,web data" -y
```

| Option                  | Description                       |
| ----------------------- | --------------------------------- |
| `--keywords <list>`     | Comma-separated target keywords   |
| `-o, --output <format>` | `terminal` (default), `markdown`  |
| `-y, --yes`             | Auto-approve all tool permissions |

---

### `qa` - Parallel QA testing with cloud browser

Acts as a QA team lead: maps the site, then spawns 3-4 parallel subagents that use Firecrawl's cloud browser to click around, fill forms, test interactions, and find bugs simultaneously. Results are merged into a unified report.

```bash
# Interactive
firecrawl claude qa

# One-liner
firecrawl claude qa https://myapp.com -y

# Focus on specific area
firecrawl claude qa https://myapp.com --focus forms -y
```

| Option                  | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `--focus <area>`        | `full` (default), `forms`, `navigation`, `responsive`, `performance` |
| `--context <text>`      | Specific areas or known issues to check                              |
| `-o, --output <format>` | `terminal` (default), `markdown`                                     |
| `-y, --yes`             | Auto-approve all tool permissions                                    |

**Focus areas and their agent teams:**

| Focus         | Agents                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| `full`        | Navigation & Links, Forms & Interactions, Content & Visual, Error States |
| `forms`       | Form Discovery, Happy Path, Edge Cases, Validation                       |
| `navigation`  | Sitemap, Nav Testing, Link Checker, Routing                              |
| `responsive`  | Desktop, Tablet, Mobile, Interaction                                     |
| `performance` | Page Load, Asset Audit, Content Efficiency, Comparison                   |

---

## How It Works

Each workflow:

1. **Gathers inputs** - Interactive prompts (or CLI flags for one-liners)
2. **Asks about permissions** - Auto-approve all tools, or approve each manually
3. **Launches the agent** - Spawns an interactive session with workflow instructions as the system prompt
4. **Agent self-discovers tools** - First thing it does is run `firecrawl --help` to learn the full CLI
5. **Parallel subagents** - The lead agent spawns specialized subagents that work simultaneously
6. **You stay in control** - It's an interactive session, so you can follow up, redirect, or ask for more detail

## The `-y` Flag

By default, each workflow asks how the agent should handle tool permissions:

```
? How should the agent handle tool permissions?
> Auto-approve all (recommended)
  Ask me each time
```

Pass `-y` to skip this prompt and auto-approve everything. This adds `--dangerously-skip-permissions` to the Claude spawn.

## Adding New Workflows

Each workflow is a function pair in `claude.ts`:

1. `gatherXxxInputs()` - Interactive prompts using `@inquirer/prompts`
2. `buildXxxSystemPrompt()` - System prompt with instructions and output format

The shared `launchAgent()` function handles spawning. Add a new command in `registerWorkflows()` and you're done.

## Multi-Backend Architecture

The system prompts and interactive flows are backend-agnostic - they just tell the agent to use `firecrawl` CLI commands. The only backend-specific part is the spawn function:

| Backend     | Spawn          | System prompt            | Skip permissions                 |
| ----------- | -------------- | ------------------------ | -------------------------------- |
| Claude Code | `claude`       | `--append-system-prompt` | `--dangerously-skip-permissions` |
| Codex       | `codex`        | `--config` / profile     | `--full-auto` or `--yolo`        |
| OpenCode    | `opencode run` | `--prompt`               | `OPENCODE_PERMISSION` env var    |

To add a new backend, create a launcher function and register the command group in `index.ts`.
