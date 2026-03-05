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

# Firecrawl CLI v1.9.2

Web scraping, search, and browser automation. Returns clean markdown optimized for LLM context windows and browser automation.

- **Setup:** [rules/install.md](rules/install.md)
- **Security:** [rules/security.md](rules/security.md)

## Prerequisites

Run `firecrawl --status` to confirm CLI is installed and authenticated. If not ready, see [rules/install.md](rules/install.md).

## Commands

| I need to...                                                                           | Command        | Skill                                                |
| -------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| Find pages on a topic (no URL yet)                                                     | `search`       | [`firecrawl-search`](../firecrawl-search/SKILL.md)   |
| Get content from a URL                                                                 | `scrape`       | [`firecrawl-scrape`](../firecrawl-scrape/SKILL.md)   |
| Find a specific page on a large site                                                   | `map`          | [`firecrawl-map`](../firecrawl-map/SKILL.md)         |
| Extract many pages from a site                                                         | `crawl`        | [`firecrawl-crawl`](../firecrawl-crawl/SKILL.md)     |
| Interact: click, expand, scroll, log in, paginate, dismiss banners, sessions, profiles | `browser`      | [`firecrawl-browser`](../firecrawl-browser/SKILL.md) |
| AI-powered autonomous extraction                                                       | `agent`        | [`firecrawl-agent`](../firecrawl-agent/SKILL.md)     |
| Check remaining API credits                                                            | `credit-usage` | `firecrawl credit-usage`                             |
| Check auth, concurrency limits, credits                                                | `--status`     | `firecrawl --status`                                 |

**Default to `scrape` -unless the request implies interaction.** Scrape handles static pages, JS-rendered SPAs, PDFs, and cached re-fetches. But if the user says click, expand, scroll, log in, paginate, dismiss, toggle, or interact -go straight to `browser`. Don't scrape first when the intent is clearly interactive. If you already scraped and the result is incomplete or needs interaction to get the rest, switch to `browser` immediately -don't hesitate.

**IMPORTANT: Read the command's skill file before running it.** Click the skill link in the table above and read the full doc for the command you chose. Do NOT guess at flags or syntax -the skill files have the exact CLI syntax, options, and examples. Guessing leads to errors.

## Key Principles

**Scrape for content, browser for interaction.** `scrape` is the workhorse for fetching pages -fast, handles JS rendering, supports caching (`--max-age`), PDFs, JSON extraction (`--format json`), and geo-targeting. But when the request involves any interaction (expand sections, click tabs, scroll to load more, dismiss overlays, log in, paginate) -skip scrape and go directly to `browser`.

**Recognize interaction intent in the prompt.** These words/phrases mean browser, not scrape: "expand", "click", "scroll down", "load more", "log in", "sign in", "dismiss", "accept cookies", "toggle", "next page", "paginate", "fill out", "select tab". Don't try scrape first when these appear -it wastes a round-trip.

**Browser is a real Chromium session.** Don't use scrape `--actions` (API-only feature) -use `browser` instead. Go directly to browser for: cookie consent walls, infinite scroll, content behind expand/collapse, logged-in pages, multi-tab dashboards.

**Search is the entry point.** When you don't have a URL yet, start with `search`. Use `--scrape` to fetch full content in one shot (don't re-scrape those URLs after).

**Use caching.** Pass `--max-age` on `scrape` to avoid re-fetching unchanged content.

**Save to files.** Write results to `.firecrawl/` with `-o` to keep context clean. Add `.firecrawl/` to `.gitignore`. Always quote URLs -shell interprets `?` and `&` as special characters.

```
.firecrawl/search-{query}.json
.firecrawl/{site}-{path}.md
```

**Read results incrementally.** Never dump entire output files into context. Use `grep`, `head`, or targeted reads.

**Parallelize.** Run independent scrapes concurrently (check `firecrawl --status` for concurrency limits). Multi-URL `scrape` is automatically concurrent.

Run `firecrawl <command> --help` for full CLI option details.

## Guides

| Guide                                       | Description                                    |
| ------------------------------------------- | ---------------------------------------------- |
| [install.md](rules/install.md)              | Installation and authentication                |
| [security.md](rules/security.md)            | Handling fetched web content safely            |
| [download](../firecrawl/guides/download.md) | Save an entire site locally (`map` + `scrape`) |
