/**
 * Interactive ACP agent for data gathering.
 *
 * Detects locally-installed ACP-compatible agents (Claude Code, Codex,
 * Gemini CLI, etc.), walks the user through an interactive flow to describe
 * the data they need, then connects to the selected agent via ACP to gather,
 * structure, and deliver datasets as CSV, JSON, or markdown.
 */

import { type ACPAgent, detectAgents } from '../acp/registry';
import { connectToAgent } from '../acp/client';
import { startTUI } from '../acp/tui';
import {
  createSession,
  getSessionDir,
  loadSession,
  updateSession,
} from '../utils/acp';
import {
  FIRECRAWL_TOOLS_BLOCK,
  SUBAGENT_INSTRUCTIONS,
} from './experimental/shared';

const bold = (s: string) => (process.stderr.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string) => (process.stderr.isTTY ? `\x1b[2m${s}\x1b[0m` : s);

// ─── Suggestions ────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  {
    name: 'Top 50 AI startups — name, funding, team size, product URL',
    value:
      'Find the top 50 AI startups with their name, funding amount, team size, and product URL',
  },
  {
    name: 'SaaS pricing pages — company, tiers, price points, features per tier',
    value:
      'Extract pricing data from major SaaS companies including company name, tier names, price points, and features per tier',
  },
  {
    name: 'YC W24 batch — company, founder, one-liner, industry, stage',
    value:
      'Find all Y Combinator W24 batch companies with company name, founder names, one-liner description, industry, and funding stage',
  },
  {
    name: 'GitHub trending repos — repo, stars, language, description, author',
    value:
      'Extract GitHub trending repositories with repo name, star count, primary language, description, and author',
  },
];

// ─── System prompt builder ──────────────────────────────────────────────────

