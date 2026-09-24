import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, CheckSquare, CreditCard, Flame, BookOpen, Quote as QuoteIcon, Film, Target, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TodoItem, ExpenseItem, HabitItem, JournalEntry, QuoteItem, MediaItem, GoalItem, MainNavView } from '../../../types';
import { nativeService } from '../../../services/nativeService';

export interface AndroidSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: MainNavView) => void;
  todos: TodoItem[];
  expenses: ExpenseItem[];
  habits: HabitItem[];
  journal: JournalEntry[];
  quotes: QuoteItem[];
  media: MediaItem[];
  goals: GoalItem[];
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'task' | 'expense' | 'habit' | 'journal' | 'quote' | 'media' | 'goal';
  view: MainNavView;
  icon: React.ReactNode;
}

export const AndroidSearchOverlay: React.FC<AndroidSearchOverlayProps> = ({
  isOpen,
  onClose,
  onNavigate,
  todos,
  expenses,
  habits,
  journal,
  quotes,
  media,
  goals,
}) => {
  const [query, setQuery] = useState('');

  // Register with Android hardware back button
  useEffect(() => {
    if (!isOpen) return;
    const unregister = nativeService.registerBackButtonHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  const results: SearchResultItem[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const list: SearchResultItem[] = [];

    // Search tasks
    todos.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)) {
        list.push({
          id: `task-${t.id}`,
          title: t.title,
          subtitle: `Task · Priority: ${t.priority.toUpperCase()}`,
          type: 'task',
          view: 'tasks',
          icon: <CheckSquare className="w-4 h-4 text-violet-500" />,
        });
      }
    });

    // Search expenses
    expenses.forEach((e) => {
      if (e.name.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)) {
        list.push({
          id: `expense-${e.id}`,
          title: e.name,
          subtitle: `Expense · ₹${e.amount} (${e.category})`,
          type: 'expense',
          view: 'expenses',
          icon: <CreditCard className="w-4 h-4 text-emerald-500" />,
        });
      }
    });

    // Search habits
    habits.forEach((h) => {
      if (h.title.toLowerCase().includes(q) || h.category?.toLowerCase().includes(q)) {
        list.push({
          id: `habit-${h.id}`,
          title: h.title,
          subtitle: `Habit · Streak: ${h.streak}d`,
          type: 'habit',
          view: 'habits',
          icon: <Flame className="w-4 h-4 text-amber-500" />,
        });
      }
    });

    // Search journal
    journal.forEach((j) => {
      if (j.title.toLowerCase().includes(q) || j.content.toLowerCase().includes(q)) {
        list.push({
          id: `journal-${j.id}`,
          title: j.title,
          subtitle: `Journal · ${j.date}`,
          type: 'journal',
          view: 'journal',
          icon: <BookOpen className="w-4 h-4 text-pink-500" />,
        });
      }
    });

    // Search quotes
    quotes.forEach((qu) => {
      if (qu.text.toLowerCase().includes(q) || qu.author.toLowerCase().includes(q)) {
        list.push({
          id: `quote-${qu.id}`,
          title: `"${qu.text.slice(0, 45)}..."`,
          subtitle: `Quote · ${qu.author}`,
          type: 'quote',
          view: 'quotes',
          icon: <QuoteIcon className="w-4 h-4 text-violet-500" />,
        });
      }
    });

    // Search media
    media.forEach((m) => {
      if (m.title.toLowerCase().includes(q) || m.creator.toLowerCase().includes(q)) {
        list.push({
          id: `media-${m.id}`,
          title: m.title,
          subtitle: `Media · ${m.creator} (${m.type})`,
          type: 'media',
          view: 'media',
          icon: <Film className="w-4 h-4 text-blue-500" />,
        });
      }
    });

    // Search goals
    goals.forEach((g) => {
      if (g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) {
        list.push({
          id: `goal-${g.id}`,
          title: g.title,
          subtitle: `Goal · ${g.progress}% complete`,
          type: 'goal',
          view: 'goals',
          icon: <Target className="w-4 h-4 text-indigo-500" />,
        });
      }
    });

    return list.slice(0, 20);
  }, [query, todos, expenses, habits, journal, quotes, media, goals]);

  const handleSelectResult = (res: SearchResultItem) => {
    void nativeService.triggerHaptic('selection');
    onClose();
    onNavigate(res.view);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed inset-0 z-50 bg-[#F7F6FC] dark:bg-[#0B0F19] flex flex-col pt-[env(safe-area-inset-top)] px-3 select-none"
      >
        {/* Top Search Bar */}
        <div className="h-14 flex items-center gap-2 border-b border-[#E8E5F3] dark:border-[#242D40] pb-2">
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, money, notes, habits..."
              className="w-full bg-transparent text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {query.trim() === '' ? (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                Type to search across your entire dashboard
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                No matching results found for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectResult(item)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs active:scale-[0.99] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-[#1A2234] flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
