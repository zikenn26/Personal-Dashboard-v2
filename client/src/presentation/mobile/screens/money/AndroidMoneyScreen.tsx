import React, { useState, useMemo } from 'react';
import { CreditCard, Plus, Trash2, ArrowUpRight, TrendingDown, TrendingUp, Calendar, Tag, DollarSign, Wallet, FileSpreadsheet } from 'lucide-react';
import { ExpenseItem, ExcelImportLog } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES } from '../../design-system/materialYou';
import { SwipeActionRow } from '../../gestures/SwipeActionRow';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { QuickExpenseSheet } from '../../components/QuickExpenseSheet';

export interface AndroidMoneyScreenProps {
  expenses: ExpenseItem[];
  importLogs?: ExcelImportLog[];
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<ExpenseItem>) => void;
  onDeleteExpense?: (id: string) => void;
}

type PeriodFilter = 'month' | 'today' | 'all';

export const AndroidMoneyScreen: React.FC<AndroidMoneyScreenProps> = ({
  expenses,
  importLogs = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activeActionExpense, setActiveActionExpense] = useState<ExpenseItem | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDateStr = now.toISOString().split('T')[0];

  // Calculations
  const { totalMonthSpending, todaySpending, categoryTotals } = useMemo(() => {
    let monthTotal = 0;
    let todayTotal = 0;
    const catMap: Record<string, number> = {};

    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const d = new Date(e.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        monthTotal += amt;
      }
      if (e.date === todayDateStr) {
        todayTotal += amt;
      }

      const cat = e.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + amt;
    });

    const sortedCats = Object.entries(catMap)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalMonthSpending: monthTotal,
      todaySpending: todayTotal,
      categoryTotals: sortedCats,
    };
  }, [expenses, currentYear, currentMonth, todayDateStr]);

  // Filtered transactions
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, periodFilter, selectedCategory, currentYear, currentMonth, todayDateStr]);

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteExpense) onDeleteExpense(id);
  };

  const actionItems: ActionSheetItem[] = activeActionExpense
    ? [
        {
          label: 'Delete Transaction',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => handleDelete(activeActionExpense.id),
        },
      ]
    : [];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
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

        {onAddExpense && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        )}
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

      {/* Recent Transactions List */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-1 block">
          Transactions ({filteredExpenses.length})
        </span>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <CreditCard className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No transactions recorded
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tap &ldquo;Add Expense&rdquo; to log your spending or import transactions.
            </p>
          </div>
        ) : (
          filteredExpenses.map((item) => (
            <ExpenseItemRow
              key={item.id}
              expense={item}
              onDelete={() => handleDelete(item.id)}
              onLongPress={() => setActiveActionExpense(item)}
            />
          ))
        )}
      </div>

      {/* Add Expense Sheet */}
      {onAddExpense && (
        <QuickExpenseSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddExpense={onAddExpense}
        />
      )}

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
  onDelete: () => void;
  onLongPress: () => void;
}

const ExpenseItemRow: React.FC<ExpenseItemRowProps> = ({
  expense,
  onDelete,
  onLongPress,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  return (
    <SwipeActionRow
      onSwipeLeft={onDelete}
      rightActionContent={<Trash2 className="w-5 h-5" />}
      rightActionColor="bg-rose-600"
    >
      <div
        {...longPressProps}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all select-none shadow-2xs"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-gray-900 dark:text-white block truncate">
              {expense.name}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              <span>{expense.category}</span>
              <span>•</span>
              <span>{expense.date}</span>
              {expense.paymentMethod && (
                <>
                  <span>•</span>
                  <span className="font-mono">{expense.paymentMethod}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="text-sm font-bold text-gray-900 dark:text-white block">
            ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {expense.bankOrAccount && (
            <span className="text-[10px] text-gray-400 block truncate max-w-[80px]">
              {expense.bankOrAccount}
            </span>
          )}
        </div>
      </div>
    </SwipeActionRow>
  );
};
