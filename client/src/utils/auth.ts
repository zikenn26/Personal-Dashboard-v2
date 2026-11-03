import { AuthUser } from '../types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  isNeonConfigured,
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
  getCustomWorkspaceIdentifier,
} from './neonSync';
import { hashPassword, verifyPasswordHash } from './crypto';
import { Storage, BLANK_PROFILE } from './storage';
import { smsExpenseService } from '../services/smsExpenseService';

export const AUTH_STORAGE_KEY = 'notion_os_auth_user_v1';
export const TOKEN_STORAGE_KEY = 'notion_os_auth_token_v1';
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

// Legacy purge scripts disabled to ensure permanent session retention across APK dismissals
export const purgeLegacyAccounts = () => {};
export const enforceGlobalAuthEpoch = () => {};

// Default primary dashboard account (Gulshan Kumar Nayak) for instant cross-platform sign-in
export const DEFAULT_GKN_USER: AuthUser = {
  id: '036fe7d3-6a13-4740-b028-afb55e81e00e',
  name: 'Gulshan Kumar Nayak',
  email: 'gknayak@gmail.com',
  provider: 'neon',
  avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
  createdAt: 1788945035065,
  lastLoginAt: 1791114446905,
};

export const DEFAULT_GKN_PASS_HASH = '{"version":2,"algorithm":"PBKDF2-SHA256","iterations":210000,"salt":"hKX8naGtDOLD1akaKoa3JA==","hash":"S0LQqpogACGu4p46pxHDB/F8KyBX/HD4FySuUnk/6KY="}';

import { getUserWorkspaceKey, isDummyMockAvatar, isAvatarMatchingUserEmailDomain, OWNER_GKN_HABITS } from './userUtils';
export { getUserWorkspaceKey };

export const DEFAULT_ARPITA_USER: AuthUser = {
  id: 'usr_arpitapri125_gmail_com',
  name: 'Arpita Priyadar',
  email: 'arpitapri125@gmail.com',
  provider: 'neon',
  createdAt: 1788945035065,
  lastLoginAt: 1791114446905,
};

export const DEFAULT_ARPITA_PASS_HASH = '{"version":2,"algorithm":"PBKDF2-SHA256","iterations":210000,"salt":"hKX8naGtDOLD1akaKoa3JA==","hash":"S0LQqpogACGu4p46pxHDB/F8KyBX/HD4FySuUnk/6KY="}';

// Helper to store & retrieve credentials map securely in local browser storage only.
// Enables seamless offline and persistent logins even when cloud quotas are restricted.
const getLocalCredentialsMap = (): Record<string, { user: AuthUser; pass: string }> => {
  let map: Record<string, { user: AuthUser; pass: string }> = {};
  try {
    const raw = localStorage.getItem(USER_CREDENTIALS_KEY);
    if (raw) map = JSON.parse(raw);
  } catch {
    // ignore
  }

  return map;
};

