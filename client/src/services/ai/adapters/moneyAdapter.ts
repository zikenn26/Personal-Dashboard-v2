import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { ExpenseItem } from '../../../types';
import { inferExpenseCategory, broadcastDataChanged } from '../../commandMappingService';
import { InteractiveOption, ExecutableAction } from '../../commandIntentEngine';

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

    // Spending queries
    if (
      text.includes('spend') ||
      text.includes('spending') ||
      text.includes('expense') ||
      text.includes('cost') ||
      text.includes('bought') ||
      text.includes('paid') ||
      text.includes('transaction') ||
      /^(add|log|record)\s+[₹$]?\s*\d+/i.test(text) ||
      /^[₹$]?\s*\d+\s+(for|on)\s+/i.test(text)
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
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Follow-up modification: "Change it to ₹250"
    if (memory.lastExpense) {
      const changeMatch = text.match(/(?:change\s+(?:it|that|amount|expense)\s+to|make\s+it|update\s+(?:it\s+to|to))\s*[₹$]?\s*(\d+(?:\.\d{1,2})?)/i);
      if (changeMatch) {
        const newAmount = parseFloat(changeMatch[1]);
        const targetId = memory.lastExpense.id;
        const targetExpense = expenses.find((e) => e.id === targetId);

        if (targetExpense) {
          const oldAmount = targetExpense.amount;
          targetExpense.amount = newAmount;
          Storage.setExpenses(expenses);
          broadcastDataChanged('expenses');

          memory.lastExpense = {
            ...memory.lastExpense,
            amount: newAmount,
          };
          memory.lastAction = {
            type: 'update_expense',
            entity: 'expense',
            description: `Updated "${targetExpense.name}" from ₹${oldAmount} to ₹${newAmount}`,
            timestamp: Date.now(),
          };

          return {
            reply: `Updated **${targetExpense.name}** amount from **₹${oldAmount}** to **₹${newAmount}**.`,
            module: 'money',
            actionChips: [`✓ Updated to ₹${newAmount}`, `Expense: ${targetExpense.name}`],
            executedActions: [
              {
                type: 'update_expense',
                targetId,
                params: { amount: newAmount, previousAmount: oldAmount },
                description: `Updated expense to ₹${newAmount}`,
              },
            ],
            updatedSessionMemory: memory,
          };
        }
      }
    }

    // 2. Destructive command protection: Delete expenses
    if (
      lower.includes('delete') ||
      lower.includes('remove') ||
      lower.includes('clear all expenses') ||
      lower.includes('wipe expenses')
    ) {
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

      // Single item deletion
      const itemToDelete = memory.lastExpense
        ? expenses.find((e) => e.id === memory.lastExpense?.id)
        : expenses[0];

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
          reply: `Are you sure you want to delete **"${itemToDelete.name}"** (₹${itemToDelete.amount})?`,
          module: 'money',
          actionChips: ['Confirmation required'],
          options: [cancelOption, deleteSingleOption],
          pendingConfirmation: true,
          updatedSessionMemory: memory,
        };
      }
    }

    // 3. Today's Spending Query
    if (
      (lower.includes('today') && (lower.includes('spend') || lower.includes('expense'))) ||
      lower === "today's spending" ||
      lower === 'what did i spend today?' ||
      lower === 'how much did i spend today'
    ) {
      const todayExpenses = expenses.filter((e) => e.date === todayStr);
      const total = todayExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

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

    // 4. Weekly Spending Query
    if (lower.includes('week') || lower === 'weekly spending') {
      const now = new Date();
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const weekExpenses = expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= monday;
      });

      const total = weekExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      return {
        reply: `Your total spending this week is **₹${total.toLocaleString('en-IN')}** across ${weekExpenses.length} transaction${weekExpenses.length === 1 ? '' : 's'}.`,
        module: 'money',
        actionChips: [`Week: ₹${total}`, `${weekExpenses.length} transactions`],
        updatedSessionMemory: memory,
      };
    }

    // 5. Recent Transactions Query
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

    // 6. Add Expense: "Add ₹250 coffee", "Spend 300 on groceries", "50 for snacks"
    const addMatch =
      text.match(/(?:add|log|record|spend|spent)?\s*[₹$]?\s*(\d+(?:\.\d{1,2})?)\s+(?:for|on)\s+([a-zA-Z0-9\s&'-]+)/i) ||
      text.match(/(?:add|log|record)?\s*(?:expense)?\s*([a-zA-Z0-9\s&'-]+?)\s+[₹$]?\s*(\d+(?:\.\d{1,2})?)/i) ||
      text.match(/[₹$]?\s*(\d+(?:\.\d{1,2})?)\s+([a-zA-Z0-9\s&'-]+)/i);

    if (addMatch) {
      let amount: number;
      let name: string;

      if (!isNaN(parseFloat(addMatch[1])) && isNaN(parseFloat(addMatch[2]))) {
        amount = parseFloat(addMatch[1]);
        name = addMatch[2].trim();
      } else if (isNaN(parseFloat(addMatch[1])) && !isNaN(parseFloat(addMatch[2]))) {
        name = addMatch[1].trim();
        amount = parseFloat(addMatch[2]);
      } else {
        amount = parseFloat(addMatch[1]);
        name = (addMatch[2] || 'Expense').trim();
      }

      // Cleanup name
      name = name.replace(/^(expense|for|on)\s+/i, '').trim();
      if (!name) name = 'Expense';

      const category = inferExpenseCategory(name);
      const newExpense: ExpenseItem = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name,
        amount,
        category,
        date: todayStr,
        billingCycle: 'one-time',
        active: true,
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
        description: `Added expense "${name}" for ₹${amount}`,
        timestamp: Date.now(),
      };

      return {
        reply: `Logged **₹${amount}** for **${name}** under **${category}**.`,
        module: 'money',
        actionChips: [`✓ Added ₹${amount}`, category, 'Tap to edit'],
        executedActions: [
          {
            type: 'add_expense',
            targetId: newExpense.id,
            params: { name, amount, category },
            description: `Logged expense of ₹${amount} for ${name}`,
          },
        ],
        updatedSessionMemory: memory,
      };
    }

    return null;
  }
}
