import React, { useState, useMemo } from 'react';
import { Compass, Milestone, Calendar, Sparkles, CheckCircle2, Clock, Plus, Trash2, Search, X } from 'lucide-react';
import { LifeMilestone, UserProfile } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { BottomSheet } from '../../gestures/BottomSheet';

export interface AndroidLifeMapScreenProps {
  milestones?: LifeMilestone[];
  profile?: UserProfile;
  onAddMilestone?: (milestone: Omit<LifeMilestone, 'id'>) => void;
  onUpdateMilestone?: (id: string, updates: Partial<LifeMilestone>) => void;
  onDeleteMilestone?: (id: string) => void;
}

const CATEGORIES = [
  'Career',
  'Education',
  'Project',
  'Life',
  'Health',
  'Personal',
  'Travel',
] as const;

const QUICK_ICONS = ['🎓', '💼', '🚀', '📍', '🏆', '🌟', '🏠', '💡', '✈️', '🎯'];

export const AndroidLifeMapScreen: React.FC<AndroidLifeMapScreenProps> = ({
  milestones = [],
  profile,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
}) => {
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Form state for adding milestone
  const [title, setTitle] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [dateStr, setDateStr] = useState('');
  const [category, setCategory] = useState<string>('Career');
  const [icon, setIcon] = useState('📍');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'completed' | 'in_progress' | 'upcoming'>('completed');
  const [progress, setProgress] = useState(100);

  const filteredMilestones = useMemo(() => {
    let result = [...milestones].sort((a, b) => b.year - a.year);
    if (selectedCategory !== 'All') {
      result = result.filter((m) => m.category?.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [milestones, selectedCategory, searchQuery]);

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !onAddMilestone) return;

    void nativeService.triggerHaptic('success');
    onAddMilestone({
      title: title.trim(),
      year: Number(year) || new Date().getFullYear(),
      dateStr: dateStr.trim() || `${year}`,
      category,
      icon,
      description: description.trim(),
      status,
      progress: status === 'completed' ? 100 : progress,
    });

    // Reset form
    setTitle('');
    setDateStr('');
    setDescription('');
    setProgress(100);
    setIsAddSheetOpen(false);
  };

  const handleToggleStatus = (m: LifeMilestone) => {
    if (!onUpdateMilestone) return;
    void nativeService.triggerHaptic('selection');
    const nextStatus = m.status === 'completed' ? 'in_progress' : 'completed';
    onUpdateMilestone(m.id, {
      status: nextStatus,
      progress: nextStatus === 'completed' ? 100 : (m.progress || 50),
    });
  };

  const handleDelete = (id: string) => {
    if (!onDeleteMilestone) return;
    void nativeService.triggerHaptic('warning');
    onDeleteMilestone(id);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Subtitle & Quick Action Bar */}
      <div className="flex items-center justify-between px-1 pt-0.5 pb-0.5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {milestones.length} life milestone{milestones.length === 1 ? '' : 's'} recorded
        </p>

        {onAddMilestone && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Milestone</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      {milestones.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search milestones & life events..."
            className="w-full pl-8 pr-8 py-2 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white placeholder-gray-400 shadow-2xs focus:outline-hidden focus:border-violet-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Category Filter Chips */}
      {milestones.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {['All', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-300 border border-[#E8E5F3] dark:border-[#242D40]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Timeline List */}
      <div className="space-y-3">
        {filteredMilestones.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] space-y-3">
            <Compass className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {searchQuery ? 'No matching milestones found' : 'No milestones recorded yet'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              {searchQuery
                ? 'Try a different search term or category.'
                : 'Chronicle your career milestones, degrees, projects, life events, and personal triumphs.'}
            </p>
            {onAddMilestone && !searchQuery && (
              <button
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setIsAddSheetOpen(true);
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Life Milestone</span>
              </button>
            )}
          </div>
        ) : (
          filteredMilestones.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2 select-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">{m.icon || '📍'}</span>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                      {m.title}
                    </h3>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                      {m.year} {m.dateStr && m.dateStr !== `${m.year}` ? `· ${m.dateStr}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                    {m.category}
                  </span>
                  {m.status && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        m.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : m.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {m.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {m.description && (
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pl-8">
                  {m.description}
                </p>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[11px] text-gray-500">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(m)}
                  className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-medium hover:underline cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{m.status === 'completed' ? 'Mark in progress' : 'Mark completed'}</span>
                </button>

                {onDeleteMilestone && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="p-1 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                    title="Delete milestone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Milestone Bottom Sheet */}
      <BottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="Add Life Milestone"
        subtitle="Chronicle a significant chapter or achievement"
      >
        <form onSubmit={handleCreateMilestone} className="space-y-4 pb-6">
          {/* Milestone Title */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Milestone Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Graduated B.Tech with First Class Honours"
              className="w-full px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-violet-500"
            />
          </div>

          {/* Year and Date string */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Year *
              </label>
              <input
                type="number"
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={1970}
                max={2060}
                className="w-full px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white focus:outline-hidden focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Date / Month
              </label>
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="e.g. August 2026"
                className="w-full px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-violet-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    category === cat
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Icon Emoji
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {QUICK_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg cursor-pointer transition-all ${
                    icon === emoji
                      ? 'bg-violet-600 text-white ring-2 ring-violet-400'
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-12 h-9 text-center text-base rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
                title="Custom emoji"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['completed', 'in_progress', 'upcoming'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    status === s
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Reflection / Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reflect on why this milestone is meaningful and lessons learned..."
              className="w-full px-3 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-violet-500"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddSheetOpen(false)}
              className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              Save Milestone
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
};
