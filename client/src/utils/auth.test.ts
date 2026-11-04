import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Auth } from './auth';

beforeAll(() => {
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
  
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = String(val); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0,
    } as Storage;
  }
});

describe('Authentication Engine & Persistence', { timeout: 30000 }, () => {
  const accounts = new Map<string, { password: string; user: any }>();
  beforeEach(() => {
    accounts.clear();
    vi.stubGlobal('fetch', vi.fn(async (input: any, init: any = {}) => {
      const path = String(input);
      const body = JSON.parse(init.body || '{}');
      const respond = (status: number, value: any) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => value });
      if (path.includes('/api/auth/register')) {
        if (accounts.has(body.email)) return respond(409, { success: false, message: 'An account with this email already exists.' });
        const user = { id: `id-${body.email}`, email: body.email, name: body.name, provider: 'neon' };
        accounts.set(body.email, { password: body.password, user });
        return respond(201, { success: true, user });
      }
      if (path.includes('/api/auth/login')) {
        const account = accounts.get(body.email);
        return account && account.password === body.password
          ? respond(200, { success: true, user: account.user, token: `server-token-${body.email}` })
          : respond(401, { success: false, message: 'Invalid email or password.' });
      }
      return respond(404, { success: false });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects unregistered accounts with a generic message (no user enumeration)', async () => {
    const res = await Auth.signIn('nonexistent@example.com', '12345678');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid email or password');
  });

  it('creates and signs in new accounts via signUp with persistence', async () => {
    const signupRes = await Auth.signUp('newuser@example.com', 'securepass123', 'Test User');
    expect(signupRes.success).toBe(true);
    expect(signupRes.user?.email).toBe('newuser@example.com');
    expect(signupRes.user?.name).toBe('Test User');

    // Verify session is persisted
    const currentUser = Auth.getCurrentUser();
    expect(currentUser?.email).toBe('newuser@example.com');

    // Verify sign in with correct password
    const signinRes = await Auth.signIn('newuser@example.com', 'securepass123');
    expect(signinRes.success).toBe(true);
    expect(signinRes.user?.email).toBe('newuser@example.com');

    // Verify sign in with wrong password
    const wrongPassRes = await Auth.signIn('newuser@example.com', 'wrongpassword');
    expect(wrongPassRes.success).toBe(false);
    expect(wrongPassRes.message).toContain('Invalid email or password');

    // Verify sign out clears session
    await Auth.signOut();
    expect(Auth.getCurrentUser()).toBeNull();
  });

  it('persists account credentials on the server across a cleared local session', async () => {
    const res1 = await Auth.signUp('multidevice@example.com', 'PassDevice123', 'Multi Device User');
    expect(res1.success).toBe(true);

    const user1 = Auth.getCurrentUser();
    expect(user1?.email).toBe('multidevice@example.com');

    // 2. Simulate a cleared session (e.g. browser restart)
    localStorage.removeItem('notion_os_auth_user_v1');
    expect(Auth.getCurrentUser()).toBeNull();

    // 3. Signing in again is verified by the server-owned account service
    const loginRes2 = await Auth.signIn('multidevice@example.com', 'PassDevice123');
    expect(loginRes2.success).toBe(true);
    expect(loginRes2.user?.email).toBe('multidevice@example.com');

    const user2 = Auth.getCurrentUser();
    expect(user2?.email).toBe('multidevice@example.com');
  });

  it('rejects sign-in attempts for purged accounts (gknayak@gmail.com, arpitapri125@gmail.com) on a fresh client', async () => {
    // Clear localStorage to simulate brand new APK installation on Android
    localStorage.clear();
    expect(Auth.getCurrentUser()).toBeNull();

    // Sign in attempts must be rejected since accounts were completely deleted
    const loginGkn = await Auth.signIn('gknayak@gmail.com', 'Gulshan@12345!');
    expect(loginGkn.success).toBe(false);
    expect(loginGkn.user).toBeUndefined();

    const loginArp = await Auth.signIn('arpitapri125@gmail.com', 'Arpita@12345!');
    expect(loginArp.success).toBe(false);
    expect(loginArp.user).toBeUndefined();

    // Verify session remains logged out
    expect(Auth.getCurrentUser()).toBeNull();
  });

  it('allows a deleted email to register again and rejects duplicate server registrations', async () => {
    const newSignup = await Auth.signUp('gknayak@gmail.com', 'StrongPass99!', 'Gulshan');
    expect(newSignup.success).toBe(true);
    expect(newSignup.user?.email).toBe('gknayak@gmail.com');

    const duplicateSignup = await Auth.signUp('gknayak@gmail.com', 'OtherPass99!', 'Another Person');
    expect(duplicateSignup.success).toBe(false);
    expect(duplicateSignup.message).toContain('already exists');
  });
});
