import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { HabitItem } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';

interface HabitTrackerProps {
  habits: HabitItem[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onResetWeek: () => void;
  soundEnabled: boolean;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  habits,
  onToggleHabitDay,
  onAddHabit,
  onDeleteHabit,
  onResetWeek,
  soundEnabled,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Health');
  const [newIcon, setNewIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#3b82f6');

  // Compute current day of week index (0=Mon ... 6=Sun)
  const currentDayIndex = (new Date().getDay() + 6) % 7;

  const handleToggle = (habitId: string, dayIndex: number, currentlyDone: boolean) => {
    Sound.toggle(soundEnabled);
    if (!currentlyDone) {
      Sound.success(soundEnabled);
    }
    onToggleHabitDay(habitId, dayIndex);

    // Check if completing this makes today 100% complete
    const todayCompletedCount = habits.filter((h) =>
      h.id === habitId ? !currentlyDone : h.completedDays[currentDayIndex]
    ).length;
    if (todayCompletedCount === habits.length) {
      triggerConfetti();
    }
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    Sound.success(soundEnabled);
    onAddHabit(newTitle.trim(), newCategory, newIcon, newColor);
    setNewTitle('');
    setShowAddModal(false);
  };

  // Stats calculation
  const totalWeeklyChecks = habits.reduce(
    (acc, h) => acc + h.completedDays.filter(Boolean).length,
    0
  );
  const maxWeeklyChecks = habits.length * 7;
  const weeklyCompletionRate = maxWeeklyChecks > 0 ? Math.round((totalWeeklyChecks / maxWeeklyChecks) * 100) : 0;

  const todayCompletedCount = habits.filter((h) => h.completedDays[currentDayIndex]).length;
  const todayRate = habits.length > 0 ? Math.round((todayCompletedCount / habits.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors notion-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Flame className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#111827] dark:text-white">
              Habit Tracker & Weekly Routine
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
              Today: {todayCompletedCount}/{habits.length} done ({todayRate}%) • Weekly Rate: {weeklyCompletionRate}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              Sound.click(soundEnabled);
              setShowAddModal(true);
            }}
            className="px-2.5 py-1 text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* Habit Matrix Grid */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div className="min-w-[480px]">
          {/* Day column headers */}
          <div className="grid grid-cols-12 gap-1.5 items-center mb-2 text-center text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF]">
            <div className="col-span-5 text-left pl-2">Habit Routine</div>
            {DAYS_OF_WEEK.map((day, idx) => {
              const isWeekend = idx === 5 || idx === 6;
              const isToday = idx === currentDayIndex;
              return (
                <div
                  key={day}
                  className={`col-span-1 py-1 rounded-md ${
                    isToday
                      ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-bold ring-1 ring-indigo-300 dark:ring-indigo-700'
                      : isWeekend
                      ? 'text-red-500 font-extrabold bg-red-50/60 dark:bg-red-950/30'
                      : ''
                  }`}
                  title={isWeekend ? `${day} (Weekend Holiday)` : day}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Habit Rows */}
          <div className="space-y-2">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="grid grid-cols-12 gap-1.5 items-center p-2.5 rounded-lg bg-[#F9FAFB] dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151] group hover:border-[#D1D5DB] dark:hover:border-[#4B5563] transition-colors"
              >
                {/* Habit Title & Icon */}
                <div className="col-span-5 flex items-center justify-between pr-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">{habit.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#111827] dark:text-[#E5E7EB] truncate">
                        {habit.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                        <span className="font-mono text-amber-500 font-semibold flex items-center gap-0.5">
                          🔥 {habit.streak}d
                        </span>
                        <span>• {habit.category}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onDeleteHabit(habit.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 transition-opacity rounded cursor-pointer"
                    title="Delete habit"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* 7 Day Checkboxes */}
                {habit.completedDays.map((isDone, dayIdx) => {
                  const isToday = dayIdx === currentDayIndex;
                  return (
                    <div key={dayIdx} className="col-span-1 flex justify-center">
                      <button
                        onClick={() => handleToggle(habit.id, dayIdx, isDone)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isDone
                            ? 'bg-[#6366F1] text-white shadow-2xs scale-100'
                            : isToday
                            ? 'border-2 border-dashed border-[#818CF8] bg-white dark:bg-[#111827] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B]'
                            : 'border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                        }`}
                        title={`${habit.title} - ${DAYS_OF_WEEK[dayIdx]}`}
                      >
                        {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Stats & Reset */}
      <div className="mt-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937] flex items-center justify-between text-[10px] font-medium text-[#9CA3AF]">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-[#F3F4F6] dark:bg-[#1F2937] overflow-hidden">
            <div
              className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
              style={{ width: `${weeklyCompletionRate}%` }}
            />
          </div>
          <span>{weeklyCompletionRate}% Week Target</span>
        </div>

        <button
          onClick={() => {
            Sound.click(soundEnabled);
            onResetWeek();
          }}
          className="flex items-center gap-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
          title="Reset weekly checkboxes for a fresh week"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Week</span>
        </button>
      </div>

      {/* Add Habit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddHabit}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6366F1]" />
                <span>Create New Habit</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Habit Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Read 20 pages, 15m Meditation"
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Health, Code, etc."
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Emoji Icon
                </label>
                <div className="flex gap-1.5">
                  {['⚡', '🏃', '🧠', '🌙', '💧', '📚'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`p-1.5 rounded-md text-xs transition-transform ${
                        newIcon === emoji ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] scale-110' : 'hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Add Habit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
