import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, Plus, Trash2, ArrowUpRight, ArrowDownLeft, TrendingDown, TrendingUp, Calendar, Tag, DollarSign, Wallet, FileSpreadsheet, MessageSquare, Edit3, Settings } from 'lucide-react';
import { ExpenseItem, ExcelImportLog } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { smsExpenseService } from '../../../../services/smsExpenseService';
import { Storage } from '../../../../utils/storage';
import { toast } from 'sonner';
import { CARD_SURFACE_CLASSES } from '../../design-system/materialYou';
import { SwipeActionRow } from '../../gestures/SwipeActionRow';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { QuickExpenseSheet } from '../../components/QuickExpenseSheet';
import { TransactionDetailSheet } from '../../components/TransactionDetailSheet';
import { compareExpensesByDateTimeDesc, getTransactionDisplayTitle, isCreditTransaction } from '../../../../utils/expenseUtils';
import { SmsTransaction } from '../../../../services/smsExpenseService';
import { Capacitor } from '@capacitor/core';

export interface AndroidMoneyScreenProps {
  expenses: ExpenseItem[];
  importLogs?: ExcelImportLog[];
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<ExpenseItem>) => void;
  onDeleteExpense?: (id: string) => void;
  onOpenSmsSettings?: () => void;
}

type PeriodFilter = 'month' | 'today' | 'all';

