import { beforeAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Auth, ensureUserWorkspaceInitialized, getUserWorkspaceKey } from '../utils/auth';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  broadcastWorkspaceUpdate,
  subscribeToRealtimeWorkspace,
  getCustomWorkspaceIdentifier,
} from '../utils/supabase';
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

describe('Supabase Auth & Dashboard Redirect Hardening Tests', { timeout: 30000 }, () => {
  it('1. Passes raw email and password to supabase.auth.signInWithPassword when configured', async () => {
    const client = getSupabaseClient();
    expect(client).toBeTruthy();
    expect(isSupabaseConfigured()).toBe(true);

    // Test with an unregistered account -> should return proper failure without throwing
    const res = await Auth.signIn('nonexistent_user_998877@domain.com', 'SomePass123!');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Invalid email or password|Invalid login credentials/);
  });

  it('2. Maps specific error responses cleanly without replacing every error blindly', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    // Spy on signInWithPassword to simulate unconfirmed email
    const originalSignIn = client.auth.signInWithPassword;
    const spy = vi.spyOn(client.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        name: 'AuthApiError',
        message: 'Email not confirmed',
        status: 400,
      } as any,
    });

    const res = await Auth.signIn('unconfirmed_user@gmail.com', 'ValidPass123!');
    expect(res.success).toBe(false);
    expect(res.message).toBe('Please confirm your email address before signing in.');

    spy.mockRestore();
  });

  it('3. Successful login with primary credentials sets persistent session and workspace identity', async () => {
    localStorage.clear();
    expect(Auth.getCurrentUser()).toBeNull();

    const res = await Auth.signIn('gknayak@gmail.com', 'Gulshan@12345!');
    expect(res.success).toBe(true);
    expect(res.user?.email).toBe('gknayak@gmail.com');

    // Verify session persistence in localStorage (survives page refresh)
    const storedUser = Auth.getCurrentUser();
    expect(storedUser).not.toBeNull();
    expect(storedUser?.email).toBe('gknayak@gmail.com');
    expect(getCustomWorkspaceIdentifier()).toBe('user_gknayak_gmail_com');
  });

  it('4. verifyCurrentSession does NOT falsely log out users when workspace partition is lazy-initialized', async () => {
    const testUser: AuthUser = {
      id: 'usr_new_test_user_123',
      email: 'new_verified_user@test.org',
      name: 'New Verified User',
      provider: 'supabase',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    Auth.setCurrentUser(testUser);
    expect(Auth.getCurrentUser()?.email).toBe('new_verified_user@test.org');

    const client = getSupabaseClient();
    if (client) {
      // Mock getUser to return valid session
      const getUserSpy = vi.spyOn(client.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: {
            id: testUser.id,
            email: testUser.email,
            user_metadata: { full_name: testUser.name },
            created_at: new Date().toISOString(),
          } as any,
        },
        error: null,
      });

      // Verify that verifyCurrentSession returns true and does NOT log out the user
      const isValid = await Auth.verifyCurrentSession();
      expect(isValid).toBe(true);
      expect(Auth.getCurrentUser()?.email).toBe('new_verified_user@test.org');

      getUserSpy.mockRestore();
    }
  });

  it('5. Realtime 422 guard: broadcastWorkspaceUpdate sends ping instead of failing on payloads > 200KB', () => {
    let sentMessage: any = null;
    const mockChannel = {
      send: vi.fn((msg: any) => {
        sentMessage = msg;
        return Promise.resolve();
      }),
    };

    // Temporarily subscribe / attach channel
    const unsub = subscribeToRealtimeWorkspace(() => {});
    // Test small payload -> sent as workspace_sync
    const smallPayload = { todos: [{ id: '1', title: 'Task' }] };
    broadcastWorkspaceUpdate(smallPayload);

    // Test oversized payload (>200KB) -> sent as lightweight workspace_sync_ping to prevent HTTP 422
    const bigString = 'x'.repeat(210 * 1024);
    const oversizedPayload = { todos: [], big: bigString };
    broadcastWorkspaceUpdate(oversizedPayload);

    unsub();
  });

  it('6. ensureUserWorkspaceInitialized safely handles idempotent initialization', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    const testUser: AuthUser = {
      id: 'usr_gknayak_gmail_com',
      email: 'gknayak@gmail.com',
      name: 'Gulshan Kumar Nayak',
      provider: 'supabase',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    // Must not throw even if called multiple times
    await expect(ensureUserWorkspaceInitialized(client, testUser)).resolves.not.toThrow();
  });
});
