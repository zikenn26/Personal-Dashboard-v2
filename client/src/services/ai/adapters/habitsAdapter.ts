import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { broadcastDataChanged } from '../../commandMappingService';

export class HabitsAdapter implements ModuleAdapter {
  name = 'habits';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    return (
      text.includes('habit') ||
      text.includes('streak') ||
      text === 'my habits' ||
      text === 'show habits' ||
      text.includes('start habit')
    );
  }

  async handle(input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const text = input.trim();
    const lower = text.toLowerCase();
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const habits = Storage.getHabits();
    const today = new Date().getDay(); // 0 is Sunday, 1 is Monday...

    // 1. Mark habit complete
    if (
      lower.includes('complete') ||
      lower.includes('done') ||
      lower.includes('mark') ||
      lower.includes('check off')
    ) {
      const habitQuery = lower
        .replace(/^(complete|done with|mark|check off)\s+(habit)?/i, '')
        .trim();

      const target = habits.find((h) =>
        habitQuery ? h.title.toLowerCase().includes(habitQuery) : true
      );

      if (target) {
        // Toggle today in completedDays (0=Mon ... 6=Sun)
        const dayIndex = today === 0 ? 6 : today - 1;
        if (!target.completedDays) {
          target.completedDays = [false, false, false, false, false, false, false];
        }
        if (!target.completedDays[dayIndex]) {
          target.completedDays[dayIndex] = true;
          target.streak = (target.streak || 0) + 1;
        }

        Storage.setHabits(habits);
        broadcastDataChanged('habits');

        return {
          reply: `Great work! Marked habit **"${target.title}"** as done today. Current streak: **${target.streak || 1} day${(target.streak || 1) === 1 ? '' : 's'}** 🔥`,
          module: 'habits',
          actionChips: [`Streak: ${target.streak} days`, target.title],
          updatedSessionMemory: memory,
        };
      }
    }

    // 2. View Habits & Streaks
    if (habits.length === 0) {
      return {
        reply: `You haven't added any habits yet. You can track habits from the Habits view in the bottom bar or More sheet.`,
        module: 'habits',
        actionChips: ['0 habits tracked'],
        updatedSessionMemory: memory,
      };
    }

    const listStr = habits
      .slice(0, 5)
      .map((h) => `• **${h.title}** (Streak: ${h.streak || 0} days 🔥)`)
      .join('\n');

    return {
      reply: `Here are your current habits and streaks:\n${listStr}`,
      module: 'habits',
      actionChips: [`${habits.length} habits tracked`, 'Habits Module'],
      updatedSessionMemory: memory,
    };
  }
}
