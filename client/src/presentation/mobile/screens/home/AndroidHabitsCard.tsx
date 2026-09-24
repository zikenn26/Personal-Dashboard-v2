import React from 'react';
import { Flame, ArrowRight, Plus, Check } from 'lucide-react';
import { HabitItem } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES, CARD_HEADER_CLASSES, CARD_TITLE_CLASSES, CARD_BODY_CLASSES } from '../../design-system/materialYou';

export interface AndroidHabitsCardProps {
  habits: HabitItem[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onNavigateToHabits: () => void;
  onOpenAddHabit: () => void;
}

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const AndroidHabitsCard: React.FC<AndroidHabitsCardProps> = ({
  habits,
  onToggleHabitDay,
  onNavigateToHabits,
  onOpenAddHabit,
}) => {
  // Day of week index (0=Mon, ..., 6=Sun)
  const currentDayIndex = (() => {
    const d = new Date().getDay(); // 0 is Sunday
    return d === 0 ? 6 : d - 1;
  })();

  // Calculate total completion rate for current week
  const totalSlots = habits.length * 7;
  const completedSlots = habits.reduce(
    (sum, h) => sum + (h.completedDays ? h.completedDays.filter(Boolean).length : 0),
    0
  );
  const completionPercentage = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0;

  const handleDayClick = (habitId: string, dayIdx: number) => {
    void nativeService.triggerHaptic('success');
    onToggleHabitDay(habitId, dayIdx);
  };

  return (
    <div className={CARD_SURFACE_CLASSES}>
      {/* Header */}
      <div className={CARD_HEADER_CLASSES}>
        <div className={CARD_TITLE_CLASSES}>
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
          <span>Habits &amp; Momentum</span>
        </div>

        <button
          type="button"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            onNavigateToHabits();
          }}
          className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>All Habits</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className={CARD_BODY_CLASSES}>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Week Completion
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              style={{ width: `${completionPercentage}%` }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            />
          </div>
        </div>

        {/* Habits List */}
        {habits.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              No daily habits configured yet.
            </p>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                onOpenAddHabit();
              }}
              className="px-4 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-600 dark:text-violet-300 inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a habit</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.slice(0, 4).map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
              >
                {/* Habit title & streak */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none">{h.icon || '⚡'}</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {h.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>{h.streak || 0}d streak</span>
                  </div>
                </div>

                {/* 7 Days Check Circles */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {DAYS_SHORT.map((dayLabel, idx) => {
                    const isDone = Boolean(h.completedDays?.[idx]);
                    const isToday = currentDayIndex === idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDayClick(h.id, idx)}
                        className={`flex-1 aspect-square max-w-8 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                          isDone
                            ? 'bg-amber-500 text-white shadow-xs scale-102'
                            : isToday
                            ? 'bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-500 text-amber-900 dark:text-amber-200'
                            : 'bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 text-gray-400'
                        }`}
                        aria-label={`Toggle day ${dayLabel}`}
                      >
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <span className="text-[10px] font-bold">{dayLabel}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
