/**
 * Expense Validator
 * Validates expense data to ensure consistency and prevent corrupt data from syncing
 */

import { ExpenseItem } from '../types';
import { logger } from './logger';

const TAG = 'EXPENSE_VALIDATOR';

/**
 * Validate a single expense item
 */
export function validateExpenseItem(expense: any): expense is ExpenseItem {
  // Must be an object
  if (!expense || typeof expense !== 'object') {
    return false;
  }

  // Required: ID
  if (!expense.id || typeof expense.id !== 'string' || expense.id.trim() === '') {
    logger.warn(TAG, 'Invalid expense: missing or empty id');
    return false;
  }

  // Required: Name/Description
  if (!expense.name || typeof expense.name !== 'string' || expense.name.trim() === '') {
    logger.warn(TAG, `Invalid expense ${expense.id}: missing or empty name`);
    return false;
  }

  // Required: Amount (non-negative number)
  if (typeof expense.amount !== 'number' || expense.amount < 0 || !isFinite(expense.amount)) {
    logger.warn(TAG, `Invalid expense ${expense.id}: invalid amount`);
    return false;
  }

  // Required: Date (valid date string or timestamp)
  if (!expense.date) {
    logger.warn(TAG, `Invalid expense ${expense.id}: missing date`);
    return false;
  }

  if (typeof expense.date === 'string') {
    // Check if it's a valid date string (YYYY-MM-DD or ISO)
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
    if (!dateRegex.test(expense.date)) {
      logger.warn(TAG, `Invalid expense ${expense.id}: invalid date format`);
      return false;
    }

    // Try to parse as date
    const parsedDate = new Date(expense.date);
    if (isNaN(parsedDate.getTime())) {
      logger.warn(TAG, `Invalid expense ${expense.id}: unparseable date`);
      return false;
    }
  } else if (typeof expense.date !== 'number') {
    logger.warn(TAG, `Invalid expense ${expense.id}: date must be string or number`);
    return false;
  }

  // Optional: Category (if present, must be string)
  if (expense.category !== undefined && expense.category !== null) {
    if (typeof expense.category !== 'string') {
      logger.warn(TAG, `Invalid expense ${expense.id}: category must be string`);
      return false;
    }
  }

  // Optional: Payment Method (if present, must be string)
  if (expense.paymentMethod !== undefined && expense.paymentMethod !== null) {
    if (typeof expense.paymentMethod !== 'string') {
      logger.warn(TAG, `Invalid expense ${expense.id}: paymentMethod must be string`);
      return false;
    }
  }

  // Optional: Notes (if present, must be string)
  if (expense.notes !== undefined && expense.notes !== null) {
    if (typeof expense.notes !== 'string') {
      logger.warn(TAG, `Invalid expense ${expense.id}: notes must be string`);
      return false;
    }
  }

  // Optional: Direction (if present, must be DEBIT or CREDIT)
  if (expense.direction !== undefined && expense.direction !== null) {
    if (expense.direction !== 'DEBIT' && expense.direction !== 'CREDIT') {
      logger.warn(TAG, `Invalid expense ${expense.id}: invalid direction`);
      return false;
    }
  }

  // Optional: Transaction Type (if present, must be valid value)
  if (expense.transactionType !== undefined && expense.transactionType !== null) {
    const validTypes = ['expense', 'income', 'DEBIT', 'CREDIT'];
    if (!validTypes.includes(expense.transactionType)) {
      logger.warn(TAG, `Invalid expense ${expense.id}: invalid transactionType`);
      return false;
    }
  }

  // Optional: Source (if present, must be string)
  if (expense.source !== undefined && expense.source !== null) {
    if (typeof expense.source !== 'string') {
      logger.warn(TAG, `Invalid expense ${expense.id}: source must be string`);
      return false;
    }
  }

  return true;
}

/**
 * Validate batch of expenses and filter out invalid ones
 */
