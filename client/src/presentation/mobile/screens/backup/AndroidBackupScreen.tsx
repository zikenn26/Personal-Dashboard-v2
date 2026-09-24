import React, { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, ShieldCheck, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { nativeService } from '../../../../services/nativeService';

export interface AndroidBackupScreenProps {
  onExportData?: () => void;
  onImportData?: (jsonStr: string) => boolean | void;
  onResetData?: () => void;
}

export const AndroidBackupScreen: React.FC<AndroidBackupScreenProps> = ({
  onExportData,
  onImportData,
  onResetData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExport = () => {
    void nativeService.triggerHaptic('success');
    if (onExportData) onExportData();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportData) {
      void nativeService.triggerHaptic('success');
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          onImportData(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    void nativeService.triggerHaptic('error');
    if (onResetData) onResetData();
    setShowResetConfirm(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Backup & Restore
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Export full dashboard data or restore previous snapshots
        </p>
      </div>

      {/* Cloud & Local Storage Status */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Local Vault & Cache
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Encrypted locally on your device with Capacitor storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>Local storage synced and healthy</span>
        </div>
      </div>

      {/* Backup / Export Button Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white">
              Export Backup File
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Download your complete dashboard data as a JSON file
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 rounded-2xl bg-violet-600 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Restore / Import Button Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white">
              Restore from Backup
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Import a JSON file to recover your notes, tasks, and data
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Danger Zone: Reset App Data */}
      <div className="p-4 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 shadow-2xs space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">
              Reset Application Data
            </h4>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/70 mt-0.5">
              Permanently erase all local tasks, expenses, and journal entries.
            </p>
          </div>
        </div>

        {showResetConfirm ? (
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs hover:bg-rose-200 active:scale-95 transition-all cursor-pointer"
          >
            Reset All Data
          </button>
        )}
      </div>
    </div>
  );
};
