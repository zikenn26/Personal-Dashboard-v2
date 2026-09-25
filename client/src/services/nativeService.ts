import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Share } from '@capacitor/share';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';

export type HapticFeedbackType =
  | 'click'
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'success'
  | 'warning'
  | 'error';

class NativeService {
  private isNative: boolean;
  private isAndroidPlatform: boolean;
  private backButtonListeners: Array<() => boolean> = [];

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isAndroidPlatform = Capacitor.getPlatform() === 'android';
  }

  /**
   * Check if running inside native Android/Capacitor container
   */
  public isNativeDevice(): boolean {
    return this.isNative;
  }

  public isAndroid(): boolean {
    return this.isAndroidPlatform;
  }

  /**
   * Safe Haptic feedback with web fallback
   */
  public async triggerHaptic(type: HapticFeedbackType = 'click'): Promise<void> {
    try {
      if (this.isNative) {
        switch (type) {
          case 'click':
          case 'selection':
            await Haptics.selectionStart();
            break;
          case 'impactLight':
            await Haptics.impact({ style: ImpactStyle.Light });
            break;
          case 'impactMedium':
            await Haptics.impact({ style: ImpactStyle.Medium });
            break;
          case 'impactHeavy':
            await Haptics.impact({ style: ImpactStyle.Heavy });
            break;
          case 'success':
            await Haptics.notification({ type: NotificationType.Success });
            break;
          case 'warning':
            await Haptics.notification({ type: NotificationType.Warning });
            break;
          case 'error':
            await Haptics.notification({ type: NotificationType.Error });
            break;
        }
      } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        // Fallback for supported mobile web browsers
        if (type === 'click' || type === 'selection') {
          navigator.vibrate(10);
        } else if (type === 'success') {
          navigator.vibrate([15, 30, 20]);
        } else if (type === 'error' || type === 'warning') {
          navigator.vibrate([30, 40, 30]);
        } else {
          navigator.vibrate(20);
        }
      }
    } catch {
      // Gracefully ignore haptic failures if unsupported or blocked by permissions
    }
  }

  /**
   * Synchronize the native status bar with the app theme
   */
  public async updateThemeStatusBar(isDark: boolean): Promise<void> {
    if (!this.isNative) return;
    try {
      await StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light,
      });
      await StatusBar.setBackgroundColor({
        color: isDark ? '#090A0F' : '#F9FAFB',
      });
    } catch {
      // Ignored if platform doesn't support setting status bar color
    }
  }

  /**
   * Hide native splash screen once React UI has initialized
   */
  public async hideSplashScreen(): Promise<void> {
    if (!this.isNative) return;
    try {
      await SplashScreen.hide();
    } catch {
      // Ignored
    }
  }

  /**
   * Native Share with fallback to Web Share or Clipboard
   */
  public async shareContent(options: {
    title?: string;
    text?: string;
    url?: string;
    dialogTitle?: string;
  }): Promise<boolean> {
    try {
      if (this.isNative) {
        await Share.share(options);
        return true;
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url,
        });
        return true;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && options.url) {
        await navigator.clipboard.writeText(options.url);
        return true;
      }
    } catch {
      // User cancelled share or unsupported
    }
    return false;
  }

  /**
   * Register a hardware back button handler for Android.
   * Return `true` from your callback if you handled the back event (e.g. closed a modal).
   * Return `false` or void to let the previous handler or default action take over.
   */
  public registerBackButtonHandler(handler: () => boolean): () => void {
    this.backButtonListeners.push(handler);
    return () => {
      this.backButtonListeners = this.backButtonListeners.filter((h) => h !== handler);
    };
  }

  /**
   * Initialize native features on app start
   */
  public init(): void {
    if (!this.isNative) return;

    // Listen for hardware back button on Android
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // Call handlers in reverse order (top-most modal or active view first)
      for (let i = this.backButtonListeners.length - 1; i >= 0; i--) {
        const handled = this.backButtonListeners[i]();
        if (handled) {
          return;
        }
      }

      // If no custom handlers intercepted, check if browser history can go back
      if (canGoBack) {
        window.history.back();
      } else {
        // Exit or minimize app if on root
        CapApp.exitApp();
      }
    });

    // Mobile keyboard scroll assistance
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.classList.add('keyboard-visible');
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`
      );
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--keyboard-height');
    });

    // Network status listener
    Network.addListener('networkStatusChange', (status) => {
      window.dispatchEvent(
        new CustomEvent('networkStatusChange', { detail: status })
      );
    });
  }

  /**
   * Check runtime location permission status without prompting.
   * Returns 'prompt' | 'granted' | 'denied'.
   */
  public async checkLocationPermission(): Promise<'prompt' | 'granted' | 'denied'> {
    if (this.isNative) {
      try {
        const checkStatus = await Geolocation.checkPermissions();
        if (checkStatus.location === 'granted' || checkStatus.coarseLocation === 'granted') {
          return 'granted';
        }
        if (checkStatus.location === 'denied' && checkStatus.coarseLocation === 'denied') {
          return 'denied';
        }
        return 'prompt';
      } catch {
        return 'prompt';
      }
    }

    // Web Permissions API query
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' as any });
        if (p.state === 'granted') return 'granted';
        if (p.state === 'denied') return 'denied';
        return 'prompt';
      } catch {
        return 'prompt';
      }
    }
    return 'prompt';
  }

  /**
   * Request native Android runtime location permission and obtain actual device GPS position.
   * If permission is denied, throws an Error with code 1 / PERMISSION_DENIED.
   */
  public async requestLocationAndGetPosition(): Promise<{ latitude: number; longitude: number }> {
    if (this.isNative) {
      try {
        const checkStatus = await Geolocation.checkPermissions();
        if (checkStatus.location !== 'granted' && checkStatus.coarseLocation !== 'granted') {
          // Trigger the Android runtime OS permission dialog
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
            const err = new Error('PERMISSION_DENIED');
            (err as any).code = 1;
            throw err;
          }
        }

        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 120000,
        });

        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
      } catch (err: any) {
        if (
          err?.message === 'PERMISSION_DENIED' ||
          err?.code === 1 ||
          (typeof err?.message === 'string' && err.message.toLowerCase().includes('denied'))
        ) {
          const deniedErr = new Error('PERMISSION_DENIED');
          (deniedErr as any).code = 1;
          throw deniedErr;
        }
        // Fallback to browser geolocation below if native plugin threw a non-denial error
      }
    }

    // Web fallback for mobile browser preview or web environment
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const err = new Error('GEOLOCATION_UNAVAILABLE');
        (err as any).code = 2;
        reject(err);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
      );
    });
  }
}

export const nativeService = new NativeService();