export const AndroidMoneyScreen: React.FC<AndroidMoneyScreenProps> = ({
  expenses,
  importLogs = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onOpenSmsSettings,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [selectedDetailExpense, setSelectedDetailExpense] = useState<ExpenseItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<ExpenseItem | null>(null);
  const [activeActionExpense, setActiveActionExpense] = useState<ExpenseItem | null>(null);

  // Android SMS Auto-Logging State
  const [isSmsEnabled, setIsSmsEnabled] = useState<boolean>(() => {
    return Storage.isSmsAutoTrackingEnabled();
  });
  const [smsPermissionStatus, setSmsPermissionStatus] = useState<
    'prompt' | 'granted' | 'denied' | 'permanently_denied' | 'unsupported'
  >(() => {
    return Storage.isSmsAutoTrackingEnabled() ? 'granted' : 'prompt';
  });

  useEffect(() => {
    let isMounted = true;
    void smsExpenseService.checkPermission().then((status) => {
      if (isMounted) {
        setSmsPermissionStatus(status);
        setIsSmsEnabled(Storage.isSmsAutoTrackingEnabled() && status === 'granted');
      }
    });

    const handleSmsAutoLogged = () => {
      if (isMounted) {
        setIsSmsEnabled(true);
        setSmsPermissionStatus('granted');
      }
    };
    window.addEventListener('sms_expense_auto_logged', handleSmsAutoLogged);
    return () => {
      isMounted = false;
      window.removeEventListener('sms_expense_auto_logged', handleSmsAutoLogged);
    };
  }, []);

  const handleSmsAction = async () => {
    void nativeService.triggerHaptic('selection');
    
    // If permission is already granted and enabled, open the settings / test modal
    if (smsPermissionStatus === 'granted' && isSmsEnabled) {
      if (onOpenSmsSettings) {
        onOpenSmsSettings();
      }
      return;
    }

    // If permission is permanently denied, direct user to Android Settings
    if (smsPermissionStatus === 'permanently_denied') {
      try {
        if (Capacitor.isNativePlatform() && (SmsTransaction as any).openAppSettings) {
          await (SmsTransaction as any).openAppSettings();
        } else {
          toast.info('Please open Android Settings > Apps > LifeOS > Permissions to allow SMS.');
        }
      } catch {
        toast.info('Please enable SMS permission in device Settings.');
      }
      return;
    }

    // Direct permission request flow: Spending -> Allow SMS -> Android Permission Request
    try {
      const res = await smsExpenseService.requestPermission();
      if (res === 'granted') {
        setSmsPermissionStatus('granted');
        setIsSmsEnabled(true);
        toast.success('SMS Auto-Logging ON', {
          description: 'LifeOS will now automatically detect bank and UPI spendings.',
        });
        // Scan recent inbox once upon user grant
        void smsExpenseService.scanRecentInbox(25).then((summary) => {
          if (summary.imported > 0) {
            toast.info(`Imported ${summary.imported} unlogged transaction(s) from recent SMS`);
          }
        });
      } else if (res === 'denied') {
        setSmsPermissionStatus('denied');
        toast.info('SMS permission not granted', {
          description: 'You can tap Allow SMS whenever you wish to enable auto-tracking.',
        });
      } else if (res === 'prompt') {
        setSmsPermissionStatus('prompt');
      } else if (res === 'unsupported') {
        setSmsPermissionStatus('unsupported');
        toast.info('SMS Auto-Logging is an Android-exclusive feature.');
      }
    } catch {
      setSmsPermissionStatus('denied');
    }
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDateStr = now.toISOString().split('T')[0];

  // Calculations: Mathematical correctness - Total Spent does NOT include credits!
  const { totalMonthSpending, todaySpending, monthCredits, categoryTotals } = useMemo(() => {
    let monthDebitTotal = 0;
    let monthCreditTotal = 0;
    let todayDebitTotal = 0;
    const catMap: Record<string, number> = {};

    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const d = new Date(e.date);
      const isCredit = isCreditTransaction(e);

      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        if (isCredit) {
          monthCreditTotal += amt;
        } else {
          monthDebitTotal += amt;
        }
      }

      if (e.date === todayDateStr) {
        if (!isCredit) {
          todayDebitTotal += amt;
        }
      }

      // Category breakdown only includes DEBIT transactions
      if (!isCredit) {
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + amt;
      }
    });

    const sortedCats = Object.entries(catMap)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalMonthSpending: monthDebitTotal,
      todaySpending: todayDebitTotal,
      monthCredits: monthCreditTotal,
      categoryTotals: sortedCats,
    };
  }, [expenses, currentYear, currentMonth, todayDateStr]);

  // Filtered transactions sorted newest -> older by actual date & time
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (periodFilter === 'month') {
          const d = new Date(e.date);
          if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return false;
        } else if (periodFilter === 'today') {
          if (e.date !== todayDateStr) return false;
        }

        if (selectedCategory !== 'all' && e.category !== selectedCategory) {
          return false;
        }
        return true;
      })
      .sort(compareExpensesByDateTimeDesc);
  }, [expenses, periodFilter, selectedCategory, currentYear, currentMonth, todayDateStr]);

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteExpense) onDeleteExpense(id);
  };

  const actionItems: ActionSheetItem[] = activeActionExpense
    ? [
        {
          label: 'Edit Transaction',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => {
            setEditingExpense(activeActionExpense);
          },
        },
        {
          label: 'Delete Transaction',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => {
            setConfirmDeleteExpense(activeActionExpense);
          },
        },
      ]
    : [];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-1 space-y-2.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Money & Expenses
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {expenses.length} tracked records
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSmsAction}
            className={`px-2.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer ${
              smsPermissionStatus === 'granted' && isSmsEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : smsPermissionStatus === 'permanently_denied'
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
            title={
              smsPermissionStatus === 'granted' && isSmsEnabled
                ? 'SMS Auto-Logging ON — Tap to manage'
                : smsPermissionStatus === 'permanently_denied'
                ? 'SMS Permission Unavailable — Open Settings'
                : 'Allow SMS Auto-Logging'
            }
          >
            {smsPermissionStatus === 'granted' && isSmsEnabled ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>SMS Auto-Logging ON</span>
              </>
            ) : smsPermissionStatus === 'permanently_denied' ? (
              <>
                <Settings className="w-3.5 h-3.5 text-gray-500" />
                <span>Open Settings</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Allow SMS</span>
              </>
            )}
          </button>

          {onAddExpense && (
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddSheetOpen(true);
              }}
              className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Spending Summary Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
            Total Spending (This Month)
          </span>
          <div className="p-1.5 rounded-full bg-white/15">
            <Wallet className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="text-2xl font-black tracking-tight">
          ₹{totalMonthSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/15">
          <div>
            <span className="text-[11px] text-emerald-200 block">Today&apos;s Spend</span>
            <span className="text-sm font-bold">
              ₹{todaySpending.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-emerald-200 block">Top Category</span>
            <span className="text-sm font-bold truncate block">
              {categoryTotals[0]?.cat || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] select-none">
        {(['month', 'today', 'all'] as PeriodFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setPeriodFilter(tab);
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              periodFilter === tab
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            {tab === 'month' ? 'This Month' : tab === 'today' ? 'Today' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Category Breakdown Horizontal Pills */}
      {categoryTotals.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-1">
            Top Categories
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setSelectedCategory('all');
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
              }`}
            >
              All Categories
            </button>
            {categoryTotals.map(({ cat, total }) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
                }`}
              >
                {cat} · ₹{Math.round(total)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header bar with count */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
          Transactions ({filteredExpenses.length})
        </span>
      </div>

      {/* Transactions List */}
      {filteredExpenses.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
          <CreditCard className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
            No transactions recorded
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Tap &ldquo;Add&rdquo; to log your spending or import transactions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((item) => (
            <ExpenseItemRow
              key={item.id}
              expense={item}
              onTap={() => {
                void nativeService.triggerHaptic('selection');
                setSelectedDetailExpense(item);
              }}
              onSwipeDelete={() => {
                setConfirmDeleteExpense(item);
              }}
              onLongPress={() => setActiveActionExpense(item)}
            />
          ))}
        </div>
      )}

      {/* Transaction Detail Sheet */}
      <TransactionDetailSheet
        isOpen={Boolean(selectedDetailExpense)}
        onClose={() => setSelectedDetailExpense(null)}
        expense={selectedDetailExpense}
        onEdit={(item) => setEditingExpense(item)}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedDetailExpense(null);
        }}
      />

      {/* Add Expense Sheet */}
      {onAddExpense && (
        <QuickExpenseSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddExpense={onAddExpense}
        />
      )}

      {/* Edit Expense Sheet */}
      <QuickExpenseSheet
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        initialExpense={editingExpense}
        onUpdateExpense={onUpdateExpense}
        onDeleteExpense={(id) => {
          handleDelete(id);
          setEditingExpense(null);
        }}
      />

      {/* Safe Swipe Delete Confirmation Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(confirmDeleteExpense)}
        onClose={() => setConfirmDeleteExpense(null)}
        title="Delete Transaction?"
        subtitle={confirmDeleteExpense ? `Are you sure you want to delete "${confirmDeleteExpense.name}" (₹${confirmDeleteExpense.amount})?` : undefined}
        actions={
          confirmDeleteExpense
            ? [
                {
                  label: 'Delete Transaction',
                  icon: <Trash2 className="w-4 h-4" />,
                  isDestructive: true,
                  onClick: () => {
                    handleDelete(confirmDeleteExpense.id);
                    setConfirmDeleteExpense(null);
                  },
                },
              ]
            : []
        }
      />

      {/* Long-press Contextual Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionExpense)}
        onClose={() => setActiveActionExpense(null)}
        title={activeActionExpense?.name || 'Expense Options'}
        subtitle={`Amount: ₹${Number(activeActionExpense?.amount || 0).toLocaleString()} · ${activeActionExpense?.category} · ${activeActionExpense?.date}`}
        actions={actionItems}
      />
    </div>
  );
};

interface ExpenseItemRowProps {
  expense: ExpenseItem;
  onTap: () => void;
  onSwipeDelete: () => void;
  onLongPress: () => void;
}

const ExpenseItemRow: React.FC<ExpenseItemRowProps> = ({
  expense,
  onTap,
  onSwipeDelete,
  onLongPress,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  const isCredit = isCreditTransaction(expense);
  const displayTitle = getTransactionDisplayTitle(expense);
  const secondaryParts = [
    expense.bankName || (expense.bankOrAccount?.includes('(') ? expense.bankOrAccount.split('(')[0].trim() : expense.bankOrAccount),
    expense.paymentMethod,
    expense.maskedAccount,
  ].filter(Boolean);

  return (
    <SwipeActionRow
      onSwipeLeft={onSwipeDelete}
      rightActionContent={<Trash2 className="w-5 h-5" />}
      rightActionColor="bg-rose-600"
    >
      <div
        {...longPressProps}
        onClick={onTap}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all select-none shadow-2xs cursor-pointer hover:border-violet-300 dark:hover:border-violet-800"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isCredit
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
            }`}
          >
            {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Direction Indicator: 🔴 RED DOT for DEBIT, 🟢 GREEN DOT for CREDIT */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isCredit ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                title={isCredit ? 'Credit (Money came in)' : 'Debit (Money went out)'}
              />
              <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                {displayTitle}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-wider ${
                  isCredit
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {isCredit ? 'Credit' : 'Debit'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate">
              <span>{expense.category}</span>
              {secondaryParts.length > 0 && (
                <>
                  <span>•</span>
                  <span className="truncate">{secondaryParts.join(' • ')}</span>
                </>
              )}
              <span>•</span>
              <span className="shrink-0">{expense.date}{expense.time ? ` ${expense.time}` : ''}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`text-sm font-bold block ${
              isCredit
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {isCredit ? '+ ' : ''}₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {expense.bankOrAccount && (
            <span className="text-[10px] text-gray-400 block truncate max-w-[90px]">
              {expense.bankOrAccount}
            </span>
          )}
        </div>
      </div>
    </SwipeActionRow>
  );
};
