import { AuthUser } from '../types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
} from './supabase';
import { hashPassword, verifyPasswordHash } from './crypto';

const AUTH_STORAGE_KEY = 'notion_os_auth_user_v1';
const SAVED_USERS_KEY = 'notion_os_saved_accounts_v1';
const USER_CREDENTIALS_KEY = 'notion_os_user_credentials_v1';

// Generate safe user identifier for per-user cloud database workspace partition
export const getUserWorkspaceKey = (user: AuthUser | null): string => {
  if (!user) return 'user_guest';
  // Normalize email to safe alphanumeric string
  const cleanEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `user_${cleanEmail}`;
};

// Helper to store & retrieve credentials map securely in local browser storage only
const getLocalCredentialsMap = (): Record<string, { user: AuthUser; pass: string }> => {
  try {
    const raw = localStorage.getItem(USER_CREDENTIALS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
};

const saveLocalCredential = async (email: string, pass: string, user: AuthUser) => {
  try {
    const map = getLocalCredentialsMap();
    map[email.toLowerCase()] = { user, pass: await hashPassword(pass) };
    localStorage.setItem(USER_CREDENTIALS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save local credential:', e);
  }
};

/**
 * Persist encrypted account credentials to Supabase for secure multi-device sign in.
 */
export const saveCloudCredential = async (cleanEmail: string, passHash: string, user: AuthUser) => {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  try {
    const authIdentifier = `account_auth_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    await client.from('user_workspaces').upsert(
      {
        user_identifier: authIdentifier,
        user_email: cleanEmail,
        workspace_data: {
          account: {
            user,
            passHash,
            updatedAt: Date.now(),
          },
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_identifier' }
    );
  } catch (err) {
    console.warn('Could not backup account auth credential to cloud:', err);
  }
};

/**
 * Retrieve account credentials from cloud to verify login on a secondary device.
 */
export const fetchCloudCredential = async (
  cleanEmail: string
): Promise<{ user: AuthUser; passHash: string } | null> => {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  try {
    const authIdentifier = `account_auth_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const { data, error } = await client
      .from('user_workspaces')
      .select('workspace_data')
      .eq('user_identifier', authIdentifier)
      .maybeSingle();

    if (error || !data || !data.workspace_data?.account) {
      return null;
    }
    const acct = data.workspace_data.account;
    if (acct?.user && acct?.passHash) {
      if (acct.user.id === 'user_gulshan_mock') {
        acct.user.id = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      }
      return { user: acct.user, passHash: acct.passHash };
    }
  } catch (err) {
    console.warn('Failed to fetch cloud account credential:', err);
  }
  return null;
};

export const Auth = {
  /**
   * Get currently logged-in user from LocalStorage
   */
  getCurrentUser: (): AuthUser | null => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const user = JSON.parse(stored);
        if (user && user.email) {
          // Normalize legacy mock ID if previously saved
          if (user.id === 'user_gulshan_mock') {
            user.id = `usr_${user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
            } catch {
              // ignore
            }
          }
          setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
          setCustomWorkspaceEmail(user.email);
          return user;
        }
      }
    } catch (e) {
      console.warn('Failed to parse current auth user:', e);
    }
    return null;
  },

  /**
   * Save user session locally
   */
  setCurrentUser: (user: AuthUser | null) => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
        setCustomWorkspaceEmail(user.email);
        // Save into known accounts list
        const accounts = Auth.getKnownAccounts();
        const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === user.email.toLowerCase());
        if (existingIdx >= 0) {
          accounts[existingIdx] = user;
        } else {
          accounts.push(user);
        }
        localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(accounts));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setCustomWorkspaceIdentifier('user_guest');
        setCustomWorkspaceEmail('guest@workspace.local');
      }
    } catch (e) {
      console.warn('Failed to set current auth user:', e);
    }
  },

  /**
   * List of known accounts saved on this browser
   */
  getKnownAccounts: (): AuthUser[] => {
    try {
      const stored = localStorage.getItem(SAVED_USERS_KEY);
      if (stored) {
        const list: AuthUser[] = JSON.parse(stored);
        return list.map((a) => {
          if (a.id === 'user_gulshan_mock') {
            return { ...a, id: `usr_${a.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}` };
          }
          return a;
        });
      }
    } catch {
      // ignore
    }
    return [];
  },

  /**
   * Sign In with Email & Password
   * Strict password verification across devices via Supabase Cloud and local cache
   */
  signIn: async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; user?: AuthUser; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail) {
      return { success: false, message: 'Please enter your email address.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Please enter your password.' };
    }

    // 1. If Supabase is configured, try Supabase Auth
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass,
        });

        if (!error && data.user) {
          const user: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
            avatarUrl: data.user.user_metadata?.avatar_url,
            createdAt: new Date(data.user.created_at).getTime(),
            lastLoginAt: Date.now(),
            provider: 'supabase',
          };
          Auth.setCurrentUser(user);
          await saveLocalCredential(cleanEmail, cleanPass, user);
          const passHash = await hashPassword(cleanPass);
          void saveCloudCredential(cleanEmail, passHash, user);
          return { success: true, user, message: 'Signed in via Supabase Cloud' };
        }
      } catch (err: any) {
        console.warn('Supabase Auth attempt:', err);
      }
    }

    // 2. Check registered local accounts credentials on this device
    const credentialsMap = getLocalCredentialsMap();
    const storedRecord = credentialsMap[cleanEmail];

    if (storedRecord) {
      const storedPass = storedRecord.pass;
      const valid = storedPass.trim().startsWith('{')
        ? await verifyPasswordHash(storedPass, cleanPass)
        : storedPass === cleanPass;
      if (valid) {
        let user = { ...storedRecord.user, lastLoginAt: Date.now() };
        if (user.id === 'user_gulshan_mock') {
          user.id = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
        }
        await saveLocalCredential(cleanEmail, cleanPass, user);
        Auth.setCurrentUser(user);
        const passHash = await hashPassword(cleanPass);
        void saveCloudCredential(cleanEmail, passHash, user);
        return { success: true, user, message: 'Signed in successfully' };
      } else {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }
    }

    // 3. Multi-device cloud lookup: Account created on another device
    const cloudRecord = await fetchCloudCredential(cleanEmail);
    if (cloudRecord) {
      const valid = await verifyPasswordHash(cloudRecord.passHash, cleanPass);
      if (valid) {
        let user = { ...cloudRecord.user, lastLoginAt: Date.now() };
        if (user.id === 'user_gulshan_mock') {
          user.id = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
        }
        // Cache credentials locally on this device for offline availability
        await saveLocalCredential(cleanEmail, cleanPass, user);
        Auth.setCurrentUser(user);
        return { success: true, user, message: 'Signed in successfully across devices!' };
      } else {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }
    }

    // 4. If account is not registered anywhere yet, require signup
    return {
      success: false,
      message: 'Account not found. Please create an account by clicking "Create Account" first.',
    };
  },

  /**
   * Sign Up / Create a new personalized account with multi-device cloud persistence
   */
  signUp: async (
    email: string,
    pass: string,
    name?: string
  ): Promise<{ success: boolean; user?: AuthUser; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const displayName =
      name?.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[\._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const passHash = await hashPassword(cleanPass);

    // 1. Attempt Supabase Sign Up if available
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      try {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: {
              name: displayName,
            },
          },
        });

        if (!error && data.user) {
          const user: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: displayName,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
            provider: 'supabase',
          };
          await saveLocalCredential(cleanEmail, cleanPass, user);
          await saveCloudCredential(cleanEmail, passHash, user);
          Auth.setCurrentUser(user);
          return { success: true, user, message: 'Account created successfully in Supabase Cloud!' };
        }
      } catch (err) {
        console.warn('Supabase sign up error:', err);
      }
    }

    // 2. Multi-device registered account creation
    const user: AuthUser = {
      id: `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: cleanEmail,
      name: displayName,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'local',
    };
    await saveLocalCredential(cleanEmail, cleanPass, user);
    await saveCloudCredential(cleanEmail, passHash, user);
    Auth.setCurrentUser(user);
    return { success: true, user, message: 'Account created successfully!' };
  },

  /**
   * Sign Out current device only (does not disconnect other active devices)
   */
  signOut: async () => {
    Auth.setCurrentUser(null);
  },
};
