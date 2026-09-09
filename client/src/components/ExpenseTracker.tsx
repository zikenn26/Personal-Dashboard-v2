import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Check,
  Coffee,
  ShoppingBag,
  Car,
  Utensils,
  Laptop,
  Home,
  Tv,
  HeartPulse,
  GraduationCap,
  Sparkles,
  Search,
  Tag,
  Edit2,
  X,
  PieChart as PieChartIcon,
  Wallet,
  Coins,
  TrendingUp,
  ArrowUpRight,
  ChevronDown,
  Repeat,
  Bell,
  CheckCircle2,
  Info,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Upload,
  Filter,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ExpenseItem,
  ExcelImportLog,
  ExpenseCategory,
  PaymentMethod,
  ExpenseBillingCycle,
} from '../types';
import { Storage, STORAGE_KEYS } from '../utils/storage';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import { ExcelImportModal } from './ExcelImportModal';

interface ExpenseTrackerProps {
  expenses: ExpenseItem[];
  importLogs?: ExcelImportLog[];
  onAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updated: Partial<ExpenseItem>) => void;
  onBatchAddExpenses?: (expenses: Array<Omit<ExpenseItem, 'id'>>, log?: ExcelImportLog) => void;
  onToggleActive?: (id: string) => void;
  onDeleteExpense: (id: string) => void;
  onDeleteBatchExpenses?: (ids: string[]) => void;
  onDeleteImportLog?: (logId: string) => void;
  onClearAllExpenses?: () => void;
  soundEnabled: boolean;
}

