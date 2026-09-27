import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { ExpenseItem } from '../../../types';
import { inferExpenseCategory, broadcastDataChanged } from '../../commandMappingService';
import { InteractiveOption } from '../../commandIntentEngine';
import { parseExpenseCommand, buildExpenseItemFromIntent } from '../expenseParser';
import { calculateTotalSpent, isDebitTransaction } from '../../../utils/expenseUtils';

export class MoneyAdapter implements ModuleAdapter {
  name = 'money';

  canHandle(input: string, context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();

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
      text.includes('spend') ||
      text.includes('spending') ||
      text.includes('expense') ||
      text.includes('cost') ||
      text.includes('bought') ||
      text.includes('paid') ||
      text.includes('transaction') ||
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\s+[₹$]?\s*\d+/i.test(text) ||
      /^[₹$]?\s*\d+\s+(for|on|at|to)\s+/i.test(text) ||
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\s+(groceries|food|lunch|dinner|breakfast|coffee|snacks|tea|milk|recharge|metro|cab|uber|ola)/i.test(text) ||
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\s*[₹$]?\s*\d+$/i.test(text) ||
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
    // 1. AMBIGUITY HANDLING: Missing Amount
    // e.g., "Add groceries", "Log lunch", "Spent on coffee"
    // ------------------------------------------------------------------------
    const missingAmountMatch = text.match(/^(?:add|log|record|spent\s+on)\s+(?!.*[0-9])([a-zA-Z\s&'-]+)$/i);
    if (missingAmountMatch && !lower.includes('today') && !lower.includes('month') && !lower.includes('week') && !lower.includes('task')) {
      const item = missingAmountMatch[1].trim();
      return {
        reply: `How much did you spend on **${item}**? Please specify an amount (e.g., *"Add ₹250 for ${item}"*).`,
        module: 'money',
        actionChips: [`Add ₹100 for ${item}`, `Add ₹250 for ${item}`, `Add ₹500 for ${item}`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 2. AMBIGUITY HANDLING: Missing Purpose / Category
    // e.g., "Add 500", "Add ₹500", "Spent ₹500", "Log 500"
    // ------------------------------------------------------------------------
    const missingPurposeMatch = text.match(/^(?:add|log|record|spent)?\s*[₹$]?\s*(\d+(?:\.\d{1,2})?)$/i);
    if (missingPurposeMatch) {
      const amount = parseFloat(missingPurposeMatch[1]);
      return {
        reply: `What should I categorize **₹${amount}** as? (e.g., *"Add ₹${amount} for groceries"* or *"Add ₹${amount} for lunch"*).`,
        module: 'money',
        actionChips: [`₹${amount} Groceries`, `₹${amount} Dining Out`, `₹${amount} Shopping`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 3. MODIFICATION SAFETY: "Change my last expense to ₹700", "Change it to ₹800"
    // ------------------------------------------------------------------------
    const changeMatch = text.match(/(?:change|update|make)\s+(?:my\s+last\s+expense|the\s+last\s+expense|it|that|expense|amount)\s+(?:to\s+)?[₹$]?\s*(\d+(?:\.\d{1,2})?)/i);
    if (changeMatch || (memory.lastExpense && /^(?:change\s+(?:it|that|amount|expense)\s+to|make\s+it|update\s+(?:it\s+to|to))\s*[₹$]?\s*(\d+(?:\.\d{1,2})?)/i.test(text))) {
      const amtStr = changeMatch ? changeMatch[1] : text.match(/\d+(?:\.\d{1,2})?/)?.[0];
      if (amtStr) {
        const newAmount = parseFloat(amtStr);
        const targetExpense = memory.lastExpense
          ? expenses.find((e) => e.id === memory.lastExpense?.id) || expenses[0]
          : expenses[0];

        if (targetExpense) {
          const oldAmount = targetExpense.amount;
          targetExpense.amount = newAmount;
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
    // 4. DESTRUCTIVE DELETION CONFIRMATION: "Delete my last expense", "Delete the ₹500 grocery transaction"
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
        itemToDelete = memory.lastExpense
          ? expenses.find((e) => e.id === memory.lastExpense?.id) || expenses[0]
          : expenses[0];
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
    // 5. READ-ONLY QUERY: Today's Spending
    // ------------------------------------------------------------------------
    if (
      lower.includes('today') &&
      (lower.includes('spend') || lower.includes('expense') || lower.includes('how much') || lower.includes('what did'))
    ) {
      const todayExpenses = expenses.filter((e) => e.date === todayStr);
      const total = calculateTotalSpent(todayExpenses);

      let reply = `You've spent **₹${total.toLocaleString('en-IN')}** today`;
      if (todayExpenses.length === 0) {
        reply += ` across 0 expenses. Great job keeping spending down!`;
      } else {
        reply += ` across ${todayExpenses.length} transaction${todayExpenses.length === 1 ? '' : 's'}:\n` +
          todayExpenses.slice(0, 4).map((e) => `• **${e.name}**: ₹${e.amount} (${e.category || 'General'})`).join('\n');
        if (todayExpenses.length > 4) {
          reply += `\n• ...and ${todayExpenses.length - 4} more.`;
        }
      }

      return {
        reply,
        module: 'money',
        actionChips: [`Today: ₹${total}`, `${todayExpenses.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 6. READ-ONLY QUERY: Yesterday's Spending
    // ------------------------------------------------------------------------
    if (lower.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const yesterdayExpenses = expenses.filter((e) => e.date === yesterdayStr);
      const total = calculateTotalSpent(yesterdayExpenses);

      return {
        reply: `You spent **₹${total.toLocaleString('en-IN')}** yesterday across ${yesterdayExpenses.length} transaction${yesterdayExpenses.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Yesterday: ₹${total}`, `${yesterdayExpenses.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 7. READ-ONLY QUERY: This Week's Spending
    // ------------------------------------------------------------------------
    if (lower.includes('week') || lower === 'weekly spending') {
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const weekExpenses = expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= monday;
      });

      const total = calculateTotalSpent(weekExpenses);

      return {
        reply: `Your total spending this week is **₹${total.toLocaleString('en-IN')}** across ${weekExpenses.length} transaction${weekExpenses.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Week: ₹${total}`, `${weekExpenses.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 8. READ-ONLY QUERY: Last Month / Previous Month Spending
    // ------------------------------------------------------------------------
    if (lower.includes('last month') || lower.includes('previous month')) {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const prevYearMonth = `${prevYear}-${prevMonthStr}`;
      const monthName = prevMonthDate.toLocaleString('default', { month: 'long' });

      const prevMonthExpenses = expenses.filter((e) => e.date.startsWith(prevYearMonth));
      const total = calculateTotalSpent(prevMonthExpenses);

      return {
        reply: `Last month (${monthName} ${prevYear}), you spent a total of **₹${total.toLocaleString('en-IN')}** across ${prevMonthExpenses.length} transaction${prevMonthExpenses.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Last Month: ₹${total}`, `${prevMonthExpenses.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 9. READ-ONLY QUERY: This Month's / Monthly Spending
    // ------------------------------------------------------------------------
    if (
      lower.includes('month') ||
      lower.includes('monthly spending') ||
      lower.includes('how much have i spent this month')
    ) {
      const monthName = now.toLocaleString('default', { month: 'long' });
      const monthExpenses = expenses.filter((e) => e.date.startsWith(currentYearMonth));
      const total = calculateTotalSpent(monthExpenses);

      return {
        reply: `Your total spending this month (${monthName} ${currentYear}) is **₹${total.toLocaleString('en-IN')}** across ${monthExpenses.length} transaction${monthExpenses.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`This Month: ₹${total}`, `${monthExpenses.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 10. READ-ONLY QUERY: Category Spending (e.g., "Show food expenses", "How much spent on groceries?")
    // ------------------------------------------------------------------------
    const isExplicitAdd =
      /^(add|log|record|save|create|enter|track|spend|spent|paid)\b/i.test(lower) ||
      /^[₹$]?\s*\d+\s+(for|on|at|to)\s+/i.test(text) ||
      /^(add|log|record|save|create|enter|track|spend|spent|paid)?\s*[₹$]?\s*\d+\s+[a-zA-Z]/i.test(text);

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
          const catExpenses = expenses.filter(
            (e) =>
              isDebitTransaction(e) &&
              (cat.labels.some((l) => (e.category || '').toLowerCase() === l.toLowerCase()) ||
                e.name.toLowerCase().includes(cat.key))
          );
          const total = calculateTotalSpent(catExpenses);

          return {
            reply: `You've spent **₹${total.toLocaleString('en-IN')}** on **${cat.labels[0]}** across ${catExpenses.length} transaction${catExpenses.length === 1 ? '' : 's'}.`,
            module: 'money',
            actionChips: [`${cat.labels[0]}: ₹${total}`, `${catExpenses.length} records`],
            updatedSessionMemory: memory,
          };
        }
      }
    }

    // ------------------------------------------------------------------------
    // 11. READ-ONLY QUERY: Recent Transactions
    // ------------------------------------------------------------------------
    if (
      lower.includes('recent') ||
      lower.includes('transactions') ||
      lower.includes('show expenses') ||
      lower.includes('list expenses')
    ) {
      const recent = [...expenses].reverse().slice(0, 5);
      if (recent.length === 0) {
        return {
          reply: `No expenses logged yet. You can say **"Add ₹250 for coffee"** to start logging!`,
          module: 'money',
          actionChips: ['No transactions found'],
          updatedSessionMemory: memory,
        };
      }

      const listStr = recent
        .map((e) => `• **${e.name}**: ₹${e.amount} on ${e.date} (${e.category || 'General'})`)
        .join('\n');

      return {
        reply: `Here are your recent transactions:\n${listStr}`,
        module: 'money',
        actionChips: [`${recent.length} recent shown`, 'Money Module'],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 12. WRITE: Add Expense (Structured Intent Pipeline)
    // "add 39 rs breakfast", "log ₹250 lunch", "record 500 for groceries",
    // "add ₹700 at Amazon", "add 700 to Amazon", "add ₹300 for breakfast at Starbucks"
    // ------------------------------------------------------------------------
    const parsedIntent = parseExpenseCommand(text);

    // If clarification needed (e.g. "Add 100", "Add ₹500."):
    if (parsedIntent.needsClarification && parsedIntent.clarificationPrompt) {
      const amt = parsedIntent.amount || 100;
      return {
        reply: parsedIntent.clarificationPrompt,
        module: 'money',
        actionChips: [`₹${amt} Groceries`, `₹${amt} Dining Out`, `₹${amt} Shopping`],
        updatedSessionMemory: memory,
      };
    }

    if (parsedIntent.isValid && parsedIntent.amount > 0) {
      const newExpense = buildExpenseItemFromIntent(parsedIntent);

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

      let replyText = `Logged **₹${newExpense.amount}** for **${newExpense.name}** under **${newExpense.category}**.`;
      if (parsedIntent.category && parsedIntent.merchant && parsedIntent.category !== parsedIntent.merchant) {
        replyText = `Logged **₹${newExpense.amount}** for **${parsedIntent.category}** at **${parsedIntent.merchant}** under **${newExpense.category}**.`;
      }

      return {
        reply: replyText,
        module: 'money',
        actionChips: [`✓ Added ₹${newExpense.amount}`, String(newExpense.category), 'Tap to edit'],
        executedActions: [
          {
            type: 'add_expense',
            targetId: newExpense.id,
            params: {
              name: newExpense.name,
              amount: newExpense.amount,
              category: newExpense.category,
              merchant: newExpense.merchant,
              payee: newExpense.payee,
            },
            description: `Logged expense of ₹${newExpense.amount} for ${newExpense.name}`,
          },
        ],
        updatedSessionMemory: memory,
      };
    }

    return null;
  }
}
