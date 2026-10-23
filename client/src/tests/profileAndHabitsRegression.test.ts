import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Auth, getUserWorkspaceKey } from '../utils/auth';
import { Storage, OWNER_GKN_HABITS } from '../utils/storage';
import {
  isAvatarMatchingUserEmailDomain,
  isDummyMockAvatar,
  getUserInitials,
} from '../utils/userUtils';
import { setCustomWorkspaceIdentifier, setCustomWorkspaceEmail } from '../utils/supabase';
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
    } as any;
  }
});

describe('User Profile Name, Avatar and Habits Persistence Tests', () => {
  const gknUser: AuthUser = {
    id: 'user-gulnayak1206-uuid',
    email: 'gulnayak1206@gmail.com',
    name: 'Gknayak',
    avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
    createdAt: Date.now() - 500000,
    lastLoginAt: Date.now(),
    provider: 'supabase',
  };

  it('1. Updating name from Gknayak to Gulshan Kumar Nayak persists and is not reverted by cloud payload with Gknayak', async () => {
    Auth.setCurrentUser(gknUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(gknUser));
    setCustomWorkspaceEmail(gknUser.email);

    // Initial state
    const initialProfile = Storage.getProfile();
    expect(initialProfile).toBeDefined();

    // User edits name to "Gulshan Kumar Nayak"
    const updatedProfile = { ...initialProfile, name: 'Gulshan Kumar Nayak' };
    Storage.setProfile(updatedProfile);
    await Auth.updateCurrentUserName('Gulshan Kumar Nayak');

    expect(Storage.getProfile().name).toBe('Gulshan Kumar Nayak');
    expect(Auth.getCurrentUser()?.name).toBe('Gulshan Kumar Nayak');

    // Simulate an older cloud snapshot coming in with "Gknayak"
    const olderCloudPayload = {
      profile: {
        name: 'Gknayak',
        contactEmail: 'gulnayak1206@gmail.com',
        avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
      },
    };

    Storage.importAllDataPayload(olderCloudPayload);

    // Name must NOT revert back to "Gknayak"
    expect(Storage.getProfile().name).toBe('Gulshan Kumar Nayak');
  });

  it('2. Custom profile picture for gulnayak1206@gmail.com is accepted and not blanked out or reverted to initials', () => {
    setCustomWorkspaceEmail('gulnayak1206@gmail.com');

    const gknCdnUrl =
      'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp';

    // Must be valid for gulnayak1206@gmail.com
    expect(isAvatarMatchingUserEmailDomain(gknCdnUrl, 'gulnayak1206@gmail.com')).toBe(true);
    expect(isDummyMockAvatar(gknCdnUrl, 'gulnayak1206@gmail.com')).toBe(false);

    // Uploaded data URL must also be valid
    const dataUrl = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    expect(isAvatarMatchingUserEmailDomain(dataUrl, 'gulnayak1206@gmail.com')).toBe(true);
    expect(isDummyMockAvatar(dataUrl, 'gulnayak1206@gmail.com')).toBe(false);

    // Saving profile with CDN avatar preserves it
    const prof = Storage.getProfile();
    Storage.setProfile({ ...prof, avatarUrl: gknCdnUrl });
    expect(Storage.getProfile().avatarUrl).toBe(gknCdnUrl);

    // Saving profile with Data URL preserves it
    Storage.setProfile({ ...prof, avatarUrl: dataUrl });
    expect(Storage.getProfile().avatarUrl).toBe(dataUrl);

    // Cross-account isolation: arpitapri125@gmail.com must still reject gknayak asset
    expect(isAvatarMatchingUserEmailDomain(gknCdnUrl, 'arpitapri125@gmail.com')).toBe(false);
    expect(isDummyMockAvatar(gknCdnUrl, 'arpitapri125@gmail.com')).toBe(true);
  });

  it('3. Habits of gulnayak1206@gmail.com and gknayak@gmail.com retain Gym and Study habits with real entries and never show empty', () => {
    // gulnayak1206@gmail.com
    Auth.setCurrentUser(gknUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(gknUser));
    setCustomWorkspaceEmail('gulnayak1206@gmail.com');

    // If local storage is empty or reset
    Storage.resetToCleanUserWorkspace(gknUser);

    const habits = Storage.getHabits();
    expect(habits.length).toBeGreaterThanOrEqual(2);

    const gymHabit = habits.find((h) => h.title.toLowerCase() === 'gym');
    const studyHabit = habits.find((h) => h.title.toLowerCase() === 'study');

    expect(gymHabit).toBeDefined();
    expect(studyHabit).toBeDefined();

    expect(gymHabit?.completedDates?.length).toBeGreaterThan(0);
    expect(studyHabit?.completedDates?.length).toBeGreaterThan(0);
    expect(studyHabit?.streak).toBeGreaterThan(0);

    // Even if cloud payload with empty habits arrives, owner habits are maintained
    Storage.importAllDataPayload({ habits: [] });
    const preservedHabits = Storage.getHabits();
    expect(preservedHabits.some((h) => h.title.toLowerCase() === 'gym')).toBe(true);
    expect(preservedHabits.some((h) => h.title.toLowerCase() === 'study')).toBe(true);
  });

  it('4. User B (arpitapri125@gmail.com) remains clean and does not inherit Gulshan habits', () => {
    const userArpita: AuthUser = {
      id: 'user-arpita-uuid-999',
      email: 'arpitapri125@gmail.com',
      name: 'Arpita Priyadarshini',
      avatarUrl: '',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };

    Auth.setCurrentUser(userArpita);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(userArpita));
    setCustomWorkspaceEmail(userArpita.email);
    Storage.resetToCleanUserWorkspace(userArpita);

    const habits = Storage.getHabits();
    expect(habits).toEqual([]);

    const profile = Storage.getProfile();
    expect(profile.name).toBe('Arpita Priyadarshini');
    expect(profile.avatarUrl).toBe('');
    expect(profile.contactEmail).toBe('arpitapri125@gmail.com');
  });

  it('5. Confirms validity for gknayak@gmail.com: authentic habits, avatar, and profile persistence', async () => {
    const gknOwnerUser: AuthUser = {
      id: '036fe7d3-6a13-4740-b028-afb55e81e00e',
      email: 'gknayak@gmail.com',
      name: 'Gulshan Kumar Nayak',
      avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
      createdAt: Date.now() - 500000,
      lastLoginAt: Date.now(),
      provider: 'supabase',
    };

    Auth.setCurrentUser(gknOwnerUser);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(gknOwnerUser));
    setCustomWorkspaceEmail(gknOwnerUser.email);
    Storage.resetToCleanUserWorkspace(gknOwnerUser);

    // 1. Habits must have Gym and Study
    const habits = Storage.getHabits();
    expect(habits.length).toBeGreaterThanOrEqual(2);
    expect(habits.some((h) => h.title.toLowerCase() === 'gym')).toBe(true);
    expect(habits.some((h) => h.title.toLowerCase() === 'study')).toBe(true);

    // 2. Avatar must match and not be dummy mock
    const profile = Storage.getProfile();
    expect(isAvatarMatchingUserEmailDomain(profile.avatarUrl, 'gknayak@gmail.com')).toBe(true);
    expect(isDummyMockAvatar(profile.avatarUrl, 'gknayak@gmail.com')).toBe(false);

    // 3. Name update must persist and not revert
    const updated = { ...profile, name: 'Gulshan Kumar Nayak' };
    Storage.setProfile(updated);
    await Auth.updateCurrentUserName('Gulshan Kumar Nayak');

    const fresh = Storage.getProfile();
    expect(fresh.name).toBe('Gulshan Kumar Nayak');

    // Simulate older cloud snapshot
    Storage.importAllDataPayload({
      profile: {
        name: 'Gknayak',
        contactEmail: 'gknayak@gmail.com',
      },
    });

    expect(Storage.getProfile().name).toBe('Gulshan Kumar Nayak');
  });

  it('6. Signin / Signup modal email field does not contain hardcoded email in placeholder', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const authModalPath = path.resolve(__dirname, '../components/AuthModal.tsx');
    const content = fs.readFileSync(authModalPath, 'utf-8');

    // Must not leak specific email in placeholder
    expect(content.includes('e.g. gknayak@gmail.com')).toBe(false);
    expect(content.includes('placeholder={mode === \'forgot\' ? \'name@example.com\' : \'Enter username or email\'}')).toBe(true);
  });

  it('7. Storage.setProfile preserves custom photo and does not wipe to empty when activeEmail matches contactEmail', () => {
    setCustomWorkspaceEmail('gknayak@gmail.com');
    const cdnUrl = 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp';

    const p = Storage.getProfile();
    Storage.setProfile({
      ...p,
      contactEmail: 'gknayak@gmail.com',
      avatarUrl: cdnUrl,
    });

    const saved = Storage.getProfile();
    expect(saved.avatarUrl).toBe(cdnUrl);
  });
});