export interface ExpenseCategoryDef {
  name: string;
  icon: string;
  color: string;
  badgeBg: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  {
    name: 'Food & Dining',
    icon: '🍽️',
    color: '#8B5CF6', // Purple
    badgeBg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  {
    name: 'Snacks & Coffee',
    icon: '☕',
    color: '#EC4899', // Pink
    badgeBg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  },
  {
    name: 'Groceries',
    icon: '🛒',
    color: '#10B981', // Emerald
    badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  {
    name: 'Transport',
    icon: '🚕',
    color: '#06B6D4', // Cyan / Teal
    badgeBg: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  },
  {
    name: 'Subscriptions',
    icon: '💻',
    color: '#3B82F6', // Blue
    badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  {
    name: 'Shopping',
    icon: '🛍️',
    color: '#F59E0B', // Amber
    badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  {
    name: 'Bills & Utilities',
    icon: '💡',
    color: '#EAB308', // Yellow
    badgeBg: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  },
  {
    name: 'Health & Wellness',
    icon: '💊',
    color: '#14B8A6', // Teal
    badgeBg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  {
    name: 'Education',
    icon: '📚',
    color: '#6366F1', // Indigo
    badgeBg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  {
    name: 'Entertainment',
    icon: '🎬',
    color: '#A855F7',
    badgeBg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  {
    name: 'Travel',
    icon: '✈️',
    color: '#0EA5E9',
    badgeBg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  {
    name: 'Others',
    icon: '🏷️',
    color: '#94A3B8', // Slate
    badgeBg: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
];

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Helper to reliably find all expenses originating from an Excel sheet upload
export const getMatchingExpensesForSheet = (
  log: ExcelImportLog,
  allExpenses: ExpenseItem[]
): ExpenseItem[] => {
  const normLogName = (log.fileName || '').trim().toLowerCase();
  const baseLogName = normLogName.replace(/\.[^/.]+$/, '');

  return allExpenses.filter((e) => {
    // 1. Direct batch ID match
    if (log.id && e.importBatchId === log.id) return true;

    // 2. Source file match (exact, case-insensitive, or extensionless)
    if (e.sourceFile) {
      const normSource = e.sourceFile.trim().toLowerCase();
      if (normSource === normLogName) return true;

      const baseSource = normSource.replace(/\.[^/.]+$/, '');
      if (baseSource && (baseSource === baseLogName || baseSource === normLogName || baseLogName === normSource)) {
        return true;
      }

      if (normLogName && (normSource.includes(normLogName) || normLogName.includes(normSource))) {
        return true;
      }
    }

    return false;
  });
};

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
  expenses,
  importLogs: propImportLogs,
  onAddExpense,
  onUpdateExpense,
  onBatchAddExpenses,
  onToggleActive,
  onDeleteExpense,
  onDeleteBatchExpenses,
  onDeleteImportLog,
  onClearAllExpenses,
  soundEnabled,
}) => {
  // Navigation & Filter States
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(now.getMonth());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [categoryScope, setCategoryScope] = useState<'month' | 'all'>('month');

  // Track uploaded spreadsheet history logs and batch management
  const [importLogs, setImportLogs] = useState<ExcelImportLog[]>(() => {
    if (propImportLogs && Array.isArray(propImportLogs)) {
      return propImportLogs;
    }
    // If the storage key explicitly exists in localStorage (even if empty []), use it directly
    const rawStored = localStorage.getItem(STORAGE_KEYS.EXCEL_IMPORT_LOGS);
    if (rawStored !== null) {
      try {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }

    // Only synthesize on initial migration if user had legacy uploaded sheet
    const synthLogs: ExcelImportLog[] = [];
    const lastMeta = localStorage.getItem('last_uploaded_expense_sheet');
    if (lastMeta) {
      try {
        const p = JSON.parse(lastMeta);
        synthLogs.push({
          id: p.batchId || `sheet_init_${Date.now()}`,
          fileName: p.fileName || 'Money_Manager_Export.xlsx',
          uploadDate: new Date().toISOString(),
          addedCount: p.count || 0,
          skippedCount: 0,
          totalRowsInSheet: p.count || 0,
          totalAmountAdded: p.totalAmount || 0,
          status: 'active',
        });
      } catch {}
    }

    // Also check if any expenses in tracker have a sourceFile not in synthLogs
    const fileMap = new Map<string, { count: number; amount: number; batchId?: string }>();
    for (const exp of expenses) {
      if (exp.sourceFile) {
        const entry = fileMap.get(exp.sourceFile) || { count: 0, amount: 0, batchId: exp.importBatchId };
        entry.count += 1;
        entry.amount += exp.amount;
        fileMap.set(exp.sourceFile, entry);
      }
    }

    for (const [fName, data] of fileMap.entries()) {
      if (!synthLogs.some((l) => l.fileName === fName)) {
        synthLogs.push({
          id: data.batchId || `sheet_${Date.now()}_${synthLogs.length}`,
          fileName: fName,
          uploadDate: new Date().toISOString(),
          addedCount: data.count,
          skippedCount: 0,
          totalRowsInSheet: data.count,
          totalAmountAdded: Math.round(data.amount),
          status: 'active',
        });
      }
    }

    if (synthLogs.length > 0) {
      Storage.setExcelImportLogs(synthLogs);
    }
    return synthLogs;
  });

  // Keep spreadsheet import logs automatically synchronized across devices
  useEffect(() => {
    if (propImportLogs && Array.isArray(propImportLogs)) {
      setImportLogs(propImportLogs);
      return;
    }
    const current = Storage.getExcelImportLogs();
    if (current && current.length > 0) {
      setImportLogs(current);
    }
  }, [propImportLogs, expenses]);

  // Optional active filter to view spendings exclusively from a specific sheet
  const [selectedSheetFilter, setSelectedSheetFilter] = useState<string | null>(null);

  // In-app confirmation modal states (100% reliable inside iframes, replaces window.confirm / alert)
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

  const [clearAllSheetsModal, setClearAllSheetsModal] = useState<{
    isOpen: boolean;
    count: number;
  }>({
    isOpen: false,
    count: 0,
  });

  const [clearAllExpensesModal, setClearAllExpensesModal] = useState<boolean>(false);

  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => {
      setActionToast((prev) => (prev?.message === message ? null : prev));
    }, 3800);
  };

  const selectedMonthLabel = `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`;
  const selectedMonthPrefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    Sound.click(soundEnabled);
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonthIndex((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    Sound.click(soundEnabled);
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonthIndex((prev) => prev + 1);
    }
  };

  const handleSetCurrentMonth = () => {
    Sound.click(soundEnabled);
    const curr = new Date();
    setSelectedYear(curr.getFullYear());
    setSelectedMonthIndex(curr.getMonth());
    setIsMonthPickerOpen(false);
  };

  const handleImportSuccess = (
    newExpenses: Array<Omit<ExpenseItem, 'id'>>,
    log: ExcelImportLog
  ) => {
    // Prepend new log to history
    const updatedLogs = [log, ...importLogs.filter((l) => l.id !== log.id)];
    setImportLogs(updatedLogs);
    Storage.setExcelImportLogs(updatedLogs);

    if (onBatchAddExpenses) {
      onBatchAddExpenses(newExpenses, log);
    } else {
      newExpenses.forEach((item) => onAddExpense(item));
    }

    try {
      localStorage.setItem(
        'last_uploaded_expense_sheet',
        JSON.stringify({
          fileName: log.fileName,
          batchId: log.id,
          count: log.addedCount,
          totalAmount: log.totalAmountAdded,
        })
      );
    } catch {}

    triggerConfetti();
  };

  // Open in-app modal to safely delete a specific spreadsheet
  const handleOpenDeleteSheetModal = (log: ExcelImportLog) => {
    Sound.click(soundEnabled);
    const matching = getMatchingExpensesForSheet(log, expenses);
    const amount = matching.reduce((sum, item) => sum + item.amount, 0);
    setDeleteSheetModal({
      isOpen: true,
      log,
      matchingCount: matching.length,
      matchingAmount: amount,
    });
  };

  // Confirm delete of spreadsheet (with option to remove spendings or keep spendings)
  const handleConfirmDeleteSheet = (deleteSpendings: boolean) => {
    const log = deleteSheetModal.log;
    if (!log) return;

    Sound.click(soundEnabled);

    let deletedCount = 0;
    if (deleteSpendings) {
      const matching = getMatchingExpensesForSheet(log, expenses);
      const matchingIds = matching.map((e) => e.id);
      deletedCount = matchingIds.length;

      if (onDeleteBatchExpenses && matchingIds.length > 0) {
        onDeleteBatchExpenses(matchingIds);
      } else if (matchingIds.length > 0) {
        matchingIds.forEach((id) => onDeleteExpense(id));
      }
    }

    // Permanently remove this sheet from import logs
    const updatedLogs = importLogs.filter((l) => l.id !== log.id);
    setImportLogs(updatedLogs);
    Storage.setExcelImportLogs(updatedLogs);

    if (onDeleteImportLog) {
      onDeleteImportLog(log.id);
    }

    // Clear active filter if filtering by this sheet
    if (
      selectedSheetFilter === log.fileName ||
      selectedSheetFilter === log.id ||
      (selectedSheetFilter && log.fileName && selectedSheetFilter.toLowerCase() === log.fileName.toLowerCase())
    ) {
      setSelectedSheetFilter(null);
    }

    // Clean legacy local storage pointer if matching
    try {
      const lastMeta = localStorage.getItem('last_uploaded_expense_sheet');
      if (lastMeta) {
        const p = JSON.parse(lastMeta);
        if (p.fileName === log.fileName || p.batchId === log.id) {
          localStorage.removeItem('last_uploaded_expense_sheet');
        }
      }
    } catch {}

    setDeleteSheetModal({ isOpen: false, log: null, matchingCount: 0, matchingAmount: 0 });

    if (deleteSpendings && deletedCount > 0) {
      showToast(`Deleted "${log.fileName}" and removed ${deletedCount} spendings from your tracker.`);
    } else {
      showToast(`Removed "${log.fileName}" from your upload history.`);
    }
  };

  // Open in-app modal to clear all spreadsheet-imported spendings
  const handleOpenClearAllSheetsModal = () => {
    Sound.click(soundEnabled);
    const importedItems = expenses.filter((e) => !!e.importBatchId || !!e.sourceFile);
    setClearAllSheetsModal({
      isOpen: true,
      count: importedItems.length,
    });
  };

  // Confirm clear all spendings imported across all spreadsheets
  const handleConfirmClearAllSheets = () => {
    Sound.click(soundEnabled);
    const importedItems = expenses.filter((e) => !!e.importBatchId || !!e.sourceFile);
    const ids = importedItems.map((e) => e.id);

    if (onDeleteBatchExpenses && ids.length > 0) {
      onDeleteBatchExpenses(ids);
    } else if (ids.length > 0) {
      ids.forEach((id) => onDeleteExpense(id));
    }

    setImportLogs([]);
    Storage.setExcelImportLogs([]);
    try {
      localStorage.removeItem('last_uploaded_expense_sheet');
    } catch {}
    setSelectedSheetFilter(null);

    setClearAllSheetsModal({ isOpen: false, count: 0 });
    showToast(`Cleared all ${ids.length} spreadsheet spendings and reset upload logs.`);
  };

  // Open in-app modal to clear entire database
  const handleOpenClearAllExpensesModal = () => {
    Sound.click(soundEnabled);
    setClearAllExpensesModal(true);
  };

  // Confirm wipe entire spendings database
  const handleConfirmClearAllExpenses = () => {
    Sound.click(soundEnabled);
    if (onClearAllExpenses) {
      onClearAllExpenses();
    } else {
      expenses.forEach((e) => onDeleteExpense(e.id));
    }
    setImportLogs([]);
    Storage.setExcelImportLogs([]);
    try {
      localStorage.removeItem('last_uploaded_expense_sheet');
    } catch {}
    setSelectedSheetFilter(null);

    setClearAllExpensesModal(false);
    showToast('All spending transactions have been completely cleared.');
  };

  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllTransactionsModal, setShowAllTransactionsModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  // Quick Preset Custom Modal
  const [showCustomPresetModal, setShowCustomPresetModal] = useState<boolean>(false);
  const [customPresetName, setCustomPresetName] = useState('');
  const [customPresetAmount, setCustomPresetAmount] = useState('');
  const [customPresetCategory, setCustomPresetCategory] = useState('Snacks & Coffee');
  const [customPresetIcon, setCustomPresetIcon] = useState('☕');

  // Form State for Add / Edit
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Food & Dining');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod | string>('Credit Card');
  const [formBillingCycle, setFormBillingCycle] = useState<ExpenseBillingCycle>('one-time');
  const [formNotes, setFormNotes] = useState('');
  const [formIcon, setFormIcon] = useState('💳');

  const formatCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  // Helper to open Add Modal cleanly
  const openAddModal = (preset?: { name: string; amount: number; category: string; icon: string; note?: string }) => {
    Sound.click(soundEnabled);
    if (preset) {
      setFormName(preset.name);
      setFormAmount(preset.amount.toString());
      setFormCategory(preset.category);
      setFormIcon(preset.icon);
      setFormNotes(preset.note || '');
      setFormBillingCycle('one-time');
    } else {
      setFormName('');
      setFormAmount('');
      setFormCategory('Food & Dining');
      setFormIcon('🍽️');
      setFormNotes('');
      setFormBillingCycle('one-time');
    }
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPaymentMethod('Credit Card');
    setEditingExpense(null);
    setShowAddModal(true);
  };

  const openEditModal = (item: ExpenseItem) => {
    Sound.click(soundEnabled);
    setEditingExpense(item);
    setFormName(item.name);
    setFormAmount(item.amount.toString());
    setFormCategory(item.category);
    setFormDate(item.date || new Date().toISOString().split('T')[0]);
    setFormPaymentMethod(item.paymentMethod || 'Credit Card');
    setFormBillingCycle(item.billingCycle || 'one-time');
    setFormNotes(item.notes || '');
    setFormIcon(item.icon || '💳');
    setShowAddModal(true);
  };

  // Quick Preset Click Handler
  const handleQuickAddPreset = (preset: { name: string; amount: number; category: string; icon: string; note?: string }) => {
    Sound.success(soundEnabled);
    triggerConfetti();
    onAddExpense({
      name: preset.name,
      amount: preset.amount,
      category: preset.category,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI / Debit',
      billingCycle: 'one-time',
      notes: preset.note || '',
      icon: preset.icon,
      active: true,
    });
  };

  // Save Modal (Create or Update)
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount);
    if (!formName.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    Sound.success(soundEnabled);
    triggerConfetti();

    if (editingExpense) {
      if (onUpdateExpense) {
        onUpdateExpense(editingExpense.id, {
          name: formName.trim(),
          amount: parsedAmount,
          category: formCategory,
          date: formDate,
          paymentMethod: formPaymentMethod,
          billingCycle: formBillingCycle,
          notes: formNotes.trim(),
          icon: formIcon,
        });
      }
    } else {
      onAddExpense({
        name: formName.trim(),
        amount: parsedAmount,
        category: formCategory,
        date: formDate,
        paymentMethod: formPaymentMethod,
        billingCycle: formBillingCycle,
        notes: formNotes.trim(),
        icon: formIcon,
        active: true,
      });
    }

    setShowAddModal(false);
    setEditingExpense(null);
  };

  // Calculated Stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Sum for Today
    const todayTotal = expenses
      .filter((e) => e.date === todayStr)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Sum for This Week (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const weekTotal = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d >= sevenDaysAgo && d <= now;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Sum for Selected Month
    const selectedPrefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
    const monthExpenses = expenses.filter((e) => (e.date || '').startsWith(selectedPrefix));
    const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Previous Month Comparison (for accurate % trend)
    const prevMonthIndex = selectedMonthIndex === 0 ? 11 : selectedMonthIndex - 1;
    const prevYear = selectedMonthIndex === 0 ? selectedYear - 1 : selectedYear;
    const prevPrefix = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
    const prevMonthTotal = expenses
      .filter((e) => (e.date || '').startsWith(prevPrefix))
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    let monthDiffPercent = 0;
    if (prevMonthTotal > 0) {
      monthDiffPercent = Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100);
    }

    // Total of Active Subscriptions / month
    const recurringTotal = expenses
      .filter((e) => e.billingCycle && e.billingCycle !== 'one-time' && e.active !== false)
      .reduce((sum, e) => {
        if (e.billingCycle === 'yearly') return sum + e.amount / 12;
        if (e.billingCycle === 'weekly') return sum + e.amount * 4.33;
        return sum + e.amount;
      }, 0);

    return {
      monthDisplay: monthTotal,
      monthCount: monthExpenses.length,
      prevMonthTotal,
      monthDiffPercent,
      weekDisplay: weekTotal,
      todayDisplay: todayTotal,
      recurringDisplay: recurringTotal,
      hasRealData: expenses.length > 0,
    };
  }, [expenses, selectedYear, selectedMonthIndex]);

  // Category Breakdown Data (supports filtering by selected month or all time)
  const categoryBreakdown = useMemo(() => {
    if (expenses.length === 0) {
      return [];
    }

    const selectedPrefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
    let sourceExpenses = expenses;

    if (categoryScope === 'month') {
      const filtered = expenses.filter((e) => (e.date || '').startsWith(selectedPrefix));
      if (filtered.length > 0) {
        sourceExpenses = filtered;
      }
    }

    const catMap: Record<string, number> = {};
    let total = 0;
    sourceExpenses.forEach((e) => {
      const cat = e.category || 'Others';
      catMap[cat] = (catMap[cat] || 0) + e.amount;
      total += e.amount;
    });

    if (total === 0) total = 1;

    return Object.entries(catMap)
      .map(([name, amount]) => {
        const catDef = EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === name.toLowerCase()) || {
          color: '#94A3B8',
        };
        return {
          name,
          amount,
          percent: Math.round((amount / total) * 100),
          color: catDef.color,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, selectedYear, selectedMonthIndex, categoryScope]);

  // Monthly Spending Trend Data
  const trendData = useMemo(() => {
    if (expenses.length === 0) {
      return [];
    }

    const selectedPrefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
    const monthExpenses = expenses.filter((e) => (e.date || '').startsWith(selectedPrefix));
    const source = monthExpenses.length > 0 ? monthExpenses : expenses.slice(0, 20);

    // Group actual expenses by date
    const days: Record<string, number> = {};
    source.forEach((e) => {
      const d = e.date ? (e.date.length > 5 ? e.date.substring(5) : e.date) : 'Recent';
      days[d] = (days[d] || 0) + e.amount;
    });

    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date,
        amount,
        label: date,
      }));
  }, [expenses, selectedYear, selectedMonthIndex]);

  // Subscriptions list
  const subscriptions = useMemo(() => {
    return expenses.filter((e) => e.billingCycle && e.billingCycle !== 'one-time');
  }, [expenses]);

  // Dynamic Quick Add Presets: Computed dynamically from user's most frequent transactions
  // Empty for a new user with zero transactions
  const dynamicPresets = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];

    const freqMap = new Map<
      string,
      {
        name: string;
        category: string;
        icon: string;
        count: number;
        totalAmount: number;
        latestAmount: number;
        note?: string;
      }
    >();

    expenses.forEach((item) => {
      const cleanName = (item.name || '').trim();
      if (!cleanName) return;
      const key = cleanName.toLowerCase();
      const existing = freqMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += item.amount || 0;
        existing.latestAmount = item.amount || existing.latestAmount;
        if (item.category) existing.category = item.category;
        if (item.icon) existing.icon = item.icon;
        if (item.notes) existing.note = item.notes;
      } else {
        freqMap.set(key, {
          name: cleanName,
          category: item.category || 'Food & Dining',
          icon: item.icon || '💳',
          count: 1,
          totalAmount: item.amount || 0,
          latestAmount: item.amount || 0,
          note: item.notes || '',
        });
      }
    });

