import React, { useState, useMemo } from 'react';
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
import { ExpenseItem, ExpenseCategory, PaymentMethod, ExpenseBillingCycle } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';

interface ExpenseTrackerProps {
  expenses: ExpenseItem[];
  onAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updated: Partial<ExpenseItem>) => void;
  onBatchAddExpenses?: (expenses: Array<Omit<ExpenseItem, 'id'>>) => void;
  onToggleActive?: (id: string) => void;
  onDeleteExpense: (id: string) => void;
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

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onBatchAddExpenses,
  onToggleActive,
  onDeleteExpense,
  soundEnabled,
}) => {
  // Navigation & Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');
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
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

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

    // Sum for This Month
    const monthTotal = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

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
      weekDisplay: weekTotal,
      todayDisplay: todayTotal,
      recurringDisplay: recurringTotal,
      hasRealData: expenses.length > 0,
    };
  }, [expenses]);

  // Category Breakdown Data
  const categoryBreakdown = useMemo(() => {
    if (expenses.length === 0) {
      return [];
    }

    const catMap: Record<string, number> = {};
    let total = 0;
    expenses.forEach((e) => {
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
  }, [expenses]);

  // Monthly Spending Trend Data
  const trendData = useMemo(() => {
    if (expenses.length === 0) {
      return [];
    }

    // Group actual expenses by day
    const days: Record<string, number> = {};
    expenses.slice(0, 15).forEach((e) => {
      const d = e.date ? e.date.substring(5) : 'Recent';
      days[d] = (days[d] || 0) + e.amount;
    });

    return Object.entries(days).map(([date, amount]) => ({
      date,
      amount,
      label: date,
    }));
  }, [expenses]);

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

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (activeFilter === 'today') {
      list = list.filter((e) => e.date === todayStr);
    } else if (activeFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(new Date().getDate() - 7);
      list = list.filter((e) => new Date(e.date) >= sevenDaysAgo);
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
  }, [expenses, searchQuery, selectedCategoryFilter, activeFilter]);

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

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Month Selector Button */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E5E7EB] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] text-xs font-semibold text-[#37352F] dark:text-white hover:bg-gray-50 dark:hover:bg-[#2D3748] shadow-2xs transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{selectedMonth}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>

          {/* Reset / Filter Refresh Button */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveFilter('all');
              setSelectedCategoryFilter('all');
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
      {/* 2. TOP SUMMARY ROW (4 Compact Cards) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: THIS MONTH */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs flex items-start justify-between relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-800 transition-all">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#787774] dark:text-[#9CA3AF]">
              This Month
            </span>
            <div className="text-lg sm:text-xl font-black text-[#37352F] dark:text-white tracking-tight">
              {formatCurrency(stats.monthDisplay)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>12% vs last month</span>
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
                    : 'This Month'}
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
                  Spending by Category
                </h2>
                <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                  Category distribution for the current cycle
                </p>
              </div>

              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                This Month ▾
              </span>
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
                    {formatCurrency(stats.monthDisplay)}
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
                This Month ▾
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
        {/* RIGHT COLUMN (Cols 9-12): Quick Add Presets & Recurring Subscriptions */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4 space-y-6">
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
    </div>
  );
};
