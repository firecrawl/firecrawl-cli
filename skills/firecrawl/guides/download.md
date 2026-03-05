---
name: firecrawl-download
description: 'Save an entire site locally using map + scrape.'
---

# download

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

## See Also

- [firecrawl](../SKILL.md) — Main skill overview
- [firecrawl-scrape](../../firecrawl-scrape/SKILL.md) — Scrape options reference
- [firecrawl-map](../../firecrawl-map/SKILL.md) — URL discovery