    return Array.from(freqMap.values())
      .sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount)
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        amount: item.latestAmount || Math.round(item.totalAmount / item.count),
        category: item.category,
        icon: item.icon,
        count: item.count,
        note: item.note,
      }));
  }, [expenses]);

  // Filtered & Grouped Transactions
  const groupedTransactions = useMemo(() => {
    let list = [...expenses];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    if (selectedCategoryFilter !== 'all') {
      list = list.filter((e) => e.category.toLowerCase() === selectedCategoryFilter.toLowerCase());
    }

    if (selectedSheetFilter) {
      list = list.filter(
        (e) => e.sourceFile === selectedSheetFilter || e.importBatchId === selectedSheetFilter
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const selectedPrefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;

    if (activeFilter === 'today') {
      list = list.filter((e) => e.date === todayStr);
    } else if (activeFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(new Date().getDate() - 7);
      list = list.filter((e) => new Date(e.date) >= sevenDaysAgo);
    } else if (activeFilter === 'month') {
      list = list.filter((e) => (e.date || '').startsWith(selectedPrefix));
    }

    // Group real transactions
    const groups: Record<string, ExpenseItem[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    list.forEach((item) => {
      if (item.date === todayStr) {
        groups.Today.push(item);
      } else if (item.date === yesterdayStr) {
        groups.Yesterday.push(item);
      } else {
        groups.Earlier.push(item);
      }
    });

    return {
      Today: groups.Today,
      Yesterday: groups.Yesterday,
      Earlier: groups.Earlier,
      isEmpty: list.length === 0,
    };
  }, [expenses, searchQuery, selectedCategoryFilter, activeFilter, selectedYear, selectedMonthIndex, selectedSheetFilter]);

  // Count of imported items in database
  const importedCount = useMemo(() => {
    return expenses.filter((e) => !!e.importBatchId || !!e.sourceFile).length;
  }, [expenses]);

  const getCategoryBadge = (category: string) => {
    const cat = EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === category.toLowerCase());
    return cat ? cat.badgeBg : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const getCategoryIcon = (category: string, itemIcon?: string) => {
    if (itemIcon) return itemIcon;
    const cat = EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === category.toLowerCase());
    return cat ? cat.icon : '🏷️';
  };

  return (
    <div id="spending-view-root" className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ========================================================================= */}
      {/* 1. HEADER & TOP ACTIONS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white tracking-tight">
            Spending
          </h1>
          <p className="text-xs sm:text-sm text-[#787774] dark:text-[#9CA3AF] mt-0.5 font-normal">
            Understand where your money goes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Working Month & Year Navigator */}
          <div className="relative flex items-center bg-white dark:bg-[#1A202C] rounded-full border border-[#E5E7EB] dark:border-[#2D3748] shadow-2xs p-0.5">
            {/* Prev Month */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#2D3748] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Selected Month / Year Dropdown Trigger */}
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setIsMonthPickerOpen((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-bold text-[#37352F] dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              title="Click to jump to another month or year"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>{selectedMonthLabel}</span>
              <ChevronDown
                className={`w-3 h-3 text-gray-400 transition-transform ${
                  isMonthPickerOpen ? 'rotate-180 text-purple-600' : ''
                }`}
              />
            </button>

            {/* Next Month */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#2D3748] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Next Month"
              aria-label="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Interactive Month & Year Picker Popover */}
            {isMonthPickerOpen && (
              <div
                className="absolute top-full left-0 mt-2 z-50 w-64 p-3 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-2xl animate-in fade-in slide-in-from-top-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Year Selection Row */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setSelectedYear((prev) => prev - 1);
                    }}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                    title="Previous Year"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-black text-[#111827] dark:text-white">
                    {selectedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setSelectedYear((prev) => prev + 1);
                    }}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                    title="Next Year"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 12 Months Grid */}
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  {MONTH_NAMES.map((mName, idx) => {
                    const isSelected = selectedMonthIndex === idx;
                    const isRealCurrent =
                      new Date().getMonth() === idx && new Date().getFullYear() === selectedYear;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          setSelectedMonthIndex(idx);
                          setIsMonthPickerOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-xs'
                            : isRealCurrent
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2D3748]'
                        }`}
                      >
                        {mName.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Quick Jump Action */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                  <button
                    type="button"
                    onClick={handleSetCurrentMonth}
                    className="text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                  >
                    Jump to Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Excel Button */}
          <button
            type="button"
            id="btn-upload-excel"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Upload and extract expenses from Excel (.xlsx, .xls) or CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Upload Excel</span>
          </button>

          {/* Sheet Logs & History Button */}
          <button
            type="button"
            id="btn-view-sheet-logs"
            onClick={() => {
              Sound.click(soundEnabled);
              const el = document.getElementById('excel-sheet-logs-card');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-emerald-500');
                setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 1500);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1A202C] hover:bg-gray-50 dark:hover:bg-gray-800 border border-[#E5E7EB] dark:border-[#2D3748] text-gray-700 dark:text-gray-300 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="View uploaded spreadsheet history and manage imported sheet data"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Sheet Logs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[10px] font-black text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
              {importLogs.length}
            </span>
          </button>

          {/* Reset / Filter Refresh Button */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveFilter('all');
              setSelectedCategoryFilter('all');
              setSelectedSheetFilter(null);
              setSearchQuery('');
            }}
            title="Reset Filters"
            className="p-2 rounded-full border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-50 dark:hover:bg-[#2D3748] shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* + Add Expense CTA */}
          <button
            type="button"
            id="btn-add-expense-primary"
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1.5. UPLOADED SPREADSHEETS & IMPORT LOGS BANNER */}
      {/* ========================================================================= */}
      {(importLogs.length > 0 || importedCount > 0) && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                  {importLogs.length === 1
                    ? `Sheet: ${importLogs[0].fileName}`
                    : `${importLogs.length} Spreadsheets Uploaded`}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200/90 dark:bg-emerald-800 text-[10px] font-black text-emerald-900 dark:text-emerald-100">
                  {importedCount} imported spendings active
                </span>
                {selectedSheetFilter && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-[10px] font-bold text-purple-800 dark:text-purple-200">
                    Filtered: {selectedSheetFilter}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                Automatically deduplicated against existing records. Manage history or delete individual sheet data anytime in the Sheet Logs panel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                const el = document.getElementById('excel-sheet-logs-card');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-emerald-500');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 1500);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <span>View Sheet Logs</span>
            </button>

            {importedCount > 0 && (
              <button
                type="button"
                onClick={handleOpenClearAllSheetsModal}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-semibold shadow-xs hover:bg-rose-100 transition-colors cursor-pointer"
                title="Remove all spreadsheet-imported spendings"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Sheets Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenClearAllExpensesModal}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A202C] border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Wipe entire spending database for fresh testing"
            >
              Clear All Data
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOP SUMMARY ROW (4 Compact Cards) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: SELECTED MONTH */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs flex items-start justify-between relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-800 transition-all">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#787774] dark:text-[#9CA3AF]">
              {selectedMonthLabel}
            </span>
            <div className="text-lg sm:text-xl font-black text-[#37352F] dark:text-white tracking-tight">
              {formatCurrency(stats.monthDisplay)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>
                {stats.monthCount} items • {stats.monthDiffPercent >= 0 ? `+${stats.monthDiffPercent}%` : `${stats.monthDiffPercent}%`} vs prev mo
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center text-lg shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: THIS WEEK */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs flex items-start justify-between relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#787774] dark:text-[#9CA3AF]">
              This Week
            </span>
            <div className="text-lg sm:text-xl font-black text-[#37352F] dark:text-white tracking-tight">
              {formatCurrency(stats.weekDisplay)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>8% vs last week</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-lg shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: TODAY */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs flex items-start justify-between relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-800 transition-all">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#787774] dark:text-[#9CA3AF]">
              Today
            </span>
            <div className="text-lg sm:text-xl font-black text-[#37352F] dark:text-white tracking-tight">
              {formatCurrency(stats.todayDisplay)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>15% vs yesterday</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center text-lg shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: RECURRING */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs flex items-start justify-between relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-800 transition-all">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#787774] dark:text-[#9CA3AF]">
              Recurring
            </span>
            <div className="text-lg sm:text-xl font-black text-[#37352F] dark:text-white tracking-tight">
              {formatCurrency(stats.recurringDisplay)}
            </div>
            <div className="text-[11px] font-medium text-[#787774] dark:text-[#9CA3AF] pt-0.5">
              / month active
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center text-lg shrink-0">
            <Repeat className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PRIMARY TWO-PART CONTENT GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN (Cols 1-8): Transactions, Category Breakdown, Monthly Trend */}
        {/* ======================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* A. RECENT TRANSACTIONS CARD */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
                  Recent Transactions
                </h2>
                <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                  Track everyday logs and receipts
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAllTransactionsModal(true)}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {/* Quick Filters Pill Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
              {(['all', 'today', 'week', 'month'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setActiveFilter(filterKey);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeFilter === filterKey
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-gray-50 dark:bg-[#242C3D] text-[#787774] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#2D3748]'
                  }`}
                >
                  {filterKey === 'all'
                    ? 'All'
                    : filterKey === 'today'
                    ? 'Today'
                    : filterKey === 'week'
                    ? 'This Week'
                    : `${MONTH_NAMES[selectedMonthIndex]}`}
                </button>
              ))}

              <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

              {/* Category Quick Filter Dropdown */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 dark:bg-[#242C3D] text-[#37352F] dark:text-white border border-[#E5E7EB] dark:border-[#2D3748] outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Items (Grouped by Today, Yesterday, Earlier) */}
            <div className="space-y-4 pt-1">
              {selectedSheetFilter && (
                <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="truncate">
                      Filtering spendings from: <strong>{selectedSheetFilter}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setSelectedSheetFilter(null);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer shrink-0 ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear filter</span>
                  </button>
                </div>
              )}

              {groupedTransactions.isEmpty ? (
                <div className="text-center py-8 px-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
                  <div className="text-2xl">💳</div>
                  <p className="text-xs font-bold text-[#37352F] dark:text-white">No expenses recorded yet</p>
                  <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF]">
                    Click &ldquo;+ Add Expense&rdquo; above to log your first transaction.
                  </p>
                </div>
              ) : (
                <>
                  {/* Group: Today */}
                  {groupedTransactions.Today.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF]">
                        Today
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {groupedTransactions.Today.map((tx: any) => (
                          <div
                            key={tx.id}
                            className="py-2.5 flex items-center justify-between group hover:bg-gray-50/70 dark:hover:bg-gray-800/40 px-2 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center text-base shrink-0">
                                {getCategoryIcon(tx.category, tx.icon)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-[#37352F] dark:text-white truncate">
                                  {tx.name}
                                </div>
                                <div className="text-[11px] text-[#787774] dark:text-[#9CA3AF] truncate">
                                  {tx.notes || tx.category}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-extrabold text-[#37352F] dark:text-white">
                                  {formatCurrency(tx.amount)}
                                </div>
                                <div className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
                                  {tx.time || '10:20 AM'}
                                </div>
                              </div>

                              <span
                                className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadge(
                                  tx.category
                                )}`}
                              >
                                {tx.category}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(tx)}
                                  className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    Sound.click(soundEnabled);
                                    onDeleteExpense(tx.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group: Yesterday */}
                  {groupedTransactions.Yesterday.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF]">
                        Yesterday
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {groupedTransactions.Yesterday.map((tx: any) => (
                          <div
                            key={tx.id}
                            className="py-2.5 flex items-center justify-between group hover:bg-gray-50/70 dark:hover:bg-gray-800/40 px-2 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center text-base shrink-0">
                                {getCategoryIcon(tx.category, tx.icon)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-[#37352F] dark:text-white truncate">
                                  {tx.name}
                                </div>
                                <div className="text-[11px] text-[#787774] dark:text-[#9CA3AF] truncate">
                                  {tx.notes || tx.category}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-extrabold text-[#37352F] dark:text-white">
                                  {formatCurrency(tx.amount)}
                                </div>
                                <div className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
                                  {tx.time || 'Yesterday'}
                                </div>
                              </div>

                              <span
                                className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadge(
                                  tx.category
                                )}`}
                              >
                                {tx.category}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(tx)}
                                  className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    Sound.click(soundEnabled);
                                    onDeleteExpense(tx.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group: Earlier */}
                  {groupedTransactions.Earlier.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF]">
                        Earlier
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {groupedTransactions.Earlier.map((tx: any) => (
                          <div
                            key={tx.id}
                            className="py-2.5 flex items-center justify-between group hover:bg-gray-50/70 dark:hover:bg-gray-800/40 px-2 rounded-xl transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center text-base shrink-0">
                                {getCategoryIcon(tx.category, tx.icon)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-[#37352F] dark:text-white truncate">
                                  {tx.name}
                                </div>
                                <div className="text-[11px] text-[#787774] dark:text-[#9CA3AF] truncate">
                                  {tx.notes || tx.category}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-extrabold text-[#37352F] dark:text-white">
                                  {formatCurrency(tx.amount)}
                                </div>
                                <div className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
                                  {tx.date}
                                </div>
                              </div>

                              <span
                                className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadge(
                                  tx.category
                                )}`}
                              >
                                {tx.category}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(tx)}
                                  className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    Sound.click(soundEnabled);
                                    onDeleteExpense(tx.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* View All Footer */}
            <div className="text-center pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowAllTransactionsModal(true)}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                View All Transactions
              </button>
            </div>
          </div>

          {/* B. SPENDING BY CATEGORY CARD (Donut Chart + List Breakdown) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
                  Spending by Category
                </h2>
                <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                  Category distribution for {categoryScope === 'month' ? selectedMonthLabel : 'all recorded expenses'}
                </p>
              </div>

              {/* Scope Switcher: Selected Month vs All Time */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setCategoryScope('month');
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    categoryScope === 'month'
                      ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {MONTH_NAMES[selectedMonthIndex]}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setCategoryScope('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    categoryScope === 'all'
                      ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              {/* Left Donut Chart with Center Total */}
              <div className="md:col-span-5 flex flex-col items-center justify-center relative h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="amount"
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), 'Spent']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        backgroundColor: '#1E293B',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Inner Donut Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base sm:text-lg font-extrabold text-[#37352F] dark:text-white tracking-tight">
                    {formatCurrency(
                      categoryScope === 'month'
                        ? stats.monthDisplay
                        : expenses.reduce((sum, e) => sum + e.amount, 0)
                    )}
                  </span>
                  <span className="text-[10px] font-semibold text-[#787774] dark:text-[#9CA3AF] uppercase">
                    Total
                  </span>
                </div>
              </div>

              {/* Right Horizontal Category Breakdown List */}
              <div className="md:col-span-7 space-y-2.5">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-[#37352F] dark:text-white">{cat.name}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-[#37352F] dark:text-white">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span className="text-[#787774] dark:text-[#9CA3AF] text-[11px] w-8 text-right">
                          {cat.percent}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(cat.percent, 100)}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* C. MONTHLY SPENDING TREND CARD */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
                  Monthly Trend
                </h2>
                <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                  Spending velocity and daily expenditure
                </p>
              </div>

              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                {selectedMonthLabel}
              </span>
            </div>

            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Spend']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      backgroundColor: '#1E293B',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#spendingGradient)"
                    dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6, fill: '#7C3AED' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN (Cols 9-12): Excel Upload Logs, Quick Add Presets, & Subscriptions */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* 0. EXCEL SPREADSHEET UPLOAD LOGS & HISTORY CARD */}
          <div
            id="excel-sheet-logs-card"
            className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-4 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#37352F] dark:text-white flex items-center gap-1.5">
                    <span>Excel Upload Logs</span>
                  </h2>
                  <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] block">
                    Upload history &amp; batch delete
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {importLogs.length} {importLogs.length === 1 ? 'sheet' : 'sheets'}
                </span>
              </div>
            </div>

            {/* Quick action bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setShowImportModal(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload New Sheet</span>
              </button>

              {importedCount > 0 && (
                <button
                  type="button"
                  onClick={handleOpenClearAllSheetsModal}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  title="Delete all spendings that came from spreadsheets"
                >
                  Clear all sheets ({importedCount})
                </button>
              )}
            </div>

            {/* Sheets history list */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-0.5">
              {importLogs.length === 0 ? (
                <div className="text-center py-6 px-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <FileSpreadsheet className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    No spreadsheets uploaded yet
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-[220px] mx-auto">
                    Upload your Money Manager export (.xlsx) to see upload history and batch actions here.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setShowImportModal(true);
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Upload Excel
                  </button>
                </div>
              ) : (
                importLogs.map((log) => {
                  const activeMatching = getMatchingExpensesForSheet(log, expenses);
                  const activeCount = activeMatching.length;
                  const activeAmount = activeMatching.reduce((s, e) => s + e.amount, 0);
                  const isFilterActive =
                    selectedSheetFilter === log.fileName ||
                    selectedSheetFilter === log.id ||
                    (selectedSheetFilter && log.fileName && selectedSheetFilter.toLowerCase() === log.fileName.toLowerCase());

                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                        activeCount > 0
                          ? isFilterActive
                            ? 'border-purple-400 bg-purple-50/40 dark:bg-purple-950/30 ring-1 ring-purple-400'
                            : 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/40 opacity-75'
                      }`}
                    >
                      {/* Header: File name & Active badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className="text-xs font-bold text-gray-900 dark:text-gray-100 block truncate"
                            title={log.fileName}
                          >
                            {log.fileName}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(log.uploadDate).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {activeCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 shrink-0">
                            {activeCount} in tracker
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
                            Purged / 0 left
                          </span>
                        )}
                      </div>

                      {/* Metrics Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-emerald-700 dark:text-emerald-300 font-semibold">
                          +{log.addedCount} new added
                        </span>
                        {log.skippedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-amber-700 dark:text-amber-400 font-semibold">
                            {log.skippedCount} duplicates skipped
                          </span>
                        )}
                        {activeAmount > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-purple-700 dark:text-purple-300 font-bold">
                            ₹{Math.round(activeAmount).toLocaleString('en-IN')}
                          </span>
                        ) : null}
                      </div>

                      {/* Actions for this specific sheet */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/60 dark:border-gray-800/80">
                        <div className="flex items-center gap-1.5">
                          {activeCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                Sound.click(soundEnabled);
                                setSelectedSheetFilter(isFilterActive ? null : log.fileName);
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                isFilterActive
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              }`}
                              title="Filter spendings list to view items from this spreadsheet"
                            >
                              <Filter className="w-3 h-3" />
                              <span>{isFilterActive ? 'Clear Filter' : 'View Items'}</span>
                            </button>
                          )}
                        </div>

                        {/* Direct Delete Sheet Action */}
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteSheetModal(log)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[11px] font-bold transition-colors cursor-pointer"
                          title={activeCount > 0 ? "Delete spreadsheet and its spendings" : "Remove spreadsheet from upload history"}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>{activeCount > 0 ? "Delete Sheet" : "Remove Log"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 1. DYNAMIC QUICK ADD PRESETS CARD (Frequent Transactions) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white flex items-center gap-2">
                <span>Quick Add</span>
              </h2>
              <span className="text-[11px] font-semibold text-[#787774] dark:text-[#9CA3AF]">
                {dynamicPresets.length > 0 ? 'Frequent logs' : 'One-tap log'}
              </span>
            </div>

            <div className="space-y-2">
              {dynamicPresets.length > 0 ? (
                dynamicPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleQuickAddPreset(preset)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg group-hover:scale-110 transition-transform shrink-0">
                        {preset.icon}
                      </span>
                      <div className="text-left min-w-0">
                        <span className="text-xs font-bold text-[#37352F] dark:text-white block truncate">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] block truncate">
                          Logged {preset.count}x • {preset.category}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-900 px-2 py-0.5 rounded-md shadow-2xs border border-gray-100 dark:border-gray-800 shrink-0">
                      +{formatCurrency(preset.amount)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-1.5 bg-gray-50/40 dark:bg-gray-900/20">
                  <p className="text-xs font-bold text-[#37352F] dark:text-[#E2E8F0]">
                    No frequent transactions yet
                  </p>
                  <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] leading-relaxed">
                    As you record expenses, your top repeated transactions will automatically appear here for rapid one-tap logging.
                  </p>
                </div>
              )}

              {/* Custom Add New Expense Button */}
              <button
                type="button"
                onClick={() => openAddModal()}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all cursor-pointer group text-xs font-bold text-[#787774] dark:text-[#9CA3AF] hover:text-purple-600 dark:hover:text-purple-300"
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="w-4 h-4 text-purple-500" />
                  <span>Custom Expense</span>
                </div>
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  Add New
                </span>
              </button>
            </div>
          </div>

          {/* 2. RECURRING / SUBSCRIPTIONS CARD */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
                  Recurring / Subscriptions
                </h2>
                <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF]">
                  Auto-renewals & bills
                </p>
              </div>

              <button
                type="button"
                onClick={() => openAddModal({ name: '', amount: 499, category: 'Subscriptions', icon: '💻', note: 'Monthly auto-pay' })}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-2.5">
              {subscriptions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{sub.icon || '🎬'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#37352F] dark:text-white truncate">
                        {sub.name}
                      </div>
                      <div className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
                        {sub.notes || `Next: 2 Sep 2026`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-[#37352F] dark:text-white">
                      {formatCurrency(sub.amount)}
                      <span className="text-[10px] font-normal text-gray-500"> / month</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Upcoming Renewals Highlight Strip */}
            <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 flex items-center gap-2.5 text-purple-700 dark:text-purple-300">
              <Calendar className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold">3 renewals this week</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ADD / EDIT EXPENSE MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#1A202C] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#2D3748] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E5E7EB] dark:border-[#2D3748] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#37352F] dark:text-white">
                    {editingExpense ? 'Edit Expense' : 'Log New Expense'}
                  </h3>
                  <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                    Record immediate spending or recurring subscription
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveForm} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1">
                  Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#111827] text-base font-black text-[#37352F] dark:text-white outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Description / Merchant Name */}
              <div>
                <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1">
                  Description / Merchant *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starbucks, Supermarket Grocery, Uber Ride"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#111827] text-xs sm:text-sm font-semibold text-[#37352F] dark:text-white outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Category Grid Selection */}
              <div>
                <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-gray-100 dark:border-gray-800 rounded-xl">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => {
                        setFormCategory(cat.name);
                        setFormIcon(cat.icon);
                      }}
                      className={`flex items-center gap-1.5 p-2 rounded-lg text-left text-xs font-bold transition-all cursor-pointer ${
                        formCategory === cat.name
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#111827] text-xs font-semibold text-[#37352F] dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#111827] text-xs font-semibold text-[#37352F] dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Credit Card">💳 Credit Card</option>
                    <option value="UPI / Debit">📱 UPI / Debit</option>
                    <option value="Cash">💵 Cash</option>
                    <option value="Bank Transfer">🏦 Bank Transfer</option>
                    <option value="Apple / Google Pay">⚡ Mobile Pay</option>
                  </select>
                </div>
              </div>

              {/* Billing Cycle / Subscription Toggle */}
              <div>
                <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1">
                  Billing Type
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['one-time', 'monthly', 'yearly', 'weekly'] as const).map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setFormBillingCycle(cycle)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize transition-colors ${
                        formBillingCycle === cycle
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {cycle === 'one-time' ? 'One-time' : cycle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider mb-1">
                  Optional Note / Receipt Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Starbucks branch, grocery discount applied"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#111827] text-xs font-medium text-[#37352F] dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs font-bold shadow-sm transition-all"
                >
                  {editingExpense ? 'Save Changes' : 'Log Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VIEW ALL TRANSACTIONS MODAL */}
      {/* ========================================================================= */}
      {showAllTransactionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1A202C] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#2D3748] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-[#E5E7EB] dark:border-[#2D3748] flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#37352F] dark:text-white">
                  All Transactions Log
                </h3>
                <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                  Complete chronological history of recorded expenses ({expenses.length} records)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllTransactionsModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 space-y-1">
              {expenses.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="text-3xl">💳</div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                    YOUR SPENDING JOURNEY STARTS HERE
                  </h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Track everyday expenses so you can understand where your money goes.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllTransactionsModal(false);
                      openAddModal();
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs hover:bg-purple-700"
                  >
                    Add First Expense
                  </button>
                </div>
              ) : (
                expenses.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getCategoryIcon(tx.category, tx.icon)}</span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-[#37352F] dark:text-white">
                          {tx.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {tx.date} • {tx.paymentMethod || 'Card'} {tx.notes ? `• ${tx.notes}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs sm:text-sm font-extrabold text-[#37352F] dark:text-white">
                        {formatCurrency(tx.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAllTransactionsModal(false);
                          openEditModal(tx);
                        }}
                        className="p-1 text-gray-400 hover:text-purple-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onDeleteExpense(tx.id);
                        }}
                        className="p-1 text-gray-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Excel / Spreadsheet Import Modal */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        existingExpenses={expenses}
        soundEnabled={soundEnabled}
      />

      {/* ========================================================================= */}
      {/* 9. SAFE IN-APP CONFIRMATION MODALS (Replaces window.confirm/alert) */}
      {/* ========================================================================= */}

      {/* Modal 1: Delete Specific Spreadsheet Modal */}
      {deleteSheetModal.isOpen && deleteSheetModal.log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sheet-modal-heading"
          >
            <div className="p-5 sm:p-6 space-y-4">
              {/* Modal Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="delete-sheet-modal-heading" className="text-base font-bold text-gray-900 dark:text-white">
                    Delete Spreadsheet
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono">
                    {deleteSheetModal.log.fileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteSheetModal({ isOpen: false, log: null, matchingCount: 0, matchingAmount: 0 })}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sheet Stats Box */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Uploaded On:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {new Date(deleteSheetModal.log.uploadDate).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Active in Spendings:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {deleteSheetModal.matchingCount} {deleteSheetModal.matchingCount === 1 ? 'item' : 'items'} ({formatCurrency(deleteSheetModal.matchingAmount)})
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {deleteSheetModal.matchingCount > 0 ? (
                  <>
                    Are you sure you want to delete this spreadsheet? You can choose to delete all{' '}
                    <strong>{deleteSheetModal.matchingCount} imported transactions</strong> from your tracker, or only remove this spreadsheet from your upload history.
                  </>
                ) : (
                  <>
                    This spreadsheet has no active spendings currently in your tracker. Would you like to remove it from your upload history list?
                  </>
                )}
              </p>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {deleteSheetModal.matchingCount > 0 ? (
                  <>
                    <button
                      type="button"
                      id="btn-confirm-delete-sheet-and-spendings"
                      onClick={() => handleConfirmDeleteSheet(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Sheet &amp; All {deleteSheetModal.matchingCount} Spendings</span>
                    </button>

                    <button
                      type="button"
                      id="btn-confirm-remove-sheet-log-only"
                      onClick={() => handleConfirmDeleteSheet(false)}
                      className="w-full py-2 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Remove from History Only (Keep Spendings)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    id="btn-confirm-delete-sheet-log"
                    onClick={() => handleConfirmDeleteSheet(false)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove from Upload History</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDeleteSheetModal({ isOpen: false, log: null, matchingCount: 0, matchingAmount: 0 })}
                  className="w-full py-2 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Clear All Spreadsheet Spendings Modal */}
      {clearAllSheetsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Clear All Spreadsheet Spendings
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Delete {clearAllSheetsModal.count} imported transactions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClearAllSheetsModal({ isOpen: false, count: 0 })}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Are you sure you want to delete all <strong>{clearAllSheetsModal.count} spendings</strong> imported from spreadsheets? This will also reset your spreadsheet upload history. Your manually entered spendings will remain completely intact.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmClearAllSheets}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete All {clearAllSheetsModal.count} Spreadsheet Spendings</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClearAllSheetsModal({ isOpen: false, count: 0 })}
                  className="w-full py-2 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Clear All Spendings (Wipe Tracker) Modal */}
      {clearAllExpensesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Clear All Spending Records
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Wipe {expenses.length} spending records
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClearAllExpensesModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Are you sure you want to delete <strong>ALL {expenses.length} spending transactions</strong>? This will completely clear all spending records and spreadsheet logs from memory.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmClearAllExpenses}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Wipe All {expenses.length} Records</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClearAllExpensesModal(false)}
                  className="w-full py-2 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-2xl text-xs font-bold border border-gray-800 dark:border-gray-200 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{actionToast.message}</span>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="ml-2 text-gray-400 hover:text-white dark:hover:text-gray-900 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
