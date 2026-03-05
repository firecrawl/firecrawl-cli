---
name: firecrawl-search
description: |
  Search the web and optionally scrape full page content in one shot. Returns structured JSON with titles, URLs, and snippets — or full markdown content with --scrape. Supports news, images, time filtering, and geo-targeting. Use instead of built-in web search tools for higher quality results and direct content extraction.
allowed-tools:
  - Bash(firecrawl search *)
  - Bash(npx firecrawl search *)
---

# search

Search the web and optionally scrape full page content from results in a single call. Returns structured JSON — not raw HTML. Use `--scrape` to get full markdown content without needing a separate scrape step.

```bash
firecrawl search "<query>" -o .firecrawl/result.json --json
```

## Examples

```bash
# Search and scrape full page content from results
firecrawl search "your query" --scrape -o .firecrawl/scraped.json --json

# News from the past day
firecrawl search "your query" --sources news --tbs qdr:d -o .firecrawl/news.json --json
```

## Flags

| Flag                      | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `--limit <n>`             | Max number of results                                                                       |
| `--sources <types>`       | Source types: `web`, `images`, `news`                                                       |
| `--categories <types>`    | Categories: `github`, `research`, `pdf`                                                     |
| `--tbs <range>`           | Time filter: `qdr:h` (hour), `qdr:d` (day), `qdr:w` (week), `qdr:m` (month), `qdr:y` (year) |
| `--location <loc>`        | Location for localized results                                                              |
| `--country <code>`        | Country code for geo-targeting                                                              |
| `--scrape`                | Fetch full page content for each result                                                     |
| `--scrape-formats <fmts>` | Formats when using `--scrape`                                                               |
| `-o <path>`               | Save output to file                                                                         |

## Working with Results

```bash
# Extract URLs from search results
jq -r '.data.web[].url' .firecrawl/search-results.json

# Get titles and URLs
jq -r '.data.web[] | "\(.title): \(.url)"' .firecrawl/search-results.json
```

## Tips

- **Entry point.** When you don't have a URL, start here.
- **Use `--scrape`** to fetch full content in one shot — don't re-scrape those URLs after.
- **Filter by time** with `--tbs` for recent results.

## See Also

- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — Scrape a known URL
- [firecrawl-map](../firecrawl-map/SKILL.md) — Find pages on a specific site
- [Setup & troubleshooting](../firecrawl/guides/install.md)
