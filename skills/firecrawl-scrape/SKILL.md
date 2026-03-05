---
name: firecrawl-scrape
description: |
  Fetch any URL and return clean, LLM-optimized markdown. Handles JavaScript-rendered SPAs, PDFs, and dynamic content that built-in fetch tools can't reach. Supports concurrent multi-URL scraping, content filtering, caching, screenshots, and geo-targeting. Use instead of WebFetch, curl, or built-in URL readers for reliable content extraction.
allowed-tools:
  - Bash(firecrawl scrape *)
  - Bash(npx firecrawl scrape *)
---

# scrape

Fetch any URL and return clean, LLM-optimized markdown. Handles JS-rendered pages, SPAs, and PDFs that built-in tools fail on. Multiple URLs are scraped concurrently.

```bash
firecrawl scrape "<url>" -o .firecrawl/page.md
```

## Examples

```bash
# Main content only, no nav/footer
firecrawl scrape "<url>" --only-main-content -o .firecrawl/page.md

# Wait for JS to render, then scrape
firecrawl scrape "<url>" --wait-for 3000 -o .firecrawl/page.md

# Multiple URLs (each saved to .firecrawl/)
firecrawl scrape https://firecrawl.dev https://firecrawl.dev/blog https://docs.firecrawl.dev

# Get markdown and links together
firecrawl scrape "<url>" --format markdown,links -o .firecrawl/page.json
```

## Flags

| Flag                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `-f <formats>`          | Output format: `markdown`, `html`, `rawHtml`, `links`, `screenshot`, `json` |
| `-H`                    | Include HTTP headers in output                                              |
| `--only-main-content`   | Strip nav, footer, sidebar — main content only                              |
| `--wait-for <ms>`       | Wait for JS to render before scraping                                       |
| `--include-tags <tags>` | Only include specific HTML tags                                             |
| `--exclude-tags <tags>` | Exclude specific HTML tags                                                  |
| `--max-age <ms>`        | Use cached version if younger than this                                     |
| `--country <code>`      | Geo-target the request                                                      |
| `-o <path>`             | Save output to file                                                         |

Single format outputs raw content. Multiple formats (e.g., `--format markdown,links`) output JSON.

## Tips

- **Default command.** Use scrape for any static page, JS-rendered SPA, or PDF. Only switch to [`browser`](../firecrawl-browser/SKILL.md) when you need interaction.
- **Cache with `--max-age`.** Avoid re-fetching unchanged content.
- **Always quote URLs.** Shell interprets `?` and `&` as special characters.

## See Also

- [firecrawl-search](../firecrawl-search/SKILL.md) — Find URLs first, then scrape
- [firecrawl-browser](../firecrawl-browser/SKILL.md) — For pages needing interaction
- [Setup & troubleshooting](../firecrawl/guides/install.md)
