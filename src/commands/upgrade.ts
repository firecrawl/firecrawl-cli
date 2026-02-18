/**
 * Upgrade command implementation
 * Opens the Firecrawl pricing page in the browser
 */

import { openBrowser } from '../utils/auth';

const PRICING_URL = 'https://firecrawl.dev/pricing';

export async function handleUpgradeCommand(): Promise<void> {
  console.log('Opening Firecrawl pricing page...\n');

  try {
    await openBrowser(PRICING_URL);
    console.log(`If the browser doesn't open, visit: ${PRICING_URL}`);
  } catch {
    console.log(`Open this URL in your browser: ${PRICING_URL}`);
  }
}
