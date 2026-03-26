/**
 * Interactive ACP agent for data gathering.
 *
 * Detects locally-installed ACP-compatible agents (Claude Code, Codex,
 * Gemini CLI, etc.), walks the user through an interactive flow to describe
 * the data they need, then connects to the selected agent via ACP to gather,
 * structure, and deliver datasets as CSV, JSON, or markdown.
 */

import { type ACPAgent, detectAgents } from '../acp/registry';
import { connectToAgent, type ToolCallInfo } from '../acp/client';
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

  return `You are a data gathering agent powered by Firecrawl. You discover sources, extract structured records, and consolidate them into clean, importable datasets.

**CRITICAL: You are building a DATASET, not writing a report.** Think spreadsheet rows, not document sections. Every record must have the same fields. The output must be directly importable into a spreadsheet, database, or API.

${FIRECRAWL_TOOLS_BLOCK}

## Your Strategy

### Phase 1: Schema Design
Before searching anything, analyze the user's request and determine:
1. What entity type are you collecting? (companies, people, products, events, etc.)
2. What fields/columns should each record have?
3. **IMPORTANT: Print the proposed schema to the user and ask them to confirm before proceeding.** Example:
   "I'll collect these fields: \`name\`, \`funding\`, \`team_size\`, \`category\`, \`website\`, \`source_url\`. Look good? Or would you like to add/remove any fields?"
4. Wait for user confirmation. They may want to tweak the schema.

### Phase 2: Source Discovery
- Use \`firecrawl search\` with multiple queries to find high-quality data sources.
- If seed URLs are provided, use \`firecrawl map\` to discover subpages.
- Identify 3-10 high-quality sources depending on request scope.

### Phase 3: Parallel Extraction
Spawn parallel subagents — one per data source or source cluster.

${SUBAGENT_INSTRUCTIONS}

Each subagent should:
1. Scrape its assigned source(s) using \`firecrawl scrape <url>\` or \`firecrawl scrape <url> --format json\`
2. Extract records matching the confirmed schema
3. Return results as a JSON array of objects with consistent field names
4. Include \`source_url\` in every record for provenance

### Phase 4: Consolidation
After all subagents return:
1. Merge all records into a single array
2. Deduplicate by a reasonable key (name + URL, or similar)
3. Normalize field values (consistent date formats, trim whitespace, etc.)
4. Fill missing fields with empty string (CSV) or null (JSON) — never omit fields
5. Write the final output file

## Data Quality Rules
- Every record MUST have the exact same set of fields
- Never fabricate data — leave fields empty if not found
- Always include \`source_url\` for provenance
- Deduplicate records by a reasonable primary key
- Normalize values (consistent capitalization, date formats, etc.)

## Output Format
${outputInstructions[opts.format] || outputInstructions.json}

Start by analyzing the request and proposing a schema.`;
}

// ─── Tool call display ──────────────────────────────────────────────────────

/**
 * Parse a tool call and return a user-facing label, or null to hide it.
 * Only firecrawl operations and session output writes are shown.
 */
