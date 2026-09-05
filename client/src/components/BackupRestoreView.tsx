import React, { useState } from 'react';
import { Sound } from '../utils/audio';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FileJson,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Cloud,
  Globe,
  UploadCloud,
  DownloadCloud,
  Radio,
} from 'lucide-react';
import { Storage } from '../utils/storage';
import { isSupabaseConfigured } from '../utils/supabase';

interface BackupRestoreViewProps {
  onExportData: () => void;
  onImportData: (jsonStr: string) => void;
  onResetData: () => void;
  soundEnabled: boolean;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  onExportData,
  onImportData,
  onResetData,
  soundEnabled,
}) => {
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const supabaseConnected = isSupabaseConfigured();

  // Compute storage stats safely
  const todos = Storage.getTodos();
  const habits = Storage.getHabits();
  const journal = Storage.getJournal();
  const expenses = Storage.getExpenses();
  const media = Storage.getMedia();
  const milestones = Storage.getTimeline();
  const vault = Storage.getVault();
  const projects = Storage.getProjects();

  const totalRecords =
    todos.length +
    habits.length +
    journal.length +
    expenses.length +
    media.length +
    milestones.length +
    vault.length +
    projects.length;

  const rawJson = Storage.exportAllDataJSON();
  const estimatedSizeKb = (new Blob([rawJson]).size / 1024).toFixed(1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          JSON.parse(content);
          onImportData(content);
          setImportStatus('success');
          setStatusMsg(`Successfully imported ${file.name}`);
        } catch {
          setImportStatus('error');
          setStatusMsg('Invalid JSON format. Please select a valid backup file.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleManualImport = () => {
    if (!importText.trim()) return;
    try {
      JSON.parse(importText);
      onImportData(importText);
      setImportStatus('success');
      setStatusMsg('Data successfully imported from JSON text.');
      setImportText('');
    } catch {
      setImportStatus('error');
      setStatusMsg('Invalid JSON structure. Please verify the copied string.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDECE9] dark:border-[#1F2937]">
        <div>
          <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
            <Database className="w-7 h-7 text-[#6366F1]" />
            <span>Cloud &amp; Local Storage Engine</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#787774] dark:text-[#9CA3AF] mt-1">
            Dual-tier persistence: Supabase Free PostgreSQL &amp; Storage with automatic client-side LocalStorage fallback.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onExportData();
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Backup (JSON)</span>
          </button>
        </div>
      </div>

      {/* Supabase & Cloudflare Highlights Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-indigo-500/5 to-amber-500/10 border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500 text-white">
              <Cloud className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <span>Supabase Cloud Database &amp; Auto Sync</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                supabaseConnected 
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
              }`}>
                {supabaseConnected ? '● Cloud Connected' : '○ Local Storage Active'}
              </span>
            </h3>
          </div>
          <p className="text-xs text-[#4B5563] dark:text-[#CBD5E1] max-w-2xl leading-relaxed">
            Free PostgreSQL database schema, row-level security (RLS), multi-bucket storage, and automatic background realtime syncing.
          </p>
        </div>
      </div>

      {/* Storage Health & Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#787774] dark:text-[#9CA3AF]">
            <span>Total Records</span>
            <Layers className="w-4 h-4 text-[#6366F1]" />
          </div>
          <p className="text-2xl font-bold text-[#37352F] dark:text-white mt-1">
            {totalRecords}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" /> Live &amp; Persistent
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#787774] dark:text-[#9CA3AF]">
            <span>Storage Size</span>
            <HardDrive className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-[#37352F] dark:text-white mt-1">
            {estimatedSizeKb} KB
          </p>
          <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] mt-1 block">
            Browser LocalStorage
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#787774] dark:text-[#9CA3AF]">
            <span>Data Format</span>
            <FileJson className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-[#37352F] dark:text-white mt-1">
            JSON v4
          </p>
          <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] mt-1 block">
            Standard portable format
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#787774] dark:text-[#9CA3AF]">
            <span>Privacy Status</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-base font-bold text-[#37352F] dark:text-white mt-1.5 flex items-center gap-1">
            🔒 100% Offline
          </p>
          <span className="text-[10px] text-emerald-600 font-medium block mt-1">
            No server transmission
          </span>
        </div>
      </div>

      {/* Entity Breakdown Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] rounded-2xl p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-[#37352F] dark:text-white flex items-center gap-2">
          <span>📊</span>
          <span>Stored Entities Breakdown</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Tasks &amp; Sprints</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{todos.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Habit Routines</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{habits.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Journal Entries</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{journal.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Expenses &amp; SaaS</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{expenses.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Library &amp; Media</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{media.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Life Map Milestones</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{milestones.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Vault Secrets</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{vault.length}</p>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <span className="text-[#787774] dark:text-[#9CA3AF]">Portfolio Projects</span>
            <p className="text-base font-bold text-[#37352F] dark:text-white mt-0.5">{projects.length}</p>
          </div>
        </div>
      </div>

      {/* Import & Restore Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload File */}
        <div className="bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#37352F] dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#6366F1]" />
            <span>Restore from File</span>
          </h2>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
            Upload any previously exported <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[11px]">.json</code> backup file to completely restore your workspace.
          </p>

          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#CBD5E1] dark:border-[#334155] hover:border-[#6366F1] rounded-2xl cursor-pointer bg-[#F8FAFC] dark:bg-[#0F172A] transition-all">
            <Upload className="w-8 h-8 text-[#9CA3AF] mb-2" />
            <span className="text-xs font-semibold text-[#37352F] dark:text-white">Choose Backup JSON file</span>
            <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] mt-1">or drag and drop here</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Paste JSON */}
        <div className="bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] rounded-2xl p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#37352F] dark:text-white flex items-center gap-2">
            <FileJson className="w-4 h-4 text-emerald-500" />
            <span>Restore from JSON Text</span>
          </h2>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
            Paste your raw JSON backup string directly:
          </p>
          <textarea
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste JSON payload here..."
            className="w-full p-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs font-mono text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
          />
          <button
            type="button"
            onClick={handleManualImport}
            disabled={!importText.trim()}
            className="w-full py-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
          >
            Import JSON Text
          </button>
        </div>
      </div>

      {/* Status Feedback Message */}
      {importStatus !== 'idle' && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            importStatus === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {importStatus === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Danger Zone / Factory Reset */}
      <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone: Reset Workspace</span>
        </h2>
        <p className="text-xs text-red-600/80 dark:text-red-400/80">
          Reset all stored tasks, habits, journals, and records to initial sample state. We strongly advise exporting a JSON backup first.
        </p>

        {showResetConfirm ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                onResetData();
                setShowResetConfirm(false);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Yes, permanently reset workspace
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-[#37352F] dark:text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl border border-red-300 dark:border-red-800 cursor-pointer transition-all"
          >
            Reset to Sample Data
          </button>
        )}
      </div>
    </div>
  );
};
