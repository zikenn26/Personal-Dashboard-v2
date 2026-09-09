import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { parseExpensesFromExcel, ParsedSpreadsheetResult } from '../utils/excelExpenseParser';
import { ExpenseItem } from '../types';
import { Sound } from '../utils/audio';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (expenses: Array<Omit<ExpenseItem, 'id'>>, meta: { fileName: string; batchId: string; count: number; totalAmount: number }) => void;
  soundEnabled: boolean;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  soundEnabled,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedSpreadsheetResult | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string>('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    if (!file) return;
    setError(null);
    setIsLoading(true);
    Sound.click(soundEnabled);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const batchId = `sheet_${Date.now()}`;
      setCurrentBatchId(batchId);
      const result = await parseExpensesFromExcel(arrayBuffer, file.name, batchId);

      if (result.expenses.length === 0) {
        setError('No valid expense rows could be parsed. Check that the sheet has date, category, note, and amount/INR columns.');
        setParsedResult(null);
      } else {
        setParsedResult(result);
        Sound.success(soundEnabled);
      }
    } catch (err) {
      console.error('Failed to parse spreadsheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to read spreadsheet. Please ensure it is a valid .xlsx or .xls file.');
      setParsedResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.expenses.length === 0) return;
    Sound.success(soundEnabled);
    onImportSuccess(parsedResult.expenses, {
      fileName: parsedResult.fileName,
      batchId: currentBatchId,
      count: parsedResult.expenses.length,
      totalAmount: parsedResult.totalAmount,
    });
    onClose();
  };

  const handleReset = () => {
    Sound.click(soundEnabled);
    setParsedResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 my-auto text-[#37352F] dark:text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F3F4F6] dark:border-[#2D3748]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Import Expenses from Spreadsheet</h2>
              <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                Upload Money Manager or custom Excel / CSV export (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#2D3748] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="py-4 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {!parsedResult ? (
            /* Upload Drop Area */
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    void handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20'
                    : 'border-[#D1D5DB] dark:border-[#374151] hover:border-emerald-500/80 bg-[#F9FAFB] dark:bg-[#171923]'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#2D3748] shadow-sm border border-[#E5E7EB] dark:border-[#4A5568] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  {isLoading ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold text-[#111827] dark:text-white">
                    {isLoading ? 'Parsing and mapping columns...' : 'Click to browse or drag and drop your spreadsheet'}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Supports <b>.xlsx, .xls, .csv</b> (e.g. <i>Money Manager</i> export with Date, Category, Note, INR)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-[#2D3748] border border-[#E5E7EB] dark:border-[#4A5568] text-gray-600 dark:text-gray-300 font-mono">
                    Auto-detects Date (DD/MM/YYYY)
                  </span>
                  <span className="px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-[#2D3748] border border-[#E5E7EB] dark:border-[#4A5568] text-gray-600 dark:text-gray-300 font-mono">
                    Auto-cleans Emojis (🍜 Food, 🚖 Transport)
                  </span>
                  <span className="px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-[#2D3748] border border-[#E5E7EB] dark:border-[#4A5568] text-gray-600 dark:text-gray-300 font-mono">
                    Extracts Note &amp; INR
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Parsed Summary & Table Preview */
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                    Expenses Found
                  </span>
                  <span className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200">
                    {parsedResult.expenses.length}
                  </span>
                </div>

                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 block">
                    Total Amount
                  </span>
                  <span className="text-lg font-extrabold text-purple-900 dark:text-purple-200">
                    ₹{parsedResult.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl col-span-2">
                  <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block">
                    Date Range
                  </span>
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 block truncate">
                    {parsedResult.dateRange ? `${parsedResult.dateRange.min} → ${parsedResult.dateRange.max}` : 'Various Dates'}
                  </span>
                </div>
              </div>

              {/* Mapped Columns Feedback */}
              <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Mapped Columns:
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Date: <strong className="text-gray-800 dark:text-gray-200 font-mono">{parsedResult.columnMapping.dateCol}</strong>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Category: <strong className="text-gray-800 dark:text-gray-200 font-mono">{parsedResult.columnMapping.categoryCol}</strong>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Note: <strong className="text-gray-800 dark:text-gray-200 font-mono">{parsedResult.columnMapping.noteCol}</strong>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Amount: <strong className="text-gray-800 dark:text-gray-200 font-mono">{parsedResult.columnMapping.amountCol}</strong>
                </span>
                {parsedResult.incomeCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Filtered {parsedResult.incomeCount} income rows
                  </span>
                )}
              </div>

              {/* Sample Preview Rows */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider">
                    Data Preview (First {Math.min(6, parsedResult.expenses.length)} of {parsedResult.expenses.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Choose different file
                  </button>
                </div>

                <div className="border border-[#E5E7EB] dark:border-[#2D3748] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F9FAFB] dark:bg-[#2D3748] border-b border-[#E5E7EB] dark:border-[#374151] sticky top-0">
                      <tr>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Date</th>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Category</th>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Note / Item</th>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Account</th>
                        <th className="p-2 font-semibold text-right text-[#6B7280] dark:text-[#9CA3AF]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6] dark:divide-[#2D3748]">
                      {parsedResult.expenses.slice(0, 6).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="p-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">{item.date}</td>
                          <td className="p-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-medium">
                              <span>{item.icon || '💳'}</span>
                              <span>{item.category}</span>
                            </span>
                          </td>
                          <td className="p-2 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate">
                            {item.name}
                            {item.notes && <span className="text-[10px] text-gray-400 block truncate">{item.notes}</span>}
                          </td>
                          <td className="p-2 text-gray-500 text-[11px] whitespace-nowrap">{item.paymentMethod || 'Other'}</td>
                          <td className="p-2 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Testing / Memory reassurance */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  <strong>Testing safe:</strong> All {parsedResult.expenses.length} expenses will be tagged with batch ID.
                  You can <strong>delete this entire sheet with 1-click</strong> anytime using the button in the Spending view!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6] dark:border-[#2D3748]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>

          {parsedResult && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>Confirm &amp; Import {parsedResult.expenses.length} Expenses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
