import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Flag,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Clock,
  Award,
  Compass,
  X,
  Check,
  Zap,
} from 'lucide-react';
import { GoalItem, GoalMilestone, GoalStatus, MainNavView } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';

interface GoalsViewProps {
  goals: GoalItem[];
  onAddGoal: (goal: Omit<GoalItem, 'id' | 'createdAt'>) => void;
  onUpdateGoal: (id: string, updated: Partial<GoalItem>) => void;
  onDeleteGoal: (id: string) => void;
  onNavigate: (view: MainNavView, tabOrFilter?: string) => void;
  soundEnabled: boolean;
}

const GOAL_CATEGORIES: Array<{ name: string; icon: string; color: string; bg: string }> = [
  { name: 'Career', icon: '💼', color: '#6366F1', bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' },
  { name: 'Finance', icon: '💰', color: '#10B981', bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' },
  { name: 'Health', icon: '🏃', color: '#F43F5E', bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' },
  { name: 'Learning', icon: '📚', color: '#3B82F6', bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' },
  { name: 'Life', icon: '🌱', color: '#F59E0B', bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
  { name: 'Creative', icon: '🎨', color: '#8B5CF6', bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' },
];

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onNavigate,
  soundEnabled,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | GoalStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Career');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formNextAction, setFormNextAction] = useState('');
  const [formProgress, setFormProgress] = useState(0);
  const [formStatus, setFormStatus] = useState<GoalStatus>('active');
  const [formMilestones, setFormMilestones] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);
  const [newMilestoneInput, setNewMilestoneInput] = useState('');

  const openAddModal = () => {
    Sound.click(soundEnabled);
    setEditingGoal(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('Career');
    setFormTargetDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormNextAction('');
    setFormProgress(0);
    setFormStatus('active');
    setFormMilestones([]);
    setNewMilestoneInput('');
    setShowModal(true);
  };

  const openEditModal = (goal: GoalItem) => {
    Sound.click(soundEnabled);
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormDescription(goal.description || '');
    setFormCategory(goal.category);
    setFormTargetDate(goal.targetDate || '');
    setFormNextAction(goal.nextAction || '');
    setFormProgress(goal.progress || 0);
    setFormStatus(goal.status);
    setFormMilestones(goal.milestones ? [...goal.milestones] : []);
    setNewMilestoneInput('');
    setShowModal(true);
  };

  const handleAddMilestoneToForm = () => {
    if (!newMilestoneInput.trim()) return;
    setFormMilestones([
      ...formMilestones,
      {
        id: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        title: newMilestoneInput.trim(),
        completed: false,
      },
    ]);
    setNewMilestoneInput('');
  };

  const handleRemoveMilestoneFromForm = (id: string) => {
    setFormMilestones(formMilestones.filter((m) => m.id !== id));
  };

  const handleToggleFormMilestone = (id: string) => {
    const updated = formMilestones.map((m) =>
      m.id === id ? { ...m, completed: !m.completed } : m
    );
    setFormMilestones(updated);
    // Auto calculate progress if milestones exist
    if (updated.length > 0) {
      const completedCount = updated.filter((m) => m.completed).length;
      setFormProgress(Math.round((completedCount / updated.length) * 100));
    }
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const catObj = GOAL_CATEGORIES.find((c) => c.name === formCategory);

    if (editingGoal) {
      onUpdateGoal(editingGoal.id, {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
        targetDate: formTargetDate || undefined,
        nextAction: formNextAction.trim() || undefined,
        progress: Number(formProgress),
        status: formStatus,
        milestones: formMilestones,
        icon: catObj?.icon || '🎯',
      });
      Sound.success(soundEnabled);
    } else {
      onAddGoal({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
        targetDate: formTargetDate || undefined,
        nextAction: formNextAction.trim() || undefined,
        progress: Number(formProgress),
        status: formStatus,
        milestones: formMilestones,
        icon: catObj?.icon || '🎯',
      });
      Sound.success(soundEnabled);
      triggerConfetti();
    }

    setShowModal(false);
  };

  const handleToggleMilestoneInCard = (goal: GoalItem, milestoneId: string) => {
    Sound.click(soundEnabled);
    const updatedMilestones = (goal.milestones || []).map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    const completedCount = updatedMilestones.filter((m) => m.completed).length;
    const newProgress = Math.round((completedCount / updatedMilestones.length) * 100);
    const newStatus: GoalStatus = newProgress === 100 ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;

    if (newProgress === 100) {
      Sound.success(soundEnabled);
      triggerConfetti();
    }

    onUpdateGoal(goal.id, {
      milestones: updatedMilestones,
      progress: newProgress,
      status: newStatus,
    });
  };

  const handleQuickStatusChange = (goal: GoalItem, newStatus: GoalStatus) => {
    Sound.click(soundEnabled);
    const newProgress = newStatus === 'completed' ? 100 : goal.progress;
    if (newStatus === 'completed') {
      Sound.success(soundEnabled);
      triggerConfetti();
    }
    onUpdateGoal(goal.id, {
      status: newStatus,
      progress: newProgress,
    });
  };

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && g.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = g.title.toLowerCase().includes(q);
        const matchDesc = (g.description || '').toLowerCase().includes(q);
        const matchNext = (g.nextAction || '').toLowerCase().includes(q);
        const matchCat = (g.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchNext && !matchCat) return false;
      }
      return true;
    });
  }, [goals, statusFilter, categoryFilter, searchQuery]);

  // Quick Metrics
  const activeCount = useMemo(() => goals.filter((g) => g.status === 'active').length, [goals]);
  const completedCount = useMemo(() => goals.filter((g) => g.status === 'completed').length, [goals]);
  const avgProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const sum = goals.reduce((acc, curr) => acc + (curr.progress || 0), 0);
    return Math.round(sum / goals.length);
  }, [goals]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header with Title & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="workspace-heading font-extrabold text-[#111827] dark:text-white tracking-tight">
                Goals &amp; Aspirations
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Define strategic long-term outcomes, track milestone execution, and align daily habits
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
              Active Goals
            </span>
            <Target className="w-4 h-4 text-[#6366F1]" />
          </div>
          <p className="text-2xl font-extrabold text-[#111827] dark:text-white mt-1">
            {activeCount}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
              Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-[#111827] dark:text-white mt-1">
            {completedCount}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
              Average Progress
            </span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-[#111827] dark:text-white mt-1">
            {avgProgress}%
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
              Total Tracked
            </span>
            <Flag className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-[#111827] dark:text-white mt-1">
            {goals.length}
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'upcoming', 'completed', 'archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setStatusFilter(st);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#6366F1] text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#334155]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
          >
            <option value="all">All Categories</option>
            {GOAL_CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search goals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
            />
          </div>
        </div>
      </div>

      {/* 4. Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#1E293B] border border-dashed border-[#E5E7EB] dark:border-[#334155] space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] flex items-center justify-center">
            <Target className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-[#111827] dark:text-white">
              {goals.length === 0 ? 'Set Something Worth Moving Toward' : 'No Matching Goals Found'}
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {goals.length === 0
                ? 'Create your first long-term personal goal to give purpose and direction to your daily tasks and routines.'
                : 'Try adjusting your search query or filter criteria.'}
            </p>
          </div>
          {goals.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create My First Goal</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const catMeta = GOAL_CATEGORIES.find((c) => c.name === goal.category) || GOAL_CATEGORIES[0];
            const isCompleted = goal.status === 'completed' || goal.progress === 100;

            return (
              <div
                key={goal.id}
                className="p-5 rounded-3xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs hover:shadow-xs transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Badges & Action Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${catMeta.bg}`}>
                        <span>{goal.icon || catMeta.icon}</span>
                        <span>{goal.category}</span>
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          goal.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : goal.status === 'upcoming'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            : goal.status === 'archived'
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                        }`}
                      >
                        {goal.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(goal)}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#6366F1] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] cursor-pointer transition-colors"
                        title="Edit Goal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onDeleteGoal(goal.id);
                        }}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className={`text-base font-bold text-[#111827] dark:text-white ${isCompleted ? 'line-through opacity-80' : ''}`}>
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Next Action Callout (if set) */}
                  {goal.nextAction && (
                    <div className="p-2.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] flex items-center gap-2 text-xs text-[#334155] dark:text-[#CBD5E1]">
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold text-[11px] text-[#64748B] dark:text-[#94A3B8]">Next Step:</span>
                      <span className="font-medium truncate">{goal.nextAction}</span>
                    </div>
                  )}

                  {/* Progress Bar & Percentage */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                        Progress
                      </span>
                      <span className="font-mono font-bold text-xs text-[#6366F1] dark:text-[#818CF8]">
                        {goal.progress}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#F3F4F6] dark:bg-[#0F172A] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]'
                        }`}
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones / Sub-step Checklists (if any) */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#F3F4F6] dark:border-[#334155]">
                      <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">
                        Milestones ({goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length})
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {goal.milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleToggleMilestoneInCard(goal, m.id)}
                            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] cursor-pointer text-xs transition-colors"
                          >
                            {m.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-[#D1D5DB] dark:text-[#4B5563] shrink-0" />
                            )}
                            <span
                              className={`text-xs ${
                                m.completed
                                  ? 'line-through text-[#9CA3AF] dark:text-[#64748B]'
                                  : 'text-[#374151] dark:text-[#E2E8F0] font-medium'
                              }`}
                            >
                              {m.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Target Date & Status Actions */}
                <div className="pt-3 border-t border-[#F3F4F6] dark:border-[#334155] flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#9CA3AF]">
                    <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span className="text-[11px] font-medium">
                      {goal.targetDate ? `Target: ${goal.targetDate}` : 'Open-ended'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {goal.status !== 'completed' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(goal, 'completed')}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Complete</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(goal, 'active')}
                        className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. ADD / EDIT GOAL MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveGoal}
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] p-6 shadow-2xl space-y-4 animate-in fade-in-50 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-[#334155]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#111827] dark:text-white">
                  {editingGoal ? 'Edit Goal' : 'Create Strategic Goal'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Goal Title */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                Goal Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Become a Senior Systems Architect, Run a Marathon..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                Why does this matter? (Description)
              </label>
              <textarea
                rows={2}
                placeholder="High-level purpose, desired outcome, or measurable success metrics..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] resize-none"
              />
            </div>

            {/* Category & Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                  Life Area / Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  {GOAL_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                  Current Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as GoalStatus)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="active">Active (In Flight)</option>
                  <option value="upcoming">Upcoming (Planned)</option>
                  <option value="completed">Completed (Achieved)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Target Date & Next Step */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                  Immediate Next Step
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule weekly review..."
                  value={formNextAction}
                  onChange={(e) => setFormNextAction(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>

            {/* Progress Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                  Progress ({formProgress}%)
                </label>
                <span className="text-[11px] font-mono text-[#6366F1] font-bold">
                  {formProgress}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={formProgress}
                onChange={(e) => setFormProgress(Number(e.target.value))}
                className="w-full accent-[#6366F1]"
              />
            </div>

            {/* Sub-Milestones Manager */}
            <div className="space-y-2 pt-2 border-t border-[#F3F4F6] dark:border-[#334155]">
              <label className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] block">
                Sub-Milestones &amp; Checkpoints
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add checkpoint step..."
                  value={newMilestoneInput}
                  onChange={(e) => setNewMilestoneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMilestoneToForm();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddMilestoneToForm}
                  className="px-3 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Add Step
                </button>
              </div>

              {formMilestones.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                  {formMilestones.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleFormMilestone(m.id)}
                        className="flex items-center gap-2 text-left cursor-pointer"
                      >
                        {m.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-[#9CA3AF]" />
                        )}
                        <span
                          className={`text-xs ${
                            m.completed ? 'line-through text-[#9CA3AF]' : 'text-[#374151] dark:text-white font-medium'
                          }`}
                        >
                          {m.title}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveMilestoneFromForm(m.id)}
                        className="text-[#9CA3AF] hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F3F4F6] dark:border-[#334155]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl shadow-md cursor-pointer"
              >
                {editingGoal ? 'Update Goal' : 'Save Goal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
