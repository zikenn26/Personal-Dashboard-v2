import { ExpenseItem } from '../types';

/**
 * Robust date/time comparator for expenses.
 * Sorts strictly newest -> older transaction based on actual transaction date and time.
 * - Handles invalid / missing dates safely.
 * - Compares ISO date string (e.g. "2026-09-25").
 * - If dates are equal, compares time string (e.g. "18:30" vs "14:10").
 * - Fallback to creation ID timestamp if dates and times are identical.
 */
export function compareExpensesByDateTimeDesc(a: ExpenseItem, b: ExpenseItem): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const dateA = a.date || '';
  const dateB = b.date || '';

  // 1. Primary sort: Date descending
  if (dateA !== dateB) {
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA;
    }
    return dateB.localeCompare(dateA);
  }

  // 2. Secondary sort: Time descending (e.g. "18:30" > "14:10")
  const timeA = a.time || '';
  const timeB = b.time || '';
  if (timeA && timeB && timeA !== timeB) {
    return timeB.localeCompare(timeA);
  }
  if (timeA && !timeB) return -1;
  if (!timeA && timeB) return 1;

  // 3. Deterministic fallback: ID timestamp or string
  return (b.id || '').localeCompare(a.id || '');
}

/**
 * Returns the highest-priority human-readable title for a transaction.
 *
 * Title Priority:
 * 1. Merchant / payee / counterparty name (e.g. "ARPITA PRIYADARSINI")
 * 2. Parsed merchant name from transaction SMS
 * 3. Existing manually assigned merchant/payee
 * 4. Existing transaction description (expense.name)
 * 5. Transaction type + fallback (e.g. "Bank Debit", "UPI Payment")
 *
 * Never renders generic "UPI" when a counterparty or merchant is available.
 */
export function getTransactionDisplayTitle(expense?: Partial<ExpenseItem> | null): string {
  if (!expense) return 'Bank Transaction';

  const cleanPayee = (expense.payee || '').trim();
  const cleanName = (expense.name || '').trim();

  const isGeneric = (str: string) =>
    /^(upi|vpa|bank debit|bank credit|bank transfer|bank transaction|expense|payment)$/i.test(str);

  // 1. Merchant / payee / counterparty name if non-generic
  if (cleanPayee && !isGeneric(cleanPayee)) {
    return cleanPayee;
  }

  // 2. Existing transaction description / merchant if non-generic
  if (cleanName && !isGeneric(cleanName)) {
    return cleanName;
  }

  // 3. Fallback to payee if provided
  if (cleanPayee) {
    return cleanPayee;
  }

  // 4. Fallback to name if provided
  if (cleanName) {
    return cleanName;
  }

  // 5. Transaction type + payment method fallback
  if (expense.transactionType === 'income' || expense.transactionType === 'CREDIT') {
    return 'Income Credit';
  }

  if (expense.paymentMethod) {
    return `${expense.paymentMethod} Payment`;
  }

  return 'Bank Debit';
}

/**
 * Formats a currency amount into standard Indian Rupee notation (e.g., ₹303.00)
 */
export function formatTransactionAmount(amount: number): string {
  const safeNum = Number(amount) || 0;
  return `₹${safeNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
