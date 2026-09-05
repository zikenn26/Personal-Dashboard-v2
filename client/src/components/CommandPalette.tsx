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

  // Search Results Calculation
  const searchResults = useMemo(() => {
    const rawQ = query.trim().toLowerCase();
    if (!rawQ) return [];

    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      icon: React.ReactNode;
      category: string;
      action: () => void;
    }> = [];

    // Quick Action Triggers
    if (rawQ.includes('task') || rawQ.includes('todo')) {
      results.push({
        id: 'act-add-task',
        title: '+ Quick Add New Task',
        subtitle: 'Create a new task with priority and deadline',
        icon: <Plus className="w-4 h-4 text-emerald-500" />,
        category: 'Quick Action',
        action: () => {
          onQuickAdd?.('task');
        },
      });
    }

    if (rawQ.includes('expense') || rawQ.includes('money') || rawQ.includes('bill') || rawQ.includes('sub')) {
      results.push({
        id: 'act-add-expense',
        title: '+ Quick Add New Expense / SaaS',
        subtitle: 'Track new monthly subscription or operational cost',
        icon: <CreditCard className="w-4 h-4 text-purple-500" />,
        category: 'Quick Action',
        action: () => {
          onQuickAdd?.('expense');
        },
      });
    }

    if (rawQ.includes('quote') || rawQ.includes('mantra') || rawQ.includes('inspire')) {
      results.push({
        id: 'act-add-quote',
        title: '+ Quick Add Inspiring Quote',
        subtitle: 'Save a quote to your workspace slideshow banner',
        icon: <Quote className="w-4 h-4 text-amber-500" />,
        category: 'Quick Action',
        action: () => {
          onQuickAdd?.('quote');
        },
      });
    }

    if (rawQ.includes('note') || rawQ.includes('journal') || rawQ.includes('write')) {
      results.push({
        id: 'act-add-journal',
        title: '+ Quick Add Daily Journal / Note',
        subtitle: 'Write a quick thought, reflection, or meeting note',
        icon: <FileText className="w-4 h-4 text-sky-500" />,
        category: 'Quick Action',
        action: () => {
          onQuickAdd?.('journal');
        },
      });
    }

    // 1. Check Primary Pages
    ALL_PAGES.forEach((page) => {
      const matchKeywords = page.keywords.some((kw) => kw.includes(rawQ) || rawQ.includes(kw));
      const matchTitle = page.title.toLowerCase().includes(rawQ);
      const matchSub = page.subtitle.toLowerCase().includes(rawQ);

      if (matchTitle || matchKeywords || matchSub) {
        results.push({
          id: `page-${page.id}-${page.tab || 'main'}`,
          title: `Jump to: ${page.title}`,
          subtitle: page.subtitle,
          icon: page.icon,
          category: 'Page Redirect',
          action: () => {
            onNavigate(page.id, page.tab);
          },
        });
      }
    });

    // 2. Search Expenses
    expenses.forEach((e) => {
      if (e.name.toLowerCase().includes(rawQ) || e.category.toLowerCase().includes(rawQ)) {
        results.push({
          id: `exp-${e.id}`,
          title: `${e.name} ($${e.amount}/${e.billingCycle})`,
          subtitle: `Expense • ${e.category} • ${e.active ? 'Active' : 'Paused'}`,
          icon: <CreditCard className="w-4 h-4 text-purple-500" />,
          category: 'Expenses',
          action: () => onNavigate('expenses'),
        });
      }
    });

    // 3. Search Vault
    vault.forEach((v) => {
      if (v.service.toLowerCase().includes(rawQ) || v.username.toLowerCase().includes(rawQ) || v.category.toLowerCase().includes(rawQ)) {
        results.push({
          id: `vault-${v.id}`,
          title: v.service,
          subtitle: `Vault • ${v.username} (${v.category})`,
          icon: <Shield className="w-4 h-4 text-amber-500" />,
          category: 'Password Vault',
          action: () => onNavigate('vault'),
        });
      }
    });

    // 4. Search Media
    media.forEach((m) => {
      if (m.title.toLowerCase().includes(rawQ) || m.creator.toLowerCase().includes(rawQ) || m.type.toLowerCase().includes(rawQ)) {
        results.push({
          id: `med-${m.id}`,
          title: m.title,
          subtitle: `${m.type.toUpperCase()} • ${m.creator} • ${m.rating}★`,
          icon: m.type === 'book' ? <Book className="w-4 h-4 text-emerald-500" /> : <Film className="w-4 h-4 text-rose-500" />,
          category: m.type === 'book' ? 'Books' : 'Media',
          action: () => onNavigate('media', m.type),
        });
      }
    });

    // 5. Search Todos
    todos.forEach((t) => {
      if (t.title.toLowerCase().includes(rawQ) || t.category.toLowerCase().includes(rawQ)) {
        results.push({
          id: `todo-${t.id}`,
          title: t.title,
          subtitle: `Task • Priority: ${t.priority} • ${t.category}`,
          icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
          category: 'Tasks',
          action: () => onNavigate('tasks'),
        });
      }
    });

    // 6. Search Quotes
    quotes.forEach((q) => {
      if (q.text.toLowerCase().includes(rawQ) || q.author.toLowerCase().includes(rawQ) || q.category?.toLowerCase().includes(rawQ)) {
        results.push({
          id: `quote-${q.id}`,
          title: `"${q.text}"`,
          subtitle: `Quote • — ${q.author} (${q.category || 'General'})`,
          icon: <Quote className="w-4 h-4 text-amber-500" />,
          category: 'Quotes',
          action: () => onNavigate('home'),
        });
      }
    });

    // 7. System actions
    if (rawQ.includes('theme') || rawQ.includes('dark') || rawQ.includes('light')) {
      results.push({
        id: 'sys-theme',
        title: `Switch Theme to ${darkMode ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle global UI color palette',
        icon: darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-500" />,
        category: 'System Setting',
        action: () => onToggleDarkMode(),
      });
    }

    if (rawQ.includes('backup') || rawQ.includes('export') || rawQ.includes('json')) {
      results.push({
        id: 'sys-export',
        title: 'Export Full Workspace JSON',
        subtitle: 'Download complete backup of all tasks, notes & expenses',
        icon: <Download className="w-4 h-4 text-emerald-500" />,
        category: 'Data Backup',
        action: () => onExportData(),
      });
    }

    return results.slice(0, 10);
  }, [query, ALL_PAGES, vault, media, todos, expenses, quotes, darkMode, onNavigate, onQuickAdd, onToggleDarkMode, onExportData]);

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
        <div className="relative flex items-center p-3.5 border-b border-[#EDECE9] dark:border-[#1F2937]">
          <Search className="w-4 h-4 text-[#9CA3AF] shrink-0 ml-1" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages (e.g. Books, Movies, Expenses, Vault, Tasks, Quotes) or type intent..."
            autoFocus
            className="w-full pl-3 pr-8 py-1 text-sm bg-transparent text-[#37352F] dark:text-[#F3F4F6] placeholder:text-[#9CA3AF] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[10px] font-mono text-[#787774] dark:text-[#9CA3AF]">
            ESC
          </kbd>
        </div>

        {/* Results / Quick Actions List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {query.trim() ? (
            searchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9CA3AF]">
                No matching results found for &quot;{query}&quot;. Try typing &apos;books&apos;, &apos;movies&apos;, &apos;expenses&apos;, &apos;vault&apos;, or &apos;new task&apos;.
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
            )
          ) : (
            /* Default View: Direct Page Shortcuts & Quick Triggers */
            <div className="space-y-3 p-1">
              <span className="text-[10px] uppercase tracking-wider text-[#787774] dark:text-[#9CA3AF] font-bold px-2 block">
                Direct Page Navigation & Jump Links
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ALL_PAGES.map((page) => (
                  <button
                    key={`${page.id}-${page.tab || 'main'}`}
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onNavigate(page.id, page.tab);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937] transition-all cursor-pointer border border-transparent hover:border-[#EDECE9] dark:hover:border-[#374151]"
                  >
                    <span className="p-1.5 rounded-lg bg-[#F7F7F5] dark:bg-[#111827] shrink-0">
                      {page.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#37352F] dark:text-white truncate">
                        {page.title}
                      </p>
                      <p className="text-[9px] text-[#787774] dark:text-[#9CA3AF] truncate">
                        {page.subtitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-[#EDECE9] dark:border-[#1F2937] flex items-center justify-between text-[11px] text-[#787774] dark:text-[#9CA3AF] px-2">
                <span>Tip: Type &apos;books&apos;, &apos;movies&apos;, or &apos;expenses&apos; to jump instantly</span>
                <span className="font-mono text-[10px]">↵ to select</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
