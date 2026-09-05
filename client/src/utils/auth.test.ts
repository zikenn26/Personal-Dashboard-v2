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

describe('Authentication Engine & Mock Test Account', () => {
  it('allows login with the mock test account gulshan@gmail.com and 12345678', async () => {
    const res = await Auth.signIn('gulshan@gmail.com', '12345678');
    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user?.email).toBe('gulshan@gmail.com');
    expect(res.user?.name).toBe('Gulshan Kumar Nayak');

    const currentUser = Auth.getCurrentUser();
    expect(currentUser?.email).toBe('gulshan@gmail.com');
  });

  it('rejects incorrect password for mock test account', async () => {
    const res = await Auth.signIn('gulshan@gmail.com', 'wrongpassword');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Incorrect password');
  });

  it('rejects unregistered accounts and prompts creation', async () => {
    const res = await Auth.signIn('nonexistent@example.com', '12345678');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Account not found');
  });

  it('creates and signs in new accounts via signUp', async () => {
    const signupRes = await Auth.signUp('newuser@example.com', 'securepass123', 'Test User');
    expect(signupRes.success).toBe(true);
    expect(signupRes.user?.email).toBe('newuser@example.com');

    const signinRes = await Auth.signIn('newuser@example.com', 'securepass123');
    expect(signinRes.success).toBe(true);
  });
});
