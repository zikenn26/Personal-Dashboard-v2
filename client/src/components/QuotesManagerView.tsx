import React, { useState, useMemo, useEffect } from 'react';
import {
  Quote,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Shuffle,
  Compass,
  ArrowRight,
  Flame,
  Lightbulb,
  LayoutGrid,
  List,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QuoteItem } from '../types';
import { Sound } from '../utils/audio';
import { INITIAL_QUOTES } from '../utils/storage';

interface QuotesManagerViewProps {
  quotes: QuoteItem[];
  onAddQuote: (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => void;
  onUpdateQuote: (id: string, quote: Partial<QuoteItem>) => void;
  onDeleteQuote: (id: string) => void;
  onNavigate?: (view: any, tabOrFilter?: string) => void;
  soundEnabled: boolean;
}

export const QuotesManagerView: React.FC<QuotesManagerViewProps> = ({
  quotes: rawQuotes = [],
  onAddQuote,
  onUpdateQuote,
  onDeleteQuote,
  onNavigate,
  soundEnabled,
}) => {
  const quotes = rawQuotes && rawQuotes.length > 0 ? rawQuotes : INITIAL_QUOTES;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State for Add & Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [formText, setFormText] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState('Inspiration');

  // Preview Slideshow Carousel State (10 seconds automatic)
  const [slideshowIdx, setSlideshowIdx] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(true);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    quotes.forEach((q) => {
      if (q.category) set.add(q.category);
    });
    return ['All', ...Array.from(set)];
  }, [quotes]);

  // Filtered and searched quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchCategory =
        selectedCategory === 'All' ||
        (q.category && q.category.toLowerCase() === selectedCategory.toLowerCase());
      const matchSearch =
        searchQuery.trim() === '' ||
        q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.category && q.category.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [quotes, selectedCategory, searchQuery]);

  // 10-Second Auto-Slideshow on the live preview
  useEffect(() => {
    if (!isSlideshowPlaying || quotes.length <= 1) return;
    const timer = setInterval(() => {
      setSlideshowIdx((prev) => (prev + 1) % quotes.length);
    }, 10000); // exactly 10s
    return () => clearInterval(timer);
  }, [isSlideshowPlaying, quotes.length]);

  // Slideshow navigation controls
  const handlePrevSlide = () => {
    Sound.click(soundEnabled);
    if (quotes.length > 0) {
      setSlideshowIdx((prev) => (prev - 1 + quotes.length) % quotes.length);
    }
  };

  const handleNextSlide = () => {
    Sound.click(soundEnabled);
    if (quotes.length > 0) {
      setSlideshowIdx((prev) => (prev + 1) % quotes.length);
    }
  };

  // Open modal for New Quote
  const handleOpenAddModal = () => {
    Sound.click(soundEnabled);
    setEditingQuoteId(null);
    setFormText('');
    setFormAuthor('');
    setFormCategory('Inspiration');
    setIsModalOpen(true);
  };

  // Open modal for Editing Quote
  const handleOpenEditModal = (quote: QuoteItem) => {
    Sound.click(soundEnabled);
    setEditingQuoteId(quote.id);
    setFormText(quote.text);
    setFormAuthor(quote.author);
    setFormCategory(quote.category || 'Inspiration');
    setIsModalOpen(true);
  };

  // Save Modal (Create or Update)
  const handleSaveQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    if (editingQuoteId) {
      onUpdateQuote(editingQuoteId, {
        text: formText.trim(),
        author: formAuthor.trim() || 'Anonymous',
        category: formCategory.trim() || 'Inspiration',
      });
      Sound.success(soundEnabled);
    } else {
      onAddQuote({
        text: formText.trim(),
        author: formAuthor.trim() || 'Anonymous',
        category: formCategory.trim() || 'Inspiration',
      });
      Sound.success(soundEnabled);
    }

    setIsModalOpen(false);
    setEditingQuoteId(null);
  };

  // Copy quote text to clipboard
  const handleCopyQuote = (q: QuoteItem) => {
    navigator.clipboard.writeText(`"${q.text}" — ${q.author}`);
    setCopiedId(q.id);
    Sound.click(soundEnabled);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeSlideQuote = quotes[slideshowIdx % (quotes.length || 1)];

  return (
    <div className="space-y-6">
      {/* 1. Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDECE9] dark:border-[#1F2937]">
        <div className="space-y-1">
          <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
              <Quote className="w-5 h-5" />
            </span>
            <span>Quotes & Reflections</span>
          </h1>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
            Curate personal mantras and guiding principles. These rotate in a 10-second slideshow on your Home dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#F7F7F5] dark:bg-[#1F2937] hover:bg-[#EDECE9] dark:hover:bg-[#374151] border border-[#EDECE9] dark:border-[#374151] text-[#37352F] dark:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>View on Home</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Quote</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive 10-Second Slideshow Preview Banner */}
      {quotes.length > 0 && activeSlideQuote && (
        <div className="relative rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 dark:from-amber-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 p-4 sm:p-5 shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-white dark:bg-[#1E293B] text-amber-600 dark:text-amber-400 shadow-2xs border border-[#EDECE9] dark:border-[#334155] shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>

              <div className="min-w-0 space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6366F1] dark:text-[#818CF8] bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                    Live Home Slideshow (10s Auto)
                  </span>
                  {activeSlideQuote.category && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#1F2937]/80 text-[#787774] dark:text-[#9CA3AF] border border-[#E5E7EB] dark:border-[#374151]">
                      {activeSlideQuote.category}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-[#9CA3AF]">
                    Quote {slideshowIdx + 1} of {quotes.length}
                  </span>
                </div>

                <div className="min-h-[48px] flex flex-col justify-center">
                  <p className="text-sm sm:text-base font-serif italic text-[#1F2937] dark:text-[#F3F4F6] leading-relaxed">
                    &ldquo;{activeSlideQuote.text}&rdquo;
                  </p>
                  <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    — {activeSlideQuote.author}
                  </p>
                </div>
              </div>
            </div>

            {/* Slideshow Control Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-indigo-100 dark:border-indigo-900/30">
              <button
                type="button"
                onClick={handlePrevSlide}
                className="p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#4B5563] dark:text-[#E2E8F0] hover:text-[#6366F1] hover:border-[#6366F1] shadow-2xs cursor-pointer transition-all"
                title="Previous Quote"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setIsSlideshowPlaying((prev) => !prev);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-xs font-semibold text-[#4B5563] dark:text-[#E2E8F0] shadow-2xs hover:border-[#6366F1] cursor-pointer transition-all"
                title={isSlideshowPlaying ? 'Pause automatic 10s rotation' : 'Resume automatic 10s rotation'}
              >
                {isSlideshowPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto (10s)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Paused</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextSlide}
                className="p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#4B5563] dark:text-[#E2E8F0] hover:text-[#6366F1] hover:border-[#6366F1] shadow-2xs cursor-pointer transition-all"
                title="Next Quote"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenEditModal(activeSlideQuote)}
                className="p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#4B5563] dark:text-[#E2E8F0] hover:text-[#6366F1] hover:border-[#6366F1] shadow-2xs cursor-pointer transition-all"
                title="Edit this quote"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search Bar, Category Filters, and Grid/List Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quotes by author, words, or category..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[#37352F] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-start">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full">
            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#6366F1] text-white shadow-2xs'
                      : 'bg-white dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F7F7F5] dark:hover:bg-[#374151]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Grid / List Toggle */}
          <div className="flex items-center p-1 bg-[#F3F4F6] dark:bg-[#1F2937] rounded-xl border border-[#E5E7EB] dark:border-[#374151] shrink-0">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setViewMode('grid');
              }}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setViewMode('list');
              }}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Quotes Display (Grid or List) */}
      {filteredQuotes.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-[#EDECE9] dark:border-[#1F2937] space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Quote className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-bold text-[#37352F] dark:text-white">
              {searchQuery ? 'No matching quotes found' : 'No quotes in your collection yet'}
            </h3>
            <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
              {searchQuery
                ? 'Try searching with different keywords or clear the category filter.'
                : 'Add personal mantras or import a curated inspiration pack below.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold shadow-2xs hover:bg-[#4F46E5] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Quote</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((q) => (
            <div
              key={q.id}
              className="relative group rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] p-5 shadow-2xs hover:shadow-sm hover:border-[#6366F1]/50 transition-all flex flex-col justify-between"
            >
              {/* Decorative Watermark */}
              <Quote className="absolute top-3 right-3 w-10 h-10 text-[#F1F1EF] dark:text-[#0F172A] rotate-12 pointer-events-none group-hover:text-indigo-100/50 dark:group-hover:text-indigo-950/40 transition-colors" />

              <div className="space-y-3 relative z-10">
                {/* Category Pill */}
                {q.category && (
                  <span className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A] text-[#6366F1] dark:text-[#818CF8] border border-[#E2E8F0] dark:border-[#334155]">
                    {q.category}
                  </span>
                )}

                {/* Quote Content */}
                <p className="text-sm sm:text-base font-serif italic text-[#37352F] dark:text-[#F3F4F6] leading-relaxed">
                  &ldquo;{q.text}&rdquo;
                </p>

                {/* Author */}
                <p className="text-xs font-semibold text-[#787774] dark:text-[#94A3B8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>{q.author}</span>
                </p>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F3F4F6] dark:border-[#334155]/60 relative z-10">
                <button
                  type="button"
                  onClick={() => handleCopyQuote(q)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#787774] dark:text-[#9CA3AF] hover:text-[#6366F1] dark:hover:text-white transition-colors cursor-pointer"
                  title="Copy quote to clipboard"
                >
                  {copiedId === q.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(q)}
                    className="p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] cursor-pointer transition-colors"
                    title="Edit quote"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onDeleteQuote(q.id);
                    }}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                    title="Delete quote"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode View */
        <div className="rounded-2xl border border-[#EDECE9] dark:border-[#334155] bg-white dark:bg-[#1E293B] overflow-hidden shadow-2xs divide-y divide-[#F3F4F6] dark:divide-[#334155]/60">
          {filteredQuotes.map((q) => (
            <div
              key={q.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F9FAFB] dark:hover:bg-[#111827]/40 transition-colors group"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {q.category && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#0F172A] text-[#6366F1] dark:text-[#818CF8] border border-[#E2E8F0] dark:border-[#334155]">
                      {q.category}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-[#787774] dark:text-[#94A3B8] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>{q.author}</span>
                  </span>
                </div>
                <p className="text-sm font-serif italic text-[#37352F] dark:text-[#F3F4F6] leading-relaxed">
                  &ldquo;{q.text}&rdquo;
                </p>
              </div>

              {/* Action Buttons in List row */}
              <div className="flex items-center gap-1.5 sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F3F4F6] dark:border-[#334155]/40 justify-end">
                <button
                  type="button"
                  onClick={() => handleCopyQuote(q)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy quote"
                >
                  {copiedId === q.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(q)}
                  className="p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] cursor-pointer transition-colors"
                  title="Edit quote"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    onDeleteQuote(q.id);
                  }}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                  title="Delete quote"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Add / Edit Quote Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveQuoteSubmit}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EDECE9] dark:border-[#334155]">
              <h3 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Quote className="w-4 h-4 text-[#6366F1]" />
                <span>{editingQuoteId ? 'Edit Quote & Mantra' : 'Add New Quote & Mantra'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#37352F] dark:text-[#E2E8F0] mb-1">
                  Quote Content *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="e.g. Focus on being productive instead of busy."
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[#111827] dark:text-[#F3F4F6] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#37352F] dark:text-[#E2E8F0] mb-1">
                    Author / Source
                  </label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="e.g. Tim Ferriss, Steve Jobs, Marcus Aurelius"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[#111827] dark:text-[#F3F4F6] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#37352F] dark:text-[#E2E8F0] mb-1">
                    Category / Tag
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Inspiration, Focus, Philosophy, Mindset"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[#111827] dark:text-[#F3F4F6] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EDECE9] dark:border-[#334155]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#0F172A] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formText.trim()}
                className="px-5 py-2 text-xs font-bold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                {editingQuoteId ? 'Update Quote' : 'Save to Collection'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
