import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Zap,
  Plus,
  Trash2,
  Edit3,
  Check,
  Search,
  Sliders,
  Volume2,
  Play,
  ArrowRight,
  X,
  RotateCcw,
  Sparkles,
  Clock,
  Tag,
  DollarSign,
  CheckSquare,
  Compass,
  BookOpen,
} from 'lucide-react';
import {
  CommandMapping,
  CommandActionType,
  CommandMatchType,
  Priority,
  ExpenseCategory,
} from '../types';
import { Storage } from '../utils/storage';
import { Sound } from '../utils/audio';
import {
  createCommandMapping,
  updateCommandMapping,
  deleteCommandMapping,
  toggleCommandMapping,
  resetDefaultCommandMappings,
  executeCommandMapping,
} from '../services/commandMappingService';

interface CommandMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

const ACTION_META: Record<
  CommandActionType,
  { label: string; functionName: string; color: string; bg: string; icon: React.ReactNode }
> = {
  add_expense: {
    label: 'Add Expense',
    functionName: 'handleAddExpense',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40',
    icon: <DollarSign className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />,
  },
  delete_expense: {
    label: 'Delete Expense',
    functionName: 'executeSecretaryTool(delete_expense)',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40',
    icon: <Trash2 className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />,
  },
  add_todo: {
    label: 'Add Task / Todo',
    functionName: 'handleAddTodo',
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40',
    icon: <CheckSquare className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" />,
  },
  add_habit: {
    label: 'Create Habit',
    functionName: 'handleAddHabit',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40',
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />,
  },
  toggle_habit: {
    label: 'Toggle Habit',
    functionName: 'handleToggleHabit',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/40',
    icon: <Check className="w-3.5 h-3.5 text-orange-700 dark:text-orange-300" />,
  },
  navigate_view: {
    label: 'Navigate View',
    functionName: 'handleNavigate',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40',
    icon: <Compass className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" />,
  },
  add_journal: {
    label: 'Journal Note',
    functionName: 'handleAddJournalEntry',
    color: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/40',
    icon: <BookOpen className="w-3.5 h-3.5 text-violet-700 dark:text-violet-300" />,
  },
  add_quote: {
    label: 'Add Quote',
    functionName: 'handleAddQuote',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40',
    icon: <Sparkles className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />,
  },
};

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Groceries & Food',
  'Dining Out',
  'Snacks & Coffee',
  'Shopping & Retail',
  'Taxi & Transit',
  'Bills & Utilities',
  'Living & Rent',
  'Tech & Subscriptions',
  'Entertainment',
  'Health & Fitness',
  'Education',
  'Travel & Leisure',
  'Personal Care',
  'Other',
];

