/**
 * Config command implementation
 * Shows current configuration and directs to login for changes
 */

import { loadCredentials, getConfigDirectoryPath } from '../utils/credentials';
import { getConfig } from '../utils/config';
import { isAuthenticated } from '../utils/auth';

/**
 * Show current configuration
 */
export async function configure(): Promise<void> {
  const credentials = loadCredentials();
  const config = getConfig();

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│          Firecrawl Configuration        │');
  console.log('└─────────────────────────────────────────┘\n');

  if (isAuthenticated()) {
    const maskedKey = credentials?.apiKey
      ? `${credentials.apiKey.substring(0, 6)}...${credentials.apiKey.slice(-4)}`
      : 'Not set';

    console.log('Status: ✓ Authenticated\n');
    console.log(`API Key:  ${maskedKey}`);
    console.log(`API URL:  ${config.apiUrl || 'https://api.firecrawl.dev'}`);
    console.log(`Config:   ${getConfigDirectoryPath()}`);
    console.log('\nCommands:');
    console.log('  firecrawl logout   Clear credentials');
    console.log('  firecrawl login    Re-authenticate');
  } else {
    console.log('Status: Not authenticated\n');
    console.log('Run any command to start authentication, or use:');
    console.log('  firecrawl login    Authenticate with browser or API key');
  }
  console.log('');
}
