import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Filter,
  Search,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { TodoItem, Priority } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';

interface TodoListProps {
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  onAddTodo: (title: string, priority: Priority, category: string, dueDate?: string) => void;
  onDeleteTodo: (id: string) => void;
  onClearCompleted: () => void;
  soundEnabled: boolean;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; bg: string; text: string; border: string }> = {
  urgent: { label: 'Urgent', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/60' },
  high: { label: 'High', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/60' },
  medium: { label: 'Medium', bg: 'bg-[#EEF2FF] dark:bg-[#1E1B4B]', text: 'text-[#6366F1] dark:text-[#818CF8]', border: 'border-[#E0E7FF] dark:border-[#3730A3]' },
  low: { label: 'Low', bg: 'bg-[#F3F4F6] dark:bg-[#1F2937]', text: 'text-[#6B7280] dark:text-[#9CA3AF]', border: 'border-[#E5E7EB] dark:border-[#374151]' },
};

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  onToggleTodo,
  onAddTodo,
  onDeleteTodo,
  onClearCompleted,
  soundEnabled,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newCategory, setNewCategory] = useState('General');
  const [newDueDate, setNewDueDate] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (filter === 'active' && t.completed) return false;
      if (filter === 'completed' && !t.completed) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [todos, filter, priorityFilter, searchQuery]);

  const handleToggle = (id: string, currentlyCompleted: boolean) => {
    Sound.toggle(soundEnabled);
    if (!currentlyCompleted) {
      Sound.success(soundEnabled);
      // If completing all or this one, trigger mini celebration
      const pendingCount = todos.filter((t) => !t.completed).length;
      if (pendingCount === 1) {
        triggerConfetti();
      }
    }
    onToggleTodo(id);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    Sound.success(soundEnabled);
    onAddTodo(newTitle.trim(), newPriority, newCategory.trim() || 'General', newDueDate || undefined);
    setNewTitle('');
    setNewDueDate('');
    setShowAddForm(false);
  };

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors notion-card">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8]">
            <CheckSquare className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#111827] dark:text-white">
              Action Items & Sprint Tasks
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
              {completedCount} of {todos.length} completed
            </p>
          </div>
        </div>

        <button
          id="btn-show-add-todo"
          onClick={() => {
            Sound.click(soundEnabled);
            setShowAddForm(!showAddForm);
          }}
          className="px-2.5 py-1 text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Quick Add Inline Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mb-4 p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] space-y-3"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task description..."
            autoFocus
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Priority)}
                className="w-full px-2 py-1.5 rounded-md text-xs bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#E5E7EB] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">Category</label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
                className="w-full px-2 py-1.5 rounded-md text-xs bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#E5E7EB] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-xs bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#E5E7EB] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2.5 py-1 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#E5E7EB] dark:hover:bg-[#374151] rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-3 py-1 text-xs font-semibold bg-[#6366F1] text-white rounded-md hover:bg-[#4F46E5] disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
            >
              Add Task
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1 bg-[#F9FAFB] dark:bg-[#1F2937] p-0.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                Sound.click(soundEnabled);
                setFilter(tab);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827] dark:text-[#9CA3AF] dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#E5E7EB] focus:outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Search box */}
          <div className="relative flex-1 sm:w-36">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-2 py-1 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
            />
          </div>
        </div>
      </div>

      {/* Todo Items List */}
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
        {filteredTodos.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#9CA3AF]">
            No matching tasks found. Press "+ New Task" or use Quick Capture.
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const pConfig = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;
            return (
              <div
                key={todo.id}
                className={`group flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-all ${
                  todo.completed
                    ? 'bg-[#F9FAFB]/50 dark:bg-[#1F2937]/30 border-[#E5E7EB]/60 dark:border-[#374151]/40 opacity-60'
                    : 'bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] hover:border-[#D1D5DB] dark:hover:border-[#374151] hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggle(todo.id, todo.completed)}
                    className="shrink-0 text-[#9CA3AF] hover:text-[#6366F1] dark:hover:text-[#818CF8] transition-colors cursor-pointer"
                  >
                    {todo.completed ? (
                      <CheckSquare className="w-4 h-4 text-[#6366F1] dark:text-[#818CF8]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium truncate ${
                        todo.completed
                          ? 'line-through text-[#9CA3AF]'
                          : 'text-[#111827] dark:text-[#E5E7EB]'
                      }`}
                    >
                      {todo.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#9CA3AF] mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Tag className="w-2.5 h-2.5" />
                        {todo.category}
                      </span>
                      {todo.dueDate && (
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-2.5 h-2.5" />
                          {todo.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Priority Tag */}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-md border uppercase font-mono tracking-wider ${pConfig.bg} ${pConfig.text} ${pConfig.border}`}
                  >
                    {pConfig.label}
                  </span>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onDeleteTodo(todo.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 transition-all cursor-pointer rounded-md hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      {completedCount > 0 && (
        <div className="mt-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937] flex justify-between items-center text-[10px] font-medium text-[#9CA3AF]">
          <span>{completedCount} completed items</span>
          <button
            onClick={() => {
              Sound.click(soundEnabled);
              onClearCompleted();
            }}
            className="text-[#6B7280] hover:text-rose-500 dark:text-[#9CA3AF] dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
};
