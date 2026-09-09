import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Filter,
  Check,
} from 'lucide-react';
import {
  parseExpensesFromExcel,
  ParsedSpreadsheetResult,
  deduplicateExpenses,
  DeduplicationResult,
} from '../utils/excelExpenseParser';
import { ExpenseItem, ExcelImportLog } from '../types';
import { Sound } from '../utils/audio';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    expenses: Array<Omit<ExpenseItem, 'id'>>,
    log: ExcelImportLog
  ) => void;
  existingExpenses: ExpenseItem[];
  soundEnabled: boolean;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingExpenses,
  soundEnabled,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedSpreadsheetResult | null>(null);
  const [dedupResult, setDedupResult] = useState<DeduplicationResult | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string>('');
  const [enableDeduplication, setEnableDeduplication] = useState<boolean>(true);
  const [previewTab, setPreviewTab] = useState<'new' | 'duplicates'>('new');
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
        setError(
          'No valid expense rows could be parsed. Check that the sheet has date, category, note, and amount/INR columns.'
        );
        setParsedResult(null);
        setDedupResult(null);
      } else {
        const dedup = deduplicateExpenses(result.expenses, existingExpenses);
        setParsedResult(result);
        setDedupResult(dedup);
        setPreviewTab(dedup.newCount > 0 ? 'new' : 'duplicates');
        Sound.success(soundEnabled);
      }
    } catch (err) {
      console.error('Failed to parse spreadsheet:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to read spreadsheet. Please ensure it is a valid .xlsx, .xls, or .csv file.'
      );
      setParsedResult(null);
      setDedupResult(null);
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

  const expensesToImport = (() => {
    if (!parsedResult || !dedupResult) return [];
    return enableDeduplication ? dedupResult.newExpenses : parsedResult.expenses;
  })();

  const totalAmountToImport = expensesToImport.reduce((sum, e) => sum + e.amount, 0);

  const handleConfirmImport = () => {
    if (!parsedResult || !dedupResult || expensesToImport.length === 0) return;
    Sound.success(soundEnabled);

    const log: ExcelImportLog = {
      id: currentBatchId,
      fileName: parsedResult.fileName,
      uploadDate: new Date().toISOString(),
      addedCount: expensesToImport.length,
      skippedCount: enableDeduplication ? dedupResult.duplicateCount : 0,
      totalRowsInSheet: parsedResult.expenses.length,
      totalAmountAdded: Math.round(totalAmountToImport),
      dateRange: parsedResult.dateRange,
      status: 'active',
    };

    onImportSuccess(expensesToImport, log);
    onClose();
  };

  const handleReset = () => {
    Sound.click(soundEnabled);
    setParsedResult(null);
    setDedupResult(null);
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

          {!parsedResult || !dedupResult ? (
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
                    {isLoading ? 'Parsing and checking for duplicates...' : 'Click to browse or drag and drop your spreadsheet'}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    Supports <b>.xlsx, .xls, .csv</b> (e.g. <i>Money Manager</i> report with Date, Category, Note, INR)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-[#2D3748] border border-[#E5E7EB] dark:border-[#4A5568] text-gray-600 dark:text-gray-300 font-mono">
                    Auto-detects Date (DD/MM/YYYY)
                  </span>
                  <span className="px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-[#2D3748] border border-[#E5E7EB] dark:border-[#4A5568] text-gray-600 dark:text-gray-300 font-mono">
                    Smart Deduplication Filter
                  </span>
                  <span className="px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-[#2D3748] border border-[#E5E7EB] dark:border-[#4A5568] text-gray-600 dark:text-gray-300 font-mono">
                    Batch History &amp; 1-Click Clear
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Parsed Summary & Deduplication Breakdown */
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {parsedResult.fileName}
                  </span>
                  <span className="text-gray-500 shrink-0">
                    ({parsedResult.expenses.length} total transactions)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  Change file
                </button>
              </div>

              {/* Deduplication Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                      New Spendings
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xl font-black text-emerald-900 dark:text-emerald-200 block mt-0.5">
                    +{dedupResult.newCount}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    ₹{dedupResult.newTotalAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
                      Duplicates Ignored
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-xl font-black text-amber-900 dark:text-amber-200 block mt-0.5">
                    {dedupResult.duplicateCount}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    ₹{dedupResult.duplicateTotalAmount.toLocaleString('en-IN')} skipped
                  </span>
                </div>

                <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block">
                    Date Range
                  </span>
                  <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block mt-1 truncate">
                    {parsedResult.dateRange ? `${parsedResult.dateRange.min} → ${parsedResult.dateRange.max}` : 'Multiple dates'}
                  </span>
                  {parsedResult.incomeCount > 0 && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">
                      ({parsedResult.incomeCount} income rows filtered)
                    </span>
                  )}
                </div>
              </div>

              {/* Deduplication Controls & Status */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={enableDeduplication}
                    onChange={(e) => setEnableDeduplication(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Smart Deduplication (Ignore rows already logged in spending)
                  </span>
                </label>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('new')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      previewTab === 'new'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    New Items ({dedupResult.newCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('duplicates')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      previewTab === 'duplicates'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Duplicates ({dedupResult.duplicateCount})
                  </button>
                </div>
              </div>

              {/* Zero New Items Notice */}
              {enableDeduplication && dedupResult.newCount === 0 && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Everything in this spreadsheet is already up to date!
                    </h4>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                      All {parsedResult.expenses.length} expenses match transactions already recorded in your spendings. No duplicate entries will be created. If you wish to re-import anyway, you can uncheck the deduplication box above.
                    </p>
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              <div>
                <div className="border border-[#E5E7EB] dark:border-[#2D3748] rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F9FAFB] dark:bg-[#2D3748] border-b border-[#E5E7EB] dark:border-[#374151] sticky top-0">
                      <tr>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Status</th>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Date</th>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Category</th>
                        <th className="p-2 font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Description / Note</th>
                        <th className="p-2 text-right font-semibold text-[#6B7280] dark:text-[#9CA3AF]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6] dark:divide-[#2D3748]">
                      {previewTab === 'new' ? (
                        (enableDeduplication ? dedupResult.newExpenses : parsedResult.expenses).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-gray-500">
                              No new items to import. All rows are already logged in your spendings.
                            </td>
                          </tr>
                        ) : (
                          (enableDeduplication ? dedupResult.newExpenses : parsedResult.expenses)
                            .slice(0, 10)
                            .map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="p-2 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    New
                                  </span>
                                </td>
                                <td className="p-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                  {item.date}
                                </td>
                                <td className="p-2 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-medium">
                                    <span>{item.icon || '💳'}</span>
                                    <span>{item.category}</span>
                                  </span>
                                </td>
                                <td className="p-2 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate">
                                  {item.name}
                                  {item.notes && (
                                    <span className="text-[10px] text-gray-400 block truncate">{item.notes}</span>
                                  )}
                                </td>
                                <td className="p-2 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                  ₹{item.amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))
                        )
                      ) : (
                        dedupResult.duplicateExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-gray-500">
                              No duplicate items detected! Every transaction in this sheet is brand new.
                            </td>
                          </tr>
                        ) : (
                          dedupResult.duplicateExpenses.slice(0, 10).map((dup, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 bg-amber-50/20">
                              <td className="p-2 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  Duplicate (Skipping)
                                </span>
                              </td>
                              <td className="p-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                {dup.item.date}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-medium">
                                  <span>{dup.item.icon || '💳'}</span>
                                  <span>{dup.item.category}</span>
                                </span>
                              </td>
                              <td className="p-2 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate">
                                <span>{dup.item.name}</span>
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 block truncate font-mono">
                                  {dup.reason}
                                </span>
                              </td>
                              <td className="p-2 text-right font-bold text-gray-500 line-through whitespace-nowrap">
                                ₹{dup.item.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        )
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 flex items-center justify-between">
                  <span>
                    Showing preview of {previewTab === 'new' ? (enableDeduplication ? dedupResult.newExpenses.length : parsedResult.expenses.length) : dedupResult.duplicateExpenses.length} transactions
                  </span>
                  <span>
                    Batch ID: <code className="font-mono text-[10px]">{currentBatchId}</code>
                  </span>
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
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {parsedResult && dedupResult && (
            expensesToImport.length > 0 ? (
              <button
                type="button"
                id="btn-confirm-import-spreadsheet"
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <span>Import {expensesToImport.length} New Spendings (₹{Math.round(totalAmountToImport).toLocaleString('en-IN')})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>All Up to Date (0 New Items)</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
