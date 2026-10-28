import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { TodoItem, Priority } from '../../../types';
import { broadcastDataChanged } from '../../commandMappingService';
import { InteractiveOption } from '../../commandIntentEngine';

export class TasksAdapter implements ModuleAdapter {
  name = 'tasks';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    if (
      text.includes('task') ||
      text.includes('todo') ||
      text.includes('to-do') ||
      /^(add|create|new)\s+(task|todo|a\s+task)/i.test(text) ||
      /^(complete|finish|done with)\s+(my\s+)?(first\s+)?task/i.test(text) ||
      /^(delete|remove)\s+(the\s+)?(.+)\s+task/i.test(text) ||
      /^(delete|remove)\s+task/i.test(text) ||
      text === 'my tasks' ||
      text === "today's tasks" ||
      text === 'show tasks' ||
      text === 'pending tasks' ||
      text.includes('overdue')
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
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // ------------------------------------------------------------------------
    // 1. AMBIGUITY HANDLING: Missing Task Title
    // e.g. "Add a task", "Create task", "New todo"
    // ------------------------------------------------------------------------
    if (/^(?:add|create|new)\s+(?:a\s+)?(?:task|todo|to-do)$/i.test(lower)) {
      return {
        reply: `What task would you like to add? Please specify a title (e.g., *"Add a task to study polity tomorrow"*).`,
        module: 'tasks',
        actionChips: ['Study polity', 'Review budget', 'Call plumber'],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 2. DESTRUCTIVE DELETION CONFIRMATION: "Delete the XYZ task", "Delete task [title]"
    // ------------------------------------------------------------------------
    if (lower.startsWith('delete') || lower.startsWith('remove')) {
      const cancelOption: InteractiveOption = {
        id: `cancel-del-task-${Date.now()}`,
        label: '✕ Cancel',
        variant: 'cancel',
        actions: [],
      };

      const taskNameMatch = text.match(/(?:delete|remove)\s+(?:the\s+)?(.+?)(?:\s+task)?$/i);
      const queryTitle = taskNameMatch
        ? taskNameMatch[1].replace(/\btask\b/i, '').trim().toLowerCase()
        : '';

      const target = todos.find((t) =>
        queryTitle ? t.title.toLowerCase().includes(queryTitle) : true
      );

      if (target) {
        const deleteOption: InteractiveOption = {
          id: `confirm-del-task-${target.id}`,
          label: `🗑️ Delete "${target.title}"`,
          variant: 'danger',
          isDestructive: true,
          actions: [
            {
              type: 'delete_task',
              targetId: target.id,
              params: { id: target.id },
              description: `Delete task "${target.title}"`,
              isDestructive: true,
            },
          ],
        };

        return {
          reply: `Delete this task?\n\n• **${target.title}** (Priority: ${target.priority || 'medium'})\n• Due: ${target.dueDate || 'No date'}`,
          module: 'tasks',
          actionChips: ['Confirmation required'],
          options: [cancelOption, deleteOption],
          pendingConfirmation: true,
          updatedSessionMemory: memory,
        };
      }
    }

    // ------------------------------------------------------------------------
    // 3. READ-ONLY: Overdue Tasks Query
    // e.g. "What tasks are overdue?", "Show overdue tasks"
    // ------------------------------------------------------------------------
    if (lower.includes('overdue')) {
      const overdue = todos.filter((t) => !t.completed && t.dueDate && t.dueDate < todayStr);
      if (overdue.length === 0) {
        return {
          reply: `You have **0 overdue tasks**! You're completely up to date 🚀.`,
          module: 'tasks',
          actionChips: ['0 overdue tasks', 'All caught up!'],
          updatedSessionMemory: memory,
        };
      }

      const listStr = overdue
        .slice(0, 5)
        .map((t) => `• [Due ${t.dueDate}] **${t.title}** (${t.priority || 'medium'})`)
        .join('\n');

      return {
        reply: `You have **${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}**:\n${listStr}`,
        module: 'tasks',
        actionChips: [`${overdue.length} overdue`, 'Tasks Module'],
        updatedSessionMemory: memory,
      };
    }

    // ------------------------------------------------------------------------
    // 4. READ-ONLY: Show / View Tasks
    // e.g. "Show my tasks", "Show today's tasks", "My tasks"
    // ------------------------------------------------------------------------
    if (
      lower.includes('show') ||
      lower.includes('view') ||
      lower.includes('list') ||
      lower.includes('pending') ||
      lower === 'my tasks' ||
      lower === "today's tasks" ||
      lower === 'what are my tasks?' ||
      lower === 'what are my tasks' ||
      lower.includes('tasks for today')
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

    // ------------------------------------------------------------------------
    // 5. WRITE: Complete Task
    // e.g. "Complete my first task", "Complete task [title]"
    // ------------------------------------------------------------------------
    if (
      lower.startsWith('complete') ||
      lower.startsWith('finish') ||
      lower.startsWith('done with') ||
      lower.includes('mark as done')
    ) {
      const isFirst = lower.includes('first');
      const queryTitle = lower
        .replace(/^(complete|finish|done with|mark)\s+(my\s+)?(first\s+)?(task|todo)?/i, '')
        .replace(/\s+(as\s+done|completed)$/i, '')
        .trim();

      const openTodos = todos.filter((t) => !t.completed);
      const target = isFirst
        ? openTodos[0]
        : todos.find((t) =>
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

    // ------------------------------------------------------------------------
    // 6. WRITE: Create Task
    // e.g. "Add a task to study polity tomorrow", "Add task Prepare report"
    // ------------------------------------------------------------------------
    const createMatch = text.match(/(?:add|create|new)?\s*(?:a\s+)?(?:task|todo)\s*(?:to\s+|[:-]\s*)?(.+)/i);
    if (createMatch) {
      let rawTitle = createMatch[1].trim();
      let priority: Priority = 'medium';
      let dueDate = todayStr;

      // Handle "tomorrow"
      if (/\btomorrow\b/i.test(rawTitle)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        dueDate = tomorrow.toISOString().split('T')[0];
        rawTitle = rawTitle.replace(/\btomorrow\b/i, '').trim();
      }

      if (/high\s+priority/i.test(rawTitle)) {
        priority = 'high';
        rawTitle = rawTitle.replace(/high\s+priority/i, '').trim();
      } else if (/low\s+priority/i.test(rawTitle)) {
        priority = 'low';
        rawTitle = rawTitle.replace(/low\s+priority/i, '').trim();
      }

      const title = rawTitle.replace(/^(to\s+|for\s+)/i, '').trim();
      if (!title) {
        return {
          reply: `What task would you like to add? Please specify a title (e.g., *"Add task Study polity tomorrow"*).`,
          module: 'tasks',
          actionChips: ['Study polity', 'Pay electric bill'],
          updatedSessionMemory: memory,
        };
      }

      const newTodo: TodoItem = {
        id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        completed: false,
        status: 'todo',
        priority,
        category: 'General',
        createdAt: Date.now(),
        dueDate,
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
        reply: `Added task **"${title}"** (Due: ${dueDate}, Priority: ${priority}).`,
        module: 'tasks',
        actionChips: [`✓ Created task`, `Due: ${dueDate}`],
        executedActions: [
          {
            type: 'add_task',
            targetId: newTodo.id,
            params: { title, priority, dueDate },
            description: `Created task ${title}`,
          },
        ],
        updatedSessionMemory: memory,
      };
    }

    return null;
  }
}
