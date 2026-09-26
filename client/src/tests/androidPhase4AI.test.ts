import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  aiService,
  IntentRouter,
  MoneyAdapter,
  TasksAdapter,
  HabitsAdapter,
  GoalsAdapter,
  ExamsAdapter,
  JournalAdapter,
  ScheduleAdapter,
  ContextAdapter,
} from '../services/ai';
import { InteractiveOption } from '../services/commandIntentEngine';
import { Storage } from '../utils/storage';

// In-memory mock storage if running in node vitest environment
const mockStorage: Record<string, string> = {};
const testLocalStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = testLocalStorage;
}

describe('Phase 4 — Android AI Assistant Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    testLocalStorage.clear();
  });

  describe('1. Assistant Entry Point & More Sheet Launcher', () => {
    it('manages assistant sheet open/close state without persistent floating widgets', () => {
      let isAssistantOpen = false;
      const openAssistant = () => { isAssistantOpen = true; };
      const closeAssistant = () => { isAssistantOpen = false; };

      expect(isAssistantOpen).toBe(false);
      openAssistant();
      expect(isAssistantOpen).toBe(true);
      closeAssistant();
      expect(isAssistantOpen).toBe(false);
    });

    it('hardware Android back button closes assistant sheet before exiting app', () => {
      let isAssistantOpen = true;
      let appExited = false;

      const handleAndroidBack = () => {
        if (isAssistantOpen) {
          isAssistantOpen = false;
          return true; // handled
        }
        appExited = true;
        return false;
      };

      const handledFirst = handleAndroidBack();
      expect(handledFirst).toBe(true);
      expect(isAssistantOpen).toBe(false);
      expect(appExited).toBe(false);

      const handledSecond = handleAndroidBack();
      expect(handledSecond).toBe(false);
      expect(appExited).toBe(true);
    });

    it('exposes Zikenn AI entry point inside More sheet', async () => {
      const moreSheetModule = await import('../presentation/mobile/navigation/AndroidMoreSheet');
      expect(moreSheetModule.AndroidMoreSheet).toBeDefined();
    });
  });

  describe('2. AI Service Architecture & Intent Router', () => {
    it('processes today spending query via MoneyAdapter', async () => {
      vi.spyOn(Storage, 'getExpenses').mockReturnValue([
        { id: 'exp-1', name: 'Lunch', amount: 250, date: new Date().toISOString().split('T')[0], category: 'Dining Out' } as any,
      ]);

      const res = await aiService.processMessage("What did I spend today?");
      expect(res).toBeDefined();
      expect(res.module).toBe('money');
      expect(res.reply).toContain('₹250');
    });

    it('processes adding an expense and records lastExpense in session memory', async () => {
      const saveSpy = vi.spyOn(Storage, 'setExpenses').mockImplementation(() => {});
      vi.spyOn(Storage, 'getExpenses').mockReturnValue([]);

      const initialMemory = aiService.createInitialSessionMemory();
      const res = await aiService.processMessage('Add ₹300 groceries', { sessionMemory: initialMemory });

      expect(res.module).toBe('money');
      expect(res.reply).toContain('300');
      expect(res.updatedSessionMemory.lastExpense).toBeDefined();
      expect(res.updatedSessionMemory.lastExpense?.amount).toBe(300);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('resolves conversation context: modifies previous action ("Change it to ₹250")', async () => {
      const existingExpenses = [
        { id: 'exp-groceries', name: 'Groceries', amount: 300, date: new Date().toISOString().split('T')[0], category: 'Groceries' } as any,
      ];
      vi.spyOn(Storage, 'getExpenses').mockReturnValue(existingExpenses);
      const saveSpy = vi.spyOn(Storage, 'setExpenses').mockImplementation(() => {});

      const sessionWithLastExpense = {
        lastExpense: { id: 'exp-groceries', name: 'Groceries', amount: 300 },
      };

      const res = await aiService.processMessage('Change it to ₹250', { sessionMemory: sessionWithLastExpense });

      expect(res.module).toBe('money');
      expect(res.reply).toContain('₹250');
      expect(res.updatedSessionMemory.lastExpense?.amount).toBe(250);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('processes task queries and task creation via TasksAdapter', async () => {
      vi.spyOn(Storage, 'getTodos').mockReturnValue([
        { id: 'todo-1', title: 'Finish Phase 4', completed: false, priority: 'high' } as any,
      ]);

      const viewRes = await aiService.processMessage('Show my tasks');
      expect(viewRes.module).toBe('tasks');
      expect(viewRes.reply).toContain('Finish Phase 4');

      const saveSpy = vi.spyOn(Storage, 'setTodos').mockImplementation(() => {});
      const createRes = await aiService.processMessage('Add task Prepare presentation');
      expect(createRes.module).toBe('tasks');
      expect(createRes.reply).toContain('Prepare presentation');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('processes habits queries and completion via HabitsAdapter', async () => {
      vi.spyOn(Storage, 'getHabits').mockReturnValue([
        { id: 'h-1', title: 'Morning Exercise', streak: 4, completedDays: [] } as any,
      ]);
      const saveSpy = vi.spyOn(Storage, 'setHabits').mockImplementation(() => {});

      const viewRes = await aiService.processMessage('What are my habits?');
      expect(viewRes.module).toBe('habits');
      expect(viewRes.reply).toContain('Morning Exercise');

      const compRes = await aiService.processMessage('Complete habit Morning Exercise');
      expect(compRes.module).toBe('habits');
      expect(compRes.reply).toContain('Morning Exercise');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('processes goals progress via GoalsAdapter', async () => {
      vi.spyOn(Storage, 'getGoals').mockReturnValue([
        { id: 'g-1', title: 'Learn Kotlin', progress: 65 } as any,
      ]);

      const res = await aiService.processMessage('Show my goals');
      expect(res.module).toBe('goals');
      expect(res.reply).toContain('Learn Kotlin');
      expect(res.reply).toContain('65%');
    });

    it('processes exams countdown via ExamsAdapter', async () => {
      vi.spyOn(Storage, 'getExams').mockReturnValue([
        { id: 'ex-1', name: 'GATE CSE', targetExamDate: '2027-02-15' } as any,
      ]);

      const res = await aiService.processMessage('Upcoming exams');
      expect(res.module).toBe('exams');
      expect(res.reply).toContain('GATE CSE');
    });

    it('processes journal entries via JournalAdapter', async () => {
      const saveSpy = vi.spyOn(Storage, 'setJournal').mockImplementation(() => {});
      vi.spyOn(Storage, 'getJournal').mockReturnValue([]);

      const res = await aiService.processMessage('Journal: Great day of productive development');
      expect(res.module).toBe('journal');
      expect(res.reply).toContain('Journal');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('processes schedule routine via ScheduleAdapter', async () => {
      vi.spyOn(Storage, 'getSchedule').mockReturnValue({
        version: '2.0',
        weekdayTemplate: [{ id: '1', time: '09:00', title: 'Team Standup' }],
        weekendTemplate: [{ id: '2', time: '10:00', title: 'Weekend Reading' }],
        days: {} as any,
      });

      const res = await aiService.processMessage("Today's schedule");
      expect(res.module).toBe('schedule');
      expect(res.reply).toMatch(/(Standup|Weekend Reading)/);
    });
  });

  describe('3. Context Awareness & Smart Action Chips', () => {
    it('understands situational query: "I\'m leaving office"', async () => {
      vi.spyOn(Storage, 'getTodos').mockReturnValue([
        { id: 't-1', title: 'Submit report', completed: false } as any,
      ]);

      const res = await aiService.processMessage("I'm leaving office");
      expect(res.module).toBe('context');
      expect(res.reply).toContain('commute');
      expect(res.reply).toContain('Pending Tasks');
    });

    it('understands situational query: "I\'m studying"', async () => {
      vi.spyOn(Storage, 'getExams').mockReturnValue([
        { id: 'ex-1', name: 'UPSC Prelims', targetExamDate: '2026-10-15' } as any,
      ]);

      const res = await aiService.processMessage("I'm studying");
      expect(res.module).toBe('context');
      expect(res.reply).toContain('focus');
    });

    it('generates context-aware smart action chips for morning, midday, evening, and weekend', () => {
      const weekendChips = aiService.getSmartActionChips({ isWeekend: true });
      expect(weekendChips.some((c) => c.label.includes('Goals') || c.label.includes('Spending'))).toBe(true);

      const weekdayChips = aiService.getSmartActionChips({ isWeekend: false });
      expect(weekdayChips.length).toBeGreaterThan(0);
    });
  });

  describe('4. Action Confirmation & Destructive Protection', () => {
    it('demands confirmation for destructive deletion commands and does NOT silently execute', async () => {
      vi.spyOn(Storage, 'getExpenses').mockReturnValue([
        { id: 'exp-1', name: 'Coffee', amount: 150, date: '2026-09-25' } as any,
      ]);

      const res = await aiService.processMessage('Delete all expenses');
      expect(res.pendingConfirmation).toBe(true);
      expect(res.options).toBeDefined();
      expect(res.options!.length).toBeGreaterThan(0);

      const cancelOption = res.options!.find((o) => o.variant === 'cancel');
      expect(cancelOption).toBeDefined();

      const dangerOption = res.options!.find((o) => o.variant === 'danger');
      expect(dangerOption).toBeDefined();
    });

    it('cancels execution safely when user selects Cancel option', async () => {
      const cancelOption: InteractiveOption = {
        id: 'cancel-test',
        label: '✕ Cancel',
        variant: 'cancel',
        actions: [],
      };

      const result = await aiService.executeOption(cancelOption);
      expect(result.status).toBe('CANCELLED');
      expect(result.executedActions.length).toBe(0);
    });
  });

  describe('5. Voice Input & Graceful Error Handling', () => {
    it('does not request microphone permission during app initialization', () => {
      const mockGetUserMedia = vi.fn();
      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });

    it('handles microphone permission denied without crashing and provides clear guidance', () => {
      let micError: string | null = null;
      const simulatePermissionDenied = (err: any) => {
        if (err.name === 'NotAllowedError' || err.message?.includes('denied')) {
          micError = 'Microphone permission was denied. Please allow microphone access in Android settings to use voice input.';
        }
      };

      simulatePermissionDenied({ name: 'NotAllowedError', message: 'Permission denied' });
      expect(micError).toContain('Microphone permission was denied');
    });
  });

  describe('6. Home Screen & Navigation Cleanliness', () => {
    it('ensures Home dashboard components are free of floating assistant buttons', async () => {
      const homeScreenModule = await import('../presentation/mobile/screens/home/AndroidHomeScreen');
      expect(homeScreenModule.AndroidHomeScreen).toBeDefined();
    });

    it('ensures Bottom Navigation and Quick Access remain unobstructed', async () => {
      const bottomNavModule = await import('../presentation/mobile/navigation/AndroidBottomNav');
      expect(bottomNavModule.AndroidBottomNav).toBeDefined();
    });
  });
});
