# Agent Reference

Use this when manual scraping would require navigating many pages or when the user wants structured JSON output with a schema.

## Quick start

```bash
# Extract structured data
firecrawl agent "extract all pricing tiers" --wait -o .firecrawl/pricing.json

# With a JSON schema
firecrawl agent "extract products" --schema '{"type":"object","properties":{"name":{"type":"string"},"price":{"type":"number"}}}' --wait -o .firecrawl/products.json

# Focus on specific pages
firecrawl agent "get feature list" --urls "<url>" --wait -o .firecrawl/features.json
```

## Options

| Option                 | Description                               |
| ---------------------- | ----------------------------------------- |
| `--urls <urls>`        | Starting URLs for the agent               |
| `--model <model>`      | Model to use: spark-1-mini or spark-1-pro |
| `--schema <json>`      | JSON schema for structured output         |
| `--schema-file <path>` | Path to JSON schema file                  |
| `--max-credits <n>`    | Credit limit for this agent run           |
| `--wait`               | Wait for agent to complete                |
| `--pretty`             | Pretty print JSON output                  |
| `-o, --output <path>`  | Output file path                          |

## Tips

- Use `--schema` for predictable output whenever possible.
- Agent runs usually cost more and take longer than plain scrape or crawl.
- For single-page extraction, prefer `scrape` first.
