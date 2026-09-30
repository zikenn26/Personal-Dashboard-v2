import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, Plus, Trash2, ArrowUpRight, TrendingDown, TrendingUp, Calendar, Tag, DollarSign, Wallet, FileSpreadsheet, MessageSquare, Edit3, Settings, RotateCw, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
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
import { ExcelImportModal } from '../../../../components/ExcelImportModal';
import { getMatchingExpensesForSheet } from '../../../../components/ExpenseTracker';
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
  onClearAllExpenses?: () => void;
  onBatchAddExpenses?: (items: Array<Omit<ExpenseItem, 'id'>>, log?: ExcelImportLog) => void;
  onDeleteBatchExpenses?: (ids: string[]) => void;
  onDeleteImportLog?: (logId: string) => void;
  soundEnabled?: boolean;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Date-only values in the expense model represent a local calendar date.
 * Never use toISOString() for these values because it converts the date to UTC
 * and can move a local transaction to the previous/next calendar day.
 */
const pad2 = (value: number): string => String(value).padStart(2, '0');

const getLocalDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const normalizeExpenseDateKey = (value?: string | null): string => {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  // Preserve an existing YYYY-MM-DD date exactly, including ISO timestamps.
  const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) return dateOnlyMatch[1];

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : getLocalDateKey(parsed);
};

const getMondayDateKey = (date: Date): string => {
  const monday = new Date(date);
  const day = monday.getDay(); // Sunday = 0, Monday = 1, ... Saturday = 6
  const daysFromMonday = (day + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMonday);
  return getLocalDateKey(monday);
};

