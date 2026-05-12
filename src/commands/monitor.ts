/**
 * `firecrawl monitor` — manage Firecrawl monitors.
 *
 * Monitors run recurring scrapes/crawls and diff each result against the last
 * retained snapshot. See features/monitoring in the docs.
 *
 * The SDK (@mendable/firecrawl-js@4.17.0) does not yet expose the monitor
 * endpoints, so this command hits /v2/monitor directly via fetch — same
 * pattern parse.ts uses.
 *
 * Subcommands:
 *   create | list | get | update | delete | run | checks | check
 */

import * as fs from 'fs';
import { Command } from 'commander';
import { getConfig, validateConfig } from '../utils/config';
import { writeOutput } from '../utils/output';

const DEFAULT_API_URL = 'https://api.firecrawl.dev';

interface CommonOptions {
  apiKey?: string;
  apiUrl?: string;
  output?: string;
  pretty?: boolean;
}

interface MonitorRequestInit {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

async function monitorRequest(
  path: string,
  options: CommonOptions,
  init: MonitorRequestInit = {}
): Promise<unknown> {
  const config = getConfig();
  const apiKey = options.apiKey || config.apiKey;
  validateConfig(apiKey);

  const baseUrl = (options.apiUrl || config.apiUrl || DEFAULT_API_URL).replace(
    /\/$/,
    ''
  );

  let url = `${baseUrl}/v2${path}`;
  if (init.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'X-Origin': 'cli',
  };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as any;

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.error ||
      `HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
    throw new Error(message);
  }

  return payload;
}

function emit(
  payload: unknown,
  options: CommonOptions & { json?: boolean }
): void {
  const text = JSON.stringify(payload, null, options.pretty ? 2 : 0);
  writeOutput(text, options.output, !!options.output);
}

function readJsonInput(input: string): unknown {
  // Accept either a JSON literal or @path/to/file.json
  if (input.startsWith('@')) {
    const filePath = input.slice(1);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  }
  return JSON.parse(input);
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function fail(error: unknown): never {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}

/**
 * Build the request body for `monitor create` from CLI flags.
 *
 * Power users can pass `--body @payload.json` for full control. The flags
 * cover the common scrape-target shape.
 */
function buildCreateBody(opts: {
  body?: string;
  name?: string;
  cron?: string;
  scheduleText?: string;
  timezone?: string;
  urls?: string[];
  crawlUrl?: string;
  webhookUrl?: string;
  webhookEvents?: string[];
  emailRecipients?: string[];
  retentionDays?: number;
}): unknown {
  if (opts.body) return readJsonInput(opts.body);

  if (!opts.name) {
    throw new Error('--name is required (or pass --body @file.json)');
  }
  if (!opts.cron && !opts.scheduleText) {
    throw new Error('--cron or --schedule is required');
  }
  const hasScrape = opts.urls && opts.urls.length > 0;
  const hasCrawl = !!opts.crawlUrl;
  if (!hasScrape && !hasCrawl) {
    throw new Error('Provide --urls (scrape) or --crawl-url (crawl)');
  }

  const schedule: Record<string, unknown> = {};
  if (opts.cron) schedule.cron = opts.cron;
  if (opts.scheduleText) schedule.text = opts.scheduleText;
  if (opts.timezone) schedule.timezone = opts.timezone;

  const targets: unknown[] = [];
  if (hasScrape) targets.push({ type: 'scrape', urls: opts.urls });
  if (hasCrawl) targets.push({ type: 'crawl', url: opts.crawlUrl });

  const body: Record<string, unknown> = {
    name: opts.name,
    schedule,
    targets,
  };

  if (opts.webhookUrl) {
    body.webhook = {
      url: opts.webhookUrl,
      ...(opts.webhookEvents && opts.webhookEvents.length > 0
        ? { events: opts.webhookEvents }
        : {}),
    };
  }

  if (opts.emailRecipients && opts.emailRecipients.length > 0) {
    body.notification = {
      email: {
        enabled: true,
        recipients: opts.emailRecipients,
      },
    };
  }

  if (opts.retentionDays !== undefined) body.retentionDays = opts.retentionDays;

  return body;
}

function commonOptions(cmd: Command): Command {
  return cmd
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('--api-url <url>', 'API URL (overrides global --api-url)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--pretty', 'Pretty print JSON output', false);
}

/**
 * Build the `firecrawl monitor` command tree.
 */
export function createMonitorCommand(): Command {
  const monitor = new Command('monitor').description(
    'Schedule recurring scrapes/crawls and track content changes'
  );

  // create
  commonOptions(
    monitor
      .command('create')
      .description('Create a monitor')
      .option('--name <name>', 'Monitor name')
      .option('--cron <expression>', 'Cron schedule (e.g. "*/30 * * * *")')
      .option(
        '--schedule <text>',
        'Natural-language schedule (e.g. "every 30 minutes")'
      )
      .option('--timezone <tz>', 'Schedule timezone', 'UTC')
      .option(
        '--urls <list>',
        'Comma-separated URLs to scrape on each check',
        parseCommaList
      )
      .option('--crawl-url <url>', 'Root URL for a crawl target')
      .option('--webhook-url <url>', 'Webhook destination')
      .option(
        '--webhook-events <list>',
        'Comma-separated events (monitor.page, monitor.check.completed)',
        parseCommaList
      )
      .option(
        '--email <list>',
        'Comma-separated email recipients for change notifications',
        parseCommaList
      )
      .option('--retention-days <n>', 'Snapshot retention window', parseInt)
      .option(
        '--body <json|@file>',
        'Raw JSON body (or @path/to/file.json) — overrides flag-built payload'
      )
  ).action(async (options) => {
    try {
      const body = buildCreateBody({
        body: options.body,
        name: options.name,
        cron: options.cron,
        scheduleText: options.schedule,
        timezone: options.timezone,
        urls: options.urls,
        crawlUrl: options.crawlUrl,
        webhookUrl: options.webhookUrl,
        webhookEvents: options.webhookEvents,
        emailRecipients: options.email,
        retentionDays: options.retentionDays,
      });
      const payload = await monitorRequest('/monitor', options, {
        method: 'POST',
        body,
      });
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // list
  commonOptions(
    monitor
      .command('list')
      .description('List monitors')
      .option('--limit <n>', 'Maximum results', parseInt)
      .option('--offset <n>', 'Result offset', parseInt)
  ).action(async (options) => {
    try {
      const payload = await monitorRequest('/monitor', options, {
        query: { limit: options.limit, offset: options.offset },
      });
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // get
  commonOptions(
    monitor
      .command('get')
      .description('Get a monitor by ID')
      .argument('<monitorId>', 'Monitor ID')
  ).action(async (monitorId, options) => {
    try {
      const payload = await monitorRequest(
        `/monitor/${encodeURIComponent(monitorId)}`,
        options
      );
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // update
  commonOptions(
    monitor
      .command('update')
      .description('Update a monitor (partial)')
      .argument('<monitorId>', 'Monitor ID')
      .option('--name <name>', 'New name')
      .option('--cron <expression>', 'New cron schedule')
      .option('--schedule <text>', 'New natural-language schedule')
      .option('--timezone <tz>', 'Schedule timezone')
      .option('--status <state>', 'active | paused')
      .option('--retention-days <n>', 'Snapshot retention window', parseInt)
      .option(
        '--body <json|@file>',
        'Raw JSON body (or @path/to/file.json) — overrides flag-built payload'
      )
  ).action(async (monitorId, options) => {
    try {
      let body: Record<string, unknown>;
      if (options.body) {
        body = readJsonInput(options.body) as Record<string, unknown>;
      } else {
        body = {};
        if (options.name) body.name = options.name;
        if (options.status) body.status = options.status;
        if (options.retentionDays !== undefined)
          body.retentionDays = options.retentionDays;
        if (options.cron || options.schedule || options.timezone) {
          const schedule: Record<string, unknown> = {};
          if (options.cron) schedule.cron = options.cron;
          if (options.schedule) schedule.text = options.schedule;
          if (options.timezone) schedule.timezone = options.timezone;
          body.schedule = schedule;
        }
        if (Object.keys(body).length === 0) {
          throw new Error(
            'Provide at least one field to update (or --body @file.json)'
          );
        }
      }
      const payload = await monitorRequest(
        `/monitor/${encodeURIComponent(monitorId)}`,
        options,
        { method: 'PATCH', body }
      );
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // delete
  commonOptions(
    monitor
      .command('delete')
      .description('Delete a monitor')
      .argument('<monitorId>', 'Monitor ID')
  ).action(async (monitorId, options) => {
    try {
      const payload = await monitorRequest(
        `/monitor/${encodeURIComponent(monitorId)}`,
        options,
        { method: 'DELETE' }
      );
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // run
  commonOptions(
    monitor
      .command('run')
      .description('Trigger a check immediately')
      .argument('<monitorId>', 'Monitor ID')
  ).action(async (monitorId, options) => {
    try {
      const payload = await monitorRequest(
        `/monitor/${encodeURIComponent(monitorId)}/run`,
        options,
        { method: 'POST' }
      );
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // checks (list)
  commonOptions(
    monitor
      .command('checks')
      .description('List checks for a monitor')
      .argument('<monitorId>', 'Monitor ID')
      .option('--limit <n>', 'Maximum results', parseInt)
      .option('--offset <n>', 'Result offset', parseInt)
  ).action(async (monitorId, options) => {
    try {
      const payload = await monitorRequest(
        `/monitor/${encodeURIComponent(monitorId)}/checks`,
        options,
        { query: { limit: options.limit, offset: options.offset } }
      );
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  // check (get one)
  commonOptions(
    monitor
      .command('check')
      .description('Get a specific check, with page-level results')
      .argument('<monitorId>', 'Monitor ID')
      .argument('<checkId>', 'Check ID')
      .option('--limit <n>', 'Max page results', parseInt)
      .option('--skip <n>', 'Skip page results', parseInt)
      .option(
        '--status <state>',
        'Filter page results: same, new, changed, removed, error'
      )
  ).action(async (monitorId, checkId, options) => {
    try {
      const payload = await monitorRequest(
        `/monitor/${encodeURIComponent(monitorId)}/checks/${encodeURIComponent(checkId)}`,
        options,
        {
          query: {
            limit: options.limit,
            skip: options.skip,
            status: options.status,
          },
        }
      );
      emit(payload, options);
    } catch (err) {
      fail(err);
    }
  });

  monitor.addHelpText(
    'after',
    `
Examples:
  $ firecrawl monitor create --name "Blog" \\
      --schedule "every 30 minutes" \\
      --urls https://example.com/blog \\
      --email alerts@example.com
  $ firecrawl monitor create --body @monitor.json
  $ firecrawl monitor list --limit 20
  $ firecrawl monitor get mon_abc123
  $ firecrawl monitor update mon_abc123 --status paused
  $ firecrawl monitor run mon_abc123
  $ firecrawl monitor checks mon_abc123 --limit 10
  $ firecrawl monitor check mon_abc123 chk_xyz --status changed
`
  );

  return monitor;
}
