import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Check,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Cpu,
  Trash2,
  Loader2,
  Lock,
} from 'lucide-react';
import { Storage } from '../utils/storage';
import { Sound } from '../utils/audio';
import { testGroqApiKey, SUPPORTED_GROQ_MODELS, DEFAULT_GROQ_MODEL } from '../services/groqService';
import { testGeminiApiKey } from '../services/geminiService';
import { AuthUser, UserProfile, AppSettings } from '../types';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AuthUser | null;
  profile?: UserProfile;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  // Gemini State
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiMsg, setGeminiMsg] = useState('');

  // Groq State
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqStatus, setGroqStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [groqMsg, setGroqMsg] = useState('');

  // Saving All State
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync state on modal open
  useEffect(() => {
    if (isOpen) {
      const activeGemini = Storage.getGeminiApiKey();
      const activeGroq = Storage.getGroqApiKey();
      const activeModel = Storage.getGroqModel?.() || settings.groqModel || DEFAULT_GROQ_MODEL;

      setGeminiKey(activeGemini || '');
      setGroqKey(activeGroq || '');
      setGroqModel(activeModel);

      setShowGeminiKey(false);
      setShowGroqKey(false);

      setGeminiStatus('idle');
      setGeminiMsg('');
      setGroqStatus('idle');
      setGroqMsg('');
      setBanner(null);
      setIsSavingAll(false);
    }
  }, [isOpen, settings.groqModel]);

  if (!isOpen) return null;

  const isGeminiConfigured = Boolean(Storage.getGeminiApiKey());
  const isGroqConfigured = Boolean(Storage.getGroqApiKey());

  // 1. Validate & Save Gemini Key
  const handleSaveGemini = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = geminiKey.trim();

    if (!cleanKey) {
      Storage.setGeminiApiKey('');
      onUpdateSettings({ ...settings, geminiApiKey: '' });
      setGeminiStatus('idle');
      setGeminiMsg('');
      setBanner({ type: 'success', message: 'Gemini API key removed.' });
      Sound.click(settings.soundEnabled);
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    setGeminiStatus('testing');
    setGeminiMsg('Pinging Gemini endpoint...');
    Sound.click(settings.soundEnabled);

    try {
      const res = await testGeminiApiKey(cleanKey);
      if (res.success) {
        Storage.setGeminiApiKey(cleanKey);
        onUpdateSettings({ ...settings, geminiApiKey: cleanKey });
        setGeminiStatus('success');
        setGeminiMsg(res.message || 'Key verified and active!');
        setBanner({ type: 'success', message: 'Gemini API key validated and saved.' });
        Sound.success(settings.soundEnabled);
        setTimeout(() => setBanner(null), 3500);
      } else {
        setGeminiStatus('error');
        setGeminiMsg(res.message || 'Validation failed. Key was not saved.');
        setBanner({ type: 'error', message: 'Gemini validation failed. Check your key.' });
        Sound.error(settings.soundEnabled);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to connect to Google Gemini endpoint.';
      setGeminiStatus('error');
      setGeminiMsg(msg);
      setBanner({ type: 'error', message: msg });
      Sound.error(settings.soundEnabled);
    }
  };

  // 2. Validate & Save Groq Key
  const handleSaveGroq = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = groqKey.trim();

    if (!cleanKey) {
      Storage.setGroqApiKey('');
      Storage.setGroqModel(groqModel);
      onUpdateSettings({ ...settings, groqApiKey: '', groqModel });
      setGroqStatus('idle');
      setGroqMsg('');
      setBanner({ type: 'success', message: 'Groq API key removed.' });
      Sound.click(settings.soundEnabled);
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    setGroqStatus('testing');
    setGroqMsg('Pinging Groq cloud endpoint...');
    Sound.click(settings.soundEnabled);

    try {
      const res = await testGroqApiKey(cleanKey);
      if (res.success) {
        Storage.setGroqApiKey(cleanKey);
        Storage.setGroqModel(groqModel);
        onUpdateSettings({ ...settings, groqApiKey: cleanKey, groqModel });
        setGroqStatus('success');
        setGroqMsg(res.message || 'Groq connection verified!');
        setBanner({ type: 'success', message: 'Groq API key validated and saved.' });
        Sound.success(settings.soundEnabled);
        setTimeout(() => setBanner(null), 3500);
      } else {
        setGroqStatus('error');
        setGroqMsg(res.message || 'Invalid Groq key. Key was not saved.');
        setBanner({ type: 'error', message: 'Groq validation failed. Check your key.' });
        Sound.error(settings.soundEnabled);
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error while validating with Groq.';
      setGroqStatus('error');
      setGroqMsg(msg);
      setBanner({ type: 'error', message: msg });
      Sound.error(settings.soundEnabled);
    }
  };

  // 3. Save All with Pings
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    Sound.click(settings.soundEnabled);

    const cleanGemini = geminiKey.trim();
    const cleanGroq = groqKey.trim();

    let geminiOk = true;
    let groqOk = true;
    const errors: string[] = [];

    // Test Gemini if provided
    if (cleanGemini) {
      setGeminiStatus('testing');
      setGeminiMsg('Validating Gemini key...');
      try {
        const res = await testGeminiApiKey(cleanGemini);
        if (res.success) {
          Storage.setGeminiApiKey(cleanGemini);
          setGeminiStatus('success');
          setGeminiMsg(res.message);
        } else {
          geminiOk = false;
          setGeminiStatus('error');
          setGeminiMsg(res.message);
          errors.push('Gemini failed');
        }
      } catch {
        geminiOk = false;
        setGeminiStatus('error');
        errors.push('Gemini error');
      }
    } else {
      Storage.setGeminiApiKey('');
      setGeminiStatus('idle');
      setGeminiMsg('');
    }

    // Test Groq if provided
    if (cleanGroq) {
      setGroqStatus('testing');
      setGroqMsg('Validating Groq key...');
      try {
        const res = await testGroqApiKey(cleanGroq);
        if (res.success) {
          Storage.setGroqApiKey(cleanGroq);
          Storage.setGroqModel(groqModel);
          setGroqStatus('success');
          setGroqMsg(res.message);
        } else {
          groqOk = false;
          setGroqStatus('error');
          setGroqMsg(res.message);
          errors.push('Groq failed');
        }
      } catch {
        groqOk = false;
        setGroqStatus('error');
        errors.push('Groq error');
      }
    } else {
      Storage.setGroqApiKey('');
      Storage.setGroqModel(groqModel);
      setGroqStatus('idle');
      setGroqMsg('');
    }

    onUpdateSettings({
      ...settings,
      geminiApiKey: geminiOk ? cleanGemini : settings.geminiApiKey,
      groqApiKey: groqOk ? cleanGroq : settings.groqApiKey,
      groqModel,
    });

    setIsSavingAll(false);

    if (geminiOk && groqOk) {
      Sound.success(settings.soundEnabled);
      setBanner({ type: 'success', message: 'API keys validated and saved!' });
    } else {
      Sound.error(settings.soundEnabled);
      setBanner({ type: 'error', message: `Validation issue: ${errors.join(', ')}` });
    }
    setTimeout(() => setBanner(null), 4000);
  };

  return (
    <div
      id="api-key-settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="api-key-settings-modal-card"
        className="relative w-full max-w-md bg-white dark:bg-[#18181B] rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              AI API Keys
            </h2>
          </div>
          <button
            id="close-api-key-settings-btn"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Compact Body - Fixed mobile overflow */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {banner && (
            <div
              className={`p-2.5 rounded-xl flex items-center gap-2 text-xs font-medium border ${
                banner.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}
            >
              {banner.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="leading-tight">{banner.message}</span>
            </div>
          )}

          {/* 1. Google Gemini Section */}
          <div className="p-3.5 rounded-xl bg-gray-50/90 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Google Gemini
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                    isGeminiConfigured
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-200/80 dark:bg-zinc-800 text-gray-500'
                  }`}
                >
                  {isGeminiConfigured ? 'Active' : 'Not set'}
                </span>
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Get Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <form onSubmit={handleSaveGemini} className="space-y-2">
              <div className="relative flex items-center w-full">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    setGeminiStatus('idle');
                    setGeminiMsg('');
                  }}
                  placeholder="Enter Gemini Key (AIzaSy...)"
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3 pr-14 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:ring-1.5 focus:ring-blue-500"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  {geminiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setGeminiKey('');
                        setGeminiStatus('idle');
                        setGeminiMsg('');
                      }}
                      className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    {showGeminiKey ? <EyeOff className="w-3 h-3 text-blue-500" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {geminiMsg && (
                <div
                  className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 border leading-tight ${
                    geminiStatus === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : geminiStatus === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {geminiStatus === 'testing' && <Loader2 className="w-3 h-3 animate-spin shrink-0 mt-0.5 text-blue-600" />}
                  {geminiStatus === 'success' && <Check className="w-3 h-3 shrink-0 mt-0.5 text-emerald-600" />}
                  {geminiStatus === 'error' && <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-rose-600" />}
                  <span className="break-all">{geminiMsg}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={geminiStatus === 'testing'}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {geminiStatus === 'testing' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
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

          {/* 2. Groq Section */}
          <div className="p-3.5 rounded-xl bg-gray-50/90 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Groq AI
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                    isGroqConfigured
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-200/80 dark:bg-zinc-800 text-gray-500'
                  }`}
                >
                  {isGroqConfigured ? 'Active' : 'Not set'}
                </span>
              </div>

              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Get Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <form onSubmit={handleSaveGroq} className="space-y-2">
              <div className="relative flex items-center w-full">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    setGroqStatus('idle');
                    setGroqMsg('');
                  }}
                  placeholder="Enter Groq Key (gsk_...)"
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3 pr-14 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:ring-1.5 focus:ring-orange-500"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  {groqKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroqKey('');
                        setGroqStatus('idle');
                        setGroqMsg('');
                      }}
                      className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    {showGroqKey ? <EyeOff className="w-3 h-3 text-orange-500" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-gray-500 shrink-0">Model:</label>
                <select
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs focus:outline-none"
                >
                  {SUPPORTED_GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {groqMsg && (
                <div
                  className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 border leading-tight ${
                    groqStatus === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : groqStatus === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                  }`}
                >
                  {groqStatus === 'testing' && <Loader2 className="w-3 h-3 animate-spin shrink-0 mt-0.5 text-orange-600" />}
                  {groqStatus === 'success' && <Check className="w-3 h-3 shrink-0 mt-0.5 text-emerald-600" />}
                  {groqStatus === 'error' && <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-rose-600" />}
                  <span className="break-all">{groqMsg}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={groqStatus === 'testing'}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {groqStatus === 'testing' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
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

        {/* Compact Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">Stored securely locally</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSavingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save All</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
