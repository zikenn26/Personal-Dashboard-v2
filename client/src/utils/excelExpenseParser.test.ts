import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseExpensesFromExcel,
  parseSmartDate,
  parseSmartAmount,
} from './excelExpenseParser';

describe('Excel Expense Parser Engine', () => {
  it('parses diverse date formats into clean YYYY-MM-DD strings', () => {
    // Money Manager / Indian banking formats
    expect(parseSmartDate('08/09/2026 14:30:00')?.date).toBe('2026-09-08');
    expect(parseSmartDate('08-09-2026')?.date).toBe('2026-09-08');
    expect(parseSmartDate('2026-09-08')?.date).toBe('2026-09-08');
    expect(parseSmartDate('2026/09/08')?.date).toBe('2026-09-08');
  });

  it('parses diverse currency and amount representations cleanly', () => {
    expect(parseSmartAmount('₹ 1,500.50')).toBe(1500.5);
    expect(parseSmartAmount('INR 250')).toBe(250);
    expect(parseSmartAmount('-450.00')).toBe(450);
    expect(parseSmartAmount(3500)).toBe(3500);
    expect(parseSmartAmount('0')).toBeNull();
    expect(parseSmartAmount('N/A')).toBeNull();
  });

  it('parses an Excel workbook buffer into structured expense items without console errors', async () => {
    // Spy on console.error
    const errorSpy = vi.spyOn(console, 'error');

    // Generate a sample Money Manager styled spreadsheet in memory
    const rows = [
      ['Date', 'Account', 'Category', 'Subcategory', 'Note', 'INR', 'Income/Expense'],
      ['01/09/2026 10:00:00', 'HDFC Bank', 'Food', 'Dining', 'Lunch at Bistro', '450.00', 'Expense'],
      ['02/09/2026 18:30:00', 'Credit Card', 'Transport', 'Metro', 'Metro card recharge', '200.00', 'Expense'],
      ['03/09/2026 09:15:00', 'Cash', 'Snacks', 'Coffee', 'Cappuccino with team', '120.00', 'Expense'],
      ['04/09/2026 12:00:00', 'Salary Account', 'Salary', 'Monthly', 'Monthly Salary Credit', '85000.00', 'Income'],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const result = await parseExpensesFromExcel(u8, 'september_expenses.xlsx', 'test_batch_1');

    expect(result.totalRows).toBe(4);
    expect(result.expenses.length).toBe(3); // 3 expenses (1 income filtered out)
    expect(result.incomeCount).toBe(1);
    expect(result.totalAmount).toBe(770);

    // Verify first expense fields
    const first = result.expenses[0];
    expect(first.date).toBe('2026-09-01');
    expect(first.amount).toBe(450);
    expect(first.category).toBe('Food & Dining');
    expect(first.name).toBe('Lunch at Bistro');

    // Confirm no errors were logged to console
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
