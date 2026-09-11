import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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

export interface DropIndicator {
  colIdx: number;
  rowIdx: number;
  position: 'top' | 'bottom';
}

export interface CommandCenterGridProps {
  columns?: [string[], string[], string[]];
  onColumnsChange?: (cols: [string[], string[], string[]]) => void;
  layoutPreset?: any;
  onLayoutPresetChange?: any;
  isCustomizingGrid?: boolean;
  isDefaultOrder?: boolean;
  setIsCustomizingGrid?: (val: any) => void;
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

  // ResizeObserver for exact responsive breakpoints
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
  // Default matches screenshot: Col 0: Calendar + Habits, Col 1: Tasks + Expenses, Col 2: Schedule
  const columns: [string[], string[], string[]] = useMemo(() => {
    const valid = new Set(['calendar', 'schedule', 'expenses', 'habits', 'tasks']);
    if (propColumns && propColumns.length === 3) {
      const col0 = propColumns[0].filter((w) => valid.has(w));
      const col1 = propColumns[1].filter((w) => valid.has(w));
      const col2 = propColumns[2].filter((w) => valid.has(w));
      const present = new Set([...col0, ...col1, ...col2]);
      valid.forEach((w) => {
        if (!present.has(w)) col1.push(w);
      });
      return [col0, col1, col2];
    }
    return [
      ['calendar', 'habits'],
      ['tasks', 'expenses'],
      ['schedule'],
    ];
  }, [propColumns]);

