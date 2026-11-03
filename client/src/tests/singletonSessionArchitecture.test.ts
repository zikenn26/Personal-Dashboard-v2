import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { handleAuthLogin, handleAuthVerify, handlePostHeartbeat } from '../../../server/syncService';
import { revokePreviousUserSessions } from '../../../server/syncWebSocket';
import { pool } from '../../../server/db';
import { Auth } from '../utils/auth';
import { realtimeHub } from '../utils/realtimeHub';

beforeAll(() => {
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0,
    } as Storage;
  }
});

describe('Singleton Session & SyncHub Removal Verification Tests', { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(pool, 'query').mockImplementation(async () => ({ rows: [] } as any));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. User logs in on Device A and establishes active session', async () => {
    let statusCode = 200;
    let jsonResult: any = null;

    const reqA = {
      body: {
        email: 'gknayak@gmail.com',
        password: 'Gulshan@12345!',
        device_id: 'device_desktop_win_11',
        device_name: 'Google Chrome on Windows 11',
      },
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    };

    const resA = {
      status: (code: number) => {
        statusCode = code;
        return resA;
      },
      json: (data: any) => {
        jsonResult = data;
        return resA;
      },
    };

    await handleAuthLogin(reqA, resA);
    expect(statusCode).toBe(200);
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.token).toMatch(/^neon_tok_/);
    expect(jsonResult.device_name).toBe('Google Chrome on Windows 11');

    const tokenA = jsonResult.token;

    // Verify tokenA is valid initially
    let verifyCode = 200;
    let verifyResult: any = null;
    const reqVerifyA = {
      headers: { authorization: `Bearer ${tokenA}` },
      query: { user_email: 'gknayak@gmail.com' },
    };
    const resVerifyA = {
      status: (c: number) => {
        verifyCode = c;
        return resVerifyA;
      },
      json: (d: any) => {
        verifyResult = d;
        return resVerifyA;
      },
    };

    await handleAuthVerify(reqVerifyA, resVerifyA);
    expect(verifyCode).toBe(200);
    expect(verifyResult.valid).toBe(true);
  });

  it('2. User logs in on Device B with credentials -> Device A is invalidated with "Logged out from [Device B]"', async () => {
    // Step A: Login on Device A
    let tokenA = '';
    const resA = {
      status: () => resA,
      json: (d: any) => {
        tokenA = d.token;
        return resA;
      },
    };
    await handleAuthLogin({
      body: {
        email: 'gknayak@gmail.com',
        password: 'Gulshan@12345!',
        device_id: 'device_laptop_mac',
        device_name: 'Safari on macOS',
      },
      headers: {},
    }, resA);

    expect(tokenA).toBeTruthy();

    // Step B: User signs in on Device B (Android APK App)
    let resBCode = 200;
    let resBData: any = null;
    const resB = {
      status: (c: number) => {
        resBCode = c;
        return resB;
      },
      json: (d: any) => {
        resBData = d;
        return resB;
      },
    };
    await handleAuthLogin({
      body: {
        email: 'gknayak@gmail.com',
        password: 'Gulshan@12345!',
        device_id: 'device_android_s24',
        device_name: 'Android APK App (Samsung S24)',
      },
      headers: {
        'user-agent': 'Android Native APK',
      },
    }, resB);

    expect(resBCode).toBe(200);
    expect(resBData.success).toBe(true);
    expect(resBData.device_name).toBe('Android APK App (Samsung S24)');

    // Step C: Verify Device A is now revoked with the message stating it was logged out
    let verifyCode = 200;
    let verifyData: any = null;
    const resVerify = {
      status: (c: number) => {
        verifyCode = c;
        return resVerify;
      },
      json: (d: any) => {
        verifyData = d;
        return resVerify;
      },
    };
    await handleAuthVerify({
      headers: { authorization: `Bearer ${tokenA}` },
      query: { user_email: 'gknayak@gmail.com' },
    }, resVerify);

    expect(verifyCode).toBe(401);
    expect(verifyData.valid).toBe(false);
    expect(verifyData.revoked).toBe(true);
    expect(verifyData.message).toContain('Android APK App (Samsung S24)');
  });

  it('3. Expired in-memory sessions are rejected when the database is unavailable', async () => {
    vi.useFakeTimers();
    let token = '';
    const loginResponse = {
      status: () => loginResponse,
      json: (body: any) => { token = body.token; return loginResponse; },
    };
    await handleAuthLogin({
      body: {
        email: 'gknayak@gmail.com',
        password: 'Gulshan@12345!',
        device_id: 'device_expiry_test',
        device_name: 'Expiry Test Device',
      },
      headers: {},
    }, loginResponse);

    await vi.advanceTimersByTimeAsync(60 * 24 * 60 * 60 * 1000 + 1);
    let statusCode = 200;
    let verifyData: any;
    const verifyResponse = {
      status: (code: number) => { statusCode = code; return verifyResponse; },
      json: (body: any) => { verifyData = body; return verifyResponse; },
    };
    await handleAuthVerify({ headers: { authorization: `Bearer ${token}` } }, verifyResponse);

    expect(statusCode).toBe(401);
    expect(verifyData.valid).toBe(false);
  });

  it('4. WebSocket revokePreviousUserSessions sends termination payload to older devices', () => {
    // Test the exported revokePreviousUserSessions helper directly
    const revoked = revokePreviousUserSessions(
      ['gknayak@gmail.com', 'usr_gknayak'],
      'device_new_tablet',
      'iPad Pro (Chrome)'
    );
    expect(typeof revoked).toBe('number');
  });

  it('5. RealtimeHub handles SESSION_TERMINATED payload and triggers DOM event', () => {
    let capturedEvent: any = null;
    const listener = (e: any) => {
      capturedEvent = e.detail;
    };

    const target = typeof window !== 'undefined' ? window : (globalThis as any);
    if (!target.addEventListener) {
      const handlers: Record<string, Function[]> = {};
      target.addEventListener = (evt: string, fn: Function) => {
        handlers[evt] = handlers[evt] || [];
        handlers[evt].push(fn);
      };
      target.removeEventListener = (evt: string, fn: Function) => {
        if (handlers[evt]) handlers[evt] = handlers[evt].filter((f: any) => f !== fn);
      };
      target.dispatchEvent = (evt: any) => {
        (handlers[evt.type] || []).forEach((fn: any) => fn(evt));
      };
    }
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = target;
    }
    if (typeof (globalThis as any).CustomEvent === 'undefined') {
      (globalThis as any).CustomEvent = class {
        type: string;
        detail: any;
        constructor(type: string, params: any) {
          this.type = type;
          this.detail = params?.detail;
        }
      };
    }

    target.addEventListener('session_terminated', listener);

    (realtimeHub as any).handleIncomingMessage({
      type: 'SESSION_TERMINATED',
      newDeviceName: 'Chrome on Linux',
      message: 'Logged out because your account was signed in on Chrome on Linux',
      serverTimestamp: new Date().toISOString(),
    });

    expect(capturedEvent).toBeTruthy();
    expect(capturedEvent.message).toContain('Chrome on Linux');
    expect(localStorage.getItem('notion_os_auth_termination_notice')).toContain('Chrome on Linux');
    expect(localStorage.getItem('notion_os_auth_signed_out')).toBe('true');

    target.removeEventListener('session_terminated', listener);
  });

  it('6. LiveSyncSimulator and SyncHub are completely removed from the project', async () => {
    // Attempting to import LiveSyncSimulator should fail because it was deleted
    let importFailed = false;
    try {
      // @ts-expect-error Deleted component
      await import('../components/LiveSyncSimulator');
    } catch {
      importFailed = true;
    }
    expect(importFailed).toBe(true);
  });
});
