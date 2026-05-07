---
name: firecrawl-docs-search
description: |
  Look up answers in Firecrawl's official documentation. Use this skill whenever the user asks "how do I…" with Firecrawl, needs to know which parameter does what, or wants to learn how an endpoint behaves — e.g. "how do I verify webhook signatures", "what does waitFor do on /scrape", "which formats support change tracking", "how does crawl handle robots.txt", "what's the difference between scrape and parse". Returns a concise, docs-grounded answer with citations to the relevant pages. Prefer this over a generic web search whenever the question is specifically about Firecrawl behavior or configuration — answers come from current documentation, not stale training data.
allowed-tools:
  - Bash(firecrawl docs-search *)
  - Bash(firecrawl docs-search:*)
  - Bash(npx firecrawl docs-search *)
---

# firecrawl docs-search

AI-powered docs lookup grounded in Firecrawl's public documentation. Returns a concise answer plus citations to the source pages.

## When to use

- "**How do I…**" questions about Firecrawl features, endpoints, parameters, or configuration.
- Looking up specific behavior — what a parameter does, which formats are supported, what a status code means, how billing works, etc.
- Onboarding to a Firecrawl feature you've never used (webhooks, change tracking, batch scrape, agent extraction, browser sessions, etc.).

This is the **learning** counterpart to [firecrawl-ask](../firecrawl-ask/SKILL.md): use docs-search for "how do I…" questions, use ask for "why didn't it work…" questions.

## Quick start

```bash
# Look up how a feature works
firecrawl docs-search "how do I verify webhook signatures?"

# Find the right parameter
firecrawl docs-search "which scrape options bypass bot protection on Cloudflare-protected sites?"

# Save the answer + sources to a file
firecrawl docs-search "what's the difference between /scrape and /parse" \
  --json --pretty -o .firecrawl/docs-q.json
```

## Options

| Option              | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `<question...>`     | Required. Plain-English question about Firecrawl (1-8000 chars)       |
| `-o, --output`      | Output file path (default: stdout)                                   |
| `--json`            | Output as JSON (machine-readable, includes evidence array)            |
| `--pretty`          | Pretty-print JSON                                                    |

## What you get back

```
Duration: 11.3s

Answer:
The signature is sent in the X-Firecrawl-Signature header as an HMAC-SHA256
of the request body, base64-encoded. Verify by recomputing with your webhook
secret and comparing constant-time. Reject the delivery if it doesn't match.

Sources:
  - webhooks/security.mdx#L1-L52 — Documents webhook signature verification
  - webhooks/quickstart.mdx#L88-L102 — Includes a Node.js verification example
```

The JSON form (`--json --pretty`) carries an `evidence` array with `pathOrUrl` + `reason` for each source — useful when you need to follow up by scraping the actual docs page.

## Tips

- **Prefer docs-search over generic web search** for Firecrawl-specific questions. Public web search returns stale or third-party content; docs-search is grounded in the current docs.
- Pair with [firecrawl-scrape](../firecrawl-scrape/SKILL.md) when you need the **full text** of a page the answer cites — the citations include `pathOrUrl` you can feed back into a scrape.
- If the answer says the agent couldn't find anything (low confidence / empty evidence), the docs may be missing that topic — flag it with the user rather than fabricating an answer.
- Don't use this for **debugging** an actual run — switch to `firecrawl ask` so the agent can investigate the failing job's logs.

## See also

- [firecrawl-ask](../firecrawl-ask/SKILL.md) — diagnose a failing run (the "why didn't it work" counterpart)
- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — pull the full text of a docs page cited in the evidence
- [firecrawl-cli](../firecrawl-cli/SKILL.md) — full CLI reference and workflow escalation
