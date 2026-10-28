import React, { useState, useMemo } from 'react';
import { JournalEntry, DiaryTheme } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Search,
  Key,
  ShieldCheck,
  Feather,
  Palette,
  Heart,
  Star,
  Download,
  Copy,
  Check,
  X,
  Clock,
  RotateCw,
  Tag,
  Zap,
  Smile,
  ChevronRight,
  Bookmark,
  Share2,
} from 'lucide-react';

interface DearDiaryViewProps {
  entries: JournalEntry[];
  masterPin: string;
  onAddEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  onDeleteEntry: (id: string) => void;
  soundEnabled: boolean;
}

// 7 Curated Paper / Page Styles
export const PAPER_STYLES: Record<
  DiaryTheme,
  {
    id: DiaryTheme;
    name: string;
    icon: string;
    bgClass: string;
    paperSurface: string;
    borderClass: string;
    textClass: string;
    headerAccent: string;
    fontFamily: string;
    dividerColor: string;
  }
> = {
  parchment: {
    id: 'parchment',
    name: 'Classic Parchment',
    icon: '📜',
    bgClass: 'bg-[#FAF6EE] dark:bg-[#1A1612]',
    paperSurface:
      'bg-[#FAF6EE] dark:bg-[#1F1B16] bg-[radial-gradient(#D6C9B0_0.75px,transparent_0.75px)] [background-size:16px_16px]',
    borderClass: 'border-[#E6DEC8] dark:border-[#383025]',
    textClass: 'text-[#3E3327] dark:text-[#E8DFC8]',
    headerAccent: '#8C6239',
    fontFamily: 'font-serif',
    dividerColor: '#C4B294',
  },
  lined: {
    id: 'lined',
    name: 'Lined',
    icon: '📝',
    bgClass: 'bg-[#FCFCFC] dark:bg-[#181C24]',
    paperSurface:
      'bg-[#FCFCFC] dark:bg-[#181C24] bg-[linear-gradient(to_bottom,transparent_31px,#E2E8F0_31px,#E2E8F0_32px)] dark:bg-[linear-gradient(to_bottom,transparent_31px,#2D3748_31px,#2D3748_32px)] [background-size:100%_32px]',
    borderClass: 'border-[#E2E8F0] dark:border-[#2D3748]',
    textClass: 'text-[#1E293B] dark:text-[#F1F5F9]',
    headerAccent: '#3B82F6',
    fontFamily: 'font-serif',
    dividerColor: '#CBD5E1',
  },
  plain: {
    id: 'plain',
    name: 'Plain',
    icon: '📄',
    bgClass: 'bg-[#FFFFFF] dark:bg-[#18181B]',
    paperSurface: 'bg-[#FFFFFF] dark:bg-[#18181B]',
    borderClass: 'border-[#E4E4E7] dark:border-[#27272A]',
    textClass: 'text-[#27272A] dark:text-[#F4F4F5]',
    headerAccent: '#52525B',
    fontFamily: 'font-serif',
    dividerColor: '#D4D4D8',
  },
  dotted: {
    id: 'dotted',
    name: 'Dotted',
    icon: '⠁',
    bgClass: 'bg-[#FAFAFA] dark:bg-[#171717]',
    paperSurface:
      'bg-[#FAFAFA] dark:bg-[#171717] bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] dark:bg-[radial-gradient(#3F3F46_1px,transparent_1px)] [background-size:20px_20px]',
    borderClass: 'border-[#E5E7EB] dark:border-[#262626]',
    textClass: 'text-[#1F2937] dark:text-[#E5E7EB]',
    headerAccent: '#6B7280',
    fontFamily: 'font-serif',
    dividerColor: '#D1D5DB',
  },
  grid: {
    id: 'grid',
    name: 'Grid',
    icon: '▦',
    bgClass: 'bg-[#F9FAFB] dark:bg-[#111827]',
    paperSurface:
      'bg-[#F9FAFB] dark:bg-[#111827] bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1F2937_1px,transparent_1px),linear-gradient(to_bottom,#1F2937_1px,transparent_1px)] [background-size:24px_24px]',
    borderClass: 'border-[#E5E7EB] dark:border-[#1F2937]',
    textClass: 'text-[#111827] dark:text-[#F9FAFB]',
    headerAccent: '#4B5563',
    fontFamily: 'font-mono',
    dividerColor: '#CBD5E1',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    icon: '🌌',
    bgClass: 'bg-[#0B0F19] dark:bg-[#06080E]',
    paperSurface:
      'bg-[#0D1322] dark:bg-[#080C14] bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:20px_20px]',
    borderClass: 'border-[#1E293B] dark:border-[#1E293B]',
    textClass: 'text-[#E2E8F0] dark:text-[#F1F5F9]',
    headerAccent: '#818CF8',
    fontFamily: 'font-serif',
    dividerColor: '#334155',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    icon: '🌸',
    bgClass: 'bg-[#FAF5FF] dark:bg-[#191024]',
    paperSurface:
      'bg-[#FAF5FF] dark:bg-[#1C1229] bg-[radial-gradient(#E9D5FF_1px,transparent_1px)] dark:bg-[radial-gradient(#3B2556_1px,transparent_1px)] [background-size:18px_18px]',
    borderClass: 'border-[#E9D5FF] dark:border-[#3B2556]',
    textClass: 'text-[#4C1D95] dark:text-[#F3E8FF]',
    headerAccent: '#A855F7',
    fontFamily: 'font-serif',
    dividerColor: '#D8B4FE',
  },
};

