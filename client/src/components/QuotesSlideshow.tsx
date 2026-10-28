import React, { useState, useEffect } from 'react';
import { Quote, Plus, ChevronLeft, ChevronRight, Trash2, Sparkles, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { QuoteItem } from '../types';
import { Sound } from '../utils/audio';

interface QuotesSlideshowProps {
  quotes: QuoteItem[];
  onAddQuote: (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => void;
  onDeleteQuote: (id: string) => void;
  soundEnabled: boolean;
}

export const QuotesSlideshow: React.FC<QuotesSlideshowProps> = ({
  quotes,
  onAddQuote,
  onDeleteQuote,
  soundEnabled,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('Inspiration');

  // Auto-play slideshow timer with smooth interval
  useEffect(() => {
    if (!isAutoPlay || quotes.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % quotes.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isAutoPlay, quotes.length]);

  // Adjust index if out of bounds
  useEffect(() => {
    if (currentIndex >= quotes.length && quotes.length > 0) {
      setCurrentIndex(quotes.length - 1);
    }
  }, [quotes.length, currentIndex]);

  const handleNext = () => {
    Sound.click(soundEnabled);
    setDirection(1);
    if (quotes.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % quotes.length);
    }
  };

  const handlePrev = () => {
    Sound.click(soundEnabled);
    setDirection(-1);
    if (quotes.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + quotes.length) % quotes.length);
    }
  };

  const handleSelectDot = (idx: number) => {
    Sound.click(soundEnabled);
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    Sound.success(soundEnabled);
    onAddQuote({
      text: newText.trim(),
      author: newAuthor.trim() || 'Unknown',
      category: newCategory.trim() || 'Inspiration',
    });
    setNewText('');
    setNewAuthor('');
    setShowAddModal(false);
    setCurrentIndex(quotes.length);
  };

  const currentQuote = quotes[currentIndex];

  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 30 : -30,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.35 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -30 : 30,
      opacity: 0,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 },
      },
    }),
  };

  return (
    <div
      onMouseEnter={() => setIsAutoPlay(false)}
      onMouseLeave={() => setIsAutoPlay(true)}
      className="relative rounded-2xl border border-[#EDECE9] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-2xs transition-all overflow-hidden group"
    >
      {/* Decorative Quote Icon Watermark */}
      <div className="absolute top-2 right-4 text-[#EDECE9] dark:text-[#1F2937] pointer-events-none select-none">
        <Quote className="w-16 h-16 opacity-30 rotate-12" />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Quote Content with Smooth Slide Transition */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>

          <div className="min-w-0 space-y-1 flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#787774] dark:text-[#9CA3AF]">
                Reflections & Quotes
              </span>
              {quotes.length > 0 && currentQuote?.category && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-[#F1F1EF] dark:bg-[#1F2937] text-[#787774] dark:text-[#9CA3AF]">
                  {currentQuote.category}
                </span>
              )}
              {quotes.length > 1 && (
                <span className="text-[9px] font-mono text-[#9CA3AF] flex items-center gap-1">
                  {isAutoPlay ? (
                    <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                      <Play className="w-2.5 h-2.5 inline" /> Auto
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[#9CA3AF]">
                      <Pause className="w-2.5 h-2.5 inline" /> Paused
                    </span>
                  )}
                </span>
              )}
            </div>

            {quotes.length === 0 ? (
              <div className="text-xs text-[#787774] dark:text-[#9CA3AF] italic">
                No quotes added yet. Click &quot;+ Add Quote&quot; to save personal mantras, inspiring thoughts, or principles.
              </div>
            ) : (
              <div className="relative min-h-[48px] flex flex-col justify-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentQuote?.id || currentIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-1"
                  >
                    <p className="text-xs sm:text-sm font-serif italic text-[#37352F] dark:text-[#F3F4F6] leading-relaxed">
                      &ldquo;{currentQuote.text}&rdquo;
                    </p>
                    <p className="text-[11px] font-medium text-[#787774] dark:text-[#9CA3AF]">
                      — {currentQuote.author}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Controls: Prev/Next, Dot indicators, Add Quote */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F3F4F6] dark:border-[#1F2937]">
          {quotes.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937] cursor-pointer transition-colors"
                title="Previous Quote"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Progress Dots */}
              <div className="flex items-center gap-1 px-1">
                {quotes.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectDot(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentIndex
                        ? 'w-4 bg-[#6366F1]'
                        : 'w-1.5 bg-[#D1D5DB] dark:bg-[#374151] hover:bg-[#9CA3AF]'
                    }`}
                    title={`Go to quote ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937] cursor-pointer transition-colors"
                title="Next Quote"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {currentQuote && (
                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    onDeleteQuote(currentQuote.id);
                  }}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors ml-1"
                  title="Delete this quote"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F7F7F5] dark:bg-[#1F2937] hover:bg-[#EDECE9] dark:hover:bg-[#374151] border border-[#EDECE9] dark:border-[#374151] text-xs font-semibold text-[#37352F] dark:text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>Add Quote</span>
          </button>
        </div>
      </div>

      {/* Add Quote Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#1F2937] p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Quote className="w-4 h-4 text-amber-500" />
                <span>Add Inspiring Quote or Mantra</span>
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
                Quote Text
              </label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="e.g. Simplicity is prerequisite for reliability."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Author / Source
                </label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="e.g. Edsger W. Dijkstra"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Philosophy, Focus, Code"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
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
                disabled={!newText.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Save Quote
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
