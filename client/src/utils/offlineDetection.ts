/**
 * Offline Detection Utility
 * Detects network connectivity and provides offline-first mode for APK
 * In offline mode: read-only access to cached data, no modifications allowed
 */

import { logger } from './logger';

type CapacitorNetwork = any;

const TAG = 'OFFLINE_DETECTION';

/**
 * Check if running on native platform (synchronous, feature-based)
 */
function isNativePlatform(): boolean {
  // Check for Capacitor presence in window/global scope
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return (window as any).Capacitor.isNativePlatform?.() ?? false;
  }
  // Not on native platform
  return false;
}

/**
 * Lazy load Capacitor Network plugin (only available on native platforms)
 */
let networkPlugin: CapacitorNetwork | null = null;
async function getNetworkPlugin(): Promise<CapacitorNetwork | null> {
  if (!isNativePlatform()) {
    return null;
  }

  if (networkPlugin === null) {
    try {
      const { Network } = await import('@capacitor/network');
      networkPlugin = Network;
    } catch (err) {
      console.warn('[OFFLINE_DETECTION] Failed to load Capacitor Network plugin:', err);
      return null;
    }
  }

  return networkPlugin;
}

/**
 * Offline mode state
 */
export interface OfflineState {
  isOnline: boolean;
  isAPK: boolean;
  isOfflineMode: boolean; // APK-specific: user explicitly enabled offline mode
  canModify: boolean; // Can user modify data?
  lastOnlineTime: number;
  networkQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

/**
 * Global offline state
 */
let offlineState: OfflineState = {
  isOnline: true,
  isAPK: isNativePlatform(),
  isOfflineMode: false,
  canModify: true,
  lastOnlineTime: Date.now(),
  networkQuality: 'excellent',
};

/**
 * Callbacks for offline state changes
 */
const stateChangeCallbacks: ((state: OfflineState) => void)[] = [];

/**
 * Update offline state
 */
function updateOfflineState(updates: Partial<OfflineState>): void {
  const previousState = { ...offlineState };
  offlineState = { ...offlineState, ...updates };

  // Calculate canModify
  offlineState.canModify = offlineState.isOnline && !offlineState.isOfflineMode;

  // Notify listeners if state changed
  if (JSON.stringify(previousState) !== JSON.stringify(offlineState)) {
    logger.info(TAG, 'Offline state changed', offlineState);
    stateChangeCallbacks.forEach(callback => {
      try {
        callback(offlineState);
      } catch (err) {
        logger.error(TAG, 'Error in state change callback', err);
      }
    });
  }
}

/**
 * Subscribe to offline state changes
 */
export function subscribeToOfflineStateChanges(callback: (state: OfflineState) => void): () => void {
  stateChangeCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      stateChangeCallbacks.splice(index, 1);
    }
  };
}

/**
 * Get current offline state
 */
export function getOfflineState(): OfflineState {
  return { ...offlineState };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return offlineState.isOnline;
}

/**
 * Check if currently offline
 */
export function isOffline(): boolean {
  return !offlineState.isOnline;
}

/**
 * Check if modifications are allowed
 */
export function canModifyData(): boolean {
  return offlineState.canModify;
}

/**
 * Check if running on APK
 */
export function isAPK(): boolean {
  return offlineState.isAPK;
}

/**
 * Check if offline mode is enabled (APK only)
 */
export function isOfflineModeEnabled(): boolean {
  return offlineState.isOfflineMode;
}

/**
 * Toggle offline mode (APK only)
 */
export function setOfflineMode(enabled: boolean): void {
  if (!isAPK()) {
    logger.warn(TAG, 'Offline mode is only available on APK');
    return;
  }

  logger.info(TAG, `Offline mode ${enabled ? 'enabled' : 'disabled'}`);
  updateOfflineState({ isOfflineMode: enabled });
}

/**
 * Initialize offline detection and network monitoring
 * Should be called once when app starts
 */
