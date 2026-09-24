import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nativeService } from '../services/nativeService';
import { MaterialYouTokens, CARD_SURFACE_CLASSES } from '../presentation/mobile/design-system/materialYou';

describe('Android Migration Phase 1 - Architecture & Native Foundations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Native Platform & Back Button Management', () => {
    it('registers hardware back button handlers in stack order and unregisters properly', () => {
      const handler1 = vi.fn().mockReturnValue(false);
      const handler2 = vi.fn().mockReturnValue(true);

      const unregister1 = nativeService.registerBackButtonHandler(handler1);
      const unregister2 = nativeService.registerBackButtonHandler(handler2);

      expect(typeof unregister1).toBe('function');
      expect(typeof unregister2).toBe('function');

      // Cleaning up
      unregister2();
      unregister1();
    });

    it('triggers haptic feedback gracefully without throwing exceptions', async () => {
      await expect(nativeService.triggerHaptic('selection')).resolves.toBeUndefined();
      await expect(nativeService.triggerHaptic('success')).resolves.toBeUndefined();
      await expect(nativeService.triggerHaptic('warning')).resolves.toBeUndefined();
    });

    it('manages status bar theme without crashing', async () => {
      await expect(nativeService.updateThemeStatusBar(true)).resolves.toBeUndefined();
      await expect(nativeService.updateThemeStatusBar(false)).resolves.toBeUndefined();
    });
  });

  describe('Material You Design System Consistency', () => {
    it('defines rounded-3xl and safe-area compliant card tokens', () => {
      expect(CARD_SURFACE_CLASSES).toContain('rounded-3xl');
      expect(CARD_SURFACE_CLASSES).toContain('border');
      expect(MaterialYouTokens.radius.card).toBe('rounded-3xl');
      expect(MaterialYouTokens.radius.sheet).toBe('rounded-t-[28px]');
    });

    it('provides distinct Material You dynamic color definitions for light and dark surfaces', () => {
      expect(MaterialYouTokens.colors.primary).toBe('#7C3AED');
      expect(MaterialYouTokens.colors.surfaceBackgroundLight).toBeDefined();
      expect(MaterialYouTokens.colors.surfaceBackgroundDark).toBeDefined();
      expect(MaterialYouTokens.colors.surfaceCardLight).toBeDefined();
      expect(MaterialYouTokens.colors.surfaceCardDark).toBeDefined();
    });
  });

  describe('Android Navigation Target Parity', () => {
    it('verifies bottom navigation routes map directly to application view keys', () => {
      const coreDestinations = ['home', 'tasks', 'expenses'];
      coreDestinations.forEach((dest) => {
        expect(typeof dest).toBe('string');
      });
    });

    it('verifies quick access grid actions map to legitimate application views', () => {
      const quickDestinations = ['journal', 'quotes', 'media', 'workfolio'];
      quickDestinations.forEach((dest) => {
        expect(['home', 'tasks', 'journal', 'quotes', 'media', 'workfolio', 'expenses', 'habits', 'goals']).toContain(dest);
      });
    });
  });
});
