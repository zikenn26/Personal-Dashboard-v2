import { describe, it, expect } from 'vitest';
import {
  computeSpendingWidgetSnapshot,
  formatWidgetCurrency,
  isEligibleSpendingExpense,
} from '../utils/spendingWidgetCalculator';
import { ExpenseItem } from '../types';

describe('Spending Widget Calculator', () => {
  const mockExpenses: ExpenseItem[] = [
    {
      id: '1',
      name: 'Grocery',
      amount: 500,
      category: 'Food',
      date: '2026-10-13', // Tuesday (Today)
      active: true,
      direction: 'DEBIT',
    },
    {
      id: '2',
      name: 'Coffee',
      amount: 150,
      category: 'Food',
      date: '2026-10-13', // Tuesday (Today)
      active: true,
      direction: 'DEBIT',
    },
    {
      id: '3',
      name: 'Salary / Credit',
      amount: 50000,
      category: 'Salary',
      date: '2026-10-13',
      active: true,
      direction: 'CREDIT', // Should be excluded from spending
    },
    {
      id: '4',
      name: 'Dinner yesterday',
      amount: 800,
      category: 'Food',
      date: '2026-10-12', // Monday (Yesterday, also part of this week)
      active: true,
      direction: 'DEBIT',
    },
    {
      id: '5',
      name: 'Inactive item',
      amount: 1000,
      category: 'Shopping',
      date: '2026-10-13',
      active: false, // Inactive: should be excluded
      direction: 'DEBIT',
    },
    {
      id: '6',
      name: 'Last Tuesday (prev week)',
      amount: 600,
      category: 'Utilities',
      date: '2026-10-06',
      active: true,
      direction: 'DEBIT',
    },
    {
      id: '7',
      name: 'Last Monday (prev week)',
      amount: 400,
      category: 'Groceries',
      date: '2026-10-05',
      active: true,
      direction: 'DEBIT',
    },
  ];

  it('filters eligible spending expenses correctly', () => {
    expect(isEligibleSpendingExpense(mockExpenses[0])).toBe(true);
    expect(isEligibleSpendingExpense(mockExpenses[2])).toBe(false); // credit
    expect(isEligibleSpendingExpense(mockExpenses[4])).toBe(false); // inactive
    expect(isEligibleSpendingExpense(null)).toBe(false);
  });

  it('formats currency cleanly with commas and symbols', () => {
    expect(formatWidgetCurrency(0)).toBe('₹0');
    expect(formatWidgetCurrency(1450)).toBe('₹1,450');
    expect(formatWidgetCurrency(1000000)).toBe('₹10,00,000');
  });

  it('calculates today total and this-week total correctly on Tuesday 2026-10-13', () => {
    const refDate = new Date(2026, 9, 13, 14, 0, 0); // Oct 13, 2026 (Month is 0-indexed: 9 = Oct)
    const snapshot = computeSpendingWidgetSnapshot(mockExpenses, refDate, '₹');

    // Today (Oct 13): 500 + 150 = 650
    expect(snapshot.todayTotal).toBe(650);
    expect(snapshot.formattedTodayTotal).toBe('₹650');

    // Yesterday (Oct 12): 800
    // Diff: 650 - 800 = -150 => -19% (spent less, so green)
    expect(snapshot.todayTrendVisible).toBe(true);
    expect(snapshot.todayTrendText).toBe('-19%');
    expect(snapshot.todayTrendColor).toBe('green');

    // This week (Monday Oct 12 to Tuesday Oct 13): 800 + 650 = 1450
    expect(snapshot.weekTotal).toBe(1450);
    expect(snapshot.formattedWeekTotal).toBe('₹1,450');

    // Previous week equivalent period (Monday Oct 05 to Tuesday Oct 06): 400 + 600 = 1000
    // Diff: 1450 - 1000 = +450 => +45% (spent more, so red)
    expect(snapshot.weekTrendVisible).toBe(true);
    expect(snapshot.weekTrendText).toBe('+45%');
    expect(snapshot.weekTrendColor).toBe('red');
  });

  it('hides trend when no comparison period data exists', () => {
    const refDate = new Date(2026, 9, 13, 14, 0, 0);
    // Only today expense
    const singleExpense: ExpenseItem[] = [
      {
        id: '1',
        name: 'Lunch',
        amount: 200,
        date: '2026-10-13',
        active: true,
      },
    ];
    const snapshot = computeSpendingWidgetSnapshot(singleExpense, refDate, '₹');
    expect(snapshot.todayTotal).toBe(200);
    expect(snapshot.todayTrendVisible).toBe(false);
    expect(snapshot.todayTrendText).toBe('');
    expect(snapshot.weekTotal).toBe(200);
    expect(snapshot.weekTrendVisible).toBe(false);
  });

  it('handles empty records safely', () => {
    const snapshot = computeSpendingWidgetSnapshot([], new Date(), '₹');
    expect(snapshot.todayTotal).toBe(0);
    expect(snapshot.formattedTodayTotal).toBe('₹0');
    expect(snapshot.todayTrendVisible).toBe(false);
    expect(snapshot.weekTotal).toBe(0);
    expect(snapshot.formattedWeekTotal).toBe('₹0');
    expect(snapshot.weekTrendVisible).toBe(false);
  });
});
