import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';

export class ExamsAdapter implements ModuleAdapter {
  name = 'exams';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    return (
      text.includes('exam') ||
      text.includes('syllabus') ||
      text.includes('countdown') ||
      text === 'upcoming exams' ||
      text === 'my exams'
    );
  }

  async handle(_input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const exams = Storage.getExams();

    if (exams.length === 0) {
      return {
        reply: `No competitive exams are tracked right now. You can manage exams and syllabus from **More → Competitive Exams**.`,
        module: 'exams',
        actionChips: ['0 exams tracked', 'More → Competitive Exams'],
        updatedSessionMemory: memory,
      };
    }

    const todayMs = Date.now();
    const listStr = exams
      .slice(0, 4)
      .map((e) => {
        let daysStr = '';
        const examDate = e.targetExamDate || (e as any).date;
        if (examDate) {
          const diffDays = Math.ceil((new Date(examDate).getTime() - todayMs) / (1000 * 60 * 60 * 24));
          daysStr = diffDays > 0 ? ` (${diffDays} days left)` : diffDays === 0 ? ' (Today!)' : ' (Completed)';
        }
        return `• **${e.name}**: ${examDate || 'TBD'}${daysStr}`;
      })
      .join('\n');

    return {
      reply: `Here are your upcoming tracked exams and countdowns:\n${listStr}`,
      module: 'exams',
      actionChips: [`${exams.length} exams`, 'Exams Module'],
      updatedSessionMemory: memory,
    };
  }
}
