import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Calendar,
  Wallet,
  FileSpreadsheet,
  Edit3,
  RotateCw,
  RotateCcw,
  X,
  ChevronDown,
  Download,
  Share2,
  Search,
  Sparkles,
  ArrowLeft,
  Utensils,
  ShoppingBag,
  DollarSign,
  Upload,
} from 'lucide-react';
import { ExpenseItem, ExcelImportLog } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { smsExpenseService } from '../../../../services/smsExpenseService';
import { Storage } from '../../../../utils/storage';
import { toast } from 'sonner';
import { SwipeActionRow } from '../../gestures/SwipeActionRow';
import { useLongPress } from '../../gestures/useLongPress';
import { BottomSheet } from '../../gestures/BottomSheet';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { QuickExpenseSheet } from '../../components/QuickExpenseSheet';
import { ControlledSmsRescanModal } from '../../components/ControlledSmsRescanModal';
import { ExportExpenseSheet } from '../../components/ExportExpenseSheet';
import { SmsExpenseModal } from '../../../../components/SmsExpenseModal';
import { ExcelImportModal } from '../../../../components/ExcelImportModal';
import { getMatchingExpensesForSheet } from '../../../../components/ExpenseTracker';
import {
  compareExpensesByDateTimeDesc,
  getTransactionDisplayTitle,
  isCreditTransaction,
} from '../../../../utils/expenseUtils';
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
  profile?: any;
  onOpenProfile?: () => void;
  onOpenAssistant?: () => void;
  onBack?: () => void;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad2 = (value: number): string => String(value).padStart(2, '0');

const getLocalDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const normalizeExpenseDateKey = (value?: string | null): string => {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

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

const getCategoryStyle = (category?: string, isCredit?: boolean) => {
  if (isCredit) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60',
      Icon: CreditCard,
    };
  }
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('snack') || cat.includes('hunger') || cat.includes('swiggy') || cat.includes('zomato')) {
    return {
      bg: 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/60',
      Icon: Utensils,
    };
  }
  if (cat.includes('travel') || cat.includes('leisure') || cat.includes('transport') || cat.includes('cab') || cat.includes('uber') || cat.includes('ola') || cat.includes('leh')) {
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/60',
      Icon: CreditCard,
    };
  }
  if (cat.includes('shop') || cat.includes('cloth') || cat.includes('grocer') || cat.includes('mart') || cat.includes('amazon')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/60',
      Icon: ShoppingBag,
    };
  }
  if (cat.includes('bill') || cat.includes('utilit') || cat.includes('recharge') || cat.includes('electr')) {
    return {
      bg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/60',
      Icon: DollarSign,
    };
  }
  return {
    bg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/60',
    Icon: CreditCard,
  };
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
  profile,
  onOpenProfile,
  onOpenAssistant,
  onBack,
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
  const [isExcelMenuOpen, setIsExcelMenuOpen] = useState(false);
  const [isUploadedSheetsOpen, setIsUploadedSheetsOpen] = useState(false);
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isHeaderSearchOpen, setIsHeaderSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Local reactive expenses mirror
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

  const now = new Date();
  const todayDateStr = getLocalDateKey(now);
  const weekStartDateStr = getMondayDateKey(now);
  const currentMonthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const [selectedMonthPrefix, setSelectedMonthPrefix] = useState<string>(() => currentMonthPrefix);

  useEffect(() => {
    let isMounted = true;
    void smsExpenseService.checkPermission().then((status) => {
      if (isMounted) {
        setSmsPermissionStatus(status);
        setIsSmsEnabled(Storage.isSmsAutoTrackingEnabled() && status === 'granted');
      }
    });

    void smsExpenseService.syncPendingBackgroundMessages();

    const handleSmsAutoLogged = (e?: Event) => {
      if (isMounted) {
        setIsSmsEnabled(true);
        setSmsPermissionStatus('granted');
        const customEvt = e as CustomEvent<{ updatedExpenses?: ExpenseItem[]; expense?: ExpenseItem }>;
        const fresh =
          customEvt?.detail?.updatedExpenses && Array.isArray(customEvt.detail.updatedExpenses)
            ? customEvt.detail.updatedExpenses
            : Storage.getExpenses();
        setLocalExpenses(fresh);
        setSelectedMonthPrefix(currentMonthPrefix);
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
  }, [currentMonthPrefix]);

  const activeExpenses = useMemo(() => {
    const source = localExpenses && localExpenses.length >= 0 ? localExpenses : expenses;
    return source.filter((e) => e.active !== false);
  }, [localExpenses, expenses]);

  const handleSmsAction = async () => {
    void nativeService.triggerHaptic('selection');

    if (smsPermissionStatus === 'granted' && isSmsEnabled) {
      if (onOpenSmsSettings) {
        onOpenSmsSettings();
      } else {
        setIsSmsModalOpen(true);
      }
      return;
    }

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

    try {
      const res = await smsExpenseService.requestPermission();
      if (res === 'granted') {
        setSmsPermissionStatus('granted');
        setIsSmsEnabled(true);
        toast.success('SMS Auto-Logging ON', {
          description: 'LifeOS will now automatically detect bank and UPI spendings.',
        });
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

  const formatMonthLabel = (prefix: string): string => {
    if (!prefix || prefix.length < 7) return prefix;
    const [yearStr, monthStr] = prefix.split('-');
    const mIdx = parseInt(monthStr, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${MONTH_ABBR[mIdx]} ${yearStr}`;
    }
    return prefix;
  };

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    monthSet.add(currentMonthPrefix);
    activeExpenses.forEach((e) => {
      const dateKey = normalizeExpenseDateKey(e.date);
      if (dateKey && dateKey.length >= 7) {
        monthSet.add(dateKey.slice(0, 7));
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [activeExpenses, currentMonthPrefix]);

  // Spending totals are debit-only
  const {
    todaySpending,
    weekSpending,
    selectedMonthSpending,
    allTimeSpending,
  } = useMemo(() => {
    let todayDebits = 0;
    let weekDebits = 0;
    let selectedMonthDebits = 0;
    let allTimeDebits = 0;

    activeExpenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const dateKey = normalizeExpenseDateKey(e.date);
      const isDebit = !isCreditTransaction(e);

      if (isDebit) {
        allTimeDebits += amt;

        if (dateKey === todayDateStr) {
          todayDebits += amt;
        }

        if (dateKey >= weekStartDateStr && dateKey <= todayDateStr) {
          weekDebits += amt;
        }

        if (dateKey.startsWith(selectedMonthPrefix)) {
          selectedMonthDebits += amt;
        }
      }
    });

    return {
      todaySpending: todayDebits,
      weekSpending: weekDebits,
      selectedMonthSpending: selectedMonthDebits,
      allTimeSpending: allTimeDebits,
    };
  }, [activeExpenses, todayDateStr, weekStartDateStr, selectedMonthPrefix]);

  // The transaction list follows the selected period filter
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
            if (!dateKey.startsWith(selectedMonthPrefix)) return false;
            break;
          case 'all':
            break;
        }

        if (selectedCategory !== 'all' && e.category !== selectedCategory) {
          return false;
        }

        // Search query filter (when top header search is used)
        if (isHeaderSearchOpen && searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = (e.name || '').toLowerCase().includes(q);
          const catMatch = (e.category || '').toLowerCase().includes(q);
          const notesMatch = (e.notes || '').toLowerCase().includes(q);
          const bankMatch = (e.bankOrAccount || '').toLowerCase().includes(q);
          const merchantMatch = (e.merchant || '').toLowerCase().includes(q);
          const payeeMatch = (e.payee || '').toLowerCase().includes(q);
          const methodMatch = (e.paymentMethod || '').toLowerCase().includes(q);
          const refMatch = (e.referenceId || '').toLowerCase().includes(q);
          const amountMatch = String(e.amount || '').includes(q);
          const dateMatch = (e.date || '').includes(q);
          if (!nameMatch && !catMatch && !notesMatch && !bankMatch && !merchantMatch && !payeeMatch && !methodMatch && !refMatch && !amountMatch && !dateMatch) {
            return false;
          }
        }

        return true;
      })
      .sort(compareExpensesByDateTimeDesc);
  }, [
    activeExpenses,
    periodFilter,
    selectedMonthPrefix,
    selectedCategory,
    isHeaderSearchOpen,
    searchQuery,
    todayDateStr,
    weekStartDateStr,
  ]);

  // Group transactions by date
  const dateGroups = useMemo(() => {
    const yesterday = new Date(`${todayDateStr}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = getLocalDateKey(yesterday);

    const formatGroupDateLabel = (dateStr: string): string => {
      if (!dateStr) return 'UNKNOWN DATE';
      if (dateStr === todayDateStr) return 'TODAY';
      if (dateStr === yesterdayDateStr) return 'YESTERDAY';

      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return dateStr.toUpperCase();

      return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]?.toUpperCase()} ${d.getFullYear()}`;
    };

    const groups: { key: string; label: string; items: ExpenseItem[]; total: number }[] = [];

    filteredExpenses.forEach((item) => {
      const dateKey = normalizeExpenseDateKey(item.date) || 'unknown';
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.key === dateKey) {
        lastGroup.items.push(item);
        lastGroup.total += Number(item.amount) || 0;
      } else {
        groups.push({
          key: dateKey,
          label: formatGroupDateLabel(dateKey),
          items: [item],
          total: Number(item.amount) || 0,
        });
      }
    });

    return groups;
  }, [filteredExpenses, todayDateStr]);

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    setLocalExpenses((prev) => prev.filter((e) => e.id !== id));
    if (onDeleteExpense) onDeleteExpense(id);
  };

  const handleExcelImportSuccess = (
    newExpenses: Array<Omit<ExpenseItem, 'id'>>,
    log: ExcelImportLog
  ) => {
    setIsExcelModalOpen(false);
    Storage.removeDeletedSheet(log.id, log.fileName);
    if (onBatchAddExpenses) {
      onBatchAddExpenses(newExpenses, log);
    } else if (onAddExpense) {
      newExpenses.forEach((item) => onAddExpense(item));
    }
    setLocalExpenses(Storage.getExpenses());
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
      setLocalExpenses((prev) => prev.filter((e) => !matchingIds.includes(e.id)));
      if (onDeleteBatchExpenses && matchingIds.length > 0) {
        onDeleteBatchExpenses(matchingIds);
      } else if (matchingIds.length > 0 && onDeleteExpense) {
        matchingIds.forEach((id) => onDeleteExpense(id));
      }
      Storage.addDeletedSheet(log.id, log.fileName);
    } else {
      // Disassociate retained spendings from the deleted sheet so they remain permanent independent records
      const matching = getMatchingExpensesForSheet(log, activeExpenses);
      if (matching.length > 0 && onUpdateExpense) {
        matching.forEach((e) => {
          onUpdateExpense(e.id, { importBatchId: undefined, sourceFile: undefined });
        });
      }
      Storage.removeDeletedSheet(log.id, log.fileName);
    }

    if (onDeleteImportLog) {
      onDeleteImportLog(log.id);
    }

    setDeleteSheetModal({ isOpen: false, log: null, matchingCount: 0, matchingAmount: 0 });
    toast.success(deleteSpendings ? `Deleted sheet "${log.fileName}" and removed transactions` : `Removed "${log.fileName}" from upload history (spendings kept)`);
  };

  const handleConfirmClearAll = () => {
    void nativeService.triggerHaptic('warning');
    if (onClearAllExpenses) {
      onClearAllExpenses();
    }
    setIsClearAllModalOpen(false);
    toast.success('All transactions cleared successfully');
  };

  const handleShareSingleExpense = (item: ExpenseItem) => {
    void nativeService.triggerHaptic('selection');
    const isCredit = isCreditTransaction(item);
    const dateFormatted = item.date || 'N/A';
    const timeFormatted = item.time ? ` at ${item.time}` : '';
    const shareText = `Transaction Details:\nMerchant: ${getTransactionDisplayTitle(item)}\nAmount: ₹${Number(item.amount || 0).toFixed(2)} (${isCredit ? 'CREDIT' : 'DEBIT'})\nCategory: ${item.category}\nDate: ${dateFormatted}${timeFormatted}${item.paymentMethod ? `\nPayment: ${item.paymentMethod}` : ''}${item.bankOrAccount ? `\nAccount: ${item.bankOrAccount}` : ''}${item.referenceId ? `\nRef: ${item.referenceId}` : ''}${item.notes ? `\nNotes: ${item.notes}` : ''}`;

    void nativeService.shareContent({
      title: `${getTransactionDisplayTitle(item)} - ₹${Number(item.amount || 0).toFixed(2)}`,
      text: shareText,
    });
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
          label: 'Share / Export Transaction',
          icon: <Share2 className="w-4 h-4" />,
          onClick: () => {
            handleShareSingleExpense(activeActionExpense);
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
    <div className="w-full max-w-lg mx-auto min-h-screen flex flex-col bg-slate-50 dark:bg-[#0b111e] text-slate-850 dark:text-slate-100 antialiased pb-24 relative select-none">
      {/* BEGIN: TopStickyHeader */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 pt-[env(safe-area-inset-top,0px)] pb-2.5">
        {/* Topmost Row: Back, Breadcrumb Title & Profile Avatar */}
        <div className="h-11 sm:h-12 flex items-center justify-between gap-3 max-w-lg mx-auto mb-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label="Go back"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                if (onBack) {
                  onBack();
                } else {
                  window.dispatchEvent(new CustomEvent('navigate-view', { detail: { view: 'home' } }));
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[15px] font-semibold text-slate-900 dark:text-white tracking-tight font-sans whitespace-nowrap leading-none m-0 p-0">
                Money &amp; Spending
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-100/70 dark:border-violet-900/60 shrink-0">
                {activeExpenses.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Assistant / Sparks trigger */}
            <button
              type="button"
              aria-label="AI Insights"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                if (onOpenAssistant) {
                  onOpenAssistant();
                } else {
                  toast.info('Smart Spending Insights', {
                    description: `You have spent ₹${Number(weekSpending).toLocaleString('en-IN', { maximumFractionDigits: 0 })} this week across ${filteredExpenses.length} transactions.`,
                  });
                }
              }}
              className="w-7 h-7 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Search Icon Button */}
            <button
              type="button"
              aria-label="Search"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsHeaderSearchOpen((prev) => !prev);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isHeaderSearchOpen
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4 stroke-[2.2]" />
            </button>

            {/* User Avatar */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                if (onOpenProfile) {
                  onOpenProfile();
                } else {
                  window.dispatchEvent(new CustomEvent('navigate-view', { detail: { view: 'workfolio' } }));
                }
              }}
              className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 p-[1.5px] cursor-pointer shrink-0"
              aria-label="Profile"
            >
              <div className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Header Search Field (Only visible when user taps Search icon in top header) */}
        {isHeaderSearchOpen && (
          <div className="relative mb-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spending, merchants, categories, amount..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsHeaderSearchOpen(false)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Close search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Compact Top Actions Bar (Horizontal Scroll / Compact layout) */}
        <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Export Button */}
            <button
              type="button"
              id="btn-android-export-expenses"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsExportSheetOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-600 dark:text-slate-400" />
              <span>Export</span>
            </button>

            {/* Excel Button */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsExcelMenuOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
              {importLogs.length > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                  {importLogs.length}
                </span>
              )}
            </button>

            {/* Rescan */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsRescanModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 border border-violet-100 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 active:scale-95 transition-all cursor-pointer"
            >
              <RotateCw className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              <span>Rescan</span>
            </button>

            {/* SMS Sync Status Pill */}
            <button
              type="button"
              onClick={handleSmsAction}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-95 transition-all"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSmsEnabled && smsPermissionStatus === 'granted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isSmsEnabled && smsPermissionStatus === 'granted' ? 'SMS ON' : 'SMS OFF'}</span>
            </button>
          </div>
        </div>
      </header>
      {/* END: TopStickyHeader */}

      {/* BEGIN: MainContent */}
      <main className="flex-1 px-3.5 pt-2 pb-6 space-y-3">
        {/* Stats & Quick Action Bar */}
        <div className="flex items-center justify-between px-1 pt-0.5 pb-0.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {filteredExpenses.length} transactions · ₹{Number(weekSpending).toLocaleString('en-IN', { maximumFractionDigits: 0 })} this week
          </p>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Space-Efficient KPI Card */}
        <section
          className="rounded-xl p-3.5 text-white shadow-sm border border-emerald-700/60 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#047857]"
          data-purpose="metrics-summary-card"
        >
          {/* Top bar inside card: Title + Period selector */}
          <div className="flex items-center justify-between pb-2.5 border-b border-emerald-500/25">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-100">
              <Wallet className="w-4 h-4 text-emerald-300" />
              <span className="tracking-tight text-white font-bold">Expense Overview</span>
            </div>

            {/* Compact month pill dropdown */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                className="inline-flex items-center gap-1 bg-emerald-950/40 hover:bg-emerald-950/60 px-2 py-0.5 rounded-md text-[11px] font-medium text-emerald-100 border border-emerald-400/20 transition-colors pointer-events-none"
              >
                <Calendar className="w-3 h-3 text-emerald-300" />
                <span>
                  {selectedMonthPrefix === currentMonthPrefix
                    ? `This Month (${formatMonthLabel(selectedMonthPrefix)})`
                    : formatMonthLabel(selectedMonthPrefix)}
                </span>
                <ChevronDown className="w-2.5 h-2.5 opacity-75" />
              </button>
              <select
                aria-label="Select Month"
                value={selectedMonthPrefix}
                onChange={(e) => {
                  void nativeService.triggerHaptic('selection');
                  setSelectedMonthPrefix(e.target.value);
                  setPeriodFilter('month');
                  setSelectedCategory('all');
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {availableMonths.map((mKey) => (
                  <option key={mKey} value={mKey} className="text-gray-900 bg-white">
                    {mKey === currentMonthPrefix ? `This Month (${formatMonthLabel(mKey)})` : formatMonthLabel(mKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2x2 Dense Metric Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3">
            {/* Metric 1: Spent Today */}
            <div className="flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/80">
                Spent Today
              </span>
              <span className="text-base font-bold tracking-tight text-white leading-tight">
                ₹{todaySpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {/* Metric 2: This Week */}
            <div className="flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/80">
                This Week
              </span>
              <span className="text-base font-extrabold tracking-tight text-white leading-tight">
                ₹{weekSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {/* Metric 3: This Month */}
            <div className="flex flex-col pt-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/80">
                This Month
              </span>
              <span className="text-base font-bold tracking-tight text-white leading-tight">
                ₹{selectedMonthSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {/* Metric 4: Lifetime */}
            <div className="flex flex-col pt-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/80">
                All / Lifetime
              </span>
              <span className="text-base font-extrabold tracking-tight text-white leading-tight">
                ₹{allTimeSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </section>

        {/* Segmented Time Period Selector */}
        <section
          className="bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg flex items-center gap-0.5 border border-slate-200/85 dark:border-slate-800"
          data-purpose="period-filter-segment"
        >
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setPeriodFilter('today');
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1 text-center rounded-md text-[11px] transition-all cursor-pointer ${
              periodFilter === 'today'
                ? 'font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs'
                : 'font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setPeriodFilter('week');
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1 text-center rounded-md text-[11px] transition-all cursor-pointer ${
              periodFilter === 'week'
                ? 'font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs'
                : 'font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setPeriodFilter('month');
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1 text-center rounded-md text-[11px] transition-all cursor-pointer ${
              periodFilter === 'month'
                ? 'font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs'
                : 'font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setPeriodFilter('all');
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1 text-center rounded-md text-[11px] transition-all cursor-pointer ${
              periodFilter === 'all'
                ? 'font-bold bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs'
                : 'font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            All Time
          </button>
        </section>

        {/* Section Title & Clear All Action (Search bar below period selector is completely removed) */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              Transactions
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              ({filteredExpenses.length})
            </span>
          </div>
          {activeExpenses.length > 0 && onClearAllExpenses && (
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsClearAllModalOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3 text-rose-500" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* BEGIN: TransactionFeed */}
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#151d2e] border border-slate-200/85 dark:border-slate-800 space-y-3 shadow-2xs">
            <CreditCard className="w-10 h-10 text-emerald-500/60 mx-auto" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {searchQuery ? 'No transactions match your search' : 'No transactions in this period'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {searchQuery
                  ? 'Try clearing the search query or picking a different period.'
                  : periodFilter === 'today'
                  ? 'No transactions were recorded today.'
                  : periodFilter === 'week'
                  ? 'No transactions recorded this week.'
                  : periodFilter === 'month'
                  ? 'No transactions recorded this month.'
                  : 'No transactions recorded yet.'}
              </p>
            </div>
            {onAddExpense && (
              <button
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setIsAddSheetOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Expense</span>
              </button>
            )}
          </div>
        ) : (
          <section className="space-y-3" data-purpose="transaction-list">
            {dateGroups.map((group) => (
              <div key={group.key} className="space-y-1.5 pt-0.5 first:pt-0">
                {/* Date Sticky Subheader */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <h2 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      {group.label}
                    </h2>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    ₹{group.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
                  </span>
                </div>

                {/* Transaction Rows in this Date Group */}
                <div className="space-y-1.5">
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
          </section>
        )}
        {/* END: TransactionFeed */}
      </main>
      {/* END: MainContent */}

      {/* Floating Action Button (+) */}
      {onAddExpense && (
        <button
          type="button"
          aria-label="Add Expense"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            setIsAddSheetOpen(true);
          }}
          className="fixed bottom-20 right-4 z-40 w-13 h-13 rounded-full bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer border-2 border-white dark:border-[#0b111e]"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Add Expense Sheet */}
      {onAddExpense && (
        <QuickExpenseSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddExpense={(item) => {
            const optimistic: ExpenseItem = {
              ...item,
              id: `exp-${Date.now()}`,
              direction: item.direction || 'DEBIT',
              transactionType: item.transactionType || 'DEBIT',
              active: true,
            };
            setLocalExpenses((prev) => [optimistic, ...prev]);
            onAddExpense(item);
          }}
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

      {/* Long-press Action Sheet (Edit, Share, Delete) */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionExpense)}
        onClose={() => setActiveActionExpense(null)}
        title={activeActionExpense ? getTransactionDisplayTitle(activeActionExpense) : undefined}
        subtitle={activeActionExpense ? `₹${activeActionExpense.amount} • ${activeActionExpense.category}` : undefined}
        actions={actionItems}
      />

      {/* Controlled SMS Rescan Modal */}
      <ControlledSmsRescanModal
        isOpen={isRescanModalOpen}
        onClose={() => setIsRescanModalOpen(false)}
        onSuccess={() => {
          setLocalExpenses(Storage.getExpenses());
        }}
      />

      {/* SMS Expense Auto-Detection Settings Modal */}
      <SmsExpenseModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        soundEnabled={soundEnabled}
        onOpenRescan={() => {
          setIsSmsModalOpen(false);
          setIsRescanModalOpen(true);
        }}
      />

      {/* Excel / Spreadsheet Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportSuccess={handleExcelImportSuccess}
        existingExpenses={activeExpenses}
        soundEnabled={soundEnabled}
        importLogs={importLogs}
        onOpenDeleteSheet={(log) => {
          setIsExcelModalOpen(false);
          handleOpenDeleteSheet(log);
        }}
      />

      {/* Excel Options Action Sheet */}
      <AndroidActionSheet
        isOpen={isExcelMenuOpen}
        onClose={() => setIsExcelMenuOpen(false)}
        title="Excel Spreadsheets"
        subtitle={
          importLogs.length > 0
            ? `${importLogs.length} spreadsheet${importLogs.length === 1 ? '' : 's'} connected`
            : 'Import or manage spreadsheet data'
        }
        actions={[
          {
            label: 'Upload Spreadsheet',
            icon: <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            onClick: () => {
              setIsExcelModalOpen(true);
            },
          },
          {
            label: `Uploaded Spreadsheets (${importLogs.length})`,
            icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            onClick: () => {
              setIsUploadedSheetsOpen(true);
            },
          },
        ]}
      />

      {/* Uploaded Spreadsheets Bottom Sheet */}
      <BottomSheet
        isOpen={isUploadedSheetsOpen}
        onClose={() => setIsUploadedSheetsOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Uploaded Spreadsheets</span>
          </div>
        }
        subtitle={`${importLogs.length} spreadsheet${importLogs.length === 1 ? '' : 's'} imported`}
      >
        <div className="p-4 space-y-3 pb-8">
          <button
            type="button"
            onClick={() => {
              setIsUploadedSheetsOpen(false);
              setIsExcelModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload New Spreadsheet</span>
          </button>

          {importLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 space-y-1">
              <FileSpreadsheet className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No uploaded spreadsheets yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Upload Money Manager or custom Excel/CSV exports to track your spendings.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {importLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-white block truncate text-xs">
                        {log.fileName}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {log.addedCount} items · ₹{Math.round(log.totalAmountAdded || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadedSheetsOpen(false);
                      handleOpenDeleteSheet(log);
                    }}
                    className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 active:scale-90 cursor-pointer transition-all shrink-0"
                    title={`Delete spreadsheet ${log.fileName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Export Expense Sheet */}
      <ExportExpenseSheet
        isOpen={isExportSheetOpen}
        onClose={() => setIsExportSheetOpen(false)}
        allExpenses={activeExpenses}
        filteredExpenses={filteredExpenses}
        currentPeriodLabel={
          periodFilter === 'today'
            ? 'Today'
            : periodFilter === 'week'
            ? 'This Week'
            : periodFilter === 'month'
            ? 'This Month'
            : 'All Time'
        }
        selectedCategory={selectedCategory}
        soundEnabled={soundEnabled}
      />

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
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
                className="px-3 py-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Yes, Clear All
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
                Delete Sheet &amp; Its Spendings
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
  const { bg, Icon } = getCategoryStyle(expense.category, isCredit);

  return (
    <SwipeActionRow
      onSwipeLeft={onSwipeDelete}
      rightActionContent={<Trash2 className="w-5 h-5" />}
      rightActionColor="bg-rose-600"
    >
      <article
        {...longPressProps}
        onClick={onTap}
        className="bg-white dark:bg-[#151d2e] rounded-lg p-2.5 border border-slate-200/85 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] select-none"
      >
        {/* Left Icon + Details */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Compact Icon Badge */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${bg}`}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCredit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {displayTitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
              <span className={`font-medium ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isCredit ? 'Credit' : 'Debit'}
              </span>
              <span>•</span>
              <span className="truncate">{expense.category || 'General'}</span>
              <span>•</span>
              <span className="shrink-0 text-slate-500 dark:text-slate-400">{expense.date || ''}</span>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="shrink-0 text-right">
          <span
            className={`text-sm font-extrabold tracking-tight block ${
              isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {isCredit ? '+' : ''}₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {expense.bankOrAccount && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate max-w-[90px]">
              {expense.bankOrAccount}
            </span>
          )}
        </div>
      </article>
    </SwipeActionRow>
  );
};
