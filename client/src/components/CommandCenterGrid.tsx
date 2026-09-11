import React from 'react';
import {
  TodoItem,
  HabitItem,
  ExpenseItem,
  WeeklyScheduleData,
  Priority,
  TaskStatus,
} from '../types';
import { Sound } from '../utils/audio';
import { IndianCalendarWidget } from './IndianCalendarWidget';
import { DynamicScheduleCard } from './DynamicScheduleCard';
import {
  CheckCircle2,
  Circle,
  Plus,
  Flame,
  CreditCard,
  CheckSquare,
  X,
  GripVertical,
  RotateCcw,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CommandCenterGridProps {
  gridOrder: string[];
  draggedWidgetId: string | null;
  dragOverWidgetId: string | null;
  isCustomizingGrid: boolean;
  isDefaultOrder: boolean;
  setDraggedWidgetId: (id: string | null) => void;
  setDragOverWidgetId: (id: string | null) => void;
  setIsCustomizingGrid: (val: boolean | ((prev: boolean) => boolean)) => void;
  handleDropWidget: (sourceId: string | null, targetId: string) => void;
  handleMoveWidget: (id: string, offset: number) => void;
  handleResetGridLayout: () => void;
  todos: TodoItem[];
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onToggleTodo: (id: string) => void;
  onNavigate: (view: any, filter?: string) => void;
  habits: HabitItem[];
  todayIndex: number;
  onToggleHabitDay: (id: string, dayIdx: number) => void;
  showQuickHabitInput: boolean;
  setShowQuickHabitInput: (val: boolean) => void;
  quickHabitTitle: string;
  setQuickHabitTitle: (val: string) => void;
  handleCreateQuickHabit: (e: React.FormEvent) => void;
  quickTaskTitle: string;
  setQuickTaskTitle: (val: string) => void;
  showQuickTaskInput: boolean;
  setShowQuickTaskInput: (val: boolean) => void;
  handleCreateQuickTask: (e: React.FormEvent) => void;
  spendingStats: {
    weekly: number;
    hasExpenses: boolean;
    dayTotals: number[];
    dayPercentages: number[];
    food: number;
    transport: number;
    subs: number;
  };
  expenses: ExpenseItem[];
  setShowQuickExpenseModal: (val: boolean) => void;
  schedule: WeeklyScheduleData;
  onUpdateSchedule?: (updated: WeeklyScheduleData) => void;
  soundEnabled: boolean;
}

export const CommandCenterGrid: React.FC<CommandCenterGridProps> = ({
  gridOrder,
  draggedWidgetId,
  dragOverWidgetId,
  isCustomizingGrid,
  isDefaultOrder,
  setDraggedWidgetId,
  setDragOverWidgetId,
  setIsCustomizingGrid,
  handleDropWidget,
  handleMoveWidget,
  handleResetGridLayout,
  todos,
  onAddTodo,
  onToggleTodo,
  onNavigate,
  habits,
  todayIndex,
  onToggleHabitDay,
  showQuickHabitInput,
  setShowQuickHabitInput,
  quickHabitTitle,
  setQuickHabitTitle,
  handleCreateQuickHabit,
  quickTaskTitle,
  setQuickTaskTitle,
  showQuickTaskInput,
  setShowQuickTaskInput,
  handleCreateQuickTask,
  spendingStats,
  expenses,
  setShowQuickExpenseModal,
  schedule,
  onUpdateSchedule,
  soundEnabled,
}) => {
  return (
    <div className="space-y-3">
      {/* Layout Control Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#787774] dark:text-[#9CA3AF]">
          <LayoutGrid className="w-3.5 h-3.5 text-[#6366F1]" />
          <span>Command Center</span>
          <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500 hidden sm:inline">
            • Drag any card to rearrange; grids automatically adjust
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isDefaultOrder && (
            <button
              type="button"
              onClick={handleResetGridLayout}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-[#F1F1EF] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Reset to default layout"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Layout</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsCustomizingGrid((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border shadow-2xs ${
              isCustomizingGrid
                ? 'bg-[#6366F1] text-white border-[#6366F1]'
                : 'bg-[#F7F7F5] dark:bg-[#1E293B] text-gray-700 dark:text-gray-200 border-[#E5E5E2] dark:border-[#334155] hover:border-gray-400'
            }`}
          >
            <GripVertical className="w-3 h-3" />
            <span>{isCustomizingGrid ? 'Done Reordering' : 'Rearrange Tiles'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Responsive Grid (6-column auto-packing grid with macOS/iOS style dynamic balancing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 items-stretch">
        {gridOrder.map((widgetId, index) => {
          const isBeingDragged = draggedWidgetId === widgetId;
          const isDragOver = dragOverWidgetId === widgetId && !isBeingDragged;

          const dragStyles = isBeingDragged
            ? 'opacity-40 scale-[0.98] ring-2 ring-indigo-400/50 shadow-inner'
            : isDragOver
            ? 'ring-2 ring-[#6366F1] ring-offset-2 dark:ring-offset-[#111827] bg-indigo-50/25 dark:bg-indigo-950/25 scale-[1.01] shadow-lg'
            : 'hover:border-[#CBD5E1] dark:hover:border-[#475569]';

          // macOS / iOS auto-adjusting column spans:
          // Row 1 (slots 0, 1, 2): 2 cols each in 6-col grid (3 cards)
          // Row 2 (slots 3, 4): 3 cols each in 6-col grid (2 cards)
          // On md screens: pairs of 1 col + 1 full-width 2-col bottom card
          const colSpanClass =
            index < 3
              ? 'col-span-1 md:col-span-1 lg:col-span-2'
              : index === 3
              ? 'col-span-1 md:col-span-1 lg:col-span-3'
              : 'col-span-1 md:col-span-2 lg:col-span-3';

          const dragHandle = (
            <div className="flex items-center gap-1 shrink-0">
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('text/plain', widgetId);
                  setDraggedWidgetId(widgetId);
                  Sound.click(soundEnabled);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing transition-colors select-none"
                title="Drag to rearrange widget"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              {isCustomizingGrid && (
                <div className="flex items-center gap-0.5 bg-white dark:bg-[#0F172A] rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveWidget(widgetId, -1);
                    }}
                    className="p-1 text-gray-500 hover:text-[#6366F1] disabled:opacity-30 disabled:cursor-not-allowed rounded cursor-pointer"
                    title="Move left / up"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === gridOrder.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveWidget(widgetId, 1);
                    }}
                    className="p-1 text-gray-500 hover:text-[#6366F1] disabled:opacity-30 disabled:cursor-not-allowed rounded cursor-pointer"
                    title="Move right / down"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );

          return (
            <div
              key={widgetId}
              draggable
              onDragStart={(e) => {
                const target = e.target as HTMLElement;
                if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData('text/plain', widgetId);
                setDraggedWidgetId(widgetId);
                Sound.click(soundEnabled);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverWidgetId !== widgetId) {
                  setDragOverWidgetId(widgetId);
                }
              }}
              onDragLeave={() => {
                if (dragOverWidgetId === widgetId) {
                  setDragOverWidgetId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropWidget(draggedWidgetId, widgetId);
              }}
              onDragEnd={() => {
                setDraggedWidgetId(null);
                setDragOverWidgetId(null);
              }}
              className={`${colSpanClass} flex flex-col transition-all duration-300 ${dragStyles}`}
            >
              {widgetId === 'calendar' && (
                <IndianCalendarWidget
                  todos={todos}
                  onAddTodo={onAddTodo}
                  onToggleTodo={onToggleTodo}
                  onNavigate={onNavigate}
                  soundEnabled={soundEnabled}
                  dragHandle={dragHandle}
                  className="h-full"
                />
              )}

              {widgetId === 'tasks' && (
                <div className="p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dragHandle}
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                            Today&apos;s Tasks
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onNavigate('tasks');
                        }}
                        className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
                      >
                        View all
                      </button>
                    </div>

                    {/* Task list with strike-through for completed items */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {todos.length === 0 ? (
                        <div className="p-6 text-center bg-white dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-80" />
                          <p className="text-xs font-semibold text-[#37352F] dark:text-white">No tasks created yet</p>
                          <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                            Add a task below to plan your day.
                          </p>
                        </div>
                      ) : (
                        todos.slice(0, 5).map((task) => (
                          <div
                            key={task.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group ${
                              task.completed
                                ? 'bg-gray-100/70 dark:bg-[#0F172A]/50 border-gray-200/60 dark:border-gray-800/60 opacity-60'
                                : 'bg-white dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] hover:border-[#CBD5E1]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => {
                                  Sound.click(soundEnabled);
                                  onToggleTodo(task.id);
                                }}
                                className={`transition-colors cursor-pointer shrink-0 ${
                                  task.completed
                                    ? 'text-emerald-500 hover:text-emerald-600'
                                    : 'text-[#9CA3AF] hover:text-emerald-600'
                                }`}
                                title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>
                              <span
                                className={`text-xs truncate ${
                                  task.completed
                                    ? 'line-through text-[#9CA3AF]'
                                    : 'text-[#37352F] dark:text-white font-medium'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono shrink-0 ml-2">
                              {task.priority}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Inline Quick Add Task Field */}
                  <div className="pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60">
                    {showQuickTaskInput ? (
                      <form onSubmit={handleCreateQuickTask} className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Task title..."
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-[#6366F1] text-white rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickTaskInput(false)}
                          className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowQuickTaskInput(true)}
                        className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] hover:bg-white dark:hover:bg-[#1E1B4B] rounded-xl transition-all cursor-pointer border border-dashed border-gray-300 dark:border-gray-700 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Task</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {widgetId === 'expenses' && (
                <div className="p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dragHandle}
                        <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                          <CreditCard className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                            Spending Snapshot
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onNavigate('expenses');
                        }}
                        className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
                      >
                        View all
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-lg sm:text-xl font-extrabold text-[#37352F] dark:text-white">
                          ₹{spendingStats.weekly.toLocaleString()}
                        </span>
                        <span className="text-xs text-[#787774] dark:text-[#9CA3AF] ml-2 font-medium">
                          {spendingStats.hasExpenses ? 'This week' : 'No expenses logged'}
                        </span>
                      </div>
                      {spendingStats.hasExpenses ? (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-900/40">
                          <CreditCard className="w-3 h-3" />
                          <span>{expenses.length} logged</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                          Clean sheet
                        </span>
                      )}
                    </div>

                    {/* 7-Day Visualizer Bar Chart */}
                    <div className="grid grid-cols-7 gap-1.5 pt-2 items-end h-16">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                        const isToday = i === todayIndex;
                        const daySpend = spendingStats.dayTotals[i];
                        const pct = spendingStats.dayPercentages[i];
                        return (
                          <div key={day} className="flex flex-col items-center gap-1" title={`${day}: ₹${daySpend}`}>
                            <div className="w-full bg-white dark:bg-gray-800/80 rounded-sm h-12 flex items-end relative overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                              <div
                                style={{ height: `${pct > 0 ? pct : 6}%` }}
                                className={`w-full rounded-sm transition-all duration-300 ${
                                  pct === 0
                                    ? 'bg-gray-300/40 dark:bg-gray-700/40'
                                    : isToday
                                    ? 'bg-[#6366F1]'
                                    : 'bg-indigo-300 dark:bg-indigo-600'
                                }`}
                              />
                            </div>
                            <span
                              className={`text-[9px] font-mono ${
                                isToday ? 'font-bold text-[#6366F1]' : 'text-[#94A3B8]'
                              }`}
                            >
                              {day}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Category Breakdown list */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60 text-center">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
                        <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Food</p>
                        <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.food.toLocaleString()}</p>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
                        <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Transport</p>
                        <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.transport.toLocaleString()}</p>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
                        <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Subscriptions</p>
                        <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.subs.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60">
                    <button
                      type="button"
                      onClick={() => setShowQuickExpenseModal(true)}
                      className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] hover:bg-white dark:hover:bg-[#1E1B4B] rounded-xl transition-all cursor-pointer border border-dashed border-gray-300 dark:border-gray-700 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Expense</span>
                    </button>
                  </div>
                </div>
              )}

              {widgetId === 'habits' && (
                <div className="p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dragHandle}
                        <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                          <Flame className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                            Today&apos;s Habits
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onNavigate('habits');
                        }}
                        className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
                      >
                        View all
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {habits.length === 0 ? (
                        <div className="p-6 text-center bg-white dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                          <Flame className="w-6 h-6 text-amber-500 mx-auto mb-1 opacity-80" />
                          <p className="text-xs font-semibold text-[#37352F] dark:text-white">Build daily momentum</p>
                          <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                            Track small rituals that compound over time.
                          </p>
                        </div>
                      ) : (
                        habits.slice(0, 5).map((habit) => {
                          const isDone = habit.completedDays[todayIndex];
                          return (
                            <div
                              key={habit.id}
                              onClick={() => onToggleHabitDay(habit.id, todayIndex)}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] cursor-pointer transition-all shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-sm">{habit.icon || '⚡'}</span>
                                <span className="text-xs font-semibold text-[#37352F] dark:text-white">
                                  {habit.title}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="cursor-pointer"
                                title={isDone ? 'Completed today' : 'Mark done'}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-emerald-500" />
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Quick Add Habit Field */}
                  <div className="pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60">
                    {showQuickHabitInput ? (
                      <form onSubmit={handleCreateQuickHabit} className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Habit title (e.g. Deep Reading)..."
                          value={quickHabitTitle}
                          onChange={(e) => setQuickHabitTitle(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-[#6366F1] text-white rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickHabitInput(false)}
                          className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowQuickHabitInput(true)}
                        className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] hover:bg-white dark:hover:bg-[#1E1B4B] rounded-xl transition-all cursor-pointer border border-dashed border-gray-300 dark:border-gray-700 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Habit</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {widgetId === 'schedule' && (
                <DynamicScheduleCard
                  schedule={schedule}
                  onUpdateSchedule={onUpdateSchedule || (() => {})}
                  soundEnabled={soundEnabled}
                  dragHandle={dragHandle}
                  className="h-full"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
