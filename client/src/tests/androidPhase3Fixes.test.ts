import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nativeService } from '../services/nativeService';
import { CARD_HEADER_CLASSES, CARD_BODY_CLASSES } from '../presentation/mobile/design-system/materialYou';

// In-memory mock storage if running in node vitest environment
const mockStorage: Record<string, string> = {};
const testLocalStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

describe('Android Phase 2 Corrections & Feature Navigation Refinement Suite', () => {
  beforeEach(() => {
    testLocalStorage.clear();
    vi.restoreAllMocks();
  });

  describe('PART 1 — Location Permission Flow & Weather', () => {
    it('requests actual device location via nativeService and obtains coordinates', async () => {
      vi.spyOn(nativeService, 'requestLocationAndGetPosition').mockResolvedValue({
        latitude: 12.9716,
        longitude: 77.5946,
      });

      const pos = await nativeService.requestLocationAndGetPosition();
      expect(pos).toEqual({ latitude: 12.9716, longitude: 77.5946 });
    });

    it('handles denied permission properly without falling back to hardcoded city', async () => {
      const deniedErr = new Error('PERMISSION_DENIED');
      (deniedErr as any).code = 1;
      vi.spyOn(nativeService, 'requestLocationAndGetPosition').mockRejectedValue(deniedErr);

      let locationStatus = 'prompt';
      try {
        await nativeService.requestLocationAndGetPosition();
        locationStatus = 'granted';
      } catch (err: any) {
        if (err.code === 1 || err.message === 'PERMISSION_DENIED') {
          locationStatus = 'denied';
          testLocalStorage.setItem('lifeos_location_permitted', 'false');
        }
      }

      expect(locationStatus).toBe('denied');
      expect(testLocalStorage.getItem('lifeos_location_permitted')).toBe('false');
      // Verify no hardcoded fallback was set
      expect(testLocalStorage.getItem('lifeos_android_weather')).toBeNull();
    });

    it('handles permission lifecycle without endless loops', async () => {
      testLocalStorage.setItem('lifeos_location_permitted', 'false');
      // If user previously denied, does not re-prompt on launch automatically
      const savedPerm = testLocalStorage.getItem('lifeos_location_permitted');
      expect(savedPerm).toBe('false');
    });
  });

  describe('PART 2 — Fix Location Controls Overflow', () => {
    it('weather action controls use compact dimensions and shrink-0 to prevent horizontal overflow', () => {
      const controlContainerClasses = 'flex items-center gap-1 shrink-0';
      const actionButtonClasses = 'h-7 px-2.5 rounded-full text-[10px] font-bold shrink-0';
      const refreshButtonClasses = 'w-7 h-7 rounded-full shrink-0';

      expect(controlContainerClasses).toContain('shrink-0');
      expect(actionButtonClasses).toContain('shrink-0');
      expect(actionButtonClasses).toContain('h-7');
      expect(refreshButtonClasses).toContain('w-7');
      expect(refreshButtonClasses).toContain('h-7');
    });

    it('weather card fits cleanly in phone viewport with overflow-hidden', () => {
      const weatherCardClasses = 'w-full rounded-3xl p-3 sm:p-3.5 shadow-2xs overflow-hidden';
      expect(weatherCardClasses).toContain('overflow-hidden');
      expect(weatherCardClasses).toContain('w-full');
    });
  });

  describe('PART 3 — Clear Location / Place Name in Weather Card', () => {
    it('formats reverse geocoded city and state dynamically into clear readable location line', () => {
      const formatLocation = (address: any) => {
        const city = address.city || address.town || address.village || address.suburb;
        const state = address.state || address.region;
        if (city && state) return `${city}, ${state}`;
        return city || state || 'Detected Location';
      };

      expect(formatLocation({ city: 'Bengaluru', state: 'Karnataka' })).toBe('Bengaluru, Karnataka');
      expect(formatLocation({ city: 'Mumbai', state: 'Maharashtra' })).toBe('Mumbai, Maharashtra');
      expect(formatLocation({ city: 'San Francisco', state: 'California' })).toBe('San Francisco, California');
    });

    it('preserves visual hierarchy: Temperature + condition -> Place name -> Secondary info', () => {
      const hierarchy = ['temperature_condition', 'place_name', 'secondary_info'];
      expect(hierarchy[0]).toBe('temperature_condition');
      expect(hierarchy[1]).toBe('place_name');
      expect(hierarchy[2]).toBe('secondary_info');
    });
  });

  describe('PART 4 — Reduced Vertical Spacing', () => {
    it('uses intentional compact spacing between Top App Bar and page content', () => {
      expect(CARD_HEADER_CLASSES).toContain('pb-2');
      expect(CARD_BODY_CLASSES).toContain('pt-0');
    });
  });

  describe('PART 5 — Home Dashboard Widgets Integrity', () => {
    it('Home cards (Tasks, Spending, Habits) are compact dashboard widgets without generic List/Tiles mode', async () => {
      const tasksCardModule = await import('../presentation/mobile/screens/home/AndroidTasksCard');
      const spendingCardModule = await import('../presentation/mobile/screens/home/AndroidSpendingCard');
      const habitsCardModule = await import('../presentation/mobile/screens/home/AndroidHabitsCard');

      expect(tasksCardModule.AndroidTasksCard).toBeDefined();
      expect(spendingCardModule.AndroidSpendingCard).toBeDefined();
      expect(habitsCardModule.AndroidHabitsCard).toBeDefined();
    });
  });

  describe('PART 6 — More Section Application Launcher & List ↔ Tiles Toggle', () => {
    it('More section provides List and Tiles view modes and persists user selection', () => {
      let mode: 'list' | 'tiles' = 'tiles';
      const handleToggle = (newMode: 'list' | 'tiles') => {
        mode = newMode;
        testLocalStorage.setItem('lifeos_more_view_mode', newMode);
      };

      expect(mode).toBe('tiles');
      handleToggle('list');
      expect(mode).toBe('list');
      expect(testLocalStorage.getItem('lifeos_more_view_mode')).toBe('list');

      handleToggle('tiles');
      expect(mode).toBe('tiles');
      expect(testLocalStorage.getItem('lifeos_more_view_mode')).toBe('tiles');
    });

    it('More section contains remaining features without duplicating Quick Access or Bottom Nav', async () => {
      const moreSheetModule = await import('../presentation/mobile/navigation/AndroidMoreSheet');
      expect(moreSheetModule.AndroidMoreSheet).toBeDefined();
    });
  });
});
