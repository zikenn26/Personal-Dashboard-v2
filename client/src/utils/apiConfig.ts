import { Capacitor } from '@capacitor/core';

// Cloudflare Pages live production backend URL
export const CLOUD_BACKEND_URL =
  (import.meta as any).env?.VITE_API_URL ||
  'https://personal-dashboard-3ag.pages.dev';

/**
 * Returns the base URL for backend API requests.
 * - In Web Browser and Android Chrome: returns '' so requests use same-origin relative paths.
 * - In Native Android APK (Capacitor on https://localhost): returns the public Cloud backend URL
 *   so network calls reach the live server rather than failing on localhost.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  try {
    const custom = localStorage.getItem('lifeos_server_api_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage errors
  }

  const isNative = Capacitor.isNativePlatform();
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // In native Android APK or native WebView without a local port, target the live Cloud backend
  if (isNative || (isLocalhost && !window.location.port)) {
    return CLOUD_BACKEND_URL;
  }

  return '';
}
