import React, { useState } from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { JournalEntry } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { Plus, BookOpen, Smile } from 'lucide-react';

export interface QuickNoteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDiaryEntry?: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
}

export const QuickNoteSheet: React.FC<QuickNoteSheetProps> = ({
  isOpen,
  onClose,
  onAddDiaryEntry,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('✨');
  const [moodLabel, setMoodLabel] = useState('Inspired');

  const moods = [
    { emoji: '✨', label: 'Inspired' },
    { emoji: '⚡', label: 'Energized' },
    { emoji: '🌿', label: 'Calm' },
    { emoji: '🎯', label: 'Focused' },
    { emoji: '💭', label: 'Reflective' },
    { emoji: '🔥', label: 'Productive' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent || !onAddDiaryEntry) return;

    void nativeService.triggerHaptic('success');
    const todayStr = new Date().toISOString().split('T')[0];
    onAddDiaryEntry({
      title: title.trim() || `Quick Note — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      content: cleanContent,
      date: todayStr,
      mood,
      moodLabel,
      tags: ['quick-note'],
    });

    setTitle('');
    setContent('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Quick Note" subtitle="Capture a thought or diary entry">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Title (Optional)
          </label>
          <div className="relative">
            <BookOpen className="w-4 h-4 text-violet-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Ideas from morning walk"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Content
          </label>
          <textarea
            rows={4}
            required
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write whatever is on your mind..."
            className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        {/* Mood Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Current Mood
          </label>
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setMood(m.emoji);
                  setMoodLabel(m.label);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mood === m.emoji
                    ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500'
                    : 'bg-gray-50 dark:bg-[#1A2234] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!content.trim()}
            className="w-full py-3 px-4 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Save Note</span>
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};
