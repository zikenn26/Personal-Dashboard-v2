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
  activeView?: MainNavView;
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
      'export',
      'csv',
      'download',
      'statement',
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
  activeView = 'home',
  todos,
  expenses,
  habits,
  journal,
  quotes,
  media,
  goals,
}) => {
  const [query, setQuery] = useState('');

  // Determine current section scope from activeView
  const defaultScope = useMemo<'section' | 'pages' | 'all'>(() => {
    if (activeView === 'home') return 'pages';
    return 'section';
  }, [activeView]);

  const [filterType, setFilterType] = useState<'section' | 'pages' | 'all'>(defaultScope);
  const inputRef = useRef<HTMLInputElement>(null);

  // Section details
  const sectionInfo = useMemo(() => {
    switch (activeView) {
      case 'tasks':
        return {
          id: 'tasks',
          label: 'Tasks',
          placeholder: 'Search tasks, to-dos & priority...',
          count: todos.length,
          unit: 'tasks',
        };
      case 'expenses':
      case 'subscriptions':
        return {
          id: 'expenses',
          label: 'Spending',
          placeholder: 'Search transactions, merchants, amount...',
          count: expenses.length,
          unit: 'transactions',
        };
      case 'habits':
        return {
          id: 'habits',
          label: 'Habits',
          placeholder: 'Search habits & routines...',
          count: habits.length,
          unit: 'habits',
        };
      case 'journal':
      case 'docs':
        return {
          id: 'journal',
          label: 'Journal',
          placeholder: 'Search journal entries & notes...',
          count: journal.length,
          unit: 'entries',
        };
      case 'media':
        return {
          id: 'media',
          label: 'Media',
          placeholder: 'Search books, movies & games...',
          count: media.length,
          unit: 'items',
        };
      case 'goals':
        return {
          id: 'goals',
          label: 'Goals',
          placeholder: 'Search goals & milestones...',
          count: goals.length,
          unit: 'goals',
        };
      case 'quotes':
        return {
          id: 'quotes',
          label: 'Quotes',
          placeholder: 'Search quotes & mantras...',
          count: quotes.length,
          unit: 'quotes',
        };
      default:
        return {
          id: 'pages',
          label: 'Pages',
          placeholder: 'Search pages, tools & navigation...',
          count: DASHBOARD_PAGES.length,
          unit: 'destinations',
        };
    }
  }, [activeView, todos.length, expenses.length, habits.length, journal.length, media.length, goals.length, quotes.length]);

  // Register with Android hardware back button
  useEffect(() => {
    if (!isOpen) return;
    const unregister = nativeService.registerBackButtonHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  // Autofocus input and reset scope based on current page when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setFilterType(activeView === 'home' ? 'pages' : 'section');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeView]);

  const results: SearchResultItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list: SearchResultItem[] = [];

    // Helper: Map task to item
    const mapTask = (t: TodoItem): SearchResultItem => ({
      id: `task-${t.id}`,
      title: t.title,
      subtitle: `Task · Priority: ${t.priority?.toUpperCase() || 'NORMAL'} · ${t.category || 'General'}${t.completed ? ' (Completed)' : ''}`,
      type: 'task',
      view: 'tasks',
      icon: <CheckSquare className={`w-4 h-4 ${t.completed ? 'text-emerald-500' : 'text-violet-500'}`} />,
    });

    // Helper: Map expense to item
    const mapExpense = (e: ExpenseItem): SearchResultItem => {
      const isCredit = e.direction === 'CREDIT' || e.transactionType === 'CREDIT' || e.transactionType === 'income';
      return {
        id: `expense-${e.id}`,
        title: e.name || 'Expense',
        subtitle: `${isCredit ? '+ ₹' : '- ₹'}${Number(e.amount || 0).toLocaleString()} · ${e.category || 'General'}${e.date ? ` · ${e.date}` : ''}`,
        type: 'expense',
        view: 'expenses',
        icon: <CreditCard className={`w-4 h-4 ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`} />,
      };
    };

    // Helper: Map habit to item
    const mapHabit = (h: HabitItem): SearchResultItem => ({
      id: `habit-${h.id}`,
      title: h.title,
      subtitle: `Habit · Streak: ${h.streak || 0}d · ${h.category || 'Routine'}`,
      type: 'habit',
      view: 'habits',
      icon: <Flame className="w-4 h-4 text-amber-500" />,
    });

    // Helper: Map journal to item
    const mapJournal = (j: JournalEntry): SearchResultItem => ({
      id: `journal-${j.id}`,
      title: j.title || 'Journal Note',
      subtitle: `Journal · ${j.date || 'Recent'}${j.mood ? ` · Mood: ${j.mood}` : ''}`,
      type: 'journal',
      view: 'journal',
      icon: <BookOpen className="w-4 h-4 text-pink-500" />,
    });

    // Helper: Map media to item
    const mapMedia = (m: MediaItem): SearchResultItem => ({
      id: `media-${m.id}`,
      title: m.title,
      subtitle: `Media · ${m.creator || 'Item'} (${m.type || 'Library'})`,
      type: 'media',
      view: 'media',
      icon: <Film className="w-4 h-4 text-sky-500" />,
    });

    // Helper: Map goal to item
    const mapGoal = (g: GoalItem): SearchResultItem => ({
      id: `goal-${g.id}`,
      title: g.title,
      subtitle: `Goal · ${g.progress || 0}% complete · ${g.category || 'Vision'}`,
      type: 'goal',
      view: 'goals',
      icon: <Target className="w-4 h-4 text-indigo-500" />,
    });

    // Helper: Map quote to item
    const mapQuote = (qu: QuoteItem): SearchResultItem => ({
      id: `quote-${qu.id}`,
      title: `"${qu.text?.slice(0, 45)}..."`,
      subtitle: `Quote · ${qu.author || 'Unknown'}`,
      type: 'quote',
      view: 'home',
      icon: <QuoteIcon className="w-4 h-4 text-purple-500" />,
    });

    // SECTION SPECIFIC SEARCH (when filterType === 'section')
    if (filterType === 'section' && activeView !== 'home') {
      if (activeView === 'tasks') {
        const filtered = todos.filter((t) => {
          if (!q) return true;
          return (
            t.title.toLowerCase().includes(q) ||
            t.category?.toLowerCase().includes(q) ||
            t.notes?.toLowerCase().includes(q) ||
            t.priority?.toLowerCase().includes(q)
          );
        });
        filtered.forEach((t) => list.push(mapTask(t)));
        return list.slice(0, 40);
      }

      if (activeView === 'expenses' || activeView === 'subscriptions') {
        const filtered = expenses.filter((e) => {
          if (!q) return true;
          const isCredit = e.direction === 'CREDIT' || e.transactionType === 'CREDIT' || e.transactionType === 'income';
          const typeMatch = (q.includes('credit') || q.includes('income')) ? isCredit : (q.includes('debit') || q.includes('spend')) ? !isCredit : false;
          return (
            e.name?.toLowerCase().includes(q) ||
            e.category?.toLowerCase().includes(q) ||
            e.bankName?.toLowerCase().includes(q) ||
            e.notes?.toLowerCase().includes(q) ||
            e.paymentMethod?.toLowerCase().includes(q) ||
            e.referenceId?.toLowerCase().includes(q) ||
            e.merchant?.toLowerCase().includes(q) ||
            e.payee?.toLowerCase().includes(q) ||
            e.rawSmsText?.toLowerCase().includes(q) ||
            e.date?.includes(q) ||
            String(e.amount).includes(q) ||
            typeMatch
          );
        });
        filtered.forEach((e) => list.push(mapExpense(e)));
        return list.slice(0, 40);
      }

      if (activeView === 'habits') {
        const filtered = habits.filter((h) => {
          if (!q) return true;
          return h.title.toLowerCase().includes(q) || h.category?.toLowerCase().includes(q);
        });
        filtered.forEach((h) => list.push(mapHabit(h)));
        return list.slice(0, 40);
      }

      if (activeView === 'journal' || activeView === 'docs') {
        const filtered = journal.filter((j) => {
          if (!q) return true;
          return j.title?.toLowerCase().includes(q) || j.content?.toLowerCase().includes(q);
        });
        filtered.forEach((j) => list.push(mapJournal(j)));
        return list.slice(0, 40);
      }

      if (activeView === 'media') {
        const filtered = media.filter((m) => {
          if (!q) return true;
          return m.title?.toLowerCase().includes(q) || m.creator?.toLowerCase().includes(q) || m.type?.toLowerCase().includes(q);
        });
        filtered.forEach((m) => list.push(mapMedia(m)));
        return list.slice(0, 40);
      }

      if (activeView === 'goals') {
        const filtered = goals.filter((g) => {
          if (!q) return true;
          return g.title?.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q);
        });
        filtered.forEach((g) => list.push(mapGoal(g)));
        return list.slice(0, 40);
      }

      if (activeView === 'quotes') {
        const filtered = quotes.filter((qu) => {
          if (!q) return true;
          return qu.text?.toLowerCase().includes(q) || qu.author?.toLowerCase().includes(q);
        });
        filtered.forEach((qu) => list.push(mapQuote(qu)));
        return list.slice(0, 40);
      }
    }

    // 1. MATCH PAGES & HUBS (if filterType is 'pages' or 'all', or when on 'home')
    if (filterType === 'pages' || filterType === 'all' || activeView === 'home') {
      DASHBOARD_PAGES.forEach((page) => {
        if (!q) {
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

    // 2. MATCH USER DATA RECORDS ACROSS ALL MODULES (when filterType is 'all' or user types query in all)
    if (filterType === 'all' && q) {
      todos.forEach((t) => {
        if (t.title.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)) {
          list.push(mapTask(t));
        }
      });

      expenses.forEach((e) => {
        if (
          e.name?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.bankName?.toLowerCase().includes(q) ||
          String(e.amount).includes(q)
        ) {
          list.push(mapExpense(e));
        }
      });

      habits.forEach((h) => {
        if (h.title.toLowerCase().includes(q) || h.category?.toLowerCase().includes(q)) {
          list.push(mapHabit(h));
        }
      });

      journal.forEach((j) => {
        if (j.title?.toLowerCase().includes(q) || j.content?.toLowerCase().includes(q)) {
          list.push(mapJournal(j));
        }
      });

      media.forEach((m) => {
        if (m.title?.toLowerCase().includes(q) || m.creator?.toLowerCase().includes(q)) {
          list.push(mapMedia(m));
        }
      });

      goals.forEach((g) => {
        if (g.title?.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q)) {
          list.push(mapGoal(g));
        }
      });
    }

    return list.slice(0, 40);
  }, [query, filterType, activeView, todos, expenses, habits, journal, quotes, media, goals]);

  const handleSelectResult = (res: SearchResultItem) => {
    void nativeService.triggerHaptic('selection');
    onClose();
    onNavigate(res.view);
  };

  if (!isOpen) return null;

  const currentPlaceholder =
    filterType === 'pages'
      ? 'Search pages, tools & navigation...'
      : filterType === 'all'
      ? 'Search entire workspace...'
      : sectionInfo.placeholder;

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
            <Search className="w-4 h-4 text-violet-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={currentPlaceholder}
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
          {activeView !== 'home' && (
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setFilterType('section');
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterType === 'section'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
              }`}
            >
              <span>{sectionInfo.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterType === 'section' ? 'bg-violet-700 text-violet-100' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                {sectionInfo.count}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setFilterType('pages');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'pages'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
            }`}
          >
            Pages & Hubs
          </button>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setFilterType('all');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-400 border border-[#E8E5F3] dark:border-[#242D40]'
            }`}
          >
            All Workspace
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto py-2.5 space-y-1.5">
          {!query.trim() && (
            <div className="px-1 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {filterType === 'section'
                  ? `${sectionInfo.label} (${results.length} ${sectionInfo.unit})`
                  : filterType === 'pages'
                  ? `Suggested Pages (${results.length} destinations)`
                  : 'Workspace Items'}
              </span>
              <span className="text-[10px] text-gray-400">
                {results.length} {results.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          )}

          {query.trim() && results.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                No matching results found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {filterType === 'section'
                  ? `No matching ${sectionInfo.unit} found. Try switching to "All Workspace" or "Pages".`
                  : 'Try searching with different keywords.'}
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
                  {item.type === 'expense' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                      Money
                    </span>
                  )}
                  {item.type === 'task' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                      Task
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
