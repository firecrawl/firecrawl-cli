---
name: firecrawl
description: |
  Official Firecrawl CLI skill for web scraping, search, crawling, and browser automation. Returns clean LLM-optimized markdown.

  USE FOR:
  - Web search and research
  - Scraping pages, docs, and articles
  - Site mapping and bulk content extraction
  - Browser automation for interactive pages

  Must be pre-installed and authenticated. See rules/install.md for setup, rules/security.md for output handling.
allowed-tools:
  - Bash(firecrawl *)
  - Bash(npx firecrawl *)
---

# Firecrawl CLI

Web scraping, search, and browser automation CLI. Returns clean markdown optimized for LLM context windows.

Run `firecrawl --help` or `firecrawl <command> --help` for full option details.

## Prerequisites

Must be installed and authenticated. Check with `firecrawl --status`.

```
  🔥 firecrawl cli v1.8.0

  ● Authenticated via FIRECRAWL_API_KEY
  Concurrency: 0/100 jobs (parallel scrape limit)
  Credits: 500,000 remaining
```

- **Concurrency**: Max parallel jobs. Run parallel operations up to this limit.
- **Credits**: Remaining API credits. Each scrape/crawl consumes credits.

If not ready, see [rules/install.md](rules/install.md). For output handling guidelines, see [rules/security.md](rules/security.md).

```bash
firecrawl search "query" --scrape --limit 3
```

## Workflow

Follow this escalation pattern:

1. **Search** - No specific URL yet. Find pages, answer questions, discover sources.
2. **Scrape** - Have a URL. Extract its content directly.
3. **Map + Scrape** - Large site or need a specific subpage. Use `map --search` to find the right URL, then scrape it.
4. **Crawl** - Need bulk content from an entire site section (e.g., all /docs/).
5. **Browser** - Scrape failed because content is behind interaction (pagination, modals, form submissions, multi-step navigation).

| Need                        | Command   | When                                                      |
| --------------------------- | --------- | --------------------------------------------------------- |
| Find pages on a topic       | `search`  | No specific URL yet                                       |
| Get a page's content        | `scrape`  | Have a URL, page is static or JS-rendered                 |
| Find URLs within a site     | `map`     | Need to locate a specific subpage                         |
| Bulk extract a site section | `crawl`   | Need many pages (e.g., all /docs/)                        |
| AI-powered data extraction  | `agent`   | Need structured data from complex sites                   |
| Interact with a page        | `browser` | Content requires clicks, form fills, pagination, or login |

