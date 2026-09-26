import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory, SmartChipItem, TimeOfDay } from '../types';
import { Storage } from '../../../utils/storage';

export class ContextAdapter implements ModuleAdapter {
  name = 'context';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    return (
      text.includes('leaving office') ||
      text.includes('leaving work') ||
      text.includes('done with work') ||
      text.includes('heading home') ||
      text.includes('im studying') ||
      text.includes("i'm studying") ||
      text.includes('study time') ||
      text.includes('start studying')
    );
  }

  async handle(input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const text = input.trim().toLowerCase();
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const todos = Storage.getTodos();
    const pendingTasks = todos.filter((t) => !t.completed);
    const habits = Storage.getHabits();

    // 1. Situational Scenario: Leaving Office
    if (
      text.includes('leaving office') ||
      text.includes('leaving work') ||
      text.includes('done with work') ||
      text.includes('heading home')
    ) {
      let reply = `Have a safe commute! 🚗 Here is your end-of-day summary:\n`;
      reply += `• **Pending Tasks**: You have ${pendingTasks.length} open task${pendingTasks.length === 1 ? '' : 's'}.\n`;
      if (pendingTasks.length > 0) {
        reply += `  (e.g., "${pendingTasks[0].title}")\n`;
      }
      reply += `• **Commute**: Remember to log your cab/transit expense (e.g., *"Add ₹150 for Metro"*).\n`;

      const eveningHabit = habits.find((h) => h.category?.toLowerCase() === 'evening' || h.title.toLowerCase().includes('walk') || h.title.toLowerCase().includes('read'));
      if (eveningHabit) {
        reply += `• **Evening Habit**: Next up is **${eveningHabit.title}**!`;
      } else {
        reply += `• **Evening**: Relax, unwind, and check your journal later.`;
      }

      return {
        reply,
        module: 'context',
        actionChips: ['Add transit expense', 'Pending Tasks', 'Evening Habit'],
        updatedSessionMemory: memory,
      };
    }

    // 2. Situational Scenario: Studying
    if (
      text.includes('im studying') ||
      text.includes("i'm studying") ||
      text.includes('study time') ||
      text.includes('start studying')
    ) {
      const exams = Storage.getExams();
      let reply = `Great focus! Let's get you locked in 📚:\n`;

      if (exams.length > 0) {
        const nextExam = exams[0];
        reply += `• **Exam Target**: ${nextExam.name} on ${nextExam.targetExamDate || 'upcoming'}.\n`;
      }

      const studyTasks = pendingTasks.filter((t) =>
        t.title.toLowerCase().includes('study') ||
        t.title.toLowerCase().includes('read') ||
        t.title.toLowerCase().includes('revision') ||
        t.title.toLowerCase().includes('chapter')
      );

      if (studyTasks.length > 0) {
        reply += `• **Study Tasks**:\n` + studyTasks.slice(0, 3).map((t) => `  - [ ] ${t.title}`).join('\n') + `\n`;
      } else {
        reply += `• **Tasks**: No dedicated study tasks currently listed. Say **"Add task Read chapter 3"** to track one.\n`;
      }
      reply += `• **Notes & Exam**: Head to **More → Competitive Exams** or quick notes for reference.`;

      return {
        reply,
        module: 'context',
        actionChips: ['Upcoming exams', 'Add study task', 'Library'],
        updatedSessionMemory: memory,
      };
    }

    return null;
  }

  /**
   * Generates dynamic, context-aware smart action chips depending on time of day and weekend state.
   */
  static getSmartActionChips(context?: AIServiceContext): SmartChipItem[] {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekend = context?.isWeekend ?? (day === 0 || day === 6);

    let timeOfDay: TimeOfDay = 'morning';
    if (hour >= 5 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 18) {
      timeOfDay = 'midday';
    } else if (hour >= 18 && hour < 23) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }

    if (isWeekend) {
      return [
        { id: 'w-1', label: 'Goals Progress', prompt: 'Show my goals', category: 'weekend' },
        { id: 'w-2', label: 'Weekly Spending', prompt: 'Weekly spending', category: 'weekend' },
        { id: 'w-3', label: 'My Habits', prompt: 'Show my habits', category: 'weekend' },
        { id: 'w-4', label: 'Journal Entry', prompt: 'Show journal entries', category: 'weekend' },
        { id: 'w-5', label: 'Upcoming Exams', prompt: 'Upcoming exams', category: 'weekend' },
      ];
    }

    switch (timeOfDay) {
      case 'morning':
        return [
          { id: 'm-1', label: "Today's Tasks", prompt: "Show my tasks", category: 'morning' },
          { id: 'm-2', label: "Today's Schedule", prompt: "Today's schedule", category: 'morning' },
          { id: 'm-3', label: 'Start Habit', prompt: 'Show my habits', category: 'morning' },
          { id: 'm-4', label: "Today's Spending", prompt: "What did I spend today?", category: 'morning' },
          { id: 'm-5', label: 'Add Task', prompt: 'Add task ', category: 'morning' },
        ];
      case 'midday':
        return [
          { id: 'o-1', label: 'Log Expense', prompt: 'Add ₹250 coffee', category: 'office' },
          { id: 'o-2', label: "Today's Spending", prompt: "What did I spend today?", category: 'office' },
          { id: 'o-3', label: "Today's Schedule", prompt: "Today's schedule", category: 'office' },
          { id: 'o-4', label: 'Pending Tasks', prompt: 'Show my tasks', category: 'office' },
          { id: 'o-5', label: "I'm leaving office", prompt: "I'm leaving office", category: 'office' },
        ];
      case 'evening':
        return [
          { id: 'e-1', label: 'Pending Tasks', prompt: 'Show my tasks', category: 'evening' },
          { id: 'e-2', label: 'Journal Reflection', prompt: 'Journal: Reflecting on today', category: 'evening' },
          { id: 'e-3', label: "Today's Spending", prompt: "What did I spend today?", category: 'evening' },
          { id: 'e-4', label: 'Habits Streak', prompt: 'Show my habits', category: 'evening' },
          { id: 'e-5', label: "I'm studying", prompt: "I'm studying", category: 'evening' },
        ];
      case 'night':
      default:
        return [
          { id: 'n-1', label: "Today's Spending", prompt: "What did I spend today?", category: 'general' },
          { id: 'n-2', label: 'Journal', prompt: 'Show journal entries', category: 'general' },
          { id: 'n-3', label: 'Goals', prompt: 'Show my goals', category: 'general' },
          { id: 'n-4', label: 'Pending Tasks', prompt: 'Show my tasks', category: 'general' },
        ];
    }
  }
}
