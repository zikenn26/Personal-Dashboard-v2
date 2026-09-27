import React from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { ExpenseItem } from '../../../types';
import {
  formatTransactionAmount,
  formatTransactionDateTime,
  getTransactionDisplayTitle,
  isCreditTransaction,
} from '../../../utils/expenseUtils';
import { nativeService } from '../../../services/nativeService';
import {
  CreditCard,
  Tag,
  Building2,
  Calendar,
  Hash,
  ArrowUpRight,
  ArrowDownLeft,
  Edit3,
  Trash2,
  CheckCircle2,
  FileText,
  MessageSquare,
} from 'lucide-react';

export interface TransactionDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseItem | null;
  onEdit?: (expense: ExpenseItem) => void;
  onDelete?: (expenseId: string) => void;
}

export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({
  isOpen,
  onClose,
  expense,
  onEdit,
  onDelete,
}) => {
  if (!expense) return null;

  const isCredit = isCreditTransaction(expense);
  const displayTitle = getTransactionDisplayTitle(expense);
  const formattedAmount = formatTransactionAmount(expense.amount);
  const formattedDateTime = formatTransactionDateTime(expense.date, expense.time);

  // Source label mapping
  const sourceLabel =
    expense.source === 'sms_auto'
      ? 'SMS Auto-logged'
      : expense.source === 'ai'
      ? 'AI Assistant'
      : expense.source === 'excel'
      ? 'Imported'
      : 'Manual Entry';

  // Bank display
  const bankName = expense.bankName || (expense.bankOrAccount?.includes('(') ? expense.bankOrAccount.split('(')[0].trim() : expense.bankOrAccount);

  // Masked Account display (ensure XX or •••• formatting)
  let accountDisplay = expense.maskedAccount;
  if (!accountDisplay && expense.accountLast4) {
    accountDisplay = `XX${expense.accountLast4}`;
  } else if (accountDisplay && /^\d{3,4}$/.test(accountDisplay)) {
    accountDisplay = `XX${accountDisplay}`;
  }

  // Dynamic metadata entries - ONLY include items that actually exist
  interface MetadataItem {
    id: string;
    label: string;
    value: string;
    icon: React.ReactNode;
  }

  const metadataItems: MetadataItem[] = [];

  // Category
  if (expense.category && expense.category !== 'Other') {
    metadataItems.push({
      id: 'category',
      label: 'Category',
      value: String(expense.category),
      icon: <Tag className="w-3.5 h-3.5 text-violet-500" />,
    });
  }

  // Payment Method
  if (expense.paymentMethod) {
    metadataItems.push({
      id: 'paymentMethod',
      label: 'Payment Method',
      value: String(expense.paymentMethod),
      icon: <CreditCard className="w-3.5 h-3.5 text-blue-500" />,
    });
  }

  // Bank
  if (bankName) {
    metadataItems.push({
      id: 'bank',
      label: 'Bank',
      value: bankName,
      icon: <Building2 className="w-3.5 h-3.5 text-emerald-500" />,
    });
  }

  // Masked Account
  if (accountDisplay) {
    metadataItems.push({
      id: 'account',
      label: 'Account',
      value: accountDisplay,
      icon: <Hash className="w-3.5 h-3.5 text-amber-500" />,
    });
  }

  // UPI Reference
  if (expense.upiReference) {
    metadataItems.push({
      id: 'upiRef',
      label: 'UPI Reference',
      value: expense.upiReference,
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />,
    });
  }

  // UTR (if distinct from upiReference)
  if (expense.utr && expense.utr !== expense.upiReference) {
    metadataItems.push({
      id: 'utr',
      label: 'UTR',
      value: expense.utr,
      icon: <Hash className="w-3.5 h-3.5 text-cyan-500" />,
    });
  }

  // RRN (if distinct from upiReference)
  if (expense.rrn && expense.rrn !== expense.upiReference && expense.rrn !== expense.utr) {
    metadataItems.push({
      id: 'rrn',
      label: 'RRN',
      value: expense.rrn,
      icon: <Hash className="w-3.5 h-3.5 text-cyan-500" />,
    });
  }

  // Transaction ID / Reference ID (if available and distinct from upiReference)
  const txnId = expense.referenceId || expense.smsReferenceId;
  if (txnId && txnId !== expense.upiReference && txnId !== expense.utr && txnId !== expense.rrn) {
    metadataItems.push({
      id: 'txnId',
      label: 'Transaction ID',
      value: txnId,
      icon: <Hash className="w-3.5 h-3.5 text-purple-500" />,
    });
  }

  // Source
  metadataItems.push({
    id: 'source',
    label: 'Source',
    value: sourceLabel,
    icon: <FileText className="w-3.5 h-3.5 text-slate-500" />,
  });

  const handleEditClick = () => {
    void nativeService.triggerHaptic('selection');
    onClose();
    if (onEdit) onEdit(expense);
  };

  const handleDeleteClick = () => {
    void nativeService.triggerHaptic('warning');
    onClose();
    if (onDelete) onDelete(expense.id);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Transaction Details">
      <div className="space-y-4 pb-2">
        {/* Header Block: Title, Amount, Date & Time, Direction */}
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-center space-y-2">
          {/* Merchant / Payee Title */}
          <h3 className="text-base font-bold text-gray-900 dark:text-white truncate px-2">
            {displayTitle}
          </h3>

          {/* Amount with Direction Indicator */}
          <div className="flex items-center justify-center gap-2">
            <span
              className={`text-2xl font-extrabold tracking-tight ${
                isCredit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {isCredit ? `+ ${formattedAmount}` : formattedAmount}
            </span>
          </div>

          {/* Date & Time */}
          {formattedDateTime && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formattedDateTime}</span>
            </div>
          )}

          {/* Direction Pill (Red / Green dot + text semantics) */}
          <div className="pt-1 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                isCredit
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCredit ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span>{isCredit ? 'Credit' : 'Debit'}</span>
              <span className="text-[10px] opacity-75 font-normal">
                {isCredit ? '• Money came in' : '• Money went out'}
              </span>
            </span>
          </div>
        </div>

        {/* Dynamic Metadata Grid (Only rendered if field exists) */}
        {metadataItems.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
              Transaction Metadata
            </h4>
            <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
              {metadataItems.map((item) => (
                <div
                  key={item.id}
                  className="py-2 px-1 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-gray-200 font-mono text-right max-w-[200px] truncate">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes (if present) */}
        {expense.notes && (
          <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-semibold mb-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Notes</span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {expense.notes}
            </p>
          </div>
        )}

        {/* Raw SMS Snippet (if auto-logged from SMS) */}
        {expense.rawSmsText && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px]">
            <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Original SMS Message:
            </span>
            <p className="text-slate-700 dark:text-slate-300 italic font-mono break-words leading-relaxed select-text">
              "{expense.rawSmsText}"
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={handleEditClick}
              className="flex-1 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer shadow-xs shadow-violet-500/20"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
