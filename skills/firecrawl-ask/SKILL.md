---
name: firecrawl-ask
description: |
  Diagnose Firecrawl issues with the AI support agent. Use this skill whenever a Firecrawl operation (scrape/crawl/search/map/agent/browser/interact) fails, returns unexpected results, hits rate limits, or behaves in a way the user doesn't expect — especially after a regular `firecrawl <cmd>` call has already produced an error or wrong output. Triggers on "why is firecrawl…", "scrape returned empty", "crawl only got N pages but I expected more", "I'm getting a 4xx/5xx", "credits don't match", "what's wrong with this run", or any phrasing where the user is confused by Firecrawl behavior. Returns a 2-4 sentence diagnosis with machine-readable fix parameters and (when possible) a validated fix tested against the live API.
allowed-tools:
  - Bash(firecrawl ask *)
  - Bash(firecrawl ask:*)
  - Bash(npx firecrawl ask *)
---

# firecrawl ask

AI support agent that investigates a failing Firecrawl call and returns a verified fix. Typical latency: 15–30 seconds.

## When to use

- A previous `firecrawl <cmd>` call **failed** or returned **unexpected results**.
- The user is **confused** by Firecrawl behavior ("why does this site return empty markdown?", "why am I getting 429s?", "why did my crawl stop at 47 pages?").
- You're about to give up on a scrape/crawl/etc. and would otherwise tell the user to file a support ticket — try `firecrawl ask` first.

This is the **debugging** counterpart to [firecrawl-docs-search](../firecrawl-docs-search/SKILL.md): use docs-search for "how do I…" questions, use ask for "why didn't it work…" questions.

## Quick start

```bash
# Diagnose a failed scrape
firecrawl ask "my scrape of https://example.com returned empty markdown"

# Pass the failing job's id so the agent can pull the right logs
firecrawl ask "my crawl returned 3 pages but I expected 50" \
  --job-id <crawl-id-from-the-failed-run>

# Add rationale (recommended for AI callers — 1-2 sentences on user intent)
firecrawl ask "scrape times out at 30s on this URL" \
  --rationale "User wants to scrape example.com to feed an AI agent; every attempt times out"
```

## Options

| Option              | Description                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `<question...>`     | Required. Free-form description of what went wrong (1-8000 chars)                                        |
| `-r, --rationale`   | 1-2 sentences on what the end user is trying to accomplish — recommended for AI callers (≤2000 chars)    |
| `-j, --job-id`      | Firecrawl job id the failing call returned. Lets the agent pull logs/credit usage for that exact run     |
| `--context <json>`  | JSON-stringified object of free-form metadata (status code, formats requested, etc.) the agent considers |
| `-o, --output`      | Output file path (default: stdout)                                                                       |
| `--json`            | Output as JSON                                                                                           |
| `--pretty`          | Pretty-print JSON                                                                                        |

## What you get back

By default, a human-readable summary:

```
Confidence: high
Duration:   24.3s

Answer:
The default 30s timeout isn't enough for example.com — its content loads
via JavaScript after a 5s render delay. Increase timeout to 45000 and set
waitFor: 6000 so the page settles before extraction.

Suggested fix parameters:
{
  "waitFor": 6000,
  "timeout": 45000
}

Validation: success
  validateScrape with waitFor=6000 returned 200 with 47kb of markdown
```

When `validation.tested == true` and `validation.result == "success"`, the agent literally tested the fix against the live API — apply the `fixParameters` directly and rerun.

## Recipe — agent-friendly debugging loop

```bash
# 1. Run the actual operation, capture the run id
SCRAPE_OUTPUT=$(firecrawl scrape "https://example.com" --json --pretty -o .firecrawl/scrape.json) || RUN_FAILED=1

# 2. If failed or output is suspicious, ask the agent
if [ -n "$RUN_FAILED" ] || [ "$(jq -r '.data | length' .firecrawl/scrape.json 2>/dev/null)" = "null" ]; then
  firecrawl ask "scrape of https://example.com returned empty/failed" \
    --rationale "User wants to scrape example.com for downstream summarization" \
    --json --pretty -o .firecrawl/debug.json

  # 3. Apply the suggested fix and retry
  WAIT_FOR=$(jq -r '.data.fixParameters.waitFor // empty' .firecrawl/debug.json)
  TIMEOUT=$(jq -r '.data.fixParameters.timeout // empty' .firecrawl/debug.json)
  if [ -n "$WAIT_FOR" ]; then
    firecrawl scrape "https://example.com" --wait-for "$WAIT_FOR" --timeout "$TIMEOUT" -o .firecrawl/scrape-retry.md
  fi
fi
```

## Tips

- **Pass `--job-id` whenever possible.** Tools like `debugJob`, `searchLogs`, and `getJob` auto-default to it on the agent side, so the diagnosis comes back with the actual run's logs (not a guess based on the URL).
- The agent runs server-side and is **automatically scoped to your team** — it can only see your own jobs and account data. No need to share API keys or job IDs with anyone.
- If `confidence: low` and `feedback` is non-null, the agent could not produce a usable answer — escalate to human support.
- Don't loop more than 2–3 retries. Each call costs real agent compute (15–60s + downstream tool runs); use `firecrawl docs-search` for general questions instead.

## See also

- [firecrawl-docs-search](../firecrawl-docs-search/SKILL.md) — looking up Firecrawl documentation (the "how do I…" counterpart)
- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — the most common upstream of an `ask` call
- [firecrawl-cli](../firecrawl-cli/SKILL.md) — full CLI reference and workflow escalation