export const AndroidMoneyScreen: React.FC<AndroidMoneyScreenProps> = ({
  expenses,
  importLogs = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onOpenSmsSettings,
  onClearAllExpenses,
  onBatchAddExpenses,
  onDeleteBatchExpenses,
  onDeleteImportLog,
  soundEnabled = true,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<ExpenseItem | null>(null);
  const [activeActionExpense, setActiveActionExpense] = useState<ExpenseItem | null>(null);
  const [isRescanModalOpen, setIsRescanModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [showSheetLogs, setShowSheetLogs] = useState(false);
  const [deleteSheetModal, setDeleteSheetModal] = useState<{
    isOpen: boolean;
    log: ExcelImportLog | null;
    matchingCount: number;
    matchingAmount: number;
  }>({
    isOpen: false,
    log: null,
    matchingCount: 0,
    matchingAmount: 0,
  });

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
  const todayDateStr = getLocalDateKey(now);
  const weekStartDateStr = getMondayDateKey(now);
  const currentMonthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  // Spending totals are debit-only. Credits/refunds remain visible in the
  // transaction list but never inflate spending totals.
  const {
    todaySpending,
    weekSpending,
    monthSpending,
    allTimeSpending,
    monthCredits,
    categoryTotals,
  } = useMemo(() => {
    let todayDebits = 0;
    let weekDebits = 0;
    let monthDebits = 0;
    let allTimeDebits = 0;
    let monthCredits = 0;
    const catMap: Record<string, number> = {};

    const isInSelectedPeriod = (dateKey: string): boolean => {
      if (!dateKey) return false;

      switch (periodFilter) {
        case 'today':
          return dateKey === todayDateStr;
        case 'week':
          return dateKey >= weekStartDateStr && dateKey <= todayDateStr;
        case 'month':
          return dateKey.startsWith(currentMonthPrefix);
        case 'all':
          return true;
        default:
          return false;
      }
    };

    activeExpenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const dateKey = normalizeExpenseDateKey(e.date);
      const isCredit = isCreditTransaction(e);

      if (!dateKey) return;

      const isToday = dateKey === todayDateStr;
      const isThisWeek = dateKey >= weekStartDateStr && dateKey <= todayDateStr;
      const isThisMonth = dateKey.startsWith(currentMonthPrefix);

      if (isCredit) {
        if (isThisMonth) monthCredits += amt;
        return;
      }

      allTimeDebits += amt;
      if (isToday) todayDebits += amt;
      if (isThisWeek) weekDebits += amt;
      if (isThisMonth) monthDebits += amt;

      // Category breakdown follows the selected period so the category
      // pills and transaction list always describe the same time window.
      if (isInSelectedPeriod(dateKey)) {
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + amt;
      }
    });

    const sortedCats = Object.entries(catMap)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);

    return {
      todaySpending: todayDebits,
      weekSpending: weekDebits,
      monthSpending: monthDebits,
      allTimeSpending: allTimeDebits,
      monthCredits,
      categoryTotals: sortedCats,
    };
  }, [
    activeExpenses,
    periodFilter,
    todayDateStr,
    weekStartDateStr,
    currentMonthPrefix,
  ]);

  // The transaction list follows the selected period filter.
  // Credits are intentionally kept in the list; only spending totals exclude them.
  const filteredExpenses = useMemo(() => {
    return activeExpenses
      .filter((e) => {
        const dateKey = normalizeExpenseDateKey(e.date);
        if (!dateKey) return false;

        switch (periodFilter) {
          case 'today':
            if (dateKey !== todayDateStr) return false;
            break;
          case 'week':
            if (dateKey < weekStartDateStr || dateKey > todayDateStr) return false;
            break;
          case 'month':
            if (!dateKey.startsWith(currentMonthPrefix)) return false;
            break;
          case 'all':
            break;
        }

        if (selectedCategory !== 'all' && e.category !== selectedCategory) {
          return false;
        }

        return true;
      })
      .sort(compareExpensesByDateTimeDesc);
  }, [
    activeExpenses,
    periodFilter,
    selectedCategory,
    todayDateStr,
    weekStartDateStr,
    currentMonthPrefix,
  ]);

  // Group the filtered transactions by normalized local calendar date.
  const dateGroups = useMemo(() => {
    const yesterday = new Date(`${todayDateStr}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = getLocalDateKey(yesterday);

    const formatGroupDateLabel = (dateStr: string): string => {
      if (!dateStr) return 'Unknown Date';
      if (dateStr === todayDateStr) return 'Today';
      if (dateStr === yesterdayDateStr) return 'Yesterday';

      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return dateStr;

      return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
    };

    const groups: { key: string; label: string; items: ExpenseItem[] }[] = [];

    filteredExpenses.forEach((item) => {
      const dateKey = normalizeExpenseDateKey(item.date) || 'unknown';
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.key === dateKey) {
        lastGroup.items.push(item);
      } else {
        groups.push({
          key: dateKey,
          label: formatGroupDateLabel(dateKey),
          items: [item],
        });
      }
    });

    return groups;
  }, [filteredExpenses, todayDateStr]);
  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteExpense) onDeleteExpense(id);
  };

  const handleExcelImportSuccess = (
    newExpenses: Array<Omit<ExpenseItem, 'id'>>,
    log: ExcelImportLog
  ) => {
    setIsExcelModalOpen(false);
    if (onBatchAddExpenses) {
      onBatchAddExpenses(newExpenses, log);
    } else if (onAddExpense) {
      newExpenses.forEach((item) => onAddExpense(item));
    }
    toast.success(`Imported ${log.addedCount} spendings from ${log.fileName}!`);
  };

  const handleOpenDeleteSheet = (log: ExcelImportLog) => {
    void nativeService.triggerHaptic('warning');
    const matching = getMatchingExpensesForSheet(log, activeExpenses);
    const amount = matching.reduce((sum, item) => sum + (item.amount || 0), 0);
    setDeleteSheetModal({
      isOpen: true,
      log,
      matchingCount: matching.length,
      matchingAmount: amount,
    });
  };

  const handleConfirmDeleteSheet = (deleteSpendings: boolean) => {
    const log = deleteSheetModal.log;
    if (!log) return;
    void nativeService.triggerHaptic('warning');

    if (deleteSpendings) {
      const matching = getMatchingExpensesForSheet(log, activeExpenses);
      const matchingIds = matching.map((e) => e.id);
      if (onDeleteBatchExpenses && matchingIds.length > 0) {
        onDeleteBatchExpenses(matchingIds);
      } else if (matchingIds.length > 0 && onDeleteExpense) {
        matchingIds.forEach((id) => onDeleteExpense(id));
      }
    }

    if (onDeleteImportLog) {
      onDeleteImportLog(log.id);
    }

    setDeleteSheetModal({ isOpen: false, log: null, matchingCount: 0, matchingAmount: 0 });
    toast.success(`Deleted sheet "${log.fileName}"`);
  };

  const handleConfirmClearAll = () => {
    void nativeService.triggerHaptic('warning');
    if (onClearAllExpenses) {
      onClearAllExpenses();
    }
    setIsClearAllModalOpen(false);
    toast.success('All transactions cleared successfully');
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

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Compact SMS Status Chip */}
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
                <span>🟢 SMS ON</span>
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

          {/* Upload Excel Button */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsExcelModalOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
            title="Upload and extract expenses from Excel (.xlsx, .xls) or CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Upload Excel</span>
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

      {/* Uploaded Spreadsheets Management Banner (when sheets exist) */}
      {importLogs.length > 0 && (
        <div className="p-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Uploaded Spreadsheets ({importLogs.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSheetLogs(!showSheetLogs)}
              className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5 hover:underline cursor-pointer"
            >
              <span>{showSheetLogs ? 'Hide' : 'Manage'}</span>
              {showSheetLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showSheetLogs && (
            <div className="space-y-1.5 pt-1">
              {importLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#121826] border border-emerald-100 dark:border-emerald-900/40 text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="font-semibold text-gray-900 dark:text-white block truncate">
                      {log.fileName}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                      {log.addedCount} items · ₹{Math.round(log.totalAmountAdded || 0).toLocaleString()} · {log.uploadDate ? new Date(log.uploadDate).toLocaleDateString() : 'Imported'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDeleteSheet(log)}
                    className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors shrink-0"
                    title={`Delete spreadsheet ${log.fileName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spending Summary Card
          All four periods are calculated independently so selecting a filter
          never changes the meaning of the headline totals. */}
      <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">
              Spending Overview
            </span>
            <p className="text-[10px] text-emerald-100/80 mt-0.5">
              Debit spending only · credits/refunds excluded
            </p>
          </div>
          <div className="p-1.5 rounded-lg bg-white/15">
            <Wallet className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-white/15">
          <div>
            <span className="text-[10px] text-emerald-200 block font-medium">Today&apos;s Spending</span>
            <span className="text-sm font-black block mt-0.5">
              ₹{todaySpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-emerald-200 block font-medium">This Week&apos;s Spending</span>
            <span className="text-sm font-black block mt-0.5">
              ₹{weekSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-emerald-200 block font-medium">This Month&apos;s Spending</span>
            <span className="text-sm font-black block mt-0.5">
              ₹{monthSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-emerald-200 block font-medium">All-Time Spending</span>
            <span className="text-sm font-black block mt-0.5">
              ₹{allTimeSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {categoryTotals.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/15 flex items-center justify-between gap-2">
            <span className="text-[10px] text-emerald-200 font-medium">
              Top category ({periodFilter === 'today' ? 'Today' : periodFilter === 'week' ? 'This Week' : periodFilter === 'month' ? 'This Month' : 'All Time'})
            </span>
            <span className="text-[10px] font-bold truncate text-right" title={categoryTotals[0]?.cat}>
              {categoryTotals[0]
                ? `${categoryTotals[0].cat} · ₹${Math.round(categoryTotals[0].total).toLocaleString('en-IN')}`
                : 'None'}
            </span>
          </div>
        )}
      </div>

      {/* Period Filter Tabs — controls the transaction list and category breakdown */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] select-none">
        {(['today', 'week', 'month', 'all'] as PeriodFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setPeriodFilter(tab);
              // Avoid an apparently empty list if the old category is absent
              // from the newly selected time period.
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              periodFilter === tab
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {tab === 'today'
              ? 'Today'
              : tab === 'week'
                ? 'This Week'
                : tab === 'month'
                  ? 'This Month'
                  : 'All Time'}
          </button>
        ))}
      </div>

      {/* Category Breakdown Horizontal Pills */}
      {categoryTotals.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-1">
            Categories Filter
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
              All
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

      {/* Header bar with count and Clear All action */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
          Transactions ({filteredExpenses.length})
        </span>

        {activeExpenses.length > 0 && onClearAllExpenses && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsClearAllModalOpen(true);
            }}
            className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Clear all transactions"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Transactions List */}
      {filteredExpenses.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] space-y-3">
          <CreditCard className="w-10 h-10 text-emerald-400 mx-auto opacity-60" />
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No transactions in this period
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {periodFilter === 'today'
                ? 'No transactions were recorded today.'
                : periodFilter === 'week'
                  ? 'No transactions were recorded this week.'
                  : periodFilter === 'month'
                    ? 'No transactions were recorded this month.'
                    : 'No transactions have been recorded yet.'}
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
        <div className="space-y-4">
          {dateGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">
                {group.label}
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
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
            </div>
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

      {/* Excel Spreadsheet Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportSuccess={handleExcelImportSuccess}
        existingExpenses={expenses}
        soundEnabled={soundEnabled}
      />

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Clear All Transactions?
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              This will permanently delete all {activeExpenses.length} expense records. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Clear All Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Spreadsheet Confirmation Modal */}
      {deleteSheetModal.isOpen && deleteSheetModal.log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  Delete {deleteSheetModal.log.fileName}?
                </h3>
                <span className="text-[10px] text-gray-400 block truncate">
                  {deleteSheetModal.matchingCount} imported items (₹{Math.round(deleteSheetModal.matchingAmount).toLocaleString()})
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Choose how you would like to remove this spreadsheet:
            </p>
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmDeleteSheet(true)}
                className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer text-center"
              >
                Delete Sheet & Its Spendings
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteSheet(false)}
                className="w-full py-2 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Delete Sheet Record Only (Keep Spendings)
              </button>
              <button
                type="button"
                onClick={() => setDeleteSheetModal({ isOpen: false, log: null, matchingCount: 0, matchingAmount: 0 })}
                className="w-full py-1.5 px-3 rounded-xl text-gray-500 dark:text-gray-400 text-xs font-semibold hover:underline cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
