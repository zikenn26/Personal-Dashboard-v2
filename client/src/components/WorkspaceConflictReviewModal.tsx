import React, { useState } from 'react';
import { X } from 'lucide-react';
import { WorkspaceSyncConflict } from '../services/syncProtocol';

interface Props {
  conflicts: WorkspaceSyncConflict[];
  onResolve: (conflict: WorkspaceSyncConflict, choice: 'local' | 'remote') => Promise<void>;
  onResolveAll?: (choice: 'local' | 'remote') => Promise<void>;
  onDismiss?: () => void;
}

const describePath = (path: WorkspaceSyncConflict['path']) => path.map((part) =>
  typeof part === 'string' ? part : `item ${part.id}`
).join(' › ');

const formatValue = (value: unknown) => value === undefined
  ? 'Deleted'
  : typeof value === 'string'
    ? value || '(empty)'
    : JSON.stringify(value, null, 2) || '(empty)';

export const WorkspaceConflictReviewModal: React.FC<Props> = ({ conflicts, onResolve, onResolveAll, onDismiss }) => {
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const conflict = conflicts[index];
  if (!conflict) return null;

  const choose = async (choice: 'local' | 'remote') => {
    setSaving(true);
    try {
      await onResolve(conflict, choice);
      setIndex((current) => Math.min(current, Math.max(0, conflicts.length - 2)));
    } finally {
      setSaving(false);
    }
  };

  const chooseAll = async (choice: 'local' | 'remote') => {
    if (!onResolveAll) return;
    setSaving(true);
    try {
      await onResolveAll(choice);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="workspace-conflict-title" className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="workspace-conflict-title" className="text-lg font-semibold">Review a sync conflict</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Both devices changed this field while offline. Choose which value to keep.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">{index + 1} of {conflicts.length}</span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Dismiss conflict review"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        {onResolveAll && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Quick 1-Click Resolution ({conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}):</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void chooseAll('local')}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Keep all from this device
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void chooseAll('remote')}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Keep all from server
              </button>
            </div>
          </div>
        )}
        <div className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{describePath(conflict.path)}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-sky-300 p-3 dark:border-sky-800">
            <h3 className="mb-2 text-sm font-semibold">This device</h3>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">{formatValue(conflict.localValue)}</pre>
            <button disabled={saving} onClick={() => void choose('local')} className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">Keep this value</button>
          </article>
          <article className="rounded-xl border border-violet-300 p-3 dark:border-violet-800">
            <h3 className="mb-2 text-sm font-semibold">Other device / server</h3>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">{formatValue(conflict.remoteValue)}</pre>
            <button disabled={saving} onClick={() => void choose('remote')} className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">Keep their value</button>
          </article>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">The selected value will be saved locally and synced. Unresolved conflicts stay available for review.</p>
      </section>
    </div>
  );
};
