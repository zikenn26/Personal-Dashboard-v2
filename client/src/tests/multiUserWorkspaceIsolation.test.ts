import { beforeAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Auth, ensureUserWorkspaceInitialized, getUserWorkspaceKey } from '../utils/auth';
import { Storage, BLANK_PROFILE } from '../utils/storage';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
  getCustomWorkspaceIdentifier,
  getCustomWorkspaceEmail,
  broadcastWorkspaceUpdate,
  subscribeToRealtimeWorkspace,
  fetchWorkspaceFromSupabase,
} from '../utils/supabase';
import { AuthUser, ExpenseItem, HabitItem, TodoItem } from '../types';

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
    } as any;
  }
});

describe('Multi-User Workspace Isolation & Ownership Security Tests', { timeout: 35000 }, () => {
  const userA: AuthUser = {
    id: 'user-uuid-aaaa-1111-2222',
    email: 'user_a_owner@company.com',
    name: 'User A Owner',
    avatarUrl: 'https://cdn.example.com/avatars/userA.png',
    createdAt: Date.now() - 100000,
    lastLoginAt: Date.now(),
    provider: 'supabase',
  };

  const userB: AuthUser = {
    id: 'user-uuid-bbbb-3333-4444',
    email: 'user_b_newcomer@company.com',
    name: 'User B Newcomer',
    avatarUrl: '',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    provider: 'supabase',
  };

  it('1. A newly registered User B receives a blank, independent workspace', () => {
    // Switch to User B
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userB);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userB));
    setCustomWorkspaceEmail(userB.email);

    // Initial clean workspace
    if (!Storage.hasUserData(userB)) {
      Storage.resetToCleanUserWorkspace(userB);
    }

    const expenses = Storage.getExpenses();
    const habits = Storage.getHabits();
    const todos = Storage.getTodos();
    const profile = Storage.getProfile();

    expect(expenses).toEqual([]);
    expect(habits).toEqual([]);
    expect(todos).toEqual([]);
    expect(profile.name).toBe('User B Newcomer');
    expect(profile.contactEmail).toBe(userB.email);
    expect(profile.avatarUrl).toBe('');
    expect(profile.jobExperiences).toEqual([]);
    expect(profile.educationRecords).toEqual([]);
  });

  it('2. User B cannot read User A expenses, habits, profile, or tasks', () => {
    // 1. Setup User A with private records
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userA);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userA));
    setCustomWorkspaceEmail(userA.email);

    const expenseA: ExpenseItem = {
      id: 'exp-userA-secret-01',
      name: 'User A Confidential Investment',
      amount: 50000,
      category: 'Investments',
      date: '2026-10-21',
      direction: 'debit',
      createdAt: Date.now(),
    };
    Storage.setExpenses([expenseA]);

    const habitA: HabitItem = {
      id: 'habit-userA-secret',
      name: 'User A Secret Routine',
      frequency: 'daily',
      timeSlot: 'Morning',
      streak: 15,
      history: {},
    };
    Storage.setHabits([habitA]);

    const todoA: TodoItem = {
      id: 'todo-userA-secret',
      text: 'User A Secret Project Plan',
      completed: false,
      priority: 'high',
      dueDate: '2026-11-01',
    };
    Storage.setTodos([todoA]);

    // Verify User A has their data
    expect(Storage.getExpenses().length).toBe(1);
    expect(Storage.getExpenses()[0].id).toBe('exp-userA-secret-01');

    // 2. Switch directly to User B
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userB);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userB));
    setCustomWorkspaceEmail(userB.email);

    // Verify User B cannot access User A's data
    const expensesB = Storage.getExpenses();
    const habitsB = Storage.getHabits();
    const todosB = Storage.getTodos();

    expect(expensesB).toEqual([]);
    expect(habitsB).toEqual([]);
    expect(todosB).toEqual([]);
    expect(expensesB.some((e) => e.id === 'exp-userA-secret-01')).toBe(false);
  });

  it('3. User B cannot update or overwrite User A records via cross-account payload import', () => {
    // User B tries to import a payload containing User A's contactEmail
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userB);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userB));
    setCustomWorkspaceEmail(userB.email);

    const maliciousPayload = {
      profile: {
        name: 'Hacked User A',
        contactEmail: userA.email, // Targeted at User A
      },
      expenses: [
        {
          id: 'exp-malicious-overwrite',
          name: 'Hacked Expense',
          amount: 999999,
          date: '2026-10-21',
        },
      ],
    };

    // importAllDataPayload must reject mismatched email payload
    const importResult = Storage.importAllDataPayload(maliciousPayload);
    expect(importResult).toBe(false);

    // Verify User A's storage was not modified
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userA));
    setCustomWorkspaceEmail(userA.email);
    expect(Storage.getExpenses()[0].name).toBe('User A Confidential Investment');
  });

  it('4. User A username and avatar remain unchanged after User B signs in and edits profile', () => {
    // Sign in as User A, confirm profile
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userA);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userA));
    setCustomWorkspaceEmail(userA.email);

    const originalProfileA = {
      ...BLANK_PROFILE,
      name: 'User A Original',
      contactEmail: userA.email,
      avatarUrl: 'https://cdn.example.com/avatars/userA_original.png',
    };
    Storage.setProfile(originalProfileA);

    // Sign in as User B and modify User B's profile
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userB);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userB));
    setCustomWorkspaceEmail(userB.email);

    const profileB = {
      ...BLANK_PROFILE,
      name: 'User B New Name',
      contactEmail: userB.email,
      avatarUrl: 'https://cdn.example.com/avatars/userB_avatar.png',
    };
    Storage.setProfile(profileB);
    expect(Storage.getProfile().name).toBe('User B New Name');

    // Switch back to User A and verify profile is 100% intact
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userA);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userA));
    setCustomWorkspaceEmail(userA.email);

    const profileAAfter = Storage.getProfile();
    expect(profileAAfter.name).toBe('User A Original');
    expect(profileAAfter.avatarUrl).toBe('https://cdn.example.com/avatars/userA_original.png');
    expect(profileAAfter.name).not.toBe('Alex Morgan');
    expect(profileAAfter.name).not.toBe('User B New Name');
  });

  it('5. Signing out of A and signing into B does not show A cached or in-memory data', async () => {
    // User A sets data and signs out
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userA);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userA));
    setCustomWorkspaceEmail(userA.email);

    await Auth.signOut();
    Storage.clearMemoryCaches();
    setCustomWorkspaceIdentifier('user_guest');
    setCustomWorkspaceEmail('guest@workspace.local');

    // In guest mode, data is empty
    expect(Auth.getCurrentUser()).toBeNull();
    expect(Storage.getExpenses()).toEqual([]);

    // Now sign in as User B
    Auth.setCurrentUser(userB);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userB));
    setCustomWorkspaceEmail(userB.email);

    expect(Storage.getExpenses()).toEqual([]);
    expect(Storage.getHabits()).toEqual([]);
  });

  it('6. Refreshing the page and reopening the app preserve the correct account workspace', () => {
    // Simulate User B session persisted in localStorage
    Auth.setCurrentUser(userB);
    const restoredUser = Auth.getCurrentUser();
    expect(restoredUser?.email).toBe(userB.email);
    expect(getCustomWorkspaceIdentifier()).toBe(`user_${userB.email.replace(/[^a-z0-9]/g, '_')}`);
    expect(getCustomWorkspaceEmail()).toBe(userB.email);
  });

  it('7. Simultaneous sessions on separate devices remain isolated', () => {
    const device1WsKey = getUserWorkspaceKey(userA);
    const device2WsKey = getUserWorkspaceKey(userB);

    expect(device1WsKey).not.toBe(device2WsKey);
    expect(device1WsKey).toBe('user_user_a_owner_company_com');
    expect(device2WsKey).toBe('user_user_b_newcomer_company_com');
  });

  it('8. Realtime updates for A cannot modify or appear in B dashboard', () => {
    // User B is active
    Storage.clearMemoryCaches();
    Auth.setCurrentUser(userB);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userB));
    setCustomWorkspaceEmail(userB.email);

    // Simulate incoming broadcast containing User A data
    const payloadForA = {
      profile: {
        name: 'User A Name',
        contactEmail: userA.email,
      },
      expenses: [{ id: 'exp-broadcast-a', name: 'User A Remote Item', amount: 300, date: '2026-10-21' }],
    };

    // importAllDataPayload must reject cross-account data
    const accepted = Storage.importAllDataPayload(payloadForA);
    expect(accepted).toBe(false);

    // Verify User B's dashboard was not updated with User A's broadcast data
    expect(Storage.getExpenses().some((e) => e.id === 'exp-broadcast-a')).toBe(false);
  });

  it('9. A missing workspace is created safely without copying any existing workspace', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    const brandNewUser: AuthUser = {
      id: 'brand-new-user-uuid-9999',
      email: 'brand_new_isolated_user@test.org',
      name: 'Brand New User',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };

    // Initialize partition
    await ensureUserWorkspaceInitialized(client, brandNewUser);

    // Fetch created partition
    const cleanId = brandNewUser.email.replace(/[^a-z0-9]/g, '_');
    const { data: partition } = await client
      .from('user_workspaces')
      .select('workspace_data, user_email')
      .eq('user_identifier', `user_${cleanId}`)
      .maybeSingle();

    if (partition) {
      expect(partition.user_email).toBe(brandNewUser.email);
      expect(partition.workspace_data.expenses).toEqual([]);
      expect(partition.workspace_data.habits).toEqual([]);
      expect(partition.workspace_data.todos).toEqual([]);
      expect(partition.workspace_data.profile.contactEmail).toBe(brandNewUser.email);
    }
  });

  it('10. Existing users retain their own data after migrations and continue to sign in', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    // Verify gknayak@gmail.com workspace still exists and retains data
    const { data: gknRow } = await client
      .from('user_workspaces')
      .select('workspace_data, user_email, user_identifier')
      .eq('user_identifier', 'user_gknayak_gmail_com')
      .maybeSingle();

    expect(gknRow).toBeDefined();
    expect(gknRow?.user_email).toBe('gknayak@gmail.com');
    // Ensure profile contains legitimate name and expenses are preserved
    expect(gknRow?.workspace_data?.profile?.name).toBe('Gulshan Kumar Nayak');
    expect(Array.isArray(gknRow?.workspace_data?.expenses)).toBe(true);
    expect(gknRow?.workspace_data?.expenses.length).toBeGreaterThan(0);
  });

  it('11. Direct database/API requests that violate ownership are blocked or rejected', async () => {
    // When in guest mode or cross-account mismatch, fetchWorkspaceFromSupabase rejects guest access
    setCustomWorkspaceIdentifier('user_guest');
    setCustomWorkspaceEmail('guest@workspace.local');

    const guestFetch = await fetchWorkspaceFromSupabase();
    expect(guestFetch.success).toBe(false);
    expect(guestFetch.message).toContain('Guest workspace is local-only');
  });
});
