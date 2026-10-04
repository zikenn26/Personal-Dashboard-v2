import { beforeAll, describe, expect, it } from 'vitest';
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

describe('Authentication Engine & Persistence', () => {
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

  it('persists local credentials across a cleared session (re-login on the same device)', async () => {
    // 1. Sign up on this device (Supabase not configured in this test env, so this exercises
    // the offline local-credential fallback path)
    const res1 = await Auth.signUp('multidevice@example.com', 'PassDevice123', 'Multi Device User');
    expect(res1.success).toBe(true);

    const user1 = Auth.getCurrentUser();
    expect(user1?.email).toBe('multidevice@example.com');

    // 2. Simulate a cleared session (e.g. browser restart) without wiping stored credentials
    localStorage.removeItem('notion_os_auth_user_v1');
    expect(Auth.getCurrentUser()).toBeNull();

    // 3. Signing back in should succeed against the locally stored password hash
    const loginRes2 = await Auth.signIn('multidevice@example.com', 'PassDevice123');
    expect(loginRes2.success).toBe(true);
    expect(loginRes2.user?.email).toBe('multidevice@example.com');

    const user2 = Auth.getCurrentUser();
    expect(user2?.email).toBe('multidevice@example.com');
  });

  it('authenticates cloud-persisted account (gknayak@gmail.com) on a fresh client with empty localStorage', async () => {
    // Clear localStorage to simulate brand new APK installation on Android
    localStorage.clear();
    expect(Auth.getCurrentUser()).toBeNull();

    // Sign in with the user's credentials
    const loginRes = await Auth.signIn('gknayak@gmail.com', 'Gulshan@12345!');
    expect(loginRes.success).toBe(true);
    expect(loginRes.user?.email).toBe('gknayak@gmail.com');

    // Verify session was established and cached in localStorage
    const user = Auth.getCurrentUser();
    expect(user?.email).toBe('gknayak@gmail.com');
    expect(user?.name).toBeTruthy();
  });
});
