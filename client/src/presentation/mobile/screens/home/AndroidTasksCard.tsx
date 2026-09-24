import React, { useState } from 'react';
import { CheckSquare, CheckCircle2, ArrowRight, Plus, Check, Trash2, Edit3 } from 'lucide-react';
import { TodoItem, Priority } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES, CARD_HEADER_CLASSES, CARD_TITLE_CLASSES, CARD_BODY_CLASSES } from '../../design-system/materialYou';
import { SwipeActionRow } from '../../gestures/SwipeActionRow';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';

export interface AndroidTasksCardProps {
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  onDeleteTodo?: (id: string) => void;
  onNavigateToTasks: () => void;
  onOpenAddTask: () => void;
}

export const AndroidTasksCard: React.FC<AndroidTasksCardProps> = ({
  todos,
  onToggleTodo,
  onDeleteTodo,
  onNavigateToTasks,
  onOpenAddTask,
}) => {
  // Pending tasks first, then recently completed
  const pendingTodos = todos.filter((t) => !t.completed && t.status !== 'complete');
  const displayTodos = pendingTodos.slice(0, 4);

  const [activeActionTodo, setActiveActionTodo] = useState<TodoItem | null>(null);

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">
            URGENT
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300">
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
            MEDIUM
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
            LOW
          </span>
        );
    }
  };

  const handleToggle = (id: string) => {
    void nativeService.triggerHaptic('success');
    onToggleTodo(id);
  };

  const actionItems: ActionSheetItem[] = activeActionTodo
    ? [
        {
          label: activeActionTodo.completed ? 'Mark as Pending' : 'Mark as Complete',
          icon: <Check className="w-4 h-4" />,
          onClick: () => handleToggle(activeActionTodo.id),
        },
        {
          label: 'View All Tasks',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: onNavigateToTasks,
        },
        {
          label: 'Delete Task',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => {
            if (onDeleteTodo) onDeleteTodo(activeActionTodo.id);
          },
        },
      ]
    : [];

  return (
    <div className={CARD_SURFACE_CLASSES}>
      {/* Header */}
      <div className={CARD_HEADER_CLASSES}>
        <div className={CARD_TITLE_CLASSES}>
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <CheckSquare className="w-4 h-4" />
          </div>
          <span>Today&apos;s Tasks</span>
          {pendingTodos.length > 0 && (
            <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
              {pendingTodos.length}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            onNavigateToTasks();
          }}
          className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className={CARD_BODY_CLASSES}>
        {displayTodos.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              All caught up! 🎉
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              No pending tasks for today. Tap below to add one.
            </p>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                onOpenAddTask();
              }}
              className="mt-3 px-4 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-600 dark:text-violet-300 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a task</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTodos.map((todo) => (
              <TaskItemRow
                key={todo.id}
                todo={todo}
                onToggle={() => handleToggle(todo.id)}
                onDelete={() => {
                  if (onDeleteTodo) {
                    void nativeService.triggerHaptic('warning');
                    onDeleteTodo(todo.id);
                  }
                }}
                onLongPress={() => setActiveActionTodo(todo)}
                priorityBadge={getPriorityBadge(todo.priority)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Long-press Contextual Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionTodo)}
        onClose={() => setActiveActionTodo(null)}
        title={activeActionTodo?.title || 'Task Options'}
        subtitle={`Priority: ${activeActionTodo?.priority.toUpperCase()} · Category: ${activeActionTodo?.category || 'General'}`}
        actions={actionItems}
      />
    </div>
  );
};

interface TaskItemRowProps {
  todo: TodoItem;
  onToggle: () => void;
  onDelete: () => void;
  onLongPress: () => void;
  priorityBadge: React.ReactNode;
}

const TaskItemRow: React.FC<TaskItemRowProps> = ({
  todo,
  onToggle,
  onDelete,
  onLongPress,
  priorityBadge,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  return (
    <SwipeActionRow
      onSwipeRight={onToggle}
      onSwipeLeft={onDelete}
      leftActionContent={<Check className="w-5 h-5" />}
      rightActionContent={<Trash2 className="w-5 h-5" />}
      leftActionColor="bg-emerald-600"
      rightActionColor="bg-rose-600"
    >
      <div
        {...longPressProps}
        onClick={onToggle}
        className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          {/* Circular checkbox matching Reference Screen B */}
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
              todo.completed
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-violet-500'
            }`}
          >
            {todo.completed && <Check className="w-3 h-3 text-white stroke-[3]" />}
          </div>

          <span
            className={`text-xs font-semibold truncate ${
              todo.completed
                ? 'line-through text-gray-400 dark:text-gray-500'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {todo.title}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {priorityBadge}
        </div>
      </div>
    </SwipeActionRow>
  );
};
