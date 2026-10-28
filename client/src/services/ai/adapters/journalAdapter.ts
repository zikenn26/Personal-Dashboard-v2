import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { JournalEntry } from '../../../types';
import { broadcastDataChanged } from '../../commandMappingService';

export class JournalAdapter implements ModuleAdapter {
  name = 'journal';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    return (
      text.includes('journal') ||
      text.includes('diary') ||
      /^(write|add|log)\s+(journal|reflection|diary)/i.test(text)
    );
  }

  async handle(input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const text = input.trim();
    const lower = text.toLowerCase();
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const entries = Storage.getJournal();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Add journal entry
    const createMatch = text.match(/(?:add|write|log|new)?\s*(?:journal(?:\s+entry)?|diary)\s*[:-]?\s*(.+)/i);
    if (createMatch && !lower.includes('show') && !lower.includes('list') && !lower.includes('search')) {
      const content = createMatch[1].trim();
      const newEntry: JournalEntry = {
        id: `journal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: `Note - ${todayStr}`,
        content,
        date: todayStr,
        timestamp: Date.now(),
        mood: '📝',
        moodLabel: 'Thoughtful',
        tags: ['assistant', 'reflection'],
      };

      const updated = [newEntry, ...entries];
      Storage.setJournal(updated);
      broadcastDataChanged('journal');

      return {
        reply: `Logged your reflection in the Journal: *"“${content}”"*`,
        module: 'journal',
        actionChips: ['✓ Journal logged', todayStr],
        executedActions: [
          {
            type: 'add_journal',
            targetId: newEntry.id,
            params: { content },
            description: 'Saved journal entry',
          },
        ],
        updatedSessionMemory: memory,
      };
    }

    // 2. View / Search journal
    if (entries.length === 0) {
      return {
        reply: `Your journal has no entries yet. Say **"Journal: Had a productive afternoon"** to record your thoughts.`,
        module: 'journal',
        actionChips: ['No journal entries'],
        updatedSessionMemory: memory,
      };
    }

    const latest = entries[0];
    return {
      reply: `Here is your most recent journal entry from **${latest.date || 'recently'}**:\n\n> *${latest.content.slice(0, 180)}${latest.content.length > 180 ? '...' : ''}*`,
      module: 'journal',
      actionChips: [`${entries.length} total entries`, 'Journal Module'],
      updatedSessionMemory: memory,
    };
  }
}