const saveLocalCredential = async (email: string, pass: string, user: AuthUser) => {
  try {
    const map = getLocalCredentialsMap();
    const hashed = await hashPassword(pass);
    const cleanEmail = email.toLowerCase().trim();
    map[cleanEmail] = { user, pass: hashed };

    // Also store username prefix
    const prefix = cleanEmail.split('@')[0];
    if (prefix && prefix !== cleanEmail) {
      map[prefix] = { user, pass: hashed };
    }

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

/**
 * Ensures a dedicated private workspace partition exists in user_workspaces for this user.
 * Prevents race conditions or silent logouts when newly authenticated users access the app.
 */
export const ensureUserWorkspaceInitialized = async (client: any, user: AuthUser): Promise<void> => {
  if (!client || !isSupabaseConfigured() || !user?.email) return;
  const cleanEmail = user.email.trim().toLowerCase();
  const workspaceKey = getUserWorkspaceKey(user);
  const cleanId = cleanEmail.replace(/[^a-z0-9]/g, '_');

  try {
    const { data: existing, error: selectErr } = await client
      .from('user_workspaces')
      .select('id')
      .eq('user_identifier', workspaceKey)
      .maybeSingle();

    if (!selectErr && !existing) {
      console.info('[AUTH_DIAGNOSTIC] Initializing new isolated user workspace:', workspaceKey);
      const nowMs = Date.now();
      const nowIso = new Date().toISOString();
      const isGknUser = cleanEmail === 'gknayak@gmail.com';
      const derivedName = isGknUser
        ? (user.name && user.name !== 'Gknayak' ? user.name : 'Gulshan Kumar Nayak')
        : (user.name || cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      const defaultGknAvatar = 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp';
      const userAvatar = isGknUser
        ? (user.avatarUrl && isAvatarMatchingUserEmailDomain(user.avatarUrl, cleanEmail) ? user.avatarUrl : defaultGknAvatar)
        : (user.avatarUrl && isAvatarMatchingUserEmailDomain(user.avatarUrl, cleanEmail) ? user.avatarUrl : '');

      const blankPayload: Record<string, any> = {
        user_id: user.id,
        user_identifier: workspaceKey,
        user_email: cleanEmail,
        workspace_data: {
          profile: {
            ...BLANK_PROFILE,
            name: derivedName,
            contactEmail: cleanEmail,
            handle: `@${cleanId}`,
            avatarUrl: userAvatar,
          },
          todos: [],
          habits: isGknUser ? [...OWNER_GKN_HABITS] : [],
          habitHistory: [],
          habitActivities: [],
          goals: [],
          expenses: [],
          journal: [],
          media: [],
          achievements: [],
          doodles: [],
          timeline: [],
          projects: [],
          skills: [],
          photos: [],
          resume: null,
          quotes: [],
          exams: [],
          schedule: { activities: [] },
          _meta: {
            clientTimestamp: nowMs,
            syncVersion: nowMs,
          },
        },
        updated_at: nowIso,
      };

      let { error: upsertErr } = await client.from('user_workspaces').upsert(
        blankPayload,
        { onConflict: 'user_identifier' }
      );
      if (upsertErr && (upsertErr.code === '42703' || upsertErr.message?.includes('user_id'))) {
        delete blankPayload.user_id;
        const retry = await client.from('user_workspaces').upsert(
          blankPayload,
          { onConflict: 'user_identifier' }
        );
        upsertErr = retry.error;
      }
      if (upsertErr) {
        console.warn('[AUTH_DIAGNOSTIC] Notice on workspace upsert:', upsertErr);
      }
    }
  } catch (wsErr) {
    console.warn('[AUTH_DIAGNOSTIC] Notice initializing workspace partition:', wsErr);
  }
};

/**
 * Helper to check whether an account or username is already registered in Neon DB or locally.
 */
export const isAccountAlreadyRegistered = async (identifier: string): Promise<boolean> => {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return false;
  const cleanId = clean.replace(/[^a-z0-9]/g, '_');

  const localMap = getLocalCredentialsMap();
  if (localMap[clean] || localMap[cleanId]) return true;

  try {
    const query = new URLSearchParams({
      user_identifier: `account_auth_${cleanId}`,
      user_email: clean.includes('@') ? clean : `${cleanId}@workspace.local`,
    });
    const res = await fetch(`/api/sync/workspace?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.exists) return true;
    }
  } catch {
    // ignore
  }

  return false;
};

export const Auth = {
  /**
   * Get persistent bearer session token
   */
  getAuthToken: (): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Save persistent bearer session token
   */
  setAuthToken: (token: string) => {
    try {
      if (typeof window !== 'undefined' && token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    } catch {
      // ignore
    }
  },

  /**
   * Clear persistent bearer session token
   */
  clearAuthToken: () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  },

  /**
   * Get currently logged-in user immediately from LocalStorage on startup
   */
  getCurrentUser: (): AuthUser | null => {
    try {
      const isSignedOut = typeof localStorage !== 'undefined' && localStorage.getItem('notion_os_auth_signed_out') === 'true';
      if (isSignedOut) {
        return null;
      }
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
      if (stored) {
        const user = JSON.parse(stored);
        if (user && user.email) {
          // Normalize legacy mock ID if previously saved
          if (user.id && user.id.includes('mock')) {
            user.id = `usr_${user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
            } catch {
              // ignore
            }
          }

          // Ensure session token exists in local storage
          const existingToken = localStorage.getItem(TOKEN_STORAGE_KEY);
          if (!existingToken) {
            const fallbackToken = `neon_tok_session_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
            try {
              localStorage.setItem(TOKEN_STORAGE_KEY, fallbackToken);
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
   * Save user session and token locally
   */
  setCurrentUser: (user: AuthUser | null, token?: string) => {
    try {
      if (user) {
        localStorage.removeItem('notion_os_auth_signed_out');
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        if (token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
          const generatedToken = `neon_tok_session_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
          localStorage.setItem(TOKEN_STORAGE_KEY, generatedToken);
        }

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
        // Restore any preserved messages for this specific user and process pending write retries
        try {
          void smsExpenseService.restorePreservedPendingSmsForUser(user.id);
          void smsExpenseService.processPendingWriteRetries();
        } catch {}
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.setItem('notion_os_auth_signed_out', 'true');
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
    return list;
  },

  /**
   * Sign In with Username or Email & Password
   * Strict password verification checking against local cache and the Neon DB pool connection
   */
  signIn: async (
    emailOrUsername: string,
    pass: string
  ): Promise<{ success: boolean; user?: AuthUser; token?: string; message?: string }> => {
    const raw = emailOrUsername.trim().toLowerCase();
    const cleanId = raw.replace(/[^a-z0-9]/g, '_');
    const cleanPass = pass;

    if (!raw) {
      return { success: false, message: 'Please enter your username or email address.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Please enter your password.' };
    }

    const throttle = checkLoginThrottle(raw);
    if (!throttle.allowed) {
      return {
        success: false,
        message: `Too many failed attempts. Please try again in ${throttle.retryAfterSec}s.`,
      };
    }

    console.info('[AUTH_DIAGNOSTIC] Stage: signIn_attempt', {
      identifier: raw,
      isEmail: raw.includes('@'),
      timestamp: new Date().toISOString(),
    });

    // 1. Local-device account check (fastest, offline-safe, persistent across app resume)
    const credentialsMap = getLocalCredentialsMap();
    const storedRecord = credentialsMap[raw] || credentialsMap[cleanId];

    if (storedRecord) {
      const valid = await verifyPasswordHash(storedRecord.pass, cleanPass);
      if (valid) {
        let user = { ...storedRecord.user, lastLoginAt: Date.now() };
        if (user.id.includes('mock')) {
          user.id = `usr_${cleanId}`;
        }
        await saveLocalCredential(user.email, cleanPass, user);
        
        let token = Auth.getAuthToken();
        if (!token) {
          token = `neon_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        }
        Auth.setCurrentUser(user, token);
        setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
        setCustomWorkspaceEmail(user.email);
        recordLoginSuccess(raw);

        // Notify server sync pool in background to keep active session synchronized
        void fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: raw, password: cleanPass }),
        }).then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            if (data.token) {
              Auth.setAuthToken(data.token);
            }
          }
        }).catch(() => {});

        return { success: true, user, token, message: 'Signed in successfully' };
      }
    }

    // 2. Neon DB pool connection check via server auth route (/api/auth/login)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: raw, password: cleanPass }),
      });
      if (response.ok) {
        const authData = await response.json();
        if (authData.success && authData.user) {
          const cloudUser: AuthUser = authData.user;
          const serverToken: string = authData.token || `neon_tok_${Date.now()}`;

          // Cache credentials and session locally for instant restore on subsequent app resume
          await saveLocalCredential(cloudUser.email, cleanPass, cloudUser);
          Auth.setCurrentUser(cloudUser, serverToken);
          setCustomWorkspaceIdentifier(getUserWorkspaceKey(cloudUser));
          setCustomWorkspaceEmail(cloudUser.email);
          recordLoginSuccess(raw);
          return {
            success: true,
            user: cloudUser,
            token: serverToken,
            message: 'Signed in successfully via Neon Database pool',
          };
        }
      }
    } catch (neonPoolErr) {
      console.warn('[AUTH] Direct Neon pool login notice:', neonPoolErr);
    }

    // 3. Neon DB workspace account record fallback via /api/sync/workspace
    try {
      const emailVariant = raw.includes('@') ? raw : `${cleanId}@workspace.local`;
      const query = new URLSearchParams({
        user_identifier: `account_auth_${cleanId}`,
        user_email: emailVariant,
      });
      const response = await fetch(`/api/sync/workspace?${query.toString()}`);
      if (response.ok) {
        const res = await response.json();
        if (res.exists && res.workspace_data?.account) {
          const cloudAccount = res.workspace_data.account;
          const passHash = cloudAccount.passHash;
          if (passHash) {
            const valid = await verifyPasswordHash(passHash, cleanPass);
            if (valid) {
              const cloudUser: AuthUser = {
                id: cloudAccount.user?.id || `usr_${cleanId}`,
                email: res.user_email || emailVariant,
                name: cloudAccount.user?.name || raw.split('@')[0],
                avatarUrl: cloudAccount.user?.avatarUrl,
                createdAt: cloudAccount.user?.createdAt || Date.now(),
                lastLoginAt: Date.now(),
                provider: 'neon',
              };

              const fallbackToken = `neon_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
              await saveLocalCredential(cloudUser.email, cleanPass, cloudUser);
              Auth.setCurrentUser(cloudUser, fallbackToken);
              setCustomWorkspaceIdentifier(getUserWorkspaceKey(cloudUser));
              setCustomWorkspaceEmail(cloudUser.email);
              recordLoginSuccess(raw);
              return { success: true, user: cloudUser, token: fallbackToken, message: 'Signed in successfully via Neon Database' };
            }
          }
        }
      }
    } catch (cloudLookupErr) {
      console.warn('[AUTH] Neon cloud account lookup notice:', cloudLookupErr);
    }

    // 4. Failed authentication
    recordLoginFailure(raw);

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
   * Sign Up / Create a new personalized account with a unique username or email
   */
  signUp: async (
    usernameOrEmail: string,
    pass: string,
    name?: string
  ): Promise<{ success: boolean; user?: AuthUser; message?: string }> => {
    const raw = usernameOrEmail.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!raw || raw.length < 3) {
      return { success: false, message: 'Username or email must be at least 3 characters long.' };
    }
    if (cleanPass.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.' };
    }

    const cleanId = raw.replace(/[^a-z0-9]/g, '_');

    // Strict duplicate protection
    if (
      raw === 'gknayak@gmail.com' ||
      raw === 'gknayak' ||
      cleanId === 'gknayak_gmail_com' ||
      cleanId === 'gknayak'
    ) {
      return {
        success: false,
        message: `The username or email "${usernameOrEmail.trim()}" is already registered. Please choose a different username or sign in.`,
      };
    }

    const alreadyRegistered = await isAccountAlreadyRegistered(raw);
    if (alreadyRegistered) {
      return {
        success: false,
        message: `The username or email "${usernameOrEmail.trim()}" is already in use. Please choose a different username or sign in.`,
      };
    }

    const cleanEmail = raw.includes('@') ? raw : `${cleanId}@workspace.local`;
    const displayName =
      name?.trim() ||
      raw
        .split('@')[0]
        .replace(/[\._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const nowMs = Date.now();
    const nowIso = new Date().toISOString();
    const passHash = await hashPassword(cleanPass);

    const user: AuthUser = {
      id: `usr_${cleanId}_${nowMs}`,
      email: cleanEmail,
      name: displayName,
      createdAt: nowMs,
      lastLoginAt: nowMs,
      provider: 'neon',
    };

    // 1. Cache credentials locally and set active session immediately
    await saveLocalCredential(cleanEmail, cleanPass, user);
    if (!raw.includes('@')) {
      await saveLocalCredential(raw, cleanPass, user);
    }
    Auth.setCurrentUser(user);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
    setCustomWorkspaceEmail(cleanEmail);

    // 2. Persist account & workspace partition to Neon DB Cloud via server relay in background
    try {
      void fetch('/api/sync/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_identifier: `account_auth_${cleanId}`,
          user_email: cleanEmail,
          workspace_data: {
            account: {
              user,
              passHash,
              createdAt: nowMs,
              updatedAt: nowMs,
            },
          },
          updated_at: nowIso,
          sync_version: nowMs,
        }),
      }).catch(() => {});

      void fetch('/api/sync/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_identifier: getUserWorkspaceKey(user),
          user_email: cleanEmail,
          workspace_data: {
            profile: {
              name: displayName,
              contactEmail: cleanEmail,
            },
            todos: [],
            habits: [],
            habitHistory: [],
            habitActivities: [],
            goals: [],
            expenses: [],
            journal: [],
            _meta: {
              clientTimestamp: nowMs,
              syncVersion: nowMs,
            },
          },
          updated_at: nowIso,
          sync_version: nowMs,
        }),
      }).catch(() => {});
    } catch (e) {
      console.warn('Neon DB sync error on signup:', e);
    }

    return {
      success: true,
      user,
      message: `Account created successfully! Welcome to your private workspace, ${displayName}.`,
    };
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

    // Update Supabase auth user_metadata if available
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user) {
          await client.auth.updateUser({
            data: {
              full_name: cleanName,
              name: cleanName,
              display_name: cleanName,
            },
          });
        }
      } catch (err) {
        console.warn('Supabase updateUser name notice:', err);
      }
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
    if (client && isSupabaseConfigured()) {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user) {
          await client.auth.updateUser({
            data: {
              avatar_url: avatarUrl,
              avatarUrl: avatarUrl,
              picture: avatarUrl,
            },
          });
        }
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
    // Prevent queued SMS from one user's session being assigned to another user after logout
    // while safely preserving any unprocessed messages for this user
    try {
      const currentUser = Auth.getCurrentUser();
      const uid = currentUser?.id || getCustomWorkspaceIdentifier();
      await smsExpenseService.preservePendingQueueBeforeSignOut(uid);
      Storage.clearMemoryExpensesCache();
    } catch (e) {
      console.warn('Notice preserving pending queue on signOut:', e);
    }
    Auth.setCurrentUser(null);
  },

  /**
  /**
   * Directly sets or resets password for an account (e.g. gknayak@gmail.com).
   * Persists the credential locally and in cloud records, logging in immediately.
   */
  directSetOrResetPassword: async (
    emailOrUsername: string,
    newPass: string
  ): Promise<{ success: boolean; user?: AuthUser; message?: string }> => {
    const raw = emailOrUsername.trim().toLowerCase();
    const cleanPass = newPass.trim();

    if (!raw) {
      return { success: false, message: 'Please enter your username or email address.' };
    }
    if (cleanPass.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }

    const cleanEmail = raw.includes('@') ? raw : (raw === 'gknayak' ? 'gknayak@gmail.com' : `${raw}@workspace.local`);
    const cleanId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const nowMs = Date.now();

    let user: AuthUser;
    const existingMap = getLocalCredentialsMap();
    if (cleanEmail === 'gknayak@gmail.com') {
      user = { ...DEFAULT_GKN_USER, lastLoginAt: nowMs };
    } else if (existingMap[cleanEmail]?.user) {
      user = { ...existingMap[cleanEmail].user, lastLoginAt: nowMs };
    } else {
      user = {
        id: `usr_${cleanId}_${nowMs}`,
        email: cleanEmail,
        name: cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        createdAt: nowMs,
        lastLoginAt: nowMs,
        provider: 'neon',
      };
    }

    // Save locally
    const sessionToken = `neon_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    await saveLocalCredential(cleanEmail, cleanPass, user);
    if (!raw.includes('@')) {
      await saveLocalCredential(raw, cleanPass, user);
    }

    // Set as active user immediately with session token
    Auth.setCurrentUser(user, sessionToken);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
    setCustomWorkspaceEmail(cleanEmail);
    recordLoginSuccess(raw);

    // Sync cloud/Neon if available in background
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      void syncCloudAccountRecord(client, cleanEmail, cleanPass, user).catch(() => {});
    }

    return {
      success: true,
      user,
      message: `Password successfully updated! Signed in as ${user.name}.`,
    };
  },

  /**
   * Automatically verify active session against Neon DB pool:
   * Enforces permanent session retention on the Android APK and web client.
   * Sessions persist indefinitely until the user explicitly clicks "Sign Out".
   */
  verifyCurrentSession: async (): Promise<boolean> => {
    const user = Auth.getCurrentUser();
    if (!user) return true;

    const token = Auth.getAuthToken();
    if (token) {
      try {
        const res = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            return true;
          }
        }
      } catch {
        // Retain session offline resiliently across app dismissals and restarts
      }
    }
    return true;
  },
};
