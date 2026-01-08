/**
 * Utility functions for job ID detection and validation
 */

/**
 * Check if a string looks like a UUID/job ID
 * Firecrawl job IDs are UUIDs (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function isJobId(str: string): boolean {
  // UUID v4 pattern
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
