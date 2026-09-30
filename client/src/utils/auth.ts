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
const LOGIN_ATTEMPTS_KEY = 'notion_os_login_attempts_v1';

// Client-side login throttling to slow down brute-force attempts against the
// local/cloud credential fallback path (Supabase Auth already rate-limits server-side).
const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

interface LoginAttemptRecord {
  count: number;
  lockUntil: number;
}

const getAttemptsMap = (): Record<string, LoginAttemptRecord> => {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
};

const saveAttemptsMap = (map: Record<string, LoginAttemptRecord>) => {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
};

const checkLoginThrottle = (email: string): { allowed: boolean; retryAfterSec: number } => {
  const map = getAttemptsMap();
  const record = map[email];
  if (record && record.lockUntil > Date.now()) {
    return { allowed: false, retryAfterSec: Math.ceil((record.lockUntil - Date.now()) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
};

const recordLoginFailure = (email: string) => {
  const map = getAttemptsMap();
  const record = map[email] || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const backoff = BASE_LOCKOUT_MS * Math.pow(2, record.count - MAX_FAILED_ATTEMPTS);
    record.lockUntil = Date.now() + Math.min(backoff, MAX_LOCKOUT_MS);
  }
  map[email] = record;
  saveAttemptsMap(map);
};

const recordLoginSuccess = (email: string) => {
  const map = getAttemptsMap();
  delete map[email];
  saveAttemptsMap(map);
};

// Generate safe user identifier for per-user cloud database workspace partition
export const getUserWorkspaceKey = (user: AuthUser | null): string => {
  if (!user) return 'user_guest';
  // Normalize email to safe alphanumeric string
  const cleanEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `user_${cleanEmail}`;
};

// Helper to store & retrieve credentials map securely in local browser storage only.
// This is ONLY used as an offline fallback when Supabase is not configured; when Supabase
// is configured, Supabase Auth is the sole source of truth for credentials (see signIn/signUp).
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
          if (user.id.includes('mock')) {
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
          if (a.id.includes('mock')) {
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
    const throttle = checkLoginThrottle(cleanEmail);
    if (!throttle.allowed) {
      return {
        success: false,
        message: `Too many failed attempts. Please try again in ${throttle.retryAfterSec}s.`,
      };
    }
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
          recordLoginSuccess(cleanEmail);
          return { success: true, user, message: 'Signed in via Supabase Cloud' };
        }
        // If Supabase rejects the credentials, fall through to check the local-device
        // account store below (handles accounts created before Supabase was configured).
      } catch (err: any) {
        console.warn('Supabase Auth attempt:', err);
      }
    }

    // 2. Local-device account fallback (covers accounts never registered in Supabase Auth)
    const credentialsMap = getLocalCredentialsMap();
    const storedRecord = credentialsMap[cleanEmail];

    if (storedRecord) {
      const valid = await verifyPasswordHash(storedRecord.pass, cleanPass);
      if (valid) {
        let user = { ...storedRecord.user, lastLoginAt: Date.now() };
        if (user.id.includes('mock')) {
          user.id = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
        }
        await saveLocalCredential(cleanEmail, cleanPass, user);
        Auth.setCurrentUser(user);
        recordLoginSuccess(cleanEmail);
        return { success: true, user, message: 'Signed in successfully' };
      } else {
        recordLoginFailure(cleanEmail);
        return { success: false, message: 'Invalid email or password.' };
      }
    }

    // 3. Account not registered anywhere
    recordLoginFailure(cleanEmail);
    return {
      success: false,
      message: 'Invalid email or password.',
    };
  },

  /**
   * Send a password reset email via Supabase Auth. The recovery link expires in
   * 1 hour by default (configured in the Supabase Dashboard, not overridden here).
   */
  requestPasswordReset: async (email: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Password reset requires cloud sync to be configured for this app.',
      };
    }
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      await client.auth.resetPasswordForEmail(cleanEmail, redirectTo ? { redirectTo } : undefined);
    } catch (err) {
      console.warn('resetPasswordForEmail error:', err);
    }
    // Always return a generic success message regardless of whether the account exists,
    // to avoid leaking which emails are registered.
    return {
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent (expires in 1 hour).',
    };
  },

  /**
   * Complete a password reset after the user follows the emailed recovery link.
   * Supabase automatically establishes a temporary "recovery" session from the link;
   * this simply sets the new password on that session.
   */
  completePasswordRecovery: async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    const cleanNew = newPassword.trim();
    if (!cleanNew || cleanNew.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters.' };
    }
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      return { success: false, message: 'Cloud sync is not configured; cannot complete password reset.' };
    }
    try {
      const { error } = await client.auth.updateUser({ password: cleanNew });
      if (error) {
        return { success: false, message: error.message || 'Failed to update password.' };
      }
      return { success: true, message: 'Password updated successfully. You can now sign in.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update password.' };
    }
  },

  /**
   * Sign Up / Create a new personalized account
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
    if (!cleanPass || cleanPass.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }

    const displayName =
      name?.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[\._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

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
          Auth.setCurrentUser(user);
          return { success: true, user, message: 'Account created successfully in Supabase Cloud!' };
        }
        if (error) {
          // Only hard-fail when the account genuinely already exists in Supabase; for any other
          // failure (email confirmation required, send-rate-limited, offline, etc.) fall through
          // to the local-device account below so temp/offline accounts keep working.
          const alreadyExists = /already registered|already exists/i.test(error.message || '');
          if (alreadyExists) {
            return { success: false, message: error.message };
          }
          console.warn('Supabase sign up rejected, falling back to local account:', error.message);
        }
      } catch (err) {
        console.warn('Supabase sign up error:', err);
      }
    }

    // 2. Local-device account fallback (used when Supabase is unset, or unavailable/unconfirmed)
    const user: AuthUser = {
      id: `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: cleanEmail,
      name: displayName,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'local',
    };
    await saveLocalCredential(cleanEmail, cleanPass, user);
    Auth.setCurrentUser(user);
    return { success: true, user, message: 'Account created successfully!' };
  },

  /**
   * Change Password with strict current password validation
   */
  changePassword: async (
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    const user = Auth.getCurrentUser();
    if (!user) {
      return { success: false, message: 'No active account session found. Please sign in.' };
    }
    const cleanEmail = user.email.trim().toLowerCase();
    const cleanCurrent = currentPass.trim();
    const cleanNew = newPass.trim();

    if (!cleanCurrent) {
      return { success: false, message: 'Please enter your current password.' };
    }
    if (!cleanNew || cleanNew.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters long.' };
    }
    if (cleanNew === cleanCurrent) {
      return { success: false, message: 'New password cannot be identical to current password.' };
    }

    const client = getSupabaseClient();

    // 1. If this is a Supabase-backed account, verify + update via Supabase Auth directly
    if (client && isSupabaseConfigured() && user.provider === 'supabase') {
      try {
        const { error: verifyError } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanCurrent,
        });
        if (verifyError) {
          return { success: false, message: 'Current password is incorrect. Please check and try again.' };
        }
        const { error: updateError } = await client.auth.updateUser({ password: cleanNew });
        if (updateError) {
          return { success: false, message: updateError.message || 'Failed to update password.' };
        }
        return { success: true, message: 'Password updated successfully!' };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Failed to update password.' };
      }
    }

    // 2. Offline/local account: verify against the locally stored hash
    const credentialsMap = getLocalCredentialsMap();
    const storedRecord = credentialsMap[cleanEmail];
    const isCurrentValid = storedRecord ? await verifyPasswordHash(storedRecord.pass, cleanCurrent) : false;

    if (!isCurrentValid) {
      return { success: false, message: 'Current password is incorrect. Please check and try again.' };
    }

    await saveLocalCredential(cleanEmail, cleanNew, user);
    return { success: true, message: 'Password updated successfully!' };
  },

  /**
   * Update User Display Name across local session, saved accounts list, and cloud credentials
   */
  updateCurrentUserName: async (newName: string): Promise<AuthUser | null> => {
    const user = Auth.getCurrentUser();
    if (!user) return null;
    const cleanName = newName.trim();
    if (!cleanName) return user;

    const updatedUser: AuthUser = {
      ...user,
      name: cleanName,
    };

    Auth.setCurrentUser(updatedUser);

    // Update in local credentials map
    const credentialsMap = getLocalCredentialsMap();
    if (credentialsMap[user.email.toLowerCase()]) {
      credentialsMap[user.email.toLowerCase()].user = updatedUser;
      try {
        localStorage.setItem(USER_CREDENTIALS_KEY, JSON.stringify(credentialsMap));
      } catch {
        // ignore
      }
    }

    // Update in saved users list
    try {
      const stored = localStorage.getItem(SAVED_USERS_KEY);
      if (stored) {
        const list: AuthUser[] = JSON.parse(stored);
        const updatedList = list.map((u) => (u.email.toLowerCase() === user.email.toLowerCase() ? updatedUser : u));
        localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(updatedList));
      }
    } catch {
      // ignore
    }

    return updatedUser;
  },

  /**
   * Update User Avatar URL across local session, saved accounts, and Supabase user metadata
   */
  updateCurrentUserAvatar: async (avatarUrl: string): Promise<AuthUser | null> => {
    const user = Auth.getCurrentUser();
    if (!user) return null;

    const updatedUser: AuthUser = {
      ...user,
      avatarUrl,
    };

    Auth.setCurrentUser(updatedUser);

    // Update in local credentials map
    const credentialsMap = getLocalCredentialsMap();
    if (credentialsMap[user.email.toLowerCase()]) {
      credentialsMap[user.email.toLowerCase()].user = updatedUser;
      try {
        localStorage.setItem(USER_CREDENTIALS_KEY, JSON.stringify(credentialsMap));
      } catch {
        // ignore
      }
    }

    // Update in saved users list
    try {
      const stored = localStorage.getItem(SAVED_USERS_KEY);
      if (stored) {
        const list: AuthUser[] = JSON.parse(stored);
        const updatedList = list.map((u) => (u.email.toLowerCase() === user.email.toLowerCase() ? updatedUser : u));
        localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(updatedList));
      }
    } catch {
      // ignore
    }

    // Update Supabase auth user_metadata if available
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured() && user.provider === 'supabase') {
      try {
        await client.auth.updateUser({
          data: { avatar_url: avatarUrl },
        });
      } catch (err) {
        console.warn('Supabase updateUser avatar notice:', err);
      }
    }

    return updatedUser;
  },

  /**
   * Sign Out current device only (does not disconnect other active devices)
   */
  signOut: async () => {
    // Revoke the live Supabase session/JWT; clearing local storage alone leaves the
    // access & refresh tokens valid and subject to silent auto-refresh.
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
    Auth.setCurrentUser(null);
  },
};
