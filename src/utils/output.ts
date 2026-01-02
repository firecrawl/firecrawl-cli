/**
 * Output utilities for CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ScrapeResult } from '../types/scrape';

/**
 * Write output to file or stdout
 */
export function writeOutput(
  data: any,
  outputPath?: string,
  pretty: boolean = false
): void {
  const content = typeof data === 'string' 
    ? data 
    : JSON.stringify(data, null, pretty ? 2 : 0);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`Output written to: ${outputPath}`);
  } else {
    console.log(content);
  }
}

/**
 * Handle scrape result output
 */
export function handleScrapeOutput(
  result: ScrapeResult,
  outputPath?: string,
  pretty: boolean = false
): void {
  if (!result.success) {
    console.error('Error:', result.error);
    process.exit(1);
  }

  if (result.data) {
    writeOutput(result.data, outputPath, pretty);
  }
}

