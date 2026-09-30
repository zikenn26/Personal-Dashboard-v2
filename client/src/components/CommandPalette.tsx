import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CheckSquare,
  KeyRound,
  BookOpen,
  Film,
  Briefcase,
  Compass,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Download,
  RotateCcw,
  Sparkles,
  Command,
  Home,
  Flame,
  CreditCard,
  Award,
  ArrowRight,
  Shield,
  FileText,
  Plus,
  Quote,
  Book,
  PenTool,
  Check,
} from 'lucide-react';
import {
  TodoItem,
  JournalEntry,
  MediaItem,
  LifeMilestone,
  PortfolioProject,
  VaultCredential,
  ExpenseItem,
  HabitItem,
  QuoteItem,
  MainNavView,
} from '../types';
import { Sound } from '../utils/audio';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: MainNavView, filterOrTab?: string) => void;
  activeView?: MainNavView;
  onQuickAdd?: (type: any) => void;
  todos: TodoItem[];
  journal: JournalEntry[];
  media: MediaItem[];
  milestones: LifeMilestone[];
  projects: PortfolioProject[];
  vault: VaultCredential[];
  expenses?: ExpenseItem[];
  habits?: HabitItem[];
  quotes?: QuoteItem[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onExportData: () => void;
  onResetData: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  activeView = 'home',
  onQuickAdd,
  todos,
  journal,
  media,
  milestones,
  projects,
  vault,
  expenses = [],
  habits = [],
  quotes = [],
  darkMode,
  onToggleDarkMode,
  soundEnabled,
  onToggleSound,
  onExportData,
  onResetData,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K and Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Primary workspace pages & smart keyword dictionaries
  const ALL_PAGES = useMemo(
    () => [
      {
        id: 'home' as MainNavView,
        title: 'Home Dashboard',
        subtitle: 'Quotes Slideshow, Notion Databases & Life OS Hub',
        icon: <Home className="w-4 h-4 text-blue-500" />,
        keywords: ['home', 'dashboard', 'overview', 'quotes', 'slideshow', 'notion', 'main', 'start'],
      },
      {
        id: 'assistant' as MainNavView,
        title: 'AI Secretary & Assistant',
        subtitle: 'Autonomous AI Secretary with Groq Llama 3.3 70B',
        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
        keywords: ['ai', 'assistant', 'secretary', 'groq', 'llama', 'bot', 'chat', 'ask'],
      },
      {
        id: 'workfolio' as MainNavView,
        title: 'Workfolio & Bio',
        subtitle: 'Profile, Design Services, Interactive Resume & Projects',
        icon: <Briefcase className="w-4 h-4 text-indigo-500" />,
        keywords: ['workfolio', 'portfolio', 'resume', 'cv', 'bio', 'profile', 'services', 'projects', 'clients', 'experience'],
      },
      {
        id: 'vault' as MainNavView,
        title: 'Password Vault',
        subtitle: 'Zero-Knowledge Encrypted Passwords, API Keys & Secret Tokens',
        icon: <Shield className="w-4 h-4 text-amber-500" />,
        keywords: ['password', 'vault', 'credentials', 'secrets', 'keys', 'logins', 'tokens', 'auth', 'security', 'pins'],
      },
      {
        id: 'media' as MainNavView,
        tab: 'book',
        title: 'Books & Reading Library',
        subtitle: 'Curated books, literature ratings, and reading notes',
        icon: <Book className="w-4 h-4 text-emerald-500" />,
        keywords: ['book', 'books', 'reading', 'read', 'literature', 'library', 'author', 'novel', 'ebook'],
      },
      {
        id: 'media' as MainNavView,
        tab: 'movie',
        title: 'Media & Cinema Lounge',
        subtitle: 'Films, Series, Watchlist, Ratings & Video Game Reviews',
        icon: <Film className="w-4 h-4 text-rose-500" />,
        keywords: ['movie', 'movies', 'films', 'media', 'cinema', 'series', 'tv', 'games', 'watchlist', 'netflix', 'stream'],
      },
      {
        id: 'tasks' as MainNavView,
        title: 'Tasks & Sprints Kanban',
        subtitle: 'Agile Kanban Board, Priority Columns & Todo Tracking',
        icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
        keywords: ['tasks', 'todos', 'task', 'todo', 'sprints', 'kanban', 'agile', 'backlog', 'priority', 'checklist'],
      },
      {
        id: 'docs' as MainNavView,
        title: 'Doc Hub & Daily Journal',
        subtitle: 'Markdown Documents, Bulletins, Daily Log & Reflection',
        icon: <FileText className="w-4 h-4 text-sky-500" />,
        keywords: ['docs', 'document', 'hub', 'journal', 'notes', 'diary', 'markdown', 'log', 'bulletin', 'write', 'thought'],
      },
      {
        id: 'habits' as MainNavView,
        title: 'Habits & Weekly Routines',
        subtitle: '7-Day Habit Matrix, Streaks & Behavioral Routines',
        icon: <Flame className="w-4 h-4 text-orange-500" />,
        keywords: ['habits', 'habit', 'routines', 'routine', 'streaks', 'daily', 'tracker', 'health', 'focus', 'discipline'],
      },
      {
        id: 'expenses' as MainNavView,
        title: 'SaaS & Subscriptions Analytics',
        subtitle: 'PowerBI Category Visualizer, Daily/Monthly Burn Rate & Spreadsheet Import',
        icon: <CreditCard className="w-4 h-4 text-purple-500" />,
        keywords: ['expenses', 'expense', 'saas', 'subscriptions', 'billing', 'costs', 'finances', 'money', 'spend', 'powerbi', 'chart', 'burn', 'excel'],
      },
      {
        id: 'timeline' as MainNavView,
        title: 'Roadmap & Doodles Canvas',
        subtitle: 'Career Milestones, Interactive Timeline & Creative Drawing',
        icon: <Award className="w-4 h-4 text-teal-500" />,
        keywords: ['roadmap', 'timeline', 'milestones', 'doodles', 'canvas', 'drawing', 'career', 'history', 'sketch'],
      },
    ],
    []
  );

  // Dynamic Section Configuration based on activeView
  const sectionMeta = useMemo(() => {
    switch (activeView) {
      case 'tasks':
        return {
          label: 'Tasks',
          placeholder: 'Search tasks, to-dos & priority (or type to add)...',
          emptyHint: 'tasks',
        };
      case 'expenses':
      case 'subscriptions':
        return {
          label: 'Spending',
          placeholder: 'Search transactions, merchants, amount, category...',
          emptyHint: 'transactions',
        };
      case 'habits':
        return {
          label: 'Habits',
          placeholder: 'Search habits, streaks & routines...',
          emptyHint: 'habits',
        };
      case 'docs':
      case 'journal':
        return {
          label: 'Journal & Docs',
          placeholder: 'Search journal entries & documents...',
          emptyHint: 'journal notes',
        };
      case 'vault':
        return {
          label: 'Password Vault',
          placeholder: 'Search vault credentials, services & usernames...',
          emptyHint: 'credentials',
        };
      case 'media':
        return {
          label: 'Media Library',
          placeholder: 'Search books, movies, series & games...',
          emptyHint: 'media items',
        };
      case 'workfolio':
        return {
          label: 'Portfolio & Bio',
          placeholder: 'Search portfolio projects, skills & resume...',
          emptyHint: 'projects',
        };
      default:
        return {
          label: 'Pages & Tools',
          placeholder: 'Search pages (e.g. Tasks, Spending, Books, Vault, Habits) or type intent...',
          emptyHint: 'destinations',
        };
    }
  }, [activeView]);

  // Search Results Calculation
  const searchResults = useMemo(() => {
    const rawQ = query.trim().toLowerCase();

    // Map Tasks
    const mapTask = (t: TodoItem) => ({
      id: `todo-${t.id}`,
      title: t.title,
      subtitle: `Task • Priority: ${t.priority?.toUpperCase() || 'NORMAL'} • ${t.category || 'General'}${t.completed ? ' (Completed)' : ''}`,
      icon: <CheckSquare className={`w-4 h-4 ${t.completed ? 'text-emerald-500' : 'text-violet-500'}`} />,
      category: 'Tasks',
      action: () => onNavigate('tasks'),
    });

    // Map Expenses
    const mapExpense = (e: ExpenseItem) => {
      const isCredit = e.direction === 'CREDIT' || e.transactionType === 'CREDIT' || e.transactionType === 'income';
      return {
        id: `exp-${e.id}`,
        title: `${e.name} (${isCredit ? '+₹' : '-₹'}${Number(e.amount || 0).toLocaleString()})`,
        subtitle: `Expense • ${e.category} • ${e.date || 'Recent'}${e.paymentMethod ? ` • ${e.paymentMethod}` : ''}`,
        icon: <CreditCard className={`w-4 h-4 ${isCredit ? 'text-emerald-500' : 'text-purple-500'}`} />,
        category: 'Spending',
        action: () => onNavigate('expenses'),
      };
    };

    // Map Habits
    const mapHabit = (h: HabitItem) => ({
      id: `habit-${h.id}`,
      title: h.title,
      subtitle: `Habit • Streak: ${h.streak || 0}d • ${h.category || 'Routine'}`,
      icon: <Flame className="w-4 h-4 text-orange-500" />,
      category: 'Habits',
      action: () => onNavigate('habits'),
    });

    // Map Journal
    const mapJournal = (j: JournalEntry) => ({
      id: `journal-${j.id}`,
      title: j.title || 'Journal Note',
      subtitle: `Journal • ${j.date || 'Recent'}${j.mood ? ` • Mood: ${j.mood}` : ''}`,
      icon: <FileText className="w-4 h-4 text-sky-500" />,
      category: 'Journal',
      action: () => onNavigate('docs'),
    });

    // Map Vault
    const mapVault = (v: VaultCredential) => ({
      id: `vault-${v.id}`,
      title: v.service,
      subtitle: `Vault • ${v.username} (${v.category})`,
      icon: <Shield className="w-4 h-4 text-amber-500" />,
      category: 'Password Vault',
      action: () => onNavigate('vault'),
    });

    // Map Media
    const mapMedia = (m: MediaItem) => ({
      id: `med-${m.id}`,
      title: m.title,
      subtitle: `${m.type.toUpperCase()} • ${m.creator} • ${m.rating}★`,
      icon: m.type === 'book' ? <Book className="w-4 h-4 text-emerald-500" /> : <Film className="w-4 h-4 text-rose-500" />,
      category: m.type === 'book' ? 'Books' : 'Media',
      action: () => onNavigate('media', m.type),
    });

    // Map Quote
    const mapQuote = (q: QuoteItem) => ({
      id: `quote-${q.id}`,
      title: `"${q.text}"`,
      subtitle: `Quote • — ${q.author} (${q.category || 'General'})`,
      icon: <Quote className="w-4 h-4 text-amber-500" />,
      category: 'Quotes',
      action: () => onNavigate('home'),
    });

    // EMPTY QUERY: Contextually show current section items or pages
    if (!rawQ) {
      if (activeView === 'tasks') {
        return todos.slice(0, 15).map(mapTask);
      }
      if (activeView === 'expenses' || activeView === 'subscriptions') {
        return expenses.slice(0, 15).map(mapExpense);
      }
      if (activeView === 'habits') {
        return habits.slice(0, 15).map(mapHabit);
      }
      if (activeView === 'docs' || activeView === 'journal') {
        return journal.slice(0, 15).map(mapJournal);
      }
      if (activeView === 'vault') {
        return vault.slice(0, 15).map(mapVault);
      }
      if (activeView === 'media') {
        return media.slice(0, 15).map(mapMedia);
      }
      // Home view default: Show primary workspace pages for instant navigation
      return ALL_PAGES.map((page) => ({
        id: `page-${page.id}-${page.tab || 'main'}`,
        title: `Jump to: ${page.title}`,
        subtitle: page.subtitle,
        icon: page.icon,
        category: 'Pages',
        action: () => onNavigate(page.id, page.tab),
      }));
    }

    // When on a specific section page, search ONLY that section's items!
    if (activeView === 'tasks') {
      const taskResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      todos.forEach((t) => {
        if (
          t.title.toLowerCase().includes(rawQ) ||
          t.category?.toLowerCase().includes(rawQ) ||
          t.notes?.toLowerCase().includes(rawQ) ||
          t.priority?.toLowerCase().includes(rawQ)
        ) {
          taskResults.push(mapTask(t));
        }
      });

      if (rawQ) {
        taskResults.push({
          id: 'act-add-task-specific',
          title: `+ Add New Task "${query.trim()}"`,
          subtitle: 'Create a new task with this title',
          icon: <Plus className="w-4 h-4 text-emerald-500" />,
          category: 'Quick Action',
          action: () => onQuickAdd?.('task'),
        });
      }

      return taskResults.slice(0, 20);
    }

    if (activeView === 'expenses' || activeView === 'subscriptions') {
      const expenseResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      expenses.forEach((e) => {
        const isCredit = e.direction === 'CREDIT' || e.transactionType === 'CREDIT' || e.transactionType === 'income';
        const typeMatch = (rawQ.includes('credit') || rawQ.includes('income')) ? isCredit : (rawQ.includes('debit') || rawQ.includes('spend')) ? !isCredit : false;

        if (
          e.name.toLowerCase().includes(rawQ) ||
          e.category.toLowerCase().includes(rawQ) ||
          e.bankName?.toLowerCase().includes(rawQ) ||
          e.notes?.toLowerCase().includes(rawQ) ||
          e.paymentMethod?.toLowerCase().includes(rawQ) ||
          e.referenceId?.toLowerCase().includes(rawQ) ||
          e.merchant?.toLowerCase().includes(rawQ) ||
          e.payee?.toLowerCase().includes(rawQ) ||
          e.date?.includes(rawQ) ||
          String(e.amount).includes(rawQ) ||
          typeMatch
        ) {
          expenseResults.push(mapExpense(e));
        }
      });

      if (rawQ) {
        expenseResults.push({
          id: 'act-add-expense-specific',
          title: `+ Record New Expense "${query.trim()}"`,
          subtitle: 'Track new spending with this description',
          icon: <CreditCard className="w-4 h-4 text-purple-500" />,
          category: 'Quick Action',
          action: () => onQuickAdd?.('expense'),
        });
      }

      return expenseResults.slice(0, 25);
    }

    if (activeView === 'habits') {
      const habitResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      habits.forEach((h) => {
        if (h.title.toLowerCase().includes(rawQ) || h.category?.toLowerCase().includes(rawQ)) {
          habitResults.push(mapHabit(h));
        }
      });

      if (rawQ) {
        habitResults.push({
          id: 'act-add-habit-specific',
          title: `+ Create Habit "${query.trim()}"`,
          subtitle: 'Add a new habit to your daily tracker',
          icon: <Flame className="w-4 h-4 text-orange-500" />,
          category: 'Quick Action',
          action: () => onQuickAdd?.('habit'),
        });
      }

      return habitResults.slice(0, 20);
    }

    if (activeView === 'docs' || activeView === 'journal') {
      const journalResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      journal.forEach((j) => {
        if (
          j.title?.toLowerCase().includes(rawQ) ||
          j.content?.toLowerCase().includes(rawQ) ||
          j.date?.includes(rawQ) ||
          j.mood?.toLowerCase().includes(rawQ)
        ) {
          journalResults.push(mapJournal(j));
        }
      });

      if (rawQ) {
        journalResults.push({
          id: 'act-add-journal-specific',
          title: `+ New Note "${query.trim()}"`,
          subtitle: 'Create a new journal entry with this title',
          icon: <FileText className="w-4 h-4 text-sky-500" />,
          category: 'Quick Action',
          action: () => onQuickAdd?.('journal'),
        });
      }

      return journalResults.slice(0, 20);
    }

    if (activeView === 'vault') {
      const vaultResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      vault.forEach((v) => {
        if (
          v.service.toLowerCase().includes(rawQ) ||
          v.username.toLowerCase().includes(rawQ) ||
          v.category.toLowerCase().includes(rawQ) ||
          v.notes?.toLowerCase().includes(rawQ)
        ) {
          vaultResults.push(mapVault(v));
        }
      });

      return vaultResults.slice(0, 20);
    }

    if (activeView === 'media') {
      const mediaResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      media.forEach((m) => {
        if (
          m.title.toLowerCase().includes(rawQ) ||
          m.creator.toLowerCase().includes(rawQ) ||
          m.type.toLowerCase().includes(rawQ)
        ) {
          mediaResults.push(mapMedia(m));
        }
      });

      return mediaResults.slice(0, 20);
    }

    if (activeView === 'quotes') {
      const quoteResults: Array<{
        id: string;
        title: string;
        subtitle: string;
        icon: React.ReactNode;
        category: string;
        action: () => void;
      }> = [];

      quotes.forEach((q) => {
        if (q.text.toLowerCase().includes(rawQ) || q.author.toLowerCase().includes(rawQ) || q.category?.toLowerCase().includes(rawQ)) {
          quoteResults.push(mapQuote(q));
        }
      });

      if (rawQ) {
        quoteResults.push({
          id: 'act-add-quote-specific',
          title: `+ Add Quote "${query.trim()}"`,
          subtitle: 'Save a quote to your workspace',
          icon: <Quote className="w-4 h-4 text-amber-500" />,
          category: 'Quick Action',
          action: () => onQuickAdd?.('quote'),
        });
      }

      return quoteResults.slice(0, 20);
    }

    // MAIN HOME PAGE: Search workspace destinations, tools, system settings & quick actions!
    const homeResults: Array<{
      id: string;
      title: string;
      subtitle: string;
      icon: React.ReactNode;
      category: string;
      action: () => void;
    }> = [];

    // 1. Pages & Destinations
    ALL_PAGES.forEach((page) => {
      const matchKeywords = page.keywords.some((kw) => kw.includes(rawQ) || rawQ.includes(kw));
      const matchTitle = page.title.toLowerCase().includes(rawQ);
      const matchSub = page.subtitle.toLowerCase().includes(rawQ);

      if (matchTitle || matchKeywords || matchSub) {
        homeResults.push({
          id: `page-${page.id}-${page.tab || 'main'}`,
          title: `Jump to: ${page.title}`,
          subtitle: page.subtitle,
          icon: page.icon,
          category: 'Page Redirect',
          action: () => onNavigate(page.id, page.tab),
        });
      }
    });

    // 2. Quick Action Triggers
    if (rawQ.includes('task') || rawQ.includes('todo')) {
      homeResults.push({
        id: 'act-add-task',
        title: '+ Quick Add New Task',
        subtitle: 'Create a new task with priority and deadline',
        icon: <Plus className="w-4 h-4 text-emerald-500" />,
        category: 'Quick Action',
        action: () => onQuickAdd?.('task'),
      });
    }

    if (rawQ.includes('expense') || rawQ.includes('money') || rawQ.includes('bill') || rawQ.includes('spend')) {
      homeResults.push({
        id: 'act-add-expense',
        title: '+ Quick Add New Expense / SaaS',
        subtitle: 'Track new monthly subscription or operational cost',
        icon: <CreditCard className="w-4 h-4 text-purple-500" />,
        category: 'Quick Action',
        action: () => onQuickAdd?.('expense'),
      });
    }

    if (rawQ.includes('quote') || rawQ.includes('mantra') || rawQ.includes('inspire')) {
      homeResults.push({
        id: 'act-add-quote',
        title: '+ Quick Add Inspiring Quote',
        subtitle: 'Save a quote to your workspace slideshow banner',
        icon: <Quote className="w-4 h-4 text-amber-500" />,
        category: 'Quick Action',
        action: () => onQuickAdd?.('quote'),
      });
    }

    if (rawQ.includes('note') || rawQ.includes('journal') || rawQ.includes('write')) {
      homeResults.push({
        id: 'act-add-journal',
        title: '+ Quick Add Daily Journal / Note',
        subtitle: 'Write a quick thought, reflection, or meeting note',
        icon: <FileText className="w-4 h-4 text-sky-500" />,
        category: 'Quick Action',
        action: () => onQuickAdd?.('journal'),
      });
    }

    // 3. System Actions
    if (rawQ.includes('theme') || rawQ.includes('dark') || rawQ.includes('light')) {
      homeResults.push({
        id: 'sys-theme',
        title: `Switch Theme to ${darkMode ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle global UI color palette',
        icon: darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-500" />,
        category: 'System Setting',
        action: () => onToggleDarkMode(),
      });
    }

    if (rawQ.includes('backup') || rawQ.includes('export') || rawQ.includes('json') || rawQ.includes('sync')) {
      homeResults.push({
        id: 'sys-export',
        title: 'Export Full Workspace JSON',
        subtitle: 'Download complete backup of all tasks, notes & expenses',
        icon: <Download className="w-4 h-4 text-emerald-500" />,
        category: 'Data Backup',
        action: () => onExportData(),
      });
    }

    return homeResults.slice(0, 15);
  }, [
    query,
    activeView,
    ALL_PAGES,
    vault,
    media,
    todos,
    expenses,
    habits,
    journal,
    quotes,
    darkMode,
    onNavigate,
    onQuickAdd,
    onToggleDarkMode,
    onExportData,
  ]);

  // Handle keyboard arrow navigation & enter
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchResults[selectedIndex];
      if (target) {
        Sound.click(soundEnabled);
        target.action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      <div
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#1F2937] shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
      >
        {/* Super-Powered Search Input */}
        <div className="relative flex items-center p-3 border-b border-[#EDECE9] dark:border-[#1F2937]">
          <Search className="w-4 h-4 text-violet-500 shrink-0 ml-1" />
          <span className="ml-2 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/80 text-[11px] font-semibold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 shrink-0">
            {sectionMeta.label}
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={sectionMeta.placeholder}
            autoFocus
            className="w-full pl-2.5 pr-8 py-1 text-sm bg-transparent text-[#37352F] dark:text-[#F3F4F6] placeholder:text-[#9CA3AF] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[10px] font-mono text-[#787774] dark:text-[#9CA3AF]">
            ESC
          </kbd>
        </div>

        {/* Results / Quick Actions List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {!query.trim() && (
            <div className="px-2 py-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>{activeView === 'home' ? 'Quick Destinations & Pages' : `Current ${sectionMeta.label} (${searchResults.length})`}</span>
              <span className="text-[10px] lowercase font-normal">press enter to open</span>
            </div>
          )}

          {searchResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9CA3AF]">
              {query.trim() ? (
                <>No matching results found for &quot;{query}&quot;. Try searching with other keywords.</>
              ) : (
                <>No items available in this section yet.</>
              )}
            </div>
          ) : (
            searchResults.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    Sound.click(soundEnabled);
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all group ${
                    isSelected
                      ? 'bg-[#F1F1EF] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151]'
                      : 'hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937]/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="p-1.5 rounded-lg bg-white dark:bg-[#111827] shadow-2xs border border-[#EDECE9] dark:border-[#374151] shrink-0">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#37352F] dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#6366F1] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-2 border-t border-[#EDECE9] dark:border-[#1F2937] flex items-center justify-between text-[11px] text-[#787774] dark:text-[#9CA3AF] px-2">
            <span>
              {activeView === 'home'
                ? "Tip: Type 'books', 'movies', or 'expenses' to jump instantly"
                : `Tip: Searching within ${sectionMeta.label}. Press ESC to close.`}
            </span>
            <span className="font-mono text-[10px]">↵ to select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
