import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Clock, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrashItem, TrashModule } from '../types';
import { Sound } from '../utils/audio';

interface TrashViewProps {
  trash: TrashItem[];
  onRestore: (trashId: string) => void;
  onDeleteForever: (trashId: string) => void;
  onEmptyTrash: () => void;
  soundEnabled: boolean;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const MODULE_META: Record<TrashModule, { label: string; icon: string }> = {
  tasks: { label: 'Task', icon: '✅' },
  habits: { label: 'Habit', icon: '🔥' },
  goals: { label: 'Goal', icon: '🎯' },
  expenses: { label: 'Expense', icon: '💳' },
  media: { label: 'Media Item', icon: '🎬' },
  journal: { label: 'Journal Entry', icon: '📖' },
  projects: { label: 'Project', icon: '💼' },
  timeline: { label: 'Life Map Milestone', icon: '🗺️' },
  achievements: { label: 'Achievement', icon: '🏆' },
  doodles: { label: 'Doodle', icon: '🎨' },
};

const getDaysRemaining = (deletedAt: number): number => {
  const elapsed = Date.now() - deletedAt;
  const remainingMs = THIRTY_DAYS_MS - elapsed;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
};

export const TrashView: React.FC<TrashViewProps> = ({
  trash,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
  soundEnabled,
}) => {
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedTrash = useMemo(
    () => [...trash].sort((a, b) => b.deletedAt - a.deletedAt),
    [trash]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
        <div className="space-y-2">
          <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
            <span>🗑️</span>
            <span>Trash</span>
          </h1>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
            Recently deleted items from every module. Restore anytime within 30 days, after which they
            are permanently and automatically removed.
          </p>
        </div>
        {sortedTrash.length > 0 && (
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setConfirmEmptyOpen(true);
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {sortedTrash.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-[#787774] dark:text-[#9CA3AF]" />
          <p className="text-xs font-bold text-[#37352F] dark:text-white">Trash is empty</p>
          <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF]">
            Deleted tasks, habits, goals, expenses, and more will show up here for 30 days.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedTrash.map((item) => {
              const meta = MODULE_META[item.module] || { label: item.module, icon: '🗑️' };
              const daysLeft = getDaysRemaining(item.deletedAt);
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-3 group hover:bg-gray-50/70 dark:hover:bg-gray-800/40 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300">
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-[#37352F] dark:text-white truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[#787774] dark:text-[#9CA3AF] flex items-center gap-1.5">
                        <span>{meta.label}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>
                          {daysLeft > 0
                            ? `Auto-deletes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                            : 'Auto-deleting soon'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        Sound.success(soundEnabled);
                        onRestore(item.id);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors cursor-pointer"
                      title="Restore"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        Sound.click(soundEnabled);
                        setConfirmDeleteId(item.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete forever"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm: Delete single item forever */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Delete forever?</h3>
            </div>
            <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
              This item will be permanently removed and cannot be restored.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-[#37352F] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onDeleteForever(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Empty entire trash */}
      {confirmEmptyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Empty Trash?</h3>
            </div>
            <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
              All {sortedTrash.length} item{sortedTrash.length === 1 ? '' : 's'} in Trash will be
              permanently removed and cannot be restored.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmEmptyOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-[#37352F] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onEmptyTrash();
                  setConfirmEmptyOpen(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
