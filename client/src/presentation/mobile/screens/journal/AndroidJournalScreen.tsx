import React, { useState, useMemo } from 'react';
import { BookOpen, Plus, Trash2, Lock, Unlock, Search, Tag, Calendar, Heart, Shield } from 'lucide-react';
import { JournalEntry } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { BottomSheet } from '../../gestures/BottomSheet';
import { QuickNoteSheet } from '../../components/QuickNoteSheet';

export interface AndroidJournalScreenProps {
  entries: JournalEntry[];
  masterPin?: string;
  onAddEntry?: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  onDeleteEntry?: (id: string) => void;
}

const MOODS = ['All', '😊', '🚀', '🌿', '☕', '💡', '💭', '🌧️'];

export const AndroidJournalScreen: React.FC<AndroidJournalScreenProps> = ({
  entries,
  masterPin,
  onAddEntry,
  onDeleteEntry,
}) => {
  const [isLocked, setIsLocked] = useState<boolean>(Boolean(masterPin));
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [selectedMood, setSelectedMood] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [readingEntry, setReadingEntry] = useState<JournalEntry | null>(null);
  const [activeActionEntry, setActiveActionEntry] = useState<JournalEntry | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === masterPin) {
      void nativeService.triggerHaptic('success');
      setIsLocked(false);
      setPinError(false);
    } else {
      void nativeService.triggerHaptic('error');
      setPinError(true);
      setEnteredPin('');
    }
  };

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (selectedMood !== 'All' && e.mood !== selectedMood) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = e.title.toLowerCase().includes(q);
          const matchContent = e.content.toLowerCase().includes(q);
          const matchTags = e.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchContent && !matchTags) return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, selectedMood, searchQuery]);

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteEntry) onDeleteEntry(id);
  };

  const actionItems: ActionSheetItem[] = activeActionEntry
    ? [
        {
          label: 'Delete Entry',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => handleDelete(activeActionEntry.id),
        },
      ]
    : [];

  // PIN Unlock Screen if locked
  if (isLocked) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center justify-center text-center select-none">
        <div className="w-14 h-14 rounded-3xl bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-4 shadow-sm">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">
          Dear Diary is Locked
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          Enter your Master PIN to view and create personal journal entries.
        </p>

        <form onSubmit={handleUnlock} className="w-full max-w-xs mt-6 space-y-3">
          <input
            type="password"
            maxLength={6}
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value)}
            placeholder="Enter Master PIN"
            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-center text-lg tracking-widest font-mono text-gray-900 dark:text-white focus:outline-none focus:border-pink-500 shadow-2xs"
          />
          {pinError && (
            <p className="text-xs font-bold text-rose-600">Incorrect PIN. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Unlock Journal
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Dear Diary & Journal
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {entries.length} reflections recorded
          </p>
        </div>

        {onAddEntry && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Entry</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search thoughts, memories, tags..."
          className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-pink-500"
        />
      </div>

      {/* Mood Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setSelectedMood(m);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedMood === m
                ? 'bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-700'
                : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Entries List */}
      <div className="space-y-2.5">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <BookOpen className="w-10 h-10 text-pink-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No entries found
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tap &ldquo;New Entry&rdquo; to write your thoughts.
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <JournalEntryRow
              key={entry.id}
              entry={entry}
              onSelect={() => {
                void nativeService.triggerHaptic('selection');
                setReadingEntry(entry);
              }}
              onLongPress={() => setActiveActionEntry(entry)}
            />
          ))
        )}
      </div>

      {/* Reading Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(readingEntry)}
        onClose={() => setReadingEntry(null)}
        title={readingEntry?.title}
        subtitle={`${readingEntry?.date} · Mood: ${readingEntry?.mood || '✨'}`}
      >
        {readingEntry && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{readingEntry.mood}</span>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                {readingEntry.moodLabel || 'Feeling reflected'}
              </span>
            </div>

            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {readingEntry.content}
            </p>

            {readingEntry.tags && readingEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {readingEntry.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-0.5 rounded-full text-[11px] bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 font-semibold"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* New Note / Entry Sheet */}
      {onAddEntry && (
        <QuickNoteSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          onAddDiaryEntry={onAddEntry}
        />
      )}

      {/* Long-press Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionEntry)}
        onClose={() => setActiveActionEntry(null)}
        title={activeActionEntry?.title || 'Entry Options'}
        subtitle={`Date: ${activeActionEntry?.date}`}
        actions={actionItems}
      />
    </div>
  );
};

interface JournalEntryRowProps {
  entry: JournalEntry;
  onSelect: () => void;
  onLongPress: () => void;
}

const JournalEntryRow: React.FC<JournalEntryRowProps> = ({
  entry,
  onSelect,
  onLongPress,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  return (
    <div
      {...longPressProps}
      onClick={onSelect}
      className="p-3.5 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] active:scale-[0.99] transition-all cursor-pointer shadow-2xs space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{entry.mood || '📝'}</span>
          <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
            {entry.title}
          </span>
        </div>
        <span className="text-[10px] text-gray-400 font-mono shrink-0">
          {entry.date}
        </span>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
        {entry.content}
      </p>

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
          {entry.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
