import { AuthUser } from '../types';
import {
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
  getCustomWorkspaceIdentifier,
  DEVICE_SESSION_ID,
} from './neonSync';
import { getDeviceInfo } from './devices';
import { Storage } from './storage';
import { smsExpenseService } from '../services/smsExpenseService';
import { getUserWorkspaceKey } from './userUtils';

export { getUserWorkspaceKey };

export const AUTH_STORAGE_KEY = 'notion_os_auth_user_v1';
export const TOKEN_STORAGE_KEY = 'notion_os_auth_token_v1';
const SAVED_USERS_KEY = 'notion_os_saved_accounts_v1';
const LOGIN_ATTEMPTS_KEY = 'notion_os_login_attempts_v1';

// Per-device backoff complements server-side authentication rate limiting.
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

export const Auth = {
  /**
   * Get persistent bearer session token
   */
  getAuthToken: (): string | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Save persistent bearer session token
   */
  setAuthToken: (token: string) => {
    try {
      if (typeof localStorage !== 'undefined' && token) {
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
      if (typeof localStorage !== 'undefined') {
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

          // A cached profile without a server-issued bearer token is not a session.
          const existingToken = localStorage.getItem(TOKEN_STORAGE_KEY);
          if (!existingToken) return null;

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

    // Authentication is server-authoritative; cached credentials are never accepted.
    try {
      const currentDevice = getDeviceInfo();
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: raw,
          password: cleanPass,
          device_id: DEVICE_SESSION_ID,
          device_name: currentDevice.deviceName,
        }),
      });
      const authData = await response.json().catch(() => ({}));
      if (!response.ok || !authData.success || !authData.user || !authData.token) {
        recordLoginFailure(raw);
        return { success: false, message: authData.message || 'Invalid email or password.' };
      }
      const user: AuthUser = authData.user;
      const knownAccount = Auth.getKnownAccounts().find((account) => account.email.toLowerCase() === user.email.toLowerCase());
      const previousGeneration = Number(localStorage.getItem('notion_os_auth_generation_v1') || 0);
      const serverGeneration = Number(authData.generation || 0);
      const generationChanged = serverGeneration > 0 && serverGeneration !== previousGeneration;
      if ((knownAccount && knownAccount.id !== user.id) || generationChanged) {
        await Storage.resetToCleanUserWorkspace(user);
      }
      Auth.setCurrentUser(user, authData.token);
      if (Number(authData.generation) > 0) localStorage.setItem('notion_os_auth_generation_v1', String(authData.generation));
      setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
      setCustomWorkspaceEmail(user.email);
      recordLoginSuccess(raw);
      return { success: true, user, token: authData.token, message: 'Signed in successfully.' };
    } catch (neonPoolErr) {
      console.warn('[AUTH] Direct Neon pool login notice:', neonPoolErr);
      return { success: false, message: 'Could not reach the account service. Check your connection and try again.' };
    }
  },

  requestPasswordReset: async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!email.trim() || !email.includes('@')) return { success: false, message: 'Please enter a valid email address.' };
    return { success: false, message: 'Email password recovery is not configured for server accounts yet. Use an account with a known password or contact the administrator.' };
  },

  completePasswordRecovery: async (_newPassword: string): Promise<{ success: boolean; message: string }> => ({
    success: false,
    message: 'Email password recovery is not configured for server accounts yet.',
  }),

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

    if (!raw.includes('@')) return { success: false, message: 'Please register with an email address.' };
    const cleanEmail = raw;
    const displayName =
      name?.trim() ||
      raw
        .split('@')[0]
        .replace(/[\._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, name: displayName }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        return { success: false, message: result.message || 'Account registration failed.' };
      }
      const login = await Auth.signIn(cleanEmail, cleanPass);
      if (!login.success || !login.user) return { success: false, message: login.message || 'Account created; sign in to continue.' };
      await Storage.resetToCleanUserWorkspace(login.user);
      // Registration is a new account boundary. Drop prior device snapshots and
      // queues before the new empty workspace becomes active.
      Auth.setCurrentUser(login.user, login.token);
      return { success: true, user: login.user, message: `Account created successfully! Welcome to your private workspace, ${displayName}.` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Account registration failed.' };
    }
  },

  changePassword: async (currentPass: string, newPass: string): Promise<{ success: boolean; message: string }> => {
    if (!currentPass.trim() || newPass.trim().length < 8) {
      return { success: false, message: 'Enter your current password and a new password of at least 8 characters.' };
    }
    if (currentPass === newPass) return { success: false, message: 'New password cannot be identical to current password.' };
    const token = Auth.getAuthToken();
    if (!token) return { success: false, message: 'Please sign in before changing your password.' };
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
      });
      const result = await response.json().catch(() => ({}));
      return { success: response.ok && result.success, message: result.message || (response.ok ? 'Password updated.' : 'Password update failed.') };
    } catch {
      return { success: false, message: 'Could not reach the account service. Try again when online.' };
    }
  },

  updateCurrentUserName: async (newName: string): Promise<AuthUser | null> => {
    const user = Auth.getCurrentUser();
    const cleanName = newName.trim();
    if (!user || !cleanName) return user;
    const updatedUser = { ...user, name: cleanName };
    Auth.setCurrentUser(updatedUser);
    return updatedUser;
  },

  updateCurrentUserAvatar: async (avatarUrl: string): Promise<AuthUser | null> => {
    const user = Auth.getCurrentUser();
    if (!user) return null;
    const updatedUser = { ...user, avatarUrl };
    Auth.setCurrentUser(updatedUser);
    return updatedUser;
  },

  /**
   * Sign out this device while leaving its durable offline queue available for a later sign-in.
   */
  signOut: async () => {
    const token = Auth.getAuthToken();
    try {
      const currentUser = Auth.getCurrentUser();
      const uid = currentUser?.id || getCustomWorkspaceIdentifier();
      await smsExpenseService.preservePendingQueueBeforeSignOut(uid);
      Storage.clearMemoryExpensesCache();
    } catch (e) {
      console.warn('Notice preserving pending queue on signOut:', e);
    }
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Local sign-out still succeeds if the device is offline.
      }
    }
    Auth.setCurrentUser(null);
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
        const query = user.email ? `?user_email=${encodeURIComponent(user.email)}` : '';
        const res = await fetch(`/api/auth/verify${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401 || res.status === 403) {
          const data = await res.json().catch(() => ({}));
          const terminationMsg = data.message || 'This session is no longer active.';
          console.warn('[AUTH] Singleton session revoked:', terminationMsg);

          // A generation mismatch means the server was globally reset. Purge
          // every local partition before the UI signs out so stale offline
          // snapshots and outboxes cannot return after the next login.
          await Storage.resetToCleanUserWorkspace(user);
          Auth.setCurrentUser(null);

          if (typeof window !== 'undefined') {
            localStorage.setItem('notion_os_auth_termination_notice', terminationMsg);
            localStorage.setItem('notion_os_auth_signed_out', 'true');
            window.dispatchEvent(
              new CustomEvent('session_terminated', {
                detail: {
                  message: terminationMsg,
                  newDevice: data.newDeviceName,
                  timestamp: new Date().toISOString(),
                },
              })
            );
          }
          return false;
        }

        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            const serverGeneration = Number(data.generation || 0);
            if (serverGeneration > 0) {
              const localGeneration = Number(localStorage.getItem('notion_os_auth_generation_v1') || 0);
              if (localGeneration !== serverGeneration) {
                await Storage.resetToCleanUserWorkspace(user);
              }
              localStorage.setItem('notion_os_auth_generation_v1', String(serverGeneration));
            }
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
