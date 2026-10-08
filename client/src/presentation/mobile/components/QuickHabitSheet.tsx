import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { nativeService } from '../../../services/nativeService';
import { Plus, Flame, Edit2, Trash2, Check } from 'lucide-react';
import { HabitItem } from '../../../types';

export interface QuickHabitSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialHabit?: HabitItem | null;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  onUpdateHabit?: (habit: HabitItem) => void;
  onDeleteHabit?: (habitId: string) => void;
}

export const QuickHabitSheet: React.FC<QuickHabitSheetProps> = ({
  isOpen,
  onClose,
  initialHabit,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
}) => {
  const isEditing = Boolean(initialHabit);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Health');
  const [selectedIcon, setSelectedIcon] = useState('⚡');
  const [selectedColor, setSelectedColor] = useState('#7C3AED');

  useEffect(() => {
    if (initialHabit) {
      setTitle(initialHabit.title || '');
      setCategory(initialHabit.category || 'Health');
      setSelectedIcon(initialHabit.icon || '⚡');
      setSelectedColor(initialHabit.color || '#7C3AED');
    } else {
      setTitle('');
      setCategory('Health');
      setSelectedIcon('⚡');
      setSelectedColor('#7C3AED');
    }
  }, [initialHabit, isOpen]);

  const icons = ['⚡', '💧', '🏃', '📚', '🧘', '🥗', '💻', '🌅', '💤', '🎯', '✨', '💪'];
  const colors = [
    { name: 'Violet', hex: '#7C3AED' },
    { name: 'Emerald', hex: '#10B981' },
    { name: 'Amber', hex: '#F59E0B' },
    { name: 'Rose', hex: '#EF4444' },
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Pink', hex: '#EC4899' },
  ];
  const categories = ['Health', 'Wellness', 'Learning', 'Productivity', 'Mindset', 'Fitness', 'Finance', 'Daily'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;

    if (isEditing && initialHabit && onUpdateHabit) {
      void nativeService.triggerHaptic('success');
      onUpdateHabit({
        ...initialHabit,
        title: clean,
        category,
        icon: selectedIcon,
        color: selectedColor,
      });
      onClose();
    } else if (onAddHabit) {
      void nativeService.triggerHaptic('success');
      onAddHabit(clean, category, selectedIcon, selectedColor);
      setTitle('');
      onClose();
    }
  };

  const handleDelete = () => {
    if (!initialHabit || !onDeleteHabit) return;
    void nativeService.triggerHaptic('warning');
    onDeleteHabit(initialHabit.id);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Habit' : 'Add New Habit'}
      subtitle={isEditing ? 'Modify routine details or delete' : 'Build a daily routine & streak'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Habit Name
          </label>
          <div className="relative">
            <Flame className="w-4 h-4 text-amber-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Read 15 pages, Drink 2L water"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Icon & Color Row */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Choose Icon
          </label>
          <div className="flex flex-wrap gap-2">
            {icons.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setSelectedIcon(emoji);
                }}
                className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                  selectedIcon === emoji
                    ? 'bg-violet-100 dark:bg-violet-950 ring-2 ring-violet-500 scale-105'
                    : 'bg-gray-50 dark:bg-[#1A2234] border border-gray-200 dark:border-gray-700'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            {colors.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setSelectedColor(c.hex);
                }}
                style={{ backgroundColor: c.hex }}
                className={`w-8 h-8 rounded-full transition-transform cursor-pointer shadow-xs ${
                  selectedColor === c.hex ? 'ring-3 ring-offset-2 ring-violet-500 scale-110' : ''
                }`}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Submit / Action Buttons */}
        <div className="pt-2 flex items-center gap-2.5">
          {isEditing && onDeleteHabit && (
            <button
              type="button"
              onClick={handleDelete}
              className="py-3 px-4 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
          <button
            type="submit"
            disabled={!title.trim()}
            className="flex-1 py-3 px-4 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            {isEditing ? (
              <>
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Habit</span>
              </>
            )}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};
