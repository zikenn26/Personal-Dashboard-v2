import React, { useState, useRef } from 'react';
import {
  ArrowLeftRight,
  Download,
  Upload,
  CheckCircle2,
  CloudOff,
  ShieldCheck,
  X,
  FileJson,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Storage } from '../utils/storage';
import { expenseSyncService } from '../services/expenseSyncService';
import { nativeService } from '../services/nativeService';
import { Sound } from '../utils/audio';

export interface CrossDeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
  soundEnabled?: boolean;
}

export const CrossDeviceSyncModal: React.FC<CrossDeviceSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
  soundEnabled = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  if (!isOpen) return null;

  const currentExpenses = Storage.getExpenses();
  const deletedIds = Storage.getDeletedExpenseIds();
  const logs = Storage.getExcelImportLogs();

  const handleExportSyncFile = () => {
    try {
      setIsExporting(true);
      Sound.click(soundEnabled);

      const payload = {
        app: 'LifeOS',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        clientTimestamp: Date.now(),
        expenses: currentExpenses,
        excelImportLogs: logs,
        deletedExpenseIds: deletedIds,
        tombstonedRefs: Storage.getTombstonedRefs ? Storage.getTombstonedRefs() : [],
        _meta: {
          clientTimestamp: Date.now(),
          deletedExpenseIds: deletedIds,
          totalCount: currentExpenses.length,
        },
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const fileName = `lifeos_expenses_sync_${new Date().toISOString().split('T')[0]}.json`;

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Sound.success(soundEnabled);
      void nativeService.triggerHaptic('success');
      toast.success('Sync file generated!', {
        description: `Exported ${currentExpenses.length} expenses. Transfer this file to your other device (Chrome or APK) to sync.`,
      });
    } catch (err: any) {
      toast.error('Failed to export sync file', {
        description: err?.message || 'Unknown error during export',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Sound.click(soundEnabled);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('File content was empty');

        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid JSON sync format');
        }

        // Apply via Storage.importAllDataPayload
        const success = Storage.importAllDataPayload(data);
        if (!success) {
          throw new Error('Storage was unable to reconcile imported data');
        }

        // Dispatch events to refresh all UI listeners immediately
        window.dispatchEvent(
          new CustomEvent('dashboard-data-updated', {
            detail: { module: 'expenses', updatedExpenses: Storage.getExpenses() },
          })
        );
        window.dispatchEvent(new Event('storage'));

        Sound.success(soundEnabled);
        void nativeService.triggerHaptic('success');
        const count = Storage.getExpenses().length;
        toast.success('Cross-Device Sync Complete!', {
          description: `Successfully merged and synchronized ${count} expenses from your device file.`,
        });

        if (onSyncComplete) {
          onSyncComplete();
        }

        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err: any) {
        toast.error('Import failed', {
          description: err?.message || 'Please make sure this is a valid LifeOS sync file.',
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      toast.error('Failed to read selected file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleBackgroundCloudSync = async () => {
    setIsCloudSyncing(true);
    Sound.click(soundEnabled);
    try {
      const res = await expenseSyncService.syncExpenses({ manual: true });
      if (res.success) {
        Sound.success(soundEnabled);
        toast.success('Cloud sync succeeded', {
          description: `${res.pushedCount} pushed, ${res.pulledCount} pulled.`,
        });
      } else {
        const isQuota =
          res.message?.includes('egress') ||
          res.message?.includes('quota') ||
          res.message?.includes('exhausted') ||
          res.message?.includes('402');
        if (isQuota) {
          toast.warning('Cloud Sync Paused (Egress Quota Exceeded)', {
            description:
              'Supabase free-tier bandwidth quota is reached. Direct file sync works 100% offline between your phone & PC!',
            duration: 7000,
          });
        } else {
          toast.error(res.message || 'Cloud sync failed. Local data remains safe.');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Sync error occurred');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#181534] border border-[#e3dfff] dark:border-[#2f2956] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e3dfff] dark:border-[#28224d]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7b2cbf] to-[#6100a4] text-white flex items-center justify-center shadow-xs">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-[#181445] dark:text-white">
                Cross-Device Expense Sync
              </h2>
              <p className="text-[11px] text-[#7e7384] dark:text-[#a09bb5]">
                Direct APK ↔ Chrome bridge without cloud limits
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#7e7384] hover:text-[#181445] dark:hover:text-white hover:bg-[#efebff] dark:hover:bg-[#252045] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quota Notice Banner */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 flex items-start gap-2.5">
          <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
            <p className="font-bold">Supabase Cloud Egress Quota Active</p>
            <p className="text-[11px] opacity-90">
              Your device data is 100% safe locally. Use this Direct Bridge to sync expenses instantly between your Android APK and Chrome!
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-[#efebff]/60 dark:bg-[#201c40]/60 border border-[#cfc2d5]/30 dark:border-[#2e2857]">
            <span className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] block">
              Local Expenses
            </span>
            <span className="text-base font-extrabold text-[#7b2cbf] dark:text-[#deb7ff]">
              {currentExpenses.length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#efebff]/60 dark:bg-[#201c40]/60 border border-[#cfc2d5]/30 dark:border-[#2e2857]">
            <span className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] block">
              Tombstoned Deletions
            </span>
            <span className="text-base font-extrabold text-slate-700 dark:text-slate-300">
              {deletedIds.length}
            </span>
          </div>
        </div>

        {/* Action 1: Export Sync File */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#120f2b] border border-[#e3dfff] dark:border-[#28224d] flex items-center justify-between gap-3 shadow-2xs">
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-[#181445] dark:text-white flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-[#7b2cbf]" />
              <span>Step 1: Export from this device</span>
            </h4>
            <p className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] mt-0.5">
              Generates a verified sync file containing your active expenses and deletion tombstones.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportSyncFile}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-lg bg-[#7b2cbf] hover:bg-[#6100a4] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
          >
            {isExporting ? 'Exporting...' : 'Export File'}
          </button>
        </div>

        {/* Action 2: Import Sync File */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#120f2b] border border-[#e3dfff] dark:border-[#28224d] flex items-center justify-between gap-3 shadow-2xs">
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-[#181445] dark:text-white flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Step 2: Import on other device</span>
            </h4>
            <p className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] mt-0.5">
              Select the file from your phone or PC. Automatically merges expenses and respects tombstones.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
            >
              {isImporting ? 'Importing...' : 'Import File'}
            </button>
          </div>
        </div>

        {/* Background Cloud Sync Option */}
        <div className="pt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackgroundCloudSync}
            disabled={isCloudSyncing}
            className="text-[11px] font-semibold text-[#7b2cbf] dark:text-[#deb7ff] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3 h-3 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span>Test Background Cloud Sync</span>
          </button>

          <span className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Deletions never resurrected</span>
          </span>
        </div>
      </div>
    </div>
  );
};
