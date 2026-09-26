import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { TodoItem, Priority } from '../../../types';
import { broadcastDataChanged } from '../../commandMappingService';

export class TasksAdapter implements ModuleAdapter {
  name = 'tasks';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    if (
      text.includes('task') ||
      text.includes('todo') ||
      text.includes('to-do') ||
      /^(add|create|new)\s+(task|todo)/i.test(text) ||
      /^(complete|finish|done with)\s+task/i.test(text) ||
      text === 'my tasks' ||
      text === "today's tasks" ||
      text === 'show tasks' ||
      text === 'pending tasks'
    ) {
      return true;
    }
    return false;
  }

  async handle(input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const text = input.trim();
    const lower = text.toLowerCase();
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const todos = Storage.getTodos();

    // 1. Show / View Tasks
    if (
      lower.includes('show') ||
      lower.includes('view') ||
      lower.includes('list') ||
      lower.includes('pending') ||
      lower === 'my tasks' ||
      lower === "today's tasks" ||
      lower === 'what are my tasks?' ||
      lower === 'what are my tasks'
    ) {
      const pending = todos.filter((t) => !t.completed);
      if (pending.length === 0) {
        return {
          reply: `You have **0 pending tasks**! All clear for today 🎉. Say **"Add task [title]"** to schedule something new.`,
          module: 'tasks',
          actionChips: ['0 pending tasks', 'All caught up!'],
          updatedSessionMemory: memory,
        };
      }

      const listStr = pending
        .slice(0, 5)
        .map((t) => `• [${t.priority || 'medium'}] **${t.title}**`)
        .join('\n');

      return {
        reply: `You have **${pending.length} pending task${pending.length === 1 ? '' : 's'}**:\n${listStr}${
          pending.length > 5 ? `\n• ...and ${pending.length - 5} more.` : ''
        }`,
        module: 'tasks',
        actionChips: [`${pending.length} pending`, 'Tasks Module'],
        updatedSessionMemory: memory,
      };
    }

    // 2. Complete Task
    if (
      lower.startsWith('complete') ||
      lower.startsWith('finish') ||
      lower.startsWith('done with') ||
      lower.includes('mark as done')
    ) {
      const queryTitle = lower
        .replace(/^(complete|finish|done with|mark)\s+(task|todo)?/i, '')
        .replace(/\s+(as\s+done|completed)$/i, '')
        .trim();

      const target = todos.find((t) =>
        !t.completed &&
        (queryTitle ? t.title.toLowerCase().includes(queryTitle) : true)
      );

      if (target) {
        target.completed = true;
        target.status = 'complete';
        Storage.setTodos(todos);
        broadcastDataChanged('todos');

        memory.lastAction = {
          type: 'complete_task',
          entity: 'task',
          description: `Completed task "${target.title}"`,
          timestamp: Date.now(),
        };

        return {
          reply: `Marked task **"${target.title}"** as completed! 🎯`,
          module: 'tasks',
          actionChips: [`✓ Completed`, target.title],
          executedActions: [
            {
              type: 'complete_task',
              targetId: target.id,
              params: { id: target.id, title: target.title },
              description: `Completed task: ${target.title}`,
            },
          ],
          updatedSessionMemory: memory,
        };
      } else {
        return {
          reply: `Couldn't find an open task matching "${queryTitle}". Use **"Show my tasks"** to see open items.`,
          module: 'tasks',
          actionChips: ['Show my tasks'],
          updatedSessionMemory: memory,
        };
      }
    }

    // 3. Create Task
    const createMatch = text.match(/(?:add|create|new)?\s*(?:task|todo)\s*[:-]?\s*(.+)/i);
    if (createMatch) {
      const rawTitle = createMatch[1].trim();
      let priority: Priority = 'medium';
      let title = rawTitle;

      if (/high\s+priority/i.test(rawTitle)) {
        priority = 'high';
        title = rawTitle.replace(/high\s+priority/i, '').trim();
      } else if (/low\s+priority/i.test(rawTitle)) {
        priority = 'low';
        title = rawTitle.replace(/low\s+priority/i, '').trim();
      }

      const newTodo: TodoItem = {
        id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        completed: false,
        status: 'todo',
        priority,
        category: 'General',
        createdAt: Date.now(),
        dueDate: new Date().toISOString().split('T')[0],
      };

      const updated = [newTodo, ...todos];
      Storage.setTodos(updated);
      broadcastDataChanged('todos');

      memory.lastTask = {
        id: newTodo.id,
        title: newTodo.title,
      };
      memory.lastAction = {
        type: 'create_task',
        entity: 'task',
        description: `Created task "${title}"`,
        timestamp: Date.now(),
      };

      return {
        reply: `Added task **"${title}"** with priority **${priority}**.`,
        module: 'tasks',
        actionChips: [`✓ Created task`, `Priority: ${priority}`],
        executedActions: [
          {
            type: 'add_task',
            targetId: newTodo.id,
            params: { title, priority },
            description: `Created task ${title}`,
          },
        ],
        updatedSessionMemory: memory,
      };
    }

    return null;
  }
}
