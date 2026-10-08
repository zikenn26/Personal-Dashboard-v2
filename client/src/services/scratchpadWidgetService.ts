import { registerPlugin, Capacitor } from '@capacitor/core';

export interface ScratchPadWidgetPluginInterface {
  syncScratchpad(options: { content: string }): Promise<{ success: boolean }>;
  getScratchpad(): Promise<{ content: string }>;
  checkLaunchIntent(): Promise<{ openScratchpad: boolean; autoAdd: boolean }>;
  addListener(
    eventName: 'widgetOpenScratchpad',
    listenerFunc: (data: { openScratchpad: boolean; autoAdd: boolean }) => void
  ): Promise<any>;
}

const ScratchPadWidget = registerPlugin<ScratchPadWidgetPluginInterface>('ScratchPadWidget');

export const scratchpadWidgetService = {
  /**
   * Pushes current scratch pad content to the native Android SharedPreferences
   * and triggers an immediate AppWidgetManager update for all placed home-screen widgets.
   */
  syncToNativeWidget: async (content: string): Promise<void> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      await ScratchPadWidget.syncScratchpad({ content: content ?? '' });
    } catch (e) {
      console.warn('[ScratchPadWidget] Native sync skipped/failed:', e);
    }
  },

  /**
   * Checks if the app was launched or resumed from tapping the Android widget
   */
  checkLaunchIntent: async (): Promise<{ openScratchpad: boolean; autoAdd: boolean }> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return { openScratchpad: false, autoAdd: false };
    }
    try {
      return await ScratchPadWidget.checkLaunchIntent();
    } catch {
      return { openScratchpad: false, autoAdd: false };
    }
  },

  /**
   * Listens for runtime widget click events while the app is already in memory
   */
  setupWidgetListener: (onOpen: (autoAdd: boolean) => void): (() => void) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return () => {};
    }
    try {
      const handle = ScratchPadWidget.addListener('widgetOpenScratchpad', (data) => {
        if (data?.openScratchpad) {
          onOpen(Boolean(data.autoAdd));
        }
      });
      return () => {
        handle.then((h) => h?.remove?.()).catch(() => {});
      };
    } catch {
      return () => {};
    }
  },
};
