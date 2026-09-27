import { ExpenseItem } from '../types';

/**
 * Standard transaction direction:
 * - DEBIT: money spent / withdrawn / paid from user's account
 * - CREDIT: money received / refunded / deposited to user's account
 */
export type TransactionDirection = 'DEBIT' | 'CREDIT';

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
 * Returns whether a transaction is a CREDIT (money coming in, refund, deposit, income).
 * Do NOT infer direction from title.
 */
export function isCreditTransaction(expense?: Partial<ExpenseItem> | null): boolean {
  if (!expense) return false;
  if (expense.direction === 'CREDIT') return true;
  if (expense.direction === 'DEBIT') return false;
  if (expense.transactionType === 'CREDIT' || expense.transactionType === 'income') return true;
  return false;
}

/**
 * Returns whether a transaction is a DEBIT (money going out, spent, paid, withdrawal).
 */
export function isDebitTransaction(expense?: Partial<ExpenseItem> | null): boolean {
  return !isCreditTransaction(expense);
}

/**
 * Standardizes transaction direction into 'DEBIT' or 'CREDIT'.
 */
export function getTransactionDirection(expense?: Partial<ExpenseItem> | null): TransactionDirection {
  return isCreditTransaction(expense) ? 'CREDIT' : 'DEBIT';
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
  const cleanMerchant = (expense.merchant || '').trim();
  const cleanCounterparty = (expense.counterparty || '').trim();
  const cleanName = (expense.name || '').trim();

  const isGeneric = (str: string) =>
    /^(upi|vpa|bank debit|bank credit|bank transfer|bank transaction|expense|payment|add)$/i.test(str);

  // 1. Counterparty / Payee / Merchant name if non-generic
  if (cleanCounterparty && !isGeneric(cleanCounterparty)) {
    return cleanCounterparty;
  }
  if (cleanPayee && !isGeneric(cleanPayee)) {
    return cleanPayee;
  }
  if (cleanMerchant && !isGeneric(cleanMerchant)) {
    return cleanMerchant;
  }

  // 2. Existing transaction description / merchant if non-generic
  if (cleanName && !isGeneric(cleanName)) {
    return cleanName;
  }

  // 3. Fallbacks
  if (cleanPayee) return cleanPayee;
  if (cleanMerchant) return cleanMerchant;
  if (cleanName && cleanName.toLowerCase() !== 'add') return cleanName;

  // 4. Fallback based on direction
  if (isCreditTransaction(expense)) {
    return 'Income / Refund';
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

/**
 * Formats date and time nicely: e.g. "25 Sep 2026 • 10:42 AM"
 */
export function formatTransactionDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '';
  let formattedDate = dateStr;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      formattedDate = `${day} ${month} ${year}`;
    }
  } catch {
    // Keep dateStr as-is
  }

  let formattedTime = '';
  if (timeStr) {
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      formattedTime = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
    } else {
      formattedTime = timeStr;
    }
  }

  return formattedTime ? `${formattedDate} • ${formattedTime}` : formattedDate;
}

/**
 * MATHEMATICAL CORRECTNESS:
 * Total Money Spent does NOT include credits.
 * Credits are money coming IN.
 * Under NO circumstances should a refund/credit increase the "Total Spent" metric.
 */
export function calculateTotalSpent(expenses: ExpenseItem[]): number {
  if (!expenses || expenses.length === 0) return 0;
  return expenses.reduce((sum, item) => {
    // Only sum DEBIT transactions!
    if (isCreditTransaction(item)) {
      return sum;
    }
    return sum + (Number(item.amount) || 0);
  }, 0);
}

/**
 * Calculates total credits / refunds / income received
 */
export function calculateTotalCredits(expenses: ExpenseItem[]): number {
  if (!expenses || expenses.length === 0) return 0;
  return expenses.reduce((sum, item) => {
    if (isCreditTransaction(item)) {
      return sum + (Number(item.amount) || 0);
    }
    return sum;
  }, 0);
}

/**
 * Calculates net spending: Total Spent minus Total Credits (clamped to 0 minimum)
 */
export function calculateNetSpending(expenses: ExpenseItem[]): number {
  const spent = calculateTotalSpent(expenses);
  const credits = calculateTotalCredits(expenses);
  return Math.max(0, spent - credits);
}

/**
 * Sanitizes and masks financial identifiers (bank accounts, card numbers)
 * Ensures no sensitive data is exposed, using XX... or •••• ... formatting
 */
export function maskFinancialIdentifier(identifier?: string | null): string {
  if (!identifier) return '';
  const trimmed = identifier.trim();
  // If already masked like XX070, •••• 070, **1234, keep it
  if (/^(?:[X*•]{2,4}\s*\d{3,4}|XX\d+)$/i.test(trimmed)) {
    return trimmed;
  }
  // Extract trailing 3 or 4 digits
  const lastDigits = trimmed.replace(/\D/g, '').slice(-4);
  if (lastDigits) {
    return `XX${lastDigits}`;
  }
  return trimmed;
}
