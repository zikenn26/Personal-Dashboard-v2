import React from 'react';
import { CheckSquare, CheckCircle2, Circle, ArrowRight, Plus } from 'lucide-react';
import { TodoItem, Priority } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES, CARD_HEADER_CLASSES, CARD_TITLE_CLASSES, CARD_BODY_CLASSES } from '../../design-system/materialYou';

export interface AndroidTasksCardProps {
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  onNavigateToTasks: () => void;
  onOpenAddTask: () => void;
}

export const AndroidTasksCard: React.FC<AndroidTasksCardProps> = ({
  todos,
  onToggleTodo,
  onNavigateToTasks,
  onOpenAddTask,
}) => {
  // Pending tasks first, then recently completed
  const pendingTodos = todos.filter((t) => !t.completed && t.status !== 'complete');
  const displayTodos = pendingTodos.slice(0, 4);

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300">Med</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">Low</span>;
    }
  };

  const handleToggle = (id: string) => {
    void nativeService.triggerHaptic('success');
    onToggleTodo(id);
  };

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
              <div
                key={todo.id}
                onClick={() => handleToggle(todo.id)}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(todo.id);
                    }}
                    className="text-gray-400 hover:text-violet-600 transition-colors shrink-0 cursor-pointer"
                    aria-label="Toggle complete"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-xs font-semibold block truncate leading-snug ${
                        todo.completed
                          ? 'line-through text-gray-400 dark:text-gray-500'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {todo.title}
                    </span>
                    {todo.category && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                        {todo.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">{getPriorityBadge(todo.priority)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
