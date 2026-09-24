import React from 'react';
import { CreditCard, ArrowRight, TrendingUp, Plus } from 'lucide-react';
import { ExpenseItem } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES, CARD_HEADER_CLASSES, CARD_TITLE_CLASSES, CARD_BODY_CLASSES } from '../../design-system/materialYou';

export interface AndroidSpendingCardProps {
  expenses: ExpenseItem[];
  onNavigateToMoney: () => void;
  onOpenAddExpense: () => void;
}

export const AndroidSpendingCard: React.FC<AndroidSpendingCardProps> = ({
  expenses,
  onNavigateToMoney,
  onOpenAddExpense,
}) => {
  // Compute current month total
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalMonthSpending = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const recentExpenses = [...expenses].reverse().slice(0, 3);

  return (
    <div className={CARD_SURFACE_CLASSES}>
      {/* Header */}
      <div className={CARD_HEADER_CLASSES}>
        <div className={CARD_TITLE_CLASSES}>
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <span>Spending Snapshot</span>
        </div>

        <button
          type="button"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            onNavigateToMoney();
          }}
          className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>Money Hub</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className={CARD_BODY_CLASSES}>
        {/* Month Summary Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-900/60 mb-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
              This Month&apos;s Spending
            </span>
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              ₹{totalMonthSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onOpenAddExpense();
            }}
            className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Recent Transactions List */}
        {recentExpenses.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No expenses recorded yet. Tap &apos;Add&apos; to log your first transaction.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white block truncate">
                    {exp.name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                    <span>{exp.category}</span>
                    {exp.paymentMethod && (
                      <>
                        <span>•</span>
                        <span className="text-violet-600 dark:text-violet-400 font-medium">
                          {exp.paymentMethod}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-gray-900 dark:text-white block font-mono">
                    ₹{Number(exp.amount).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-400 block font-mono">
                    {exp.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
