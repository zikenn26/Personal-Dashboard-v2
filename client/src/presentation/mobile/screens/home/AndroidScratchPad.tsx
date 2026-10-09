
import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Copy, Undo2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { nativeService } from '../../../../services/nativeService';
import { Storage } from '../../../../utils/storage';
import { scheduleAutoSyncToSupabase } from '../../../../utils/supabase';

export const AndroidScratchPad: React.FC = () => {
  const [content, setContent] = useState<string>(() => {
    try {
      const saved = Storage.getScratchpad();
      if (
        saved.includes('Jot down quick ideas') ||
        saved.includes('Auto-indented sticky note')
      ) {
        return '';
      }
      return saved || '';
    } catch {
      return '';
    }
  });

  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirtyRef = useRef(false);
  const contentRef = useRef(content);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a synchronous copy of the current draft.
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Accept remote changes only when this editor has no unsaved draft.
  useEffect(() => {
    const handleRemoteSync = (e: Event) => {
      if (isDirtyRef.current) return;

      const detail = (e as CustomEvent<{ content?: string }>).detail;
      const updated =
        typeof detail?.content === 'string'
          ? detail.content
          : Storage.getScratchpad();

      if (typeof updated === 'string' && updated !== contentRef.current) {
        contentRef.current = updated;
        setContent(updated);
        setHistory([]);
      }
    };

    window.addEventListener('scratchpad-updated', handleRemoteSync);
    window.addEventListener('dashboard-data-updated', handleRemoteSync);

    return () => {
      window.removeEventListener('scratchpad-updated', handleRemoteSync);
      window.removeEventListener('dashboard-data-updated', handleRemoteSync);
    };
  }, []);

  // Save the current draft to local storage, cloud sync queue and native widget.
  const handleSave = () => {
    if (!isDirtyRef.current) return;

    const valueToSave = contentRef.current;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    isDirtyRef.current = false;
    setIsDirty(false);
    setIsSaving(true);

    try {
      Storage.setScratchpad(valueToSave);

      scheduleAutoSyncToSupabase(
        () => Storage.getAllDataPayload(),
        500
      );

      toast.success('Scratch Pad saved');
    } catch (error) {
      // Keep the draft available for another save attempt.
      isDirtyRef.current = true;
      setIsDirty(true);
      console.error('Failed to save Scratch Pad:', error);
      toast.error('Could not save Scratch Pad');
    } finally {
      setIsSaving(false);
    }
  };

  // Editing changes the draft only. Saving is explicit.
  const updateDraft = (newValue: string) => {
    if (newValue === contentRef.current) return;

    setHistory((prev) => [...prev.slice(-30), contentRef.current]);

    contentRef.current = newValue;
    isDirtyRef.current = true;

    setContent(newValue);
    setIsDirty(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    updateDraft(e.target.value);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 's'
    ) {
      e.preventDefault();
      handleSave();
      return;
    }

    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 'z' &&
      !e.shiftKey
    ) {
      e.preventDefault();
      handleUndo();
      return;
    }

    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      const currentLine =
        value.substring(0, selectionStart).split('\n').pop() || '';

      if (
        currentLine.startsWith('- ') ||
        currentLine.startsWith('• ')
      ) {
        e.preventDefault();

        const prefix = currentLine.startsWith('- ') ? '- ' : '• ';
        const before = value.substring(0, selectionStart);
        const after = value.substring(selectionEnd);
        const nextValue = `${before}\n${prefix}${after}`;

        updateDraft(nextValue);

        requestAnimationFrame(() => {
          if (!textareaRef.current) return;

          const newPosition = selectionStart + prefix.length + 1;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
        });
      }
    }
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const pasted = e.clipboardData.getData('text');

    if (!pasted.includes('\n')) return;

    e.preventDefault();

    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    const formattedPaste = pasted
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();

        if (!trimmed) return '';

        return trimmed.startsWith('-')
          ? trimmed.startsWith('- ')
            ? trimmed
            : `- ${trimmed.slice(1).trim()}`
          : `- ${trimmed}`;
      })
      .join('\n');

    const before = value.substring(0, selectionStart);
    const after = value.substring(selectionEnd);
    const nextValue = `${before}${formattedPaste}${after}`;

    updateDraft(nextValue);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;

      const newPosition = selectionStart + formattedPaste.length;
      textareaRef.current.selectionStart = newPosition;
      textareaRef.current.selectionEnd = newPosition;
    });
  };

  const handleCopy = async () => {
    void nativeService.triggerHaptic('selection');

    try {
      await navigator.clipboard.writeText(contentRef.current);
      setCopied(true);
      toast.success('Scratch Pad copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy Scratch Pad');
    }
  };

  const handleUndo = () => {
    void nativeService.triggerHaptic('selection');

    if (history.length === 0) {
      toast.info('Nothing to undo');
      return;
    }

    const previous = history[history.length - 1];

    setHistory((prev) => prev.slice(0, -1));
    contentRef.current = previous;
    isDirtyRef.current = true;

    setContent(previous);
    setIsDirty(true);

    textareaRef.current?.focus();
  };

  const handleAddBullet = React.useCallback(() => {
    void nativeService.triggerHaptic('selection');

    const current = contentRef.current;
    const trimmed = current.trimEnd();
    const nextValue = trimmed ? `${trimmed}\n- ` : '- ';

    updateDraft(nextValue);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;

      textareaRef.current.focus();

      const length = textareaRef.current.value.length;
      textareaRef.current.selectionStart = length;
      textareaRef.current.selectionEnd = length;
    });
  }, [content]);

  // Handle Android home-screen widget taps.
  useEffect(() => {
    const handleFocusRequest = (e: Event) => {
      const detail = (e as CustomEvent<{ autoAdd?: boolean }>).detail;
      const autoAdd = Boolean(detail?.autoAdd);

      document
        .getElementById('android-scratchpad-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        if (autoAdd) {
          handleAddBullet();
        } else {
          textareaRef.current?.focus();
        }
      }, 350);
    };

    window.addEventListener('focus-scratchpad', handleFocusRequest);

    return () => {
      window.removeEventListener('focus-scratchpad', handleFocusRequest);
    };
  }, [handleAddBullet]);

  // Warn before navigating away with an unsaved draft.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;

      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      id="android-scratchpad-card"
      className="w-full rounded-3xl bg-amber-50/70 dark:bg-[#1C1814] border border-amber-200/80 dark:border-amber-900/50 p-3 sm:p-3.5 shadow-2xs transition-all"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/60 dark:border-amber-900/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-200/70 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 shadow-2xs">
            <StickyNote className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
              Scratch Pad
            </h3>
            <span className="text-[10px] text-amber-700/90 dark:text-amber-400 font-medium block -mt-0.5">
              {isSaving
                ? 'Saving...'
                : isDirty
                  ? 'Unsaved changes'
                  : 'Saved'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAddBullet}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition-all cursor-pointer"
            title="Add item line"
            aria-label="Add item line"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition-all cursor-pointer"
            title="Copy notes"
            aria-label="Copy notes"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Undo edit"
            aria-label="Undo edit"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="p-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save Scratch Pad"
            aria-label="Save Scratch Pad"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="- Start typing your notes..."
        rows={4}
        className="w-full bg-transparent resize-y min-h-[96px] max-h-[240px] text-xs sm:text-[13px] leading-relaxed text-gray-800 dark:text-gray-100 placeholder:text-amber-700/40 dark:placeholder:text-amber-500/40 outline-none border-none p-0 focus:ring-0 font-sans"
        style={{ letterSpacing: '0px' }}
      />
    </div>
  );
};