export async function initializeOfflineDetection(): Promise<void> {
  try {
    // Check initial network status
    if (isNativePlatform()) {
      try {
        const Network = await getNetworkPlugin();
        if (!Network) {
          // Plugin not available, fallback to browser API
          initializeBrowserNetworkMonitoring();
          return;
        }

        const status = await Network.getStatus();
        updateOfflineState({
          isOnline: status.connected,
          networkQuality: status.connected ? 'excellent' : 'offline',
        });

        // Listen for network changes
        await Network.addListener('networkStatusChange', (status: any) => {
          logger.info(TAG, 'Network status changed', { connected: status.connected });

          if (status.connected) {
            updateOfflineState({
              isOnline: true,
              lastOnlineTime: Date.now(),
              networkQuality: 'excellent',
            });

            // Trigger sync when coming back online
            triggerSyncOnReconnect();
          } else {
            updateOfflineState({
              isOnline: false,
              networkQuality: 'offline',
            });
          }
        });
      } catch (err) {
        logger.warn(TAG, 'Failed to initialize native network monitoring', err);
        // Fallback to browser API
        initializeBrowserNetworkMonitoring();
      }
    } else {
      // Web: use browser Network API
      initializeBrowserNetworkMonitoring();
    }
  } catch (err) {
    logger.error(TAG, 'Error initializing offline detection', err);
  }
}

/**
 * Browser-based network monitoring
 */
function initializeBrowserNetworkMonitoring(): void {
  // Online event
  window.addEventListener('online', () => {
    logger.info(TAG, 'Browser online event detected');
    updateOfflineState({
      isOnline: true,
      lastOnlineTime: Date.now(),
      networkQuality: 'good',
    });
    triggerSyncOnReconnect();
  });

  // Offline event
  window.addEventListener('offline', () => {
    logger.info(TAG, 'Browser offline event detected');
    updateOfflineState({
      isOnline: false,
      networkQuality: 'offline',
    });
  });

  // Initial state
  updateOfflineState({
    isOnline: navigator.onLine,
  });
}

/**
 * Trigger sync when device comes back online
 * This is called automatically, but can be called manually
 */
export async function triggerSyncOnReconnect(): Promise<void> {
  if (!isOnline()) {
    logger.warn(TAG, 'Cannot trigger sync, device is offline');
    return;
  }

  logger.info(TAG, 'Triggering sync after reconnection');

  // Dispatch custom event that App.tsx can listen to
  const event = new CustomEvent('app:reconnected', {
    detail: { timestamp: Date.now() },
  });

  window.dispatchEvent(event);
}

/**
 * Get network quality indicator
 * Can be used to adjust sync frequency or show UI indicators
 */
export function getNetworkQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
  return offlineState.networkQuality;
}

/**
 * Set network quality (internal use, updated by Network listener)
 */
export function setNetworkQuality(quality: 'excellent' | 'good' | 'poor' | 'offline'): void {
  updateOfflineState({ networkQuality: quality });
}

/**
 * Get time since last online (in milliseconds)
 */
export function getTimeSinceLastOnline(): number {
  return Date.now() - offlineState.lastOnlineTime;
}

/**
 * Check if should show "offline mode" indicator in UI
 */
export function shouldShowOfflineIndicator(): boolean {
  return isOffline() || isOfflineModeEnabled();
}

/**
 * Get user-friendly offline status message
 */
export function getOfflineStatusMessage(): string {
  if (offlineState.isOfflineMode) {
    return 'Offline Mode (Read-Only)';
  }

  if (offlineState.isOnline) {
    return 'Online';
  }

  const timeSince = getTimeSinceLastOnline();
  const seconds = Math.floor(timeSince / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `Offline for ${hours}h`;
  }

  if (minutes > 0) {
    return `Offline for ${minutes}m`;
  }

  return `Offline`;
}

/**
 * Prevent modification when offline
 * Can be used before modifying data
 */
export function assertCanModify(): void {
  if (!canModifyData()) {
    const reason = offlineState.isOfflineMode
      ? 'Offline mode is active - modifications not allowed'
      : 'Device is offline - modifications not allowed';

    const error = new Error(reason);
    (error as any).code = 'OFFLINE_MODE';
    throw error;
  }
}

/**
 * Enhanced fetch wrapper that works offline
 * Throws if trying to modify data while offline
 */
export async function fetchWithOfflineCheck<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  fn: () => Promise<T>
): Promise<T> {
  // Prevent modifications offline
  if (method !== 'GET' && !canModifyData()) {
    assertCanModify();
  }

  // Execute with retry on network errors
  return fn();
}
