import { beforeAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Auth } from '../utils/auth';
import {
  broadcastWorkspaceUpdate,
  subscribeToRealtimeWorkspace,
} from '../utils/neonSync';
import { AuthUser } from '../types';

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

describe('Server Auth & Dashboard Redirect Hardening Tests', { timeout: 30000 }, () => {
  it('verifies an active server session and records its data generation', async () => {
    const testUser: AuthUser = {
      id: 'usr_new_test_user_123',
      email: 'new_verified_user@test.org',
      name: 'New Verified User',
      provider: 'neon',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    Auth.setCurrentUser(testUser, 'test-session-token');
    expect(Auth.getCurrentUser()?.email).toBe('new_verified_user@test.org');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, valid: true, generation: 7 }),
    } as Response);

    const isValid = await Auth.verifyCurrentSession();
    expect(isValid).toBe(true);
    expect(Auth.getCurrentUser()?.email).toBe('new_verified_user@test.org');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/verify'),
      expect.objectContaining({ headers: { Authorization: 'Bearer test-session-token' } }),
    );
    expect(localStorage.getItem('notion_os_auth_generation_v1')).toBe('7');
    fetchSpy.mockRestore();
  });

  it('uses local cross-tab notifications without a separate database client', () => {
    const unsub = subscribeToRealtimeWorkspace(() => {});
    expect(() => broadcastWorkspaceUpdate({ todos: [{ id: '1', title: 'Task' }] })).not.toThrow();
    unsub();
  });
});
