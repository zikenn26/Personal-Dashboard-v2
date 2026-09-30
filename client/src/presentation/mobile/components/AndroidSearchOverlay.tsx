import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  CheckSquare,
  CreditCard,
  Flame,
  BookOpen,
  Quote as QuoteIcon,
  Film,
  Target,
  ArrowRight,
  Home,
  Shield,
  Briefcase,
  GraduationCap,
  Settings,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TodoItem,
  ExpenseItem,
  HabitItem,
  JournalEntry,
  QuoteItem,
  MediaItem,
  GoalItem,
  MainNavView,
} from '../../../types';
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
  type: 'page' | 'task' | 'expense' | 'habit' | 'journal' | 'quote' | 'media' | 'goal';
  view: MainNavView;
  icon: React.ReactNode;
}

interface PageSuggestion {
  id: string;
  title: string;
  subtitle: string;
  view: MainNavView;
  icon: React.ReactNode;
  keywords: string[];
}

const DASHBOARD_PAGES: PageSuggestion[] = [
  {
    id: 'page-home',
    title: 'Home Dashboard',
    subtitle: 'Overview, Quick Actions & Live Weather',
    view: 'home',
    icon: <Home className="w-4 h-4 text-blue-500" />,
    keywords: ['home', 'dashboard', 'overview', 'main', 'start', 'weather', 'today', 'welcome'],
  },
  {
    id: 'page-expenses',
    title: 'Money & Expenses',
    subtitle: 'Bank SMS Tracker, Budgets & Excel Upload',
    view: 'expenses',
    icon: <CreditCard className="w-4 h-4 text-emerald-500" />,
    keywords: [
      'money',
      'expense',
      'expenses',
      'spending',
      'spend',
      'budget',
      'finance',
      'sms',
      'bank',
      'transactions',
      'excel',
      'sheets',
      'upi',
    ],
  },
  {
    id: 'page-tasks',
    title: 'Tasks & Kanban',
    subtitle: 'To-Do Lists, Priorities & Project Workflows',
    view: 'tasks',
    icon: <CheckSquare className="w-4 h-4 text-violet-500" />,
    keywords: ['tasks', 'task', 'todo', 'todos', 'checklist', 'kanban', 'work', 'priority', 'pending'],
  },
  {
    id: 'page-habits',
    title: 'Daily Habits',
    subtitle: 'Habit Matrix, Streaks & Weekly Momentum',
    view: 'habits',
    icon: <Flame className="w-4 h-4 text-amber-500" />,
    keywords: ['habits', 'habit', 'streak', 'routine', 'momentum', 'daily', 'tracking', 'consistency'],
  },
  {
    id: 'page-goals',
    title: 'Goals & Vision',
    subtitle: 'Life Aspirations, Milestones & Progress',
    view: 'goals',
    icon: <Target className="w-4 h-4 text-indigo-500" />,
    keywords: ['goals', 'goal', 'targets', 'vision', 'milestones', 'aspirations', 'future', 'career'],
  },
  {
    id: 'page-journal',
    title: 'Diary & Journal',
    subtitle: 'Personal Reflections, Notes & Memories',
    view: 'journal',
    icon: <BookOpen className="w-4 h-4 text-pink-500" />,
    keywords: ['journal', 'diary', 'notes', 'note', 'memories', 'reflections', 'thoughts', 'writing'],
  },
  {
    id: 'page-vault',
    title: 'Password Vault',
    subtitle: 'Encrypted Passwords, Credentials & API Keys',
    view: 'vault',
    icon: <Shield className="w-4 h-4 text-amber-600" />,
    keywords: [
      'vault',
      'password',
      'passwords',
      'secrets',
      'pins',
      'keys',
      'credentials',
      'security',
      'auth',
      'tokens',
    ],
  },
  {
    id: 'page-media',
    title: 'Media & Library',
    subtitle: 'Books, Movies, Anime & Watchlists',
    view: 'media',
    icon: <Film className="w-4 h-4 text-sky-500" />,
    keywords: ['media', 'books', 'movies', 'library', 'reading', 'anime', 'watchlist', 'shows', 'films'],
  },
  {
    id: 'page-quotes',
    title: 'Quotes & Wisdom',
    subtitle: 'Daily Philosophy & Motivational Wisdom',
    view: 'quotes',
    icon: <QuoteIcon className="w-4 h-4 text-purple-500" />,
    keywords: ['quotes', 'quote', 'inspiration', 'wisdom', 'motivational', 'philosophy'],
  },
  {
    id: 'page-workfolio',
    title: 'Workfolio & Bio',
    subtitle: 'Professional Profile, Projects & Skills',
    view: 'workfolio',
    icon: <Briefcase className="w-4 h-4 text-indigo-500" />,
    keywords: ['workfolio', 'portfolio', 'resume', 'cv', 'experience', 'projects', 'skills', 'bio', 'profile'],
  },
  {
    id: 'page-exams',
    title: 'Exams & Academics',
    subtitle: 'Exam Schedule, Syllabus & Preparation',
    view: 'exams',
    icon: <GraduationCap className="w-4 h-4 text-teal-500" />,
    keywords: ['exams', 'exam', 'academics', 'tests', 'study', 'education', 'courses'],
  },
  {
    id: 'page-backup',
    title: 'Settings & Cloud Backup',
    subtitle: 'Supabase Cloud Sync, Export & Preferences',
    view: 'backup',
    icon: <Settings className="w-4 h-4 text-gray-500" />,
    keywords: ['settings', 'backup', 'cloud', 'profile', 'sync', 'account', 'supabase', 'export'],
  },
];

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
  const [filterType, setFilterType] = useState<'all' | 'pages' | 'records'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  // Register with Android hardware back button
  useEffect(() => {
    if (!isOpen) return;
    const unregister = nativeService.registerBackButtonHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setFilterType('all');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const results: SearchResultItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list: SearchResultItem[] = [];

    // 1. MATCH PAGES & COMPONENTS
    if (filterType === 'all' || filterType === 'pages') {
      DASHBOARD_PAGES.forEach((page) => {
        if (!q) {
          // If query is empty, add all pages as suggestions
          list.push({
            id: page.id,
            title: page.title,
            subtitle: page.subtitle,
            type: 'page',
            view: page.view,
            icon: page.icon,
          });
        } else {
          const matchTitle = page.title.toLowerCase().includes(q);
          const matchSubtitle = page.subtitle.toLowerCase().includes(q);
          const matchKeyword = page.keywords.some((kw) => kw.includes(q) || q.includes(kw));

          if (matchTitle || matchSubtitle || matchKeyword) {
            list.push({
              id: page.id,
              title: page.title,
              subtitle: page.subtitle,
              type: 'page',
              view: page.view,
              icon: page.icon,
            });
          }
        }
      });
    }

    // 2. MATCH USER DATA RECORDS (Only if user has typed a query, or if viewing records)
    if (q && (filterType === 'all' || filterType === 'records')) {
      // Search tasks
      todos.forEach((t) => {
        if (t.title.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)) {
          list.push({
            id: `task-${t.id}`,
            title: t.title,
            subtitle: `Task · Priority: ${t.priority?.toUpperCase() || 'NORMAL'}`,
            type: 'task',
            view: 'tasks',
            icon: <CheckSquare className="w-4 h-4 text-violet-500" />,
          });
        }
      });

      // Search expenses
      expenses.forEach((e) => {
        if (
          e.name?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.bankName?.toLowerCase().includes(q)
        ) {
          list.push({
            id: `expense-${e.id}`,
            title: e.name,
            subtitle: `Expense · ₹${e.amount} (${e.category || 'General'})`,
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
            subtitle: `Habit · Streak: ${h.streak || 0}d`,
            type: 'habit',
            view: 'habits',
            icon: <Flame className="w-4 h-4 text-amber-500" />,
          });
        }
      });

      // Search journal
      journal.forEach((j) => {
        if (j.title?.toLowerCase().includes(q) || j.content?.toLowerCase().includes(q)) {
          list.push({
            id: `journal-${j.id}`,
            title: j.title || 'Journal Note',
            subtitle: `Journal · ${j.date || 'Recent'}`,
            type: 'journal',
            view: 'journal',
            icon: <BookOpen className="w-4 h-4 text-pink-500" />,
          });
        }
      });

      // Search quotes
      quotes.forEach((qu) => {
        if (qu.text?.toLowerCase().includes(q) || qu.author?.toLowerCase().includes(q)) {
          list.push({
            id: `quote-${qu.id}`,
            title: `"${qu.text.slice(0, 45)}..."`,
            subtitle: `Quote · ${qu.author}`,
            type: 'quote',
            view: 'quotes',
            icon: <QuoteIcon className="w-4 h-4 text-purple-500" />,
          });
        }
      });

      // Search media
      media.forEach((m) => {
        if (m.title?.toLowerCase().includes(q) || m.creator?.toLowerCase().includes(q)) {
          list.push({
            id: `media-${m.id}`,
            title: m.title,
            subtitle: `Media · ${m.creator || 'Item'} (${m.type || 'Library'})`,
            type: 'media',
            view: 'media',
            icon: <Film className="w-4 h-4 text-sky-500" />,
          });
        }
      });

      // Search goals
      goals.forEach((g) => {
        if (g.title?.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q)) {
          list.push({
            id: `goal-${g.id}`,
            title: g.title,
            subtitle: `Goal · ${g.progress || 0}% complete`,
            type: 'goal',
            view: 'goals',
            icon: <Target className="w-4 h-4 text-indigo-500" />,
          });
        }
      });
    }

    return list.slice(0, 30);
  }, [query, filterType, todos, expenses, habits, journal, quotes, media, goals]);

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
        <div className="h-14 flex items-center gap-2 border-b border-[#E8E5F3] dark:border-[#242D40] pb-2 shrink-0">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, money, tasks, habits..."
              className="w-full bg-transparent text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 py-2 border-b border-[#E8E5F3]/60 dark:border-[#242D40]/60 shrink-0 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'All Results' },
              { id: 'pages', label: 'Pages & Hubs' },
              { id: 'records', label: 'Records & Items' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setFilterType(tab.id);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto py-2.5 space-y-1.5">
          {!query.trim() && (
            <div className="px-1 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Suggested Pages & Components
              </span>
              <span className="text-[10px] text-gray-400">
                {results.length} destinations
              </span>
            </div>
          )}

          {query.trim() && results.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                No matching results found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Try searching for money, tasks, habits, vault, or books.
              </p>
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectResult(item)}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs active:scale-[0.99] transition-all text-left cursor-pointer hover:border-violet-300 dark:hover:border-violet-700/60 group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-[#1A2234] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.type === 'page' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/40">
                      Page
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AndroidSearchOverlay;
