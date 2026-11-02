import { AuthUser } from '../types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
  getCustomWorkspaceIdentifier,
} from './supabase';
import { hashPassword, verifyPasswordHash } from './crypto';
import { Storage, BLANK_PROFILE } from './storage';
import { smsExpenseService } from '../services/smsExpenseService';

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

// Legacy purge scripts disabled to ensure permanent session retention across APK dismissals
export const purgeLegacyAccounts = () => {};
export const enforceGlobalAuthEpoch = () => {};

// Default primary dashboard account (Gulshan Kumar Nayak) for instant cross-platform sign-in
export const DEFAULT_GKN_USER: AuthUser = {
  id: '036fe7d3-6a13-4740-b028-afb55e81e00e',
  name: 'Gulshan Kumar Nayak',
  email: 'gknayak@gmail.com',
  provider: 'supabase',
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
  provider: 'supabase',
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

  // Pre-seed default authoritative credentials if not already present
  if (!map['gknayak@gmail.com']) {
    map['gknayak@gmail.com'] = { user: DEFAULT_GKN_USER, pass: DEFAULT_GKN_PASS_HASH };
  }
  if (!map['gknayak']) {
    map['gknayak'] = { user: DEFAULT_GKN_USER, pass: DEFAULT_GKN_PASS_HASH };
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
 * Helper to check whether an account or username is already registered in Supabase Cloud or locally.
 */
export const isAccountAlreadyRegistered = async (identifier: string): Promise<boolean> => {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return false;
  const cleanId = clean.replace(/[^a-z0-9]/g, '_');

  // Disable hardcoded fallback for local authentication checks
  // (We now trust the backend/supabase rules entirely to dictate allowed users)
  if (
    cleanId === 'some_reserved_name_or_test_value'
  ) {
    return true;
  }

  const client = getSupabaseClient();
  if (client && isSupabaseConfigured()) {
    try {
      const emailVariant = clean.includes('@') ? clean : `${cleanId}@workspace.local`;
      const { data: cloudRow } = await client
        .from('user_workspaces')
        .select('id')
        .or(`user_identifier.eq.account_auth_${cleanId},user_identifier.eq.user_${cleanId},user_email.eq.${clean},user_email.eq.${emailVariant}`)
        .maybeSingle();

      if (cloudRow) return true;
    } catch {
      // ignore
    }
  }

  const localMap = getLocalCredentialsMap();
  return Boolean(localMap[clean] || localMap[cleanId]);
};

export const Auth = {
  /**
   * Get currently logged-in user from LocalStorage
   */
  getCurrentUser: (): AuthUser | null => {
    try {
      const isSignedOut = typeof window !== 'undefined' && localStorage.getItem('notion_os_auth_signed_out') === 'true';
      if (isSignedOut) {
        return null;
      }
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
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
        localStorage.removeItem('notion_os_auth_signed_out');
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
        // Restore any preserved messages for this specific user and process pending write retries
        try {
          void smsExpenseService.restorePreservedPendingSmsForUser(user.id);
          void smsExpenseService.processPendingWriteRetries();
        } catch {}
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
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
   * Strict password verification across devices via Supabase Cloud and local cache
   */
  signIn: async (
    emailOrUsername: string,
    pass: string
  ): Promise<{ success: boolean; user?: AuthUser; message?: string }> => {
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

    const client = getSupabaseClient();

    // 1. Supabase GoTrue Auth (Official supported Auth API across Web & APK)
    let supabaseAuthError: any = null;
    if (client && isSupabaseConfigured()) {
      let targetEmail = raw;
      if (!raw.includes('@')) {
        // Resolve username to email if known in workspaces or local credentials
        try {
          const { data: userRow } = await client
            .from('user_workspaces')
            .select('user_email')
            .eq('user_identifier', `account_auth_${cleanId}`)
            .maybeSingle();
          if (userRow?.user_email) {
            targetEmail = userRow.user_email;
          } else {
            const localMap = getLocalCredentialsMap();
            if (localMap[cleanId]?.user?.email) {
              targetEmail = localMap[cleanId].user.email;
            } else {
              targetEmail = `${cleanId}@workspace.local`;
            }
          }
        } catch {
          targetEmail = `${cleanId}@workspace.local`;
        }
      }

      try {
        console.info('[AUTH_DIAGNOSTIC] Stage: calling_supabase_signInWithPassword', { email: targetEmail });
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: targetEmail,
          password: cleanPass,
        });

        if (!authError && authData?.user) {
          console.info('[AUTH_DIAGNOSTIC] Stage: supabase_signInWithPassword_success', {
            userId: authData.user.id,
            email: authData.user.email,
          });

          const sbUser = authData.user;
          const userEmail = sbUser.email || targetEmail;
          const userCleanId = userEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const displayName =
            sbUser.user_metadata?.full_name ||
            sbUser.user_metadata?.name ||
            sbUser.user_metadata?.display_name ||
            userEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

          const rawSbAvatar = sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.avatarUrl || '';
          const userAvatar = isAvatarMatchingUserEmailDomain(rawSbAvatar, userEmail) ? rawSbAvatar : '';

          const loggedInUser: AuthUser = {
            id: sbUser.id,
            email: userEmail,
            name: displayName,
            avatarUrl: userAvatar,
            createdAt: sbUser.created_at ? new Date(sbUser.created_at).getTime() : Date.now(),
            lastLoginAt: Date.now(),
            provider: 'supabase',
          };

          // Ensure workspace partition exists in user_workspaces in background
          void ensureUserWorkspaceInitialized(client, loggedInUser).catch((wsErr) => {
            console.warn('[AUTH_DIAGNOSTIC] Workspace initialization notice:', wsErr);
          });

          // Cache credentials locally so subsequent offline/instant logins succeed
          await saveLocalCredential(loggedInUser.email, cleanPass, loggedInUser);

          Auth.setCurrentUser(loggedInUser);
          setCustomWorkspaceIdentifier(getUserWorkspaceKey(loggedInUser));
          setCustomWorkspaceEmail(loggedInUser.email);
          recordLoginSuccess(raw);
          return {
            success: true,
            user: loggedInUser,
            message: `Signed in successfully as ${displayName}!`,
          };
        } else if (authError) {
          supabaseAuthError = authError;
          console.warn('[AUTH_DIAGNOSTIC] Stage: supabase_signInWithPassword_error', {
            status: authError.status,
            message: authError.message,
            name: authError.name,
          });
        }
      } catch (callErr: any) {
        console.warn('[AUTH_DIAGNOSTIC] Stage: supabase_network_exception', { message: callErr?.message });
      }
    }

    // 2. Cloud-database Account check fallback (backward compatibility for legacy accounts in user_workspaces)
    if (client && isSupabaseConfigured()) {
      try {
        const emailVariant = raw.includes('@') ? raw : `${cleanId}@workspace.local`;
        const { data: cloudRow, error: cloudErr } = await client
          .from('user_workspaces')
          .select('workspace_data, user_email, user_identifier')
          .or(`user_identifier.eq.account_auth_${cleanId},user_email.eq.${raw},user_email.eq.${emailVariant}`)
          .maybeSingle();

        if (!cloudErr && cloudRow?.workspace_data?.account) {
          const cloudAccount = cloudRow.workspace_data.account;
          const passHash = cloudAccount.passHash;
          if (passHash) {
            const valid = await verifyPasswordHash(passHash, cleanPass);
            if (valid) {
              const cloudUser: AuthUser = {
                id: cloudAccount.user?.id || `usr_${cleanId}`,
                email: cloudRow.user_email || emailVariant,
                name: cloudAccount.user?.name || raw.split('@')[0],
                avatarUrl: cloudAccount.user?.avatarUrl,
                createdAt: cloudAccount.user?.createdAt || Date.now(),
                lastLoginAt: Date.now(),
                provider: 'supabase',
              };

              // Cache credentials locally so subsequent offline/instant logins succeed
              await saveLocalCredential(cloudUser.email, cleanPass, cloudUser);

              Auth.setCurrentUser(cloudUser);
              setCustomWorkspaceIdentifier(getUserWorkspaceKey(cloudUser));
              setCustomWorkspaceEmail(cloudUser.email);
              recordLoginSuccess(raw);
              return { success: true, user: cloudUser, message: 'Signed in successfully via Cloud Account' };
            }
          }
        }
      } catch (cloudLookupErr) {
        console.warn('[AUTH_DIAGNOSTIC] Cloud account lookup notice:', cloudLookupErr);
      }
    }

    // 3. Local-device account fallback (covers accounts in offline environment, test runners, or local storage)
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
        Auth.setCurrentUser(user);
        setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
        setCustomWorkspaceEmail(user.email);
        recordLoginSuccess(raw);
        return { success: true, user, message: 'Signed in successfully' };
      }
    }

    // 4. Failed authentication
    recordLoginFailure(raw);

    // Provide clear, accurate error message rather than silently masking genuine issues
    let errorMsg = 'Invalid email or password.';
    if (supabaseAuthError) {
      const lower = (supabaseAuthError.message || '').toLowerCase();
      if (lower.includes('email not confirmed')) {
        errorMsg = 'Please confirm your email address before signing in.';
      } else if (lower.includes('too many') || supabaseAuthError.status === 429) {
        errorMsg = 'Too many login attempts. Please wait a moment and try again.';
      } else if (
        lower.includes('invalid login credentials') ||
        lower.includes('invalid credentials') ||
        lower.includes('user not found') ||
        lower.includes('exceed_egress_quota') ||
        lower.includes('spend caps')
      ) {
        errorMsg = 'Invalid email or password.';
      } else if (supabaseAuthError.message) {
        errorMsg = supabaseAuthError.message;
      }
    }

    return {
      success: false,
      message: errorMsg,
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
      raw === 'some_reserved_name' ||
      cleanId === 'some_reserved_name'
    ) {
      return {
        success: false,
        message: 'The username is already registered and in use. Please choose a different unique username.',
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

    const client = getSupabaseClient();
    const nowMs = Date.now();
    const nowIso = new Date().toISOString();
    const passHash = await hashPassword(cleanPass);

    const user: AuthUser = {
      id: `usr_${cleanId}_${nowMs}`,
      email: cleanEmail,
      name: displayName,
      createdAt: nowMs,
      lastLoginAt: nowMs,
      provider: 'supabase',
    };

    // 1. Persist isolated user account & workspace to Supabase Cloud
    if (client && isSupabaseConfigured()) {
      try {
        // A. Create account_auth credentials record
        await client.from('user_workspaces').upsert(
          {
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
          },
          { onConflict: 'user_identifier' }
        );

        // B. Create isolated private workspace partition
        await client.from('user_workspaces').upsert(
          {
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
          },
          { onConflict: 'user_identifier' }
        );

        // C. Create initial devices partition
        await client.from('user_workspaces').upsert(
          {
            user_identifier: `account_devices_${cleanId}`,
            user_email: cleanEmail,
            workspace_data: {
              devices: [],
              updatedAt: nowMs,
            },
            updated_at: nowIso,
          },
          { onConflict: 'user_identifier' }
        );

        // D. Create GoTrue auth user if valid email address in background
        if (cleanEmail.includes('@') && !cleanEmail.endsWith('@workspace.local')) {
          void client.auth.signUp({
            email: cleanEmail,
            password: cleanPass,
            options: {
              data: {
                full_name: displayName,
                name: displayName,
              },
            },
          }).then(({ data: sbSignUp, error: sbSignUpErr }) => {
            if (sbSignUpErr) {
              console.warn('[AUTH_DIAGNOSTIC] Supabase GoTrue signUp notice:', sbSignUpErr.message);
            } else if (sbSignUp?.user) {
              console.info('[AUTH_DIAGNOSTIC] Supabase GoTrue user created:', sbSignUp.user.id);
            }
          }).catch((sbErr) => {
            console.warn('[AUTH_DIAGNOSTIC] Supabase GoTrue signUp exception:', sbErr);
          });
        }
      } catch (err: any) {
        console.warn('Supabase sign up creation notice:', err?.message || err);
      }
    }

    // 2. Cache credentials locally and set active session
    await saveLocalCredential(cleanEmail, cleanPass, user);
    if (!raw.includes('@')) {
      await saveLocalCredential(raw, cleanPass, user);
    }
    Auth.setCurrentUser(user);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
    setCustomWorkspaceEmail(cleanEmail);

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
        provider: 'supabase',
      };
    }

    // Save locally
    await saveLocalCredential(cleanEmail, cleanPass, user);
    if (!raw.includes('@')) {
      await saveLocalCredential(raw, cleanPass, user);
    }

    // Set as active user immediately
    Auth.setCurrentUser(user);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
    setCustomWorkspaceEmail(cleanEmail);
    recordLoginSuccess(raw);

    // Sync cloud/supabase if available in background
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      void syncCloudAccountRecord(client, cleanEmail, cleanPass, user).catch(() => {});
      try {
        void client.auth.updateUser({ password: cleanPass }).catch(() => {});
      } catch {}
    }

    return {
      success: true,
      user,
      message: `Password successfully updated! Signed in as ${user.name}.`,
    };
  },

  /**
   * Automatically verify active session against Supabase Cloud:
   * Enforces permanent session retention on the Android APK and web client.
   * Sessions persist indefinitely until the user explicitly clicks "Sign Out".
   */
  verifyCurrentSession: async (): Promise<boolean> => {
    const user = Auth.getCurrentUser();
    if (!user) return true;

    // Never auto-logout on network timeouts, database switches, or app dismissals
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      try {
        if (user.provider === 'supabase') {
          const { data: authData } = await client.auth.getUser();
          if (authData?.user) {
            void ensureUserWorkspaceInitialized(client, user).catch(() => {});
          }
        }
      } catch {
        // Retain session offline
      }
    }
    return true;
  },
};
