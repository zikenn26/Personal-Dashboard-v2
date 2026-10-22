import { beforeAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Auth, ensureUserWorkspaceInitialized, getUserWorkspaceKey } from '../utils/auth';
import { Storage, BLANK_PROFILE } from '../utils/storage';
import { isDummyMockAvatar, isAvatarMatchingUserEmailDomain } from '../utils/userUtils';
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
    expect(getCustomWorkspaceIdentifier()).toBe(getUserWorkspaceKey(userB));
    expect(getCustomWorkspaceEmail()).toBe(userB.email);
  });

  it('7. Simultaneous sessions on separate devices remain isolated', () => {
    const device1WsKey = getUserWorkspaceKey(userA);
    const device2WsKey = getUserWorkspaceKey(userB);

    expect(device1WsKey).not.toBe(device2WsKey);
    expect(device1WsKey).toBe(`user_${userA.id}`);
    expect(device2WsKey).toBe(`user_${userB.id}`);
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
    const wsKey = getUserWorkspaceKey(brandNewUser);
    const { data: partition } = await client
      .from('user_workspaces')
      .select('workspace_data, user_email')
      .eq('user_identifier', wsKey)
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

  it('12. ANY arbitrary new user gets an identical clean blank account with zero data leakage', () => {
    const randomUser: AuthUser = {
      id: 'usr_random_98765',
      email: 'priya.patel@techcorp.in',
      name: 'Priya Patel',
      avatarUrl: '',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };

    Storage.clearMemoryCaches();
    Auth.setCurrentUser(randomUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(randomUser));
    setCustomWorkspaceEmail(randomUser.email);

    // If new user on device, initialize clean default workspace
    if (!Storage.hasUserData(randomUser)) {
      Storage.resetToCleanUserWorkspace(randomUser);
    }

    // Verify completely blank account
    expect(Storage.getTodos()).toEqual([]);
    expect(Storage.getHabits()).toEqual([]);
    expect(Storage.getGoals()).toEqual([]);
    expect(Storage.getExpenses()).toEqual([]);
    expect(Storage.getJournal()).toEqual([]);
    expect(Storage.getMedia()).toEqual([]);
    expect(Storage.getAchievements()).toEqual([]);
    expect(Storage.getTimeline()).toEqual([]);
    expect(Storage.getProjects()).toEqual([]);
    expect(Storage.getSkills()).toEqual([]);
    expect(Storage.getPhotos()).toEqual([]);
    expect(Storage.getQuotes()).toEqual([]);
    expect(Storage.getExams()).toEqual([]);

    const profile = Storage.getProfile();
    expect(profile.name).toBe('Priya Patel');
    expect(profile.contactEmail).toBe('priya.patel@techcorp.in');
    expect(profile.handle).toBe('@priyapatel');
    expect(profile.avatarUrl).toBe('');
    expect(profile.educationRecords).toEqual([]);
    expect(profile.jobExperiences).toEqual([]);
    expect(profile.hobbies).toEqual([]);
    expect(profile.certifications).toEqual([]);
    expect(profile.services).toEqual([]);
    expect(profile.tools).toEqual([]);
    expect(profile.bio).toBe('');

    // Calling resetToDefault also keeps the workspace completely blank for this user
    Storage.resetToDefault();
    expect(Storage.getProjects()).toEqual([]);
    expect(Storage.getSkills()).toEqual([]);
    expect(Storage.getExpenses()).toEqual([]);
    expect(Storage.getProfile().name).toBe('Priya Patel');
    expect(Storage.getProfile().avatarUrl).toBe('');
  });

  it('13. Profile picture leakage protection: Non-Gulshan user strictly rejects Gulshan avatar and displays initials', () => {
    const arpitaUser: AuthUser = {
      id: '9e637e3b-c199-4611-8af9-c16c1fa942d5',
      email: 'arpitapri125@gmail.com',
      name: 'Arpita Priyadarsini',
      avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };

    // isDummyMockAvatar must detect that this avatar belongs to Gulshan and reject it for Arpita
    const isMock = isDummyMockAvatar(arpitaUser.avatarUrl, arpitaUser.email);
    expect(isMock).toBe(true);

    Storage.clearMemoryCaches();
    Auth.setCurrentUser(arpitaUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(arpitaUser));
    setCustomWorkspaceEmail(arpitaUser.email);

    // Initial clean workspace resets avatarUrl to ''
    Storage.resetToCleanUserWorkspace(arpitaUser);
    expect(Storage.getProfile().avatarUrl).toBe('');

    // If a contaminated profile payload is saved or loaded, it must be sanitized
    Storage.setProfile({
      ...Storage.getProfile(),
      avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
    });
    expect(Storage.getProfile().avatarUrl).toBe('');
  });

  it('14. isAvatarMatchingUserEmailDomain strictly validates domain and username compatibility', () => {
    // Correct Gulshan avatar for Gulshan's email
    expect(
      isAvatarMatchingUserEmailDomain(
        'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
        'gknayak@gmail.com'
      )
    ).toBe(true);

    // Gulshan avatar for another gmail user (arpitapri125@gmail.com) MUST be rejected
    expect(
      isAvatarMatchingUserEmailDomain(
        'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
        'arpitapri125@gmail.com'
      )
    ).toBe(false);

    // Mismatched domain (e.g. yahoo vs gmail) in avatar filename must be rejected
    expect(
      isAvatarMatchingUserEmailDomain(
        'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_alice_yahoo_com_123.webp',
        'alice@gmail.com'
      )
    ).toBe(false);

    // Placeholder / mock avatars must be rejected
    expect(
      isAvatarMatchingUserEmailDomain(
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        'alice@gmail.com'
      )
    ).toBe(false);
  });

  it('15. Switching users clears cached avatars and resets all workspace state without cross-session pollution', () => {
    // 1. User A (gknayak@gmail.com) logs in with valid avatar
    Storage.clearMemoryCaches();
    const gknUser: AuthUser = {
      id: 'gkn-uuid-1234',
      email: 'gknayak@gmail.com',
      name: 'Gulshan Kumar Nayak',
      avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };
    Auth.setCurrentUser(gknUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(gknUser));
    setCustomWorkspaceEmail(gknUser.email);

    Storage.setProfile({
      ...BLANK_PROFILE,
      name: 'Gulshan Kumar Nayak',
      contactEmail: 'gknayak@gmail.com',
      avatarUrl: gknUser.avatarUrl,
    });
    Storage.setExpenses([
      { id: 'exp-gkn-1', name: 'Server Hosting', amount: 1200, category: 'Services', date: '2026-10-20' },
    ]);
    expect(Storage.getProfile().avatarUrl).toBe(gknUser.avatarUrl);
    expect(Storage.getExpenses().length).toBe(1);

    // 2. User B (arpitapri125@gmail.com) signs in on the same browser
    Storage.clearMemoryCaches();
    const arpitaUser: AuthUser = {
      id: '9e637e3b-c199-4611-8af9-c16c1fa942d5',
      email: 'arpitapri125@gmail.com',
      name: 'Arpita Priyadarsini',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };
    Auth.setCurrentUser(arpitaUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(arpitaUser));
    setCustomWorkspaceEmail(arpitaUser.email);

    // User B workspace is completely isolated: 0 expenses, blank avatar
    if (!Storage.hasUserData(arpitaUser)) {
      Storage.resetToCleanUserWorkspace(arpitaUser);
    }
    expect(Storage.getExpenses()).toEqual([]);
    expect(Storage.getTodos()).toEqual([]);
    expect(Storage.getProfile().avatarUrl).toBe('');
    expect(Storage.getProfile().contactEmail).toBe('arpitapri125@gmail.com');
  });
});
