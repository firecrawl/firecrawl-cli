---
name: firecrawl-crawl
description: |
  Crawl an entire website or section and extract all pages as clean markdown. Follows links automatically with configurable depth, path filters, and concurrency. Use when you need content from many pages on the same site — docs, blogs, knowledge bases. Returns structured results with metadata for each page.
allowed-tools:
  - Bash(firecrawl crawl *)
  - Bash(npx firecrawl crawl *)
---

# crawl

Crawl a website or section and extract all pages as clean markdown. Follows links automatically with configurable depth and path filtering.

```bash
firecrawl crawl "<url>" --include-paths /docs --limit 50 --wait -o .firecrawl/crawl.json
```

## Examples

```bash
# Full crawl with depth limit
firecrawl crawl "<url>" --max-depth 3 --wait --progress -o .firecrawl/crawl.json

# Check status of a running crawl
firecrawl crawl <job-id>
```

## Flags

| Flag                      | Description                                 |
| ------------------------- | ------------------------------------------- |
| `--wait`                  | Wait for crawl to complete before returning |
| `--progress`              | Show progress updates while waiting         |
| `--limit <n>`             | Max pages to crawl                          |
| `--max-depth <n>`         | Max link depth from starting URL            |
| `--include-paths <paths>` | Only crawl matching URL paths               |
| `--exclude-paths <paths>` | Skip matching URL paths                     |
| `--delay <ms>`            | Delay between requests                      |
| `--max-concurrency <n>`   | Max concurrent requests                     |
| `--pretty`                | Pretty-print JSON output                    |
| `-o <path>`               | Save output to file                         |

## Tips

- **Always use `--wait`** so you get results inline instead of a job ID.
- **Scope with `--include-paths`** to avoid crawling the entire site.
- **Use `--limit`** as a safety net — large sites can have thousands of pages.

## See Also

- [firecrawl-map](../firecrawl-map/SKILL.md) — Discover URLs before crawling
- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — Scrape individual pages
- [Download guide](../firecrawl/guides/download.md) — Save a site locally with directory structure
- [Setup & troubleshooting](../firecrawl/guides/install.md)
