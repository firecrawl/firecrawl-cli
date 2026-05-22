import { randomUUID } from 'crypto';

let cachedSessionId: string | null = null;
export function getSessionId(): string {
  if (!cachedSessionId) {
    cachedSessionId = randomUUID();
  }
  return cachedSessionId;
}

export type SessionHeaders = Record<string, string>;

export function getSessionHeaders(): SessionHeaders {
  return {
    'x-firecrawl-session-id': getSessionId(),
  };
}
