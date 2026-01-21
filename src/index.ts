#!/usr/bin/env node

/**
 * Firecrawl CLI
 * Entry point for the CLI application
 */

import { Command } from 'commander';
import { handleScrapeCommand } from './commands/scrape';
import { initializeConfig, updateConfig } from './utils/config';
import { getClient } from './utils/client';
import { configure } from './commands/config';
import { handleCreditUsageCommand } from './commands/credit-usage';
import { handleCrawlCommand } from './commands/crawl';
import { handleMapCommand } from './commands/map';
import { handleVersionCommand } from './commands/version';
import { handleLoginCommand } from './commands/login';
import { handleLogoutCommand } from './commands/logout';
import { isUrl, normalizeUrl } from './utils/url';
import { parseScrapeOptions } from './utils/options';
import { isJobId } from './utils/job';
import { ensureAuthenticated, printBanner } from './utils/auth';
import packageJson from '../package.json';

// Initialize global configuration from environment variables
initializeConfig();

// Commands that require authentication
const AUTH_REQUIRED_COMMANDS = ['scrape', 'crawl', 'map', 'credit-usage'];

const program = new Command();

program
  .name('firecrawl')
  .description('CLI tool for Firecrawl web scraping')
  .version(packageJson.version)
  .option(
    '-k, --api-key <key>',
    'Firecrawl API key (or set FIRECRAWL_API_KEY env var)'
  )
  .allowUnknownOption() // Allow unknown options when URL is passed directly
  .hook('preAction', async (thisCommand, actionCommand) => {
    // Update global config if API key is provided via global option
    const globalOptions = thisCommand.opts();
    if (globalOptions.apiKey) {
      updateConfig({ apiKey: globalOptions.apiKey });
    }

    // Check if this command requires authentication
    const commandName = actionCommand.name();
    if (AUTH_REQUIRED_COMMANDS.includes(commandName)) {
      // Ensure user is authenticated (prompts for login if needed)
      await ensureAuthenticated();
    }
  });

/**
 * Create and configure the scrape command
 */
function createScrapeCommand(): Command {
  const scrapeCmd = new Command('scrape')
    .description('Scrape a URL using Firecrawl')
    .argument('[url]', 'URL to scrape')
    .option(
      '-u, --url <url>',
      'URL to scrape (alternative to positional argument)'
    )
    .option('-H, --html', 'Output raw HTML (shortcut for --format html)')
    .option(
      '-f, --format <formats>',
      'Output format(s). Multiple formats can be specified with commas (e.g., "markdown,links,images"). Available: markdown, html, rawHtml, links, images, screenshot, summary, changeTracking, json, attributes, branding. Single format outputs raw content; multiple formats output JSON.',
      'markdown'
    )
    .option('--only-main-content', 'Include only main content', false)
    .option(
      '--wait-for <ms>',
      'Wait time before scraping in milliseconds',
      parseInt
    )
    .option('--screenshot', 'Take a screenshot', false)
    .option('--include-tags <tags>', 'Comma-separated list of tags to include')
    .option('--exclude-tags <tags>', 'Comma-separated list of tags to exclude')
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--pretty', 'Pretty print JSON output', false)
    .option(
      '--timing',
      'Show request timing and other useful information',
      false
    )
    .action(async (positionalUrl, options) => {
      // Use positional URL if provided, otherwise use --url option
      const url = positionalUrl || options.url;
      if (!url) {
        console.error(
          'Error: URL is required. Provide it as argument or use --url option.'
        );
        process.exit(1);
      }

      // Handle --html shortcut flag
      const format = options.html ? 'html' : options.format;

      const scrapeOptions = parseScrapeOptions({ ...options, url, format });
      await handleScrapeCommand(scrapeOptions);
    });

  return scrapeCmd;
}

// Add scrape command to main program
program.addCommand(createScrapeCommand());

/**
 * Create and configure the crawl command
 */
