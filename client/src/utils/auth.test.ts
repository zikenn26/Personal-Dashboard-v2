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
  it('rejects unregistered accounts and prompts creation', async () => {
    const res = await Auth.signIn('nonexistent@example.com', '12345678');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Account not found');
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
    expect(wrongPassRes.message).toContain('Incorrect password');

    // Verify sign out clears session
    await Auth.signOut();
    expect(Auth.getCurrentUser()).toBeNull();
  });
});
