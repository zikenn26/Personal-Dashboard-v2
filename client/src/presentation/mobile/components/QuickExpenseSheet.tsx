import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { ExpenseItem } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import {
  Plus,
  CreditCard,
  Tag,
  Calendar,
  Building2,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Hash,
  Sparkles,
  FileText,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  isCreditTransaction,
  getTransactionDirection,
  getTransactionDisplayTitle,
  getAvailableTransactionMetadata,
  formatTransactionAmount,
} from '../../../utils/expenseUtils';

export interface QuickExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialExpense?: ExpenseItem | null;
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<ExpenseItem>) => void;
  onDeleteExpense?: (id: string) => void;
}

export const QuickExpenseSheet: React.FC<QuickExpenseSheetProps> = ({
  isOpen,
  onClose,
  initialExpense,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const isEditing = Boolean(initialExpense);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [directionState, setDirectionState] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [category, setCategory] = useState('Dining Out');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Credit Card' | 'Debit Card' | 'Cash' | 'Net Banking'>('UPI');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isEditFormExpanded, setIsEditFormExpanded] = useState(false);

  useEffect(() => {
    if (initialExpense) {
      setTitle(initialExpense.name || '');
      setAmount(initialExpense.amount ? String(initialExpense.amount) : '');
      setDirectionState(
        initialExpense.direction === 'CREDIT' || initialExpense.transactionType === 'CREDIT'
          ? 'CREDIT'
          : 'DEBIT'
      );
      setCategory(initialExpense.category || 'Dining Out');
      setPaymentMethod((initialExpense.paymentMethod as any) || 'UPI');
      setDate(initialExpense.date || new Date().toISOString().split('T')[0]);
      setNotes(initialExpense.notes || '');
      setIsEditFormExpanded(false);
    } else {
      setTitle('');
      setAmount('');
      setDirectionState('DEBIT');
      setCategory('Dining Out');
      setPaymentMethod('UPI');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setIsEditFormExpanded(true);
    }
  }, [initialExpense, isOpen]);

  const categories = [
    'Dining Out',
    'Groceries & Food',
    'Snacks & Coffee',
    'Shopping & Retail',
    'Taxi & Transit',
    'Bills & Utilities',
    'Living & Rent',
    'Tech & Subscriptions',
    'Entertainment',
    'Health & Fitness',
    'Education',
    'Travel & Leisure',
    'Personal Care',
    'Other',
  ];

  const paymentMethods: Array<'UPI' | 'Credit Card' | 'Debit Card' | 'Cash'> = [
    'UPI',
    'Credit Card',
    'Debit Card',
    'Cash',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const cleanTitle = title.trim();
    if (!cleanTitle || isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (isEditing && initialExpense && onUpdateExpense) {
      void nativeService.triggerHaptic('success');
      // Preserve all underlying SMS, reference, bank, and account metadata while applying selected direction
      onUpdateExpense(initialExpense.id, {
        name: cleanTitle,
        amount: parsedAmount,
        category,
        paymentMethod,
        date,
        notes: notes.trim(),
        direction: directionState,
        transactionType: directionState,
        referenceId: initialExpense.referenceId,
        smsReferenceId: initialExpense.smsReferenceId,
        upiReference: initialExpense.upiReference,
        bankName: initialExpense.bankName,
        bankOrAccount: initialExpense.bankOrAccount,
        maskedAccount: initialExpense.maskedAccount,
        accountLast4: initialExpense.accountLast4,
        source: initialExpense.source,
        rawSmsText: initialExpense.rawSmsText,
        time: initialExpense.time,
      });
      onClose();
    } else if (onAddExpense) {
      void nativeService.triggerHaptic('success');
      onAddExpense({
        name: cleanTitle,
        amount: parsedAmount,
        category,
        paymentMethod,
        date,
        billingCycle: 'one-time',
        active: true,
        direction: directionState,
        transactionType: directionState,
        source: 'manual',
        notes: notes.trim() || 'Added from Android quick access',
      });
      setTitle('');
      setAmount('');
      setDirectionState('DEBIT');
      setNotes('');
      onClose();
    }
  };

  const handleDelete = () => {
    if (!initialExpense || !onDeleteExpense) return;
    void nativeService.triggerHaptic('warning');
    onDeleteExpense(initialExpense.id);
    onClose();
  };

  // Transaction direction and metadata
  const direction = initialExpense ? getTransactionDirection(initialExpense) : 'DEBIT';
  const isCredit = direction === 'CREDIT';
  const displayTitle = initialExpense ? getTransactionDisplayTitle(initialExpense) : 'Add Expense';
  const metadataItems = initialExpense ? getAvailableTransactionMetadata(initialExpense) : [];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Transaction Detail' : 'Add Expense'}
      subtitle={isEditing ? 'View verified metadata or edit record' : 'Quickly track a spending transaction'}
    >
      <div className="space-y-4">
        {/* ========================================================================= */}
        {/* 1. TRANSACTION DETAIL HERO CARD (When Viewing Existing Transaction) */}
        {/* ========================================================================= */}
        {isEditing && initialExpense && (
          <div className="p-4 rounded-3xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] space-y-3">
            {/* Header: Title & Amount */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-base font-extrabold text-gray-900 dark:text-white block truncate">
                  {displayTitle}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{initialExpense.date}</span>
                  {initialExpense.time && <span>• {initialExpense.time}</span>}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xl font-black text-gray-900 dark:text-white block">
                  {formatTransactionAmount(initialExpense.amount)}
                </span>
                {/* Visual Direction Indicator: 🔴 Debit / 🟢 Credit */}
                <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  {isCredit ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Credit (Money In)</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Debit (Money Out)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Metadata Grid: Only populated fields are rendered! */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-2 text-xs">
              {metadataItems
                .filter((item) => item.key !== 'direction' && item.key !== 'notes')
                .map((item) => (
                  <div key={item.key} className="p-2 rounded-xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate block mt-0.5">
                      {item.value}
                    </span>
                  </div>
                ))}
            </div>

            {/* Notes if available */}
            {initialExpense.notes && (
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-xs">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Notes
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                  {initialExpense.notes}
                </p>
              </div>
            )}

            {/* Toggle Edit Form Button */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsEditFormExpanded(!isEditFormExpanded);
              }}
              className="w-full py-2 px-3 rounded-2xl bg-white dark:bg-[#121826] border border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950/40"
            >
              <span>{isEditFormExpanded ? 'Hide Edit Fields' : 'Edit Transaction Details'}</span>
              {isEditFormExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. TRANSACTION FORM (Add / Edit) */}
        {/* ========================================================================= */}
        {(!isEditing || isEditFormExpanded) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Transaction Type Segmented Control */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Transaction Type
              </label>
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-gray-100 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] gap-1">
                <button
                  type="button"
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setDirectionState('DEBIT');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    directionState === 'DEBIT'
                      ? 'bg-rose-500 text-white shadow-xs ring-1 ring-rose-600'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${directionState === 'DEBIT' ? 'bg-white' : 'bg-rose-500'}`} />
                  <span>Debit (Expense)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setDirectionState('CREDIT');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    directionState === 'CREDIT'
                      ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${directionState === 'CREDIT' ? 'bg-white' : 'bg-emerald-500'}`} />
                  <span>Credit (Income / Refund)</span>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="text-xl font-bold text-violet-600 dark:text-violet-400 absolute left-4 top-2.5">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus={!isEditing}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xl font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Merchant / Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Merchant / Description
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-violet-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Swiggy, Starbucks, Amazon"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Payment Method Pills */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {paymentMethods.map((method) => {
                  const isSelected = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        void nativeService.triggerHaptic('selection');
                        setPaymentMethod(method);
                      }}
                      className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-gray-50 dark:bg-[#1A2234] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Category
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or remarks"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Submit Actions */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={!title.trim() || !amount}
                className="w-full py-3 px-4 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Log Expense</span>
                  </>
                )}
              </button>

              {isEditing && onDeleteExpense && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full py-2.5 px-4 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Transaction</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  );
};
export default QuickExpenseSheet;
