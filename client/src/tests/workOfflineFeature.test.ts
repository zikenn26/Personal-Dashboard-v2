import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseModule from '../utils/supabase';
import { INITIAL_SETTINGS } from '../utils/storage';

describe('Work Offline Feature & Auto-Sync Suppression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    supabaseModule.setWorkOfflineMode(false);
  });

  it('1. setWorkOfflineMode correctly toggles offline state', () => {
    expect(supabaseModule.isWorkOfflineMode()).toBe(false);

    supabaseModule.setWorkOfflineMode(true);
    expect(supabaseModule.isWorkOfflineMode()).toBe(true);

    supabaseModule.setWorkOfflineMode(false);
    expect(supabaseModule.isWorkOfflineMode()).toBe(false);
  });

  it('2. scheduleAutoSyncToSupabase does not schedule or invoke sync when offline', () => {
    supabaseModule.setWorkOfflineMode(true);

    const mockPayloadGetter = vi.fn(() => ({ sample: 'data' }));
    const syncSpy = vi.spyOn(supabaseModule, 'syncWorkspaceToSupabase');

    supabaseModule.scheduleAutoSyncToSupabase(mockPayloadGetter, 50);

    // Payload getter should not even be called when work offline is true
    expect(mockPayloadGetter).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('3. flushAutoSyncImmediately returns immediately without syncing when offline', async () => {
    supabaseModule.setWorkOfflineMode(true);

    const syncSpy = vi.spyOn(supabaseModule, 'syncWorkspaceToSupabase');
    await supabaseModule.flushAutoSyncImmediately({ test: 123 });

    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('4. INITIAL_SETTINGS includes workOffline: false by default', () => {
    expect(INITIAL_SETTINGS.workOffline).toBe(false);
  });
});
