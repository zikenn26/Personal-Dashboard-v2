import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { ExpenseItem } from '../../../types';
import { inferExpenseCategory, broadcastDataChanged } from '../../commandMappingService';
import { InteractiveOption } from '../../commandIntentEngine';
import { isCreditTransaction, compareExpensesByDateTimeDesc } from '../../../utils/expenseUtils';

export interface StructuredExpenseIntent {
  intent: 'CREATE_EXPENSE' | 'AMBIGUOUS' | 'NOT_EXPENSE';
  amount?: number;
  currency: string;
  category?: string;
  merchant?: string | null;
  payee?: string | null;
  title: string;
  date: string;
  rawInput: string;
  missingField?: 'amount' | 'category' | 'none';
}

/**
 * Natural language structured intent parser for expense commands.
 * Distinguishes ACTION from MERCHANT from CATEGORY from AMOUNT from DATE from ACCOUNT.
 * Action verbs (add, log, record, etc.) NEVER become the transaction title or merchant.
 */
export function parseStructuredExpenseIntent(input: string, todayStr: string): StructuredExpenseIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Strip common conversational prefixes
  let clean = trimmed
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .trim();

  const leadingFillers = [
    /^(?:hey|hi|hello|ok|okay)\s+(?:zikenn|gemini|assistant|there)?\s*/i,
    /^(?:please|can you|could you|could you please|would you|kindly|i want to|i need to|i would like to|let's|just)\s+/i,
  ];
  for (const filler of leadingFillers) {
    clean = clean.replace(filler, '').trim();
  }

  // 2. Extract action verb (add, log, record, save, create, enter, track, spend, spent, paid)
  const actionRegex = /^(add|log|record|save|create|enter|track|spend|spent|paid)\b\s*(?:a\s+)?(?:new\s+)?(?:expense|transaction|item)?\s*(?:of\s+)?/i;
  const actionMatch = clean.match(actionRegex);
  let remainder = actionMatch ? clean.slice(actionMatch[0].length).trim() : clean;

  // 3. Extract amount
  // Can be e.g. "39 rs", "₹39", "rs 39", "39 inr", "39", etc.
  const amountRegex = /(?:(?:rs\.?|rupees|inr|bucks|[₹$])\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees|inr|bucks|[₹$])?)/i;
  const amtMatch = remainder.match(amountRegex);

  if (!amtMatch) {
    // If there is an action verb like "add groceries", check if amount is missing
    if (actionMatch && remainder.length > 0 && !/\d/.test(remainder)) {
      return {
        intent: 'AMBIGUOUS',
        currency: 'INR',
        title: remainder,
        date: todayStr,
        rawInput: trimmed,
        missingField: 'amount',
      };
    }
    return null;
  }

  const rawNum = amtMatch[1] || amtMatch[2];
  if (!rawNum) return null;
  const amount = parseFloat(rawNum);
  if (isNaN(amount) || amount <= 0) return null;

  // Remove the amount and currency from remainder
  remainder = remainder.replace(amtMatch[0], ' ').trim();
  remainder = remainder.replace(/\b(?:rs\.?|rupees|inr|bucks)\b/gi, '').replace(/[₹$]/g, '').trim();
  remainder = remainder.replace(/\s+/g, ' ').trim();

  // 4. If remainder is empty after extracting amount (e.g. "add 100", "log ₹500")
  if (!remainder) {
    return {
      intent: 'AMBIGUOUS',
      amount,
      currency: 'INR',
      title: 'Expense',
      date: todayStr,
      rawInput: trimmed,
      missingField: 'category',
    };
  }

  // 5. Semantic extraction: Distinguish MERCHANT from CATEGORY/PURPOSE
  // Check for explicit merchant/payee prepositions:
  // e.g. "at Starbucks", "to Amazon", "to Rahul", "at Hotel XYZ", "in D-Mart"
  let merchant: string | null = null;
  let payee: string | null = null;

  const atMerchantMatch = remainder.match(/\b(?:at|in|from)\s+([a-zA-Z0-9\s&'.-]+)$/i);
  if (atMerchantMatch) {
    merchant = atMerchantMatch[1].trim();
    remainder = remainder.replace(atMerchantMatch[0], ' ').trim();
  }

  const toPayeeMatch = remainder.match(/\bto\s+([a-zA-Z0-9\s&'.-]+)$/i);
  if (toPayeeMatch) {
    merchant = toPayeeMatch[1].trim();
    payee = toPayeeMatch[1].trim();
    remainder = remainder.replace(toPayeeMatch[0], ' ').trim();
  }

  // Clean remainder for category/purpose
  let purpose = remainder
    .replace(/^(?:for|on|towards|called|expense|item)\s+/i, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .trim();

  // Determine Title, Category, and ensure ACTION VERB NEVER becomes the title
  const ACTION_WORDS_REGEX = /^(add|log|record|save|create|enter|track|spend|spent|paid)$/i;

  let title = 'Expense';
  let category = 'Other';

  if (merchant && !ACTION_WORDS_REGEX.test(merchant)) {
    // Merchant has highest priority for transaction title
    title = merchant.charAt(0).toUpperCase() + merchant.slice(1);
    if (purpose) {
      category = inferExpenseCategory(purpose);
    } else {
      category = inferExpenseCategory(merchant);
    }
  } else if (purpose && !ACTION_WORDS_REGEX.test(purpose)) {
    title = purpose.charAt(0).toUpperCase() + purpose.slice(1);
    category = inferExpenseCategory(purpose);
  } else {
    // Fallback if purpose was an action word
    category = 'Other';
    title = 'Expense';
  }

  return {
    intent: 'CREATE_EXPENSE',
    amount,
    currency: 'INR',
    category,
    merchant,
    payee,
    title,
    date: todayStr,
    rawInput: trimmed,
    missingField: 'none',
  };
}

export class MoneyAdapter implements ModuleAdapter {
  name = 'money';

  canHandle(input: string, context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();

    // Do not intercept task, habit, goal, journal, exam commands
    if (
      /\b(?:task|todo|to-do|habit|goal|journal|exam|syllabus)\b/i.test(text) &&
      !/\b(?:expense|spending|spend|bought|transaction|paid)\b/i.test(text)
    ) {
      return false;
    }

    // Check for follow-up change command if lastExpense exists in session memory
    if (context?.sessionMemory?.lastExpense) {
      if (/^(change\s+(it|that|amount|expense)\s+to|make\s+it|update\s+(it\s+to|to))\s*[₹$]?\s*\d+/i.test(text)) {
        return true;
      }
    }

    // Conversational follow-up: "What about last month?"
    if (
      (text.includes('last month') || text.includes('previous month')) &&
      (text.includes('what about') || text.includes('how about') || text.includes('spending') || text.includes('spend'))
    ) {
      return true;
    }

    // Spending queries and commands
    if (
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\b/i.test(text) ||
      text.includes('spend') ||
      text.includes('spending') ||
      text.includes('expense') ||
      text.includes('cost') ||
      text.includes('bought') ||
      text.includes('paid') ||
      text.includes('transaction') ||
      /^[₹$]?\s*\d+\s+(for|on|at|to)\s+/i.test(text) ||
      /^(delete|remove)\s+(my\s+)?(last\s+)?(expense|transaction)/i.test(text) ||
      /^(delete|remove)\s+the\s+[₹$]?\d+/i.test(text)
    ) {
      return true;
    }

    return false;
  }

  async handle(input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const text = input.trim();
    const lower = text.toLowerCase();
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const expenses = Storage.getExpenses();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${currentYear}-${currentMonth}`;

    // ------------------------------------------------------------------------
    // 1. STRUCTURED INTENT EXTRACTION & AMBIGUITY VALIDATION
    // ------------------------------------------------------------------------
    // Check if input is a structured expense creation command or ambiguous command
    const isPotentialAdd =
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\b/i.test(text) ||
      /^[₹$]?\s*\d+\s*(?:rs|rupees|inr|bucks)?\s+(?:for|on|at|to)\s+/i.test(text) ||
      /^[₹$]?\s*\d+(?:\.\d{1,2})?\s+[a-zA-Z]/i.test(text);

    if (isPotentialAdd) {
      const intent = parseStructuredExpenseIntent(text, todayStr);
      if (intent) {
        // Missing amount ambiguity (e.g., "Add groceries", "Log lunch")
        if (intent.intent === 'AMBIGUOUS' && intent.missingField === 'amount') {
          const item = intent.title;
          return {
            reply: `How much did you spend on **${item}**? Please specify an amount (e.g., *"Add ₹250 for ${item}"*).`,
            module: 'money',
            actionChips: [`Add ₹100 for ${item}`, `Add ₹250 for ${item}`, `Add ₹500 for ${item}`],
            updatedSessionMemory: memory,
          };
        }

        // Missing category / purpose ambiguity (e.g., "Add 100", "Add ₹500", "Log 500")
        if (intent.intent === 'AMBIGUOUS' && intent.missingField === 'category') {
          const amount = intent.amount || 0;
          return {
            reply: `What should I categorize **₹${amount}** as? (e.g., *"Add ₹${amount} for groceries"* or *"Add ₹${amount} for lunch"*).`,
            module: 'money',
            actionChips: [`₹${amount} Groceries`, `₹${amount} Dining Out`, `₹${amount} Shopping`],
            updatedSessionMemory: memory,
          };
        }

        // Valid expense creation: Use existing business logic & canonical ExpenseItem mutation
        if (intent.intent === 'CREATE_EXPENSE' && intent.amount && intent.amount > 0) {
          const newExpense: ExpenseItem = {
            id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: intent.title,
            amount: intent.amount,
            category: intent.category || 'Other',
            date: todayStr,
            billingCycle: 'one-time',
            active: true,
            direction: 'DEBIT',
            transactionType: 'DEBIT',
            merchant: intent.merchant || undefined,
            payee: intent.payee || undefined,
            source: 'manual',
          };

          const updated = [newExpense, ...expenses];
          Storage.setExpenses(updated);
          broadcastDataChanged('expenses');

          memory.lastExpense = {
            id: newExpense.id,
            name: newExpense.name,
            amount: newExpense.amount,
            category: newExpense.category,
          };
          memory.lastAction = {
            type: 'add_expense',
            entity: 'expense',
            description: `Added expense "${newExpense.name}" for ₹${newExpense.amount}`,
            timestamp: Date.now(),
          };

          return {
            reply: `Logged **₹${newExpense.amount}** for **${newExpense.name}** under **${newExpense.category}**.`,
            module: 'money',
            actionChips: [`✓ Added ₹${newExpense.amount}`, newExpense.category as string, 'Tap to edit'],
            executedActions: [
              {
                type: 'add_expense',
                targetId: newExpense.id,
                params: { name: newExpense.name, amount: newExpense.amount, category: newExpense.category },
                description: `Logged expense of ₹${newExpense.amount} for ${newExpense.name}`,
              },
            ],
            updatedSessionMemory: memory,
          };
        }
      }
    }

    // ------------------------------------------------------------------------
    // 2. MODIFICATION SAFETY: "Change my last expense to ₹700", "Change it to ₹800"
    // ------------------------------------------------------------------------
    const changeMatch = text.match(/(?:change|update|make)\s+(?:my\s+last\s+expense|the\s+last\s+expense|it|that|expense|amount)\s+(?:to\s+)?[₹$]?\s*(\d+(?:\.\d{1,2})?)/i);
    if (changeMatch || (memory.lastExpense && /^(?:change\s+(?:it|that|amount|expense)\s+to|make\s+it|update\s+(?:it\s+to|to))\s*[₹$]?\s*(\d+(?:\.\d{1,2})?)/i.test(text))) {
      const amtStr = changeMatch ? changeMatch[1] : text.match(/\d+(?:\.\d{1,2})?/)?.[0];
      if (amtStr) {
        const newAmount = parseFloat(amtStr);
        const sortedDesc = [...expenses].sort(compareExpensesByDateTimeDesc);
        const targetExpense = memory.lastExpense
          ? expenses.find((e) => e.id === memory.lastExpense?.id) || sortedDesc[0]
          : sortedDesc[0];

        if (targetExpense) {
          const oldAmount = targetExpense.amount;
          targetExpense.amount = newAmount;
          targetExpense.updatedAt = Date.now();
          Storage.setExpenses(expenses);
          broadcastDataChanged('expenses');

          memory.lastExpense = {
            id: targetExpense.id,
            name: targetExpense.name,
            amount: newAmount,
            category: targetExpense.category,
          };
          memory.lastAction = {
            type: 'update_expense',
            entity: 'expense',
            description: `Updated "${targetExpense.name}" from ₹${oldAmount} to ₹${newAmount}`,
            timestamp: Date.now(),
          };

          return {
            reply: `Updated **${targetExpense.name}** from **₹${oldAmount}** to **₹${newAmount}**.`,
            module: 'money',
            actionChips: [`✓ Updated to ₹${newAmount}`, `Expense: ${targetExpense.name}`],
            executedActions: [
              {
                type: 'update_expense',
                targetId: targetExpense.id,
                params: { amount: newAmount, previousAmount: oldAmount },
                description: `Updated expense to ₹${newAmount}`,
              },
            ],
            updatedSessionMemory: memory,
          };
        }
      }
    }

    // ------------------------------------------------------------------------
    // 3. DESTRUCTIVE DELETION CONFIRMATION: "Delete my last expense", "Delete the ₹500 grocery transaction"
    // ------------------------------------------------------------------------
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('clear')) {
      const cancelOption: InteractiveOption = {
        id: `cancel-del-${Date.now()}`,
        label: '✕ Cancel',
        variant: 'cancel',
        actions: [],
      };

      if (lower.includes('all') || lower.includes('wipe')) {
        const deleteOption: InteractiveOption = {
          id: `confirm-clear-expenses-${Date.now()}`,
          label: '🗑️ Delete All Expenses',
          variant: 'danger',
          isDestructive: true,
          confirmationPrompt: 'This will permanently remove all tracked expenses.',
          actions: [
            {
              type: 'clear_all_expenses',
              params: {},
              description: 'Clear all expenses',
              isDestructive: true,
            },
          ],
        };

        return {
          reply: `⚠️ **Warning**: You requested to delete all expenses (${expenses.length} records). This action cannot be undone. Please confirm below:`,
          module: 'money',
          actionChips: ['⚠️ Action requires confirmation'],
          options: [cancelOption, deleteOption],
          pendingConfirmation: true,
          updatedSessionMemory: memory,
        };
      }

      // Check if user specified a name or amount: e.g. "delete the ₹500 grocery transaction"
      const specificAmtMatch = text.match(/[₹$]?\s*(\d+(?:\.\d{1,2})?)/);
      const specificNameMatch = text.match(/(?:transaction|expense)\s+for\s+([a-zA-Z\s&'-]+)/i) ||
                                text.match(/(?:delete|remove)\s+(?:the\s+)?([a-zA-Z]+)(?:\s+transaction|\s+expense)?/i);

      let itemToDelete: ExpenseItem | undefined;

      if (specificAmtMatch && specificNameMatch) {
        const queryAmt = parseFloat(specificAmtMatch[1]);
        const queryName = specificNameMatch[1].toLowerCase().trim();
        const matches = expenses.filter(
          (e) =>
            Math.abs(Number(e.amount) - queryAmt) < 0.01 &&
            e.name.toLowerCase().includes(queryName)
        );
        if (matches.length > 1) {
          // Multiple matches: Show disambiguation options
          return {
            reply: `I found **${matches.length}** matching transactions for ₹${queryAmt}. Which one would you like to delete?`,
            module: 'money',
            actionChips: ['Select transaction'],
            options: [
              ...matches.slice(0, 3).map((m) => ({
                id: `del-opt-${m.id}`,
                label: `Delete "${m.name}" on ${m.date}`,
                variant: 'danger' as const,
                isDestructive: true,
                actions: [
                  {
                    type: 'delete_expense',
                    targetId: m.id,
                    params: { id: m.id },
                    description: `Delete expense "${m.name}"`,
                    isDestructive: true,
                  },
                ],
              })),
              cancelOption,
            ],
            pendingConfirmation: true,
            updatedSessionMemory: memory,
          };
        }
        itemToDelete = matches[0];
      }

      if (!itemToDelete) {
        // Sort strictly by actual transaction date/time descending so last expense matches Spending Hub ordering
        const sortedDesc = [...expenses].sort(compareExpensesByDateTimeDesc);
        itemToDelete = memory.lastExpense
          ? sortedDesc.find((e) => e.id === memory.lastExpense?.id) || sortedDesc[0]
          : sortedDesc[0];
      }

      if (itemToDelete) {
        const deleteSingleOption: InteractiveOption = {
          id: `confirm-del-${itemToDelete.id}`,
          label: `🗑️ Delete "${itemToDelete.name}" (₹${itemToDelete.amount})`,
          variant: 'danger',
          isDestructive: true,
          actions: [
            {
              type: 'delete_expense',
              targetId: itemToDelete.id,
              params: { id: itemToDelete.id },
              description: `Delete expense "${itemToDelete.name}"`,
              isDestructive: true,
            },
          ],
        };

        return {
          reply: `Delete this transaction?\n\n• **${itemToDelete.name}**\n• **₹${itemToDelete.amount}** (${itemToDelete.category || 'General'})\n• Date: ${itemToDelete.date}`,
          module: 'money',
          actionChips: ['Confirmation required'],
          options: [cancelOption, deleteSingleOption],
          pendingConfirmation: true,
          updatedSessionMemory: memory,
        };
      }
    }

    // ------------------------------------------------------------------------
    // 4. READ-ONLY QUERY: Today's Spending (Excludes credits so credits don't inflate spending)
    // ------------------------------------------------------------------------
    if (
      lower.includes('today') &&
      (lower.includes('spend') || lower.includes('expense') || lower.includes('how much') || lower.includes('what did'))
    ) {
      const todayDebits = expenses.filter((e) => e.date === todayStr && !isCreditTransaction(e));
      const total = todayDebits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      let reply = `You've spent **₹${total.toLocaleString('en-IN')}** today`;
      if (todayDebits.length === 0) {
        reply += ` across 0 expenses. Great job keeping spending down!`;
      } else {
        reply += ` across ${todayDebits.length} transaction${todayDebits.length === 1 ? '' : 's'}:\n` +
          todayDebits.slice(0, 4).map((e) => `• **${e.name}**: ₹${e.amount} (${e.category || 'General'})`).join('\n');
        if (todayDebits.length > 4) {
          reply += `\n• ...and ${todayDebits.length - 4} more.`;
        }
      }

      return {
        reply,
        module: 'money',
        actionChips: [`Today: ₹${total}`, `${todayDebits.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 5. READ-ONLY QUERY: Yesterday's Spending
    // ------------------------------------------------------------------------
    if (lower.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const yesterdayDebits = expenses.filter((e) => e.date === yesterdayStr && !isCreditTransaction(e));
      const total = yesterdayDebits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      return {
        reply: `You spent **₹${total.toLocaleString('en-IN')}** yesterday across ${yesterdayDebits.length} transaction${yesterdayDebits.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Yesterday: ₹${total}`, `${yesterdayDebits.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 6. READ-ONLY QUERY: This Week's Spending
    // ------------------------------------------------------------------------
    if (lower.includes('week') || lower === 'weekly spending') {
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const weekDebits = expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= monday && !isCreditTransaction(e);
      });

      const total = weekDebits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      return {
        reply: `Your total spending this week is **₹${total.toLocaleString('en-IN')}** across ${weekDebits.length} transaction${weekDebits.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Week: ₹${total}`, `${weekDebits.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 7. READ-ONLY QUERY: Last Month / Previous Month Spending
    // ------------------------------------------------------------------------
    if (lower.includes('last month') || lower.includes('previous month')) {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const prevYearMonth = `${prevYear}-${prevMonthStr}`;
      const monthName = prevMonthDate.toLocaleString('default', { month: 'long' });

      const prevMonthDebits = expenses.filter((e) => e.date.startsWith(prevYearMonth) && !isCreditTransaction(e));
      const total = prevMonthDebits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      return {
        reply: `Last month (${monthName} ${prevYear}), you spent a total of **₹${total.toLocaleString('en-IN')}** across ${prevMonthDebits.length} transaction${prevMonthDebits.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Last Month: ₹${total}`, `${prevMonthDebits.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 8. READ-ONLY QUERY: This Month's / Monthly Spending
    // ------------------------------------------------------------------------
    if (
      lower.includes('month') ||
      lower.includes('monthly spending') ||
      lower.includes('how much have i spent this month')
    ) {
      const monthName = now.toLocaleString('default', { month: 'long' });
      const monthDebits = expenses.filter((e) => e.date.startsWith(currentYearMonth) && !isCreditTransaction(e));
      const total = monthDebits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      return {
        reply: `Your total spending this month (${monthName} ${currentYear}) is **₹${total.toLocaleString('en-IN')}** across ${monthDebits.length} transaction${monthDebits.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`This Month: ₹${total}`, `${monthDebits.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 9. READ-ONLY QUERY: Category Spending (e.g., "Show food expenses", "How much spent on groceries?")
    // ------------------------------------------------------------------------
    const isExplicitAdd =
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\b/i.test(lower) ||
      /^[₹$]?\s*\d+\s+(for|on)\s+/i.test(text) ||
      /^(add|log|record)?\s*[₹$]?\s*\d+\s+[a-zA-Z]/i.test(text);

    if (!isExplicitAdd) {
      const categoryKeywords = [
        { key: 'food', labels: ['Groceries & Food', 'Dining Out', 'Snacks & Coffee'] },
        { key: 'grocer', labels: ['Groceries & Food'] },
        { key: 'dining', labels: ['Dining Out'] },
        { key: 'coffee', labels: ['Snacks & Coffee'] },
        { key: 'shopping', labels: ['Shopping & Retail'] },
        { key: 'transit', labels: ['Taxi & Transit'] },
        { key: 'travel', labels: ['Taxi & Transit'] },
        { key: 'bills', labels: ['Utilities & Bills'] },
      ];

      for (const cat of categoryKeywords) {
        if (lower.includes(cat.key)) {
          const catDebits = expenses.filter(
            (e) =>
              !isCreditTransaction(e) &&
              (cat.labels.some((l) => (e.category || '').toLowerCase() === l.toLowerCase()) ||
                e.name.toLowerCase().includes(cat.key))
          );
          const total = catDebits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

          return {
            reply: `You've spent **₹${total.toLocaleString('en-IN')}** on **${cat.labels[0]}** across ${catDebits.length} transaction${catDebits.length === 1 ? '' : 's'}.`,
            module: 'money',
            actionChips: [`${cat.labels[0]}: ₹${total}`, `${catDebits.length} records`],
            updatedSessionMemory: memory,
          };
        }
      }
    }

    // ------------------------------------------------------------------------
    // 10. READ-ONLY QUERY: Recent Transactions
    // ------------------------------------------------------------------------
    if (
      lower.includes('recent') ||
      lower.includes('transactions') ||
      lower.includes('show expenses') ||
      lower.includes('list expenses')
    ) {
      // Sort strictly by actual transaction date/time descending
      const recent = [...expenses].sort(compareExpensesByDateTimeDesc).slice(0, 5);
      if (recent.length === 0) {
        return {
          reply: `No expenses logged yet. You can say **"Add ₹250 for coffee"** to start logging!`,
          module: 'money',
          actionChips: ['No transactions found'],
          updatedSessionMemory: memory,
        };
      }

      const listStr = recent
        .map((e) => {
          const dirIndicator = isCreditTransaction(e) ? '🟢 Credit' : '🔴 Debit';
          return `• **${e.name}**: ₹${e.amount} (${dirIndicator}, ${e.category || 'General'}) on ${e.date}`;
        })
        .join('\n');

      return {
        reply: `Here are your recent transactions:\n${listStr}`,
        module: 'money',
        actionChips: [`${recent.length} recent shown`, 'Money Module'],
        updatedSessionMemory: memory,
      };
    }

    return null;
  }
}
