import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Check,
  Smartphone,
  Layers,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  smsExpenseService,
  SmsTransactionCandidate,
  SmsRescanResult,
} from '../../../services/smsExpenseService';
import { nativeService } from '../../../services/nativeService';
import { Sound } from '../../../utils/audio';
import { Storage } from '../../../utils/storage';
import { toast } from 'sonner';

export interface ControlledSmsRescanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: SmsRescanResult) => void;
}

type RescanStep =
  | 'select_count'
  | 'scanning'
  | 'review_candidates'
  | 'logging'
  | 'result_summary';

const COUNT_OPTIONS: Array<10 | 20 | 30 | 50> = [10, 20, 30, 50];

export const ControlledSmsRescanModal: React.FC<ControlledSmsRescanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<RescanStep>('select_count');
  const [selectedCount, setSelectedCount] = useState<10 | 20 | 30 | 50>(20);
  const [candidates, setCandidates] = useState<SmsTransactionCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescanResult, setRescanResult] = useState<SmsRescanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep('select_count');
      setSelectedCount(20);
      setCandidates([]);
      setSelectedIds(new Set());
      setRescanResult(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = async (count: 10 | 20 | 30 | 50) => {
    void nativeService.triggerHaptic('selection');
    setSelectedCount(count);
    setStep('scanning');
    setIsProcessing(true);

    try {
      const items = await smsExpenseService.getRecentTransactionCandidates(count);
      setCandidates(items);
      // Pre-select new transactions by default (user can toggle any)
      const initialSelected = new Set<string>();
      items.forEach((c) => {
        if (!c.isExisting) {
          initialSelected.add(c.id);
        }
      });
      // If all are existing, select all so user can choose
      if (initialSelected.size === 0 && items.length > 0) {
        items.forEach((c) => initialSelected.add(c.id));
      }
      setSelectedIds(initialSelected);
      setStep('review_candidates');
    } catch (err: any) {
      console.error('Failed to get transaction candidates:', err);
      toast.error('Could not scan SMS inbox: ' + (err?.message || 'Permission or device error'));
      setStep('select_count');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCandidate = (id: string) => {
    void nativeService.triggerHaptic('selection');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    void nativeService.triggerHaptic('selection');
    const all = new Set<string>();
    candidates.forEach((c) => all.add(c.id));
    setSelectedIds(all);
  };

  const handleClearAll = () => {
    void nativeService.triggerHaptic('selection');
    setSelectedIds(new Set());
  };

  const handleLogSelected = async () => {
    if (selectedIds.size === 0) return;
    void nativeService.triggerHaptic('impactMedium');
    setStep('logging');
    setIsProcessing(true);

    const chosen = candidates.filter((c) => selectedIds.has(c.id));
    try {
      const result = await smsExpenseService.logSelectedCandidates(chosen);
      setRescanResult(result);
      setStep('result_summary');

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      console.error('Error logging selected candidates:', err);
      toast.error('Failed to log selected SMS: ' + (err?.message || 'Storage error'));
      setStep('review_candidates');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    void nativeService.triggerHaptic('click');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#131722] rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <RotateCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Rescan Bank SMS
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {step === 'select_count' && 'Controlled Transaction Scan'}
                {step === 'scanning' && 'Scanning device inbox...'}
                {step === 'review_candidates' && 'Review & Select Transactions'}
                {step === 'logging' && 'Processing selection...'}
                {step === 'result_summary' && 'Rescan Complete'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* STEP 1: Select Count */}
          {step === 'select_count' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-purple-900 dark:text-purple-200">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    LifeOS will scan genuine banking transaction SMS, sort them from newest to oldest, and let you manually select which transactions to log.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  How many recent transaction SMS should be scanned?
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleStartScan(count)}
                      className={`py-3 rounded-2xl font-black text-sm border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        selectedCount === count
                          ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/25'
                          : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <span>{count}</span>
                      <span className="text-[10px] font-normal opacity-80">SMS</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                  Maximum = 50 recent transaction SMS
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Scanning */}
          {step === 'scanning' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Scanning Recent Transaction SMS...
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Retrieving candidate transactions up to {selectedCount}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Review Candidates */}
          {step === 'review_candidates' && (
            <div className="space-y-3">
              {/* Batch Actions & Counter */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                  {selectedIds.size} of {candidates.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-gray-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {candidates.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Smartphone className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    No Transaction SMS Found
                  </p>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    No financial transaction messages were found in the scanned SMS range.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {candidates.map((cand) => {
                    const isSelected = selectedIds.has(cand.id);
                    return (
                      <div
                        key={cand.id}
                        onClick={() => handleToggleCandidate(cand.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                            : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection Checkbox */}
                          <div
                            className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-all shrink-0 ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {cand.payee || cand.merchant}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    cand.direction === 'CREDIT' ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                  title={cand.direction === 'CREDIT' ? 'Credit' : 'Debit'}
                                />
                                <span className="text-sm font-black text-gray-900 dark:text-white">
                                  {cand.currency}
                                  {cand.amount.toLocaleString('en-IN', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Sub details */}
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>{cand.bankName}</span>
                              <span>•</span>
                              <span>{cand.paymentMethod}</span>
                              {cand.referenceId && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">{cand.referenceId}</span>
                                </>
                              )}
                            </div>

                            {/* Date & Preview */}
                            <div className="flex items-center justify-between text-[10px] text-gray-400">
                              <span>
                                {cand.date} {cand.time ? `• ${cand.time}` : ''}
                              </span>
                              {cand.isExisting && (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 font-semibold">
                                  Already in Spending
                                </span>
                              )}
                            </div>

                            {/* Raw Preview Snippet */}
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic line-clamp-1 border-t border-gray-100 dark:border-gray-800 pt-1 mt-1">
                              {cand.preview}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Logging in Progress */}
          {step === 'logging' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Logging Selected Transactions...
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Persisting into canonical Spending database and verifying storage
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Result Summary */}
          {step === 'result_summary' && rescanResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 text-center space-y-1.5">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Rescan Summary
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your selected transactions have been processed deterministically.
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 block text-[11px]">SMS scanned</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    {rescanResult.scanned}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 block text-[11px]">Transactions found</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    {rescanResult.transactionsFound}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 block text-[11px]">Selected by you</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    {rescanResult.selected}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-semibold">
                    Imported
                  </span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                    {rescanResult.imported}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                  <span className="text-amber-700 dark:text-amber-300 block text-[11px] font-semibold">
                    Already existing
                  </span>
                  <span className="text-base font-bold text-amber-700 dark:text-amber-300">
                    {rescanResult.alreadyExisting}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 block text-[11px]">Failed</span>
                  <span className={`text-base font-bold ${rescanResult.failed > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {rescanResult.failed}
                  </span>
                </div>
              </div>

              {/* Failures List if any */}
              {rescanResult.failures.length > 0 && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-1">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300 block">
                    Failure details:
                  </span>
                  <ul className="text-[11px] text-red-600 dark:text-red-400 space-y-1 list-disc pl-4">
                    {rescanResult.failures.map((f, i) => (
                      <li key={i}>{f.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-gray-900/40">
          {step === 'review_candidates' && (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogSelected}
                disabled={isProcessing || selectedIds.size === 0}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Log Selected ({selectedIds.size})
              </button>
            </>
          )}

          {step === 'result_summary' && (
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer text-center"
            >
              Done • View in Spending
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
