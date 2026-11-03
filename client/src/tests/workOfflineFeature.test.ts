import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as supabaseModule from '../utils/neonSync';
import { INITIAL_SETTINGS } from '../utils/storage';

const createLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
};

describe('Work Offline Feature & Auto-Sync Suppression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', createLocalStorage());
    supabaseModule.setWorkOfflineMode(false);
    supabaseModule.setCustomWorkspaceIdentifier('user_guest');
    supabaseModule.setCustomWorkspaceEmail('guest@workspace.local');
  });

  afterEach(() => {
    supabaseModule.setWorkOfflineMode(false);
    supabaseModule.setCustomWorkspaceIdentifier('user_guest');
    supabaseModule.setCustomWorkspaceEmail('guest@workspace.local');
    vi.unstubAllGlobals();
  });

  it('1. setWorkOfflineMode correctly toggles offline state', () => {
    expect(supabaseModule.isWorkOfflineMode()).toBe(false);

    supabaseModule.setWorkOfflineMode(true);
    expect(supabaseModule.isWorkOfflineMode()).toBe(true);

    supabaseModule.setWorkOfflineMode(false);
    expect(supabaseModule.isWorkOfflineMode()).toBe(false);
  });

  it('2. Guest offline mode does not read a workspace snapshot or invoke cloud sync', () => {
    supabaseModule.setWorkOfflineMode(true);

    const mockPayloadGetter = vi.fn(() => ({ sample: 'data' }));
    const syncSpy = vi.spyOn(supabaseModule, 'syncWorkspaceToSupabase');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    supabaseModule.scheduleAutoSyncToSupabase(mockPayloadGetter, 50);

    expect(mockPayloadGetter).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('3. Explicit Work Offline pauses workspace snapshot scheduling for signed-in users', async () => {
    supabaseModule.setWorkOfflineMode(true);
    supabaseModule.setCustomWorkspaceIdentifier('account_offline_test');
    supabaseModule.setCustomWorkspaceEmail('offline@example.com');

    const payload = { profile: { name: 'Offline' }, todos: [] };
    const payloadGetter = vi.fn(() => payload);
    const syncSpy = vi.spyOn(supabaseModule, 'syncWorkspaceToSupabase');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    supabaseModule.scheduleAutoSyncToSupabase(payloadGetter, 50);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(payloadGetter).not.toHaveBeenCalled();
    expect(localStorage.getItem('lifeos_workspace_outbox_account_offline_test')).toBeNull();
    expect(syncSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('4. A network disconnect queues the signed-in snapshot for later retry', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    supabaseModule.setCustomWorkspaceIdentifier('account_offline_test');
    supabaseModule.setCustomWorkspaceEmail('offline@example.com');
    const payload = { profile: { name: 'Disconnected' }, todos: [] };
    const payloadGetter = vi.fn(() => payload);
    const syncSpy = vi.spyOn(supabaseModule, 'syncWorkspaceToSupabase');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    supabaseModule.scheduleAutoSyncToSupabase(payloadGetter, 50);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = JSON.parse(localStorage.getItem('lifeos_workspace_outbox_account_offline_test') || 'null');
    expect(payloadGetter).toHaveBeenCalledOnce();
    expect(stored.payload).toEqual(payload);
    expect(syncSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('5. flushAutoSyncImmediately returns without queueing when explicit Work Offline is enabled', async () => {
    supabaseModule.setWorkOfflineMode(true);
    supabaseModule.setCustomWorkspaceIdentifier('account_offline_test');
    supabaseModule.setCustomWorkspaceEmail('offline@example.com');

    const syncSpy = vi.spyOn(supabaseModule, 'syncWorkspaceToSupabase');
    await supabaseModule.flushAutoSyncImmediately({ test: 123 });

    expect(syncSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('lifeos_workspace_outbox_account_offline_test')).toBeNull();
  });

  it('6. Direct workspace sync respects explicit Work Offline mode', async () => {
    supabaseModule.setWorkOfflineMode(true);
    supabaseModule.setCustomWorkspaceIdentifier('account_offline_test');
    supabaseModule.setCustomWorkspaceEmail('offline@example.com');
    localStorage.setItem('notion_os_auth_token_v1', 'test-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await supabaseModule.syncWorkspaceToSupabase({ profile: { name: 'Offline' } });

    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('7. Enabling Work Offline cancels already scheduled workspace sync timers', async () => {
    supabaseModule.setCustomWorkspaceIdentifier('account_offline_test');
    supabaseModule.setCustomWorkspaceEmail('offline@example.com');
    localStorage.setItem('notion_os_auth_token_v1', 'test-token');
    const payloadGetter = vi.fn(() => ({ profile: { name: 'Scheduled' } }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.useFakeTimers();

    supabaseModule.scheduleAutoSyncToSupabase(payloadGetter, 50);
    supabaseModule.setWorkOfflineMode(true);
    await vi.advanceTimersByTimeAsync(1000);

    expect(payloadGetter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('8. INITIAL_SETTINGS includes workOffline: false by default', () => {
    expect(INITIAL_SETTINGS.workOffline).toBe(false);
  });
});
