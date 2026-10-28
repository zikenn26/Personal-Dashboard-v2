import React, { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Download,
  ExternalLink,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Filter,
} from 'lucide-react';
import { ExamBook, ExamItem, ExamBookStatus, ExamSubject } from '../../types';
import { Sound } from '../../utils/audio';

interface EditableBooksTableProps {
  exam: ExamItem;
  onUpdateExam: (updated: Partial<ExamItem>) => void;
  soundEnabled: boolean;
  onOpenBookModal?: (bookToEdit?: ExamBook | null) => void;
}

// Default column widths for books table
const DEFAULT_BOOK_COL_WIDTHS: Record<string, number> = {
  num: 48,
  subject: 120,
  title: 220,
  author: 160,
  status: 125,
  pages: 130,
  priority: 100,
  notes: 180,
  actions: 90,
};

export const EditableBooksTable: React.FC<EditableBooksTableProps> = ({
  exam,
  onUpdateExam,
  soundEnabled,
  onOpenBookModal,
}) => {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => ({
    ...DEFAULT_BOOK_COL_WIDTHS,
  }));

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Row-level edit state
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [draftBook, setDraftBook] = useState<ExamBook | null>(null);

  // Drag-to-resize column state
  const resizingColRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Global column size modifier (+ / - from top)
  const handleScaleAllColumns = (delta: number) => {
    setColWidths((prev) => {
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((key) => {
        const current = prev[key] || DEFAULT_BOOK_COL_WIDTHS[key] || 100;
        next[key] = Math.max(36, Math.min(450, current + delta));
      });
      return next;
    });
    Sound.click(soundEnabled);
  };

  const handleResetColumnWidths = () => {
    setColWidths({ ...DEFAULT_BOOK_COL_WIDTHS });
    Sound.click(soundEnabled);
  };

  const handleStartResize = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidths[colKey] || DEFAULT_BOOK_COL_WIDTHS[colKey] || 100;
    resizingColRef.current = { key: colKey, startX: e.clientX, startWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const diff = moveEvent.clientX - resizingColRef.current.startX;
      const newWidth = Math.max(40, Math.min(500, resizingColRef.current.startWidth + diff));
      setColWidths((prev) => ({
        ...prev,
        [resizingColRef.current!.key]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Filtered books
  const filteredBooks = useMemo(() => {
    return exam.books.filter((b) => {
      const subjectObj = exam.subjects.find((s) => s.id === b.subjectId);
      const subjectName = subjectObj?.name || b.subject || '';
      const subjectCode = subjectObj?.code || '';

      const matchesSearch =
        searchQuery.trim() === '' ||
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.notes && b.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subjectCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject = subjectFilter === 'all' || b.subjectId === subjectFilter;
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;

      return matchesSearch && matchesSubject && matchesStatus;
    });
  }, [exam.books, exam.subjects, searchQuery, subjectFilter, statusFilter]);

  // Actions
  const handleStartEdit = (book: ExamBook) => {
    setEditingBookId(book.id);
    setDraftBook({ ...book });
    Sound.click(soundEnabled);
  };

  const handleCancelEdit = () => {
    // If it was a newly added empty row that was canceled without saving
    if (editingBookId && draftBook && draftBook.title.trim() === '') {
      const remaining = exam.books.filter((b) => b.id !== editingBookId);
      onUpdateExam({ books: remaining, updatedAt: Date.now() });
    }
    setEditingBookId(null);
    setDraftBook(null);
    Sound.click(soundEnabled);
  };

  const handleSaveDraft = () => {
    if (!draftBook || !editingBookId) return;
    if (!draftBook.title.trim()) {
      alert('Please enter a book title');
      return;
    }

    const updatedBooks = exam.books.map((b) => (b.id === editingBookId ? draftBook : b));
    onUpdateExam({ books: updatedBooks, updatedAt: Date.now() });
    setEditingBookId(null);
    setDraftBook(null);
    Sound.success(soundEnabled);
  };

  const handleDeleteBook = (bookId: string) => {
    if (!window.confirm('Remove this book from your study list?')) return;
    const remaining = exam.books.filter((b) => b.id !== bookId);
    onUpdateExam({ books: remaining, updatedAt: Date.now() });
    if (editingBookId === bookId) {
      setEditingBookId(null);
      setDraftBook(null);
    }
    Sound.click(soundEnabled);
  };

  const handleAddBookRow = () => {
    const defaultSubjectId = exam.subjects[0]?.id || '';
    const newBook: ExamBook = {
      id: `book-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      subjectId: defaultSubjectId,
      title: '',
      author: '',
      status: 'to_read',
      priority: 'high',
      currentPage: 0,
      totalPages: 100,
    };

    const nextBooks = [newBook, ...exam.books];
    onUpdateExam({ books: nextBooks, updatedAt: Date.now() });
    setEditingBookId(newBook.id);
    setDraftBook({ ...newBook });
    Sound.click(soundEnabled);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['#', 'Subject', 'Title', 'Author', 'Status', 'Current Page', 'Total Pages', 'Priority', 'Notes', 'Link'];
    const rows = filteredBooks.map((b, idx) => {
      const subjectObj = exam.subjects.find((s) => s.id === b.subjectId);
      const subjectName = subjectObj ? `[${subjectObj.code || ''}] ${subjectObj.name}` : (b.subject || '');
      return [
        idx + 1,
        `"${subjectName.replace(/"/g, '""')}"`,
        `"${b.title.replace(/"/g, '""')}"`,
        `"${(b.author || '').replace(/"/g, '""')}"`,
        `"${b.status || 'to_read'}"`,
        b.currentPage || 0,
        b.totalPages || 0,
        `"${b.priority || 'medium'}"`,
        `"${(b.notes || '').replace(/"/g, '""')}"`,
        `"${(b.link || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(exam.shortName || exam.name).replace(/\s+/g, '_')}_books.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    Sound.success(soundEnabled);
  };

  // Status badge helper
  const getStatusBadge = (status?: ExamBookStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Completed
          </span>
        );
      case 'reading':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            Reading
          </span>
        );
      case 'revision':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            Revision
          </span>
        );
      case 'to_read':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
            To Read
          </span>
        );
    }
  };

  // Priority badge helper
  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high':
      case 'essential':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            High
          </span>
        );
      case 'medium':
      case 'recommended':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            Low
          </span>
        );
    }
  };

  const completedCount = exam.books.filter((b) => b.status === 'completed').length;
  const readingCount = exam.books.filter((b) => b.status === 'reading').length;

  return (
    <div className="space-y-3 font-sans">
      {/* ========================================================================= */}
      {/* 1. EXCEL-STYLE TOP TOOLBAR WITH COLUMN RESIZE & CONTROLS */}
      {/* ========================================================================= */}
      <div className="p-2.5 sm:p-3 bg-white dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search title, author, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Subjects ({exam.subjects.length})</option>
            {exam.subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code ? `[${sub.code}] ` : ''}
                {sub.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="to_read">To Read</option>
            <option value="reading">Reading</option>
            <option value="completed">Completed</option>
            <option value="revision">Revision</option>
          </select>
        </div>

        {/* Right: Column Resizer Controls & Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Column Resize Group */}
          <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
            <span className="text-[11px] font-semibold text-gray-500 mr-1 hidden sm:inline">Cols:</span>
            <button
              type="button"
              onClick={() => handleScaleAllColumns(-15)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Decrease column widths"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleScaleAllColumns(15)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Increase column widths"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetColumnWidths}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Reset column widths to default"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 transition-colors cursor-pointer"
            title="Export Books to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Add Book Row button */}
          <button
            type="button"
            onClick={handleAddBookRow}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Book Row</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="flex items-center justify-between text-xs px-1 text-gray-500 dark:text-gray-400 font-medium">
        <div className="flex items-center gap-3">
          <span>
            Total Books: <strong className="text-gray-800 dark:text-gray-200 font-mono">{exam.books.length}</strong>
          </span>
          <span>•</span>
          <span>
            Completed: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{completedCount}</strong>
          </span>
          <span>•</span>
          <span>
            Currently Reading: <strong className="text-blue-600 dark:text-blue-400 font-mono">{readingCount}</strong>
          </span>
        </div>
        <div className="text-[11px] text-gray-400">
          Tip: Click the edit icon (<Edit2 className="w-3 h-3 inline" />) in any row to edit and save.
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABULAR SPREADSHEET TABLE */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827] shadow-2xs">
        <table className="w-full text-left text-xs border-collapse font-sans">
          {/* Header */}
          <thead>
            <tr className="bg-gray-100/80 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-gray-700 select-none">
              {/* # Index Column */}
              <th
                style={{ width: `${colWidths.num || 48}px`, minWidth: '40px' }}
                className="relative px-2.5 py-2 text-center text-gray-500 font-mono border-r border-gray-200 dark:border-gray-700"
              >
                #
                <div
                  onMouseDown={(e) => handleStartResize(e, 'num')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Subject Column */}
              <th
                style={{ width: `${colWidths.subject || 120}px`, minWidth: '80px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Subject
                <div
                  onMouseDown={(e) => handleStartResize(e, 'subject')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Title Column */}
              <th
                style={{ width: `${colWidths.title || 220}px`, minWidth: '140px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Book Title *
                <div
                  onMouseDown={(e) => handleStartResize(e, 'title')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Author Column */}
              <th
                style={{ width: `${colWidths.author || 160}px`, minWidth: '100px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Author / Publication
                <div
                  onMouseDown={(e) => handleStartResize(e, 'author')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Status Column */}
              <th
                style={{ width: `${colWidths.status || 125}px`, minWidth: '95px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Status
                <div
                  onMouseDown={(e) => handleStartResize(e, 'status')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Pages Column */}
              <th
                style={{ width: `${colWidths.pages || 130}px`, minWidth: '100px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Pages / Progress
                <div
                  onMouseDown={(e) => handleStartResize(e, 'pages')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Priority Column */}
              <th
                style={{ width: `${colWidths.priority || 100}px`, minWidth: '80px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Priority
                <div
                  onMouseDown={(e) => handleStartResize(e, 'priority')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Notes / Link Column */}
              <th
                style={{ width: `${colWidths.notes || 180}px`, minWidth: '120px' }}
                className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 font-bold"
              >
                Notes & Link
                <div
                  onMouseDown={(e) => handleStartResize(e, 'notes')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 transition-colors"
                />
              </th>

              {/* Actions Column */}
              <th
                style={{ width: `${colWidths.actions || 90}px`, minWidth: '70px' }}
                className="px-2.5 py-2 text-center font-bold"
              >
                Action
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredBooks.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="font-semibold text-sm">No books found matching this filter</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Click "+ Add Book Row" to add textbooks, question banks, or notes for this exam.
                  </p>
                </td>
              </tr>
            ) : (
              filteredBooks.map((book, index) => {
                const isEditing = editingBookId === book.id;
                const subjectObj = exam.subjects.find((s) => s.id === book.subjectId);
                const hasPages = book.currentPage !== undefined && book.totalPages !== undefined;
                const pagePct =
                  hasPages && book.totalPages! > 0
                    ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages!) * 100))
                    : 0;

                // =========================================================
                // ROW IN EDIT MODE
                // =========================================================
                if (isEditing && draftBook) {
                  return (
                    <tr
                      key={book.id}
                      className="bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-900/60"
                    >
                      {/* Index */}
                      <td className="px-2.5 py-2 text-center font-mono text-gray-400 border-r border-gray-200 dark:border-gray-700">
                        {index + 1}
                      </td>

                      {/* Subject Select */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <select
                          value={draftBook.subjectId || ''}
                          onChange={(e) => setDraftBook({ ...draftBook, subjectId: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        >
                          {exam.subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.code || sub.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Book Title Input */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <input
                          type="text"
                          required
                          placeholder="Enter book title..."
                          value={draftBook.title}
                          onChange={(e) => setDraftBook({ ...draftBook, title: e.target.value })}
                          autoFocus
                          className="w-full px-2 py-1 text-xs font-semibold rounded bg-white dark:bg-gray-800 border border-indigo-400 dark:border-indigo-500 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Author Input - CRITICAL: Allows immediate entry freely! */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <input
                          type="text"
                          placeholder="Author / publication..."
                          value={draftBook.author || ''}
                          onChange={(e) => setDraftBook({ ...draftBook, author: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Status Select */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <select
                          value={draftBook.status || 'to_read'}
                          onChange={(e) =>
                            setDraftBook({ ...draftBook, status: e.target.value as ExamBookStatus })
                          }
                          className="w-full px-1.5 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="to_read">To Read</option>
                          <option value="reading">Reading</option>
                          <option value="completed">Completed</option>
                          <option value="revision">Revision</option>
                        </select>
                      </td>

                      {/* Pages / Progress Inputs */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-1 text-[11px]">
                          <input
                            type="number"
                            min="0"
                            placeholder="Curr"
                            value={draftBook.currentPage !== undefined ? draftBook.currentPage : ''}
                            onChange={(e) =>
                              setDraftBook({
                                ...draftBook,
                                currentPage: e.target.value ? parseInt(e.target.value, 10) : 0,
                              })
                            }
                            className="w-14 px-1.5 py-1 text-xs font-mono rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          />
                          <span>/</span>
                          <input
                            type="number"
                            min="1"
                            placeholder="Total"
                            value={draftBook.totalPages !== undefined ? draftBook.totalPages : ''}
                            onChange={(e) =>
                              setDraftBook({
                                ...draftBook,
                                totalPages: e.target.value ? parseInt(e.target.value, 10) : 100,
                              })
                            }
                            className="w-14 px-1.5 py-1 text-xs font-mono rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          />
                        </div>
                      </td>

                      {/* Priority Select */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <select
                          value={draftBook.priority || 'medium'}
                          onChange={(e) => setDraftBook({ ...draftBook, priority: e.target.value as any })}
                          className="w-full px-1.5 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </td>

                      {/* Notes / Link Inputs */}
                      <td className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700">
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={draftBook.notes || ''}
                            onChange={(e) => setDraftBook({ ...draftBook, notes: e.target.value })}
                            className="w-full px-1.5 py-0.5 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          />
                          <input
                            type="url"
                            placeholder="Link (https://...)"
                            value={draftBook.link || ''}
                            onChange={(e) => setDraftBook({ ...draftBook, link: e.target.value })}
                            className="w-full px-1.5 py-0.5 text-[11px] rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400"
                          />
                        </div>
                      </td>

                      {/* Action buttons: Save (tick) & Cancel (X) */}
                      <td className="px-2.5 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                            title="Save row"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                            title="Cancel editing"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // =========================================================
                // ROW IN READ-ONLY MODE (Excel Style)
                // =========================================================
                return (
                  <tr
                    key={book.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    {/* Index */}
                    <td className="px-2.5 py-2 text-center font-mono text-gray-400 border-r border-gray-200 dark:border-gray-700 text-xs">
                      {index + 1}
                    </td>

                    {/* Subject */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs">
                      <span className="font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                        {subjectObj?.code || subjectObj?.name || book.subject || 'GS'}
                      </span>
                    </td>

                    {/* Book Title */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-900 dark:text-gray-100">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate">{book.title}</span>
                        {book.link && (
                          <a
                            href={book.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
                            title="Open reference link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Author / Publication */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
                      {book.author ? (
                        <span className="truncate">{book.author}</span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs">
                      {getStatusBadge(book.status)}
                    </td>

                    {/* Pages & Progress Bar */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs font-mono">
                      {hasPages && book.totalPages! > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                            <span>
                              {book.currentPage}/{book.totalPages}
                            </span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                              {pagePct}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-200"
                              style={{ width: `${pagePct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs">
                      {getPriorityBadge(book.priority)}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                      {book.notes ? (
                        <span className="truncate block" title={book.notes}>
                          {book.notes}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* Actions: Edit (pencil) & Delete (trash) */}
                    <td className="px-2.5 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(book)}
                          className="p-1 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          title="Edit this book row"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(book.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          title="Delete this book row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
