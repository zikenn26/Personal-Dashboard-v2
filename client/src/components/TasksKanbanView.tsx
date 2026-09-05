import React, { useState } from 'react';
import { TodoItem, Priority, TaskStatus } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  Calendar,
  Filter,
  ArrowUpDown,
  Search,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Sparkles,
  User,
  MoreHorizontal,
  Flame,
  Check,
  Flag,
  AlertCircle,
  X,
  GripVertical,
} from 'lucide-react';

interface TasksKanbanViewProps {
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  onAddTodo: (
    title: string,
    priority: Priority,
    category: string,
    dueDate?: string,
    status?: TaskStatus
  ) => void;
  onUpdateTodo?: (id: string, updatedFields: Partial<TodoItem>) => void;
  onUpdateStatus?: (id: string, newStatus: TaskStatus) => void;
  onDeleteTodo: (id: string) => void;
  onClearCompleted: () => void;
  soundEnabled: boolean;
}

const STATUS_COLUMNS: {
  id: TaskStatus;
  label: string;
  dotColor: string;
  bgLight: string;
  bgDark: string;
  badgeBg: string;
  borderActive: string;
}[] = [
  {
    id: 'todo',
    label: 'To-do',
    dotColor: 'bg-purple-500',
    bgLight: 'bg-purple-50/40',
    bgDark: 'dark:bg-purple-950/20',
    badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
    borderActive: 'border-purple-400 bg-purple-50/30 dark:bg-purple-950/40',
  },
  {
    id: 'in_progress',
    label: 'In progress',
    dotColor: 'bg-amber-500',
    bgLight: 'bg-amber-50/40',
    bgDark: 'dark:bg-amber-950/20',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
    borderActive: 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/40',
  },
  {
    id: 'complete',
    label: 'Complete',
    dotColor: 'bg-emerald-500',
    bgLight: 'bg-emerald-50/40',
    bgDark: 'dark:bg-emerald-950/20',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    borderActive: 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/40',
  },
];

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; textClass: string; bgClass: string; borderClass: string; icon: string }
> = {
  low: {
    label: 'Low',
    textClass: 'text-blue-700 dark:text-blue-300',
    bgClass: 'bg-blue-50 dark:bg-blue-950/60',
    borderClass: 'border-blue-200 dark:border-blue-800',
    icon: '●',
  },
  medium: {
    label: 'Medium',
    textClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-950/60',
    borderClass: 'border-amber-200 dark:border-amber-800',
    icon: '●',
  },
  high: {
    label: 'High',
    textClass: 'text-rose-700 dark:text-rose-300',
    bgClass: 'bg-rose-50 dark:bg-rose-950/60',
    borderClass: 'border-rose-200 dark:border-rose-800',
    icon: '▲',
  },
  urgent: {
    label: 'Urgent',
    textClass: 'text-purple-700 dark:text-purple-300',
    bgClass: 'bg-purple-50 dark:bg-purple-950/60',
    borderClass: 'border-purple-200 dark:border-purple-800',
    icon: '⚡',
  },
};

