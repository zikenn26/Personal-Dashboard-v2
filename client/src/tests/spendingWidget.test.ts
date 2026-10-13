import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeSpendingWidgetSnapshot,
  isEligibleSpendingExpense,
  formatWidgetCurrency,
  getLocalDateKey,
} from '../utils/spendingWidgetCalculator';
import { ExpenseItem } from '../types';

describe('Spending Widget Calculator & Snapshot Generation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly filters eligible spending expenses (debits only, active, positive amount)', () => {
    const validExpense: ExpenseItem = {
      id: 'e1',
      name: 'Coffee',
      amount: 150,
      category: 'Food',
      date: '2026-10-13',
      direction: 'DEBIT',
    };
    expect(isEligibleSpendingExpense(validExpense)).toBe(true);

    // Inactive
    expect(isEligibleSpendingExpense({ ...validExpense, active: false })).toBe(false);

    // Zero or negative amount
    expect(isEligibleSpendingExpense({ ...validExpense, amount: 0 })).toBe(false);
    expect(isEligibleSpendingExpense({ ...validExpense, amount: -50 })).toBe(false);

    // Credit / income transaction
    expect(isEligibleSpendingExpense({ ...validExpense, direction: 'CREDIT' })).toBe(false);
    expect(isEligibleSpendingExpense({ ...validExpense, transactionType: 'CREDIT' })).toBe(false);
    expect(isEligibleSpendingExpense({ ...validExpense, transactionType: 'income' })).toBe(false);
  });

  it('formats currency correctly with integer and decimals', () => {
    expect(formatWidgetCurrency(0)).toBe('₹0');
    expect(formatWidgetCurrency(1500)).toBe('₹1,500');
    expect(formatWidgetCurrency(2450.5)).toBe('₹2,450.50');
  });

  it('computes today and this-week totals from local midnight and Monday 00:00', () => {
    // Fixed reference date: Wednesday, Oct 14, 2026
    const refDate = new Date(2026, 9, 14, 15, 30, 0); // Oct 14, 2026 (Wednesday)
    // Monday of this week: Oct 12, 2026
    // Yesterday: Oct 13, 2026
    // Prev week Monday: Oct 5, 2026
    // Prev week equivalent end (Wed): Oct 7, 2026

    const expenses: ExpenseItem[] = [
      // Monday of this week
      { id: '1', name: 'Groceries', amount: 500, category: 'Food', date: '2026-10-12', direction: 'DEBIT' },
      // Yesterday (Tuesday)
      { id: '2', name: 'Lunch', amount: 300, category: 'Food', date: '2026-10-13', direction: 'DEBIT' },
      // Today (Wednesday)
      { id: '3', name: 'Dinner', amount: 600, category: 'Food', date: '2026-10-14', direction: 'DEBIT' },
      // Tomorrow (future date, must not be counted in today or this-week-to-date)
      { id: '4', name: 'Planned ticket', amount: 1000, category: 'Travel', date: '2026-10-15', direction: 'DEBIT' },
      // Last week Monday (Oct 5)
      { id: '5', name: 'Past Mon Groceries', amount: 400, category: 'Food', date: '2026-10-05', direction: 'DEBIT' },
      // Last week Wednesday (Oct 7)
      { id: '6', name: 'Past Wed Fuel', amount: 600, category: 'Fuel', date: '2026-10-07', direction: 'DEBIT' },
      // Credit income received today (must be excluded)
      { id: '7', name: 'Salary', amount: 50000, category: 'Salary', date: '2026-10-14', direction: 'CREDIT' },
    ];

    const snapshot = computeSpendingWidgetSnapshot(expenses, refDate, '₹');

    // Today's total: only item #3 = 600
    expect(snapshot.todayTotal).toBe(600);
    expect(snapshot.formattedTodayTotal).toBe('₹600');

    // This week's total (Mon Oct 12 to Wed Oct 14): 500 + 300 + 600 = 1400
    expect(snapshot.weekTotal).toBe(1400);
    expect(snapshot.formattedWeekTotal).toBe('₹1,400');

    // Trend Today vs Yesterday (600 vs 300): +100% -> red (spending increased)
    expect(snapshot.todayTrendVisible).toBe(true);
    expect(snapshot.todayTrendText).toBe('+100%');
    expect(snapshot.todayTrendColor).toBe('red');

    // Trend This Week vs Prev Week Equivalent (Oct 5 - Oct 7 had 400 + 600 = 1000):
    // 1400 vs 1000: +40% -> red
    expect(snapshot.weekTrendVisible).toBe(true);
    expect(snapshot.weekTrendText).toBe('+40%');
    expect(snapshot.weekTrendColor).toBe('red');
  });

  it('hides trends when no meaningful comparison data exists (yesterday/prev-week = 0)', () => {
    const refDate = new Date(2026, 9, 14, 10, 0, 0); // Wednesday

    const expenses: ExpenseItem[] = [
      // Only today's spending, nothing yesterday or last week
      { id: '1', name: 'Coffee', amount: 200, category: 'Food', date: '2026-10-14', direction: 'DEBIT' },
    ];

    const snapshot = computeSpendingWidgetSnapshot(expenses, refDate, '₹');

    expect(snapshot.todayTotal).toBe(200);
    expect(snapshot.weekTotal).toBe(200);

    // Trends should be hidden because yesterday and last week have 0 spending
    expect(snapshot.todayTrendVisible).toBe(false);
    expect(snapshot.todayTrendText).toBe('');
    expect(snapshot.weekTrendVisible).toBe(false);
    expect(snapshot.weekTrendText).toBe('');
  });

  it('shows green trend when spending decreases compared to yesterday', () => {
    const refDate = new Date(2026, 9, 14, 12, 0, 0);

    const expenses: ExpenseItem[] = [
      // Yesterday: 500
      { id: '1', name: 'Shopping', amount: 500, category: 'Shopping', date: '2026-10-13', direction: 'DEBIT' },
      // Today: 250 (50% decrease)
      { id: '2', name: 'Snacks', amount: 250, category: 'Food', date: '2026-10-14', direction: 'DEBIT' },
    ];

    const snapshot = computeSpendingWidgetSnapshot(expenses, refDate, '₹');

    expect(snapshot.todayTotal).toBe(250);
    expect(snapshot.todayTrendVisible).toBe(true);
    expect(snapshot.todayTrendText).toBe('-50%');
    expect(snapshot.todayTrendColor).toBe('green');
  });

  it('handles empty records cleanly', () => {
    const snapshot = computeSpendingWidgetSnapshot([], new Date(), '₹');

    expect(snapshot.todayTotal).toBe(0);
    expect(snapshot.formattedTodayTotal).toBe('₹0');
    expect(snapshot.todayTrendVisible).toBe(false);

    expect(snapshot.weekTotal).toBe(0);
    expect(snapshot.formattedWeekTotal).toBe('₹0');
    expect(snapshot.weekTrendVisible).toBe(false);
  });
});
