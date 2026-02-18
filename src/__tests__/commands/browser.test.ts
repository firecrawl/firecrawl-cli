/**
 * Browser commands – minimal viable tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleBrowserLaunch,
  handleBrowserExecute,
  handleBrowserList,
  handleBrowserClose,
  handleBrowserQuickExecute,
} from '../../commands/browser';
import { getClient } from '../../utils/client';
import { initializeConfig } from '../../utils/config';
import { setupTest, teardownTest } from '../utils/mock-client';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

vi.mock('../../utils/client', async () => {
  const actual = await vi.importActual('../../utils/client');
  return { ...actual, getClient: vi.fn() };
});

vi.mock('../../utils/browser-session', async () => {
  const actual = await vi.importActual('../../utils/browser-session');
  return {
    ...actual,
    saveBrowserSession: vi.fn(),
    loadBrowserSession: vi.fn().mockReturnValue({
      id: 'stored-session-id',
      cdpUrl: 'wss://stored',
      createdAt: '2025-01-01T00:00:00Z',
    }),
    clearBrowserSession: vi.fn(),
    getSessionId: vi.fn((override?: string) => override || 'stored-session-id'),
  };
});

vi.mock('../../utils/output', () => ({
  writeOutput: vi.fn(),
  printError: vi.fn((msg: string) => console.error('Error:', msg)),
}));

const mockExit = vi
  .spyOn(process, 'exit')
  .mockImplementation((() => {}) as any);
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Browser Commands', () => {
  let mockClient: any;

  beforeEach(() => {
    setupTest();
    initializeConfig({
      apiKey: 'test-api-key',
      apiUrl: 'https://api.firecrawl.dev',
    });
    mockClient = {
      browser: vi.fn(),
      browserExecute: vi.fn(),
      listBrowsers: vi.fn(),
      deleteBrowser: vi.fn(),
    };
    vi.mocked(getClient).mockReturnValue(mockClient as any);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('launch saves session on success', async () => {
    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'session-123',
      cdpUrl: 'wss://cdp.example.com/session-123',
      liveViewUrl: 'https://live.example.com/browser-id',
    });

    await handleBrowserLaunch({});

    const { saveBrowserSession } = await import('../../utils/browser-session');
    expect(saveBrowserSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-123' })
    );
  });

  it('launch exits 1 on failure', async () => {
    mockClient.browser.mockResolvedValue({
      success: false,
      error: 'Not authorized',
    });

    await handleBrowserLaunch({});

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('execute sends python code to correct session', async () => {
    mockClient.browserExecute.mockResolvedValue({
      success: true,
      result: 'Example Domain',
    });

    await handleBrowserExecute({ code: 'await page.title()' });

    expect(mockClient.browserExecute).toHaveBeenCalledWith(
      'stored-session-id',
      {
        code: 'await page.title()',
        language: 'python',
      }
    );
  });

  it('list returns sessions', async () => {
    mockClient.listBrowsers.mockResolvedValue({ success: true, sessions: [] });

    await handleBrowserList({});

    expect(mockClient.listBrowsers).toHaveBeenCalledTimes(1);
  });

  it('close deletes and clears stored session', async () => {
    mockClient.deleteBrowser.mockResolvedValue({ success: true });

    await handleBrowserClose({});

    expect(mockClient.deleteBrowser).toHaveBeenCalledWith('stored-session-id');
    const { clearBrowserSession } = await import('../../utils/browser-session');
    expect(clearBrowserSession).toHaveBeenCalled();
  });

  it('quick execute skips launch when session exists', async () => {
    // loadBrowserSession already returns a stored session (from mock)
    // so quick execute should NOT call browser() to launch
    await handleBrowserQuickExecute({ code: 'open https://example.com' });

    expect(mockClient.browser).not.toHaveBeenCalled();
  });

  it('quick execute auto-launches when no session exists', async () => {
    const { loadBrowserSession, saveBrowserSession } =
      await import('../../utils/browser-session');
    vi.mocked(loadBrowserSession).mockReturnValueOnce(null); // no session first call
    vi.mocked(loadBrowserSession).mockReturnValue({
      // session exists after launch
      id: 'new-session',
      cdpUrl: 'wss://new',
      createdAt: '2025-01-01T00:00:00Z',
    });

    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'new-session',
      cdpUrl: 'wss://new',
    });

    await handleBrowserQuickExecute({ code: 'open https://example.com' });

    expect(mockClient.browser).toHaveBeenCalledTimes(1);
    expect(saveBrowserSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-session' })
    );
  });
});
