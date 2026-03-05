---
name: firecrawl-agent
description: |
  Autonomous AI extraction — give it a prompt and it navigates, clicks, and extracts structured data across multiple pages on its own. Returns JSON matching your schema. Takes 2-5 minutes. Use for complex multi-page extraction tasks where you'd otherwise need to chain map + scrape + parse manually.
allowed-tools:
  - Bash(firecrawl agent *)
  - Bash(npx firecrawl agent *)
---

# agent

Autonomous AI extraction — describe what you need, and it navigates, clicks, and extracts structured data across multiple pages on its own. Returns JSON matching your schema. Takes 2-5 minutes.

```bash
firecrawl agent "extract all pricing tiers" --wait -o .firecrawl/pricing.json
```

## Examples

```bash
# With a JSON schema for structured output
firecrawl agent "extract products" --schema '{"type":"object","properties":{"name":{"type":"string"},"price":{"type":"number"}}}' --wait -o .firecrawl/products.json

# Focus on specific pages
firecrawl agent "get feature list" --urls "<url>" --wait -o .firecrawl/features.json
```

## Flags

| Flag                   | Description                            |
| ---------------------- | -------------------------------------- |
| `--urls <urls>`        | Specific URLs to focus on              |
| `--model <model>`      | Model: `spark-1-mini` or `spark-1-pro` |
| `--schema <json>`      | JSON schema for structured output      |
| `--schema-file <path>` | Load schema from a file                |
| `--max-credits <n>`    | Credit spending limit                  |
| `--wait`               | Wait for completion before returning   |
| `--pretty`             | Pretty-print JSON output               |
| `-o <path>`            | Save output to file                    |

## Tips

- **Always use `--wait`** so you get results inline.
- **Use `--schema`** for structured, predictable output.
- **Slower than scrape.** Takes 2-5 minutes — use [`scrape`](../firecrawl-scrape/SKILL.md) or [`browser`](../firecrawl-browser/SKILL.md) for faster, targeted extraction.
- **Best for complex extraction** across multiple pages where you'd otherwise chain map + scrape + parse.

## See Also

- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — Faster single-page extraction
- [firecrawl-browser](../firecrawl-browser/SKILL.md) — Manual interactive extraction
- [Setup & troubleshooting](../firecrawl/guides/install.md)
