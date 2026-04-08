# Interact Reference

Use this when content requires clicks, forms, login, pagination, or multi-step navigation and plain scrape is not enough.

## Quick start

```bash
# 1. Scrape a page
firecrawl scrape "<url>"

# 2. Interact with natural language
firecrawl interact --prompt "Click the login button"
firecrawl interact --prompt "Fill in the email field with test@example.com"

# 3. Or use code for precise control
firecrawl interact --code "agent-browser click @e5" --language bash

# 4. Stop the session
firecrawl interact stop
```

## Options

| Option                | Description                            |
| --------------------- | -------------------------------------- |
| `--prompt <text>`     | Natural language instruction           |
| `--code <code>`       | Code to execute in the browser session |
| `--language <lang>`   | Language for code: bash, python, node  |
| `--timeout <seconds>` | Execution timeout                      |
| `--scrape-id <id>`    | Target a specific scrape               |
| `-o, --output <path>` | Output file path                       |

## Tips

- Always scrape first. `interact` needs a scrape ID from a previous scrape.
- Use `firecrawl interact stop` to free resources when done.
- Do not use interact for general web search. Use `search` for that.
