---
name: firecrawl-map
description: |
  Discover all URLs on a website fast — without crawling or downloading content. Uses sitemaps and link discovery to build a complete URL list. Supports search filtering to find specific pages on large sites. Use before crawl or scrape to identify which pages to extract.
allowed-tools:
  - Bash(firecrawl map *)
  - Bash(npx firecrawl map *)
---

# map

Discover all URLs on a website fast — no content downloaded, just URL discovery. Use `--search` to find specific pages on large sites without crawling everything.

```bash
firecrawl map "<url>" --search "authentication" -o .firecrawl/filtered.txt
```

## Examples

```bash
# Get all URLs
firecrawl map "<url>" --limit 500 --json -o .firecrawl/urls.json
```

## Flags

| Flag                   | Description                                 |
| ---------------------- | ------------------------------------------- |
| `--limit <n>`          | Max URLs to return                          |
| `--search <query>`     | Filter URLs by relevance to a query         |
| `--sitemap <mode>`     | Sitemap handling: `include`, `skip`, `only` |
| `--include-subdomains` | Include subdomains in results               |
| `--json`               | Output as JSON                              |
| `-o <path>`            | Save output to file                         |

## Tips

- **Use `--search`** to find a specific page without crawling the whole site.
- **Pair with scrape or crawl.** Map discovers URLs, then [`scrape`](../firecrawl-scrape/SKILL.md) or [`crawl`](../firecrawl-crawl/SKILL.md) fetches them.

## See Also

- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — Scrape discovered URLs
- [firecrawl-crawl](../firecrawl-crawl/SKILL.md) — Bulk extract from a site
- [Download guide](../firecrawl/guides/download.md) — Combines map + scrape automatically
- [Setup & troubleshooting](../firecrawl/guides/install.md)
