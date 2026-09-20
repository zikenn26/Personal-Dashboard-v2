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
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Storage } from '../utils/storage';
import { Sound } from '../utils/audio';
import { testGroqApiKey, SUPPORTED_GROQ_MODELS, DEFAULT_GROQ_MODEL } from '../services/groqService';
import { testGeminiApiKey } from '../services/geminiService';
import { AuthUser, UserProfile, AppSettings, ApiMonthlyStats } from '../types';

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
  currentUser,
  profile,
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

  // General Notification Banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Monthly Usage Stats (compact indicator)
  const [monthlyStats, setMonthlyStats] = useState<ApiMonthlyStats>(() =>
    Storage.getApiRequestCountsThisMonth()
  );

  // Sync state on modal open
  useEffect(() => {
    if (isOpen) {
      const activeGemini = Storage.getGeminiApiKey();
      const activeGroq = Storage.getGroqApiKey();
      const activeModel = Storage.getGroqModel?.() || settings.groqModel || DEFAULT_GROQ_MODEL;

      setGeminiKey(activeGemini || '');
      setGroqKey(activeGroq || '');
      setGroqModel(activeModel);

      // Mask keys by default for security
      setShowGeminiKey(false);
      setShowGroqKey(false);

      setGeminiStatus('idle');
      setGeminiMsg('');
      setGroqStatus('idle');
      setGroqMsg('');
      setBanner(null);
      setIsSavingAll(false);

      setMonthlyStats(Storage.getApiRequestCountsThisMonth());
    }
  }, [isOpen, currentUser?.id, settings.groqModel]);

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
      setBanner({ type: 'success', message: 'Google Gemini key removed.' });
      Sound.click(settings.soundEnabled);
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    setGeminiStatus('testing');
    setGeminiMsg('Pinging Google Gemini endpoint to validate key...');
    Sound.click(settings.soundEnabled);

    try {
      const res = await testGeminiApiKey(cleanKey);
      if (res.success) {
        Storage.setGeminiApiKey(cleanKey);
        onUpdateSettings({ ...settings, geminiApiKey: cleanKey });
        setGeminiStatus('success');
        setGeminiMsg(res.message || 'Key verified and active! Saved successfully.');
        setBanner({ type: 'success', message: 'Google Gemini API key validated and saved.' });
        Sound.success(settings.soundEnabled);
        setMonthlyStats(Storage.getApiRequestCountsThisMonth());
        setTimeout(() => setBanner(null), 3500);
      } else {
        setGeminiStatus('error');
        setGeminiMsg(res.message || 'Validation failed. Key was not saved.');
        setBanner({ type: 'error', message: 'Gemini key validation failed. Please check your key.' });
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
      setBanner({ type: 'success', message: 'Groq AI key removed.' });
      Sound.click(settings.soundEnabled);
      setTimeout(() => setBanner(null), 3000);
      return;
    }

    setGroqStatus('testing');
    setGroqMsg('Pinging Groq AI endpoint to validate key...');
    Sound.click(settings.soundEnabled);

    try {
      const res = await testGroqApiKey(cleanKey);
      if (res.success) {
        Storage.setGroqApiKey(cleanKey);
        Storage.setGroqModel(groqModel);
        onUpdateSettings({ ...settings, groqApiKey: cleanKey, groqModel });
        setGroqStatus('success');
        setGroqMsg(res.message || 'Key verified and active! Saved successfully.');
        setBanner({ type: 'success', message: 'Groq AI API key validated and saved.' });
        Sound.success(settings.soundEnabled);
        setMonthlyStats(Storage.getApiRequestCountsThisMonth());
        setTimeout(() => setBanner(null), 3500);
      } else {
        setGroqStatus('error');
        setGroqMsg(res.message || 'Validation failed. Key was not saved.');
        setBanner({ type: 'error', message: 'Groq key validation failed. Please check your key.' });
        Sound.error(settings.soundEnabled);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to connect to Groq endpoint.';
      setGroqStatus('error');
      setGroqMsg(msg);
      setBanner({ type: 'error', message: msg });
      Sound.error(settings.soundEnabled);
    }
  };

  // 3. Save All & Validate Both Keys
  const handleSaveAll = async () => {
    const cleanGemini = geminiKey.trim();
    const cleanGroq = groqKey.trim();
    setIsSavingAll(true);
    Sound.click(settings.soundEnabled);

    let geminiOk = true;
    let groqOk = true;
    const errors: string[] = [];

    // Validate Gemini if entered
    if (cleanGemini) {
      setGeminiStatus('testing');
      setGeminiMsg('Validating Gemini key...');
      try {
        const res = await testGeminiApiKey(cleanGemini);
        if (res.success) {
          Storage.setGeminiApiKey(cleanGemini);
          setGeminiStatus('success');
          setGeminiMsg(res.message || 'Key verified & saved.');
        } else {
          geminiOk = false;
          setGeminiStatus('error');
          setGeminiMsg(res.message || 'Validation failed.');
          errors.push('Gemini key is invalid');
        }
      } catch (e: any) {
        geminiOk = false;
        setGeminiStatus('error');
        setGeminiMsg(e?.message || 'Validation error');
        errors.push('Gemini connection error');
      }
    } else {
      Storage.setGeminiApiKey('');
      setGeminiStatus('idle');
      setGeminiMsg('');
    }

    // Validate Groq if entered
    if (cleanGroq) {
      setGroqStatus('testing');
      setGroqMsg('Validating Groq key...');
      try {
        const res = await testGroqApiKey(cleanGroq);
        if (res.success) {
          Storage.setGroqApiKey(cleanGroq);
          Storage.setGroqModel(groqModel);
          setGroqStatus('success');
          setGroqMsg(res.message || 'Key verified & saved.');
        } else {
          groqOk = false;
          setGroqStatus('error');
          setGroqMsg(res.message || 'Validation failed.');
          errors.push('Groq key is invalid');
        }
      } catch (e: any) {
        groqOk = false;
        setGroqStatus('error');
        setGroqMsg(e?.message || 'Validation error');
        errors.push('Groq connection error');
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

    setMonthlyStats(Storage.getApiRequestCountsThisMonth());
    setIsSavingAll(false);

    if (geminiOk && groqOk) {
      Sound.success(settings.soundEnabled);
      setBanner({ type: 'success', message: 'API keys validated and saved successfully!' });
    } else {
      Sound.error(settings.soundEnabled);
      setBanner({ type: 'error', message: `Validation failed: ${errors.join(', ')}. Key not saved.` });
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
        className="relative w-full max-w-lg bg-white dark:bg-[#18181B] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                AI API Keys
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Validated before saving to guarantee active status
              </p>
            </div>
          </div>
          <button
            id="close-api-key-settings-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Compact Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
          {/* Notification Banner */}
          {banner && (
            <div
              className={`p-2.5 rounded-xl flex items-center gap-2 text-xs font-medium border animate-in fade-in duration-150 ${
                banner.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}
            >
              {banner.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span className="leading-snug">{banner.message}</span>
            </div>
          )}

          {/* 1. Google Gemini Section */}
          <div
            id="gemini-key-card"
            className="p-3.5 sm:p-4 rounded-xl bg-gray-50/80 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-zinc-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Google Gemini API
                </span>
                {isGeminiConfigured ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200/70 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                    Not configured
                  </span>
                )}
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
              Powers voice companion, live audio conversations, and assistant actions.
            </p>

            <form onSubmit={handleSaveGemini} className="space-y-2.5">
              <div className="relative flex items-center w-full">
                <input
                  id="user-gemini-key-input"
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    setGeminiStatus('idle');
                    setGeminiMsg('');
                  }}
                  placeholder="Enter Gemini key (AIzaSy...)"
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3 pr-16 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:ring-1.5 focus:ring-blue-500"
                />
                <div className="absolute right-1.5 flex items-center gap-0.5">
                  {geminiKey && (
                    <button
                      type="button"
                      id="clear-gemini-key-btn"
                      onClick={() => {
                        setGeminiKey('');
                        setGeminiStatus('idle');
                        setGeminiMsg('');
                      }}
                      title="Clear"
                      className="p-1 text-gray-400 hover:text-rose-500 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    id="toggle-gemini-key-visibility-btn"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    title={showGeminiKey ? 'Hide key' : 'Show key'}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded cursor-pointer"
                  >
                    {showGeminiKey ? <EyeOff className="w-3.5 h-3.5 text-blue-500" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Status feedback */}
              {geminiMsg && (
                <div
                  className={`p-2 rounded-lg text-xs flex items-start gap-1.5 border ${
                    geminiStatus === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : geminiStatus === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {geminiStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5 text-blue-600" />}
                  {geminiStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />}
                  {geminiStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />}
                  <span className="leading-snug break-words">{geminiMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="submit"
                  id="save-gemini-key-btn"
                  disabled={geminiStatus === 'testing'}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
          <div
            id="groq-key-card"
            className="p-3.5 sm:p-4 rounded-xl bg-gray-50/80 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-zinc-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Groq AI API
                </span>
                {isGroqConfigured ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200/70 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                    Not configured
                  </span>
                )}
              </div>

              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
              Powers fast reasoning, personalized secretary chat, and dashboard tool execution.
            </p>

            <form onSubmit={handleSaveGroq} className="space-y-2.5">
              <div className="relative flex items-center w-full">
                <input
                  id="user-groq-key-input"
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    setGroqStatus('idle');
                    setGroqMsg('');
                  }}
                  placeholder="Enter Groq key (gsk_...)"
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3 pr-16 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:ring-1.5 focus:ring-orange-500"
                />
                <div className="absolute right-1.5 flex items-center gap-0.5">
                  {groqKey && (
                    <button
                      type="button"
                      id="clear-groq-key-btn"
                      onClick={() => {
                        setGroqKey('');
                        setGroqStatus('idle');
                        setGroqMsg('');
                      }}
                      title="Clear"
                      className="p-1 text-gray-400 hover:text-rose-500 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    id="toggle-groq-key-visibility-btn"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    title={showGroqKey ? 'Hide key' : 'Show key'}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded cursor-pointer"
                  >
                    {showGroqKey ? <EyeOff className="w-3.5 h-3.5 text-orange-500" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Model select */}
              <div className="flex items-center gap-2">
                <label htmlFor="user-groq-model-select" className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                  Model:
                </label>
                <select
                  id="user-groq-model-select"
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121214] text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1.5 focus:ring-orange-500"
                >
                  {SUPPORTED_GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status feedback */}
              {groqMsg && (
                <div
                  className={`p-2 rounded-lg text-xs flex items-start gap-1.5 border ${
                    groqStatus === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : groqStatus === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                  }`}
                >
                  {groqStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5 text-orange-600" />}
                  {groqStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />}
                  {groqStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />}
                  <span className="leading-snug break-words">{groqMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="submit"
                  id="save-groq-key-btn"
                  disabled={groqStatus === 'testing'}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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

          {/* Compact monthly usage footer info */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1 pt-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-indigo-500" />
              <span>
                {monthlyStats.monthName}: <strong>{monthlyStats.total}</strong> calls ({monthlyStats.gemini} Gemini · {monthlyStats.groq} Groq)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMonthlyStats(Storage.getApiRequestCountsThisMonth());
                Sound.click(settings.soundEnabled);
              }}
              title="Refresh counts"
              className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-3 sm:px-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="truncate">Saved in your private browser storage</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="cancel-api-keys-modal-btn"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              id="save-all-keys-btn"
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
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
