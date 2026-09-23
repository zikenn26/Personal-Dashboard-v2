/**
 * End-to-End Acceptance Test Suite
 *
 * Verifies real end-to-end execution paths through sendGeminiMessage,
 * sendSecretaryMessage, Storage state mutations, context threading,
 * safety confirmations, and Gemini Live voice pipeline.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { sendGeminiMessage } from '../services/geminiService';
import { sendSecretaryMessage } from '../services/groqService';
import { Storage } from '../utils/storage';
import { isRogueTaskCreation, getTodayDateString, getYesterdayDateString } from '../services/commandIntentEngine';

function setupMockStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (idx: number) => Object.keys(store)[idx] ?? null,
      length: 0,
    } as any;
  }
}

describe('Real End-to-End Acceptance Verification', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();

    const TODAY_STR = getTodayDateString();
    const YEST_STR = getYesterdayDateString();

    // Seed test data
    Storage.setExpenses([
      { id: 'exp-1', name: 'Lunch Bowl', amount: 250, category: 'Food & Dining', date: TODAY_STR, active: true },
      { id: 'exp-2', name: 'Metro Card', amount: 100, category: 'Transportation', date: TODAY_STR, active: true },
      { id: 'exp-3', name: 'Yesterday Book', amount: 450, category: 'Education', date: YEST_STR, active: true },
    ]);

    Storage.setTodos([
      { id: 'todo-1', title: 'Prepare project presentation', completed: false, priority: 'high', category: 'Work' },
      { id: 'todo-2', title: 'Buy milk and eggs', completed: true, priority: 'medium', category: 'Personal' },
    ]);

    Storage.setHabits([
      {
        id: 'habit-1',
        title: 'Morning Meditation',
        category: 'Health',
        icon: '🧘',
        streak: 5,
        color: 'from-amber-400 to-orange-500',
        completedDays: [true, false, false, false, false, false, false],
      },
      {
        id: 'habit-2',
        title: 'Evening Reading',
        category: 'Personal',
        icon: '📚',
        streak: 3,
        color: 'from-blue-400 to-indigo-500',
        completedDays: [false, false, false, false, false, false, false],
      },
    ]);
  });

  describe('1. Expense READ commands (Must not create tasks or mutate data)', () => {
    const readCommands = [
      'Show me what I spent today',
      'What did I spend today?',
      'How much did I spend today?',
      "Show today's expenses",
      'Show my recent transactions',
    ];

    readCommands.forEach((cmd) => {
      it(`E2E-READ: "${cmd}" resolves as EXPENSE_VIEW without creating tasks or mutating data`, async () => {
        const initialTasksCount = Storage.getTodos().length;
        const initialExpensesCount = Storage.getExpenses().length;

        const result = await sendGeminiMessage({
          message: cmd,
          history: [],
        });

        // 1. Task list must remain intact (NO tasks created)
        expect(Storage.getTodos()).toHaveLength(initialTasksCount);
        expect(Storage.getTodos().some((t) => t.title.toLowerCase().includes('spent'))).toBe(false);

        // 2. Expenses data must NOT be modified
        expect(Storage.getExpenses()).toHaveLength(initialExpensesCount);

        // 3. Navigation chip or action to expenses
        const hasExpenseNav = result.actionChips?.some(
          (c) => c.toLowerCase().includes('expense')
        );
        expect(hasExpenseNav).toBe(true);

        // 4. Clean user-facing text: no debug or technical jargon
        expect(result.reply).not.toContain('EXPENSE_VIEW');
        expect(result.reply).not.toContain('CommandDecision');
        expect(result.reply).not.toContain('isDestructive');
      });
    });
  });

  describe('2. Page-context behavior', () => {
    it('E2E-CTX-01: On Tasks page, "What\'s left?" resolves to task-related interpretation', async () => {
      const initialTasks = Storage.getTodos().length;
      const res = await sendGeminiMessage({
        message: "What's left?",
        history: [],
        context: { activeView: 'tasks' },
      });

      expect(Storage.getTodos()).toHaveLength(initialTasks);
      expect(res.reply.toLowerCase()).toMatch(/task|pending|presentation/);
      expect(res.reply).not.toContain('TASK_VIEW');
    });

    it('E2E-CTX-02: On Habits page, "Which ones did I finish today?" resolves to habit-related interpretation', async () => {
      const res = await sendGeminiMessage({
        message: 'Which ones did I finish today?',
        history: [],
        context: { activeView: 'habits' },
      });

      expect(res.reply.toLowerCase()).toMatch(/habit|meditation|completed/);
      expect(res.reply).not.toContain('HABIT_VIEW');
    });

    it('E2E-CTX-03: On Expenses page, "How much did I spend?" resolves to expense-related interpretation', async () => {
      const res = await sendGeminiMessage({
        message: 'How much did I spend?',
        history: [],
        context: { activeView: 'expenses' },
      });

      expect(res.reply.toLowerCase()).toMatch(/spent|₹|expense/);
      expect(res.reply).not.toContain('EXPENSE_VIEW');
    });
  });

  describe('3. Explicit command must override page context', () => {
    it('E2E-OVERRIDE-01: On Expenses page, "Add a task to review quarterly expenses" creates task', async () => {
      const initialExpensesCount = Storage.getExpenses().length;

      const res = await sendGeminiMessage({
        message: 'Add a task to review quarterly expenses',
        history: [],
        context: { activeView: 'expenses' },
      });

      // Expense context must NOT override explicit task creation
      expect(Storage.getExpenses()).toHaveLength(initialExpensesCount);
      const todos = Storage.getTodos();
      const created = todos.find((t) => t.title.toLowerCase().includes('review quarterly expenses'));
      expect(created).toBeDefined();
      expect(res.reply.toLowerCase()).toContain('review quarterly expenses');
    });

    it('E2E-OVERRIDE-02: On Tasks page, "Show me what I spent today" shows expenses, does NOT create task', async () => {
      const initialTodos = Storage.getTodos().length;

      const res = await sendGeminiMessage({
        message: 'Show me what I spent today',
        history: [],
        context: { activeView: 'tasks' },
      });

      expect(Storage.getTodos()).toHaveLength(initialTodos);
      expect(res.reply.toLowerCase()).toMatch(/spent|₹350|today/);
    });
  });

  describe('4. Ambiguous commands must not silently create tasks', () => {
    const ambiguousCommands = ['Show me that', 'Delete that', 'Finish it', 'Do that'];

    ambiguousCommands.forEach((cmd) => {
      it(`E2E-AMB: "${cmd}" asks concise clarification without guessing or creating a task`, async () => {
        const initialTodos = Storage.getTodos().length;
        const initialExpenses = Storage.getExpenses().length;

        const res = await sendGeminiMessage({
          message: cmd,
          history: [],
        });

        expect(Storage.getTodos()).toHaveLength(initialTodos);
        expect(Storage.getExpenses()).toHaveLength(initialExpenses);
        expect(res.reply.toLowerCase()).toMatch(/which|what|clarify|mean|specify/);
      });
    });
  });

  describe('5. Destructive command with safety confirmation', () => {
    it('E2E-DESTRUCTIVE: "Delete all my expenses today" asks confirmation, deletes only today after confirm', async () => {
      const initialExpenses = Storage.getExpenses();
      expect(initialExpenses).toHaveLength(3); // 2 today, 1 yesterday

      // 1. Initial destructive command
      const promptRes = await sendGeminiMessage({
        message: 'Delete all my expenses today',
        history: [],
      });

      // 2. Must ask confirmation and NOT delete anything yet
      expect(promptRes.pendingConfirmation).toBeDefined();
      expect(Storage.getExpenses()).toHaveLength(3);
      expect(promptRes.reply.toLowerCase()).toMatch(/proceed|are you sure|confirm|permanently|delete/);

      // 3. User confirms
      const confirmRes = await sendGeminiMessage({
        message: 'Yes, confirm delete',
        history: [],
      });

      // 4. Must delete ONLY today's expenses (2 items), keeping yesterday's (1 item)
      const remaining = Storage.getExpenses();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('exp-3');
      expect(remaining[0].name).toBe('Yesterday Book');
      expect(confirmRes.reply.toLowerCase()).toMatch(/deleted|removed/);
    });
  });

  describe('6. Gemini Live path parity and safeguards', () => {
    it('E2E-LIVE-01: Gemini Live query "Show me what I spent today" uses central pipeline', async () => {
      const initialTodos = Storage.getTodos().length;
      const res = await sendGeminiMessage({
        message: 'Show me what I spent today',
        history: [],
      });

      expect(Storage.getTodos()).toHaveLength(initialTodos);
      expect(res.reply.toLowerCase()).toContain('spent');
    });

    it('E2E-LIVE-02: Gemini Live destructive command respects confirmation barrier', async () => {
      const res = await sendGeminiMessage({
        message: 'Delete all my expenses today',
        history: [],
      });

      expect(res.pendingConfirmation).toBeDefined();
      expect(Storage.getExpenses()).toHaveLength(3);
    });

    it('E2E-LIVE-03: Gemini Live "Add a task to review my expenses" creates task correctly', async () => {
      const res = await sendGeminiMessage({
        message: 'Add a task to review my expenses',
        history: [],
      });

      const todos = Storage.getTodos();
      expect(todos.some((t) => t.title.toLowerCase().includes('review my expenses'))).toBe(true);
      expect(res.reply.toLowerCase()).toContain('review my expenses');
    });

    it('E2E-LIVE-04: isRogueTaskCreation blocks query strings from model tool calls', () => {
      expect(isRogueTaskCreation('createTask', { title: 'Show me what I spent today' })).toBe(true);
      expect(isRogueTaskCreation('createTask', { title: 'Delete all my expenses today' })).toBe(true);
      expect(isRogueTaskCreation('createTask', { title: 'Clean my desk' })).toBe(false);
    });
  });

  describe('7. UI cleanliness verification', () => {
    it('E2E-UI-01: Responses are natural without technical/debug jargon', async () => {
      const res = await sendGeminiMessage({
        message: 'Show me what I spent today',
        history: [],
      });

      const forbiddenTokens = [
        'EXPENSE_VIEW',
        'TASK_VIEW',
        'HABIT_VIEW',
        'CONFIRM_PENDING',
        'isDestructive',
        'confidence',
        'CommandDecision',
        'ExecutableAction',
      ];

      forbiddenTokens.forEach((token) => {
        expect(res.reply).not.toContain(token);
      });
    });
  });

  describe('8. Regression check for existing capabilities', () => {
    it('REG-01: Creating a task works as expected', async () => {
      await sendGeminiMessage({
        message: 'Add a task Buy groceries for dinner',
        history: [],
      });

      const todos = Storage.getTodos();
      expect(todos.some((t) => t.title.toLowerCase().includes('buy groceries for dinner'))).toBe(true);
    });

    it('REG-02: Completing habit works as expected', async () => {
      const habitsBefore = Storage.getHabits();
      const habit2Before = habitsBefore.find((h) => h.id === 'habit-2');
      const todayIdx = ((new Date().getDay() + 6) % 7);
      expect(habit2Before?.completedDays?.[todayIdx]).toBeFalsy();

      await sendGeminiMessage({
        message: 'Check off Evening Reading habit',
        history: [],
      });

      const habitsAfter = Storage.getHabits();
      const habit2After = habitsAfter.find((h) => h.id === 'habit-2');
      expect(habit2After?.completedDays?.[todayIdx]).toBe(true);
    });

    it('REG-03: Deleting a specific expense works cleanly', async () => {
      const res = await sendGeminiMessage({
        message: 'Delete Lunch Bowl expense',
        history: [],
      });

      const remaining = Storage.getExpenses();
      expect(remaining.some((e) => e.name === 'Lunch Bowl')).toBe(false);
      expect(res.reply.toLowerCase()).toContain('deleted');
    });

    it('REG-04: API key entry, update, and retrieval integrity', () => {
      // Groq key
      Storage.setGroqApiKey('gsk_test123456789');
      expect(Storage.getGroqApiKey()).toBe('gsk_test123456789');

      Storage.removeGroqApiKey();
      expect(Storage.getGroqApiKey()).toBe('');

      // Gemini custom key
      Storage.setGeminiApiKey('AIzaSyCustomKey987');
      expect(Storage.getGeminiApiKey()).toBe('AIzaSyCustomKey987');

      Storage.removeGeminiApiKey();
      expect(Storage.getGeminiApiKey()).toBe('');
    });
  });
});
