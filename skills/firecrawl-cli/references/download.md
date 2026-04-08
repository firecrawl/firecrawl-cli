# Download Reference

Use this when the goal is to save an entire site or section as local files rather than just extract content once.

## Quick start

```bash
# Interactive wizard
firecrawl download https://docs.example.com

# With screenshots
firecrawl download https://docs.example.com --screenshot --limit 20 -y

# Filter to specific sections
firecrawl download https://docs.example.com --include-paths "/features,/sdks"

# Skip translations
firecrawl download https://docs.example.com --exclude-paths "/zh,/ja,/fr,/es,/pt-BR"
```

## Options

| Option                    | Description                                 |
| ------------------------- | ------------------------------------------- |
| `--limit <n>`             | Max pages to download                       |
| `--search <query>`        | Filter URLs by search query                 |
| `--include-paths <paths>` | Only download matching paths                |
| `--exclude-paths <paths>` | Skip matching paths                         |
| `--allow-subdomains`      | Include subdomain pages                     |
| `-y`                      | Skip confirmation prompt in automated flows |

## Tips

- Always pass `-y` in automated flows to skip the confirmation prompt.
- All scrape options still work with download.
- Use download when the end goal is local files, not just extraction output.
