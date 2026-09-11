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
  Clock,
  Calendar as CalendarIcon,
  Sparkles,
} from 'lucide-react';

export type GridLayoutPreset = 'executive' | 'schedule-hero' | 'calendar-hero' | 'custom';

export interface CommandCenterGridProps {
  columns?: [string[], string[], string[]];
  onColumnsChange?: (cols: [string[], string[], string[]]) => void;
  layoutPreset?: GridLayoutPreset;
  onLayoutPresetChange?: (preset: GridLayoutPreset) => void;
  gridOrder?: string[];
  draggedWidgetId?: string | null;
  dragOverWidgetId?: string | null;
  isCustomizingGrid: boolean;
  isDefaultOrder: boolean;
  setDraggedWidgetId?: (id: string | null) => void;
  setDragOverWidgetId?: (id: string | null) => void;
  setIsCustomizingGrid: (val: boolean | ((prev: boolean) => boolean)) => void;
  handleDropWidget?: (sourceId: string | null, targetId: string) => void;
  handleMoveWidget?: (id: string, offset: number) => void;
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
  layoutPreset: propLayoutPreset = 'executive',
  onLayoutPresetChange,
  gridOrder: propGridOrder,
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

  // Measure container width with ResizeObserver for exact responsive breakpoints
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

  // Internal layout preset state (syncs with prop or user actions)
  const [internalPreset, setInternalPreset] = useState<GridLayoutPreset>(propLayoutPreset);
  const activePreset = propLayoutPreset || internalPreset;

  const setPreset = (preset: GridLayoutPreset) => {
    setInternalPreset(preset);
    if (onLayoutPresetChange) {
      onLayoutPresetChange(preset);
    }
  };

  // Resolve active columns
  const columns: [string[], string[], string[]] = useMemo(() => {
    if (propColumns && propColumns.length === 3) {
      return propColumns;
    }
    if (propGridOrder && propGridOrder.length > 0) {
      const col0 = propGridOrder.includes('calendar') ? ['calendar'] : [];
      const col1 = propGridOrder.includes('schedule') ? ['schedule'] : [];
      const col2 = propGridOrder.filter((id) => id !== 'calendar' && id !== 'schedule');
      return [col0, col1, col2];
    }
    return [
      ['calendar'],
      ['schedule'],
      ['expenses', 'habits', 'tasks'],
    ];
  }, [propColumns, propGridOrder]);

  // Local drag-and-drop state
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

    // Re-locate target position after removal if in same column
    const newTargetRow = newCols[targetPos.colIdx].indexOf(targetId);
    if (newTargetRow !== -1) {
      newCols[targetPos.colIdx].splice(newTargetRow, 0, sourceId);
    } else {
      newCols[targetPos.colIdx].push(sourceId);
    }

