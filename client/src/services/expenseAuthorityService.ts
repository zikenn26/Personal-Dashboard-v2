/**
 * Expense Authority Service
 * Implements APK-as-primary-source-of-truth for expenses
 * 
 * Rules:
 * 1. APK-created expenses (SMS) are always authoritative
 * 2. Web/Other platforms sync from APK
 * 3. When APK syncs, other devices auto-update
 * 4. When non-APK device edits an APK expense, it's queued for APK reconciliation
 * 5. APK can always accept/reject/merge edits from other platforms
 */

import { ExpenseItem } from '../types';
import { getSupabaseClient, getCustomWorkspaceIdentifier } from '../utils/supabase';
import { getOrCreateDeviceId } from './deviceService';
import { VersionVector, createVersionVector } from '../utils/versioning';

export interface ExpenseAuthorityRecord {
  expense_id: string;
  user_id: string;
  workspace_identifier: string;
  source_device_type: 'apk' | 'web' | 'desktop' | 'other';
  authoritative_device_id: string;
  last_authoritative_modification_ms: number;
  requires_platform_reconciliation: boolean;
  is_synced_to_all_devices: boolean;
  apk_version: number;
  web_version: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithAuthority {
  expense: ExpenseItem;
  authority: ExpenseAuthorityRecord;
  version: VersionVector;
  is_authoritative: boolean;
}

/**
 * Determine if current device is APK (native platform)
 */
async function isCurrentDeviceAPK(): Promise<boolean> {
  // Check if running in native context
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Get current platform identifier
 */
export async function getCurrentPlatform(): Promise<'apk' | 'web' | 'desktop' | 'other'> {
  if (await isCurrentDeviceAPK()) {
    return 'apk';
  }
  // TODO: Add desktop detection if needed
  return 'web';
}

/**
 * Record expense authority when an expense is created/modified
 */
export async function recordExpenseAuthority(
  expenseId: string,
  workspaceIdentifier: string,
  isAPKDevice: boolean = false
): Promise<ExpenseAuthorityRecord | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const deviceId = await getOrCreateDeviceId();
    const sourceDeviceType = isAPKDevice ? 'apk' : 'web';
    const now = Date.now();

    // Get current user ID from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.id) {
      console.warn('[EXPENSE_AUTHORITY] No authenticated user found');
      return null;
    }

    const { data, error } = await supabase
      .from('expense_authority')
      .upsert(
        {
          expense_id: expenseId,
          user_id: user.id,
          workspace_identifier: workspaceIdentifier,
          source_device_type: sourceDeviceType,
          authoritative_device_id: deviceId,
          last_authoritative_modification_ms: now,
          requires_platform_reconciliation: false,
          is_synced_to_all_devices: false,
          apk_version: isAPKDevice ? 1 : 0,
          web_version: !isAPKDevice ? 1 : 0,
        },
        { onConflict: 'expense_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error recording expense authority:', error);
      return null;
    }

    return data as ExpenseAuthorityRecord;
  } catch (err) {
    console.error('Unexpected error recording expense authority:', err);
    return null;
  }
}

/**
 * Get authority record for an expense
 */
export async function getExpenseAuthority(expenseId: string): Promise<ExpenseAuthorityRecord | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('expense_authority')
      .select('*')
      .eq('expense_id', expenseId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching expense authority:', error);
      return null;
    }

    return (data as ExpenseAuthorityRecord) || null;
  } catch (err) {
    console.error('Unexpected error fetching expense authority:', err);
    return null;
  }
}

/**
 * Mark expense as needing APK reconciliation (when non-APK device modifies APK expense)
 */
export async function markForAPKReconciliation(expenseId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('expense_authority')
      .update({
        requires_platform_reconciliation: true,
        is_synced_to_all_devices: false,
      })
      .eq('expense_id', expenseId);

    if (error) {
      console.error('Error marking expense for reconciliation:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error marking for reconciliation:', err);
    return false;
  }
}

/**
 * Mark expense as synced across all platforms
 */
export async function markExpenseAsSyncedToAllDevices(expenseId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('expense_authority')
      .update({
        is_synced_to_all_devices: true,
        requires_platform_reconciliation: false,
      })
      .eq('expense_id', expenseId);

    if (error) {
      console.error('Error marking expense as synced:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error marking as synced:', err);
    return false;
  }
}

/**
 * Get all expenses requiring APK reconciliation for a workspace
 */
export async function getExpensesRequiringAPKReconciliation(
  workspaceIdentifier: string
): Promise<ExpenseAuthorityRecord[]> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('expense_authority')
      .select('*')
      .eq('workspace_identifier', workspaceIdentifier)
      .eq('requires_platform_reconciliation', true)
      .order('last_authoritative_modification_ms', { ascending: false });

    if (error) {
      console.error('Error fetching reconciliation expenses:', error);
      return [];
    }

    return (data as ExpenseAuthorityRecord[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching reconciliation expenses:', err);
    return [];
  }
}

/**
 * Determine conflict resolution for an expense edit
 * 
 * Priority:
 * 1. If APK has authoritative copy, APK version wins
 * 2. If concurrent edits from different devices, latest wall-clock wins
 * 3. If APK explicitly accepted the edit, use new version
 */