export const TasksKanbanView: React.FC<TasksKanbanViewProps> = ({
  todos,
  onToggleTodo,
  onAddTodo,
  onUpdateTodo,
  onUpdateStatus,
  onDeleteTodo,
  onClearCompleted,
  soundEnabled,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modal State for Adding / Editing Task with Date & Priority
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalPriority, setModalPriority] = useState<Priority>('medium');
  const [modalCategory, setModalCategory] = useState('Personal');
  const [modalDueDate, setModalDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [modalStatus, setModalStatus] = useState<TaskStatus>('todo');

  // Inline Quick Add state per column
  const [activeColumnInput, setActiveColumnInput] = useState<TaskStatus | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [inlinePriority, setInlinePriority] = useState<Priority>('medium');
  const [inlineDueDate, setInlineDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Normalize task status helper
  const getTaskStatus = (todo: TodoItem): TaskStatus => {
    if (todo.status) {
      if (todo.status === 'in_review') return 'in_progress';
      return todo.status;
    }
    return todo.completed ? 'complete' : 'todo';
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      handleMoveTaskToStatus(taskId, targetStatus);
    }
    setDragOverColumn(null);
    setDraggedTaskId(null);
  };

  const handleMoveTaskToStatus = (taskId: string, targetStatus: TaskStatus) => {
    const task = todos.find((t) => t.id === taskId);
    if (!task) return;
    const currentStatus = getTaskStatus(task);
    if (currentStatus === targetStatus) return;

    if (targetStatus === 'complete') {
      triggerConfetti();
      Sound.success(soundEnabled);
    } else {
      Sound.click(soundEnabled);
    }

    if (onUpdateStatus) {
      onUpdateStatus(taskId, targetStatus);
    } else {
      if (targetStatus === 'complete' && !task.completed) onToggleTodo(taskId);
      if (targetStatus !== 'complete' && task.completed) onToggleTodo(taskId);
    }
  };

  // Advance Status via arrows
  const handleAdvanceStatus = (todo: TodoItem, direction: 'next' | 'prev') => {
    const current = getTaskStatus(todo);
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'complete'];
    const idx = statuses.indexOf(current);
    let newIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= statuses.length) newIdx = statuses.length - 1;

    handleMoveTaskToStatus(todo.id, statuses[newIdx]);
  };

  // Open Add Modal
  const openNewTaskModal = (initialStatus: TaskStatus = 'todo') => {
    Sound.click(soundEnabled);
    setEditingTaskId(null);
    setModalTitle('');
    setModalPriority('medium');
    setModalCategory('Personal');
    setModalDueDate(new Date().toISOString().split('T')[0]);
    setModalStatus(initialStatus);
    setIsModalOpen(true);
  };

  // Open Edit Modal for pre-existing task
  const openEditTaskModal = (task: TodoItem) => {
    Sound.click(soundEnabled);
    setEditingTaskId(task.id);
    setModalTitle(task.title);
    setModalPriority(task.priority || 'medium');
    setModalCategory(task.category || 'Personal');
    setModalDueDate(task.dueDate || new Date().toISOString().split('T')[0]);
    setModalStatus(getTaskStatus(task));
    setIsModalOpen(true);
  };

  // Handle Modal Submit (Add or Edit)
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    Sound.success(soundEnabled);

    if (editingTaskId) {
      if (onUpdateTodo) {
        onUpdateTodo(editingTaskId, {
          title: modalTitle.trim(),
          priority: modalPriority,
          category: modalCategory.trim() || 'General',
          dueDate: modalDueDate || undefined,
          status: modalStatus,
          completed: modalStatus === 'complete',
        });
      } else if (onUpdateStatus) {
        onUpdateStatus(editingTaskId, modalStatus);
      }
      setIsModalOpen(false);
      setEditingTaskId(null);
      setModalTitle('');
      return;
    }

    onAddTodo(
      modalTitle.trim(),
      modalPriority,
      modalCategory.trim() || 'General',
      modalDueDate || undefined,
      modalStatus
    );

    setIsModalOpen(false);
    setModalTitle('');
  };

  // Handle Inline Add Submit
  const handleInlineAddSubmit = (status: TaskStatus) => {
    if (!inlineTaskTitle.trim()) {
      setActiveColumnInput(null);
      return;
    }
    Sound.success(soundEnabled);
    onAddTodo(
      inlineTaskTitle.trim(),
      inlinePriority,
      'General',
      inlineDueDate || undefined,
      status
    );
    setInlineTaskTitle('');
    setActiveColumnInput(null);
  };

  // Filter tasks based on searchQuery and priority
  const filteredTodos = todos.filter((todo) => {
    if (searchQuery.trim()) {
      const match =
        todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (todo.category && todo.category.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!match) return false;
    }
    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="space-y-3 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80 flex items-center justify-center text-2xl shadow-2xs text-sky-600">
              📋
            </div>
            <div>
              <h1 className="workspace-heading font-extrabold text-[#111827] dark:text-white tracking-tight">
                Tasks
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium mt-0.5">
                Kanban task manager with interactive drag & drop, priorities, and deadlines
              </p>
            </div>
          </div>

          {/* Primary New Task Button */}
          <button
            type="button"
            onClick={() => openNewTaskModal('todo')}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 text-white flex items-center gap-2 shadow-sm cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Action Tools & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        {/* Left: Task count indicator & Priority filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#111827] dark:text-white">All Tasks</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]">
              {filteredTodos.length}
            </span>
          </div>

          {/* Filter by Priority Pills */}
          <div className="flex items-center gap-1">
            {['all', 'urgent', 'high', 'medium', 'low'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPriority(p)}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                  filterPriority === p
                    ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="pl-8 pr-2.5 py-1 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1] w-36 sm:w-48"
            />
          </div>

          {/* Kanban / List Toggle */}
          <div className="flex items-center bg-[#F3F4F6] dark:bg-[#1F2937] p-0.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151]">
            <button
              onClick={() => {
                Sound.click(soundEnabled);
                setViewMode('kanban');
              }}
              className={`p-1 rounded-md cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#111827] shadow-2xs text-[#111827] dark:text-white'
                  : 'text-[#9CA3AF]'
              }`}
              title="Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                Sound.click(soundEnabled);
                setViewMode('list');
              }}
              className={`p-1 rounded-md cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#111827] shadow-2xs text-[#111827] dark:text-white'
                  : 'text-[#9CA3AF]'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3-COLUMN KANBAN BOARD WITH DRAG & DROP */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filteredTodos.filter((t) => getTaskStatus(t) === col.id);
            const isDragOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`rounded-2xl border transition-all p-3 space-y-3 min-h-[460px] flex flex-col justify-between ${
                  isDragOver
                    ? col.borderActive + ' border-2 shadow-md'
                    : 'border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB]/70 dark:bg-[#111827]/40'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <span className="text-xs font-bold text-[#111827] dark:text-white">
                        {col.label}
                      </span>
                      <span className="text-[11px] font-mono text-[#9CA3AF] font-semibold ml-1">
                        {colTasks.length}
                      </span>
                    </div>

                    <button
                      onClick={() => openNewTaskModal(col.id)}
                      className="p-1 rounded text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#374151] cursor-pointer"
                      title={`Add task in ${col.label}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inline Task Quick Input if active */}
                  {activeColumnInput === col.id && (
                    <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#6366F1] shadow-md space-y-2.5 animate-in fade-in-50">
                      <input
                        type="text"
                        value={inlineTaskTitle}
                        onChange={(e) => setInlineTaskTitle(e.target.value)}
                        placeholder="Task name..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineAddSubmit(col.id);
                          if (e.key === 'Escape') setActiveColumnInput(null);
                        }}
                        className="w-full text-xs bg-transparent text-[#111827] dark:text-white focus:outline-none placeholder:text-[#9CA3AF]"
                      />

                      {/* Priority selector row in inline add */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1">
                          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => {
                            const cfg = PRIORITY_CONFIG[p];
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setInlinePriority(p)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                  inlinePriority === p
                                    ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>

                        <input
                          type="date"
                          value={inlineDueDate}
                          onChange={(e) => setInlineDueDate(e.target.value)}
                          className="text-[10px] bg-transparent text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveColumnInput(null)}
                          className="px-2 py-1 text-[10px] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInlineAddSubmit(col.id)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-[#2563EB] text-white rounded cursor-pointer"
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Task Card List */}
                  <div className="space-y-2">
                    {colTasks.length === 0 && activeColumnInput !== col.id && (
                      <div className="py-10 text-center border-2 border-dashed border-[#E5E7EB] dark:border-[#1F2937] rounded-xl text-[11px] text-[#9CA3AF]">
                        Drop tasks here or click + to add
                      </div>
                    )}

                    {colTasks.map((task) => {
                      const priority = (task.priority || 'medium') as Priority;
                      const priorityCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
                      const isDragging = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className={`p-3 rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] hover:border-[#D1D5DB] dark:hover:border-[#4B5563] shadow-2xs hover:shadow-xs transition-all space-y-2 group cursor-grab active:cursor-grabbing ${
                            isDragging ? 'opacity-40 scale-95 border-dashed border-[#6366F1]' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <p
                                className={`text-xs font-semibold text-[#111827] dark:text-white leading-snug break-words ${
                                  task.completed || col.id === 'complete'
                                    ? 'line-through text-[#9CA3AF] dark:text-[#6B7280]'
                                    : ''
                                }`}
                              >
                                {task.title}
                              </p>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTaskModal(task);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-all cursor-pointer"
                                title="Edit Task"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  Sound.click(soundEnabled);
                                  onDeleteTodo(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-all cursor-pointer"
                                title="Delete Task"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Badges & Meta: Priority (in color) and Date */}
                          <div className="flex items-center justify-between pt-1 text-[10px] text-[#9CA3AF]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Color-coded Priority Badge */}
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[9px] border flex items-center gap-1 ${priorityCfg.bgClass} ${priorityCfg.textClass} ${priorityCfg.borderClass}`}
                              >
                                <span>{priorityCfg.icon}</span>
                                <span className="capitalize">{priorityCfg.label}</span>
                              </span>

                              {/* Due Date Badge */}
                              {task.dueDate && (
                                <span className="flex items-center gap-1 text-[9px] font-semibold text-[#6B7280] dark:text-[#9CA3AF] bg-[#F3F4F6] dark:bg-[#1F2937] px-1.5 py-0.5 rounded-md border border-[#E5E7EB] dark:border-[#374151]">
                                  <Calendar className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>{task.dueDate}</span>
                                </span>
                              )}

                              {task.category && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#F9FAFB] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] border border-gray-100 dark:border-gray-800">
                                  {task.category}
                                </span>
                              )}
                            </div>

                            {/* Quick Advance / Move fallback controls */}
                            <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                              {col.id !== 'todo' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(task, 'prev')}
                                  className="p-0.5 hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded text-[#6B7280] dark:text-[#9CA3AF] cursor-pointer"
                                  title="Move Left"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              )}
                              {col.id !== 'complete' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatus(task, 'next')}
                                  className="p-0.5 hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded text-[#6B7280] dark:text-[#9CA3AF] cursor-pointer"
                                  title="Move Right"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom + New Task button */}
                <button
                  type="button"
                  onClick={() => openNewTaskModal(col.id)}
                  className="w-full py-1.5 text-xs text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white flex items-center justify-center gap-1 rounded-xl hover:bg-[#E5E7EB]/60 dark:hover:bg-[#1F2937] transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New page / task</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table Mode */
        <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] overflow-hidden shadow-2xs">
          <div className="divide-y divide-[#F3F4F6] dark:divide-[#1F2937]">
            {filteredTodos.map((todo) => {
              const priority = (todo.priority || 'medium') as Priority;
              const priorityCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;

              return (
                <div
                  key={todo.id}
                  className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937]/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => {
                        Sound.click(soundEnabled);
                        onToggleTodo(todo.id);
                      }}
                      className="shrink-0 text-[#9CA3AF] hover:text-[#6366F1] cursor-pointer"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <span
                        className={`text-xs font-semibold text-[#111827] dark:text-white truncate block ${
                          todo.completed ? 'line-through text-[#9CA3AF]' : ''
                        }`}
                      >
                        {todo.title}
                      </span>
                      {todo.dueDate && (
                        <span className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{todo.dueDate}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${priorityCfg.bgClass} ${priorityCfg.textClass} ${priorityCfg.borderClass}`}
                    >
                      {priorityCfg.label}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF]">
                      {getTaskStatus(todo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditTaskModal(todo)}
                      className="p-1.5 text-[#9CA3AF] hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg cursor-pointer transition-colors"
                      title="Edit task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        Sound.click(soundEnabled);
                        onDeleteTodo(todo.id);
                      }}
                      className="p-1.5 text-[#9CA3AF] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT TASK WITH DATE & COLOR PRIORITY */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#1A202C] rounded-2xl border border-[#E5E7EB] dark:border-[#2D3748] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600">
                  {editingTaskId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">
                    {editingTaskId ? 'Edit Task' : 'Create New Task'}
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                    {editingTaskId
                      ? 'Update task details, priority, and deadline'
                      : 'Configure task details, priority, and deadline'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#37352F] dark:text-[#E2E8F0]">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g., Finalize architecture review and push deploy"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Priority Selector (Color Coded: Low, Medium, High, Urgent) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#37352F] dark:text-[#E2E8F0] flex items-center justify-between">
                  <span>Priority (Color Coded)</span>
                  <span className="text-[10px] font-normal text-gray-400">Select urgency</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const isSelected = modalPriority === p;

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          setModalPriority(p);
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ring-2 ring-blue-500 shadow-xs scale-102`
                            : 'bg-white dark:bg-[#0F172A] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-sm">{cfg.icon}</span>
                        <span className="text-[11px] capitalize">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due Date & Column Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#37352F] dark:text-[#E2E8F0] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    <span>Due Date</span>
                  </label>
                  <input
                    type="date"
                    value={modalDueDate}
                    onChange={(e) => setModalDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Status Column */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#37352F] dark:text-[#E2E8F0]">
                    Kanban Column
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="todo">To-do</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#37352F] dark:text-[#E2E8F0]">
                  Category / Tag
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['Personal', 'Work', 'Tech', 'Study', 'Life OS'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setModalCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        modalCategory === cat
                          ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 text-white shadow-sm transition-all cursor-pointer"
                >
                  {editingTaskId ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
