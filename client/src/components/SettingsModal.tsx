import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  KeyRound,
  Shield,
  Check,
  AlertTriangle,
  User,
  Laptop,
  Smartphone,
  Tablet,
  LogOut,
  RefreshCw,
  Camera,
  Eye,
  EyeOff,
  Bot,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AppSettings, AuthUser, DeviceSession } from '../types';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';
import { Storage } from '../utils/storage';
import { testGroqApiKey, SUPPORTED_GROQ_MODELS, DEFAULT_GROQ_MODEL } from '../services/groqService';
import {
  fetchAccountDevices,
  revokeDeviceSession,
} from '../utils/devices';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => boolean;
  onResetData: () => void;
  currentUser?: AuthUser | null;
  userName?: string;
  onUpdateUserName?: (newName: string) => void;
  avatarUrl?: string;
  onOpenAvatarPicker?: () => void;
  onSignOut?: () => void;
  onOpenChangePassword?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  onResetData,
  currentUser,
  userName = '',
  onUpdateUserName,
  avatarUrl,
  onOpenAvatarPicker,
  onSignOut,
  onOpenChangePassword,
}) => {
  // Master PIN state
  const [newPin, setNewPin] = useState(settings.masterPin);
  const [pinSaved, setPinSaved] = useState(false);

  // Groq API Key & Model state
  const [groqKey, setGroqKey] = useState(settings.groqApiKey || Storage.getGroqApiKey() || '');
  const [selectedModel, setSelectedModel] = useState(
    settings.groqModel || Storage.getGroqModel?.() || DEFAULT_GROQ_MODEL
  );
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqKeySaved, setGroqKeySaved] = useState(false);
  const [groqTestStatus, setGroqTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [groqTestMsg, setGroqTestMsg] = useState('');

  // Name update state
  const [displayName, setDisplayName] = useState(userName || currentUser?.name || '');
  const [nameSaved, setNameSaved] = useState(false);

  // Multi-device management state
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  // Import / Export state
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep displayName in sync when modal opens or userName updates
  useEffect(() => {
    if (userName) {
      setDisplayName(userName);
    } else if (currentUser?.name) {
      setDisplayName(currentUser.name);
    }
  }, [userName, currentUser?.name, isOpen]);

  // Load active devices whenever the modal opens
  const activeEmail = currentUser?.email || 'user@workspace.local';

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const list = await fetchAccountDevices(activeEmail);
      setDevices(list);
    } catch (err) {
      console.warn('Error loading active devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen, activeEmail]);

  if (!isOpen) return null;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayName.trim();
    if (clean && onUpdateUserName) {
      Sound.success(settings.soundEnabled);
      onUpdateUserName(clean);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    }
  };

  const executeRevoke = async (device: DeviceSession) => {
    setConfirmRevokeId(null);
    setRevokingId(device.id);
    Sound.click(settings.soundEnabled);

    try {
      const res = await revokeDeviceSession(activeEmail, device.id);
      if (res.isSelf) {
        onClose();
        if (onSignOut) onSignOut();
      } else {
        Sound.success(settings.soundEnabled);
        setDevices((prev) => prev.filter((d) => d.id !== device.id));
        setDeviceNotice(`Successfully logged out ${device.deviceName}.`);
        setTimeout(() => setDeviceNotice(null), 3000);
      }
    } catch (err) {
      console.warn('Failed to revoke device session:', err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeClick = (device: DeviceSession) => {
    setConfirmRevokeId(device.id);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length >= 4) {
      Sound.success(settings.soundEnabled);
      onUpdateSettings({ ...settings, masterPin: newPin });
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    }
  };

  const handleSaveGroqKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = groqKey.trim();
    Storage.setGroqApiKey(cleanKey);
    onUpdateSettings({ ...settings, groqApiKey: cleanKey });
    Sound.success(settings.soundEnabled);
    setGroqKeySaved(true);
    setTimeout(() => setGroqKeySaved(false), 2500);
  };

  const handleTestGroqKey = async () => {
    setGroqTestStatus('testing');
    setGroqTestMsg('Validating with Groq servers...');
    Sound.click(settings.soundEnabled);

    const res = await testGroqApiKey(groqKey);
    if (res.success) {
      Sound.success(settings.soundEnabled);
      setGroqTestStatus('success');
      setGroqTestMsg(res.message);
    } else {
      Sound.error(settings.soundEnabled);
      setGroqTestStatus('error');
      setGroqTestMsg(res.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = onImportData(content);
        if (success) {
          Sound.success(settings.soundEnabled);
          setImportStatus('success');
          setTimeout(() => {
            setImportStatus('idle');
            onClose();
          }, 1500);
        } else {
          setImportStatus('error');
        }
      }
    };
    reader.readAsText(file);
  };

  const formatLastActive = (timestamp: number, isCurrent?: boolean) => {
    if (isCurrent) return 'Active now';
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-blue-500" />;
      default:
        return <Laptop className="w-4 h-4 text-[#6366F1]" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] dark:border-[#1F2937] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8]">
              <Settings className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[#111827] dark:text-white leading-none">
                Workspace Settings &amp; Security
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Manage profile, active devices, theme, and storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* SECTION 1: PROFILE USERNAME EDIT (Consistent across whole app & portfolio) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
                Profile &amp; Display Name
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                Syncs to home page, portfolio &amp; resume
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/40 space-y-3">
              {/* Profile Photo Preview & Change Action */}
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                <div className="relative group">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] p-0.5 shadow-2xs flex items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover rounded-xl"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = STOCK_IMAGES.avatar;
                        }}
                      />
                    ) : (
                      <User className="w-6 h-6 text-[#6366F1]" />
                    )}
                  </div>
                  {onOpenAvatarPicker && (
                    <button
                      type="button"
                      onClick={onOpenAvatarPicker}
                      className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#6366F1] text-white shadow-xs hover:bg-[#4F46E5] transition-colors cursor-pointer"
                      title="Change Photo"
                    >
                      <Camera className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111827] dark:text-white">
                      Profile Picture
                    </span>
                    {onOpenAvatarPicker && (
                      <button
                        type="button"
                        onClick={onOpenAvatarPicker}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#6366F1] dark:text-[#818CF8] bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Change Photo</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                    Synchronized across all your logged-in devices in real time
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name or handle"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  {nameSaved ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{nameSaved ? 'Saved!' : 'Save Name'}</span>
                </button>
              </form>

              {nameSaved && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  Your name is updated and consistent throughout the home page, portfolio, and header!
                </p>
              )}

              {currentUser && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-800">
                  <span>Signed in account: <strong className="text-gray-700 dark:text-gray-300">{currentUser.email}</strong></span>
                  {onOpenChangePassword && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenChangePassword();
                      }}
                      className="text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Change password</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: MULTI-DEVICE SESSIONS & REMOTE LOGOUT */}
          <div className="space-y-2.5 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
                  Active Connected Devices
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Logged in on {devices.length} {devices.length === 1 ? 'device' : 'devices'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadDevices}
                  disabled={loadingDevices}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Refresh device list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDevices ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {deviceNotice && (
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>{deviceNotice}</span>
              </div>
            )}

            <div className="space-y-2">
              {devices.map((device) => {
                const isSelf = device.isCurrent;
                const isRevoking = revokingId === device.id;

                return (
                  <div
                    key={device.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelf
                        ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20'
                        : 'border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shrink-0">
                        {getDeviceIcon(device.deviceType)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                            {device.deviceName}
                          </p>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded-md bg-[#6366F1] text-white text-[10px] font-bold">
                              This Device
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatLastActive(device.lastActive, isSelf)} • {device.browser}
                        </p>
                      </div>
                    </div>

                    {/* Logout button for this device */}
                    {confirmRevokeId === device.id ? (
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
                          onClick={() => executeRevoke(device)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          {isRevoking ? 'Logging out...' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isRevoking}
                        onClick={() => handleRevokeClick(device)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                          isSelf
                            ? 'border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                        }`}
                        title={isSelf ? 'Sign out of this browser' : `Log out ${device.deviceName}`}
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

          {/* SECTION: VAULT PIN */}
          <div className="space-y-3 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
            <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
              Security &amp; Vault PIN
            </span>

            <form onSubmit={handleSavePin} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="password"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Set a vault PIN (4–8 digits)"
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                {pinSaved ? <Check className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>{pinSaved ? 'Saved' : 'Update PIN'}</span>
              </button>
            </form>
          </div>

          {/* SECTION: GROQ AI ASSISTANT API KEY */}
          <div className="space-y-3 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
                <span>AI Assistant &amp; Groq API Key</span>
              </span>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Configure your personal Groq API key (<code className="font-mono text-[11px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">gsk_...</code>) for the AI Secretary &amp; LLM Bot.
            </p>

            <form onSubmit={handleSaveGroqKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => {
                      setGroqKey(e.target.value);
                      setGroqTestStatus('idle');
                    }}
                    placeholder="Enter Groq API Key (gsk_...)"
                    className="w-full pl-3 pr-9 py-2 rounded-xl text-xs font-mono bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    title={showGroqKey ? 'Hide key' : 'Show key'}
                  >
                    {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  {groqKeySaved ? <Check className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>{groqKeySaved ? 'Saved' : 'Save Key'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestGroqKey}
                  disabled={groqTestStatus === 'testing' || !groqKey.trim()}
                  className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  title="Test key against Groq API"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{groqTestStatus === 'testing' ? 'Testing...' : 'Test'}</span>
                </button>
              </div>

              {groqTestStatus !== 'idle' && (
                <div
                  className={`text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                    groqTestStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : groqTestStatus === 'error'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  }`}
                >
                  {groqTestStatus === 'success' ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  ) : groqTestStatus === 'error' ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-indigo-600" />
                  )}
                  <span>{groqTestMsg}</span>
                </div>
              )}

              {/* Active Groq Model Selector */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    Groq LLM Model
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Production Active
                  </span>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    setSelectedModel(newModel);
                    Storage.setGroqModel(newModel);
                    onUpdateSettings({ ...settings, groqModel: newModel });
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
                >
                  {SUPPORTED_GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  Decommissioned models (e.g. Mixtral 8x7B, Llama 3 70B 8192) have been retired. All selected models support live dashboard tools and autonomous operations.
                </p>
              </div>
            </form>
          </div>

          {/* SECTION 5: BACKUP & DATA EXPORT */}
          <div className="space-y-3 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
                Storage Engine &amp; Backup
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <Shield className="w-3 h-3" />
                Cloud Realtime Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  Sound.success(settings.soundEnabled);
                  onExportData();
                }}
                className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-[#1F2937]/50 dark:hover:bg-[#1F2937] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#111827] dark:text-white">Export Full JSON</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Download offline backup</p>
                </div>
              </button>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-[#1F2937]/50 dark:hover:bg-[#1F2937] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#6366F1] dark:text-[#818CF8] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#111827] dark:text-white">Import Backup JSON</p>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Restore from file</p>
                  </div>
                </button>
              </div>
            </div>

            {importStatus === 'success' && (
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Backup successfully imported! Reloading state...
              </p>
            )}

            {importStatus === 'error' && (
              <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Invalid JSON format. Please verify the backup file.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#F3F4F6] dark:border-[#1F2937] flex items-center justify-between bg-gray-50/50 dark:bg-[#111827]/50 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to reset all dashboard data back to initial sample state?')) {
                Sound.click(settings.soundEnabled);
                onResetData();
                onClose();
              }
            }}
            className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Demo State</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
