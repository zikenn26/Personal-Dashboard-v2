import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Storage } from '../utils/storage';
import { scratchpadWidgetService } from '../services/scratchpadWidgetService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: 0,
  } as any;
}

if (typeof globalThis.window === 'undefined') {
  const eventListeners: Record<string, Function[]> = {};
  globalThis.window = {
    addEventListener: (type: string, listener: Function) => {
      eventListeners[type] = eventListeners[type] || [];
      eventListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: Function) => {
      if (eventListeners[type]) {
        eventListeners[type] = eventListeners[type].filter((l) => l !== listener);
      }
    },
    dispatchEvent: (event: any) => {
      const listeners = eventListeners[event.type] || [];
      listeners.forEach((l) => l(event));
      return true;
    },
  } as any;
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

describe('Scratch Pad Widget Native Synchronization & Storage Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('retrieves empty default or stored scratch pad notes and sanitizes legacy boilerplate', () => {
    expect(Storage.getScratchpad()).toBe('');

    // If legacy default boilerplate was stored in localStorage
    localStorage.setItem(
      'lifeos_scratchpad_notes',
      '- Jot down quick ideas, daily thoughts, or links\n- Auto-indented sticky note for your flow\n- '
    );
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
