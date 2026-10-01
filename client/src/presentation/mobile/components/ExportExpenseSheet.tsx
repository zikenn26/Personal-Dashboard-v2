import React, { useState, useMemo } from 'react';
import {
  Download,
  Share2,
  Copy,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  Table,
} from 'lucide-react';
import { BottomSheet } from '../gestures/BottomSheet';
import { ExpenseItem } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { Sound } from '../../../utils/audio';
import { toast } from 'sonner';
import {
  generateExpenseCSV,
  generateExpenseJSON,
  generateExpenseExcelBuffer,
  downloadExpenseExcel,
  downloadExpenseCSV,
  downloadExpenseFile,
  shareExpenseExport,
} from '../../../utils/expenseExport';
import { isCreditTransaction } from '../../../utils/expenseUtils';

export interface ExportExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  allExpenses: ExpenseItem[];
  filteredExpenses: ExpenseItem[];
  currentPeriodLabel: string;
  selectedCategory?: string;
  soundEnabled?: boolean;
}

type ExportScope = 'filtered' | 'all';
type ExportFormat = 'xlsx' | 'csv' | 'json';

export const ExportExpenseSheet: React.FC<ExportExpenseSheetProps> = ({
  isOpen,
  onClose,
  allExpenses,
  filteredExpenses,
  currentPeriodLabel,
  selectedCategory = 'all',
  soundEnabled = true,
}) => {
  const [scope, setScope] = useState<ExportScope>('filtered');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [isCopied, setIsCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Target list depending on scope
  const targetExpenses = useMemo(() => {
    return scope === 'filtered' ? filteredExpenses : allExpenses;
  }, [scope, filteredExpenses, allExpenses]);

  // Summary stats for the target list
  const summary = useMemo(() => {
    let debitTotal = 0;
    let creditTotal = 0;
    const dates: string[] = [];

    targetExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      if (isCreditTransaction(exp)) {
        creditTotal += amt;
      } else {
        debitTotal += amt;
      }
      if (exp.date) {
        dates.push(exp.date);
      }
    });

    dates.sort();
    const minDate = dates[0] || '';
    const maxDate = dates[dates.length - 1] || '';

    return {
      count: targetExpenses.length,
      debitTotal,
      creditTotal,
      minDate,
      maxDate,
    };
  }, [targetExpenses]);

  const getExportFilename = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const scopePrefix = scope === 'filtered' ? 'filtered' : 'all';
    return `expenses_${scopePrefix}_${todayStr}.${format}`;
  };

  const handleDownload = () => {
    if (targetExpenses.length === 0) {
      toast.error('No transactions available to export');
      return;
    }

    void nativeService.triggerHaptic('success');
    Sound.success(soundEnabled);
    setIsExporting(true);

    try {
      const filename = getExportFilename();
      if (format === 'xlsx') {
        downloadExpenseExcel(targetExpenses, filename);
      } else if (format === 'csv') {
        downloadExpenseCSV(targetExpenses, filename);
      } else {
        const json = generateExpenseJSON(targetExpenses);
        downloadExpenseFile(json, filename, 'application/json;charset=utf-8;');
      }

      toast.success(`Exported ${targetExpenses.length} records!`, {
        description: `Saved as ${filename}`,
      });
      onClose();
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (targetExpenses.length === 0) {
      toast.error('No transactions available to share');
      return;
    }

    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    setIsExporting(true);

    try {
      const filename = getExportFilename();
      let mimeType = 'text/csv';
      let content: string | Uint8Array = '';

      if (format === 'xlsx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        content = generateExpenseExcelBuffer(targetExpenses);
      } else if (format === 'csv') {
        mimeType = 'text/csv';
        content = generateExpenseCSV(targetExpenses);
      } else {
        mimeType = 'application/json';
        content = generateExpenseJSON(targetExpenses);
      }

      const title = `Expense Report (${targetExpenses.length} items, ₹${summary.debitTotal.toFixed(2)})`;
      const text = `LifeOS Expense Report\nPeriod: ${scope === 'filtered' ? currentPeriodLabel : 'All Time'}\nTotal Spending: ₹${summary.debitTotal.toFixed(2)}\nRecords: ${targetExpenses.length}`;

      const shared = await shareExpenseExport({
        filename,
        content,
        mimeType,
        title,
        text,
      });

      if (shared) {
        toast.success('Expense report shared successfully!');
        onClose();
      }
    } catch {
      toast.error('Failed to open Android share sheet');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (targetExpenses.length === 0) {
      toast.error('No transactions available to copy');
      return;
    }

    void nativeService.triggerHaptic('click');
    Sound.click(soundEnabled);

    try {
      const content =
        format === 'json'
          ? generateExpenseJSON(targetExpenses)
          : generateExpenseCSV(targetExpenses);

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast.success(`Copied ${targetExpenses.length} transactions as ${format === 'json' ? 'JSON' : 'CSV/Excel table'}!`);
      } else {
        toast.error('Clipboard copy is not supported in this browser.');
      }
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-bold text-gray-900 dark:text-white">Export Expense</span>
        </div>
      }
      subtitle="Download Excel sheet or CSV spreadsheet"
      maxHeight="max-h-[85vh]"
    >
      <div className="p-4 space-y-4">
        {/* 1. Scope Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Export Scope
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Filtered View Option */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setScope('filtered');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                scope === 'filtered'
                  ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A2234] opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Current View
                </span>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    scope === 'filtered'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {scope === 'filtered' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                {currentPeriodLabel}
                {selectedCategory !== 'all' ? ` · ${selectedCategory}` : ''}
              </p>
              <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {filteredExpenses.length} items
              </p>
            </button>

            {/* All Records Option */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setScope('all');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                scope === 'all'
                  ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A2234] opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  All Records
                </span>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    scope === 'all'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {scope === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Complete History
              </p>
              <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {allExpenses.length} items
              </p>
            </button>
          </div>
        </div>

        {/* 2. Format Selection (Excel .xlsx, CSV .csv, JSON .json) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Export Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {/* Excel Option */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setFormat('xlsx');
              }}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                format === 'xlsx'
                  ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 ring-1 ring-emerald-500'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A2234] opacity-80'
              }`}
            >
              <div className="p-1.5 w-fit rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 mb-1.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                Excel Sheet
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                .xlsx file
              </span>
            </button>

            {/* CSV Option */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setFormat('csv');
              }}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                format === 'csv'
                  ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 ring-1 ring-emerald-500'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A2234] opacity-80'
              }`}
            >
              <div className="p-1.5 w-fit rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 mb-1.5">
                <Table className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                CSV Sheet
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                .csv file
              </span>
            </button>

            {/* JSON Option */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setFormat('json');
              }}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                format === 'json'
                  ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 ring-1 ring-emerald-500'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A2234] opacity-80'
              }`}
            >
              <div className="p-1.5 w-fit rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 mb-1.5">
                <FileCode className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                JSON Data
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                .json file
              </span>
            </button>
          </div>
        </div>

        {/* 3. Export Summary Preview Card */}
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Selected Records</span>
            <span className="font-bold text-gray-900 dark:text-white">{summary.count} transactions</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Total Spending (Debits)</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              ₹{summary.debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {summary.creditTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Credits (Refunds)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +₹{summary.creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {summary.minDate && summary.maxDate && (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200 dark:border-gray-700/60">
              <span className="text-gray-500 dark:text-gray-400">Date Range</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {summary.minDate} → {summary.maxDate}
              </span>
            </div>
          )}
        </div>

        {/* 4. Action Buttons */}
        <div className="space-y-2 pt-0.5">
          {/* Primary Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || targetExpenses.length === 0}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>
              {format === 'xlsx'
                ? 'Download Excel Sheet (.xlsx)'
                : format === 'csv'
                ? 'Download CSV (.csv)'
                : 'Download JSON (.json)'}
            </span>
          </button>

          {/* Secondary Actions (Share & Copy) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={isExporting || targetExpenses.length === 0}
              className="py-2.5 px-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121826] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Share to Apps</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={isExporting || targetExpenses.length === 0}
              className="py-2.5 px-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121826] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-purple-500" />
                  <span>Copy Content</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default ExportExpenseSheet;
