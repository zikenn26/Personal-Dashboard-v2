import { beforeAll, describe, it, expect } from 'vitest';
import {
  analyzeCommandIntent,
  isRogueTaskCreation,
} from './commandIntentEngine';
import { Storage } from '../utils/storage';

beforeAll(() => {
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
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0,
    } as any;
  }

  // Seed sample expenses and habits
  const todayStr = new Date().toISOString().split('T')[0];
  Storage.setExpenses([
    {
      id: 'exp-1',
      name: 'Coffee',
      amount: 120,
      category: 'Dining Out',
      date: todayStr,
      billingCycle: 'one-time',
      icon: '☕',
      active: true,
    },
    {
      id: 'exp-2',
      name: 'Lunch',
      amount: 250,
      category: 'Dining Out',
      date: todayStr,
      billingCycle: 'one-time',
      icon: '🍔',
      active: true,
    },
  ]);

  Storage.setHabits([
    {
      id: 'hab-1',
      title: 'Morning Meditation',
      category: 'Wellness',
      streak: 5,
      completedDays: [false, false, false, false, false, false, false],
      history: {},
      color: '#6366F1',
    },
    {
      id: 'hab-2',
      title: 'Drink 2L Water',
      category: 'Health',
      streak: 3,
      completedDays: [false, false, false, false, false, false, false],
      history: {},
      color: '#06B6D4',
    },
  ]);
});

describe('Command Intent Engine', () => {
  it('correctly maps "Delete all the spendings I did today" to batch expense deletion', () => {
    const prompt = 'Delete all the spendings I did today';
    const decision = analyzeCommandIntent(prompt);

    expect(decision.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(decision.actions.length).toBeGreaterThan(0);
    expect(decision.actions[0].type).toBe('delete_expense');
    expect(decision.actions[0].params.date).toBe('today');
    expect(decision.actions[0].params.all).toBe(true);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('correctly maps "Check both my habits as done" to habit completion for both habits', () => {
    const prompt = 'Check both my habits as done';
    const decision = analyzeCommandIntent(prompt);

    expect(decision.intent).toBe('HABIT_COMPLETE');
    expect(decision.actions.length).toBeGreaterThan(0);
    expect(decision.actions[0].type).toBe('toggle_habit');
    expect(decision.actions[0].params.both).toBe(true);
  });

  it('correctly detects rogue task creation for delete expense commands', () => {
    const isRogue = isRogueTaskCreation(
      'add_task',
      { title: 'delete all the spendings I did today' },
      'delete all the spendings I did today'
    );
    expect(isRogue).toBe(true);
  });

  it('correctly detects rogue task creation for habit checking commands', () => {
    const isRogue = isRogueTaskCreation(
      'createTask',
      { title: 'check both my habits as done' },
      'check both my habits as done'
    );
    expect(isRogue).toBe(true);
  });

  it('allows legitimate task creations without flagging as rogue', () => {
    const isRogue = isRogueTaskCreation(
      'add_task',
      { title: 'Buy groceries and milk' },
      'Add a task to buy groceries and milk'
    );
    expect(isRogue).toBe(false);
  });

  it('flags destructive actions with confirmation prompt and interactive options', () => {
    const prompt = 'Clear all my expenses';
    const decision = analyzeCommandIntent(prompt);

    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.options).toBeDefined();
    expect(decision.options?.length).toBeGreaterThan(0);
  });
});