function buildSystemPrompt(opts: {
  format: string;
  sessionDir: string;
}): string {
  const outputInstructions: Record<string, string> = {
    csv: `Write a CSV file to \`${opts.sessionDir}/output.csv\`.
- First row must be column headers.
- Use proper CSV escaping (quote fields containing commas, newlines, or quotes).
- Every row must have the same number of columns.
- Tell the user the file path and record count when done.`,

    json: `Write a JSON file to \`${opts.sessionDir}/output.json\`.
Use this structure:
\`\`\`json
{
  "metadata": {
    "query": "...",
    "sources": ["url1", "url2"],
    "extractedAt": "ISO-8601",
    "totalRecords": N
  },
  "records": [ { ... }, ... ]
}
\`\`\`
Each record object must have identical keys. Tell the user the file path and record count when done.`,

    report: `Write a markdown file to \`${opts.sessionDir}/output.md\`.
- Start with a brief summary (1-2 lines).
- Render all data as a markdown table.
- If too many columns, use multiple tables grouped by category.
- Tell the user the file path and record count when done.`,
  };

  return `You are Firecrawl Agent — a data gathering tool that builds structured datasets from the web.

You are running inside a CLI. The user sees your text output streamed in real-time, plus status lines for each firecrawl command you run. Structure your output for readability in a terminal.

## Session Directory

Your working directory for this session is: \`${opts.sessionDir}\`

All output files go here. You can also read/write intermediate files here (e.g., partial results, scripts). The user's output file is: \`${opts.sessionDir}/output.${opts.format === 'csv' ? 'csv' : opts.format === 'json' ? 'json' : 'md'}\`

If you need to build the dataset incrementally, write partial results to the session directory as you go. This way if the session is interrupted, progress is preserved.

## Tools

Use ONLY these firecrawl commands (already installed and authenticated):
- \`firecrawl search "<query>"\` — Search the web
- \`firecrawl scrape <url>\` — Scrape a page as markdown
- \`firecrawl scrape <url> --format json\` — Scrape as structured JSON
- \`firecrawl map <url>\` — Discover all URLs on a site
- \`firecrawl crawl <url>\` — Crawl an entire site

**Do NOT use \`firecrawl browser\`, \`firecrawl interact\`, or any browser-based tools.** Stick to search + scrape. If a page requires JavaScript rendering, use \`firecrawl scrape <url> --wait-for 3000\`.

## How You Work

You work in clear phases. **STOP after each phase** and wait for user input before continuing. Do not rush ahead. The user is watching and may want to adjust.

### Phase 1: Plan
Propose a schema (list fields as bullet points, not a table — tables render poorly in terminals) and a brief plan of what sources you'll check. Then STOP and wait.

Example output:
\`\`\`
Fields: name, funding, team_size, product_url, category, source_url

Plan:
1. Search for "top AI startups" lists
2. Scrape Forbes AI 50, TechCrunch, TopStartups.io
3. Cross-reference and deduplicate
4. Write ${opts.format.toUpperCase()} with ~50 records

Shall I proceed?
\`\`\`

### Phase 2: Discover Sources
Search for relevant data sources. After finding them, tell the user what you found:

\`\`\`
Found 4 good sources:
- forbes.com/lists/ai50 (50 companies)
- techcrunch.com/... (49 companies)
- topstartups.io (160+ companies)
- failory.com/... (unicorns list)

Scraping now...
\`\`\`

### Phase 3: Extract Data

**IMPORTANT: Use subagents for all scraping and parsing.** This keeps your context window clean.

${SUBAGENT_INSTRUCTIONS}

For each source (or group of related sources), spawn a subagent with a prompt like:
"Scrape [URL] using firecrawl. Extract records with these fields: [field list]. Return ONLY a JSON array of objects — no commentary, no markdown, just the JSON array."

Launch all extraction subagents in a SINGLE message (parallel). Each subagent handles the heavy work (scraping, reading large pages, parsing) and returns just the structured records.

After all subagents return, report progress:

\`\`\`
Extracted 50 from Forbes AI 50
Extracted 49 from TechCrunch
Extracted 82 from TopStartups.io (pages 1-3)

Total raw records: 181
\`\`\`

### Phase 4: Write Output
Deduplicate, normalize, and write the file. Report the result:

\`\`\`
Deduplicated: 181 → 127 unique companies
Written to: ${opts.sessionDir}/output.${opts.format === 'csv' ? 'csv' : opts.format === 'json' ? 'json' : 'md'}

Top entries:
- OpenAI ($11.3B funding)
- Anthropic ($7.3B funding)
- ...
\`\`\`

## Output Rules

${outputInstructions[opts.format] || outputInstructions.json}

## Data Quality

- Every record has the same fields. No exceptions.
- Never fabricate data — empty string for missing values.
- Include \`source_url\` in every record.
- Deduplicate by name (case-insensitive).

## Terminal Output Style

- Use short paragraphs. No walls of text.
- Use bullet points and code-style backticks for field names.
- Do NOT use markdown tables — they render poorly in terminals. Use bullet points or plain text.
- Report numbers: "Found 4 sources", "Extracted 50 records", "Deduplicated 181 → 127".
- Keep the user informed at every step — they should never wonder what you're doing.

## Follow-Up Suggestions

After completing the output file, always end your message with 2-3 suggested follow-up questions the user can ask. Frame them as questions, not actions. Like:

\`\`\`
Want to go deeper?
1. Want me to add star counts and primary language for each repo?
2. Should I expand this to the top 25 trending repos?
3. Want a comparison across languages (Python, TypeScript, Rust)?
\`\`\`

These should be specific to the data just gathered — not generic. Think about what would make the dataset more useful.`;
}

// ─── Session end ────────────────────────────────────────────────────────────

async function showSessionEnd(
  sessionId: string,
  outputPath: string,
  sessionDir: string
): Promise<void> {
  const { select } = await import('@inquirer/prompts');
  const fs = await import('fs');
  const { execSync } = await import('child_process');

  console.log(`\nSession ${sessionId} saved.`);

  // Check what files exist in the session dir
  const files: string[] = [];
  if (fs.existsSync(sessionDir)) {
    for (const f of fs.readdirSync(sessionDir)) {
      if (f !== 'session.json') {
        files.push(f);
      }
    }
  }

  if (files.length === 0) {
    console.log(`Output  ${outputPath}`);
    return;
  }

  // Build choices
  const choices: Array<{ name: string; value: string }> = [];
  for (const f of files) {
    const fullPath = `${sessionDir}/${f}`;
    const stat = fs.statSync(fullPath);
    const size =
      stat.size > 1024 ? `${Math.round(stat.size / 1024)}KB` : `${stat.size}B`;
    choices.push({ name: `Open ${f} (${size})`, value: `file:${fullPath}` });
  }
  choices.push({ name: 'Open session folder', value: `folder:${sessionDir}` });
  choices.push({ name: 'Done', value: 'done' });

  const action = await select({
    message: 'What next?',
    choices,
  });

  if (action === 'done') return;

  const [type, path] = action.split(':');
  const target = action.slice(type!.length + 1); // handle paths with colons

  try {
    if (process.platform === 'darwin') {
      execSync(`open "${target}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${target}"`);
    } else if (process.platform === 'win32') {
      execSync(`start "" "${target}"`);
    }
  } catch {
    console.log(`Path: ${target}`);
  }
}

