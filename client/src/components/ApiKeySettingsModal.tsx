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
  ShieldCheck,
  Trash2,
  Loader2,
  Lock,
  Activity,
  RefreshCw,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Gauge,
  SlidersHorizontal,
  BellRing,
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
  // API key masked by default for security in public
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiTestMsg, setGeminiTestMsg] = useState('');

  // Groq State
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  // API key masked by default for security in public
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqSaved, setGroqSaved] = useState(false);
  const [groqTestStatus, setGroqTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [groqTestMsg, setGroqTestMsg] = useState('');

  // Dedicated Test Connection State
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq'>('gemini');
  const [connectionTestStatus, setConnectionTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionTestMsg, setConnectionTestMsg] = useState('');
  const [testedProvider, setTestedProvider] = useState<'gemini' | 'groq'>('gemini');

  // Monthly Request Counts Dashboard State
  const [monthlyStats, setMonthlyStats] = useState<ApiMonthlyStats>(() =>
    Storage.getApiRequestCountsThisMonth()
  );

  // Monthly Usage Threshold State
  const [threshold, setThreshold] = useState<number | null>(() => Storage.getApiMonthlyThreshold());
  const [customThresholdInput, setCustomThresholdInput] = useState<string>(() => {
    const t = Storage.getApiMonthlyThreshold();
    return t ? String(t) : '500';
  });
  const [isCustomThresholdMode, setIsCustomThresholdMode] = useState<boolean>(() => {
    const t = Storage.getApiMonthlyThreshold();
    return Boolean(t && ![100, 250, 500, 1000].includes(t));
  });

  // General Notification Banner
  const [generalBanner, setGeneralBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync keys and thresholds on modal open or user change
  useEffect(() => {
    if (isOpen) {
      const activeGemini = Storage.getGeminiApiKey();
      const activeGroq = Storage.getGroqApiKey();
      const activeModel = Storage.getGroqModel?.() || settings.groqModel || DEFAULT_GROQ_MODEL;

      setGeminiKey(activeGemini || '');
      setGroqKey(activeGroq || '');
      setGroqModel(activeModel);

      // Crucial: Mask both API keys by default when opening modal to protect credentials in public
      setShowGeminiKey(false);
      setShowGroqKey(false);

      setGeminiTestStatus('idle');
      setGeminiTestMsg('');
      setGroqTestStatus('idle');
      setGroqTestMsg('');
      setConnectionTestStatus('idle');
      setConnectionTestMsg('');
      setGeneralBanner(null);

      // Refresh monthly request counts and threshold
      const stats = Storage.getApiRequestCountsThisMonth();
      setMonthlyStats(stats);
      const activeThreshold = Storage.getApiMonthlyThreshold() || settings.apiMonthlyThreshold || null;
      setThreshold(activeThreshold);
      if (activeThreshold && ![100, 250, 500, 1000].includes(activeThreshold)) {
        setIsCustomThresholdMode(true);
        setCustomThresholdInput(String(activeThreshold));
      } else {
        setIsCustomThresholdMode(false);
      }
    }
  }, [isOpen, currentUser?.id, currentUser?.email, settings.groqModel, settings.apiMonthlyThreshold]);

  // Real-time listener for API requests made this month and threshold changes
  useEffect(() => {
    const handleRecorded = () => {
      setMonthlyStats(Storage.getApiRequestCountsThisMonth());
      setThreshold(Storage.getApiMonthlyThreshold());
    };
    const handleThresholdChange = () => {
      setMonthlyStats(Storage.getApiRequestCountsThisMonth());
      setThreshold(Storage.getApiMonthlyThreshold());
    };
    window.addEventListener('lifeos_api_request_recorded', handleRecorded);
    window.addEventListener('lifeos_api_threshold_changed', handleThresholdChange);
    return () => {
      window.removeEventListener('lifeos_api_request_recorded', handleRecorded);
      window.removeEventListener('lifeos_api_threshold_changed', handleThresholdChange);
    };
  }, []);

  if (!isOpen) return null;

  const currentUserName = currentUser?.name || profile?.name || 'Current User';
  const currentUserEmail = currentUser?.email || profile?.contactEmail || 'personal workspace';

  // Lightweight verification request to confirm active and valid status
  const handleTestConnection = async (overrideProvider?: 'gemini' | 'groq') => {
    const provider = overrideProvider || selectedProvider;
    setTestedProvider(provider);
    setConnectionTestStatus('testing');
    Sound.click(settings.soundEnabled);

    if (provider === 'gemini') {
      const keyToTest = geminiKey.trim();
      if (!keyToTest) {
        setConnectionTestStatus('error');
        setConnectionTestMsg('Please enter a Google Gemini API key first before testing connection.');
        setGeminiTestStatus('error');
        setGeminiTestMsg('Please enter a Google Gemini API key first.');
        Sound.error(settings.soundEnabled);
        return;
      }

      setConnectionTestMsg('Verifying connection with Google Gemini models...');
      setGeminiTestStatus('testing');
      setGeminiTestMsg('Validating key with Google Gemini...');

      try {
        const res = await testGeminiApiKey(keyToTest);
        if (res.success) {
          setConnectionTestStatus('success');
          setConnectionTestMsg(res.message);
          setGeminiTestStatus('success');
          setGeminiTestMsg(res.message);
          Sound.success(settings.soundEnabled);
          setMonthlyStats(Storage.getApiRequestCountsThisMonth());
        } else {
          setConnectionTestStatus('error');
          setConnectionTestMsg(res.message);
          setGeminiTestStatus('error');
          setGeminiTestMsg(res.message);
          Sound.error(settings.soundEnabled);
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Connection failed: Unable to contact Google Gemini servers.';
        setConnectionTestStatus('error');
        setConnectionTestMsg(errMsg);
        setGeminiTestStatus('error');
        setGeminiTestMsg(errMsg);
        Sound.error(settings.soundEnabled);
      }
    } else {
      const keyToTest = groqKey.trim();
      if (!keyToTest) {
        setConnectionTestStatus('error');
        setConnectionTestMsg('Please enter a Groq AI API key first before testing connection.');
        setGroqTestStatus('error');
        setGroqTestMsg('Please enter a Groq API key first.');
        Sound.error(settings.soundEnabled);
        return;
      }

      setConnectionTestMsg('Verifying connection with Groq AI cloud...');
      setGroqTestStatus('testing');
      setGroqTestMsg('Validating key with Groq cloud servers...');

      try {
        const res = await testGroqApiKey(keyToTest);
        if (res.success) {
          setConnectionTestStatus('success');
          setConnectionTestMsg(res.message);
          setGroqTestStatus('success');
          setGroqTestMsg(res.message);
          Sound.success(settings.soundEnabled);
          setMonthlyStats(Storage.getApiRequestCountsThisMonth());
        } else {
          setConnectionTestStatus('error');
          setConnectionTestMsg(res.message);
          setGroqTestStatus('error');
          setGroqTestMsg(res.message);
          Sound.error(settings.soundEnabled);
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Connection failed: Unable to contact Groq cloud servers.';
        setConnectionTestStatus('error');
        setConnectionTestMsg(errMsg);
        setGroqTestStatus('error');
        setGroqTestMsg(errMsg);
        Sound.error(settings.soundEnabled);
      }
    }
  };

  const handleSaveGeminiKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = geminiKey.trim();
    Storage.setGeminiApiKey(cleanKey);
    onUpdateSettings({ ...settings, geminiApiKey: cleanKey });
    Sound.success(settings.soundEnabled);
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2500);
    setGeneralBanner({
      type: 'success',
      message: cleanKey
        ? 'Google Gemini API key saved to your private profile.'
        : 'Google Gemini API key cleared from your profile.',
    });
    setTimeout(() => setGeneralBanner(null), 3000);
  };

  const handleSaveGroqKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = groqKey.trim();
    Storage.setGroqApiKey(cleanKey);
    Storage.setGroqModel(groqModel);
    onUpdateSettings({ ...settings, groqApiKey: cleanKey, groqModel });
    Sound.success(settings.soundEnabled);
    setGroqSaved(true);
    setTimeout(() => setGroqSaved(false), 2500);
    setGeneralBanner({
      type: 'success',
      message: cleanKey
        ? 'Groq AI API key saved to your private profile.'
        : 'Groq AI API key cleared from your profile.',
    });
    setTimeout(() => setGeneralBanner(null), 3000);
  };

  const handleSaveAll = () => {
    const cleanGemini = geminiKey.trim();
    const cleanGroq = groqKey.trim();

    Storage.setGeminiApiKey(cleanGemini);
    Storage.setGroqApiKey(cleanGroq);
    Storage.setGroqModel(groqModel);

    onUpdateSettings({
      ...settings,
      geminiApiKey: cleanGemini,
      groqApiKey: cleanGroq,
      groqModel,
    });

    Sound.success(settings.soundEnabled);
    setGeminiSaved(true);
    setGroqSaved(true);
    setTimeout(() => {
      setGeminiSaved(false);
      setGroqSaved(false);
    }, 2500);

    setGeneralBanner({
      type: 'success',
      message: 'All AI API keys saved securely to your personal profile.',
    });
    setTimeout(() => setGeneralBanner(null), 3500);
  };

  const handleClearGemini = () => {
    setGeminiKey('');
    Storage.setGeminiApiKey('');
    onUpdateSettings({ ...settings, geminiApiKey: '' });
    setGeminiTestStatus('idle');
    setGeminiTestMsg('');
    Sound.click(settings.soundEnabled);
  };

  const handleClearGroq = () => {
    setGroqKey('');
    Storage.setGroqApiKey('');
    onUpdateSettings({ ...settings, groqApiKey: '' });
    setGroqTestStatus('idle');
    setGroqTestMsg('');
    Sound.click(settings.soundEnabled);
  };

  const handleSelectThreshold = (newThreshold: number | null) => {
    Sound.click(settings.soundEnabled);
    setIsCustomThresholdMode(false);
    setThreshold(newThreshold);
    Storage.setApiMonthlyThreshold(newThreshold);
    onUpdateSettings({ ...settings, apiMonthlyThreshold: newThreshold });
    setMonthlyStats(Storage.getApiRequestCountsThisMonth());

    setGeneralBanner({
      type: 'success',
      message: newThreshold
        ? `Monthly limit set to ${newThreshold.toLocaleString()} requests/month. Threshold warning triggers at 80% (${Math.floor(newThreshold * 0.8)} calls).`
        : 'Monthly usage threshold disabled (unlimited requests).',
    });
    setTimeout(() => setGeneralBanner(null), 3500);
  };

  const handleSaveCustomThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customThresholdInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      setGeneralBanner({
        type: 'error',
        message: 'Please enter a positive numeric threshold greater than 0.',
      });
      Sound.error(settings.soundEnabled);
      return;
    }
    Sound.click(settings.soundEnabled);
    setThreshold(val);
    Storage.setApiMonthlyThreshold(val);
    onUpdateSettings({ ...settings, apiMonthlyThreshold: val });
    setMonthlyStats(Storage.getApiRequestCountsThisMonth());

    setGeneralBanner({
      type: 'success',
      message: `Custom threshold saved: ${val.toLocaleString()} requests/month. Threshold warning triggers at 80% (${Math.floor(val * 0.8)} calls).`,
    });
    setTimeout(() => setGeneralBanner(null), 3500);
  };

  const handleSimulateThresholdWarning = () => {
    Sound.click(settings.soundEnabled);
    const mockLimit = threshold || 500;
    const mockCurrent = Math.floor(mockLimit * 0.86);
    const mockPercent = 86;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lifeos_api_threshold_warning', {
          detail: {
            level: 'approaching',
            current: mockCurrent,
            limit: mockLimit,
            percent: mockPercent,
            message: `Approaching monthly API usage threshold: ${mockCurrent} of ${mockLimit} requests used (${mockPercent}%).`,
          },
        })
      );
    }

    setGeneralBanner({
      type: 'success',
      message: `Triggered sample threshold warning banner (${mockPercent}% threshold simulated).`,
    });
    setTimeout(() => setGeneralBanner(null), 3500);
  };

  // Percentage calculations for monthly usage breakdown
  const totalRequests = monthlyStats.total;
  const geminiPercent = totalRequests > 0 ? Math.round((monthlyStats.gemini / totalRequests) * 100) : 50;
  const groqPercent = totalRequests > 0 ? 100 - geminiPercent : 50;

  return (
    <div
      id="api-key-settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="api-key-settings-modal-card"
        className="relative w-full max-w-2xl bg-white dark:bg-[#18181B] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                Personal AI API Keys
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Per-User Isolated
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure, test, and monitor your personal Gemini &amp; Groq keys. Never shared with other accounts.
              </p>
            </div>
          </div>
          <button
            id="close-api-key-settings-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General Banner Alert */}
          {generalBanner && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium border animate-in fade-in duration-150 ${
                generalBanner.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}
            >
              {generalBanner.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{generalBanner.message}</span>
            </div>
          )}

          {/* User Isolation Badge Note */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Profile Workspace:
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
                  {currentUserEmail}
                </span>
                <span className="text-gray-500 dark:text-gray-400">({currentUserName})</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Keys are stored securely in your private workspace and masked by default to protect your credentials in public.
              </p>
            </div>
          </div>

          {/* DASHBOARD COMPONENT: Simple count of requests made this month */}
          <div
            id="api-usage-monthly-dashboard"
            className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50/30 dark:from-[#1A1A1E] dark:via-[#19191D] dark:to-[#171524] border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Monthly AI Usage Dashboard
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Live Count
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Requests executed using your personal saved API keys during this billing cycle.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800/90 border border-gray-200 dark:border-gray-700/80 text-gray-700 dark:text-gray-300 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{monthlyStats.monthName}</span>
                </div>
                <button
                  type="button"
                  id="refresh-api-usage-btn"
                  onClick={() => {
                    setMonthlyStats(Storage.getApiRequestCountsThisMonth());
                    Sound.click(settings.soundEnabled);
                  }}
                  title="Refresh usage statistics"
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Gemini Metric Card */}
              <div
                id="gemini-monthly-usage-card"
                className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-blue-100 dark:border-blue-950/50 shadow-2xs space-y-2 transition-all hover:border-blue-300 dark:hover:border-blue-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Google Gemini</span>
                  </span>
                  {geminiKey.trim() ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400">
                      No key
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white font-mono">
                    {monthlyStats.gemini}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">requests</span>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  Voice, TTS &amp; Live actions
                </div>
              </div>

              {/* Groq Metric Card */}
              <div
                id="groq-monthly-usage-card"
                className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-orange-100 dark:border-orange-950/50 shadow-2xs space-y-2 transition-all hover:border-orange-300 dark:hover:border-orange-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-orange-500" />
                    <span>Groq AI</span>
                  </span>
                  {groqKey.trim() ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400">
                      No key
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white font-mono">
                    {monthlyStats.groq}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">requests</span>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  Fast Secretary &amp; Reasoning
                </div>
              </div>

              {/* Total Monthly Requests Card */}
              <div
                id="total-monthly-usage-card"
                className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-indigo-100 dark:border-indigo-950/50 shadow-2xs space-y-2 transition-all hover:border-indigo-300 dark:hover:border-indigo-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Total Requests</span>
                  </span>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                    This Month
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 font-mono">
                    {monthlyStats.total}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">total calls</span>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  Combined quota usage
                </div>
              </div>
            </div>

            {/* Proportion Bar if usage exists */}
            {totalRequests > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Gemini: {monthlyStats.gemini} ({geminiPercent}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Groq: {monthlyStats.groq} ({groqPercent}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{ width: `${geminiPercent}%` }}
                  />
                  <div
                    className="bg-orange-500 h-full transition-all duration-500"
                    style={{ width: `${groqPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* THRESHOLD STATUS & WARNING BANNER (If threshold is configured) */}
            {monthlyStats.threshold && monthlyStats.threshold > 0 ? (
              <div className="pt-2 space-y-2 border-t border-gray-100 dark:border-gray-800">
                {monthlyStats.isLimitReached ? (
                  <div
                    id="monthly-limit-reached-warning"
                    className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 animate-in fade-in duration-150"
                  >
                    <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                          <span>Monthly API Usage Limit Reached</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-200/80 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                            {monthlyStats.percentUsed}%
                          </span>
                        </h4>
                        <span className="text-[11px] font-mono font-semibold text-rose-700 dark:text-rose-300">
                          {monthlyStats.total} / {monthlyStats.threshold} requests
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        You have reached your {monthlyStats.threshold} request threshold for {monthlyStats.monthName}. Further AI interactions will exceed your defined allocation.
                      </p>
                    </div>
                  </div>
                ) : monthlyStats.isApproachingLimit ? (
                  <div
                    id="monthly-approaching-limit-warning"
                    className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3 animate-in fade-in duration-150"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/80 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <span>Approaching Monthly Usage Threshold</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                            {monthlyStats.percentUsed}%
                          </span>
                        </h4>
                        <span className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-300">
                          {monthlyStats.remainingRequests} remaining
                        </span>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        You have consumed {monthlyStats.total} of your {monthlyStats.threshold} requests. A warning triggers when you exceed 80% of your threshold.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 px-1">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Quota Safe: <strong>{monthlyStats.remainingRequests}</strong> requests remaining ({monthlyStats.percentUsed}% consumed)</span>
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">Target: {monthlyStats.threshold} / mo</span>
                  </div>
                )}

                {/* Progress bar towards limit */}
                <div className="space-y-1">
                  <div className="h-2 w-full bg-gray-200 dark:bg-zinc-700/60 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-500 ${
                        monthlyStats.isLimitReached
                          ? 'bg-rose-500'
                          : monthlyStats.isApproachingLimit
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, monthlyStats.percentUsed || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-gray-400" />
                  <span>No monthly threshold set (unlimited requests tracking).</span>
                </span>
                <span className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">
                  Select a threshold below to get warned
                </span>
              </div>
            )}

            {/* THRESHOLD CONFIGURATION CONTROLS */}
            <div
              id="monthly-threshold-config-box"
              className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161619] border border-gray-200/80 dark:border-gray-800 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Set Monthly Usage Threshold
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                    {threshold ? `${threshold.toLocaleString()} req/mo` : 'Disabled'}
                  </span>
                </div>

                <button
                  type="button"
                  id="test-threshold-warning-btn"
                  onClick={handleSimulateThresholdWarning}
                  title="Simulate threshold warning banner"
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <BellRing className="w-3 h-3" />
                  <span>Test Warning UI</span>
                </button>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Choose or customize a monthly request limit. You will receive an in-app banner alert as soon as your total calls reach 80% of this threshold.
              </p>

              {/* Threshold Presets */}
              <div className="flex items-center flex-wrap gap-1.5">
                {[
                  { label: 'No Limit', value: null },
                  { label: '100', value: 100 },
                  { label: '250', value: 250 },
                  { label: '500', value: 500 },
                  { label: '1,000', value: 1000 },
                ].map((preset) => {
                  const isSelected = !isCustomThresholdMode && threshold === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      id={`threshold-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => handleSelectThreshold(preset.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                          : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  id="threshold-preset-custom-btn"
                  onClick={() => setIsCustomThresholdMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    isCustomThresholdMode
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Custom...</span>
                </button>
              </div>

              {/* Custom Threshold Input */}
              {isCustomThresholdMode && (
                <form
                  onSubmit={handleSaveCustomThreshold}
                  className="flex items-center gap-2 pt-1 animate-in fade-in duration-150"
                >
                  <input
                    type="number"
                    id="custom-threshold-number-input"
                    min="1"
                    step="10"
                    value={customThresholdInput}
                    onChange={(e) => setCustomThresholdInput(e.target.value)}
                    placeholder="e.g. 750"
                    className="w-32 sm:w-40 px-3 py-1.5 text-xs font-mono rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">calls / mo</span>
                  <button
                    type="submit"
                    id="save-custom-threshold-btn"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-2xs ml-auto"
                  >
                    Save Limit
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* DEDICATED 'TEST CONNECTION' COMPONENT */}
          <div
            id="test-connection-section"
            className="p-5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Test Provider Connection
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                      Lightweight Verification
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Triggers a lightweight verification request to confirm your selected API key is active and valid.
                  </p>
                </div>
              </div>
            </div>

            {/* Provider Selector + Trigger Button */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#121214] border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 shrink-0">
                  Select Provider:
                </span>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-2xs">
                  <button
                    type="button"
                    id="select-gemini-provider-btn"
                    onClick={() => setSelectedProvider('gemini')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                      selectedProvider === 'gemini'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Google Gemini</span>
                    {geminiKey.trim() && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" title="Key entered" />
                    )}
                  </button>

                  <button
                    type="button"
                    id="select-groq-provider-btn"
                    onClick={() => setSelectedProvider('groq')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                      selectedProvider === 'groq'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Groq AI</span>
                    {groqKey.trim() && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" title="Key entered" />
                    )}
                  </button>
                </div>
              </div>

              {/* Explicit 'Test Connection' Button */}
              <button
                type="button"
                id="test-connection-btn"
                onClick={() => handleTestConnection()}
                disabled={
                  connectionTestStatus === 'testing' ||
                  (selectedProvider === 'gemini' && !geminiKey.trim()) ||
                  (selectedProvider === 'groq' && !groqKey.trim())
                }
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
              >
                {connectionTestStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying {selectedProvider === 'gemini' ? 'Gemini' : 'Groq'}...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Feedback Result Card */}
            {connectionTestMsg && (
              <div
                id="connection-test-result-banner"
                className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border animate-in fade-in duration-200 ${
                  connectionTestStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : connectionTestStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                }`}
              >
                {connectionTestStatus === 'testing' && (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                )}
                {connectionTestStatus === 'success' && (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                )}
                {connectionTestStatus === 'error' && (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {connectionTestStatus === 'success'
                      ? `${testedProvider === 'gemini' ? 'Google Gemini' : 'Groq AI'} Key is Active & Valid!`
                      : connectionTestStatus === 'error'
                      ? 'Connection Verification Failed'
                      : 'Sending Verification Request...'}
                  </div>
                  <p className="leading-relaxed opacity-90">{connectionTestMsg}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Google Gemini API Key Input (Masked by default with toggle) */}
          <div
            id="gemini-key-card"
            className="p-5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Google Gemini API Key
                    {Storage.getGeminiApiKey() ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        Not configured
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Powers Zikenn Voice Companion, live dashboard actions, and audio transcription.
                  </p>
                </div>
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Get Gemini Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="user-gemini-key-input"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  API Key
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>{showGeminiKey ? 'Unmasked (Visible)' : 'Masked for security'}</span>
                </span>
              </div>

              {/* Masked Input with Toggle Button */}
              <div className="relative flex items-center">
                <input
                  id="user-gemini-key-input"
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    setGeminiTestStatus('idle');
                    setGeminiTestMsg('');
                    setConnectionTestStatus('idle');
                    setConnectionTestMsg('');
                  }}
                  placeholder="AIzaSy..."
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3 pr-24 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  title="Google Gemini API Key (Masked by default for privacy)"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {geminiKey && (
                    <button
                      type="button"
                      id="clear-gemini-key-btn"
                      onClick={handleClearGemini}
                      title="Clear key"
                      className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Toggle Button to Reveal / Mask Key */}
                  <button
                    type="button"
                    id="toggle-gemini-key-visibility-btn"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    title={showGeminiKey ? 'Mask API key for public security' : 'Reveal API key'}
                    aria-label={showGeminiKey ? 'Mask API key' : 'Reveal API key'}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {showGeminiKey ? (
                      <EyeOff className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Test Feedback for Gemini */}
            {geminiTestMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                  geminiTestStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : geminiTestStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                }`}
              >
                {geminiTestStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
                {geminiTestStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />}
                {geminiTestStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />}
                <span className="leading-snug">{geminiTestMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                id="test-gemini-connection-btn"
                onClick={() => handleTestConnection('gemini')}
                disabled={geminiTestStatus === 'testing' || !geminiKey.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {geminiTestStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="save-gemini-key-btn"
                onClick={() => handleSaveGeminiKey()}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {geminiSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Gemini Key</span>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Groq AI API Key Input (Masked by default with toggle) */}
          <div
            id="groq-key-card"
            className="p-5 rounded-2xl bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-100 dark:border-orange-900/40 text-orange-600 dark:text-orange-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Groq AI API Key
                    {Storage.getGroqApiKey() ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        Not configured
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Powers ultra-fast text reasoning, multi-turn secretary chat, and tool execution.
                  </p>
                </div>
              </div>

              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline"
              >
                <span>Get Groq Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="user-groq-key-input"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  API Key
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>{showGroqKey ? 'Unmasked (Visible)' : 'Masked for security'}</span>
                </span>
              </div>

              {/* Masked Input with Toggle Button */}
              <div className="relative flex items-center">
                <input
                  id="user-groq-key-input"
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqKey}
                  onChange={(e) => {
                    setGroqKey(e.target.value);
                    setGroqTestStatus('idle');
                    setGroqTestMsg('');
                    setConnectionTestStatus('idle');
                    setConnectionTestMsg('');
                  }}
                  placeholder="gsk_..."
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3 pr-24 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  title="Groq AI API Key (Masked by default for privacy)"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {groqKey && (
                    <button
                      type="button"
                      id="clear-groq-key-btn"
                      onClick={handleClearGroq}
                      title="Clear key"
                      className="p-1 rounded text-gray-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Toggle Button to Reveal / Mask Key */}
                  <button
                    type="button"
                    id="toggle-groq-key-visibility-btn"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    title={showGroqKey ? 'Mask API key for public security' : 'Reveal API key'}
                    aria-label={showGroqKey ? 'Mask API key' : 'Reveal API key'}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {showGroqKey ? (
                      <EyeOff className="w-3.5 h-3.5 text-orange-500" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Groq Model Picker */}
            <div className="space-y-1.5">
              <label
                htmlFor="user-groq-model-select"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Groq Default Model
              </label>
              <select
                id="user-groq-model-select"
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#121214] text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {SUPPORTED_GROQ_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Test Feedback for Groq */}
            {groqTestMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                  groqTestStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : groqTestStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                }`}
              >
                {groqTestStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
                {groqTestStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />}
                {groqTestStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />}
                <span className="leading-snug">{groqTestMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                id="test-groq-connection-btn"
                onClick={() => handleTestConnection('groq')}
                disabled={groqTestStatus === 'testing' || !groqKey.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {groqTestStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3 h-3 text-orange-500" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="save-groq-key-btn"
                onClick={() => handleSaveGroqKey()}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {groqSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Groq Key</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted in your personal workspace localStorage</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="cancel-api-keys-modal-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              id="save-all-keys-btn"
              onClick={handleSaveAll}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save All Keys</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
