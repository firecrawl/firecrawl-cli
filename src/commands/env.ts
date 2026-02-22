/**
 * Env command implementation
 * Pull authenticated environment variables into project .env files
 */

import * as fs from 'fs';
import * as path from 'path';
import { getApiKey } from '../utils/config';
import { ensureAuthenticated } from '../utils/auth';

export interface EnvPullOptions {
  file?: string;
  overwrite?: boolean;
}

/**
 * Pull FIRECRAWL_API_KEY into a local .env file
 */
export async function handleEnvPullCommand(
  options: EnvPullOptions = {}
): Promise<void> {
  const apiKey = getApiKey() || (await ensureAuthenticated());

  const envFile = options.file || '.env';
  const envPath = path.resolve(process.cwd(), envFile);
  const envKey = 'FIRECRAWL_API_KEY';
  const envLine = `${envKey}=${apiKey}`;

  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf-8');
    const lines = contents.split('\n');
    const existingIndex = lines.findIndex((line) =>
      line.startsWith(`${envKey}=`)
    );

    if (existingIndex !== -1) {
      if (!options.overwrite) {
        console.log(
          `${envKey} already exists in ${envFile}. Use --overwrite to replace it.`
        );
        return;
      }
      lines[existingIndex] = envLine;
      fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
      console.log(`✓ Updated ${envKey} in ${envFile}`);
    } else {
      const separator = contents.endsWith('\n') ? '' : '\n';
      fs.appendFileSync(envPath, `${separator}${envLine}\n`, 'utf-8');
      console.log(`✓ Added ${envKey} to ${envFile}`);
    }
  } else {
    fs.writeFileSync(envPath, `${envLine}\n`, 'utf-8');
    console.log(`✓ Created ${envFile} with ${envKey}`);
  }
}
