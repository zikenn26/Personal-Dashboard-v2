import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Storage } from '../utils/storage';
import { scratchpadWidgetService } from '../services/scratchpadWidgetService';

describe('Scratch Pad Widget Native Synchronization & Storage Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('retrieves empty default or stored scratch pad notes', () => {
    expect(Storage.getScratchpad()).toBe('');

    Storage.setScratchpad('- Note 1: Ship widget\n- Note 2: Verify launcher flow');
    expect(Storage.getScratchpad()).toBe('- Note 1: Ship widget\n- Note 2: Verify launcher flow');
  });

  it('triggers syncToNativeWidget when setScratchpad is called', async () => {
    const syncSpy = vi.spyOn(scratchpadWidgetService, 'syncToNativeWidget');

    Storage.setScratchpad('- Review launch checklist\n- Check Android widget preview');

    expect(syncSpy).toHaveBeenCalledWith('- Review launch checklist\n- Check Android widget preview');
  });

  it('dispatches scratchpad-updated and dashboard-data-updated events for instant UI sync', () => {
    let customEventFired = false;
    let dashboardEventFired = false;

    const handleScratch = (e: any) => {
      if (e.detail?.content === '- Test note event') {
        customEventFired = true;
      }
    };
    const handleDash = (e: any) => {
      if (e.detail?.module === 'scratchpad') {
        dashboardEventFired = true;
      }
    };

    window.addEventListener('scratchpad-updated', handleScratch);
    window.addEventListener('dashboard-data-updated', handleDash);

    Storage.setScratchpad('- Test note event');

    expect(customEventFired).toBe(true);
    expect(dashboardEventFired).toBe(true);

    window.removeEventListener('scratchpad-updated', handleScratch);
    window.removeEventListener('dashboard-data-updated', handleDash);
  });

  it('maintains compatibility with Supabase full data export and import', () => {
    Storage.setScratchpad('- Synced across all platforms');

    const payload = Storage.getAllDataPayload();
    expect(payload.scratchpad).toBe('- Synced across all platforms');

    // Simulate import of payload from another device
    Storage.importAllDataPayload({
      ...payload,
      scratchpad: '- Updated from mobile home-screen',
    });

    expect(Storage.getScratchpad()).toBe('- Updated from mobile home-screen');
  });
});