// ─── Interactive flow ───────────────────────────────────────────────────────

export async function runInteractiveAgent(options: {
  provider?: string;
  session?: string;
  format?: string;
  yes?: boolean;
}): Promise<void> {
  const { input, select } = await import('@inquirer/prompts');

  // ── Resume session ──────────────────────────────────────────────────────
  if (options.session) {
    const session = loadSession(options.session);
    if (!session) {
      console.error(`Session not found: ${options.session}`);
      process.exit(1);
    }

    console.log(`\nResuming session ${session.id}`);
    console.log(`  Provider: ${session.provider}`);
    console.log(`  Prompt: ${session.prompt}`);
    console.log(`  Format: ${session.format}`);
    console.log(`  Iterations: ${session.iterations}\n`);

    const refinement = await input({
      message: 'What would you like to refine or add?',
    });

    updateSession(session.id, {
      iterations: session.iterations + 1,
    });

    const systemPrompt = buildSystemPrompt({
      format: session.format,
      sessionDir: getSessionDir(session.id),
    });

    const userMessage = `Continue from previous session. Original request: "${session.prompt}". Schema fields: ${session.schema.join(', ')}. Output already at: ${session.outputPath}. New instruction: ${refinement}`;

    console.log(`\n🔥 ${bold('Firecrawl Agent')} — Resuming session\n`);

    const resumeTui = startTUI({
      sessionId: session.id,
      agentName: session.provider,
      format: session.format,
      sessionDir: getSessionDir(session.id),
    });

    const agent = await connectToAgent({
      bin: session.provider,
      systemPrompt,
      callbacks: {
        onText: (text) => resumeTui.onText(text),
        onToolCall: (call) => resumeTui.onToolCall(call),
        onToolCallUpdate: (call) => resumeTui.onToolCallUpdate(call),
        onUsage: (update) => resumeTui.onUsage(update),
      },
    });

    try {
      await agent.prompt(userMessage);
      resumeTui.printSummary();
    } finally {
      agent.close();
    }
    return;
  }

  // ── Detect agents ───────────────────────────────────────────────────────
  const agents = detectAgents();
  const available = agents.filter((a) => a.available);

  if (available.length === 0) {
    console.error(
      '\nNo ACP-compatible agents found. Install one of:\n' +
        '  npm install -g @zed-industries/claude-agent-acp  (Claude Code)\n' +
        '  npm install -g @zed-industries/codex-acp         (Codex)\n' +
        '  See https://agentclientprotocol.com/get-started/agents\n'
    );
    process.exit(1);
  }

  // ── Select agent ────────────────────────────────────────────────────────
  let selectedAgent: ACPAgent;

  if (options.provider) {
    const match = agents.find((a) => a.name === options.provider);
    if (!match || !match.available) {
      console.error(
        `Agent "${options.provider}" is not installed. Available: ${available.map((a) => a.name).join(', ')}`
      );
      process.exit(1);
    }
    selectedAgent = match;
  } else {
    // Default to Claude Code if available
    const claude = available.find((a) => a.name === 'claude');
    if (claude) {
      selectedAgent = claude;
    } else if (available.length === 1) {
      selectedAgent = available[0];
    } else {
      // Available agents first, then unavailable grouped at the bottom
      const installedChoices = agents
        .filter((a) => a.available)
        .map((a) => ({
          name: `${a.displayName}`,
          value: a.name,
          disabled: false as const,
        }));
      const notInstalled = agents.filter((a) => !a.available);
      const agentChoices = [
        ...installedChoices,
        ...(notInstalled.length > 0
          ? [
              {
                name: '─── Not installed ───',
                value: '_sep',
                disabled: 'separator' as const,
              },
              ...notInstalled.map((a) => ({
                name: `${a.displayName}`,
                value: a.name,
                disabled: 'not installed' as const,
              })),
            ]
          : []),
      ];

      const chosen = await select({
        message: 'Which ACP agent?',
        choices: agentChoices,
      });

      selectedAgent = agents.find((a) => a.name === chosen)!;
    }
  }

  // ── Gather prompt ───────────────────────────────────────────────────────
  let prompt = await input({
    message: 'What data do you want to gather?',
    default: '',
  });

  // If empty, show suggestions to pick from
  if (!prompt.trim()) {
    const picked = await select({
      message: 'Pick an example:',
      choices: SUGGESTIONS.map((s) => ({ name: s.name, value: s.value })),
    });
    prompt = picked;
  }

  // ── Seed URLs ───────────────────────────────────────────────────────────
  const urls = await input({
    message:
      'Any URLs to start from? (comma-separated, leave blank to auto-discover)',
    default: '',
  });

  // ── Output format ───────────────────────────────────────────────────────
  const format =
    options.format ||
    (await select({
      message: 'Output format?',
      choices: [
        { name: 'CSV (spreadsheet-ready)', value: 'csv' },
        { name: 'JSON (structured, API-ready)', value: 'json' },
        { name: 'Markdown table (human-readable)', value: 'report' },
      ],
    }));

  // ── Create session ──────────────────────────────────────────────────────
  const session = createSession({
    provider: selectedAgent.name,
    prompt,
    schema: [],
    format,
  });

  console.log(`\nSession ${session.id}`);
  console.log(`Output  ${session.outputPath}`);

  // ── Build message ─────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt({
    format,
    sessionDir: getSessionDir(session.id),
  });

  const parts = [`Gather data: ${prompt}`];
  if (urls.trim()) parts.push(`Start from these URLs: ${urls}`);
  const userMessage = parts.join('. ') + '.';

  // ── Connect via ACP ───────────────────────────────────────────────────
  console.log(`\n🔥 ${bold('Firecrawl Agent')}`);
  console.log(
    `   ${selectedAgent.displayName} · ${format.toUpperCase()} · Session ${session.id}\n`
  );

  // Start TUI
  const sessionDir = getSessionDir(session.id);
  const tui = startTUI({
    sessionId: session.id,
    agentName: selectedAgent.displayName,
    format,
    sessionDir,
  });

  // Handle Ctrl+C gracefully
  let agent: Awaited<ReturnType<typeof connectToAgent>> | null = null;

  const handleInterrupt = () => {
    tui.cleanup();
    process.stderr.write('\nInterrupted.\n');
    if (agent) {
      agent.cancel().catch(() => {});
      agent.close();
    }
    process.exit(0);
  };
  process.on('SIGINT', handleInterrupt);

  try {
    agent = await connectToAgent({
      bin: selectedAgent.bin,
      systemPrompt,
      callbacks: {
        onText: (text) => tui.onText(text),
        onToolCall: (call) => tui.onToolCall(call),
        onToolCallUpdate: (call) => tui.onToolCallUpdate(call),
        onUsage: (update) => tui.onUsage(update),
      },
    });

    // ── Conversation loop ─────────────────────────────────────────────────
    let currentMessage = userMessage;
    while (true) {
      const result = await agent.prompt(currentMessage);

      // Unmount TUI for user input
      tui.pause();
      process.stdout.write('\n');

      // If the agent stopped for a reason other than end_turn, break
      if (result.stopReason !== 'end_turn') {
        tui.printSummary();
        break;
      }

      // Show output path reminder
      process.stderr.write(dim(`Output: ${session.outputPath}\n`));

      // Ask user for follow-up
      const followUp = await input({
        message: '→',
        default: '',
      });

      // Empty input or "done"/"exit"/"quit" ends the loop
      const trimmed = followUp.trim().toLowerCase();
      if (
        !trimmed ||
        trimmed === 'done' ||
        trimmed === 'exit' ||
        trimmed === 'quit'
      ) {
        tui.printSummary();
        await showSessionEnd(
          session.id,
          session.outputPath,
          getSessionDir(session.id)
        );
        break;
      }

      // Remount TUI for next turn
      tui.resume();
      currentMessage = followUp;
    }
  } catch (error) {
    tui.cleanup();
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    tui.cleanup();
    process.removeListener('SIGINT', handleInterrupt);
    if (agent) agent.close();
  }
}
