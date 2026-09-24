import React, { useState, useMemo } from 'react';
import { Quote as QuoteIcon, Plus, Copy, Check, Trash2, Sparkles, Share2 } from 'lucide-react';
import { QuoteItem } from '../../../../types';
import { INITIAL_QUOTES } from '../../../../utils/storage';
import { nativeService } from '../../../../services/nativeService';
import { BottomSheet } from '../../gestures/BottomSheet';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';

export interface AndroidQuotesScreenProps {
  quotes: QuoteItem[];
  onAddQuote?: (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => void;
  onDeleteQuote?: (id: string) => void;
}

export const AndroidQuotesScreen: React.FC<AndroidQuotesScreenProps> = ({
  quotes,
  onAddQuote,
  onDeleteQuote,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeActionQuote, setActiveActionQuote] = useState<QuoteItem | null>(null);

  // Form states
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCat, setNewCat] = useState('Wisdom');

  const availableQuotes = quotes && quotes.length > 0 ? quotes : INITIAL_QUOTES;

  const categories = useMemo(() => {
    const set = new Set<string>();
    availableQuotes.forEach((q) => {
      if (q.category) set.add(q.category);
    });
    return ['All', ...Array.from(set)];
  }, [availableQuotes]);

  const filteredQuotes = useMemo(() => {
    if (selectedCategory === 'All') return availableQuotes;
    return availableQuotes.filter((q) => q.category === selectedCategory);
  }, [availableQuotes, selectedCategory]);

  const handleCopy = (quote: QuoteItem) => {
    void nativeService.triggerHaptic('success');
    navigator.clipboard.writeText(`"${quote.text}" — ${quote.author}`);
    setCopiedId(quote.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !onAddQuote) return;
    void nativeService.triggerHaptic('success');
    onAddQuote({
      text: newText.trim(),
      author: newAuthor.trim() || 'Unknown',
      category: newCat,
    });
    setNewText('');
    setNewAuthor('');
    setIsAddSheetOpen(false);
  };

  const actionItems: ActionSheetItem[] = activeActionQuote
    ? [
        {
          label: 'Copy Quote',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => handleCopy(activeActionQuote),
        },
        {
          label: 'Delete Quote',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => {
            if (onDeleteQuote) {
              void nativeService.triggerHaptic('warning');
              onDeleteQuote(activeActionQuote.id);
            }
          },
        },
      ]
    : [];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Quotes & Mantras
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {availableQuotes.length} inspirational quotes
          </p>
        </div>

        {onAddQuote && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Quote</span>
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setSelectedCategory(cat);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border border-violet-300'
                : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Quote Cards */}
      <div className="space-y-3">
        {filteredQuotes.map((q) => (
          <div
            key={q.id}
            className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3 relative overflow-hidden group"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                <QuoteIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium italic text-gray-800 dark:text-gray-200 leading-relaxed">
                  &ldquo;{q.text}&rdquo;
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                    — {q.author}
                  </span>
                  <div className="flex items-center gap-2">
                    {q.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A2234] text-gray-500 font-semibold">
                        {q.category}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(q)}
                      className="p-1.5 rounded-full text-gray-400 hover:text-violet-600 active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedId === q.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Quote Bottom Sheet */}
      <BottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="Add Inspirational Quote"
        subtitle="Capture words that move you forward"
      >
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Quote Content
            </label>
            <textarea
              required
              rows={3}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="&ldquo;We suffer more often in imagination than in reality.&rdquo;"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Author
              </label>
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="e.g. Seneca, Marcus Aurelius"
                className="w-full px-3 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Category
              </label>
              <input
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Stoicism, Discipline, Focus"
                className="w-full px-3 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Save Quote
          </button>
        </form>
      </BottomSheet>

      {/* Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionQuote)}
        onClose={() => setActiveActionQuote(null)}
        title="Quote Actions"
        subtitle={activeActionQuote?.author}
        actions={actionItems}
      />
    </div>
  );
};
