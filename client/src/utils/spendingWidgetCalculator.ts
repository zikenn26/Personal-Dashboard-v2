import { ExpenseItem } from '../types';
import { isCreditTransaction } from './expenseUtils';

export interface SpendingWidgetSnapshot {
  todayTotal: number;
  formattedTodayTotal: string;
  todayTrendText: string;
  todayTrendColor: 'green' | 'red' | 'neutral';
  todayTrendVisible: boolean;

  weekTotal: number;
  formattedWeekTotal: string;
  weekTrendText: string;
  weekTrendColor: 'green' | 'red' | 'neutral';
  weekTrendVisible: boolean;

  lastUpdated: number;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const getLocalDateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const normalizeExpenseDateKey = (value?: string | null): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : getLocalDateKey(parsed);
};

export const isEligibleSpendingExpense = (e?: ExpenseItem | null): boolean => {
  if (!e || e.active === false) return false;
  const amount = Number(e.amount);
  if (isNaN(amount) || amount <= 0) return false;
  return !isCreditTransaction(e);
};

export const formatWidgetCurrency = (amount: number, symbol: string = '₹'): string => {
  const safeAmount = Number(amount) || 0;
  if (safeAmount === 0) return `${symbol}0`;
  if (Number.isInteger(safeAmount) || Math.round(safeAmount) === safeAmount) {
    return `${symbol}${Math.round(safeAmount).toLocaleString('en-IN')}`;
  }
  return `${symbol}${safeAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Computes today's and this-week's eligible spending totals along with trend comparison against
 * yesterday and the equivalent elapsed period of the previous week.
 *
 * Rules:
 * - Today: Local midnight to present.
 * - This Week: Monday 00:00 through the present.
 * - Trend: Shown ONLY when meaningful comparison data exists (comparison total > 0). Otherwise hidden.
 */
export function computeSpendingWidgetSnapshot(
  expenses: ExpenseItem[] = [],
  referenceDate: Date = new Date(),
  currencySymbol: string = '₹'
): SpendingWidgetSnapshot {
  const safeExpenses = Array.isArray(expenses) ? expenses.filter(isEligibleSpendingExpense) : [];

  const now = new Date(referenceDate.getTime());
  const todayKey = getLocalDateKey(now);

  // Yesterday date key
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  // This week's start (Monday 00:00)
  // getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOfWeek = now.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const mondayKey = getLocalDateKey(mondayDate);

  // Previous week's equivalent elapsed period (prev Monday to prev same weekday)
  const prevWeekMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday - 7);
  const prevWeekEquivalentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const prevWeekMondayKey = getLocalDateKey(prevWeekMonday);
  const prevWeekEndKey = getLocalDateKey(prevWeekEquivalentEnd);

  let todayTotal = 0;
  let yesterdayTotal = 0;
  let weekTotal = 0;
  let prevWeekEquivalentTotal = 0;

  for (const item of safeExpenses) {
    const key = normalizeExpenseDateKey(item.date);
    if (!key) continue;
    const amount = Number(item.amount) || 0;

    // Today
    if (key === todayKey) {
      todayTotal += amount;
    }

    // Yesterday
    if (key === yesterdayKey) {
      yesterdayTotal += amount;
    }

    // This week (Monday 00:00 through present)
    if (key >= mondayKey && key <= todayKey) {
      weekTotal += amount;
    }

    // Previous week equivalent elapsed period
    if (key >= prevWeekMondayKey && key <= prevWeekEndKey) {
      prevWeekEquivalentTotal += amount;
    }
  }

  // Calculate Today's trend vs Yesterday
  let todayTrendText = '';
  let todayTrendColor: 'green' | 'red' | 'neutral' = 'neutral';
  let todayTrendVisible = false;

  if (yesterdayTotal > 0) {
    const diff = todayTotal - yesterdayTotal;
    const percent = Math.round((diff / yesterdayTotal) * 100);
    todayTrendVisible = true;
    if (percent > 0) {
      todayTrendText = `+${percent}%`;
      todayTrendColor = 'red'; // More spending
    } else if (percent < 0) {
      todayTrendText = `${percent}%`;
      todayTrendColor = 'green'; // Less spending / savings
    } else {
      todayTrendText = '0%';
      todayTrendColor = 'neutral';
    }
  }

  // Calculate This Week's trend vs Previous Week's equivalent elapsed period
  let weekTrendText = '';
  let weekTrendColor: 'green' | 'red' | 'neutral' = 'neutral';
  let weekTrendVisible = false;

  if (prevWeekEquivalentTotal > 0) {
    const diff = weekTotal - prevWeekEquivalentTotal;
    const percent = Math.round((diff / prevWeekEquivalentTotal) * 100);
    weekTrendVisible = true;
    if (percent > 0) {
      weekTrendText = `+${percent}%`;
      weekTrendColor = 'red';
    } else if (percent < 0) {
      weekTrendText = `${percent}%`;
      weekTrendColor = 'green';
    } else {
      weekTrendText = '0%';
      weekTrendColor = 'neutral';
    }
  }

  return {
    todayTotal,
    formattedTodayTotal: formatWidgetCurrency(todayTotal, currencySymbol),
    todayTrendText,
    todayTrendColor,
    todayTrendVisible,

    weekTotal,
    formattedWeekTotal: formatWidgetCurrency(weekTotal, currencySymbol),
    weekTrendText,
    weekTrendColor,
    weekTrendVisible,

    lastUpdated: Date.now(),
  };
}
