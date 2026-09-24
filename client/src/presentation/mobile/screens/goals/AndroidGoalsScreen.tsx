import React, { useState } from 'react';
import { Target, Plus, Check, Trash2, Calendar, TrendingUp, Flag } from 'lucide-react';
import { GoalItem, GoalStatus } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { BottomSheet } from '../../gestures/BottomSheet';

export interface AndroidGoalsScreenProps {
  goals: GoalItem[];
  onAddGoal?: (goal: Omit<GoalItem, 'id' | 'createdAt'>) => void;
  onUpdateGoal?: (id: string, updates: Partial<GoalItem>) => void;
  onDeleteGoal?: (id: string) => void;
}

export const AndroidGoalsScreen: React.FC<AndroidGoalsScreenProps> = ({
  goals,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => {
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activeActionGoal, setActiveActionGoal] = useState<GoalItem | null>(null);

  // Add goal form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Career');
  const [newTargetDate, setNewTargetDate] = useState('');

  const activeGoals = goals.filter((g) => g.status !== 'completed');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  const handleIncrementProgress = (goal: GoalItem, delta: number) => {
    void nativeService.triggerHaptic('success');
    if (!onUpdateGoal) return;
    const newProgress = Math.min(100, Math.max(0, goal.progress + delta));
    const newStatus: GoalStatus = newProgress === 100 ? 'completed' : 'active';
    onUpdateGoal(goal.id, { progress: newProgress, status: newStatus });
  };

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteGoal) onDeleteGoal(id);
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !onAddGoal) return;
    void nativeService.triggerHaptic('success');
    onAddGoal({
      title: newTitle.trim(),
      category: newCategory,
      targetDate: newTargetDate || undefined,
      progress: 0,
      status: 'active',
    });
    setNewTitle('');
    setNewTargetDate('');
    setIsAddSheetOpen(false);
  };

  const actionItems: ActionSheetItem[] = activeActionGoal
    ? [
        {
          label: activeActionGoal.status === 'completed' ? 'Reopen Goal' : 'Mark as Complete (100%)',
          icon: <Check className="w-4 h-4" />,
          onClick: () => {
            if (onUpdateGoal) {
              const isComp = activeActionGoal.status === 'completed';
              onUpdateGoal(activeActionGoal.id, {
                progress: isComp ? 50 : 100,
                status: isComp ? 'active' : 'completed',
              });
            }
          },
        },
        {
          label: 'Delete Goal',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => handleDelete(activeActionGoal.id),
        },
      ]
    : [];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Life Goals & Targets
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {activeGoals.length} active · {completedGoals.length} accomplished
          </p>
        </div>

        {onAddGoal && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Goal</span>
          </button>
        )}
      </div>

      {/* Goal Cards */}
      <div className="space-y-3">
        {goals.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <Target className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No goals set yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Set inspiring targets with milestones and progress tracking.
            </p>
          </div>
        ) : (
          goals.map((goal) => (
            <GoalItemCard
              key={goal.id}
              goal={goal}
              onIncrement={(delta) => handleIncrementProgress(goal, delta)}
              onLongPress={() => setActiveActionGoal(goal)}
            />
          ))
        )}
      </div>

      {/* Add Goal Bottom Sheet */}
      <BottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="Add Life Goal"
        subtitle="Define a measurable target and deadline"
      >
        <form onSubmit={handleCreateGoal} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Goal Title
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Run 10km Marathon, Master React"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white"
              >
                <option value="Career">Career</option>
                <option value="Finance">Finance</option>
                <option value="Health">Health</option>
                <option value="Learning">Learning</option>
                <option value="Life">Life</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Create Goal
          </button>
        </form>
      </BottomSheet>

      {/* Long-press Contextual Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionGoal)}
        onClose={() => setActiveActionGoal(null)}
        title={activeActionGoal?.title || 'Goal Options'}
        subtitle={`Category: ${activeActionGoal?.category} · Progress: ${activeActionGoal?.progress}%`}
        actions={actionItems}
      />
    </div>
  );
};

interface GoalItemCardProps {
  goal: GoalItem;
  onIncrement: (delta: number) => void;
  onLongPress: () => void;
}

const GoalItemCard: React.FC<GoalItemCardProps> = ({
  goal,
  onIncrement,
  onLongPress,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  const isCompleted = goal.status === 'completed' || goal.progress >= 100;

  return (
    <div
      {...longPressProps}
      className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs select-none space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
              isCompleted
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                : 'bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400'
            }`}
          >
            <Target className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
              {goal.title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              <span>{goal.category}</span>
              {goal.targetDate && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Calendar className="w-3 h-3" />
                    {goal.targetDate}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isCompleted
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              : 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
          }`}
        >
          {goal.progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-100 dark:bg-[#1A2234] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isCompleted ? 'bg-emerald-500' : 'bg-violet-600'
          }`}
          style={{ width: `${goal.progress}%` }}
        />
      </div>

      {/* Quick Increment Controls */}
      {!isCompleted && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onIncrement(10)}
            className="px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-[11px] font-bold text-violet-700 dark:text-violet-300 active:scale-95 transition-all cursor-pointer"
          >
            +10%
          </button>
          <button
            type="button"
            onClick={() => onIncrement(25)}
            className="px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-[11px] font-bold text-violet-700 dark:text-violet-300 active:scale-95 transition-all cursor-pointer"
          >
            +25%
          </button>
          <button
            type="button"
            onClick={() => onIncrement(100 - goal.progress)}
            className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 active:scale-95 transition-all cursor-pointer"
          >
            Complete
          </button>
        </div>
      )}
    </div>
  );
};
