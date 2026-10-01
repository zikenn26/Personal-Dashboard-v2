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

export function isCreditTransaction(expense?: Partial<ExpenseItem> | null): boolean {
  if (!expense) return false;
  return (
    expense.direction === 'CREDIT' ||
    expense.transactionType === 'CREDIT' ||
    expense.transactionType === 'income' ||
    (expense as any).type === 'income' ||
    (expense as any).type === 'CREDIT' ||
    (expense as any).type === 'credit'
  );
}

export function getTransactionDirection(expense?: Partial<ExpenseItem> | null): 'DEBIT' | 'CREDIT' {
  return isCreditTransaction(expense) ? 'CREDIT' : 'DEBIT';
}

/**
 * Returns the highest-priority human-readable title for a transaction.
 *
 * Title Priority:
 * 1. Merchant / payee / counterparty name (e.g. "ARPITA PRIYADARSINI", "Amazon")
 * 2. Parsed merchant name from transaction SMS / metadata
 * 3. Existing manually assigned merchant/payee
 * 4. Existing transaction description (expense.name)
 * 5. Transaction type + fallback (e.g. "Bank Debit", "UPI Payment")
 *
 * Never renders generic "UPI" or imperative verbs like "add" when a counterparty or merchant is available.
 */
export function getTransactionDisplayTitle(expense?: Partial<ExpenseItem> | null): string {
  if (!expense) return 'Bank Transaction';

  const cleanPayee = (expense.payee || expense.merchant || '').trim();
  const cleanName = (expense.name || '').trim();

  const isGeneric = (str: string) =>
    /^(add|log|record|save|create|enter|track|spend|spent|paid|upi|vpa|bank debit|bank credit|bank transfer|bank transaction|expense|payment)$/i.test(str);

  // 1. Merchant / payee / counterparty name if non-generic
  if (cleanPayee && !isGeneric(cleanPayee)) {
    return cleanPayee;
  }

  // 2. Existing transaction description / merchant if non-generic
  if (cleanName && !isGeneric(cleanName)) {
    return cleanName;
  }

  // 3. Fallback to payee if provided
  if (cleanPayee && !/^(add|log|record|save|create|enter|track)$/i.test(cleanPayee)) {
    return cleanPayee;
  }

  // 4. Fallback to name if provided and not an action verb
  if (cleanName && !/^(add|log|record|save|create|enter|track)$/i.test(cleanName)) {
    return cleanName;
  }

  // 5. Transaction type + payment method fallback
  if (isCreditTransaction(expense)) {
    return 'Income Credit';
  }

  if (expense.category && !isGeneric(expense.category)) {
    return expense.category;
  }

  if (expense.paymentMethod) {
    return `${expense.paymentMethod} Payment`;
  }

  return 'Bank Debit';
}

export interface AvailableTransactionMetadataItem {
  key: string;
  label: string;
  value: string;
  isSensitive?: boolean;
}

/**
 * Extracts only populated, non-empty metadata items for dynamic rendering in Transaction Detail view.
 * Omits empty fields completely so no "-" or empty labels are shown.
 */
export function getAvailableTransactionMetadata(expense: ExpenseItem): AvailableTransactionMetadataItem[] {
  const items: AvailableTransactionMetadataItem[] = [];

  const direction = getTransactionDirection(expense);
  items.push({
    key: 'direction',
    label: 'Direction',
    value: direction === 'CREDIT' ? 'Credit (Money in)' : 'Debit (Money out)',
  });

  if (expense.category) {
    items.push({ key: 'category', label: 'Category', value: expense.category });
  }

  if (expense.paymentMethod) {
    items.push({ key: 'paymentMethod', label: 'Payment Method', value: expense.paymentMethod });
  }

  const bank = expense.bankName || expense.bankOrAccount;
  if (bank) {
    items.push({ key: 'bank', label: 'Bank', value: bank });
  }

  const maskedAccount = expense.maskedAccount || (expense.accountLast4 ? `XX${expense.accountLast4}` : undefined);
  if (maskedAccount) {
    items.push({ key: 'account', label: 'Account', value: maskedAccount });
  }

  const upiRef = expense.upiReference || (expense.paymentMethod === 'UPI' ? expense.referenceId || expense.smsReferenceId : undefined);
  if (upiRef) {
    items.push({ key: 'upiReference', label: 'UPI Reference', value: upiRef });
  }

  const txnId = expense.referenceId && expense.referenceId !== upiRef ? expense.referenceId : undefined;
  if (txnId) {
    items.push({ key: 'referenceId', label: 'Transaction ID', value: txnId });
  }

  if (expense.source) {
    const sourceLabel =
      expense.source === 'sms_auto'
        ? 'SMS Auto-logged'
        : expense.source === 'excel'
        ? 'Excel Import'
        : expense.source === 'manual'
        ? 'Manual Entry'
        : expense.source;
    items.push({ key: 'source', label: 'Source', value: sourceLabel });
  }

  if (expense.notes) {
    items.push({ key: 'notes', label: 'Notes', value: expense.notes });
  }

  return items;
}

/**
 * Formats a currency amount into standard Indian Rupee notation (e.g., ₹303.00)
 */
export function formatTransactionAmount(amount: number): string {
  const safeNum = Number(amount) || 0;
  return `₹${safeNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