export const CommandMappingModal: React.FC<CommandMappingModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [mappings, setMappings] = useState<CommandMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | CommandActionType>('all');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [executionBanner, setExecutionBanner] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Edit / Create State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [triggerPhrase, setTriggerPhrase] = useState('');
  const [actionType, setActionType] = useState<CommandActionType>('add_expense');
  const [matchType, setMatchType] = useState<CommandMatchType>('contains');
  const [description, setDescription] = useState('');

  // Parameter State
  const [expenseName, setExpenseName] = useState('Breakfast');
  const [expenseAmount, setExpenseAmount] = useState<number>(150);
  const [expenseCategory, setExpenseCategory] = useState<string>('Food & Dining');

  const [todoTitle, setTodoTitle] = useState('Buy groceries');
  const [todoPriority, setTodoPriority] = useState<Priority>('medium');
  const [todoCategory, setTodoCategory] = useState('Errands');
  const [todoDueDate, setTodoDueDate] = useState('today');

  const [habitTitle, setHabitTitle] = useState('Morning Meditation');
  const [habitCategory, setHabitCategory] = useState('Mindfulness');

  const [destinationView, setDestinationView] = useState('expenses');
  const [journalTitle, setJournalTitle] = useState('Quick Reflection');
  const [journalContent, setJournalContent] = useState('');

  // Speech Recognition for Trigger Dictation
  const [isListeningForTrigger, setIsListeningForTrigger] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load mappings from Storage
  const loadMappings = () => {
    const list = Storage.getCommandMappings();
    setMappings(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadMappings();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      loadMappings();
    };
    window.addEventListener('command-mappings-updated', handleUpdate);
    return () => window.removeEventListener('command-mappings-updated', handleUpdate);
  }, []);

  if (!isOpen) return null;

  const handleToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Sound.click(true);
    toggleCommandMapping(id);
    loadMappings();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Sound.click(true);
    if (window.confirm('Delete this custom voice trigger?')) {
      deleteCommandMapping(id);
      loadMappings();
    }
  };

  const handleTestTrigger = async (mapping: CommandMapping, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingId(mapping.id);
    Sound.voiceRegistered(true);

    try {
      const res = await executeCommandMapping(mapping);
      Sound.success(true);
      setExecutionBanner({
        message: `✓ Trigger executed: ${res.message}`,
        type: 'success',
      });
      loadMappings();
      setTimeout(() => setExecutionBanner(null), 4000);
    } catch (err) {
      console.error('Trigger execution error:', err);
    } finally {
      setTimeout(() => setTestingId(null), 600);
    }
  };

  const handleResetDefaults = () => {
    Sound.click(true);
    if (window.confirm('Reset all voice triggers to default presets?')) {
      resetDefaultCommandMappings();
      loadMappings();
      setExecutionBanner({
        message: 'Voice triggers restored to default presets.',
        type: 'info',
      });
      setTimeout(() => setExecutionBanner(null), 3000);
    }
  };

  const handleOpenCreate = () => {
    setEditingMappingId(null);
    setTriggerPhrase('');
    setActionType('add_expense');
    setMatchType('contains');
    setDescription('');
    setExpenseName('Breakfast');
    setExpenseAmount(150);
    setExpenseCategory('Food & Dining');
    setTodoTitle('Buy groceries & essentials');
    setTodoPriority('medium');
    setTodoCategory('Errands');
    setTodoDueDate('today');
    setHabitTitle('Morning Workout');
    setHabitCategory('Health');
    setDestinationView('expenses');
    setJournalTitle('Voice Note');
    setJournalContent('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (m: CommandMapping, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMappingId(m.id);
    setTriggerPhrase(m.triggerPhrase);
    setActionType(m.actionType);
    setMatchType(m.matchType || 'contains');
    setDescription(m.description || '');

    const p = m.parameters || {};
    setExpenseName(p.expenseName || 'Breakfast');
    setExpenseAmount(p.expenseAmount ?? 150);
    setExpenseCategory(p.expenseCategory || 'Food & Dining');
    setTodoTitle(p.todoTitle || 'Buy groceries');
    setTodoPriority(p.todoPriority || 'medium');
    setTodoCategory(p.todoCategory || 'Errands');
    setTodoDueDate(p.todoDueDate || 'today');
    setHabitTitle(p.habitTitle || 'Daily Habit');
    setHabitCategory(p.habitCategory || 'Daily');
    setDestinationView(p.view || 'expenses');
    setJournalTitle(p.journalTitle || 'Voice Note');
    setJournalContent(p.journalContent || '');

    setIsEditorOpen(true);
  };

  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhrase = triggerPhrase.trim();
    if (!cleanPhrase) {
      alert('Please enter a voice trigger phrase (e.g., "Log breakfast")');
      return;
    }

    const parameters: any = {};
    if (actionType === 'add_expense') {
      parameters.expenseName = expenseName.trim() || 'Expense';
      parameters.expenseAmount = Number(expenseAmount) || 100;
      parameters.expenseCategory = expenseCategory;
    } else if (actionType === 'add_todo') {
      parameters.todoTitle = todoTitle.trim() || 'Task';
      parameters.todoPriority = todoPriority;
      parameters.todoCategory = todoCategory.trim() || 'General';
      parameters.todoDueDate = todoDueDate;
    } else if (actionType === 'add_habit') {
      parameters.habitTitle = habitTitle.trim() || 'Daily Habit';
      parameters.habitCategory = habitCategory.trim() || 'Daily';
    } else if (actionType === 'navigate_view') {
      parameters.view = destinationView;
    } else if (actionType === 'add_journal') {
      parameters.journalTitle = journalTitle.trim() || 'Voice Note';
      parameters.journalContent = journalContent.trim();
    }

    if (editingMappingId) {
      updateCommandMapping(editingMappingId, {
        triggerPhrase: cleanPhrase,
        actionType,
        matchType,
        description: description.trim(),
        parameters,
      });
    } else {
      createCommandMapping({
        triggerPhrase: cleanPhrase,
        actionType,
        matchType,
        description: description.trim() || `Calls ${ACTION_META[actionType].functionName}`,
        parameters,
        enabled: true,
      });
    }

    Sound.success(true);
    setIsEditorOpen(false);
    loadMappings();
  };

  // Voice dictation for trigger phrase
  const toggleTriggerVoiceDictation = () => {
    if (isListeningForTrigger) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListeningForTrigger(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningForTrigger(true);
        Sound.voiceRegistered(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setTriggerPhrase(transcript.trim());
          Sound.success(true);
        }
      };

      recognition.onerror = () => {
        setIsListeningForTrigger(false);
      };

      recognition.onend = () => {
        setIsListeningForTrigger(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListeningForTrigger(false);
    }
  };

  // Filter & search mappings
  const filteredMappings = mappings.filter((m) => {
    if (activeFilter !== 'all' && m.actionType !== activeFilter) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const phrase = m.triggerPhrase.toLowerCase();
    const desc = (m.description || '').toLowerCase();
    const fn = (ACTION_META[m.actionType]?.functionName || '').toLowerCase();
    const pName = (m.parameters?.expenseName || m.parameters?.todoTitle || '').toLowerCase();

    return phrase.includes(q) || desc.includes(q) || fn.includes(q) || pName.includes(q);
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] dark:border-[#1F2937] shrink-0 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8] flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#111827] dark:text-white leading-none">
                  Voice Command Mapping
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800/40">
                  {mappings.filter((m) => m.enabled).length} Active
                </span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Define custom voice triggers that directly call app functions with preset parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Execution Banner */}
        {executionBanner && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              executionBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40'
                : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{executionBanner.message}</span>
            </div>
            <button
              onClick={() => setExecutionBanner(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="p-4 border-b border-[#F3F4F6] dark:border-[#1F2937] bg-gray-50/50 dark:bg-[#111827]/50 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search triggers (e.g. 'breakfast', 'todo')..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#6366F1]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset default voice triggers"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Trigger</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-6 py-2.5 border-b border-[#F3F4F6] dark:border-[#1F2937] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All Triggers ({mappings.length})
          </button>
          <button
            onClick={() => setActiveFilter('add_expense')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              activeFilter === 'add_expense'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            Expenses
          </button>
          <button
            onClick={() => setActiveFilter('add_todo')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              activeFilter === 'add_todo'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <CheckSquare className="w-3 h-3" />
            Tasks
          </button>
          <button
            onClick={() => setActiveFilter('navigate_view')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              activeFilter === 'navigate_view'
                ? 'bg-sky-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Compass className="w-3 h-3" />
            Navigation
          </button>
        </div>

        {/* Scrollable Triggers List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 divide-y divide-transparent">
          {filteredMappings.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <Mic className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                No matching voice triggers found
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No triggers matching "${searchQuery}". Clear your search or create a new trigger.`
                  : 'Get started by creating your first custom voice trigger (e.g. "Log breakfast" or "Quick coffee").'}
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-medium hover:bg-[#4F46E5] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Custom Trigger
              </button>
            </div>
          ) : (
            filteredMappings.map((m) => {
              const meta = ACTION_META[m.actionType] || ACTION_META.add_expense;
              const isTesting = testingId === m.id;

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border transition-all ${
                    m.enabled
                      ? 'bg-white dark:bg-[#1F2937]/50 border-[#E5E7EB] dark:border-[#374151] hover:border-indigo-300 dark:hover:border-indigo-700 shadow-xs'
                      : 'bg-gray-50/70 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Trigger phrase */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                          "{m.triggerPhrase}"
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}
                        >
                          {meta.icon}
                          {meta.functionName}
                        </span>

                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono">
                          {m.matchType || 'contains'}
                        </span>
                      </div>

                      {/* Description & Parameter details */}
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                        {m.actionType === 'add_expense' && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">
                            <strong>₹{m.parameters.expenseAmount || 150}</strong> ·{' '}
                            {m.parameters.expenseName || 'Breakfast'} ·{' '}
                            {m.parameters.expenseCategory || 'Food & Dining'}
                          </span>
                        )}

                        {m.actionType === 'add_todo' && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/30">
                            <strong>{m.parameters.todoTitle}</strong> · [
                            {(m.parameters.todoPriority || 'medium').toUpperCase()}] ·{' '}
                            {m.parameters.todoCategory || 'Errands'}
                          </span>
                        )}

                        {m.actionType === 'navigate_view' && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-sky-50/70 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-100 dark:border-sky-800/30">
                            View: <strong>{(m.parameters.view || 'expenses').toUpperCase()}</strong>
                          </span>
                        )}

                        {m.actionType === 'add_habit' && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800/30">
                            Habit: <strong>{m.parameters.habitTitle}</strong> ({m.parameters.habitCategory})
                          </span>
                        )}

                        {m.description && (
                          <span className="text-gray-400 dark:text-gray-500 text-[11px]">
                            • {m.description}
                          </span>
                        )}
                      </div>

                      {/* Usage Stats */}
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          {m.executionCount || 0} executions
                        </span>
                        {m.lastExecutedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last run {new Date(m.lastExecutedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions & Toggles */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {/* Test Execution Button */}
                      <button
                        onClick={(e) => handleTestTrigger(m, e)}
                        disabled={isTesting}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-all cursor-pointer ${
                          isTesting
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-gray-50 dark:bg-gray-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                        }`}
                        title="Simulate speaking this trigger to test function execution"
                      >
                        <Play className={`w-3 h-3 ${isTesting ? 'animate-spin' : 'fill-current'}`} />
                        <span className="hidden sm:inline">{isTesting ? 'Running...' : 'Test'}</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => handleOpenEdit(m, e)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        title="Edit Trigger"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDelete(m.id, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Trigger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={(e) => handleToggle(m.id, e)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ml-1 ${
                          m.enabled ? 'bg-[#6366F1]' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                        title={m.enabled ? 'Disable Trigger' : 'Enable Trigger'}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            m.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#F3F4F6] dark:border-[#1F2937] bg-gray-50/50 dark:bg-[#111827]/50 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Active triggers are checked in real-time during voice input
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Trigger Creator / Editor Overlay Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-[#6366F1]">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {editingMappingId ? 'Edit Voice Trigger' : 'Create Custom Voice Trigger'}
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Map a spoken phrase directly to an existing app function
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Voice Trigger Phrase */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Voice Trigger Phrase</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    What you speak to trigger this action
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={triggerPhrase}
                      onChange={(e) => setTriggerPhrase(e.target.value)}
                      placeholder="e.g. Log breakfast, Buy coffee, Daily workout"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-gray-50 dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#6366F1]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleTriggerVoiceDictation}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isListeningForTrigger
                        ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                    }`}
                    title={isListeningForTrigger ? 'Listening... Speak phrase' : 'Speak trigger phrase'}
                  >
                    {isListeningForTrigger ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
                {isListeningForTrigger && (
                  <p className="text-[11px] text-rose-500 font-medium animate-pulse">
                    Listening... Speak your trigger phrase now (e.g. "Log breakfast")
                  </p>
                )}
              </div>

              {/* Action Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Target App Function to Call
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as CommandActionType)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-gray-50 dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="add_expense">handleAddExpense (Log Expense item)</option>
                  <option value="add_todo">handleAddTodo (Create Task / Todo item)</option>
                  <option value="add_habit">handleAddHabit (Create New Habit)</option>
                  <option value="toggle_habit">handleToggleHabit (Mark Habit Complete)</option>
                  <option value="navigate_view">handleNavigate (Switch Active View)</option>
                  <option value="add_journal">handleAddJournalEntry (Log Journal Note)</option>
                </select>
              </div>

              {/* Dynamic Parameter Settings based on Action */}
              {actionType === 'add_expense' && (
                <div className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <DollarSign className="w-4 h-4" />
                    <span>handleAddExpense Parameters</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                        Expense Name
                      </label>
                      <input
                        type="text"
                        value={expenseName}
                        onChange={(e) => setExpenseName(e.target.value)}
                        placeholder="Breakfast"
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                        Default Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(Number(e.target.value))}
                        placeholder="150"
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                      Category
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Tip: If you speak a specific number like "log breakfast 220", it will automatically override the default ₹{expenseAmount}!
                  </p>
                </div>
              )}

              {actionType === 'add_todo' && (
                <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                    <CheckSquare className="w-4 h-4" />
                    <span>handleAddTodo Parameters</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                      Task Title
                    </label>
                    <input
                      type="text"
                      value={todoTitle}
                      onChange={(e) => setTodoTitle(e.target.value)}
                      placeholder="Buy groceries & essentials"
                      className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                        Priority
                      </label>
                      <select
                        value={todoPriority}
                        onChange={(e) => setTodoPriority(e.target.value as Priority)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={todoCategory}
                        onChange={(e) => setTodoCategory(e.target.value)}
                        placeholder="Errands"
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {actionType === 'navigate_view' && (
                <div className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
                    <Compass className="w-4 h-4" />
                    <span>Destination View</span>
                  </div>
                  <select
                    value={destinationView}
                    onChange={(e) => setDestinationView(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="expenses">Expenses Tracker</option>
                    <option value="todos">Tasks & Todos</option>
                    <option value="habits">Habits & Streaks</option>
                    <option value="schedule">Daily Schedule</option>
                    <option value="analytics">Analytics & Deep Insights</option>
                    <option value="calendar">Calendar Overview</option>
                    <option value="vault">Encrypted Vault</option>
                    <option value="journal">Personal Journal</option>
                  </select>
                </div>
              )}

              {/* Match Mode & Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                    Matching Mode
                  </label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as CommandMatchType)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="contains">Contains phrase (Recommended)</option>
                    <option value="exact">Exact phrase match</option>
                    <option value="starts_with">Starts with phrase</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-gray-600 dark:text-gray-400 block mb-1">
                    Description / Label
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description..."
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-[#1F2937] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingMappingId ? 'Update Trigger' : 'Save Trigger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