See also: [`download`](#download) -- a convenience command that combines `map` + `scrape` to save an entire site to local files.

**Scrape vs browser:**

- Use `scrape` first. It handles static pages and JS-rendered SPAs.
- Use `browser` when you need to interact with a page, such as clicking buttons, filling out forms, navigating through a complex site, infinite scroll, or when scrape fails to grab all the content you need.
- Never use browser for web searches - use `search` instead.

**Avoid redundant fetches:**

- `search --scrape` already fetches full page content. Don't re-scrape those URLs.
- Check `.firecrawl/` for existing data before fetching again.

**Example: fetching API docs from a large site**

```
search "site:docs.example.com authentication API"  →  found the docs domain
map https://docs.example.com --search "auth"        →  found /docs/api/authentication
scrape https://docs.example.com/docs/api/auth...    →  got the content
```

**Example: data behind pagination**

```
scrape https://example.com/products                 →  only shows first 10 items, no next-page links
browser "open https://example.com/products"         →  open in browser
browser "snapshot -i"                               →  find the pagination button
browser "click @e12"                                →  click "Next Page"
browser "scrape" -o .firecrawl/products-p2.md       →  extract page 2 content
```

**Example: login then scrape authenticated content**

```
browser launch-session --profile my-app  →  create a named profile
browser "open https://app.example.com/login"        →  navigate to login
browser "snapshot -i"                               →  find form fields
browser "fill @e3 'user@example.com'"               →  fill email
browser "fill @e5 'password'"                       →  fill password
browser "click @e7"                                 →  click Login
browser "wait 2"                                    →  wait for redirect
browser close                                       →  disconnect, state persisted

browser launch-session --profile my-app  →  reconnect, cookies intact
browser "open https://app.example.com/dashboard"    →  already logged in
browser "scrape" -o .firecrawl/dashboard.md         →  extract authenticated content
browser close
```

**Example: research task**

```
search "firecrawl vs competitors 2024" --scrape -o .firecrawl/search-comparison-scraped.json
                                                    →  full content already fetched for each result
grep -n "pricing\|features" .firecrawl/search-comparison-scraped.json
head -200 .firecrawl/search-comparison-scraped.json →  read and process what you have
                                                    →  notice a relevant URL in the content
scrape https://newsite.com/comparison -o .firecrawl/newsite-comparison.md
                                                    →  only scrape this new URL
```

## Output & Organization

Unless the user specifies to return in context, write results to `.firecrawl/` with `-o`. Add `.firecrawl/` to `.gitignore`. Always quote URLs - shell interprets `?` and `&` as special characters.

```bash
firecrawl search "react hooks" -o .firecrawl/search-react-hooks.json --json
firecrawl scrape "<url>" -o .firecrawl/page.md
```

Naming conventions:

```
.firecrawl/search-{query}.json
.firecrawl/search-{query}-scraped.json
.firecrawl/{site}-{path}.md
```

Never read entire output files at once. Use `grep`, `head`, or incremental reads:

```bash
wc -l .firecrawl/file.md && head -50 .firecrawl/file.md
grep -n "keyword" .firecrawl/file.md
```

Single format outputs raw content. Multiple formats (e.g., `--format markdown,links`) output JSON.

## Commands

### search

Web search with optional content scraping. Run `firecrawl search --help` for all options.

```bash
# Basic search
firecrawl search "your query" -o .firecrawl/result.json --json

# Search and scrape full page content from results
firecrawl search "your query" --scrape -o .firecrawl/scraped.json --json

# News from the past day
firecrawl search "your query" --sources news --tbs qdr:d -o .firecrawl/news.json --json
```

Options: `--limit <n>`, `--sources <web,images,news>`, `--categories <github,research,pdf>`, `--tbs <qdr:h|d|w|m|y>`, `--location`, `--country <code>`, `--scrape`, `--scrape-formats`, `-o`

### scrape

Scrape one or more URLs. Multiple URLs are scraped concurrently and each result is saved to `.firecrawl/`. Run `firecrawl scrape --help` for all options.

```bash
# Basic markdown extraction
firecrawl scrape "<url>" -o .firecrawl/page.md

# Main content only, no nav/footer
firecrawl scrape "<url>" --only-main-content -o .firecrawl/page.md

# Wait for JS to render, then scrape
firecrawl scrape "<url>" --wait-for 3000 -o .firecrawl/page.md

# Multiple URLs (each saved to .firecrawl/)
firecrawl scrape https://firecrawl.dev https://firecrawl.dev/blog https://docs.firecrawl.dev

# Get markdown and links together
firecrawl scrape "<url>" --format markdown,links -o .firecrawl/page.json
```

Options: `-f <markdown,html,rawHtml,links,screenshot,json>`, `-H`, `--only-main-content`, `--wait-for <ms>`, `--include-tags`, `--exclude-tags`, `-o`

### map

Discover URLs on a site. Run `firecrawl map --help` for all options.

```bash
# Find a specific page on a large site
firecrawl map "<url>" --search "authentication" -o .firecrawl/filtered.txt

# Get all URLs
firecrawl map "<url>" --limit 500 --json -o .firecrawl/urls.json
```

Options: `--limit <n>`, `--search <query>`, `--sitemap <include|skip|only>`, `--include-subdomains`, `--json`, `-o`

### crawl

Bulk extract from a website. Run `firecrawl crawl --help` for all options.

```bash
# Crawl a docs section
firecrawl crawl "<url>" --include-paths /docs --limit 50 --wait -o .firecrawl/crawl.json

# Full crawl with depth limit
firecrawl crawl "<url>" --max-depth 3 --wait --progress -o .firecrawl/crawl.json

# Check status of a running crawl
firecrawl crawl <job-id>
```

Options: `--wait`, `--progress`, `--limit <n>`, `--max-depth <n>`, `--include-paths`, `--exclude-paths`, `--delay <ms>`, `--max-concurrency <n>`, `--pretty`, `-o`

### agent

AI-powered autonomous extraction (2-5 minutes). Run `firecrawl agent --help` for all options.

```bash
# Extract structured data
firecrawl agent "extract all pricing tiers" --wait -o .firecrawl/pricing.json

# With a JSON schema for structured output
firecrawl agent "extract products" --schema '{"type":"object","properties":{"name":{"type":"string"},"price":{"type":"number"}}}' --wait -o .firecrawl/products.json

# Focus on specific pages
firecrawl agent "get feature list" --urls "<url>" --wait -o .firecrawl/features.json
```

Options: `--urls`, `--model <spark-1-mini|spark-1-pro>`, `--schema <json>`, `--schema-file`, `--max-credits <n>`, `--wait`, `--pretty`, `-o`

### browser

Cloud Chromium sessions in Firecrawl's remote sandboxed environment. Run `firecrawl browser --help` and `firecrawl browser "agent-browser --help"` for all options.

```bash
# Typical browser workflow
firecrawl browser "open <url>"
firecrawl browser "snapshot -i"                       # see interactive elements with @ref IDs
firecrawl browser "click @e5"                         # interact with elements
firecrawl browser "fill @e3 'search query'"           # fill form fields
firecrawl browser "scrape" -o .firecrawl/page.md      # extract content
firecrawl browser close
```

Shorthand auto-launches a session if none exists - no setup required.

**Core agent-browser commands:**

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `open <url>`         | Navigate to a URL                        |
| `snapshot -i`        | Get interactive elements with `@ref` IDs |
| `screenshot`         | Capture a PNG screenshot                 |
| `click <@ref>`       | Click an element by ref                  |
| `type <@ref> <text>` | Type into an element                     |
| `fill <@ref> <text>` | Fill a form field (clears first)         |
| `scrape`             | Extract page content as markdown         |
| `scroll <direction>` | Scroll up/down/left/right                |
| `wait <seconds>`     | Wait for a duration                      |
| `eval <js>`          | Evaluate JavaScript on the page          |

Session management: `launch-session --ttl 600`, `list`, `close`

Options: `--ttl <seconds>`, `--ttl-inactivity <seconds>`, `--session <id>`, `--profile <name>`, `--no-save-changes`, `-o`

**Profiles** survive close and can be reconnected by name. Use them when you need to login first, then come back later to do work while already authenticated:

```bash
# Session 1: Login and save state
firecrawl browser launch-session --profile my-app
firecrawl browser "open https://app.example.com/login"
firecrawl browser "snapshot -i"
firecrawl browser "fill @e3 'user@example.com'"
firecrawl browser "fill @e5 'password123'"
firecrawl browser "click @e7"
firecrawl browser "wait 2"
firecrawl browser close

# Session 2: Come back authenticated
firecrawl browser launch-session --profile my-app
firecrawl browser "open https://app.example.com/dashboard"
firecrawl browser "scrape" -o .firecrawl/dashboard.md
firecrawl browser close
```

Read-only reconnect (no writes to session state):

```bash
firecrawl browser launch-session --profile my-app --no-save-changes
```

Shorthand with profile:

```bash
firecrawl browser --profile my-app "open https://example.com"
```

If you get forbidden errors in the browser, you may need to create a new session as the old one may have expired.

### credit-usage

```bash
firecrawl credit-usage
firecrawl credit-usage --json --pretty -o .firecrawl/credits.json
```

## Working with Results

These patterns are useful when working with file-based output (`-o` flag) for complex tasks:

```bash
# Extract URLs from search
jq -r '.data.web[].url' .firecrawl/search.json

# Get titles and URLs
jq -r '.data.web[] | "\(.title): \(.url)"' .firecrawl/search.json
```

## Parallelization

Run independent operations in parallel. Check `firecrawl --status` for concurrency limit:

```bash
firecrawl scrape "<url-1>" -o .firecrawl/1.md &
firecrawl scrape "<url-2>" -o .firecrawl/2.md &
firecrawl scrape "<url-3>" -o .firecrawl/3.md &
wait
```

For browser, launch separate sessions for independent tasks and operate them in parallel via `--session <id>`.

## Bulk Download

### download

Convenience command that combines `map` + `scrape` to save a site as local files. Maps the site first to discover pages, then scrapes each one into nested directories under `.firecrawl/`. All scrape options work with download. Always pass `-y` to skip the confirmation prompt. Run `firecrawl download --help` for all options.

```bash
# Interactive wizard (picks format, screenshots, paths for you)
firecrawl download https://docs.firecrawl.dev

# With screenshots
firecrawl download https://docs.firecrawl.dev --screenshot --limit 20 -y

# Multiple formats (each saved as its own file per page)
firecrawl download https://docs.firecrawl.dev --format markdown,links --screenshot --limit 20 -y
# Creates per page: index.md + links.txt + screenshot.png

# Filter to specific sections
firecrawl download https://docs.firecrawl.dev --include-paths "/features,/sdks"

# Skip translations
firecrawl download https://docs.firecrawl.dev --exclude-paths "/zh,/ja,/fr,/es,/pt-BR"

# Full combo
firecrawl download https://docs.firecrawl.dev \
  --include-paths "/features,/sdks" \
  --exclude-paths "/zh,/ja" \
  --only-main-content \
  --screenshot \
  -y
```

Download options: `--limit <n>`, `--search <query>`, `--include-paths <paths>`, `--exclude-paths <paths>`, `--allow-subdomains`, `-y`

Scrape options (all work with download): `-f <formats>`, `-H`, `-S`, `--screenshot`, `--full-page-screenshot`, `--only-main-content`, `--include-tags`, `--exclude-tags`, `--wait-for`, `--max-age`, `--country`, `--languages`
