/**
 * Support endpoint commands: `firecrawl ask` and `firecrawl docs-search`.
 *
 * Both wrap api.firecrawl.dev/v2/support/* — `ask` is for diagnosing issues
 * with a Firecrawl run (the AI support agent investigates job logs, account
 * state, etc.) and `docs-search` is for looking up answers in the public
 * docs. The Firecrawl API key is the bearer; no extra config needed.
 */

import * as fs from 'fs';
import * as path from 'path';

import { getConfig, validateConfig } from '../utils/config';

const DEFAULT_API_URL = 'https://api.firecrawl.dev';

export interface SupportCommonOptions {
  /** API key for Firecrawl */
  apiKey?: string;
  /** API URL for Firecrawl */
  apiUrl?: string;
  /** Output file path */
  output?: string;
  /** Output as JSON format */
  json?: boolean;
  /** Pretty print JSON output */
  pretty?: boolean;
}

export interface AskOptions extends SupportCommonOptions {
  /** 1-2 sentences on what the end user is trying to accomplish — recommended for AI callers */
  rationale?: string;
  /** Optional Firecrawl job id the failing call was associated with */
  jobId?: string;
  /** Free-form metadata (already-parsed JSON object) */
  context?: Record<string, unknown>;
}

export interface DocsSearchOptions extends SupportCommonOptions {}

export type AskResponse = {
  requestId?: string;
  answer?: string;
  confidence?: 'high' | 'medium' | 'low';
  fixParameters?: Record<string, unknown> | null;
  validation?: {
    tested?: boolean;
    result?: 'success' | 'failure' | 'skipped';
    evidence?: string;
  } | null;
  feedback?: { blockedBy?: string; attempted?: string[] } | null;
  durationMs?: number;
};

export type DocsSearchResponse = {
  requestId?: string;
  answer?: string;
  evidence?: Array<{ pathOrUrl?: string; reason?: string }>;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  durationMs?: number;
};

export interface SupportResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function resolveCreds(opts: SupportCommonOptions): {
  apiKey: string;
  apiUrl: string;
} {
  const config = getConfig();
  const apiKey = opts.apiKey || config.apiKey;
  validateConfig(apiKey);
  const apiUrl = opts.apiUrl || config.apiUrl || DEFAULT_API_URL;
  return { apiKey: apiKey as string, apiUrl };
}

