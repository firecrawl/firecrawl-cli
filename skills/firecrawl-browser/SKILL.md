---
name: firecrawl-browser
description: |
  Remote cloud Chromium for interactive pages — click buttons, fill forms, scroll, dismiss popups, log in, and extract content from pages that require interaction. Persistent profiles let you authenticate once and reconnect later. Use when a page needs clicks, scrolling, login, expanding sections, or any interaction beyond a simple fetch.
allowed-tools:
  - Bash(firecrawl browser *)
  - Bash(npx firecrawl browser *)
---

# browser

Remote cloud Chromium for pages that need interaction — clicking, scrolling, form filling, login flows, dismissing popups. Auto-launches a session with no setup required.

```bash
firecrawl browser "open <url>"
firecrawl browser "snapshot -i"                       # see interactive elements with @ref IDs
firecrawl browser "click @e5"                         # interact with elements
firecrawl browser "fill @e3 'search query'"           # fill form fields
firecrawl browser "scrape" -o .firecrawl/page.md      # extract content
firecrawl browser close
```

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

## Flags

| Flag                         | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `--ttl <seconds>`            | Session time-to-live                             |
| `--ttl-inactivity <seconds>` | Inactivity timeout                               |
| `--session <id>`             | Target a specific session                        |
| `--profile <name>`           | Named profile for persistent state               |
| `--no-save-changes`          | Read-only reconnect (no writes to session state) |
| `-o <path>`                  | Save output to file                              |

## Profiles

Profiles survive `close` and can be reconnected by name. Use them when you need to login first, then come back later while already authenticated:

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

Read-only reconnect: `firecrawl browser launch-session --profile my-app --no-save-changes`

Shorthand with profile: `firecrawl browser --profile my-app "open https://example.com"`

If you get forbidden errors, create a new session — the old one may have expired.

## Tips

- **`snapshot -i` is your eyes.** Always snapshot before interacting to see available `@ref` IDs.
- **Don't use scrape `--actions`** (API-only feature) — use `browser` instead.

## See Also

- [firecrawl-scrape](../firecrawl-scrape/SKILL.md) — For static pages that don't need interaction
- [firecrawl-agent](../firecrawl-agent/SKILL.md) — AI-powered autonomous extraction
- [Setup & troubleshooting](../firecrawl/guides/install.md)