    if (onColumnsChange) {
      onColumnsChange(newCols);
    }
    setPreset('custom');
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
    setDragOverColIdx(null);
    Sound.success(soundEnabled);
  };

  // Drop on column zone to move to that column
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
    setPreset('custom');
    setDraggedWidgetId(null);
    setDragOverColIdx(null);
    Sound.success(soundEnabled);
  };

  // Reorder widget across columns
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
    setPreset('custom');
    Sound.click(soundEnabled);
  };

  // Reorder widget vertically within its column
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
    setPreset('custom');
    Sound.click(soundEnabled);
  };

  // Switch to one of the named layout presets
  const handleSelectPreset = (preset: GridLayoutPreset) => {
    Sound.click(soundEnabled);
    setPreset(preset);

    if (preset === 'executive') {
      const resetCols: [string[], string[], string[]] = [
        ['calendar'],
        ['schedule'],
        ['expenses', 'habits', 'tasks'],
      ];
      if (onColumnsChange) onColumnsChange(resetCols);
    } else if (preset === 'schedule-hero') {
      const heroCols: [string[], string[], string[]] = [
        ['schedule'],
        ['expenses', 'habits'],
        ['calendar', 'tasks'],
      ];
      if (onColumnsChange) onColumnsChange(heroCols);
    } else if (preset === 'calendar-hero') {
      const calHeroCols: [string[], string[], string[]] = [
        ['calendar'],
        ['expenses', 'habits'],
        ['schedule', 'tasks'],
      ];
      if (onColumnsChange) onColumnsChange(calHeroCols);
    }
  };

  // =========================================================================
  // DYNAMIC CSS GRID TEMPLATE-AREAS GENERATOR
  // Computes gap-free rectangular template areas dynamically based on columns & preset
  // =========================================================================
  const { gridTemplateColumns, dynamicTemplateAreas } = useMemo(() => {
    const isMobile = containerWidth < 640;
    const isTablet = containerWidth >= 640 && containerWidth < 1024;

    // Mobile: 1 Column Stack
    if (isMobile) {
      const flatWidgets = [...columns[0], ...columns[1], ...columns[2]];
      const uniqueFlat = Array.from(new Set(flatWidgets));
      return {
        gridTemplateColumns: '1fr',
        dynamicTemplateAreas: uniqueFlat.map((id) => `"${id}"`).join('\n'),
      };
    }

    // Tablet: 2 Columns
    if (isTablet) {
      if (activePreset === 'schedule-hero') {
        return {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          dynamicTemplateAreas: `
            "schedule schedule"
            "calendar calendar"
            "expenses habits"
            "tasks tasks"
          `.trim(),
        };
      }

      if (activePreset === 'calendar-hero') {
        return {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          dynamicTemplateAreas: `
            "calendar calendar"
            "schedule schedule"
            "expenses habits"
            "tasks tasks"
          `.trim(),
        };
      }

      // Default tablet: Schedule hero banner on top, then 2 paired rows
      return {
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        dynamicTemplateAreas: `
          "schedule schedule"
          "calendar expenses"
          "habits tasks"
        `.trim(),
      };
    }

    // Desktop (width >= 1024px)
    if (activePreset === 'schedule-hero') {
      // Schedule spans 2 columns wide across rows 1-2, expenses/habits on right, calendar wide on row 3
      return {
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        dynamicTemplateAreas: `
          "schedule schedule expenses"
          "schedule schedule habits"
          "calendar calendar tasks"
        `.trim(),
      };
    }

    if (activePreset === 'calendar-hero') {
      // Calendar spans 2 columns wide across rows 1-2, schedule right pillar, expenses/habits row 3
      return {
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        dynamicTemplateAreas: `
          "calendar calendar schedule"
          "calendar calendar schedule"
          "expenses habits tasks"
        `.trim(),
      };
    }

    // Executive or Custom layout:
    // If standard executive:
    const isStandardExecutive =
      columns[0].length === 1 &&
      columns[0][0] === 'calendar' &&
      columns[1].length === 1 &&
      columns[1][0] === 'schedule' &&
      columns[2].length === 3;

    if (isStandardExecutive) {
      return {
        gridTemplateColumns: 'minmax(310px, 1fr) minmax(370px, 1.25fr) minmax(300px, 1fr)',
        dynamicTemplateAreas: `
          "calendar schedule expenses"
          "calendar schedule habits"
          "calendar schedule tasks"
        `.trim(),
      };
    }

    // Dynamic mathematically rectangular matrix for arbitrary custom column arrangements
    const safeCols: [string[], string[], string[]] = [
      columns[0].length > 0 ? columns[0] : ['calendar'],
      columns[1].length > 0 ? columns[1] : ['schedule'],
      columns[2].length > 0 ? columns[2] : ['tasks'],
    ];

    const maxRows = Math.max(safeCols[0].length, safeCols[1].length, safeCols[2].length, 1);
    const matrix: string[][] = [];
    for (let r = 0; r < maxRows; r++) {
      matrix.push(['', '', '']);
    }

    for (let c = 0; c < 3; c++) {
      const list = safeCols[c];
      const numItems = list.length;
      for (let i = 0; i < numItems; i++) {
        const start = Math.floor((i * maxRows) / numItems);
        const end = Math.floor(((i + 1) * maxRows) / numItems);
        const id = list[i];
        for (let r = start; r < end; r++) {
          matrix[r][c] = id;
        }
      }
    }

    // Fallback for any empty cell
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < maxRows; r++) {
        if (!matrix[r][c]) {
          matrix[r][c] = safeCols[c][0] || 'schedule';
        }
      }
    }

    const dynamicAreasStr = matrix.map((row) => `"${row.join(' ')}"`).join('\n');

    return {
      gridTemplateColumns: 'minmax(310px, 1fr) minmax(360px, 1.25fr) minmax(300px, 1fr)',
      dynamicTemplateAreas: dynamicAreasStr,
    };
  }, [containerWidth, activePreset, columns]);

  // List of all 5 distinct widgets to render into CSS grid
  const allWidgetsList = useMemo(() => {
    const defaultList = ['calendar', 'schedule', 'expenses', 'habits', 'tasks'];
    const present = new Set<string>();
    const ordered: string[] = [];

    columns.forEach((col) => {
      col.forEach((id) => {
        if (defaultList.includes(id) && !present.has(id)) {
          present.add(id);
          ordered.push(id);
        }
      });
    });

    defaultList.forEach((id) => {
      if (!present.has(id)) {
        present.add(id);
        ordered.push(id);
      }
    });

    return ordered;
  }, [columns]);

  // Drag handle & arrow controls for rearranging
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
          className="h-full"
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
          className="h-full"
        />
      );
    }

    if (widgetId === 'expenses') {
      return (
        <div className="p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between h-full space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
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
                <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Subs</p>
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
      );
    }

    if (widgetId === 'habits') {
      return (
        <div className="p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between h-full space-y-4">
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

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
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
        <div className="p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between h-full space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
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

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {todos.length === 0 ? (
                <div className="p-6 text-center bg-white dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                  <CheckSquare className="w-6 h-6 text-[#6366F1] mx-auto mb-1 opacity-80" />
                  <p className="text-xs font-semibold text-[#37352F] dark:text-white">All clear today</p>
                  <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                    No active tasks on your plate.
                  </p>
                </div>
              ) : (
                todos
                  .filter((t) => !t.completed)
                  .slice(0, 5)
                  .map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onToggleTodo(task.id)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] cursor-pointer transition-all shadow-2xs group"
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

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* ========================================================================= */}
      {/* TOP CONTROL BAR: Layout Presets & Drag-and-Drop Reorder Mode */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-[#787774] dark:text-[#9CA3AF]">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-[#6366F1]" />
            <span className="text-[#37352F] dark:text-white font-bold">Command Center</span>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8] text-[10px] font-mono border border-indigo-200/60 dark:border-indigo-900/40">
            <Sparkles className="w-2.5 h-2.5" />
            <span>CSS Grid Template-Areas • Gap-Minimized</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div className="inline-flex items-center bg-[#F1F1EF] dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSelectPreset('executive')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                activePreset === 'executive'
                  ? 'bg-white dark:bg-[#1E293B] text-[#6366F1] dark:text-[#818CF8] shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="3-Column Executive view with central full-height schedule pillar"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Executive 3-Col</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('schedule-hero')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                activePreset === 'schedule-hero'
                  ? 'bg-white dark:bg-[#1E293B] text-[#6366F1] dark:text-[#818CF8] shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Wide 2-column hero stage for Schedule with side panels"
            >
              <Clock className="w-3 h-3" />
              <span>Schedule Hero</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('calendar-hero')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                activePreset === 'calendar-hero'
                  ? 'bg-white dark:bg-[#1E293B] text-[#6366F1] dark:text-[#818CF8] shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Wide 2-column hero stage for Indian Calendar & Panchang"
            >
              <CalendarIcon className="w-3 h-3" />
              <span>Calendar Hero</span>
            </button>
          </div>

          {!isDefaultOrder && (
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                handleResetGridLayout();
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-[#F1F1EF] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Reset to default Executive layout"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
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

      {/* ========================================================================= */}
      {/* SOPHISTICATED CSS GRID TEMPLATE-AREAS CONTAINER (Gap-Minimized & Dynamic) */}
      {/* ========================================================================= */}
      <div
        className="w-full transition-all duration-300"
        style={{
          display: 'grid',
          gridTemplateColumns,
          gridTemplateAreas: dynamicTemplateAreas,
          gap: '1.5rem',
          alignItems: 'stretch',
        }}
      >
        {allWidgetsList.map((widgetId) => {
          const pos = findWidgetPosition(widgetId) || { colIdx: 0, rowIdx: 0 };
          const colLength = columns[pos.colIdx]?.length || 1;

          return (
            <div
              key={widgetId}
              style={{ gridArea: widgetId }}
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
                handleDropOnWidget(draggedWidgetId, widgetId);
              }}
              className={`h-full flex flex-col min-w-0 transition-all duration-200 ${
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
      </div>

      {/* Column Drop Targets when Reordering */}
      {(draggedWidgetId || isCustomizingGrid) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in fade-in">
          {[0, 1, 2].map((colIdx) => (
            <div
              key={colIdx}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColIdx !== colIdx) setDragOverColIdx(colIdx);
              }}
              onDragLeave={() => {
                if (dragOverColIdx === colIdx) setDragOverColIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnColumn(draggedWidgetId, colIdx);
              }}
              className={`rounded-2xl border-2 border-dashed py-3 px-4 text-center transition-all ${
                dragOverColIdx === colIdx
                  ? 'border-[#6366F1] bg-indigo-50/50 dark:bg-indigo-950/40 text-[#6366F1] scale-[1.01]'
                  : 'border-gray-200/80 dark:border-gray-800 text-gray-400 dark:text-gray-500 hover:border-gray-300'
              }`}
            >
              <p className="text-[11px] font-semibold">
                Drop tile here to move to Column {colIdx + 1}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
