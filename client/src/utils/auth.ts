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

// Default primary dashboard account (Gulshan Kumar Nayak) for instant cross-platform sign-in
export const DEFAULT_GKN_USER: AuthUser = {
  id: '036fe7d3-6a13-4740-b028-afb55e81e00e',
  name: 'Gulshan Kumar Nayak',
  email: 'gknayak@gmail.com',
  provider: 'supabase',
  avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1790759646967.webp',
  createdAt: 1788945035065,
  lastLoginAt: 1791114446905,
};

const DEFAULT_GKN_PASS_HASH = '{"version":2,"algorithm":"PBKDF2-SHA256","iterations":210000,"salt":"hKX8naGtDOLD1akaKoa3JA==","hash":"S0LQqpogACGu4p46pxHDB/F8KyBX/HD4FySuUnk/6KY="}';

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
  let map: Record<string, { user: AuthUser; pass: string }> = {};
  try {
    const raw = localStorage.getItem(USER_CREDENTIALS_KEY);
    if (raw) map = JSON.parse(raw);
  } catch {
    // ignore
  }
  // Ensure default primary account is always present for immediate offline/APK sign in
  if (!map['gknayak@gmail.com']) {
    map['gknayak@gmail.com'] = {
      user: DEFAULT_GKN_USER,
      pass: DEFAULT_GKN_PASS_HASH,
    };
  }
  return map;
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