const MOODS = [
  { emoji: '✨', label: 'Inspired' },
  { emoji: '🌸', label: 'Peaceful' },
  { emoji: '☕', label: 'Cozy' },
  { emoji: '🔥', label: 'Deep Flow' },
  { emoji: '🚀', label: 'Victorious' },
  { emoji: '💭', label: 'Pensive' },
  { emoji: '🌧️', label: 'Reflective' },
];

const REFLECTION_PROMPTS = [
  'What was one quiet moment of beauty or gratitude you experienced today?',
  'What is something you learned about yourself this week that you want to remember?',
  'If you could give your present self one piece of gentle advice right now, what would it be?',
  'What is a challenge you navigated recently, and what strength did it reveal in you?',
  'Describe a conversation or interaction today that made you feel connected or grounded.',
  'What is something you are eager to build, explore, or experience in the days ahead?',
  'What thoughts or worries do you want to safely release onto this page tonight?',
];

export const DearDiaryView: React.FC<DearDiaryViewProps> = ({
  entries,
  masterPin,
  onAddEntry,
  onDeleteEntry,
  soundEnabled,
}) => {
  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const getFormattedDateLong = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Paper Style Selection (Default: Classic Parchment)
  const [currentStyleKey, setCurrentStyleKey] = useState<DiaryTheme>(() => {
    return (localStorage.getItem('notion_diary_paper_style') as DiaryTheme) || 'parchment';
  });
  const currentPaper = PAPER_STYLES[currentStyleKey] || PAPER_STYLES.parchment;

  // Filters
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Favorites tracking (Stored locally by entry ID)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('notion_diary_favorites');
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // PIN Unlock State
  const [unlockedEntryIds, setUnlockedEntryIds] = useState<Set<string>>(new Set());
  const [isGlobalVaultUnlocked, setIsGlobalVaultUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [unlockTargetId, setUnlockTargetId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Form State for Writing
  const [isWritingNew, setIsWritingNew] = useState(false);
  const [entryDate, setEntryDate] = useState(getTodayDateStr());
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState(MOODS[0]);
  const [energyLevel, setEnergyLevel] = useState<number>(4);
  const [tags, setTags] = useState<string[]>(['Reflections']);
  const [tagInput, setTagInput] = useState('');
  const [isLockProtected, setIsLockProtected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // "Give me a prompt" single active prompt
  const [promptIndex, setPromptIndex] = useState(0);
  const activePrompt = REFLECTION_PROMPTS[promptIndex % REFLECTION_PROMPTS.length];

  // Paper style selector
  const handleSelectPaper = (styleKey: DiaryTheme) => {
    Sound.click(soundEnabled);
    setCurrentStyleKey(styleKey);
    localStorage.setItem('notion_diary_paper_style', styleKey);
  };

  // Toggle Favorite
  const handleToggleFavorite = (entryId: string) => {
    Sound.click(soundEnabled);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      localStorage.setItem('notion_diary_favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Cycle Prompt
  const handleNextPrompt = () => {
    Sound.click(soundEnabled);
    setPromptIndex((i) => i + 1);
  };

  const handleUsePrompt = (pText: string) => {
    Sound.click(soundEnabled);
    setIsWritingNew(true);
    if (!content.trim()) {
      setContent(`${pText}\n\n`);
    } else {
      setContent((prev) => `${prev}\n\n${pText}\n\n`);
    }
  };

  // Tags
  const handleAddTag = () => {
    const clean = tagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tRemove: string) => {
    setTags(tags.filter((t) => t !== tRemove));
  };

  // Save Entry Handler
  const handleSaveDiaryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    Sound.success(soundEnabled);
    triggerConfetti();

    onAddEntry({
      date: entryDate,
      mood: selectedMood.emoji,
      moodLabel: selectedMood.label,
      title: getFormattedDateLong(entryDate),
      content: content.trim(),
      tags,
      isLocked: isLockProtected,
      theme: currentStyleKey,
      energyLevel,
    });

    setContent('');
    setIsWritingNew(false);
  };

  // PIN Unlock Check
  const handleVerifyPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectivePin = masterPin || '1234';
    if (pinInput === effectivePin) {
      Sound.success(soundEnabled);
      if (unlockTargetId === 'global') {
        setIsGlobalVaultUnlocked(true);
      } else if (unlockTargetId) {
        setUnlockedEntryIds((prev) => new Set([...prev, unlockTargetId]));
      }
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
      setUnlockTargetId(null);
    } else {
      Sound.click(soundEnabled);
      setPinError(true);
    }
  };

  const handleOpenUnlockModal = (entryId: string) => {
    Sound.click(soundEnabled);
    setUnlockTargetId(entryId);
    setPinInput('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handleCopyEntry = (e: JournalEntry) => {
    Sound.click(soundEnabled);
    navigator.clipboard.writeText(`${e.title}\n\n${e.content}`);
    setCopiedId(e.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // On This Day calculation (entries with same month & day from prior dates/years or memorable highlights)
  const onThisDayEntry = useMemo(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const match = entries.find((e) => {
      if (!e.date) return false;
      const parts = e.date.split('-');
      return parts.length === 3 && parts[1] === mm && parts[2] === dd;
    });
    return match || (entries.length > 0 ? entries[entries.length - 1] : null);
  }, [entries]);

  // Filtered Chronological Entries
  const filteredEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        const matchesSearch =
          !searchQuery.trim() ||
          entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
          entry.date.includes(searchQuery);

        const isFav = favoriteIds.has(entry.id) || entry.isFavorite;
        const matchesFilter =
          activeFilter === 'all'
            ? true
            : activeFilter === 'favorites'
            ? isFav
            : entry.isLocked;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [entries, searchQuery, activeFilter, favoriteIds]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-7 pb-16 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* 1. DEAR DIARY HERO HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EDECE9] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="workspace-heading font-extrabold tracking-tight font-serif text-[#37352F] dark:text-white">
              DEAR DIARY
            </h1>
            <span className="text-xl">❦</span>
          </div>
          <p className="text-xs sm:text-sm text-[#787774] dark:text-[#9CA3AF] mt-0.5 font-serif italic">
            My private thoughts &amp; memories
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsWritingNew(!isWritingNew);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8C6239] hover:bg-[#78532F] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isWritingNew ? 'Close Entry' : '+ Write Today'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PAPER / PAGE STYLE SELECTOR PILLS */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(Object.keys(PAPER_STYLES) as DiaryTheme[]).map((key) => {
          const style = PAPER_STYLES[key];
          const isSelected = currentStyleKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectPaper(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#8C6239] text-white shadow-xs font-bold'
                  : 'bg-[#F7F7F5] dark:bg-[#1E293B] text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#EAEAE8]'
              }`}
            >
              <span>{style.icon}</span>
              <span>{style.name}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. REFLECTION PROMPT CARD ("Give me a prompt" - One at a time) */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
            <Feather className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF]">
              Reflection Prompt
            </div>
            <p className="text-xs sm:text-sm font-serif italic text-[#37352F] dark:text-[#E2E8F0] leading-relaxed">
              &ldquo;{activePrompt}&rdquo;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleNextPrompt}
            title="Next Prompt"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0F172A] border border-[#EDECE9] dark:border-[#334155] text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>New Prompt</span>
          </button>
          <button
            type="button"
            onClick={() => handleUsePrompt(activePrompt)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#8C6239]/10 dark:bg-[#8C6239]/20 text-[#8C6239] dark:text-[#E8DFC8] border border-[#8C6239]/30 text-xs font-bold hover:bg-[#8C6239] hover:text-white transition-all cursor-pointer"
          >
            <span>Write to this</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. WRITING SCREEN: OPEN OLD DIARY SURFACE */}
      {/* ========================================================================= */}
      {isWritingNew && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border ${currentPaper.borderClass} ${currentPaper.paperSurface} shadow-lg space-y-6 animate-in fade-in-50 duration-200`}
        >
          {/* Header Flourish & Date */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E6DEC8] dark:border-[#383025]">
            <div className="flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <span className="text-xs font-mono text-[#787774] dark:text-[#9CA3AF]">
                {getFormattedDateLong(entryDate)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/70 dark:bg-black/40 border border-gray-300 dark:border-gray-700 text-[#37352F] dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <form onSubmit={handleSaveDiaryEntry} className="space-y-5">
            {/* Dear Diary Salutation */}
            <div>
              <div className="text-lg font-serif italic font-bold text-[#3E3327] dark:text-[#E8DFC8] mb-1">
                Dear Diary,
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your candid reflections, private feelings, or the story of today..."
                rows={9}
                autoFocus
                className={`w-full p-4 rounded-2xl text-sm sm:text-base leading-relaxed bg-transparent border border-transparent focus:border-[#C4B294] dark:focus:border-[#6B5A44] ${currentPaper.textClass} ${currentPaper.fontFamily} focus:outline-none resize-y placeholder:italic placeholder:opacity-50`}
              />
            </div>

            {/* Ornamental Separator */}
            <div className="flex items-center justify-center gap-3 text-xs opacity-60">
              <span>———</span>
              <span>❦ ✦ ❦</span>
              <span>———</span>
            </div>

            {/* Mood, Energy & Tags Row (Lightweight & Unobtrusive) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Mood */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF] block mb-1">
                  Mood
                </label>
                <div className="flex flex-wrap gap-1">
                  {MOODS.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => {
                        Sound.click(soundEnabled);
                        setSelectedMood(m);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-xs transition-all cursor-pointer ${
                        selectedMood.label === m.label
                          ? 'bg-[#8C6239] text-white font-bold shadow-2xs'
                          : 'bg-white/80 dark:bg-black/30 text-[#4B5563] dark:text-[#9CA3AF] border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{m.emoji}</span> <span className="text-[10px]">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF] block mb-1">
                  Energy Level: {energyLevel}/5
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEnergyLevel(lvl)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        energyLevel >= lvl
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF] block mb-1">
                  Tags
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900 flex items-center gap-1"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-amber-600 hover:text-rose-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="+ Tag (Enter)"
                    className="px-2 py-0.5 rounded-md text-[10px] bg-white/80 dark:bg-black/30 border border-gray-300 dark:border-gray-700 w-24"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Form Actions: Save & Lock Option */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E6DEC8] dark:border-[#383025]">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#787774] dark:text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={isLockProtected}
                  onChange={(e) => setIsLockProtected(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <div className="flex items-center gap-1 font-semibold text-[#37352F] dark:text-white">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lock with Vault PIN</span>
                </div>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWritingNew(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim()}
                  className="px-5 py-2 rounded-xl bg-[#8C6239] hover:bg-[#78532F] disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
                >
                  Save Entry ❦
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ON THIS DAY (Nostalgic Memory Card) */}
      {/* ========================================================================= */}
      {onThisDayEntry && !isWritingNew && (
        <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>On This Day Memory</span>
            </div>
            <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
              {onThisDayEntry.date}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-serif italic text-amber-950 dark:text-amber-100 line-clamp-2 leading-relaxed">
            &ldquo;{onThisDayEntry.content}&rdquo;
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. FILTER BAR (All, Favorites, Locked) + Search */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveFilter('all');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#37352F] text-white dark:bg-white dark:text-[#111827]'
                : 'text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F]'
            }`}
          >
            All ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveFilter('favorites');
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'favorites'
                ? 'bg-amber-500 text-white'
                : 'text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F]'
            }`}
          >
            <Star className="w-3 h-3" />
            <span>Favorites</span>
          </button>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveFilter('locked');
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'locked'
                ? 'bg-purple-600 text-white'
                : 'text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F]'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Locked</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search diary entries..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] text-[#37352F] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#8C6239]"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. CHRONOLOGICAL JOURNAL TIMELINE CARDS */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 space-y-3">
            <span className="text-3xl">📖</span>
            <h3 className="text-base font-bold font-serif text-[#37352F] dark:text-white">
              No entries found
            </h3>
            <p className="text-xs text-[#787774] dark:text-[#9CA3AF] max-w-sm mx-auto font-serif">
              Begin capturing your personal memories, candid thoughts, or reflections for today.
            </p>
            <button
              type="button"
              onClick={() => setIsWritingNew(true)}
              className="px-4 py-2 rounded-xl bg-[#8C6239] text-white text-xs font-bold shadow-xs hover:bg-[#78532F] cursor-pointer"
            >
              + Write in Diary
            </button>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isEntryLocked =
              entry.isLocked && !isGlobalVaultUnlocked && !unlockedEntryIds.has(entry.id);
            const isFav = favoriteIds.has(entry.id) || entry.isFavorite;
            const entryTheme = PAPER_STYLES[entry.theme || currentStyleKey] || currentPaper;

            return (
              <div
                key={entry.id}
                className={`p-6 sm:p-7 rounded-3xl border ${entryTheme.borderClass} ${entryTheme.paperSurface} shadow-xs hover:shadow-md transition-all space-y-4 relative group`}
              >
                {/* Top Card Bar: Date & Mood + Favorite/Lock/Delete */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200/80 dark:border-gray-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{entry.mood || '✍️'}</span>
                    <div>
                      <div className="text-sm font-bold font-serif text-[#37352F] dark:text-white tracking-tight">
                        {entry.title || getFormattedDateLong(entry.date)}
                      </div>
                      <div className="text-[11px] font-mono text-[#787774] dark:text-[#9CA3AF]">
                        {entry.date}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Favorite Star */}
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(entry.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isFav
                          ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60'
                          : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title={isFav ? 'Remove Favorite' : 'Mark as Favorite'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-500' : ''}`} />
                    </button>

                    {/* Copy */}
                    <button
                      type="button"
                      onClick={() => handleCopyEntry(entry)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Copy text"
                    >
                      {copiedId === entry.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        Sound.click(soundEnabled);
                        onDeleteEntry(entry.id);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Entry Content (Or Locked Mask) */}
                {isEntryLocked ? (
                  <div className="p-6 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-center space-y-3">
                    <Lock className="w-6 h-6 text-amber-600 mx-auto" />
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        This diary entry is lock-protected
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Unlock with your master vault PIN to view
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenUnlockModal(entry.id)}
                      className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unlock Entry</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p
                      className={`text-sm sm:text-base leading-relaxed ${entryTheme.textClass} ${entryTheme.fontFamily} whitespace-pre-wrap`}
                    >
                      {entry.content}
                    </p>

                    {/* Tags & Energy */}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        {entry.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 8. PIN UNLOCK MODAL */}
      {/* ========================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-[#37352F] dark:text-white font-serif">
                  Unlock Diary Vault
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
              Enter your master security PIN ({masterPin ? 'Configured in Vault' : 'Default: 1234'})
              to view your locked thoughts.
            </p>

            <form onSubmit={handleVerifyPinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  autoFocus
                  maxLength={8}
                  placeholder="Enter PIN..."
                  className="w-full text-center tracking-widest text-lg font-mono px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111827] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {pinError && (
                  <p className="text-xs text-rose-500 font-semibold mt-1.5 text-center">
                    Incorrect PIN. Try again.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="w-1/2 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-[#8C6239] hover:bg-[#78532F] text-white text-xs font-bold shadow-md"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
