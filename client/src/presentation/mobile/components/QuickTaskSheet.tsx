import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { Priority, TaskStatus, TodoItem } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { Plus, CheckSquare, Calendar, Tag, Trash2, CheckCircle2 } from 'lucide-react';

export interface QuickTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialTodo?: TodoItem | null;
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
}

export const QuickTaskSheet: React.FC<QuickTaskSheetProps> = ({
  isOpen,
  onClose,
  initialTodo,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
}) => {
  const isEditing = Boolean(initialTodo);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('Personal');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<TaskStatus>('todo');

  useEffect(() => {
    if (initialTodo) {
      setTitle(initialTodo.title || '');
      setPriority(initialTodo.priority || 'medium');
      setCategory(initialTodo.category || 'Personal');
      setDueDate(initialTodo.dueDate || new Date().toISOString().split('T')[0]);
      setStatus(initialTodo.status || (initialTodo.completed ? 'complete' : 'todo'));
    } else {
      setTitle('');
      setPriority('medium');
      setCategory('Personal');
      setDueDate(new Date().toISOString().split('T')[0]);
      setStatus('todo');
    }
  }, [initialTodo, isOpen]);

  const priorities: { id: Priority; label: string; color: string }[] = [
    { id: 'low', label: 'Low', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    { id: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    { id: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
    { id: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  ];

  const categories = ['Personal', 'Work', 'Study', 'Fitness', 'Home', 'Finance'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    if (isEditing && initialTodo && onUpdateTodo) {
      void nativeService.triggerHaptic('success');
      onUpdateTodo(initialTodo.id, {
        title: cleanTitle,
        priority,
        category,
        dueDate,
        status,
        completed: status === 'complete',
      });
      onClose();
    } else if (onAddTodo) {
      void nativeService.triggerHaptic('success');
      onAddTodo(cleanTitle, priority, category, dueDate, 'todo');
      setTitle('');
      onClose();
    }
  };

  const handleDelete = () => {
    if (!initialTodo || !onDeleteTodo) return;
    void nativeService.triggerHaptic('warning');
    onDeleteTodo(initialTodo.id);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Task Details & Edit' : 'Add New Task'}
      subtitle={isEditing ? 'View and update this task' : 'Create a quick to-do item'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Title Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            What needs to be done?
          </label>
          <div className="relative">
            <CheckSquare className="w-4 h-4 text-violet-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              required
              autoFocus={!isEditing}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review project proposal"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Priority Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Priority Level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {priorities.map((p) => {
              const isSelected = priority === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setPriority(p.id);
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                    isSelected
                      ? `${p.color} ring-2 ring-violet-500 shadow-xs`
                      : 'bg-gray-50 dark:bg-[#1A2234] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category & Due Date Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Due Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Status Row if Editing */}
        {isEditing && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['todo', 'in_progress', 'complete'] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setStatus(s);
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer text-center ${
                    status === s
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-gray-50 dark:bg-[#1A2234] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {s === 'complete' ? 'Completed' : s === 'in_progress' ? 'In Progress' : 'To Do'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-2 space-y-2">
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full py-3 px-4 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            {isEditing ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </>
            )}
          </button>

          {isEditing && onDeleteTodo && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full py-2.5 px-4 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Task</span>
            </button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
};
