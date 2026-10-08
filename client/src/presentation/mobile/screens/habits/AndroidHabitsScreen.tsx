import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  Check,
  Edit2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { HabitItem, HabitWeekRecord } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { QuickHabitSheet } from '../../components/QuickHabitSheet';
import {
  getMonthCalendarData,
  isHabitDateCompleted,
  toggleHabitDate,
  formatDateIso,
  getMondayOfWeek,
} from '../../../../utils/habitWeekManager';

export interface AndroidHabitsScreenProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onToggleHabitDate?: (habitId: string, dateStr: string) => void;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  onUpdateHabit?: (habit: HabitItem) => void;
  onDeleteHabit?: (habitId: string) => void;
  onResetWeek?: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AndroidHabitsScreen: React.FC<AndroidHabitsScreenProps> = ({
  habits,
  onToggleHabitDay,
  onToggleHabitDate,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
}) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);

  // Month navigation state
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());

  // Individual habit calendar popup state
  const [calendarPopupHabitId, setCalendarPopupHabitId] = useState<string | null>(null);

  // Today's day index: Monday is 0, Sunday is 6
  const todayDayIdx = useMemo(() => {
    const day = today.getDay();
    return (day + 6) % 7;
  }, [today]);

  const currentMonday = useMemo(() => getMondayOfWeek(today), [today]);
  const todayDateStr = useMemo(() => formatDateIso(today), [today]);

  // Calendar info for the selected month
  const monthData = useMemo(() => {
    return getMonthCalendarData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Active habit for the calendar popup
  const activeCalendarHabit = useMemo(() => {
    if (!calendarPopupHabitId) return null;
    return habits.find((h) => h.id === calendarPopupHabitId) || null;
  }, [calendarPopupHabitId, habits]);

  // Progress metrics for today and the week
  const todayCompletedCount = useMemo(() => {
    return habits.filter((h) => h.completedDays && h.completedDays[todayDayIdx]).length;
  }, [habits, todayDayIdx]);

  const { totalCompleted, totalPossible, completionRate } = useMemo(() => {
    let completed = 0;
    const possible = habits.length * 7;
    habits.forEach((h) => {
      if (h.completedDays) {
        completed += h.completedDays.filter(Boolean).length;
      }
    });
    const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
    return { totalCompleted: completed, totalPossible: possible, completionRate: rate };
  }, [habits]);

  const maxStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map((h) => h.streak || 0));
  }, [habits]);

  const handleToggleToday = (habitId: string) => {
    void nativeService.triggerHaptic('success');
    onToggleHabitDay(habitId, todayDayIdx);
  };

  const handleToggleDay = (habitId: string, dayIdx: number) => {
    void nativeService.triggerHaptic('success');
    onToggleHabitDay(habitId, dayIdx);
  };

  const handleToggleDate = (habitId: string, dateStr: string) => {
    void nativeService.triggerHaptic('success');
    if (onToggleHabitDate) {
      onToggleHabitDate(habitId, dateStr);
    } else if (onUpdateHabit) {
      const target = habits.find((h) => h.id === habitId);
      if (target) {
        const updated = toggleHabitDate(target, dateStr, currentMonday);
        onUpdateHabit(updated);
      }
    }
  };

  const handlePrevMonth = () => {
    void nativeService.triggerHaptic('selection');
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    void nativeService.triggerHaptic('selection');
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    void nativeService.triggerHaptic('selection');
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  const isCurrentViewingMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  return (
    <div className="w-full max-w-md mx-auto flex flex-col flex-1 pb-24 px-3.5 pt-2 relative font-['Plus_Jakarta_Sans',sans-serif] text-[#181445] dark:text-[#f3eeff] selection:bg-[#f1dbff] selection:text-[#6100a4]">
      {/* 1. Timeframe Segmented Switch */}
      <section aria-label="Timeframe Selection" className="w-full mb-3">
        <div className="bg-[#efebff] dark:bg-[#1a1738] rounded-full p-0.5 flex items-center justify-between border border-[#cfc2d5]/30 dark:border-[#2f2956]">
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setTimeframe('today');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all duration-200 text-center cursor-pointer ${
              timeframe === 'today'
                ? 'bg-[#7b2cbf] text-white pill-active-shadow'
                : 'text-[#7e7384] dark:text-[#9e96b3] hover:text-[#181445] dark:hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setTimeframe('week');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all duration-200 text-center cursor-pointer ${
              timeframe === 'week'
                ? 'bg-[#7b2cbf] text-white pill-active-shadow'
                : 'text-[#7e7384] dark:text-[#9e96b3] hover:text-[#181445] dark:hover:text-white'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setTimeframe('month');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all duration-200 text-center cursor-pointer ${
              timeframe === 'month'
                ? 'bg-[#7b2cbf] text-white pill-active-shadow'
                : 'text-[#7e7384] dark:text-[#9e96b3] hover:text-[#181445] dark:hover:text-white'
            }`}
          >
            Month
          </button>
        </div>
      </section>

      {/* 2. Section Title & Streak / Month Controls */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <h2 className="text-sm font-bold text-[#181445] dark:text-white flex items-center gap-1.5">
          {timeframe === 'today' && "Today's Habits"}
          {timeframe === 'week' && "This Week's Habits"}
          {timeframe === 'month' && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-[#7b2cbf]" />
              <span>{monthData.monthName} {monthData.year}</span>
            </span>
          )}
        </h2>

        {timeframe === 'month' ? (
          <div className="flex items-center gap-1 bg-[#efebff] dark:bg-[#252045] p-0.5 rounded-full border border-[#cfc2d5]/40 dark:border-[#383060]">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1 rounded-full text-[#6100a4] dark:text-[#deb7ff] hover:bg-white/60 dark:hover:bg-[#342c5c] cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {!isCurrentViewingMonth && (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="text-[10px] font-bold px-1.5 text-[#7b2cbf] dark:text-[#deb7ff] cursor-pointer"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1 rounded-full text-[#6100a4] dark:text-[#deb7ff] hover:bg-white/60 dark:hover:bg-[#342c5c] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#efebff] dark:bg-[#252045] text-[#6100a4] dark:text-[#deb7ff] text-[11px] font-semibold border border-[#cfc2d5]/40 dark:border-[#383060]">
            <Flame className="w-3 h-3 fill-[#7b2cbf] text-[#7b2cbf] dark:fill-[#deb7ff] dark:text-[#deb7ff]" />
            <span>
              {timeframe === 'today'
                ? `${todayCompletedCount} of ${habits.length} done`
                : `${maxStreak}d Streak`}
            </span>
          </div>
        )}
      </div>

      {/* 3. Momentum Progress Card (Shown on Today/Week) */}
      {timeframe !== 'month' && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#7b2cbf] to-[#6100a4] text-white shadow-xs relative overflow-hidden mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#e4c2ff] uppercase tracking-wider">
              {timeframe === 'today' ? "Today's Progress" : 'Weekly Momentum'}
            </span>
            <div className="p-0.5 rounded-full bg-white/20">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold">
              {timeframe === 'today'
                ? `${habits.length > 0 ? Math.round((todayCompletedCount / habits.length) * 100) : 0}%`
                : `${completionRate}%`}
            </span>
            <span className="text-[11px] text-[#e4c2ff]">
              {timeframe === 'today'
                ? `(${todayCompletedCount} of ${habits.length} completed)`
                : `(${totalCompleted} of ${totalPossible} total)`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-black/25 rounded-full mt-2.5 overflow-hidden">
            <div
              className="h-full bg-[#6dfad2] rounded-full transition-all duration-500"
              style={{
                width: `${
                  timeframe === 'today'
                    ? habits.length > 0
                      ? Math.round((todayCompletedCount / habits.length) * 100)
                      : 0
                    : completionRate
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 4. Habit List / Calendar Grid */}
      {habits.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-[#f6f2ff] dark:bg-[#181534] border border-[#e3dfff] dark:border-[#28224d]">
          <Flame className="w-8 h-8 text-[#7b2cbf] mx-auto mb-1.5 opacity-60" />
          <p className="text-xs font-bold text-[#181445] dark:text-white">
            No habits tracked yet
          </p>
          <p className="text-[11px] text-[#7e7384] dark:text-[#a09bb5] mt-1 mb-3">
            Start tracking positive habits. Tap the plus button below!
          </p>
          {onAddHabit && (
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddSheetOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7b2cbf] text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Habit</span>
            </button>
          )}
        </div>
      ) : timeframe === 'month' ? (
        /* MONTH VIEW: 2 grids in each row - separate calendar view of all habits */
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {habits.map((habit) => {
            const completedDatesInMonth = monthData.days.filter((d) =>
              isHabitDateCompleted(habit, d.dateStr, currentMonday)
            ).length;
            const monthRate = Math.round(
              (completedDatesInMonth / monthData.daysInMonth) * 100
            );

            return (
              <div
                key={habit.id}
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setCalendarPopupHabitId(habit.id);
                }}
                className="p-2.5 rounded-xl bg-[#f6f2ff] dark:bg-[#181534] border border-[#e3dfff] dark:border-[#28224d] card-ambient-shadow flex flex-col justify-between hover:border-[#7b2cbf] dark:hover:border-[#deb7ff] cursor-pointer transition-all active:scale-[0.98]"
              >
                {/* Habit Header */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: habit.color ? `${habit.color}25` : '#f1dbff',
                          color: habit.color || '#6100a4',
                        }}
                      >
                        <span>{habit.icon || '⚡'}</span>
                      </div>
                      <h3 className="font-bold text-xs text-[#181445] dark:text-white truncate">
                        {habit.title}
                      </h3>
                    </div>

                    <span className="text-[10px] font-bold text-[#7b2cbf] dark:text-[#deb7ff] shrink-0">
                      {monthRate}%
                    </span>
                  </div>

                  {/* Mini Calendar View for this habit */}
                  <div className="bg-white/60 dark:bg-[#201c40]/60 p-1.5 rounded-lg border border-[#cfc2d5]/30 dark:border-[#2e2857]">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                      {DAY_LABELS.map((d, i) => (
                        <span key={i} className="text-[8px] font-bold text-[#7e7384] dark:text-[#a09bb5]">
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Mini day cells */}
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {/* Leading blanks */}
                      {Array.from({ length: monthData.leadingBlankCount }).map((_, i) => (
                        <div key={`blank-${i}`} className="h-3.5" />
                      ))}

                      {/* Days */}
                      {monthData.days.map((d) => {
                        const isDone = isHabitDateCompleted(habit, d.dateStr, currentMonday);
                        return (
                          <div
                            key={d.dateStr}
                            className={`h-3.5 rounded-xs flex items-center justify-center text-[8px] transition-colors ${
                              isDone
                                ? 'bg-[#7b2cbf] text-white font-bold shadow-2xs'
                                : d.isToday
                                ? 'bg-[#efebff] dark:bg-[#2e2857] text-[#7b2cbf] dark:text-[#deb7ff] font-bold ring-1 ring-[#7b2cbf]'
                                : 'text-[#7e7384] dark:text-[#9e96b3]'
                            }`}
                          >
                            <span>{d.dayNum}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer summary */}
                <div className="mt-2 flex items-center justify-between text-[9px] text-[#7e7384] dark:text-[#a09bb5] pt-1 border-t border-[#e3dfff]/60 dark:border-[#2e2857]/60">
                  <span>{completedDatesInMonth}/{monthData.daysInMonth} days</span>
                  <span className="text-[#7b2cbf] dark:text-[#deb7ff] font-semibold">Tap to edit</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TODAY & WEEK VIEWS: Standard compact habit list */
        <div className="space-y-2.5">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              timeframe={timeframe}
              todayDayIdx={todayDayIdx}
              onToggleToday={() => handleToggleToday(habit.id)}
              onToggleDay={(dayIdx) => handleToggleDay(habit.id, dayIdx)}
              onEdit={() => {
                void nativeService.triggerHaptic('selection');
                setEditingHabit(habit);
              }}
            />
          ))}
        </div>
      )}

      {/* 5. Individual Habit Calendar Popup Modal */}
      {activeCalendarHabit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-[#fcf8ff] dark:bg-[#181534] border border-[#e3dfff] dark:border-[#2f2956] shadow-2xl p-4 space-y-3.5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#e3dfff] dark:border-[#28224d]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-xs"
                  style={{
                    backgroundColor: activeCalendarHabit.color
                      ? `${activeCalendarHabit.color}25`
                      : '#f1dbff',
                    color: activeCalendarHabit.color || '#6100a4',
                  }}
                >
                  <span>{activeCalendarHabit.icon || '⚡'}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-[#181445] dark:text-white truncate">
                    {activeCalendarHabit.title}
                  </h3>
                  <p className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] flex items-center gap-1.5">
                    <span>{activeCalendarHabit.category || 'Daily'}</span>
                    <span>•</span>
                    <span className="text-[#7b2cbf] dark:text-[#deb7ff] font-semibold">
                      {activeCalendarHabit.streak}d streak
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCalendarPopupHabitId(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#7e7384] hover:text-[#181445] dark:hover:text-white hover:bg-[#efebff] dark:hover:bg-[#252045] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Month Navigator in Popup */}
            <div className="flex items-center justify-between bg-[#efebff] dark:bg-[#201c40] px-3 py-1.5 rounded-xl border border-[#cfc2d5]/30 dark:border-[#2e2857]">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1 rounded-lg text-[#6100a4] dark:text-[#deb7ff] hover:bg-white dark:hover:bg-[#342c5c] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="text-xs font-bold text-[#181445] dark:text-white">
                  {monthData.monthName} {monthData.year}
                </span>
                <p className="text-[9px] text-[#7e7384] dark:text-[#a09bb5]">
                  Click any day to mark / unmark
                </p>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1 rounded-lg text-[#6100a4] dark:text-[#deb7ff] hover:bg-white dark:hover:bg-[#342c5c] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Calendar Grid */}
            <div className="bg-white dark:bg-[#120f2b] p-3 rounded-xl border border-[#e3dfff] dark:border-[#28224d]">
              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {WEEKDAY_NAMES.map((d, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold text-[#7e7384] dark:text-[#a09bb5]"
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {/* Leading blanks */}
                {Array.from({ length: monthData.leadingBlankCount }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-8 sm:h-9" />
                ))}

                {/* Month days */}
                {monthData.days.map((d) => {
                  const isDone = isHabitDateCompleted(
                    activeCalendarHabit,
                    d.dateStr,
                    currentMonday
                  );

                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => handleToggleDate(activeCalendarHabit.id, d.dateStr)}
                      className={`h-8 sm:h-9 rounded-lg flex flex-col items-center justify-center text-[10px] sm:text-xs transition-all cursor-pointer relative active:scale-90 ${
                        isDone
                          ? 'bg-[#7b2cbf] text-white font-bold shadow-xs'
                          : d.isToday
                          ? 'bg-[#efebff] dark:bg-[#201c40] text-[#7b2cbf] dark:text-[#deb7ff] font-bold border-2 border-[#7b2cbf]'
                          : 'bg-[#f6f2ff] dark:bg-[#1b173c] text-[#181445] dark:text-white hover:bg-[#e9e5ff] dark:hover:bg-[#28224d]'
                      }`}
                      title={`${d.dateStr}: ${isDone ? 'Completed' : 'Not completed'}`}
                    >
                      <span>{d.dayNum}</span>
                      {isDone && (
                        <Check className="w-2.5 h-2.5 text-[#6dfad2] stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Monthly stats */}
            {(() => {
              const completedCountInMonth = monthData.days.filter((d) =>
                isHabitDateCompleted(activeCalendarHabit, d.dateStr, currentMonday)
              ).length;
              const rate = Math.round(
                (completedCountInMonth / monthData.daysInMonth) * 100
              );

              return (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#efebff] dark:bg-[#201c40] text-xs">
                  <div>
                    <span className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] block">
                      Consistency
                    </span>
                    <span className="font-extrabold text-sm text-[#7b2cbf] dark:text-[#deb7ff]">
                      {rate}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#7e7384] dark:text-[#a09bb5] block">
                      Total Days Completed
                    </span>
                    <span className="font-bold text-xs text-[#181445] dark:text-white">
                      {completedCountInMonth} of {monthData.daysInMonth} days
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleToggleDate(activeCalendarHabit.id, todayDateStr)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#efebff] dark:bg-[#201c40] text-[#7b2cbf] dark:text-[#deb7ff] text-xs font-semibold hover:bg-[#e3dfff] dark:hover:bg-[#28224d] transition-colors cursor-pointer"
              >
                {isHabitDateCompleted(activeCalendarHabit, todayDateStr, currentMonday)
                  ? 'Unmark Today'
                  : 'Mark Today Done'}
              </button>
              <button
                type="button"
                onClick={() => setCalendarPopupHabitId(null)}
                className="py-2 px-4 rounded-xl bg-[#7b2cbf] text-white text-xs font-semibold hover:bg-[#6100a4] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Plus Button - Bottom Right Corner */}
      {onAddHabit && (
        <button
          type="button"
          aria-label="Add Habit"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            setIsAddSheetOpen(true);
          }}
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-[#7b2cbf] hover:bg-[#6100a4] active:scale-95 text-white shadow-lg flex items-center justify-center transition-all cursor-pointer border-2 border-white dark:border-[#181445]"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Add Habit Sheet */}
      {onAddHabit && (
        <QuickHabitSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddHabit={onAddHabit}
        />
      )}

      {/* Edit Habit Sheet */}
      <QuickHabitSheet
        isOpen={Boolean(editingHabit)}
        initialHabit={editingHabit}
        onClose={() => setEditingHabit(null)}
        onUpdateHabit={onUpdateHabit}
        onDeleteHabit={onDeleteHabit}
      />
    </div>
  );
};

interface HabitCardProps {
  habit: HabitItem;
  timeframe: 'today' | 'week' | 'month';
  todayDayIdx: number;
  onToggleToday: () => void;
  onToggleDay: (dayIdx: number) => void;
  onEdit: () => void;
}

const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  timeframe,
  todayDayIdx,
  onToggleToday,
  onToggleDay,
  onEdit,
}) => {
  const isDoneToday = Boolean(habit.completedDays && habit.completedDays[todayDayIdx]);
  const completedThisWeek = habit.completedDays ? habit.completedDays.filter(Boolean).length : 0;

  return (
    <div className="p-3 rounded-xl bg-[#f6f2ff] dark:bg-[#181534] border border-[#e3dfff] dark:border-[#28224d] card-ambient-shadow space-y-2.5 transition-all hover:border-[#cfc2d5] dark:hover:border-[#3d3472]">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-2xs"
            style={{
              backgroundColor: habit.color ? `${habit.color}25` : '#f1dbff',
              color: habit.color || '#6100a4',
            }}
          >
            <span>{habit.icon || '⚡'}</span>
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-xs sm:text-sm text-[#181445] dark:text-white truncate">
              {habit.title}
            </h3>
            <p className="text-[11px] text-[#7e7384] dark:text-[#a09bb5] flex items-center gap-1.5 truncate">
              <span>{habit.category || 'General'}</span>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-[#7b2cbf] dark:text-[#deb7ff] font-semibold">
                <Flame className="w-2.5 h-2.5 fill-current" />
                {habit.streak}d streak
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Small Edit Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded-md text-[#7e7384] hover:text-[#7b2cbf] hover:bg-[#efebff] dark:hover:bg-[#252045] active:scale-95 transition-all cursor-pointer"
            title="Edit habit"
            aria-label={`Edit ${habit.title}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Today Checkmark Button (Shown in Today view) */}
          {timeframe === 'today' && (
            <button
              type="button"
              onClick={onToggleToday}
              className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
                isDoneToday
                  ? 'bg-[#6dfad2] text-[#00725b] border border-[#006b55]/20 shadow-2xs'
                  : 'border border-[#7e7384]/40 hover:border-[#7b2cbf] text-transparent hover:text-[#7b2cbf]/30'
              }`}
              aria-label={isDoneToday ? 'Completed today' : 'Mark completed today'}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Week View: 7-Day Interactive Tap Strip */}
      {timeframe === 'week' && (
        <div className="pt-0.5">
          <div className="flex items-center justify-between gap-1">
            {habit.completedDays.map((isDone, idx) => {
              const isToday = idx === todayDayIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onToggleDay(idx)}
                  className={`flex-1 py-1 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isDone
                      ? 'bg-[#7b2cbf] text-white shadow-2xs scale-[1.02]'
                      : 'bg-[#efebff] dark:bg-[#201c40] text-[#7e7384] dark:text-[#a09bb5] hover:bg-[#e3dfff] dark:hover:bg-[#282352]'
                  } ${isToday ? 'ring-1 ring-[#7b2cbf] ring-offset-1 dark:ring-offset-[#181534]' : ''}`}
                >
                  <span className="text-[9px] font-bold uppercase">{DAY_LABELS[idx]}</span>
                  <div className="w-3 h-3 mt-0.5 flex items-center justify-center">
                    {isDone ? (
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    ) : (
                      <div className="w-1 h-1 rounded-full bg-[#cfc2d5] dark:bg-[#473e6a]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#7e7384] dark:text-[#a09bb5] mt-1 px-0.5">
            <span>Tap day to toggle</span>
            <span className="font-semibold text-[#7b2cbf] dark:text-[#deb7ff]">
              {completedThisWeek}/7 done
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