const syncCloudAccountRecord = async (
  client: any,
  email: string,
  pass: string,
  user: AuthUser,
) => {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const cloudAccountKey = `account_auth_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const passHash = await hashPassword(pass);

    const { data: existingCloud } = await client
      .from('user_workspaces')
      .select('id')
      .eq('user_identifier', cloudAccountKey)
      .maybeSingle();

    const accountPayload = {
      user_identifier: cloudAccountKey,
      user_email: cleanEmail,
      workspace_data: {
        account: {
          user,
          passHash,
          updatedAt: Date.now(),
        },
      },
      updated_at: new Date().toISOString(),
    };

    if (existingCloud) {
      await client
        .from('user_workspaces')
        .update(accountPayload)
        .eq('user_identifier', cloudAccountKey);
    } else {
      await client
        .from('user_workspaces')
        .insert(accountPayload);
    }
  } catch (e) {
    console.warn('Failed to sync cloud account record:', e);
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
    let list: AuthUser[] = [];
    try {
      const stored = localStorage.getItem(SAVED_USERS_KEY);
      if (stored) {
        list = JSON.parse(stored);
        list = list.map((a) => {
          if (a.id.includes('mock')) {
            return { ...a, id: `usr_${a.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}` };
          }
          return a;
        });
      }
    } catch {
      // ignore
    }
    if (!list.some((a) => a.email.toLowerCase() === 'gknayak@gmail.com')) {
      list.unshift(DEFAULT_GKN_USER);
    }
    return list;
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

    // 0. Primary Account Fast Path & Offline Guarantee:
    // Ensures Gulshan Kumar Nayak (gknayak@gmail.com) can always sign in smoothly
    // on a fresh Android APK install or offline environment without getting blocked.
    if (
      cleanEmail === 'gknayak@gmail.com' &&
      (cleanPass === 'Gulshan@12345!' || pass === 'Gulshan@12345!')
    ) {
      const gknUser: AuthUser = {
        ...DEFAULT_GKN_USER,
        lastLoginAt: Date.now(),
      };
      await saveLocalCredential(cleanEmail, cleanPass, gknUser);
      Auth.setCurrentUser(gknUser);
      recordLoginSuccess(cleanEmail);
      return { success: true, user: gknUser, message: 'Signed in successfully!' };
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
          await saveLocalCredential(cleanEmail, cleanPass, user);
          Auth.setCurrentUser(user);
          recordLoginSuccess(cleanEmail);
          return { success: true, user, message: 'Signed in via Supabase Cloud' };
        }
        // If Supabase rejects the credentials (e.g. unconfirmed email, project settings),
        // fall through to check the cloud database account store and local-device account store.
      } catch (err: any) {
        console.warn('Supabase Auth attempt:', err);
      }
    }

    // 2. Cloud-database Account check (verifies accounts persisted in user_workspaces table across web & android APK)
    if (client && isSupabaseConfigured()) {
      try {
        const cloudAccountKey = `account_auth_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
        const { data: cloudRow, error: cloudErr } = await client
          .from('user_workspaces')
          .select('workspace_data')
          .eq('user_identifier', cloudAccountKey)
          .maybeSingle();

        if (!cloudErr && cloudRow?.workspace_data?.account) {
          const cloudAccount = cloudRow.workspace_data.account;
          const passHash = cloudAccount.passHash;
          if (passHash) {
            const valid = await verifyPasswordHash(passHash, cleanPass);
            if (valid) {
              const cloudUser: AuthUser = {
                id: cloudAccount.user?.id || `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
                email: cloudAccount.user?.email || cleanEmail,
                name: cloudAccount.user?.name || cleanEmail.split('@')[0],
                avatarUrl: cloudAccount.user?.avatarUrl,
                createdAt: cloudAccount.user?.createdAt || Date.now(),
                lastLoginAt: Date.now(),
                provider: 'supabase',
              };

              // Cache credentials locally so subsequent offline/instant logins succeed
              await saveLocalCredential(cleanEmail, cleanPass, cloudUser);

              // Upgrade hash to Version 2 PBKDF2 in the cloud if it was Version 1
              try {
                const parsed = typeof passHash === 'string' ? JSON.parse(passHash) : passHash;
                if (parsed?.version !== 2) {
                  const upgradedHash = await hashPassword(cleanPass);
                  await client
                    .from('user_workspaces')
                    .update({
                      workspace_data: {
                        ...cloudRow.workspace_data,
                        account: {
                          ...cloudAccount,
                          user: cloudUser,
                          passHash: upgradedHash,
                          updatedAt: Date.now(),
                        },
                      },
                      updated_at: new Date().toISOString(),
                    })
                    .eq('user_identifier', cloudAccountKey);
                }
              } catch (upgradeErr) {
                // Non-fatal
              }

              Auth.setCurrentUser(cloudUser);
              recordLoginSuccess(cleanEmail);
              return { success: true, user: cloudUser, message: 'Signed in successfully via Cloud Account' };
            } else {
              recordLoginFailure(cleanEmail);
              return { success: false, message: 'Invalid email or password.' };
            }
          }
        }
      } catch (cloudLookupErr) {
        console.warn('Cloud account lookup notice:', cloudLookupErr);
      }
    }

    // 3. Local-device account fallback (covers accounts never registered in Supabase Auth or offline)
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

    // 4. Account not registered anywhere
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
          await saveLocalCredential(cleanEmail, cleanPass, user);
          await syncCloudAccountRecord(client, cleanEmail, cleanPass, user);
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
    if (client && isSupabaseConfigured()) {
      await syncCloudAccountRecord(client, cleanEmail, cleanPass, user);
    }
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
    let isCurrentValid = false;

    // 1. If Supabase GoTrue Auth is configured, try verifying there first
    if (client && isSupabaseConfigured() && user.provider === 'supabase') {
      try {
        const { error: verifyError } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanCurrent,
        });
        if (!verifyError) {
          isCurrentValid = true;
          try {
            await client.auth.updateUser({ password: cleanNew });
          } catch {
            // ignore
          }
        }
      } catch {
        // Fall through to cloud database check
      }
    }

    // 2. Cloud database check (for accounts verified via user_workspaces account_auth)
    if (!isCurrentValid && client && isSupabaseConfigured()) {
      try {
        const cloudAccountKey = `account_auth_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
        const { data: cloudRow } = await client
          .from('user_workspaces')
          .select('workspace_data')
          .eq('user_identifier', cloudAccountKey)
          .maybeSingle();

        if (cloudRow?.workspace_data?.account?.passHash) {
          isCurrentValid = await verifyPasswordHash(cloudRow.workspace_data.account.passHash, cleanCurrent);
        }
      } catch {
        // Fall through to local check
      }
    }

    // 3. Offline/local credential check
    if (!isCurrentValid) {
      const credentialsMap = getLocalCredentialsMap();
      const storedRecord = credentialsMap[cleanEmail];
      if (storedRecord?.pass) {
        isCurrentValid = await verifyPasswordHash(storedRecord.pass, cleanCurrent);
      }
    }

    if (!isCurrentValid) {
      return { success: false, message: 'Current password is incorrect. Please check and try again.' };
    }

    // Save updated password locally and in cloud database
    await saveLocalCredential(cleanEmail, cleanNew, user);
    if (client && isSupabaseConfigured()) {
      await syncCloudAccountRecord(client, cleanEmail, cleanNew, user);
    }
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
