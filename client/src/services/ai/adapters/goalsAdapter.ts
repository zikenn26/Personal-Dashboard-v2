import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';

export class GoalsAdapter implements ModuleAdapter {
  name = 'goals';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    return (
      text.includes('goal') ||
      text.includes('milestone') ||
      text === 'goals' ||
      text === 'my goals' ||
      text === 'show goals'
    );
  }

  async handle(_input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const goals = Storage.getGoals();

    if (goals.length === 0) {
      return {
        reply: `You don't have any active goals configured yet. Head to **More → Goals** to set your ambitions!`,
        module: 'goals',
        actionChips: ['0 goals found', 'More → Goals'],
        updatedSessionMemory: memory,
      };
    }

    const listStr = goals
      .slice(0, 4)
      .map((g) => {
        const progress = typeof g.progress === 'number' ? `${g.progress}%` : 'In progress';
        const targetDate = g.targetDate ? ` (Target: ${g.targetDate})` : '';
        return `• **${g.title}** - Progress: **${progress}**${targetDate}`;
      })
      .join('\n');

    return {
      reply: `Here is your current goal progress:\n${listStr}`,
      module: 'goals',
      actionChips: [`${goals.length} active goals`, 'Goals Module'],
      updatedSessionMemory: memory,
    };
  }
}