function describeToolCall(
  call: ToolCallInfo,
  sessionDir: string
): string | null {
  const input = call.rawInput as Record<string, unknown> | undefined;

  if (input?.command && typeof input.command === 'string') {
    const cmd = input.command.trim();

    if (cmd.startsWith('firecrawl search')) {
      const query = cmd
        .replace(/^firecrawl search\s*/, '')
        .replace(/^["']|["']$/g, '')
        .split(/\s+--/)[0];
      return `Searching "${query}"`;
    }
    if (cmd.startsWith('firecrawl scrape')) {
      const url = cmd
        .replace(/^firecrawl scrape\s*/, '')
        .split(/\s/)[0]
        .replace(/^["']|["']$/g, '');
      if (url.startsWith('http')) return `Scraping ${url}`;
      return null; // --help or flags only
    }
    if (cmd.startsWith('firecrawl map')) {
      const url = cmd
        .replace(/^firecrawl map\s*/, '')
        .split(/\s/)[0]
        .replace(/^["']|["']$/g, '');
      if (url.startsWith('http')) return `Mapping ${url}`;
      return null;
    }
    if (cmd.startsWith('firecrawl crawl')) {
      const url = cmd
        .replace(/^firecrawl crawl\s*/, '')
        .split(/\s/)[0]
        .replace(/^["']|["']$/g, '');
      if (url.startsWith('http')) return `Crawling ${url}`;
      return null;
    }
    if (cmd.startsWith('firecrawl agent')) {
      return 'Running Firecrawl extraction agent';
    }

    // Hide everything else (grep, python, cat, temp files, help, etc.)
    return null;
  }

  // File writes to the session directory are shown
  if (input?.path && typeof input.path === 'string') {
    if (
      input.path.startsWith(sessionDir) &&
      call.title.toLowerCase().includes('write')
    ) {
      const basename = input.path.split('/').pop() || input.path;
      return `Writing ${basename}`;
    }
    return null;
  }

  return null;
}

// ─── Multi-line spinner for parallel operations ─────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface ToolCallState {
  activeToolCalls: Map<string, string>;
  spinnerFrame: number;
  spinnerInterval: ReturnType<typeof setInterval> | null;
  renderedLineCount: number;
}

function createToolCallState(): ToolCallState {
  return {
    activeToolCalls: new Map(),
    spinnerFrame: 0,
    spinnerInterval: null,
    renderedLineCount: 0,
  };
}

function clearRenderedLines(state: ToolCallState): void {
  for (let i = 0; i < state.renderedLineCount; i++) {
    process.stderr.write('\x1b[A\x1b[2K'); // move up + clear line
  }
  state.renderedLineCount = 0;
}

function renderSpinnerFrame(state: ToolCallState): void {
  if (state.activeToolCalls.size === 0) return;
  state.spinnerFrame = (state.spinnerFrame + 1) % SPINNER.length;

  // Clear previously rendered lines
  clearRenderedLines(state);

  // Render each active call on its own line
  const lines = [...state.activeToolCalls.values()];
  for (const label of lines) {
    process.stderr.write(`  ${SPINNER[state.spinnerFrame]} ${label}\n`);
  }
  state.renderedLineCount = lines.length;
}

function startSpinner(state: ToolCallState): void {
  if (state.spinnerInterval) return;
  state.spinnerInterval = setInterval(() => renderSpinnerFrame(state), 80);
}

function stopSpinner(state: ToolCallState): void {
  if (state.spinnerInterval) {
    clearInterval(state.spinnerInterval);
    state.spinnerInterval = null;
  }
  clearRenderedLines(state);
}

function buildCallbacks(sessionDir: string): {
  onText: (text: string) => void;
  onToolCall: (call: ToolCallInfo) => void;
  onToolCallUpdate: (call: ToolCallInfo) => void;
  cleanup: () => void;
} {
  const state = createToolCallState();

  return {
    onText: (text: string) => {
      // Clear spinner, print text, re-render spinner
      if (state.activeToolCalls.size > 0) {
        clearRenderedLines(state);
        process.stdout.write(text);
        renderSpinnerFrame(state);
      } else {
        process.stdout.write(text);
      }
    },
    onToolCall: (call: ToolCallInfo) => {
      const label = describeToolCall(call, sessionDir);
      if (!label) return;
      state.activeToolCalls.set(call.id, label);
      startSpinner(state);
    },
    onToolCallUpdate: (call: ToolCallInfo) => {
      if (!state.activeToolCalls.has(call.id)) return;
      const label = state.activeToolCalls.get(call.id)!;
      if (call.status === 'completed' || call.status === 'errored') {
        state.activeToolCalls.delete(call.id);

        // Clear all spinner lines, print completed line, re-render remaining
        clearRenderedLines(state);
        const icon = call.status === 'completed' ? '✓' : '✗';
        process.stderr.write(`  ${icon} ${label}\n`);

        if (state.activeToolCalls.size === 0) {
          stopSpinner(state);
        }
      }
    },
    cleanup: () => stopSpinner(state),
  };
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

    console.log(`\nResuming session via Agent Client Protocol...\n`);

    const agent = await connectToAgent({
      bin: session.provider,
      systemPrompt,
      callbacks: buildCallbacks(getSessionDir(session.id)),
    });

    try {
      await agent.prompt(userMessage);
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
  } else if (available.length === 1) {
    selectedAgent = available[0];
    console.log(`\nUsing ${selectedAgent.displayName} (only agent detected)\n`);
  } else {
    const agentChoices = agents.map((a) => ({
      name: a.available
        ? `● ${a.displayName} (${a.bin})`
        : `○ ${a.displayName} (not installed)`,
      value: a.name,
      disabled: !a.available ? 'not installed' : false,
    }));

    const chosen = await select({
      message: 'Which ACP agent?',
      choices: agentChoices,
    });

    selectedAgent = agents.find((a) => a.name === chosen)!;
  }

  // ── Gather prompt ───────────────────────────────────────────────────────
  const promptChoice = await select({
    message: 'What data do you want to gather?',
    choices: [
      ...SUGGESTIONS.map((s) => ({ name: s.name, value: s.value })),
      { name: 'Describe your own...', value: '__custom__' },
    ],
  });

  let prompt: string;
  if (promptChoice === '__custom__') {
    prompt = await input({
      message: 'Describe the data you want to collect:',
      validate: (v: string) => (v.trim() ? true : 'Prompt is required'),
    });
  } else {
    prompt = promptChoice;
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
  console.log(
    `\n🔥 Loading ${selectedAgent.displayName} via Agent Client Protocol...\n`
  );

  // Handle Ctrl+C gracefully
  let agent: Awaited<ReturnType<typeof connectToAgent>> | null = null;
  const callbacks = buildCallbacks(getSessionDir(session.id));

  const handleInterrupt = () => {
    callbacks.cleanup();
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
      callbacks,
    });

    // ── Conversation loop ─────────────────────────────────────────────────
    let currentMessage = userMessage;
    while (true) {
      const result = await agent.prompt(currentMessage);
      process.stdout.write('\n\n');

      // If the agent stopped for a reason other than end_turn, break
      if (result.stopReason !== 'end_turn') {
        process.stderr.write(`\nStopped (${result.stopReason}).\n`);
        break;
      }

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
        process.stderr.write(`\nSession ${session.id} saved.\n`);
        process.stderr.write(`Output  ${session.outputPath}\n`);
        break;
      }

      currentMessage = followUp;
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    callbacks.cleanup();
    process.removeListener('SIGINT', handleInterrupt);
    if (agent) agent.close();
  }
}
