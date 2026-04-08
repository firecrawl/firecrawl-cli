# Scrape Reference

Use this when you already have a URL and want content from a static page or JS-rendered SPA.

## Quick start

```bash
# Basic markdown extraction
firecrawl scrape "<url>" -o .firecrawl/page.md

# Main content only
firecrawl scrape "<url>" --only-main-content -o .firecrawl/page.md

# Wait for JS to render
firecrawl scrape "<url>" --wait-for 3000 -o .firecrawl/page.md

# Multiple URLs
firecrawl scrape https://example.com https://example.com/blog https://example.com/docs
```

## Options

| Option                   | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `-f, --format <formats>` | Output formats: markdown, html, rawHtml, links, screenshot, json |
| `-Q, --query <prompt>`   | Ask a question about the page content (5 credits)                |
| `-H`                     | Include HTTP headers in output                                   |
| `--only-main-content`    | Strip nav, footer, sidebar and keep the main content             |
| `--wait-for <ms>`        | Wait for JS rendering before scraping                            |
| `--include-tags <tags>`  | Only include these HTML tags                                     |
| `--exclude-tags <tags>`  | Exclude these HTML tags                                          |
| `-o, --output <path>`    | Output file path                                                 |

## Tips

- Prefer plain scrape over `--query` when you want the full page content to inspect yourself.
- Try scrape before interact. Escalate only when you truly need clicks, forms, login, or pagination.
- Multiple URLs are scraped concurrently. Check `firecrawl --status` for the current concurrency limit.
