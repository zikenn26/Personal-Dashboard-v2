import React, { useState, useEffect, useCallback } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  LogOut,
  RefreshCw,
  Check,
  AlertCircle,
  Globe,
  Sparkles,
  Shield,
  Layers,
  Code2,
} from 'lucide-react';
import { DeviceSession } from '../types';
import {
  fetchAccountDevices,
  revokeDeviceSession,
  subscribeToDevicePresence,
  DEVICE_SESSION_ID,
} from '../utils/devices';
import { Sound } from '../utils/audio';

export interface ConnectedDevicesProps {
  email: string;
  soundEnabled?: boolean;
  onSignOut?: () => void;
}

export const ConnectedDevices: React.FC<ConnectedDevicesProps> = ({
  email,
  soundEnabled = true,
  onSignOut,
}) => {
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const activeEmail = email || 'user@workspace.local';

  const showNotice = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ type, message });
    setTimeout(() => {
      setNotice(null);
    }, 3500);
  };

  const loadDevices = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const list = await fetchAccountDevices(activeEmail);
      setDevices(list);
    } catch (err) {
      console.warn('Error loading active devices:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [activeEmail]);

  useEffect(() => {
    loadDevices();
    const unsub = subscribeToDevicePresence(activeEmail, (liveDevices) => {
      setDevices(liveDevices);
    });
    return () => {
      unsub?.();
    };
  }, [activeEmail, loadDevices]);

  const formatLastActive = (timestamp: number, isCurrent: boolean) => {
    if (isCurrent) return 'Active now';
    const diff = Math.max(0, Date.now() - timestamp);
    if (diff < 60 * 1000) return 'Active just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDeviceIcon = (type: string, isApk?: boolean) => {
    if (isApk) {
      return <Smartphone className="w-4 h-4 text-violet-500" />;
    }
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-blue-500" />;
      default:
        return <Laptop className="w-4 h-4 text-indigo-500" />;
    }
  };

  const renderEnvironmentBadge = (device: DeviceSession) => {
    const name = device.deviceName || '';

    if (device.isApk || name.includes('APK')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60">
          <Smartphone className="w-3 h-3 text-violet-500" />
          <span>Android APK</span>
        </span>
      );
    }

    if (name.includes('Cloudflare') || name.includes('pages.dev')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          <Globe className="w-3 h-3 text-amber-500" />
          <span>Web • Cloudflare</span>
        </span>
      );
    }

    if (name.includes('AI Studio') || name.includes('Preview')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          <span>AI Studio Preview</span>
        </span>
      );
    }

    if (name.includes('Localhost') || name.includes('127.0.0.1')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
          <Code2 className="w-3 h-3 text-cyan-500" />
          <span>Localhost Dev</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
        <Layers className="w-3 h-3 text-neutral-400" />
        <span>Web App</span>
      </span>
    );
  };

  const handleRevoke = async (device: DeviceSession) => {
    setConfirmRevokeId(null);
    setRevokingId(device.id);
    Sound.click(soundEnabled);

    try {
      const res = await revokeDeviceSession(activeEmail, device.id);
      if (res.isSelf) {
        if (onSignOut) onSignOut();
      } else {
        Sound.success(soundEnabled);
        setDevices((prev) => prev.filter((d) => d.id !== device.id));
        showNotice(`Logged out ${device.deviceName}.`);
      }
    } catch (err) {
      console.warn('Failed to revoke device session:', err);
      showNotice('Could not log out device. Please try again.', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOtherDevices = async () => {
    setConfirmRevokeAll(false);
    const otherDevices = devices.filter((d) => d.id !== DEVICE_SESSION_ID);
    if (otherDevices.length === 0) return;

    setLoading(true);
    Sound.click(soundEnabled);

    let count = 0;
    for (const d of otherDevices) {
      try {
        await revokeDeviceSession(activeEmail, d.id);
        count++;
      } catch (e) {
        console.warn('Error revoking device', d.id, e);
      }
    }

    setDevices((prev) => prev.filter((d) => d.id === DEVICE_SESSION_ID));
    setLoading(false);
    Sound.success(soundEnabled);
    showNotice(`Successfully signed out ${count} remote device${count === 1 ? '' : 's'}.`);
  };

  const otherDevicesCount = devices.filter((d) => d.id !== DEVICE_SESSION_ID).length;

  return (
    <div className="space-y-3 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
            Active Connected Devices
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {devices.length} {devices.length === 1 ? 'instance' : 'instances'} online
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {otherDevicesCount > 0 && (
            confirmRevokeAll ? (
              <div className="flex items-center gap-1 animate-in fade-in">
                <button
                  type="button"
                  onClick={() => setConfirmRevokeAll(false)}
                  className="px-2 py-0.5 text-[10px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeAllOtherDevices}
                  className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md cursor-pointer"
                >
                  Confirm Sign Out All Others
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRevokeAll(true)}
                className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                title="Sign out of all other devices"
              >
                Sign out all others
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => loadDevices(false)}
            disabled={loading}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Refresh device list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            notice.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
              : 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300'
          }`}
        >
          {notice.type === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Check className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Device List Cards */}
      <div className="space-y-2">
        {devices.map((device) => {
          const isSelf = device.isCurrent || device.id === DEVICE_SESSION_ID;
          const isRevoking = revokingId === device.id;
          const isConfirming = confirmRevokeId === device.id;

          return (
            <div
              key={device.id}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isSelf
                  ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-2xs'
                  : 'border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/40 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shrink-0">
                  {getDeviceIcon(device.deviceType, device.isApk)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                      {device.deviceName}
                    </p>

                    {renderEnvironmentBadge(device)}

                    {isSelf && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#6366F1] text-white text-[10px] font-bold">
                        <Shield className="w-2.5 h-2.5" />
                        <span>This Device</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{formatLastActive(device.lastActive, isSelf)}</span>
                    <span>•</span>
                    <span>{device.browser}</span>
                    <span>•</span>
                    <span>{device.os}</span>
                  </p>
                </div>
              </div>

              {/* Logout Action */}
              {isConfirming ? (
                <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in">
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(null)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isRevoking}
                    onClick={() => handleRevoke(device)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    {isRevoking ? 'Logging out...' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={() => {
                    if (isSelf) {
                      if (confirm('Are you sure you want to sign out of this current session?')) {
                        handleRevoke(device);
                      }
                    } else {
                      setConfirmRevokeId(device.id);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    isSelf
                      ? 'border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                  }`}
                  title={isSelf ? 'Sign out of this session' : `Log out ${device.deviceName}`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isRevoking ? 'Logging out...' : isSelf ? 'Sign out' : 'Log Out'}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