export function validateExpenseBatch(
  expenses: any[]
): { valid: ExpenseItem[]; invalid: any[]; count: { valid: number; invalid: number } } {
  if (!Array.isArray(expenses)) {
    logger.warn(TAG, 'validateExpenseBatch: input is not an array');
    return { valid: [], invalid: [], count: { valid: 0, invalid: 0 } };
  }

  const valid: ExpenseItem[] = [];
  const invalid: any[] = [];

  expenses.forEach((expense, index) => {
    if (validateExpenseItem(expense)) {
      valid.push(expense);
    } else {
      invalid.push({ index, data: expense });
    }
  });

  if (invalid.length > 0) {
    logger.warn(TAG, `Batch validation: ${invalid.length}/${expenses.length} invalid expenses`);
  }

  return {
    valid,
    invalid,
    count: { valid: valid.length, invalid: invalid.length },
  };
}

/**
 * Sanitize expense data (remove extra fields, trim strings)
 */
export function sanitizeExpense(expense: any): ExpenseItem | null {
  if (!validateExpenseItem(expense)) {
    return null;
  }

  return {
    id: expense.id.trim(),
    name: expense.name.trim(),
    amount: Number(expense.amount),
    category: expense.category?.trim() || undefined,
    date: expense.date,
    paymentMethod: expense.paymentMethod?.trim() || undefined,
    icon: expense.icon || undefined,
    notes: expense.notes?.trim() || undefined,
    billingCycle: expense.billingCycle || undefined,
    active: expense.active !== false,
    sourceFile: expense.sourceFile || undefined,
    importBatchId: expense.importBatchId || undefined,
    time: expense.time || undefined,
    direction: expense.direction || undefined,
    transactionType: expense.transactionType || undefined,
    source: expense.source || undefined,
    smsReferenceId: expense.smsReferenceId || undefined,
    referenceId: expense.referenceId || undefined,
    upiReference: expense.upiReference || undefined,
    rawSmsText: expense.rawSmsText || undefined,
    bankOrAccount: expense.bankOrAccount?.trim() || undefined,
    bankName: expense.bankName?.trim() || undefined,
    maskedAccount: expense.maskedAccount?.trim() || undefined,
    accountLast4: expense.accountLast4?.trim() || undefined,
    payee: expense.payee?.trim() || undefined,
    merchant: expense.merchant?.trim() || undefined,
    createdAt: expense.createdAt || undefined,
    updatedAt: expense.updatedAt || undefined,
  };
}

/**
 * Validate expense for offline mode
 * (Simpler validation for offline consistency check)
 */
export function isValidForOfflineSync(expense: any): boolean {
  return (
    expense &&
    typeof expense === 'object' &&
    typeof expense.id === 'string' &&
    expense.id.trim() !== '' &&
    typeof expense.name === 'string' &&
    expense.name.trim() !== '' &&
    typeof expense.amount === 'number' &&
    expense.amount >= 0 &&
    expense.date
  );
}

/**
 * Get detailed validation error message
 */
export function getValidationError(expense: any): string {
  if (!expense || typeof expense !== 'object') {
    return 'Expense must be an object';
  }

  if (!expense.id || typeof expense.id !== 'string' || expense.id.trim() === '') {
    return 'Expense must have a valid ID';
  }

  if (!expense.name || typeof expense.name !== 'string' || expense.name.trim() === '') {
    return 'Expense must have a name/description';
  }

  if (typeof expense.amount !== 'number' || expense.amount < 0) {
    return 'Expense must have a valid amount (non-negative number)';
  }

  if (!expense.date) {
    return 'Expense must have a date';
  }

  if (typeof expense.date === 'string') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
    if (!dateRegex.test(expense.date)) {
      return 'Expense date must be in YYYY-MM-DD format or ISO format';
    }

    const parsedDate = new Date(expense.date);
    if (isNaN(parsedDate.getTime())) {
      return 'Expense date is not a valid date';
    }
  }

  return 'Expense data is invalid';
}