function createCrawlCommand(): Command {
  const crawlCmd = new Command('crawl')
    .description('Crawl a website using Firecrawl')
    .argument('[url-or-job-id]', 'URL to crawl or job ID to check status')
    .option(
      '-u, --url <url>',
      'URL to crawl (alternative to positional argument)'
    )
    .option('--status', 'Check status of existing crawl job', false)
    .option(
      '--wait',
      'Wait for crawl to complete before returning results',
      false
    )
    .option(
      '--poll-interval <seconds>',
      'Polling interval in seconds when waiting (default: 5)',
      parseFloat
    )
    .option(
      '--timeout <seconds>',
      'Timeout in seconds when waiting (default: no timeout)',
      parseFloat
    )
    .option('--progress', 'Show progress dots while waiting', false)
    .option('--limit <number>', 'Maximum number of pages to crawl', parseInt)
    .option('--max-depth <number>', 'Maximum crawl depth', parseInt)
    .option(
      '--exclude-paths <paths>',
      'Comma-separated list of paths to exclude'
    )
    .option(
      '--include-paths <paths>',
      'Comma-separated list of paths to include'
    )
    .option('--sitemap <mode>', 'Sitemap handling: skip, include', 'include')
    .option(
      '--ignore-query-parameters',
      'Ignore query parameters when crawling',
      false
    )
    .option('--crawl-entire-domain', 'Crawl entire domain', false)
    .option('--allow-external-links', 'Allow external links', false)
    .option('--allow-subdomains', 'Allow subdomains', false)
    .option('--delay <ms>', 'Delay between requests in milliseconds', parseInt)
    .option(
      '--max-concurrency <number>',
      'Maximum concurrent requests',
      parseInt
    )
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--pretty', 'Pretty print JSON output', false)
    .action(async (positionalUrlOrJobId, options) => {
      // Use positional argument if provided, otherwise use --url option
      const urlOrJobId = positionalUrlOrJobId || options.url;
      if (!urlOrJobId) {
        console.error(
          'Error: URL or job ID is required. Provide it as argument or use --url option.'
        );
        process.exit(1);
      }

      // Auto-detect if it's a job ID (UUID format)
      const isStatusCheck = options.status || isJobId(urlOrJobId);

      const crawlOptions = {
        urlOrJobId,
        status: isStatusCheck,
        wait: options.wait,
        pollInterval: options.pollInterval,
        timeout: options.timeout,
        progress: options.progress,
        output: options.output,
        pretty: options.pretty,
        apiKey: options.apiKey,
        limit: options.limit,
        maxDepth: options.maxDepth,
        excludePaths: options.excludePaths
          ? options.excludePaths.split(',').map((p: string) => p.trim())
          : undefined,
        includePaths: options.includePaths
          ? options.includePaths.split(',').map((p: string) => p.trim())
          : undefined,
        sitemap: options.sitemap,
        ignoreQueryParameters: options.ignoreQueryParameters,
        crawlEntireDomain: options.crawlEntireDomain,
        allowExternalLinks: options.allowExternalLinks,
        allowSubdomains: options.allowSubdomains,
        delay: options.delay,
        maxConcurrency: options.maxConcurrency,
      };

      await handleCrawlCommand(crawlOptions);
    });

  return crawlCmd;
}

/**
 * Create and configure the map command
 */
