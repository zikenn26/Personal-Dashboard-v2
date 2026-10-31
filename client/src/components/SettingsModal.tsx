import React, { useState, useEffect } from 'react';
import {
  Settings,
  RotateCcw,
  KeyRound,
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
  Sparkle,
  Sparkles,
  ExternalLink,
  Cloud,
  CloudOff,
  WifiOff,
} from 'lucide-react';
import { AppSettings, AuthUser } from '../types';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';
import { UserAvatar } from './UserAvatar';
import { Storage } from '../utils/storage';
import { testGroqApiKey, SUPPORTED_GROQ_MODELS, DEFAULT_GROQ_MODEL } from '../services/groqService';
import { testGeminiApiKey } from '../services/geminiService';
import { ConnectedDevices } from './ConnectedDevices';

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
  onOpenCommandMappings?: () => void;
  onOpenSmsSettings?: () => void;
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
  onOpenCommandMappings,
  onOpenSmsSettings: _onOpenSmsSettings,
}) => {
  // Master PIN state
  const [newPin, setNewPin] = useState(settings.masterPin);
  const [pinSaved, setPinSaved] = useState(false);

  // Gemini API Key state
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || Storage.getGeminiApiKey() || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiTestMsg, setGeminiTestMsg] = useState('');

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



  // Keep displayName in sync when modal opens or userName updates
  useEffect(() => {
    if (userName) {
      setDisplayName(userName);
    } else if (currentUser?.name) {
      setDisplayName(currentUser.name);
    }
    if (isOpen) {
      setShowGeminiKey(false);
      setShowGroqKey(false);
      setGeminiKey(settings.geminiApiKey || Storage.getGeminiApiKey() || '');
      setGroqKey(settings.groqApiKey || Storage.getGroqApiKey() || '');
    }
  }, [userName, currentUser?.name, isOpen, settings.geminiApiKey, settings.groqApiKey]);

  // Active account email for connected devices and workspace syncing
  const activeEmail = currentUser?.email || 'user@workspace.local';

  if (!isOpen) return null;

  const handleSaveName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = displayName.trim();
    if (clean && onUpdateUserName) {
      Sound.success(settings.soundEnabled);
      onUpdateUserName(clean);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    }
  };

  const handleDone = () => {
    const clean = displayName.trim();
    if (clean && clean !== userName && onUpdateUserName) {
      onUpdateUserName(clean);
    }
    onClose();
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

  const handleSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = geminiKey.trim();

    if (!cleanKey) {
      Storage.setGeminiApiKey('');
      onUpdateSettings({ ...settings, geminiApiKey: '' });
      Sound.click(settings.soundEnabled);
      setGeminiKeySaved(true);
      setGeminiTestStatus('idle');
      setGeminiTestMsg('');
      setTimeout(() => setGeminiKeySaved(false), 2500);
      return;
    }

    setGeminiTestStatus('testing');
    setGeminiTestMsg('Pinging Google Gemini endpoint to validate key...');
    Sound.click(settings.soundEnabled);

    try {
      const res = await testGeminiApiKey(cleanKey);
      if (res.success) {
        Storage.setGeminiApiKey(cleanKey);
        onUpdateSettings({ ...settings, geminiApiKey: cleanKey });
        Sound.success(settings.soundEnabled);
        setGeminiKeySaved(true);
        setGeminiTestStatus('success');
        setGeminiTestMsg(res.message);
        setTimeout(() => setGeminiKeySaved(false), 2500);
      } else {
        Sound.error(settings.soundEnabled);
        setGeminiTestStatus('error');
        setGeminiTestMsg(res.message);
      }
    } catch (err: any) {
      Sound.error(settings.soundEnabled);
      setGeminiTestStatus('error');
      setGeminiTestMsg(err?.message || 'Failed to validate Gemini key.');
    }
  };

  const handleTestGeminiKey = async () => {
    setGeminiTestStatus('testing');
    setGeminiTestMsg('Validating with Google Gemini models...');
    Sound.click(settings.soundEnabled);

    const res = await testGeminiApiKey(geminiKey);
    if (res.success) {
      Sound.success(settings.soundEnabled);
      setGeminiTestStatus('success');
      setGeminiTestMsg(res.message);
    } else {
      Sound.error(settings.soundEnabled);
      setGeminiTestStatus('error');
      setGeminiTestMsg(res.message);
    }
  };

  const handleSaveGroqKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = groqKey.trim();

    if (!cleanKey) {
      Storage.setGroqApiKey('');
      onUpdateSettings({ ...settings, groqApiKey: '' });
      Sound.click(settings.soundEnabled);
      setGroqKeySaved(true);
      setGroqTestStatus('idle');
      setGroqTestMsg('');
      setTimeout(() => setGroqKeySaved(false), 2500);
      return;
    }

    setGroqTestStatus('testing');
    setGroqTestMsg('Pinging Groq AI endpoint to validate key...');
    Sound.click(settings.soundEnabled);

    try {
      const res = await testGroqApiKey(cleanKey);
      if (res.success) {
        Storage.setGroqApiKey(cleanKey);
        onUpdateSettings({ ...settings, groqApiKey: cleanKey });
        Sound.success(settings.soundEnabled);
        setGroqKeySaved(true);
        setGroqTestStatus('success');
        setGroqTestMsg(res.message);
        setTimeout(() => setGroqKeySaved(false), 2500);
      } else {
        Sound.error(settings.soundEnabled);
        setGroqTestStatus('error');
        setGroqTestMsg(res.message);
      }
    } catch (err: any) {
      Sound.error(settings.soundEnabled);
      setGroqTestStatus('error');
      setGroqTestMsg(err?.message || 'Failed to validate Groq key.');
    }
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
                Settings &amp; Profile
              </h3>
            </div>
          </div>
          <button
            onClick={handleDone}
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* SECTION 1: PROFILE USERNAME EDIT */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
                Profile &amp; Display Name
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/40 space-y-3">
              {/* Profile Photo Preview & Change Action */}
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                <div className="relative group">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] p-0.5 shadow-2xs flex items-center justify-center">
                    <UserAvatar
                      avatarUrl={avatarUrl}
                      name={userName}
                      userEmail={activeEmail}
                      size="lg"
                      className="w-full h-full rounded-xl"
                    />
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
                  <span>Name updated successfully</span>
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
          <ConnectedDevices
            email={activeEmail}
            soundEnabled={settings.soundEnabled}
            onSignOut={() => {
              onClose();
              if (onSignOut) onSignOut();
            }}
          />

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

          {/* SECTION: GOOGLE GEMINI API KEY */}
          <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Google Gemini API</span>
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Get Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <form onSubmit={handleSaveGeminiKey} className="space-y-2">
              <div className="relative flex items-center w-full">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    setGeminiTestStatus('idle');
                  }}
                  placeholder="Enter Gemini Key (AIzaSy...)"
                  className="w-full pl-3 pr-10 py-1.5 rounded-lg text-xs font-mono bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  title={showGeminiKey ? 'Hide key' : 'Show key'}
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5 text-blue-500" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {geminiTestStatus !== 'idle' && (
                <div
                  className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 leading-snug border ${
                    geminiTestStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : geminiTestStatus === 'error'
                      ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {geminiTestStatus === 'success' ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  ) : geminiTestStatus === 'error' ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-blue-600" />
                  )}
                  <span className="break-all">{geminiTestMsg}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={geminiTestStatus === 'testing'}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {geminiTestStatus === 'testing' ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>{geminiKey.trim() ? 'Validate & Save' : 'Clear Key'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* SECTION: GROQ AI API KEY */}
          <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Sparkle className="w-3.5 h-3.5 text-indigo-500" />
                <span>Groq AI API</span>
              </span>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Get Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <form onSubmit={handleSaveGroqKey} className="space-y-2">
              <div className="relative flex items-center w-full">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    setGroqTestStatus('idle');
                  }}
                  placeholder="Enter Groq Key (gsk_...)"
                  className="w-full pl-3 pr-10 py-1.5 rounded-lg text-xs font-mono bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  title={showGroqKey ? 'Hide key' : 'Show key'}
                >
                  {showGroqKey ? <EyeOff className="w-3.5 h-3.5 text-indigo-500" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Active Groq Model Selector */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium text-gray-500 shrink-0">Model:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    setSelectedModel(newModel);
                    Storage.setGroqModel(newModel);
                    onUpdateSettings({ ...settings, groqModel: newModel });
                  }}
                  className="w-full px-2 py-1 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {groqTestStatus !== 'idle' && (
                <div
                  className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 leading-snug border ${
                    groqTestStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : groqTestStatus === 'error'
                      ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  }`}
                >
                  {groqTestStatus === 'success' ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  ) : groqTestStatus === 'error' ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-indigo-600" />
                  )}
                  <span className="break-all">{groqTestMsg}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={groqTestStatus === 'testing'}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {groqTestStatus === 'testing' ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>{groqKey.trim() ? 'Validate & Save' : 'Clear Key'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
            onClick={handleDone}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
