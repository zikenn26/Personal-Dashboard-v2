import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  Check,
  Search,
  X,
  Edit2,
} from 'lucide-react';
import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';
import { Sound } from '../utils/audio';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const EMOJI_OPTIONS = ['⚡', '💧', '🏃', '📚', '🧘', '🥗', '💻', '🌅', '💤', '🎯', '✨', '💪'];
const COLOR_OPTIONS = [
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Rose', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Pink', hex: '#EC4899' },
];
const CATEGORY_OPTIONS = [
  'Health',
  'Wellness',
  'Learning',
  'Productivity',
  'Mindset',
  'Fitness',
  'Finance',
  'Daily',
];

export interface HabitTrackerProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  habitActivities?: HabitActivityLog[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onUpdateHabit?: (habit: HabitItem) => void;
  onDeleteHabit: (habitId: string) => void;
  onResetWeek?: () => void;
  onSimulateMondayRollover?: () => void;
  onToggleHistoricalHabitDay?: (weekId: string, habitId: string, dayIndex: number) => void;
  onAddHistoricalHabit?: (weekId: string, title: string, category: string, icon: string, color: string) => void;
  onDeleteHistoricalHabit?: (weekId: string, habitId: string) => void;
  soundEnabled: boolean;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  habits,
  onToggleHabitDay,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  soundEnabled,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);

  // New habit form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Health');
  const [newIcon, setNewIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#F59E0B');

  // Edit habit form state
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Health');
  const [editIcon, setEditIcon] = useState('⚡');
  const [editColor, setEditColor] = useState('#F59E0B');

  // Search filter
  const filteredHabits = useMemo(() => {
    if (!searchQuery.trim()) return habits;
    const q = searchQuery.toLowerCase().trim();
    return habits.filter(
      (h) => h.title.toLowerCase().includes(q) || h.category?.toLowerCase().includes(q)
    );
  }, [habits, searchQuery]);

  // Overall weekly momentum stats
  const { totalCompleted, totalPossible, completionRate } = useMemo(() => {
    let completed = 0;
    const possible = habits.length * 7;
    habits.forEach((h) => {
      completed += h.completedDays.filter(Boolean).length;
    });
    const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
    return { totalCompleted: completed, totalPossible: possible, completionRate: rate };
  }, [habits]);

  const handleToggle = (habitId: string, dayIndex: number) => {
    Sound.click(soundEnabled);
    onToggleHabitDay(habitId, dayIndex);
  };

  const handleOpenAddModal = () => {
    setNewTitle('');
    setNewCategory('Health');
    setNewIcon('⚡');
    setNewColor('#F59E0B');
    setShowAddModal(true);
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;

    Sound.success(soundEnabled);
    onAddHabit(clean, newCategory, newIcon, newColor);
    setShowAddModal(false);
    setNewTitle('');
  };

  const handleStartEditHabit = (habit: HabitItem) => {
    setEditingHabit(habit);
    setEditTitle(habit.title);
    setEditCategory(habit.category || 'Health');
    setEditIcon(habit.icon || '⚡');
    setEditColor(habit.color || '#F59E0B');
  };

  const handleSaveEditHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit) return;
    const clean = editTitle.trim();
    if (!clean) return;

    if (onUpdateHabit) {
      Sound.success(soundEnabled);
      onUpdateHabit({
        ...editingHabit,
        title: clean,
        category: editCategory,
        icon: editIcon,
        color: editColor,
      });
    }
    setEditingHabit(null);
  };

  const handleDeleteHabitItem = (habitId: string) => {
    Sound.click(soundEnabled);
    onDeleteHabit(habitId);
    setEditingHabit(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* Top Bar: Subtitle & Quick Action */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {habits.length} habits tracked this week
        </p>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Habit</span>
        </button>
      </div>

      {/* Weekly Momentum Progress Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 relative overflow-hidden">
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

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search habits & routines..."
          className="w-full pl-8 pr-8 py-2 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white placeholder-gray-400 shadow-2xs focus:outline-hidden focus:border-amber-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Header Bar with count */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
          Habits ({filteredHabits.length})
        </span>
      </div>

      {/* Habit Cards Grid */}
      {filteredHabits.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
          <Flame className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {searchQuery ? 'No habits match your search' : 'No habits configured yet'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {searchQuery ? 'Try searching for a different routine or keyword.' : 'Build lasting daily routines. Tap “Add Habit” above!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredHabits.map((habit) => {
            const completedCount = habit.completedDays.filter(Boolean).length;
            return (
              <div
                key={habit.id}
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Streak Badge */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{habit.streak}d</span>
                    </div>

                    {/* Small Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleStartEditHabit(habit)}
                      className="p-1 rounded-lg text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 active:scale-95 transition-all cursor-pointer"
                      title="Edit or delete habit"
                      aria-label={`Edit ${habit.title}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 7-Day Circular Tap Strip */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {habit.completedDays.map((isDone, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggle(habit.id, idx)}
                      className={`flex-1 py-1.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isDone
                          ? 'bg-amber-500 text-white shadow-xs scale-[1.03]'
                          : 'bg-gray-100 dark:bg-[#1A2234] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
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
          })}
        </div>
      )}

      {/* Add Habit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8E5F3] dark:border-[#242D40] pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Add New Habit</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHabit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Habit Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Read 15 pages, Drink 2L water"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Choose Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                        newIcon === emoji
                          ? 'bg-amber-100 dark:bg-amber-950 ring-2 ring-amber-500 scale-105'
                          : 'bg-gray-50 dark:bg-[#1A2234] border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-3">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-8 h-8 rounded-full transition-transform cursor-pointer shadow-xs ${
                        newColor === c.hex ? 'ring-3 ring-offset-2 ring-amber-500 scale-110' : ''
                      }`}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-500/25 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Habit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Habit Modal */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8E5F3] dark:border-[#242D40] pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>Edit Habit</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingHabit(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditHabit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Habit Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Read 15 pages, Drink 2L water"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Choose Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditIcon(emoji)}
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                        editIcon === emoji
                          ? 'bg-amber-100 dark:bg-amber-950 ring-2 ring-amber-500 scale-105'
                          : 'bg-gray-50 dark:bg-[#1A2234] border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-3">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-8 h-8 rounded-full transition-transform cursor-pointer shadow-xs ${
                        editColor === c.hex ? 'ring-3 ring-offset-2 ring-amber-500 scale-110' : ''
                      }`}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteHabitItem(editingHabit.id)}
                  className="py-2.5 px-4 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1.5 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Habit</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingHabit(null)}
                    className="px-4 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!editTitle.trim()}
                    className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-500/25 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
