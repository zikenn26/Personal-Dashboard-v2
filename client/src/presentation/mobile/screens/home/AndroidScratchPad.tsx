import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Copy, Undo2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { nativeService } from '../../../../services/nativeService';

const STORAGE_KEY = 'lifeos_scratchpad_notes';

const DEFAULT_CONTENT = `- Jot down quick ideas, daily thoughts, or links\n- Auto-indented sticky note for your flow\n- `;

export const AndroidScratchPad: React.FC = () => {
  const [content, setContent] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? saved : DEFAULT_CONTENT;
    } catch {
      return DEFAULT_CONTENT;
    }
  });

  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const saveContent = (val: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch {
      // Ignore storage errors
    }
  };

  const updateContentWithHistory = (newVal: string) => {
    if (newVal !== content) {
      setHistory((prev) => [...prev.slice(-30), content]);
    }
    setContent(newVal);
    saveContent(newVal);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = e.target.value;
    if (val === '') {
      updateContentWithHistory('');
      return;
    }
    // If text is non-empty and does not start with '-', format first line
    if (!val.startsWith('-')) {
      val = `- ${val}`;
    }
    // Format any un-indented line with '- '
    const lines = val.split('\n');
    const formatted = lines.map((line, idx) => {
      if (idx === 0) return line;
      if (line.length > 0 && !line.startsWith('-')) {
        return `- ${line}`;
      }
      return line;
    });
    val = formatted.join('\n');
    updateContentWithHistory(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Z or Cmd+Z keyboard shortcut for Undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);
      const nextVal = `${before}\n- ${after}`;
      updateContentWithHistory(nextVal);
      requestAnimationFrame(() => {
        const newPos = selectionStart + 3; // '\n- ' has length 3
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.includes('\n')) {
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
      const nextVal = `${before}${formattedPaste}${after}`;
      updateContentWithHistory(nextVal);
      requestAnimationFrame(() => {
        const newPos = selectionStart + formattedPaste.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
      });
    }
  };

  const handleCopy = () => {
    void nativeService.triggerHaptic('selection');
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Scratch pad copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUndo = () => {
    void nativeService.triggerHaptic('selection');
    if (history.length === 0) {
      toast.info('Nothing to undo');
      return;
    }
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setContent(previous);
    saveContent(previous);
    toast.success('Undone last edit');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleAddBullet = () => {
    void nativeService.triggerHaptic('selection');
    const trimmed = content.trimEnd();
    const nextVal = trimmed ? `${trimmed}\n- ` : '- ';
    updateContentWithHistory(nextVal);
    if (textareaRef.current) {
      textareaRef.current.focus();
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const len = textareaRef.current.value.length;
          textareaRef.current.selectionStart = len;
          textareaRef.current.selectionEnd = len;
        }
      });
    }
  };

  return (
    <div className="w-full rounded-3xl bg-amber-50/70 dark:bg-[#1C1814] border border-amber-200/80 dark:border-amber-900/50 p-3 sm:p-3.5 shadow-2xs transition-all">
      {/* Header */}
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
              Sticky Notes • Auto-indented
            </span>
          </div>
        </div>

        {/* Action buttons */}
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
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition-all cursor-pointer"
            title="Copy notes"
            aria-label="Copy notes"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Undo delete / edit"
            aria-label="Undo delete or edit"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Textarea note body */}
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
