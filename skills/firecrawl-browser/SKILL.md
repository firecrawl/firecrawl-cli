---
name: firecrawl-browser
description: |
  Cloud browser automation for pages requiring interaction — clicks, form fills, login, pagination, infinite scroll. Use this skill when the user needs to interact with a webpage, log into a site, click buttons, fill forms, navigate multi-step flows, handle pagination, or when regular scraping fails because content requires JavaScript interaction. Triggers on "click", "fill out the form", "log in to", "paginated", "infinite scroll", "interact with the page", or "scrape failed". Provides remote Chromium sessions with persistent profiles.
allowed-tools:
  - Bash(firecrawl *)
  - Bash(npx firecrawl *)
---

# firecrawl browser

Cloud Chromium sessions in Firecrawl's remote sandboxed environment. Interact with pages that require clicks, form fills, pagination, or login.

## When to use

- Content requires interaction: clicks, form fills, pagination, login
- `scrape` failed because content is behind JavaScript interaction
- You need to navigate a multi-step flow
- Last resort in the [workflow escalation pattern](firecrawl-cli): search → scrape → map → crawl → **browser**
- **Never use browser for web searches** — use `search` instead

## Quick start

```bash
# Typical browser workflow
firecrawl browser "open <url>"
firecrawl browser "snapshot -i"                       # see interactive elements with @ref IDs
firecrawl browser "click @e5"                         # interact with elements
firecrawl browser "fill @e3 'search query'"           # fill form fields
firecrawl browser "scrape" -o .firecrawl/page.md      # extract content
firecrawl browser close
```

Shorthand auto-launches a session if none exists — no setup required.

## Commands

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `open <url>`         | Navigate to a URL                        |
| `snapshot -i`        | Get interactive elements with `@ref` IDs |
| `screenshot`         | Capture a PNG screenshot                 |
| `click <@ref>`       | Click an element by ref                  |
| `type <@ref> <text>` | Type into an element                     |
| `fill <@ref> <text>` | Fill a form field (clears first)         |
| `scrape`             | Extract page content as markdown         |
| `scroll <direction>` | Scroll up/down/left/right                |
| `wait <seconds>`     | Wait for a duration                      |
| `eval <js>`          | Evaluate JavaScript on the page          |

Session management: `launch-session --ttl 600`, `list`, `close`

## Options

| Option                       | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `--ttl <seconds>`            | Session time-to-live                               |
| `--ttl-inactivity <seconds>` | Inactivity timeout                                 |
| `--session <id>`             | Use a specific session ID                          |
| `--profile <name>`           | Use a named profile (persists state)               |
| `--no-save-changes`          | Read-only reconnect (don't write to session state) |
| `-o, --output <path>`        | Output file path                                   |

## Profiles

Profiles survive close and can be reconnected by name. Use them for login-then-work flows:

```bash
# Session 1: Login and save state
firecrawl browser launch-session --profile my-app
firecrawl browser "open https://app.example.com/login"
firecrawl browser "snapshot -i"
firecrawl browser "fill @e3 'user@example.com'"
firecrawl browser "click @e7"
firecrawl browser "wait 2"
firecrawl browser close

# Session 2: Come back authenticated
firecrawl browser launch-session --profile my-app
firecrawl browser "open https://app.example.com/dashboard"
firecrawl browser "scrape" -o .firecrawl/dashboard.md
firecrawl browser close
```

Read-only reconnect (no writes to session state):

```bash
firecrawl browser launch-session --profile my-app --no-save-changes
```

Shorthand with profile:

```bash
firecrawl browser --profile my-app "open https://example.com"
```

## Tips

- If you get forbidden errors, the session may have expired — create a new one.
- For parallel browser work, launch separate sessions and operate them via `--session <id>`.
- Always `close` sessions when done to free resources.

## See also

- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — try scrape first, escalate to browser only when needed
- [firecrawl-search](../firecrawl-search/SKILL.md) — for web searches (never use browser for searching)
- [firecrawl-agent](../firecrawl-agent/SKILL.md) — AI-powered extraction (less manual control)