function createMapCommand(): Command {
  const mapCmd = new Command('map')
    .description('Map URLs on a website using Firecrawl')
    .argument('[url]', 'URL to map')
    .option(
      '-u, --url <url>',
      'URL to map (alternative to positional argument)'
    )
    .option('--wait', 'Wait for map to complete', false)
    .option('--limit <number>', 'Maximum URLs to discover', parseInt)
    .option('--search <query>', 'Search query to filter URLs')
    .option(
      '--sitemap <mode>',
      'Sitemap handling: only, include, skip',
      'include'
    )
    .option('--include-subdomains', 'Include subdomains', false)
    .option('--ignore-query-parameters', 'Ignore query parameters', false)
    .option('--timeout <seconds>', 'Timeout in seconds', parseFloat)
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON format', false)
    .option('--pretty', 'Pretty print JSON output', false)
    .action(async (positionalUrl, options) => {
      // Use positional URL if provided, otherwise use --url option
      const url = positionalUrl || options.url;
      if (!url) {
        console.error(
          'Error: URL is required. Provide it as argument or use --url option.'
        );
        process.exit(1);
      }

      const mapOptions = {
        urlOrJobId: url,
        wait: options.wait,
        output: options.output,
        json: options.json,
        pretty: options.pretty,
        apiKey: options.apiKey,
        limit: options.limit,
        search: options.search,
        sitemap: options.sitemap,
        includeSubdomains: options.includeSubdomains,
        ignoreQueryParameters: options.ignoreQueryParameters,
        timeout: options.timeout,
      };

      await handleMapCommand(mapOptions);
    });

  return mapCmd;
}

// Add crawl and map commands to main program
program.addCommand(createCrawlCommand());
program.addCommand(createMapCommand());

program
  .command('config')
  .description('Show current configuration and authentication status')
  .action(async () => {
    await configure();
  });

program
  .command('login')
  .description('Login to Firecrawl (browser or manual API key)')
  .option(
    '-k, --api-key <key>',
    'Provide API key directly (skips interactive flow)'
  )
  .option('--api-url <url>', 'API URL (default: https://api.firecrawl.dev)')
  .option(
    '--web-url <url>',
    'Web URL for browser login (default: https://firecrawl.dev)'
  )
  .option(
    '-m, --method <method>',
    'Login method: "browser" or "manual" (default: interactive prompt)'
  )
  .action(async (options) => {
    await handleLoginCommand({
      apiKey: options.apiKey,
      apiUrl: options.apiUrl,
      webUrl: options.webUrl,
      method: options.method,
    });
  });

program
  .command('logout')
  .description('Logout and clear stored credentials')
  .action(async () => {
    await handleLogoutCommand();
  });

program
  .command('credit-usage')
  .description('Get team credit usage information')
  .option(
    '-k, --api-key <key>',
    'Firecrawl API key (overrides global --api-key)'
  )
  .option('-o, --output <path>', 'Output file path (default: stdout)')
  .option('--json', 'Output as JSON format', false)
  .option(
    '--pretty',
    'Pretty print JSON output (only applies with --json)',
    false
  )
  .action(async (options) => {
    await handleCreditUsageCommand(options);
  });

program
  .command('version')
  .description('Display version information')
  .action(() => {
    handleVersionCommand();
  });

// Parse arguments
const args = process.argv.slice(2);

// Handle the main entry point
async function main() {
  // If no arguments or just help flags, check auth and show appropriate message
  if (args.length === 0) {
    const { isAuthenticated } = await import('./utils/auth');

    if (!isAuthenticated()) {
      // Not authenticated - prompt for login (banner is shown by ensureAuthenticated)
      await ensureAuthenticated();

      console.log("You're all set! Try scraping a URL:\n");
      console.log('  firecrawl https://example.com\n');
      console.log('For more commands, run: firecrawl --help\n');
      return;
    }

    // Authenticated - show banner and help
    printBanner();
    program.outputHelp();
    return;
  }

  // Check if first argument is a URL (and not a command)
  if (!args[0].startsWith('-') && isUrl(args[0])) {
    // Treat as scrape command with URL - reuse commander's parsing
    const url = normalizeUrl(args[0]);

    // Modify argv to include scrape command with URL as positional argument
    // This allows commander to parse it normally with all hooks and options
    const modifiedArgv = [
      process.argv[0],
      process.argv[1],
      'scrape',
      url,
      ...args.slice(1),
    ];

    // Parse using the main program (which includes hooks and global options)
    await program.parseAsync(modifiedArgv);
  } else {
    // Normal command parsing
    await program.parseAsync();
  }
}

main().catch((error) => {
  console.error(
    'Error:',
    error instanceof Error ? error.message : 'Unknown error'
  );
  process.exit(1);
});
