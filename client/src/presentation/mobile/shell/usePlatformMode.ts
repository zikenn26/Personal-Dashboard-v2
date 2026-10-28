import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export type PlatformUIMode = 'auto' | 'android' | 'desktop';

/**
 * Hook to determine whether to render Android-first UI or Desktop UI.
 * 
 * Rules:
 * - On Native Capacitor Android/iOS builds: Always Android-first UI (unless explicitly overridden)
 * - On Web Browser:
 *   - Screen width < 768px (mobile viewport): Android-first UI
 *   - Screen width >= 768px (desktop viewport): Original Desktop UI
 *   - User can also toggle via localStorage('lifeos_ui_mode')
 */
export function usePlatformMode() {
  const [uiMode, setUiMode] = useState<PlatformUIMode>(() => {
    try {
      const saved = localStorage.getItem('lifeos_ui_mode') as PlatformUIMode;
      return saved || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNative = Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android';

  const isAndroidView = (() => {
    if (uiMode === 'android') return true;
    if (uiMode === 'desktop') return false;
    // 'auto' mode
    return isNative || isMobileViewport;
  })();

  const setMode = (mode: PlatformUIMode) => {
    setUiMode(mode);
    try {
      localStorage.setItem('lifeos_ui_mode', mode);
    } catch {}
  };

  return {
    isAndroidView,
    uiMode,
    setMode,
    isNative,
    isMobileViewport,
  };
}