  // Robust Drag and Drop State
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);

  const cleanupDrag = useCallback(() => {
    setDraggedWidgetId(null);
    setDropIndicator(null);
    setDragOverColIdx(null);
  }, []);

  const findWidgetPosition = useCallback(
    (id: string): { colIdx: number; rowIdx: number } | null => {
      for (let c = 0; c < columns.length; c++) {
        const r = columns[c].indexOf(id);
        if (r !== -1) return { colIdx: c, rowIdx: r };
      }
      return null;
    },
    [columns]
  );

  // Drag start handler: Delay setting draggedWidgetId to next frame
  // This ensures the browser takes a crisp, sharp drag image BEFORE styling changes
  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', widgetId);
    e.dataTransfer.effectAllowed = 'move';

    // Delay state change so the drag ghost screenshot is rendered at 100% crisp opacity
    setTimeout(() => {
      setDraggedWidgetId(widgetId);
    }, 0);

    Sound.click(soundEnabled);
  };

  const handleDragEnd = () => {
    cleanupDrag();
  };

  // Card hover calculation: precise top or bottom placement
  const handleCardDragOver = (
    e: React.DragEvent,
    colIdx: number,
    rowIdx: number,
    targetWidgetId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) {
      setDropIndicator(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const isBottom = relY > rect.height / 2;
    const position = isBottom ? 'bottom' : 'top';

    if (
      !dropIndicator ||
      dropIndicator.colIdx !== colIdx ||
      dropIndicator.rowIdx !== rowIdx ||
      dropIndicator.position !== position
    ) {
      setDropIndicator({ colIdx, rowIdx, position });
      setDragOverColIdx(colIdx);
    }
  };

  // Column empty bottom drop zone
  const handleColumnBottomDragOver = (e: React.DragEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedWidgetId) return;

    const colLen = columns[colIdx].length;
    const lastRowIdx = Math.max(0, colLen - 1);

    if (
      !dropIndicator ||
      dropIndicator.colIdx !== colIdx ||
      dropIndicator.rowIdx !== lastRowIdx ||
      dropIndicator.position !== 'bottom'
    ) {
      setDropIndicator({
        colIdx,
        rowIdx: lastRowIdx,
        position: 'bottom',
      });
      setDragOverColIdx(colIdx);
    }
  };

  // Unified Drop Execution
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedWidgetId || !dropIndicator) {
      cleanupDrag();
      return;
    }

    const sourcePos = findWidgetPosition(draggedWidgetId);
    if (!sourcePos) {
      cleanupDrag();
      return;
    }

    const nextCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    // 1. Remove dragged widget from old column
    nextCols[sourcePos.colIdx].splice(sourcePos.rowIdx, 1);

    // 2. Determine exact target index
    let targetIndex = dropIndicator.rowIdx;

    // If moving within same column and source was before target, offset index by -1
    if (sourcePos.colIdx === dropIndicator.colIdx && sourcePos.rowIdx < dropIndicator.rowIdx) {
      targetIndex -= 1;
    }

    if (dropIndicator.position === 'bottom') {
      targetIndex += 1;
    }

    // Clamp index safely
    const safeIndex = Math.max(0, Math.min(targetIndex, nextCols[dropIndicator.colIdx].length));
    nextCols[dropIndicator.colIdx].splice(safeIndex, 0, draggedWidgetId);

    if (onColumnsChange) {
      onColumnsChange(nextCols);
    }
    Sound.success(soundEnabled);
    cleanupDrag();
  };

  // Quick arrow movement: column shift
  const handleMoveWidgetColumn = (widgetId: string, colDelta: number) => {
    const pos = findWidgetPosition(widgetId);
    if (!pos) return;
    const targetCol = pos.colIdx + colDelta;
    if (targetCol < 0 || targetCol > 2) return;

    const nextCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    nextCols[pos.colIdx].splice(pos.rowIdx, 1);
    nextCols[targetCol].push(widgetId);

    if (onColumnsChange) {
      onColumnsChange(nextCols);
    }
    Sound.click(soundEnabled);
  };

  // Quick arrow movement: vertical within column
  const handleMoveWidgetVertical = (widgetId: string, rowDelta: number) => {
    const pos = findWidgetPosition(widgetId);
    if (!pos) return;
    const targetRow = pos.rowIdx + rowDelta;
    if (targetRow < 0 || targetRow >= columns[pos.colIdx].length) return;

    const nextCols: [string[], string[], string[]] = [
      [...columns[0]],
      [...columns[1]],
      [...columns[2]],
    ];

    const [removed] = nextCols[pos.colIdx].splice(pos.rowIdx, 1);
    nextCols[pos.colIdx].splice(targetRow, 0, removed);

    if (onColumnsChange) {
      onColumnsChange(nextCols);
    }
    Sound.click(soundEnabled);
  };

  // Drag handle & quick arrow controls for tile headers
  const renderDragHandle = (widgetId: string, colIdx: number, rowIdx: number, colLength: number) => {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, widgetId)}
          onDragEnd={handleDragEnd}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing transition-colors select-none"
          title="Drag to rearrange tile"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Quick Column Shift Controls (hover-revealed) */}
        <div className="opacity-0 group-hover/tile:opacity-100 transition-opacity flex items-center gap-0.5 bg-white dark:bg-[#0F172A] rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 shadow-2xs">
          <button
            type="button"
            disabled={colIdx === 0}
            onClick={(e) => {
              e.stopPropagation();
              handleMoveWidgetColumn(widgetId, -1);
            }}
            className="p-0.5 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
            title="Move to left column"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          {colLength > 1 && (
            <>
              <button
                type="button"
                disabled={rowIdx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveWidgetVertical(widgetId, -1);
                }}
                className="p-0.5 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
                title="Move up"
              >
                <ChevronUp className="w-3 h-3" />
              </button>

              <button
                type="button"
                disabled={rowIdx >= colLength - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveWidgetVertical(widgetId, 1);
                }}
                className="p-0.5 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
                title="Move down"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            disabled={colIdx === 2}
            onClick={(e) => {
              e.stopPropagation();
              handleMoveWidgetColumn(widgetId, 1);
            }}
            className="p-0.5 text-gray-500 hover:text-[#6366F1] disabled:opacity-20 disabled:cursor-not-allowed rounded cursor-pointer"
            title="Move to right column"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  // Render widget content
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

  // Responsive column adaptation
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
      // Col 0: calendar + habits
      // Col 1: tasks + expenses + schedule
      const colA: string[] = [];
      const colB: string[] = [];
      const flat = [...columns[0], ...columns[1], ...columns[2]];

      flat.forEach((id) => {
        if (id === 'calendar' || id === 'habits') {
          colA.push(id);
        } else {
          colB.push(id);
        }
      });
      return [
        { colIndex: 0, items: colA },
        { colIndex: 1, items: colB },
      ];
    }

    // Desktop: 3 columns matching screenshot
    return [
      { colIndex: 0, items: columns[0] },
      { colIndex: 1, items: columns[1] },
      { colIndex: 2, items: columns[2] },
    ];
  }, [isMobile, isTablet, columns]);

  return (
    <div className="space-y-4 select-none" ref={containerRef}>
      {/* Top Header Bar with Reset Layout only (matching screenshot) */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#787774] dark:text-[#9CA3AF]">
          <LayoutGrid className="w-4 h-4 text-[#6366F1]" />
          <span className="text-[#37352F] dark:text-white font-bold tracking-tight text-sm">
            Dashboard
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>
          <span className="text-xs font-normal text-[#787774] dark:text-[#9CA3AF] hidden sm:inline">
            Drag any card to rearrange layout
          </span>
        </div>

        {/* Reset Layout button */}
        <button
          type="button"
          onClick={() => {
            Sound.click(soundEnabled);
            handleResetGridLayout();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#1E293B] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all cursor-pointer border border-[#E5E5E2] dark:border-[#334155] shadow-xs"
          title="Reset to default 3-column layout"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#6366F1]" />
          <span>Reset Layout</span>
        </button>
      </div>

      {/* Responsive Multi-Column Packing Grid */}
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
            className="flex flex-col gap-5 min-w-0 relative"
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverColIdx !== colIndex) setDragOverColIdx(colIndex);
            }}
            onDrop={handleDrop}
          >
            {items.map((widgetId, rowIdx) => {
              const pos = findWidgetPosition(widgetId) || { colIdx: colIndex, rowIdx };
              const colLength = items.length;
              const isCurrentlyDragged = draggedWidgetId === widgetId;

              // Determine if this card has a drop indicator on top or bottom
              const showTopIndicator =
                dropIndicator &&
                dropIndicator.colIdx === colIndex &&
                dropIndicator.rowIdx === rowIdx &&
                dropIndicator.position === 'top';

              const showBottomIndicator =
                dropIndicator &&
                dropIndicator.colIdx === colIndex &&
                dropIndicator.rowIdx === rowIdx &&
                dropIndicator.position === 'bottom';

              return (
                <div key={widgetId} className="w-full flex flex-col gap-2">
                  {/* Top Drop Indicator Line */}
                  {showTopIndicator && (
                    <div className="h-1.5 bg-[#6366F1] dark:bg-[#818CF8] rounded-full mx-2 shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700 animate-pulse transition-all" />
                  )}

                  {/* Widget Container */}
                  <div
                    onDragOver={(e) => handleCardDragOver(e, colIndex, rowIdx, widgetId)}
                    onDrop={handleDrop}
                    className={`w-full transition-all duration-150 relative group/tile ${
                      isCurrentlyDragged
                        ? 'opacity-40 border-2 border-dashed border-[#6366F1] bg-indigo-50/20 dark:bg-indigo-950/20 rounded-2xl'
                        : ''
                    }`}
                  >
                    {renderWidgetContent(widgetId, pos.colIdx, pos.rowIdx, colLength)}
                  </div>

                  {/* Bottom Drop Indicator Line */}
                  {showBottomIndicator && (
                    <div className="h-1.5 bg-[#6366F1] dark:bg-[#818CF8] rounded-full mx-2 shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700 animate-pulse transition-all" />
                  )}
                </div>
              );
            })}

            {/* Empty space at the bottom of column as a drop target */}
            <div
              onDragOver={(e) => handleColumnBottomDragOver(e, colIndex)}
              onDrop={handleDrop}
              className={`w-full transition-all duration-200 rounded-xl ${
                draggedWidgetId
                  ? 'min-h-[44px] border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center text-[10px] text-gray-400 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
                  : 'h-2'
              }`}
            >
              {draggedWidgetId && (
                <span>Drop here to place at bottom of column</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
