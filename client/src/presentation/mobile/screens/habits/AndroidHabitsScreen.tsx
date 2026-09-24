import React, { useState } from 'react';
import { Flame, Plus, Trash2, RotateCcw, Check, Sparkles, Award } from 'lucide-react';
import { HabitItem, HabitWeekRecord } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { QuickHabitSheet } from '../../components/QuickHabitSheet';

export interface AndroidHabitsScreenProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  onDeleteHabit?: (habitId: string) => void;
  onResetWeek?: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const AndroidHabitsScreen: React.FC<AndroidHabitsScreenProps> = ({
  habits,
  habitHistory = [],
  onToggleHabitDay,
  onAddHabit,
  onDeleteHabit,
  onResetWeek,
}) => {
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activeActionHabit, setActiveActionHabit] = useState<HabitItem | null>(null);

  // Overall completion rate for the week
  const { totalCompleted, totalPossible, completionRate } = (() => {
    let completed = 0;
    const possible = habits.length * 7;
    habits.forEach((h) => {
      completed += h.completedDays.filter(Boolean).length;
    });
    const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
    return { totalCompleted: completed, totalPossible: possible, completionRate: rate };
  })();

  const handleToggleDay = (habitId: string, dayIndex: number) => {
    void nativeService.triggerHaptic('success');
    onToggleHabitDay(habitId, dayIndex);
  };

  const actionItems: ActionSheetItem[] = activeActionHabit
    ? [
        {
          label: 'Delete Habit',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => {
            if (onDeleteHabit) {
              void nativeService.triggerHaptic('warning');
              onDeleteHabit(activeActionHabit.id);
            }
          },
        },
      ]
    : [];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Habits & Streaks
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {habits.length} habits tracked this week
          </p>
        </div>

        {onAddHabit && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Habit</span>
          </button>
        )}
      </div>

      {/* Momentum Progress Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider">
            Weekly Momentum
          </span>
          <div className="p-1.5 rounded-full bg-white/15">
            <Flame className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black">{completionRate}%</span>
          <span className="text-xs text-amber-100">
            ({totalCompleted} of {totalPossible} completions)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-black/20 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Habit List */}
      <div className="space-y-2.5">
        {habits.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <Flame className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No habits configured yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Build lasting daily routines. Tap &ldquo;Add Habit&rdquo; above!
            </p>
          </div>
        ) : (
          habits.map((habit) => (
            <HabitItemCard
              key={habit.id}
              habit={habit}
              onToggleDay={(dayIdx) => handleToggleDay(habit.id, dayIdx)}
              onLongPress={() => setActiveActionHabit(habit)}
            />
          ))
        )}
      </div>

      {/* Add Habit Sheet */}
      {onAddHabit && (
        <QuickHabitSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddHabit={onAddHabit}
        />
      )}

      {/* Long-press Contextual Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionHabit)}
        onClose={() => setActiveActionHabit(null)}
        title={activeActionHabit?.title || 'Habit Options'}
        subtitle={`Current Streak: ${activeActionHabit?.streak || 0} days · Category: ${activeActionHabit?.category || 'General'}`}
        actions={actionItems}
      />
    </div>
  );
};

interface HabitItemCardProps {
  habit: HabitItem;
  onToggleDay: (dayIdx: number) => void;
  onLongPress: () => void;
}

const HabitItemCard: React.FC<HabitItemCardProps> = ({
  habit,
  onToggleDay,
  onLongPress,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  const completedCount = habit.completedDays.filter(Boolean).length;

  return (
    <div
      {...longPressProps}
      className="p-3.5 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs select-none space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg">{habit.icon || '⚡'}</span>
          <div className="min-w-0">
            <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
              {habit.title}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {habit.category} · {completedCount}/7 days
            </span>
          </div>
        </div>

        {/* Streak Badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs font-bold shrink-0">
          <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
          <span>{habit.streak}d</span>
        </div>
      </div>

      {/* 7-Day Circular Tap Strip */}
      <div className="flex items-center justify-between gap-1 pt-1">
        {habit.completedDays.map((isDone, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onToggleDay(idx)}
            className={`flex-1 py-1.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              isDone
                ? 'bg-amber-500 text-white shadow-xs scale-[1.03]'
                : 'bg-gray-100 dark:bg-[#1A2234] text-gray-500 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            <span className="text-[9px] font-bold uppercase">{DAY_LABELS[idx]}</span>
            <div className="w-3.5 h-3.5 mt-0.5 flex items-center justify-center">
              {isDone ? (
                <Check className="w-3 h-3 text-white stroke-[3]" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
