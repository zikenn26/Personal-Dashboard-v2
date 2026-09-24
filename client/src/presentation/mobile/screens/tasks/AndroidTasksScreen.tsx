import React, { useState, useMemo } from 'react';
import { CheckSquare, Plus, Check, Trash2, Filter, Calendar, Tag, AlertCircle, Sparkles } from 'lucide-react';
import { TodoItem, Priority, TaskStatus } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES } from '../../design-system/materialYou';
import { SwipeActionRow } from '../../gestures/SwipeActionRow';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { QuickTaskSheet } from '../../components/QuickTaskSheet';

export interface AndroidTasksScreenProps {
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onClearCompleted?: () => void;
}

type FilterTab = 'all' | 'pending' | 'urgent' | 'completed';

export const AndroidTasksScreen: React.FC<AndroidTasksScreenProps> = ({
  todos,
  onToggleTodo,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onClearCompleted,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [confirmCompleteTodo, setConfirmCompleteTodo] = useState<TodoItem | null>(null);
  const [confirmDeleteTodo, setConfirmDeleteTodo] = useState<TodoItem | null>(null);
  const [activeActionTodo, setActiveActionTodo] = useState<TodoItem | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['all', ...Array.from(set)];
  }, [todos]);

  // Filtered tasks
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      // Tab filter
      if (filterTab === 'pending' && (t.completed || t.status === 'complete')) return false;
      if (filterTab === 'urgent' && t.priority !== 'urgent' && t.priority !== 'high') return false;
      if (filterTab === 'completed' && !t.completed && t.status !== 'complete') return false;

      // Category filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      return true;
    });
  }, [todos, filterTab, selectedCategory]);

  const handleToggle = (id: string) => {
    void nativeService.triggerHaptic('success');
    onToggleTodo(id);
  };

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteTodo) onDeleteTodo(id);
  };

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

  const actionItems: ActionSheetItem[] = activeActionTodo
    ? [
        {
          label: 'Edit Task Details',
          icon: <CheckSquare className="w-4 h-4" />,
          onClick: () => {
            setEditingTodo(activeActionTodo);
          },
        },
        {
          label: activeActionTodo.completed ? 'Mark as Incomplete' : 'Mark as Complete',
          icon: <Check className="w-4 h-4" />,
          onClick: () => {
            setConfirmCompleteTodo(activeActionTodo);
          },
        },
        {
          label: 'Set as Urgent Priority',
          icon: <AlertCircle className="w-4 h-4" />,
          onClick: () => {
            if (onUpdateTodo) onUpdateTodo(activeActionTodo.id, { priority: 'urgent' });
          },
        },
        {
          label: 'Set as High Priority',
          icon: <AlertCircle className="w-4 h-4" />,
          onClick: () => {
            if (onUpdateTodo) onUpdateTodo(activeActionTodo.id, { priority: 'high' });
          },
        },
        {
          label: 'Delete Task',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => {
            setConfirmDeleteTodo(activeActionTodo);
          },
        },
      ]
    : [];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-1 space-y-2.5">
      {/* Page Title Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Tasks & To-Dos
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {todos.filter((t) => !t.completed).length} pending · {todos.filter((t) => t.completed).length} completed
          </p>
        </div>

        {onClearCompleted && todos.some((t) => t.completed) && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('warning');
              onClearCompleted();
            }}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Clear Done
          </button>
        )}
      </div>

      {/* Primary Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] select-none">
        {(['pending', 'urgent', 'all', 'completed'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setFilterTab(tab);
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              filterTab === tab
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Category Chips Scroll */}
      {categories.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700'
                  : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {filteredTodos.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <CheckSquare className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No tasks found
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {filterTab === 'completed'
                ? 'No completed tasks yet.'
                : 'You have no tasks in this view. Tap below to create one!'}
            </p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <TaskItemRow
              key={todo.id}
              todo={todo}
              onTap={() => {
                void nativeService.triggerHaptic('selection');
                setEditingTodo(todo);
              }}
              onSwipeComplete={() => {
                setConfirmCompleteTodo(todo);
              }}
              onSwipeDelete={() => {
                setConfirmDeleteTodo(todo);
              }}
              onLongPress={() => setActiveActionTodo(todo)}
              priorityBadge={getPriorityBadge(todo.priority)}
            />
          ))
        )}
      </div>

      {/* Floating Add Task Button */}
      {onAddTodo && (
        <button
          type="button"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            setIsAddSheetOpen(true);
          }}
          className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md shadow-violet-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Task</span>
        </button>
      )}

      {/* Quick Task Add Sheet */}
      {onAddTodo && (
        <QuickTaskSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddTodo={onAddTodo}
        />
      )}

      {/* Edit Task Sheet */}
      <QuickTaskSheet
        isOpen={Boolean(editingTodo)}
        onClose={() => setEditingTodo(null)}
        initialTodo={editingTodo}
        onUpdateTodo={onUpdateTodo}
        onDeleteTodo={(id) => {
          handleDelete(id);
          setEditingTodo(null);
        }}
      />

      {/* Safe Swipe Complete Confirmation Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(confirmCompleteTodo)}
        onClose={() => setConfirmCompleteTodo(null)}
        title={confirmCompleteTodo?.completed ? 'Mark Task Incomplete?' : 'Mark Task Complete?'}
        subtitle={confirmCompleteTodo ? `"${confirmCompleteTodo.title}"` : undefined}
        actions={
          confirmCompleteTodo
            ? [
                {
                  label: confirmCompleteTodo.completed ? 'Mark Incomplete' : 'Complete Task',
                  icon: <Check className="w-4 h-4" />,
                  onClick: () => {
                    handleToggle(confirmCompleteTodo.id);
                    setConfirmCompleteTodo(null);
                  },
                },
              ]
            : []
        }
      />

      {/* Safe Swipe Delete Confirmation Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(confirmDeleteTodo)}
        onClose={() => setConfirmDeleteTodo(null)}
        title="Delete Task?"
        subtitle={confirmDeleteTodo ? `Are you sure you want to delete "${confirmDeleteTodo.title}"?` : undefined}
        actions={
          confirmDeleteTodo
            ? [
                {
                  label: 'Delete Task',
                  icon: <Trash2 className="w-4 h-4" />,
                  isDestructive: true,
                  onClick: () => {
                    handleDelete(confirmDeleteTodo.id);
                    setConfirmDeleteTodo(null);
                  },
                },
              ]
            : []
        }
      />

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
  onTap: () => void;
  onSwipeComplete: () => void;
  onSwipeDelete: () => void;
  onLongPress: () => void;
  priorityBadge: React.ReactNode;
}

const TaskItemRow: React.FC<TaskItemRowProps> = ({
  todo,
  onTap,
  onSwipeComplete,
  onSwipeDelete,
  onLongPress,
  priorityBadge,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  return (
    <SwipeActionRow
      onSwipeRight={onSwipeComplete}
      onSwipeLeft={onSwipeDelete}
      leftActionContent={<Check className="w-5 h-5" />}
      rightActionContent={<Trash2 className="w-5 h-5" />}
      leftActionColor="bg-emerald-600"
      rightActionColor="bg-rose-600"
    >
      <div
        {...longPressProps}
        onClick={onTap}
        className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all cursor-pointer select-none shadow-2xs hover:border-violet-300 dark:hover:border-violet-800"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          {/* Circular status indicator matching Reference Screen B */}
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
              todo.completed
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-violet-500'
            }`}
          >
            {todo.completed && <Check className="w-3 h-3 text-white stroke-[3]" />}
          </div>

          <div className="min-w-0 flex-1">
            <span
              className={`text-xs font-semibold block truncate ${
                todo.completed
                  ? 'line-through text-gray-400 dark:text-gray-500'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {todo.title}
            </span>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              {todo.category && <span>{todo.category}</span>}
              {todo.dueDate && (
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" />
                  {todo.dueDate}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {priorityBadge}
        </div>
      </div>
    </SwipeActionRow>
  );
};
