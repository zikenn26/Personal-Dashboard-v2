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

  // Today's summary calculations
  const totalHabits = habits.length;
  const completedToday = habits.filter(
    (h) => Boolean(h.completedDays?.[currentDayIndex])
  ).length;
  const todayPercentage = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
  const maxStreak = habits.length > 0 ? Math.max(0, ...habits.map((h) => h.streak || 0)) : 0;

  const handleToggleToday = (habitId: string) => {
    void nativeService.triggerHaptic('success');
    onToggleHabitDay(habitId, currentDayIndex);
  };

  const displayHabits = habits.slice(0, 4);

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

      {/* Body: Compact Daily Summary */}
      <div className={CARD_BODY_CLASSES}>
        {/* Concise Today Progress Bar */}
        <div className="mb-2 p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-800 dark:text-gray-200 text-[11px]">
                Today&apos;s Progress
              </span>
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                ({completedToday}/{totalHabits} done)
              </span>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
              <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{maxStreak}d streak</span>
            </div>
          </div>

          <div className="w-full h-1.5 rounded-full bg-gray-200/80 dark:bg-gray-800 overflow-hidden">
            <div
              style={{ width: `${todayPercentage}%` }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            />
          </div>
        </div>

        {/* Compact Daily Habit List */}
        {displayHabits.length === 0 ? (
          <div className="py-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              No daily habits configured yet.
            </p>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                onOpenAddHabit();
              }}
              className="px-3.5 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-600 dark:text-violet-300 inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a habit</span>
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayHabits.map((h) => {
              const isDoneToday = Boolean(h.completedDays?.[currentDayIndex]);

              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] transition-all"
                >
                  {/* Habit title & streak */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <span className="text-sm leading-none shrink-0">{h.icon || '⚡'}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                        {h.title}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        <span>{h.streak || 0}d streak</span>
                      </div>
                    </div>
                  </div>

                  {/* Today Status Action Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleToday(h.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs ${
                      isDoneToday
                        ? 'bg-amber-500 text-white shadow-amber-500/20'
                        : 'bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400'
                    }`}
                  >
                    {isDoneToday ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Done</span>
                      </>
                    ) : (
                      <span>Mark</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AndroidHabitsCard;
