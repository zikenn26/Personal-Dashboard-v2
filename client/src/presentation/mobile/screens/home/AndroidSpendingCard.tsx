import React, { useMemo } from 'react';
import { CreditCard, ArrowRight, Plus } from 'lucide-react';
import { ExpenseItem } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES, CARD_HEADER_CLASSES, CARD_TITLE_CLASSES, CARD_BODY_CLASSES } from '../../design-system/materialYou';
import { compareExpensesByDateTimeDesc, getTransactionDisplayTitle, isCreditTransaction } from '../../../../utils/expenseUtils';

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Expense dates are calendar dates in the user's local timezone.
 *
 * IMPORTANT:
 * Do not use `toISOString().split('T')[0]` for these values.
 * `toISOString()` converts the Date to UTC first, which can shift a
 * local calendar date to the previous/next day.
 */
const pad2 = (value: number): string => String(value).padStart(2, '0');

const getLocalDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const normalizeExpenseDateKey = (value?: string | null): string => {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  // Expense records normally use YYYY-MM-DD. Preserve that calendar date
  // exactly rather than parsing it as a UTC timestamp.
  const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) return dateOnlyMatch[1];

  // Fallback for legacy values containing a full timestamp.
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : getLocalDateKey(parsed);
};

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
  // Use local calendar keys for date-only expense records.
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  // Compute current month debits total.
  // Using the YYYY-MM prefix avoids Date("YYYY-MM-DD") UTC parsing issues.
  const totalMonthSpending = useMemo(() => {
    return expenses
      .filter((e) => {
        const dateKey = normalizeExpenseDateKey(e.date);
        return (
          dateKey.startsWith(currentMonthPrefix) &&
          !isCreditTransaction(e)
        );
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses, currentMonthPrefix]);

  // ALWAYS sort by actual transaction date and time descending,
  // strictly taking the 4 newest real transactions.
  const recentExpenses = useMemo(() => {
    return [...expenses]
      .filter((e) => e && e.active !== false && Number(e.amount) > 0)
      .sort(compareExpensesByDateTimeDesc)
      .slice(0, 4);
  }, [expenses]);

  // Group the 4 recent transactions by their local calendar date.
  const dateGroups = useMemo(() => {
    const todayDateStr = getLocalDateKey();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = getLocalDateKey(yesterday);

    const formatGroupDateLabel = (dateStr: string): string => {
      const normalizedDate = normalizeExpenseDateKey(dateStr);

      if (!normalizedDate) return 'Unknown Date';
      if (normalizedDate === todayDateStr) return 'Today';
      if (normalizedDate === yesterdayDateStr) return 'Yesterday';

      const d = new Date(`${normalizedDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) return normalizedDate;

      return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
    };

    const groups: { key: string; label: string; items: ExpenseItem[] }[] = [];

    recentExpenses.forEach((item) => {
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
  }, [recentExpenses]);

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
        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-900/60 mb-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 block">
              This Month&apos;s Spending
            </span>
            <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
              ₹{totalMonthSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onOpenAddExpense();
            }}
            className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Recent Transactions List (Exactly 4 newest real records, no mock data) */}
        {recentExpenses.length === 0 ? (
          <div className="py-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No expenses recorded yet. Tap &apos;Add&apos; to log your first transaction.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dateGroups.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-0.5">
                  {group.label}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((exp) => {
                    const isCredit = isCreditTransaction(exp);
                    return (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Direction indicator dot: 🔴 Debit / 🟢 Credit */}
                            {isCredit ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Credit" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Debit" />
                            )}
                            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {getTransactionDisplayTitle(exp)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className={isCredit ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                              {isCredit ? 'Credit' : 'Debit'}
                            </span>
                            <span>•</span>
                            <span>{exp.category}</span>
                            {exp.paymentMethod && (
                              <>
                                <span>•</span>
                                <span className="text-violet-600 dark:text-violet-400 font-medium truncate max-w-[80px]">
                                  {exp.paymentMethod}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold block ${
                            isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {isCredit ? '+' : ''}₹{(exp.amount || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                            {exp.time || ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AndroidSpendingCard;