async function postJson<T>(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<SupportResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const errMsg =
        (parsed &&
          typeof parsed === 'object' &&
          'error' in parsed &&
          typeof (parsed as { error?: unknown }).error === 'string' &&
          ((parsed as { error: string }).error as string)) ||
        `HTTP ${response.status} ${response.statusText}`;
      return { success: false, error: errMsg };
    }

    return { success: true, data: (parsed ?? {}) as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function executeAsk(
  question: string,
  options: AskOptions = {}
): Promise<SupportResult<AskResponse>> {
  if (!question || !question.trim()) {
    return { success: false, error: 'A question is required' };
  }

  const { apiKey, apiUrl } = resolveCreds(options);
  const body: Record<string, unknown> = { question: question.trim() };
  if (options.rationale && options.rationale.trim()) {
    body.rationale = options.rationale.trim();
  }
  if (options.jobId && options.jobId.trim()) {
    body.jobId = options.jobId.trim();
  }
  if (options.context && Object.keys(options.context).length > 0) {
    body.context = options.context;
  }

  return postJson<AskResponse>(
    `${apiUrl.replace(/\/$/, '')}/v2/support/ask`,
    apiKey,
    body
  );
}

export async function executeDocsSearch(
  question: string,
  options: DocsSearchOptions = {}
): Promise<SupportResult<DocsSearchResponse>> {
  if (!question || !question.trim()) {
    return { success: false, error: 'A question is required' };
  }

  const { apiKey, apiUrl } = resolveCreds(options);

  return postJson<DocsSearchResponse>(
    `${apiUrl.replace(/\/$/, '')}/v2/support/docs-search`,
    apiKey,
    { question: question.trim() }
  );
}

function formatAskReadable(data: AskResponse): string {
  const lines: string[] = [];

  if (data.confidence) {
    lines.push(`Confidence: ${data.confidence}`);
  }
  if (typeof data.durationMs === 'number') {
    lines.push(`Duration:   ${(data.durationMs / 1000).toFixed(1)}s`);
  }
  if (lines.length > 0) lines.push('');

  if (data.answer) {
    lines.push('Answer:');
    lines.push(data.answer.trim());
    lines.push('');
  }

  if (
    data.fixParameters &&
    typeof data.fixParameters === 'object' &&
    Object.keys(data.fixParameters).length > 0
  ) {
    lines.push('Suggested fix parameters:');
    try {
      lines.push(JSON.stringify(data.fixParameters, null, 2));
    } catch {
      lines.push(String(data.fixParameters));
    }
    lines.push('');
  }

  if (data.validation && data.validation.tested) {
    lines.push(`Validation: ${data.validation.result ?? 'unknown'}`);
    if (data.validation.evidence) {
      lines.push(`  ${data.validation.evidence}`);
    }
    lines.push('');
  }

  if (data.feedback && data.feedback.blockedBy) {
    lines.push(`Stuck — blocked by: ${data.feedback.blockedBy}`);
    if (data.feedback.attempted && data.feedback.attempted.length > 0) {
      lines.push(`Tools attempted: ${data.feedback.attempted.join(', ')}`);
    }
    lines.push('');
  }

  if (data.requestId) {
    lines.push(`Request id: ${data.requestId}`);
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

function formatDocsSearchReadable(data: DocsSearchResponse): string {
  const lines: string[] = [];

  if (typeof data.durationMs === 'number') {
    lines.push(`Duration: ${(data.durationMs / 1000).toFixed(1)}s`);
    lines.push('');
  }

  if (data.answer) {
    lines.push('Answer:');
    lines.push(data.answer.trim());
    lines.push('');
  }

  if (data.evidence && data.evidence.length > 0) {
    lines.push('Sources:');
    for (const item of data.evidence) {
      if (item?.pathOrUrl) {
        lines.push(
          `  - ${item.pathOrUrl}${item.reason ? ` — ${item.reason}` : ''}`
        );
      }
    }
    lines.push('');
  }

  if (data.requestId) {
    lines.push(`Request id: ${data.requestId}`);
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

function writeOutput<T>(
  result: SupportResult<T>,
  options: SupportCommonOptions,
  formatReadable: (data: T) => string
): void {
  if (!result.success) {
    console.error('Error:', result.error);
    process.exit(1);
  }

  if (!result.data) return;

  let outputContent: string;
  if (options.json) {
    try {
      outputContent = options.pretty
        ? JSON.stringify({ success: true, data: result.data }, null, 2)
        : JSON.stringify({ success: true, data: result.data });
    } catch (err) {
      outputContent = JSON.stringify({
        error: 'Failed to serialize response',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  } else {
    outputContent = formatReadable(result.data);
  }

  if (options.output) {
    const dir = path.dirname(options.output);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(options.output, outputContent, 'utf-8');
    console.error(`Output written to: ${options.output}`);
  } else {
    if (!outputContent.endsWith('\n')) {
      outputContent += '\n';
    }
    process.stdout.write(outputContent);
  }
}

export async function handleAskCommand(
  question: string,
  options: AskOptions = {}
): Promise<void> {
  const result = await executeAsk(question, options);
  writeOutput(result, options, formatAskReadable);
}

export async function handleDocsSearchCommand(
  question: string,
  options: DocsSearchOptions = {}
): Promise<void> {
  const result = await executeDocsSearch(question, options);
  writeOutput(result, options, formatDocsSearchReadable);
}