export async function resolveExpenseConflict(
  expenseId: string,
  incomingVersion: any,
  localVersion: any,
  incomingDeviceType: 'apk' | 'web' | 'desktop' | 'other',
  localDeviceType: 'apk' | 'web' | 'desktop' | 'other'
): Promise<'incoming' | 'local' | 'merge'> {
  try {
    // CRITICAL FIX: Validate all inputs first
    if (!expenseId || !incomingVersion || !localVersion) {
      console.error('[CONFLICT_RESOLUTION] Invalid inputs:', { expenseId, hasIncoming: !!incomingVersion, hasLocal: !!localVersion });
      return 'local'; // Default to local (safer)
    }

    // CRITICAL FIX: Ensure timestamps exist for wall-clock comparison
    if (!incomingVersion.updatedAt && !incomingVersion.updated_at) {
      console.error('[CONFLICT_RESOLUTION] Missing timestamp in incoming version');
      return 'local';
    }

    if (!localVersion.updatedAt && !localVersion.updated_at) {
      console.error('[CONFLICT_RESOLUTION] Missing timestamp in local version');
      return 'local';
    }

    const incomingTime = incomingVersion.updatedAt || incomingVersion.updated_at;
    const localTime = localVersion.updatedAt || localVersion.updated_at;

    const authority = await getExpenseAuthority(expenseId);
    if (!authority) {
      // No authority record yet; incoming device can establish it if it's APK
      if (incomingDeviceType === 'apk') {
        return 'incoming';
      }
      // Non-APK incoming; use latest wall-clock
      return new Date(incomingTime).getTime() > new Date(localTime).getTime() ? 'incoming' : 'local';
    }

    // If APK is authoritative and current device is APK, APK wins
    if (authority.source_device_type === 'apk' && incomingDeviceType === 'apk') {
      // Both APK? Use version numbers (with null-safe defaults)
      const authorityVersion = authority.apk_version || 0;
      const incomingVer = incomingVersion.version || 0;
      return authorityVersion >= incomingVer ? 'local' : 'incoming';
    }

    // If APK is authoritative and incoming is NOT APK
    if (authority.source_device_type === 'apk' && incomingDeviceType !== 'apk') {
      // Non-APK device trying to modify APK expense: requires reconciliation
      await markForAPKReconciliation(expenseId);
      // For now, keep local (APK) version
      return 'local';
    }

    // If non-APK is authoritative but APK is trying to modify
    if (authority.source_device_type !== 'apk' && incomingDeviceType === 'apk') {
      // APK takes over as new authority
      return 'incoming';
    }

    // Both non-APK: use latest wall-clock
    return new Date(incomingTime).getTime() > new Date(localTime).getTime() ? 'incoming' : 'local';
  } catch (err) {
    console.error('[CONFLICT_RESOLUTION] Error resolving expense conflict:', err);
    // Fallback: return local (safer default)
    try {
      const incomingTime = incomingVersion?.updatedAt || incomingVersion?.updated_at;
      const localTime = localVersion?.updatedAt || localVersion?.updated_at;
      if (incomingTime && localTime) {
        return new Date(incomingTime).getTime() > new Date(localTime).getTime() ? 'incoming' : 'local';
      }
    } catch {
      // Ignore errors in fallback
    }
    return 'local'; // Ultimate fallback
  }
}

/**
 * Get sync priority for expense batches
 * APK-created expenses should sync with highest priority
 */
export async function getExpensesSortedByAuthority(
  expenses: (ExpenseItem & { authority?: ExpenseAuthorityRecord })[]
): Promise<(ExpenseItem & { authority?: ExpenseAuthorityRecord })[]> {
  return expenses.sort((a, b) => {
    // APK-created expenses first
    if (a.authority?.source_device_type === 'apk' && b.authority?.source_device_type !== 'apk') {
      return -1;
    }
    if (a.authority?.source_device_type !== 'apk' && b.authority?.source_device_type === 'apk') {
      return 1;
    }

    // Then expenses requiring reconciliation
    if (a.authority?.requires_platform_reconciliation && !b.authority?.requires_platform_reconciliation) {
      return -1;
    }
    if (!a.authority?.requires_platform_reconciliation && b.authority?.requires_platform_reconciliation) {
      return 1;
    }

    // Then by recency
    const aTime = a.authority?.last_authoritative_modification_ms || 0;
    const bTime = b.authority?.last_authoritative_modification_ms || 0;
    return bTime - aTime;
  });
}

/**
 * Create version vector for an expense edit
 */
export async function createExpenseVersionVector(
  expenseId: string,
  logicalClock: number,
  sequence: number = 0
): Promise<VersionVector> {
  const deviceId = await getOrCreateDeviceId();
  return createVersionVector(deviceId, logicalClock, Date.now(), sequence);
}

/**
 * Log conflict resolution for debugging
 */
export async function logConflictResolution(
  userId: string,
  expenseId: string,
  device_a: any,
  device_b: any,
  resolution: 'device_a_won' | 'device_b_won' | 'merged',
  resolvedValue: any
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('data_conflicts')
      .insert({
        user_id: userId,
        module: 'expenses',
        entity_id: expenseId,
        device_a_id: device_a?.device_id,
        device_b_id: device_b?.device_id,
        device_a_value: device_a,
        device_b_value: device_b,
        resolution,
        resolved_value: resolvedValue,
      });

    if (error) {
      console.warn('Error logging conflict:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Unexpected error logging conflict:', err);
    return false;
  }
}

export const expenseAuthorityService = {
  getCurrentPlatform,
  recordExpenseAuthority,
  getExpenseAuthority,
  markForAPKReconciliation,
  markExpenseAsSyncedToAllDevices,
  getExpensesRequiringAPKReconciliation,
  resolveExpenseConflict,
  getExpensesSortedByAuthority,
  createExpenseVersionVector,
  logConflictResolution,
};
