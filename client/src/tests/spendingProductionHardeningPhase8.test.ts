import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseExpenseCommand,
  buildExpenseItemFromIntent,
  isActionVerb,
} from '../services/ai/expenseParser';
import { MoneyAdapter } from '../services/ai/adapters/moneyAdapter';
import { ExpenseItem } from '../types';
import {
  isCreditTransaction,
  isDebitTransaction,
  getTransactionDirection,
  formatTransactionAmount,
  getTransactionDisplayTitle,
  maskFinancialIdentifier,
} from '../utils/expenseUtils';
import { smsExpenseService } from '../services/smsExpenseService';
import { parseSmsTransaction } from '../services/smsParser';

describe('PHASE 8 — SPENDING / TRANSACTION SYSTEM PRODUCTION HARDENING', () => {
  describe('PART 1 — AI Expense Command Parsing & Action Verb Disambiguation', () => {
    it('recognizes action verbs correctly and never treats them as merchant or title', () => {
      expect(isActionVerb('add')).toBe(true);
      expect(isActionVerb('log')).toBe(true);
      expect(isActionVerb('record')).toBe(true);
      expect(isActionVerb('save')).toBe(true);
      expect(isActionVerb('create')).toBe(true);
      expect(isActionVerb('enter')).toBe(true);
      expect(isActionVerb('track')).toBe(true);
      expect(isActionVerb('spend')).toBe(true);
      expect(isActionVerb('spent')).toBe(true);
      expect(isActionVerb('paid')).toBe(true);

      expect(isActionVerb('breakfast')).toBe(false);
      expect(isActionVerb('amazon')).toBe(false);
      expect(isActionVerb('starbucks')).toBe(false);
      expect(isActionVerb('rahul')).toBe(false);
    });

    it('test case: "add 39 rs breakfast" -> amount=39, category=Breakfast, merchant != "add"', () => {
      const intent = parseExpenseCommand('add 39 rs breakfast');
      expect(intent.isValid).toBe(true);
      expect(intent.amount).toBe(39);
      expect(intent.category).toBe('Breakfast');
      expect(intent.merchant).not.toBe('add');
      expect(intent.merchant).not.toBe('Add');

      const expense = buildExpenseItemFromIntent(intent);
      expect(expense.amount).toBe(39);
      expect(expense.category).toBe('Breakfast');
      expect(expense.name).not.toBe('add');
      expect(expense.name).not.toBe('Add');
      expect(expense.name).toBe('Breakfast');
    });

    it('test case: "log ₹250 lunch" -> amount=250, category=Lunch', () => {
      const intent = parseExpenseCommand('log ₹250 lunch');
      expect(intent.isValid).toBe(true);
      expect(intent.amount).toBe(250);
      expect(intent.category).toBe('Lunch');
      expect(intent.merchant).not.toBe('log');

      const expense = buildExpenseItemFromIntent(intent);
      expect(expense.amount).toBe(250);
      expect(expense.category).toBe('Lunch');
      expect(expense.name).toBe('Lunch');
    });

    it('test case: "record 500 for groceries" -> amount=500, category=Groceries', () => {
      const intent = parseExpenseCommand('record 500 for groceries');
      expect(intent.isValid).toBe(true);
      expect(intent.amount).toBe(500);
      expect(intent.category).toBe('Groceries');
      expect(intent.merchant).not.toBe('record');

      const expense = buildExpenseItemFromIntent(intent);
      expect(expense.amount).toBe(500);
      expect(expense.category).toBe('Groceries');
      expect(expense.name).toBe('Groceries');
    });

    it('test case: "add ₹700 at Amazon" -> amount=700, merchant=Amazon', () => {
      const intent = parseExpenseCommand('add ₹700 at Amazon');
      expect(intent.isValid).toBe(true);
      expect(intent.amount).toBe(700);
      expect(intent.merchant).toBe('Amazon');
      expect(intent.merchant).not.toBe('add');

      const expense = buildExpenseItemFromIntent(intent);
      expect(expense.amount).toBe(700);
      expect(expense.name).toBe('Amazon');
    });

    it('test case: "add ₹300 for breakfast at Starbucks" -> amount=300, category=Breakfast, merchant=Starbucks', () => {
      const intent = parseExpenseCommand('add ₹300 for breakfast at Starbucks');
      expect(intent.isValid).toBe(true);
      expect(intent.amount).toBe(300);
      expect(intent.category).toBe('Breakfast');
      expect(intent.merchant).toBe('Starbucks');
      expect(intent.merchant).not.toBe('add');

      const expense = buildExpenseItemFromIntent(intent);
      expect(expense.amount).toBe(300);
      expect(expense.category).toBe('Breakfast');
      expect(expense.merchant).toBe('Starbucks');
      expect(expense.name).toBe('Starbucks');
    });

    it('test case: "add 100" -> asks for missing clarification / category', () => {
      const intent = parseExpenseCommand('add 100');
      expect(intent.isValid).toBe(false);
      expect(intent.needsClarification).toBe(true);
      expect(intent.clarificationPrompt).toContain('₹100');
    });

    it('test case: "add 500 to Rahul" -> merchant/payee=Rahul, NOT category=Rahul', () => {
      const intent = parseExpenseCommand('add 500 to Rahul');
      expect(intent.isValid).toBe(true);
      expect(intent.amount).toBe(500);
      expect(intent.merchant).toBe('Rahul');
      expect(intent.payee).toBe('Rahul');
      expect(intent.category).not.toBe('Rahul');

      const expense = buildExpenseItemFromIntent(intent);
      expect(expense.amount).toBe(500);
      expect(expense.name).toBe('Rahul');
      expect(expense.payee).toBe('Rahul');
      expect(expense.category).not.toBe('Rahul');
    });

    it('MoneyAdapter executes "add 39 rs breakfast" and returns success without setting title to "add"', async () => {
      const adapter = new MoneyAdapter();
      const res = await adapter.handle('add 39 rs breakfast');

      expect(res).not.toBeNull();
      expect(res?.reply).toContain('39');
      expect(res?.reply).toContain('Breakfast');
      expect(res?.reply).not.toContain('**add**');
      expect(res?.reply).not.toContain('**Add**');

      const action = res?.executedActions?.[0];
      expect(action).toBeDefined();
      expect(action?.params.name).toBe('Breakfast');
      expect(action?.params.category).toBe('Breakfast');
      expect(action?.params.amount).toBe(39);
    });

    it('MoneyAdapter prompts for clarification on ambiguous "add 500" instead of blindly creating an expense titled "add"', async () => {
      const adapter = new MoneyAdapter();
      const res = await adapter.handle('add 500');

      expect(res).not.toBeNull();
      expect(res?.executedActions).toBeUndefined();
      expect(res?.reply).toContain('What should I categorize');
      expect(res?.reply).toContain('500');
    });
  });

  describe('PART 2 — Preserve SMS Transaction Metadata in Canonical ExpenseItem', () => {
    it('parses SMS with UPI reference, bank, and masked account, preserving into ExpenseItem', () => {
      const smsBody =
        'Dear Customer, your Acct ending 1234 has been debited by INR 303.00 on 25-Sep-26 to Arpita Priyadar. UPI:663416590461. Avail Bal: Rs 44,566.40.';
      const parsed = parseSmsTransaction(smsBody, 'AD-ICICIB', '2026-09-25T10:42:00Z');

      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(303);
      expect(parsed?.merchant).toBe('Arpita Priyadar');
      expect(parsed?.paymentMethod).toBe('UPI');
      expect(parsed?.referenceId).toBe('663416590461');
      expect(parsed?.accountLast4).toBe('1234');
      expect(parsed?.bankName).toContain('ICICI');

      // Now create ExpenseItem as SmsExpenseService does
      const item: ExpenseItem = {
        id: 'exp-sms-test-1',
        name: parsed!.merchant,
        amount: parsed!.amount,
        category: 'Other',
        date: parsed!.date,
        time: parsed!.time,
        merchant: parsed!.merchant,
        payee: parsed!.payee || parsed!.merchant,
        billingCycle: 'one-time',
        active: true,
        source: 'sms_auto',
        bankName: parsed!.bankName,
        bankOrAccount: `${parsed!.bankName} (Acct XX${parsed!.accountLast4})`,
        maskedAccount: `XX${parsed!.accountLast4}`,
        accountLast4: parsed!.accountLast4,
        paymentMethod: parsed!.paymentMethod,
        referenceId: parsed!.referenceId,
        upiReference: parsed!.referenceId,
        direction: parsed!.transactionType === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        transactionType: parsed!.transactionType === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        rawSms: smsBody,
        sender: 'AD-ICICIB',
      };

      // Verify all required fields survive in the canonical ExpenseItem
      expect(item.bankName).toContain('ICICI');
      expect(item.maskedAccount).toBe('XX1234');
      expect(item.upiReference).toBe('663416590461');
      expect(item.referenceId).toBe('663416590461');
      expect(item.direction).toBe('DEBIT');
      expect(item.source).toBe('sms_auto');
      expect(item.rawSms).toBe(smsBody);
    });

    it('ensures sensitive financial identifiers are masked and never exposed', () => {
      expect(maskFinancialIdentifier('123456789012')).toBe('XX9012');
      expect(maskFinancialIdentifier('9876')).toBe('XX9876');
      expect(maskFinancialIdentifier('XX070')).toBe('XX070');
      expect(maskFinancialIdentifier('•••• 070')).toBe('•••• 070');
    });
  });

  describe('PART 4 — Debit and Credit Directional Semantics', () => {
    it('correctly classifies DEBIT vs CREDIT items', () => {
      const debitExpense: ExpenseItem = {
        id: '1',
        name: 'Arpita Priyadar',
        amount: 303,
        category: 'Other',
        date: '2026-09-25',
        billingCycle: 'one-time',
        active: true,
        direction: 'DEBIT',
        transactionType: 'DEBIT',
      };

      const creditExpense: ExpenseItem = {
        id: '2',
        name: 'Refund from Amazon',
        amount: 499,
        category: 'Shopping',
        date: '2026-09-25',
        billingCycle: 'one-time',
        active: true,
        direction: 'CREDIT',
        transactionType: 'CREDIT',
      };

      expect(isDebitTransaction(debitExpense)).toBe(true);
      expect(isCreditTransaction(debitExpense)).toBe(false);
      expect(getTransactionDirection(debitExpense)).toBe('DEBIT');

      expect(isDebitTransaction(creditExpense)).toBe(false);
      expect(isCreditTransaction(creditExpense)).toBe(true);
      expect(getTransactionDirection(creditExpense)).toBe('CREDIT');
    });

    it('formatTransactionAmount accurately formats both debit and credit amounts', () => {
      expect(formatTransactionAmount(303)).toBe('₹303.00');
      expect(formatTransactionAmount(499.5)).toBe('₹499.50');
      expect(formatTransactionAmount(12500)).toBe('₹12,500.00');
    });

    it('getTransactionDisplayTitle uses payee/merchant over generic titles', () => {
      const exp: ExpenseItem = {
        id: '1',
        name: 'Swiggy',
        merchant: 'Swiggy',
        amount: 450,
        category: 'Dining Out',
        date: '2026-09-25',
        billingCycle: 'one-time',
        active: true,
      };

      expect(getTransactionDisplayTitle(exp)).toBe('Swiggy');
    });
  });
});
