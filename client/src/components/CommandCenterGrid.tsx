import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export type GridLayoutPreset = 'executive' | 'schedule-hero' | 'calendar-hero' | 'custom';

export interface CommandCenterGridProps {
  columns?: [string[], string[], string[]];
  onColumnsChange?: (cols: [string[], string[], string[]]) => void;
  layoutPreset?: GridLayoutPreset;
  onLayoutPresetChange?: (preset: GridLayoutPreset) => void;
  gridOrder?: string[];
  isCustomizingGrid: boolean;
  isDefaultOrder: boolean;
  setIsCustomizingGrid: (val: boolean | ((prev: boolean) => boolean)) => void;
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
  columns: propColumns,
  onColumnsChange,
  isCustomizingGrid,
  isDefaultOrder,
  setIsCustomizingGrid,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1200);

  // ResizeObserver for responsive layout adaptations
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Standard 3-column data model
  const columns: [string[], string[], string[]] = useMemo(() => {
    const valid = new Set(['calendar', 'schedule', 'expenses', 'habits', 'tasks']);
    if (propColumns && propColumns.length === 3) {
      const col0 = propColumns[0].filter((w) => valid.has(w));
      const col1 = propColumns[1].filter((w) => valid.has(w));
      const col2 = propColumns[2].filter((w) => valid.has(w));
      const present = new Set([...col0, ...col1, ...col2]);
      valid.forEach((w) => {
        if (!present.has(w)) col2.push(w);
      });
      return [col0, col1, col2];
    }
    return [
      ['calendar'],
      ['schedule'],
      ['expenses', 'habits', 'tasks'],
    ];
  }, [propColumns]);

  // Drag-and-drop state
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);

  const findWidgetPosition = (id: string): { colIdx: number; rowIdx: number } | null => {
    for (let c = 0; c < columns.length; c++) {
      const r = columns[c].indexOf(id);
      if (r !== -1) return { colIdx: c, rowIdx: r };
    }
    return null;
  };

  // Drop on another widget to swap or insert
  const handleDropOnWidget = (sourceId: string | null, targetId: string) => {
    if (!sourceId || sourceId === targetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDragOverColIdx(null);
      return;
    }
    const sourcePos = findWidgetPosition(sourceId);
    const targetPos = findWidgetPosition(targetId);
    if (!sourcePos || !targetPos) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDragOverColIdx(null);
      return;
    }

    const newCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    // Remove source widget
    newCols[sourcePos.colIdx].splice(sourcePos.rowIdx, 1);

    // Insert target
    const newTargetRow = newCols[targetPos.colIdx].indexOf(targetId);
    if (newTargetRow !== -1) {
      newCols[targetPos.colIdx].splice(newTargetRow, 0, sourceId);
    } else {
      newCols[targetPos.colIdx].push(sourceId);
    }

    if (onColumnsChange) {
      onColumnsChange(newCols);
    }
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
    setDragOverColIdx(null);
    Sound.success(soundEnabled);
  };

  // Drop on column zone
  const handleDropOnColumn = (sourceId: string | null, colIdx: number) => {
    if (!sourceId) return;
    const sourcePos = findWidgetPosition(sourceId);
    if (!sourcePos) return;

    if (sourcePos.colIdx === colIdx && columns[colIdx].length === 1) {
      setDraggedWidgetId(null);
      setDragOverColIdx(null);
      return;
    }

    const newCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    newCols[sourcePos.colIdx].splice(sourcePos.rowIdx, 1);
    newCols[colIdx].push(sourceId);

    if (onColumnsChange) {
      onColumnsChange(newCols);
    }
    setDraggedWidgetId(null);
    setDragOverColIdx(null);
    Sound.success(soundEnabled);
  };

  // Directional button move across columns
  const handleMoveWidgetColumn = (widgetId: string, colDelta: number) => {
    const pos = findWidgetPosition(widgetId);
    if (!pos) return;
    const targetCol = pos.colIdx + colDelta;
    if (targetCol < 0 || targetCol > 2) return;

    const newCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    newCols[pos.colIdx].splice(pos.rowIdx, 1);
    newCols[targetCol].push(widgetId);

    if (onColumnsChange) {
      onColumnsChange(newCols);
    }
    Sound.click(soundEnabled);
  };

  // Directional button move vertically within column
  const handleMoveWidgetVertical = (widgetId: string, rowDelta: number) => {
    const pos = findWidgetPosition(widgetId);
    if (!pos) return;
    const targetRow = pos.rowIdx + rowDelta;
    if (targetRow < 0 || targetRow >= columns[pos.colIdx].length) return;

    const newCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    const [removed] = newCols[pos.colIdx].splice(pos.rowIdx, 1);
    newCols[pos.colIdx].splice(targetRow, 0, removed);

    if (onColumnsChange) {
      onColumnsChange(newCols);
    }
    Sound.click(soundEnabled);
  };

  // Render drag handle and arrow controls
  const renderDragHandle = (widgetId: string, colIdx: number, rowIdx: number, colLength: number) => {
    return (
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
          title="Drag to rearrange tile"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {isCustomizingGrid && (
          <div className="flex items-center gap-0.5 bg-white dark:bg-[#0F172A] rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 shadow-2xs">
            {/* Move to Left Column */}
            <button
              type="button"
              disabled={colIdx === 0}
              onClick={(e) => {
                e.stopPropagation();
                handleMoveWidgetColumn(widgetId, -1);
              }}
              className="p-1 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
              title="Move to left column"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            {/* Move Up in Column */}
            <button
              type="button"
              disabled={rowIdx === 0}
              onClick={(e) => {
                e.stopPropagation();
                handleMoveWidgetVertical(widgetId, -1);
              }}
              className="p-1 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>

            {/* Move Down in Column */}
            <button
              type="button"
              disabled={rowIdx >= colLength - 1}
              onClick={(e) => {
                e.stopPropagation();
                handleMoveWidgetVertical(widgetId, 1);
              }}
              className="p-1 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Move to Right Column */}
            <button
              type="button"
              disabled={colIdx === 2}
              onClick={(e) => {
                e.stopPropagation();
                handleMoveWidgetColumn(widgetId, 1);
              }}
              className="p-1 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
              title="Move to right column"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render individual widget card content
  const renderWidgetContent = (
    widgetId: string,
    colIdx: number,
    rowIdx: number,
    colLength: number
  ) => {
    const dragHandle = renderDragHandle(widgetId, colIdx, rowIdx, colLength);

    if (widgetId === 'calendar') {
      return (
        <IndianCalendarWidget
          todos={todos}
          onAddTodo={onAddTodo}
          onToggleTodo={onToggleTodo}
          onNavigate={onNavigate}
          soundEnabled={soundEnabled}
          dragHandle={dragHandle}
          className="w-full"
        />
      );
    }

    if (widgetId === 'schedule') {
      return (
        <DynamicScheduleCard
          schedule={schedule}
          onUpdateSchedule={onUpdateSchedule}
          soundEnabled={soundEnabled}
          dragHandle={dragHandle}
          className="w-full"
        />
      );
    }

    if (widgetId === 'expenses') {
      return (
        <div className="p-4.5 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col space-y-3.5 w-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9] dark:border-[#334155]/60">
            <div className="flex items-center gap-2">
              {dragHandle}
              <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-[#6366F1] dark:text-[#818CF8] shrink-0">
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
              <span className="text-2xl font-bold text-[#37352F] dark:text-white font-mono tracking-tight">
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
          <div className="grid grid-cols-7 gap-1.5 pt-1 items-end h-16">
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
              <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Subs</p>
              <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.subs.toLocaleString()}</p>
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
      );
    }

    if (widgetId === 'habits') {
      return (
        <div className="p-4.5 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col space-y-3.5 w-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9] dark:border-[#334155]/60">
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

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
            {habits.length === 0 ? (
              <div className="p-5 text-center bg-white dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1 opacity-80" />
                <p className="text-xs font-semibold text-[#37352F] dark:text-white">Build daily momentum</p>
                <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                  Track small rituals that compound over time.
                </p>
              </div>
            ) : (
              habits.slice(0, 6).map((habit) => {
                const isCompleted = habit.completedDays[todayIndex];
                return (
                  <div
                    key={habit.id}
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onToggleHabitDay(habit.id, todayIndex);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isCompleted
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-white dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{habit.icon || '⚡'}</span>
                      <span
                        className={`text-xs font-semibold truncate ${
                          isCompleted
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-[#37352F] dark:text-white'
                        }`}
                      >
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#787774] dark:text-[#9CA3AF]">
                        {habit.streak || 0}d
                      </span>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Add Habit Field */}
          <div className="pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60">
            {showQuickHabitInput ? (
              <form onSubmit={handleCreateQuickHabit} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New habit name..."
                  value={quickHabitTitle}
                  onChange={(e) => setQuickHabitTitle(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
                <button
                  type="submit"
                  disabled={!quickHabitTitle.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#6366F1] text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickHabitInput(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
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
      );
    }

    if (widgetId === 'tasks') {
      return (
        <div className="p-4.5 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col space-y-3.5 w-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9] dark:border-[#334155]/60">
            <div className="flex items-center gap-2">
              {dragHandle}
              <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
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
                onNavigate('todos');
              }}
              className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
            {todos.filter((t) => !t.completed).length === 0 ? (
              <div className="p-5 text-center bg-white dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1 opacity-80" />
                <p className="text-xs font-semibold text-[#37352F] dark:text-white">All tasks completed!</p>
                <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                  Relax or create a new goal.
                </p>
              </div>
            ) : (
              todos
                .filter((t) => !t.completed)
                .slice(0, 6)
                .map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onToggleTodo(task.id);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer group select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        className="shrink-0 cursor-pointer"
                        title="Complete task"
                      >
                        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors" />
                      </button>
                      <span className="text-xs font-semibold text-[#37352F] dark:text-white truncate">
                        {task.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0 ${
                        task.priority === 'urgent'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : task.priority === 'high'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : task.priority === 'medium'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                ))
            )}
          </div>

          {/* Quick Add Task Field */}
          <div className="pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60">
            {showQuickTaskInput ? (
              <form onSubmit={handleCreateQuickTask} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New task name..."
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
                <button
                  type="submit"
                  disabled={!quickTaskTitle.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#6366F1] text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickTaskInput(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
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
      );
    }

    return null;
  };

  // Compute active columns for responsive viewports
  const isMobile = containerWidth < 640;
  const isTablet = containerWidth >= 640 && containerWidth < 1024;

  const displayColumns: { colIndex: number; items: string[] }[] = useMemo(() => {
    if (isMobile) {
      // 1 single column stack
      const flat = [...columns[0], ...columns[1], ...columns[2]];
      return [{ colIndex: 0, items: flat }];
    }

    if (isTablet) {
      // 2 balanced columns:
      // Col A: calendar + tasks
      // Col B: schedule + expenses + habits
      const colA: string[] = [];
      const colB: string[] = [];
      const flat = [...columns[0], ...columns[1], ...columns[2]];

      flat.forEach((id) => {
        if (id === 'calendar') {
          colA.push(id);
        } else if (id === 'schedule') {
          colB.push(id);
        } else if (id === 'expenses' || id === 'habits') {
          colB.push(id);
        } else {
          colA.push(id);
        }
      });
      return [
        { colIndex: 0, items: colA },
        { colIndex: 1, items: colB },
      ];
    }

    // Desktop: 3 separate columns
    return [
      { colIndex: 0, items: columns[0] },
      { colIndex: 1, items: columns[1] },
      { colIndex: 2, items: columns[2] },
    ];
  }, [isMobile, isTablet, columns]);

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Top Header & Reorder Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#787774] dark:text-[#9CA3AF]">
          <LayoutGrid className="w-4 h-4 text-[#6366F1]" />
          <span className="text-[#37352F] dark:text-white font-bold uppercase tracking-wider text-xs">
            Dashboard
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isDefaultOrder && (
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                handleResetGridLayout();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-[#F1F1EF] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Reset to default layout"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Layout</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsCustomizingGrid((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer border shadow-2xs ${
              isCustomizingGrid
                ? 'bg-[#6366F1] text-white border-[#6366F1]'
                : 'bg-[#F7F7F5] dark:bg-[#1E293B] text-gray-700 dark:text-gray-200 border-[#E5E5E2] dark:border-[#334155] hover:border-gray-400'
            }`}
          >
            <GripVertical className="w-3.5 h-3.5" />
            <span>{isCustomizingGrid ? 'Done Reordering' : 'Rearrange Tiles'}</span>
          </button>
        </div>
      </div>

      {/* Smart Responsive Multi-Column Packing Grid */}
      <div
        className={`w-full grid gap-5 items-start transition-all duration-200 ${
          isMobile
            ? 'grid-cols-1'
            : isTablet
            ? 'grid-cols-2'
            : 'grid-cols-1 lg:grid-cols-3'
        }`}
      >
        {displayColumns.map(({ colIndex, items }) => (
          <div
            key={colIndex}
            className="flex flex-col gap-5 min-w-0"
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverColIdx !== colIndex) setDragOverColIdx(colIndex);
            }}
            onDragLeave={() => {
              if (dragOverColIdx === colIndex) setDragOverColIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnColumn(draggedWidgetId, colIndex);
            }}
          >
            {items.map((widgetId, rowIdx) => {
              const pos = findWidgetPosition(widgetId) || { colIdx: colIndex, rowIdx };
              const colLength = items.length;

              return (
                <div
                  key={widgetId}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
                    e.stopPropagation();
                    handleDropOnWidget(draggedWidgetId, widgetId);
                  }}
                  className={`w-full transition-all duration-200 ${
                    draggedWidgetId === widgetId ? 'opacity-40 scale-[0.98]' : ''
                  } ${
                    dragOverWidgetId === widgetId
                      ? 'ring-2 ring-[#6366F1] dark:ring-[#818CF8] ring-offset-2 dark:ring-offset-[#0F172A] rounded-2xl scale-[1.01]'
                      : ''
                  }`}
                >
                  {renderWidgetContent(widgetId, pos.colIdx, pos.rowIdx, colLength)}
                </div>
              );
            })}

            {/* Column Drop Target when in Reordering mode */}
            {isCustomizingGrid && !isMobile && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverColIdx !== colIndex) setDragOverColIdx(colIndex);
                }}
                onDragLeave={() => {
                  if (dragOverColIdx === colIndex) setDragOverColIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnColumn(draggedWidgetId, colIndex);
                }}
                className={`rounded-2xl border-2 border-dashed py-3.5 px-4 text-center transition-all ${
                  dragOverColIdx === colIndex
                    ? 'border-[#6366F1] bg-indigo-50/50 dark:bg-indigo-950/40 text-[#6366F1] scale-[1.01]'
                    : 'border-gray-200/80 dark:border-gray-800 text-gray-400 dark:text-gray-500 hover:border-gray-300'
                }`}
              >
                <p className="text-[11px] font-semibold">
                  Drop tile here to add to Column {colIndex + 1}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
