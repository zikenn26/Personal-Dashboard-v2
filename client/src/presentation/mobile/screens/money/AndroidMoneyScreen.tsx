import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, Plus, Trash2, ArrowUpRight, TrendingDown, TrendingUp, Calendar, Tag, DollarSign, Wallet, FileSpreadsheet, MessageSquare, Edit3, Settings, RotateCw } from 'lucide-react';
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
import { ControlledSmsRescanModal } from '../../components/ControlledSmsRescanModal';
import { SmsExpenseModal } from '../../../../components/SmsExpenseModal';
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
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<ExpenseItem | null>(null);
  const [activeActionExpense, setActiveActionExpense] = useState<ExpenseItem | null>(null);
  const [isRescanModalOpen, setIsRescanModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Local reactive expenses mirror to ensure immediate display without requiring page reload
  const [localExpenses, setLocalExpenses] = useState<ExpenseItem[]>(expenses);

  useEffect(() => {
    setLocalExpenses(expenses);
  }, [expenses]);

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

    // Sync any pending background SMS messages when screen mounts
    void smsExpenseService.syncPendingBackgroundMessages();

    const handleSmsAutoLogged = (e?: Event) => {
      if (isMounted) {
        setIsSmsEnabled(true);
        setSmsPermissionStatus('granted');
        const customEvt = e as CustomEvent<{ updatedExpenses?: ExpenseItem[] }>;
        if (customEvt?.detail?.updatedExpenses && Array.isArray(customEvt.detail.updatedExpenses)) {
          setLocalExpenses(customEvt.detail.updatedExpenses);
        } else {
          setLocalExpenses(Storage.getExpenses());
        }
      }
    };

    const handleDashboardUpdated = (e?: Event) => {
      if (isMounted) {
        const customEvt = e as CustomEvent<{ module?: string; updatedExpenses?: ExpenseItem[] }>;
        if (!customEvt?.detail?.module || customEvt.detail.module === 'expenses') {
          if (customEvt?.detail?.updatedExpenses && Array.isArray(customEvt.detail.updatedExpenses)) {
            setLocalExpenses(customEvt.detail.updatedExpenses);
          } else {
            setLocalExpenses(Storage.getExpenses());
          }
        }
      }
    };

    window.addEventListener('sms_expense_auto_logged', handleSmsAutoLogged);
    window.addEventListener('dashboard-data-updated', handleDashboardUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('sms_expense_auto_logged', handleSmsAutoLogged);
      window.removeEventListener('dashboard-data-updated', handleDashboardUpdated);
    };
  }, []);

  // Synchronize localExpenses with incoming props
  useEffect(() => {
    if (expenses) {
      setLocalExpenses(expenses);
    }
  }, [expenses]);

  // Use localExpenses (which updates immediately upon SMS receipt) or fallback to props
  const activeExpenses = useMemo(() => {
    const source = localExpenses && localExpenses.length >= 0 ? localExpenses : expenses;
    return source.filter((e) => e.active !== false);
  }, [localExpenses, expenses]);

  const handleSmsAction = async () => {
    void nativeService.triggerHaptic('selection');
    
    // If permission is already granted and enabled, open the settings / test modal
    if (smsPermissionStatus === 'granted' && isSmsEnabled) {
      if (onOpenSmsSettings) {
        onOpenSmsSettings();
      } else {
        setIsSmsModalOpen(true);
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
        // Immediately sync any background pending messages without legacy full scan
        void smsExpenseService.syncPendingBackgroundMessages();
      } else if (res === 'denied') {
        setSmsPermissionStatus('denied');
        toast.info('SMS permission not granted', {
          description: 'You can tap the SMS status chip whenever you wish to enable auto-tracking.',
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

  // Calculations: Credits/refunds do not inflate total money spent
  const { totalMonthSpending, todaySpending, monthCredits, categoryTotals } = useMemo(() => {
    let monthDebits = 0;
    let monthCredits = 0;
    let todayDebits = 0;
    const catMap: Record<string, number> = {};

    activeExpenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const isCredit = isCreditTransaction(e);
      const d = new Date(e.date);
      const isThisMonth = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      const isToday = e.date === todayDateStr;

      if (isCredit) {
        if (isThisMonth) {
          monthCredits += amt;
        }
      } else {
        if (isThisMonth) {
          monthDebits += amt;
          const cat = e.category || 'Other';
          catMap[cat] = (catMap[cat] || 0) + amt;
        }
        if (isToday) {
          todayDebits += amt;
        }
      }
    });

    const sortedCats = Object.entries(catMap)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalMonthSpending: monthDebits,
      monthCredits,
      todaySpending: todayDebits,
      categoryTotals: sortedCats,
    };
  }, [activeExpenses, currentYear, currentMonth, todayDateStr]);

  // Filtered transactions sorted newest -> older by actual date & time
  const filteredExpenses = useMemo(() => {
    return activeExpenses
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
  }, [activeExpenses, periodFilter, selectedCategory, currentYear, currentMonth, todayDateStr]);

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
          {/* Compact SMS Status Chip (Not a primary action, opens SMS settings) */}
          <button
            type="button"
            onClick={handleSmsAction}
            className="px-2 py-1 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 shadow-2xs"
            title={
              smsPermissionStatus === 'granted' && isSmsEnabled
                ? 'SMS Auto-Logging ON — Tap for settings'
                : smsPermissionStatus === 'permanently_denied'
                ? 'SMS Permission Unavailable — Open Settings'
                : 'Enable SMS Auto-Logging'
            }
          >
            {smsPermissionStatus === 'granted' && isSmsEnabled ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 SMS Auto-Logging ON</span>
              </>
            ) : smsPermissionStatus === 'permanently_denied' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span>SMS Off</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Enable SMS</span>
              </>
            )}
          </button>

          {/* Primary Manual Rescan SMS Action Button */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsRescanModalOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
            title="Controlled SMS Rescan"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rescan SMS</span>
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
        <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] space-y-3">
          <CreditCard className="w-10 h-10 text-emerald-400 mx-auto opacity-60" />
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No transactions yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Your recent spending will appear here.
            </p>
          </div>
          {onAddExpense && (
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddSheetOpen(true);
              }}
              className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((item) => (
            <ExpenseItemRow
              key={item.id}
              expense={item}
              onTap={() => {
                void nativeService.triggerHaptic('selection');
                setEditingExpense(item);
              }}
              onSwipeDelete={() => {
                setConfirmDeleteExpense(item);
              }}
              onLongPress={() => setActiveActionExpense(item)}
            />
          ))}
        </div>
      )}

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

      {/* Controlled SMS Rescan Modal */}
      <ControlledSmsRescanModal
        isOpen={isRescanModalOpen}
        onClose={() => setIsRescanModalOpen(false)}
        onSuccess={(_result) => {
          const fresh = Storage.getExpenses();
          setLocalExpenses(fresh);
        }}
      />

      {/* SMS Expense Auto-Logger Settings Modal */}
      <SmsExpenseModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        soundEnabled={true}
        onOpenRescan={() => {
          setIsSmsModalOpen(false);
          setIsRescanModalOpen(true);
        }}
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

  const displayTitle = getTransactionDisplayTitle(expense);
  const isCredit = isCreditTransaction(expense);
  const secondaryParts = [
    expense.bankName || expense.bankOrAccount,
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
        className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all select-none shadow-2xs cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-800"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isCredit
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            <CreditCard className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Direction Indicator: 🔴 Debit / 🟢 Credit */}
              {isCredit ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Credit" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Debit" />
              )}
              <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                {displayTitle}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              <span className={isCredit ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                {isCredit ? 'Credit' : 'Debit'}
              </span>
              <span>•</span>
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
          <span className={`text-sm font-bold block ${
            isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
          }`}>
            {isCredit ? '+' : ''}₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
