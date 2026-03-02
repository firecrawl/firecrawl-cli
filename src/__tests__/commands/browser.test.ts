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

vi.mock('../../utils/output', () => ({ writeOutput: vi.fn() }));

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

  it('launch passes origin cli to browser()', async () => {
    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'session-123',
      cdpUrl: 'wss://cdp.example.com/session-123',
    });

    await handleBrowserLaunch({});

    expect(mockClient.browser).toHaveBeenCalledWith(
      expect.objectContaining({ integration: 'cli' })
    );
  });

  it('launch passes origin cli alongside other options', async () => {
    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'session-123',
      cdpUrl: 'wss://cdp.example.com/session-123',
    });

    await handleBrowserLaunch({
      ttl: 600,
      ttlInactivity: 120,
      profile: 'my-profile',
      saveChanges: true,
    });

    expect(mockClient.browser).toHaveBeenCalledWith(
      expect.objectContaining({
        integration: 'cli',
        ttl: 600,
        activityTtl: 120,
        profile: { name: 'my-profile', saveChanges: true },
      })
    );
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
        language: 'bash',
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
    expect(mockClient.browser).toHaveBeenCalledWith(
      expect.objectContaining({ integration: 'cli' })
    );
    expect(saveBrowserSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-session' })
    );
  });

  it('quick execute auto-launch passes origin cli with profile', async () => {
    const { loadBrowserSession } = await import('../../utils/browser-session');
    vi.mocked(loadBrowserSession).mockReturnValueOnce(null);
    vi.mocked(loadBrowserSession).mockReturnValue({
      id: 'new-session',
      cdpUrl: 'wss://new',
      createdAt: '2025-01-01T00:00:00Z',
    });

    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'new-session',
      cdpUrl: 'wss://new',
    });

    await handleBrowserQuickExecute({
      code: 'open https://example.com',
      profile: 'dev',
      saveChanges: false,
    });

    expect(mockClient.browser).toHaveBeenCalledWith(
      expect.objectContaining({
        integration: 'cli',
        profile: { name: 'dev', saveChanges: false },
      })
    );
  });

  it('quick execute retries with new session on 403 Forbidden', async () => {
    const { clearBrowserSession, saveBrowserSession } =
      await import('../../utils/browser-session');

    // First execute call fails with 403 (stale cached session)
    const forbiddenError = Object.assign(new Error('Forbidden'), {
      status: 403,
    });
    mockClient.browserExecute
      .mockRejectedValueOnce(forbiddenError)
      .mockResolvedValueOnce({
        success: true,
        stdout: 'page loaded',
      });

    // Launch new session succeeds
    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'fresh-session',
      cdpUrl: 'wss://fresh',
    });

    await handleBrowserQuickExecute({ code: 'open https://example.com' });

    expect(clearBrowserSession).toHaveBeenCalled();
    expect(mockClient.browser).toHaveBeenCalledTimes(1);
    expect(saveBrowserSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fresh-session' })
    );
    expect(mockClient.browserExecute).toHaveBeenCalledTimes(2);
  });

  it('quick execute retries with new session on 410 Gone', async () => {
    const { clearBrowserSession } = await import('../../utils/browser-session');

    const goneError = Object.assign(new Error('Gone'), { status: 410 });
    mockClient.browserExecute
      .mockRejectedValueOnce(goneError)
      .mockResolvedValueOnce({
        success: true,
        stdout: 'page loaded',
      });

    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'fresh-session',
      cdpUrl: 'wss://fresh',
    });

    await handleBrowserQuickExecute({ code: 'open https://example.com' });

    expect(clearBrowserSession).toHaveBeenCalled();
    expect(mockClient.browser).toHaveBeenCalledTimes(1);
    expect(mockClient.browserExecute).toHaveBeenCalledTimes(2);
  });

  it('quick execute retries on "session destroyed" error message', async () => {
    const { clearBrowserSession } = await import('../../utils/browser-session');

    mockClient.browserExecute
      .mockRejectedValueOnce(new Error('session has been destroyed'))
      .mockResolvedValueOnce({
        success: true,
        stdout: 'ok',
      });

    mockClient.browser.mockResolvedValue({
      success: true,
      id: 'fresh-session',
      cdpUrl: 'wss://fresh',
    });

    await handleBrowserQuickExecute({ code: 'open https://example.com' });

    expect(clearBrowserSession).toHaveBeenCalled();
    expect(mockClient.browserExecute).toHaveBeenCalledTimes(2);
  });

  it('quick execute exits on non-session errors without retry', async () => {
    mockClient.browserExecute.mockRejectedValueOnce(
      new Error('Network timeout')
    );

    await handleBrowserQuickExecute({ code: 'open https://example.com' });

    expect(mockClient.browser).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
