import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  ChevronDown,
  X,
  FileSpreadsheet,
  Layers,
  Edit2,
  PlusCircle,
  HelpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ExamItem, SyllabusTableColumn, SyllabusTableRow } from '../../types';
import {
  DEFAULT_SYLLABUS_COLUMNS,
  exportSyllabusToCSV,
  getOrInitializeSyllabusRows,
} from '../../utils/syllabusTableHelper';

interface EditableSyllabusTableProps {
  exam: ExamItem;
  onUpdateExam: (updatedExam: ExamItem) => void;
  soundEnabled?: boolean;
}

export const EditableSyllabusTable: React.FC<EditableSyllabusTableProps> = ({
  exam,
  onUpdateExam,
}) => {
  // Rows and Columns State
  const rows = useMemo(() => getOrInitializeSyllabusRows(exam), [exam]);
  const [columns, setColumns] = useState<SyllabusTableColumn[]>(() => {
    return exam.syllabusTableColumns && exam.syllabusTableColumns.length > 0
      ? exam.syllabusTableColumns
      : DEFAULT_SYLLABUS_COLUMNS;
  });

  useEffect(() => {
    if (exam.syllabusTableColumns && exam.syllabusTableColumns.length > 0) {
      setColumns(exam.syllabusTableColumns);
    }
  }, [exam.syllabusTableColumns]);

  // Filters & Search
  const [selectedPhase, setSelectedPhase] = useState<'All' | 'Prelims' | 'Mains' | 'Interview'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Not Started' | 'In Progress' | 'Completed' | 'Revision Needed'>('All');

  // Modals for Column Management
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<SyllabusTableColumn | null>(null);
  const [editColumnName, setEditColumnName] = useState('');

  // Bulk add modal
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkPhase, setBulkPhase] = useState<'Prelims' | 'Mains' | 'Interview'>('Prelims');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkTopicsText, setBulkTopicsText] = useState('');

  // Row Inline Edit State (Editable only when Edit button is clicked, saved on Save / tick)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftRow, setDraftRow] = useState<SyllabusTableRow | null>(null);

  // Column Resizing via Drag
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Update rows helper
  const commitRows = (updatedRows: SyllabusTableRow[]) => {
    onUpdateExam({
      ...exam,
      syllabusTableRows: updatedRows,
      updatedAt: Date.now(),
    });
  };

  // Update columns helper
  const commitColumns = (updatedColumns: SyllabusTableColumn[]) => {
    setColumns(updatedColumns);
    onUpdateExam({
      ...exam,
      syllabusTableColumns: updatedColumns,
      updatedAt: Date.now(),
    });
  };

  // Row Edit Handlers
  const startEditRow = (row: SyllabusTableRow) => {
    setEditingRowId(row.id);
    setDraftRow({
      ...row,
      customData: { ...(row.customData || {}) },
    });
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setDraftRow(null);
  };

  const saveDraftRow = () => {
    if (!draftRow) return;
    const nextRows = rows.map((r) => (r.id === draftRow.id ? draftRow : r));
    commitRows(nextRows);
    setEditingRowId(null);
    setDraftRow(null);
  };

  const handleDraftCellChange = (fieldKey: string, value: any, isCustom = false) => {
    if (!draftRow) return;
    if (isCustom) {
      setDraftRow({
        ...draftRow,
        customData: {
          ...(draftRow.customData || {}),
          [fieldKey]: value,
        },
      });
    } else {
      setDraftRow({
        ...draftRow,
        [fieldKey]: value,
      });
    }
  };

  // Increase/Decrease Column Width by delta
  const handleColumnWidthChange = (colId: string, delta: number) => {
    const nextCols = columns.map((c) => {
      if (c.id !== colId) return c;
      const currentWidth =
        c.width ||
        (c.key === 'topic'
          ? 320
          : c.key === 'subject'
          ? 170
          : c.key === 'phase'
          ? 75
          : c.key === 'status'
          ? 130
          : c.key === 'timesCompleted'
          ? 120
          : 180);
      const newWidth = Math.max(55, Math.min(600, currentWidth + delta));
      return { ...c, width: newWidth };
    });
    commitColumns(nextCols);
  };

  // Drag-to-resize column
  const handleResizeStart = (e: React.MouseEvent, col: SyllabusTableColumn) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current =
      col.width ||
      (col.key === 'topic'
        ? 320
        : col.key === 'subject'
        ? 170
        : col.key === 'phase'
        ? 75
        : col.key === 'status'
        ? 130
        : col.key === 'timesCompleted'
        ? 120
        : 180);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - resizeStartX.current;
      const nextWidth = Math.max(55, Math.min(650, resizeStartWidth.current + diff));
      setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, width: nextWidth } : c)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setColumns((latestCols) => {
        commitColumns(latestCols);
        return latestCols;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleAddRow = (preferredPhase?: string) => {
    const phase =
      preferredPhase || (selectedPhase !== 'All' ? selectedPhase : 'Prelims');
    const newRow: SyllabusTableRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      phase,
      subject: phase === 'Prelims' ? 'Paper I: General Studies' : phase === 'Mains' ? 'General Studies' : 'Personality Test',
      topic: 'New Syllabus Topic',
      status: 'Not Started',
      timesCompleted: 0,
      remarks: '',
      customData: {},
    };
    commitRows([...rows, newRow]);
    // Automatically open edit mode for the newly created row
    startEditRow(newRow);
  };

  const handleDeleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      alert('You must keep at least one row in the syllabus spreadsheet.');
      return;
    }
    if (editingRowId === rowId) {
      cancelEditRow();
    }
    commitRows(rows.filter((r) => r.id !== rowId));
  };

  // Column Manipulation
  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    const newKey = `col_custom_${Date.now()}`;
    const newCol: SyllabusTableColumn = {
      id: newKey,
      label: newColumnName.trim(),
      key: newKey,
      type: 'text',
      isCustom: true,
    };
    commitColumns([...columns, newCol]);
    setNewColumnName('');
    setShowAddColumnModal(false);
  };

  const handleSaveEditColumn = () => {
    if (!editingColumn || !editColumnName.trim()) return;
    const nextCols = columns.map((col) =>
      col.id === editingColumn.id ? { ...col, label: editColumnName.trim() } : col
    );
    commitColumns(nextCols);
    setEditingColumn(null);
  };

  const handleDeleteColumn = (columnId: string) => {
    if (window.confirm('Are you sure you want to remove this column? Custom entries in this column will be hidden.')) {
      commitColumns(columns.filter((c) => c.id !== columnId));
    }
  };

  // Bulk Add Topics
  const handleBulkAddSubmit = () => {
    const lines = bulkTopicsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const subject = bulkSubject.trim() || `${bulkPhase} Subject`;
    const newRows: SyllabusTableRow[] = lines.map((topic, idx) => ({
      id: `row-bulk-${Date.now()}-${idx}`,
      phase: bulkPhase,
      subject,
      topic,
      status: 'Not Started',
      timesCompleted: 0,
      remarks: '',
      customData: {},
    }));

    commitRows([...rows, ...newRows]);
    setBulkTopicsText('');
    setBulkSubject('');
    setShowBulkAddModal(false);
  };

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedPhase !== 'All' && r.phase !== selectedPhase) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTopic = (r.topic || '').toLowerCase().includes(q);
        const matchesSubject = (r.subject || '').toLowerCase().includes(q);
        const matchesRemarks = (r.remarks || '').toLowerCase().includes(q);
        return matchesTopic || matchesSubject || matchesRemarks;
      }
      return true;
    });
  }, [rows, selectedPhase, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'Completed').length;
    const inProgress = rows.filter((r) => r.status === 'In Progress').length;
    const totalRevisions = rows.reduce((acc, r) => acc + (r.timesCompleted || 0), 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const prelimsCount = rows.filter((r) => r.phase === 'Prelims').length;
    const mainsCount = rows.filter((r) => r.phase === 'Mains').length;
    const interviewCount = rows.filter((r) => r.phase === 'Interview').length;

    return {
      total,
      completed,
      inProgress,
      totalRevisions,
      percent,
      prelimsCount,
      mainsCount,
      interviewCount,
    };
  }, [rows]);

  const renderPhaseDisplay = (phase: string) => {
    switch (phase) {
      case 'Prelims':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-extrabold text-xs border border-amber-300 dark:border-amber-800/60 shadow-2xs"
            title="1: Prelims"
          >
            1
          </span>
        );
      case 'Mains':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-extrabold text-xs border border-blue-300 dark:border-blue-800/60 shadow-2xs"
            title="2: Mains"
          >
            2
          </span>
        );
      case 'Interview':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-extrabold text-xs border border-purple-300 dark:border-purple-800/60 shadow-2xs"
            title="3: Interview"
          >
            3
          </span>
        );
      default:
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs"
            title={phase}
          >
            {phase ? phase.charAt(0) : '1'}
          </span>
        );
    }
  };

  return (
    <div id="editable-syllabus-spreadsheet" className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. TOP STATS & PHASE SEGMENTATION (Clear distinction between Prelims, Mains, Interview) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Interactive Syllabus Spreadsheet</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[11px] font-semibold">
                Excel Style
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Edit topics, record revisions completed, add custom columns, and track distinct exam phases without clutter.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportSyllabusToCSV(rows, columns, exam.shortName || exam.name)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download full syllabus spreadsheet as CSV"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAddModal(true)}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Bulk Add</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddColumnModal(true)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-gray-500" />
              <span>Add Column</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddRow()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>
        </div>

        {/* Phase Tabs & Progress Summary */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Phase Distinction Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedPhase('All')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedPhase === 'All'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All Phases ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setSelectedPhase('Prelims')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedPhase === 'Prelims'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-900/50'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold inline-flex items-center justify-center text-[10px]">1</span>
              <span>Prelims</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/30 font-bold">
                {stats.prelimsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPhase('Mains')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedPhase === 'Mains'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-900/50'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-bold inline-flex items-center justify-center text-[10px]">2</span>
              <span>Mains</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/30 font-bold">
                {stats.mainsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPhase('Interview')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedPhase === 'Interview'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-900/50'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100 font-bold inline-flex items-center justify-center text-[10px]">3</span>
              <span>Interview</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/30 font-bold">
                {stats.interviewCount}
              </span>
            </button>
          </div>

          {/* Compact Progress Indicator */}
          <div className="flex items-center gap-3 shrink-0 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{stats.completed}/{stats.total} Completed ({stats.percent}%)</span>
            </div>
            <div className="w-20 sm:w-28 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-indigo-500" />
              <span>{stats.totalRevisions} Revisions</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH & FILTER TOOLBAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topic, paper/subject, or remarks..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="All">All Statuses ({rows.length})</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Revision Needed">Revision Needed</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. EXCEL-LIKE TABULAR SPREADSHEET */}
      {/* ========================================================================= */}
      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-2xs">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/90 sticky top-0 z-10 text-gray-700 dark:text-gray-200 font-semibold border-b-2 border-gray-300 dark:border-gray-700 shadow-2xs select-none">
              <tr>
                <th className="py-2 px-2.5 w-10 text-center text-gray-400 dark:text-gray-500 border-r border-gray-300 dark:border-gray-700 font-mono text-[11px]">
                  #
                </th>
                {columns.map((col) => {
                  const colWidth =
                    col.width ||
                    (col.key === 'topic'
                      ? 320
                      : col.key === 'subject'
                      ? 170
                      : col.key === 'phase'
                      ? 75
                      : col.key === 'status'
                      ? 130
                      : col.key === 'timesCompleted'
                      ? 120
                      : 180);

                  return (
                    <th
                      key={col.id}
                      style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                      className="relative py-2 px-2.5 border-r border-gray-300 dark:border-gray-700 whitespace-nowrap group/th bg-[#F8FAFC] dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">
                          {col.label}
                        </span>
                        {/* Top column resize buttons */}
                        <div className="flex items-center gap-0.5 opacity-80 group-hover/th:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleColumnWidthChange(col.id, -25)}
                            className="w-4 h-4 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                            title="Decrease column size"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleColumnWidthChange(col.id, 25)}
                            className="w-4 h-4 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                            title="Increase column size"
                          >
                            +
                          </button>
                          {col.isCustom && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingColumn(col);
                                  setEditColumnName(col.label);
                                }}
                                className="p-0.5 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                title="Rename column"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-0.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Delete custom column"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Drag-to-resize handle */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, col)}
                        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500 active:bg-indigo-600 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>
                  );
                })}
                <th className="py-2 px-2.5 w-16 text-center text-gray-500 dark:text-gray-400 font-bold border-b border-gray-300 dark:border-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/80">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No syllabus rows match your filter. Click "+ Add Row" to insert a new topic.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isEditing = editingRowId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors group ${
                        isEditing
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-1.5 px-2 text-center text-[11px] text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700/80 font-mono">
                        {idx + 1}
                      </td>

                      {/* Columns */}
                      {columns.map((col) => {
                        const colWidth =
                          col.width ||
                          (col.key === 'topic'
                            ? 320
                            : col.key === 'subject'
                            ? 170
                            : col.key === 'phase'
                            ? 75
                            : col.key === 'status'
                            ? 130
                            : col.key === 'timesCompleted'
                            ? 120
                            : 180);

                        // 1. Phase column: Space-saving 1, 2, 3 with different colours
                        if (col.key === 'phase') {
                          return (
                            <td
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                              className="py-1.5 px-2 border-r border-gray-200 dark:border-gray-700/80 text-center"
                            >
                              {isEditing ? (
                                <select
                                  value={draftRow?.phase || 'Prelims'}
                                  onChange={(e) => handleDraftCellChange('phase', e.target.value)}
                                  className="w-full text-xs font-bold px-1 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  <option value="Prelims">1: Prelims</option>
                                  <option value="Mains">2: Mains</option>
                                  <option value="Interview">3: Interview</option>
                                </select>
                              ) : (
                                renderPhaseDisplay(row.phase)
                              )}
                            </td>
                          );
                        }

                        // 2. Paper / Subject column
                        if (col.key === 'subject') {
                          return (
                            <td
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                              className="py-1.5 px-2.5 border-r border-gray-200 dark:border-gray-700/80"
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={draftRow?.subject || ''}
                                  onChange={(e) => handleDraftCellChange('subject', e.target.value)}
                                  placeholder="Paper / Subject name"
                                  className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              ) : (
                                <div
                                  className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate"
                                  title={row.subject}
                                >
                                  {row.subject || '-'}
                                </div>
                              )}
                            </td>
                          );
                        }

                        // 3. Topic / Syllabus Unit column
                        if (col.key === 'topic') {
                          return (
                            <td
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                              className="py-1.5 px-2.5 border-r border-gray-200 dark:border-gray-700/80"
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={draftRow?.topic || ''}
                                  onChange={(e) => handleDraftCellChange('topic', e.target.value)}
                                  placeholder="Topic / Syllabus Unit..."
                                  className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              ) : (
                                <div
                                  className="text-xs text-gray-900 dark:text-gray-100 font-normal break-words"
                                  title={row.topic}
                                >
                                  {row.topic || '-'}
                                </div>
                              )}
                            </td>
                          );
                        }

                        // 4. Status column
                        if (col.key === 'status') {
                          const statusBg =
                            row.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700'
                              : row.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700'
                              : row.status === 'Revision Needed'
                              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700'
                              : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';

                          return (
                            <td
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                              className="py-1.5 px-2 border-r border-gray-200 dark:border-gray-700/80"
                            >
                              {isEditing ? (
                                <select
                                  value={draftRow?.status || 'Not Started'}
                                  onChange={(e) => {
                                    const nextStatus = e.target.value as any;
                                    handleDraftCellChange('status', nextStatus);
                                    if (nextStatus === 'Completed' && (!draftRow?.timesCompleted || draftRow.timesCompleted === 0)) {
                                      handleDraftCellChange('timesCompleted', 1);
                                    }
                                  }}
                                  className="w-full text-xs font-semibold px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                                >
                                  <option value="Not Started">Not Started</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Revision Needed">Revision Needed</option>
                                </select>
                              ) : (
                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBg}`}>
                                  {row.status}
                                </span>
                              )}
                            </td>
                          );
                        }

                        // 5. Times Completed / Revisions column
                        if (col.key === 'timesCompleted') {
                          return (
                            <td
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                              className="py-1.5 px-2 border-r border-gray-200 dark:border-gray-700/80 text-center"
                            >
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftRow((prev) =>
                                        prev
                                          ? { ...prev, timesCompleted: Math.max(0, (prev.timesCompleted || 0) - 1) }
                                          : prev
                                      )
                                    }
                                    className="w-4 h-4 rounded text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                                    title="Decrease revisions"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={draftRow?.timesCompleted ?? 0}
                                    onChange={(e) =>
                                      handleDraftCellChange('timesCompleted', Math.max(0, parseInt(e.target.value) || 0))
                                    }
                                    className="w-8 text-center bg-transparent font-mono font-bold text-gray-900 dark:text-white outline-none text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftRow((prev) =>
                                        prev
                                          ? { ...prev, timesCompleted: (prev.timesCompleted || 0) + 1 }
                                          : prev
                                      )
                                    }
                                    className="w-4 h-4 rounded text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                                    title="Increase revisions"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                  {row.timesCompleted || 0}
                                </span>
                              )}
                            </td>
                          );
                        }

                        // 6. Remarks column
                        if (col.key === 'remarks') {
                          return (
                            <td
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                              className="py-1.5 px-2.5 border-r border-gray-200 dark:border-gray-700/80"
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={draftRow?.remarks || ''}
                                  onChange={(e) => handleDraftCellChange('remarks', e.target.value)}
                                  placeholder="Notes, reference links, focus areas..."
                                  className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              ) : (
                                <div
                                  className="text-xs text-gray-600 dark:text-gray-300 truncate"
                                  title={row.remarks}
                                >
                                  {row.remarks || '-'}
                                </div>
                              )}
                            </td>
                          );
                        }

                        // Custom Columns
                        const customVal = isEditing
                          ? draftRow?.customData?.[col.key] || ''
                          : row.customData?.[col.key] || '';

                        return (
                          <td
                            key={col.id}
                            style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                            className="py-1.5 px-2.5 border-r border-gray-200 dark:border-gray-700/80"
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={customVal}
                                onChange={(e) => handleDraftCellChange(col.key, e.target.value, true)}
                                placeholder={`Enter ${col.label}...`}
                                className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            ) : (
                              <div
                                className="text-xs text-gray-600 dark:text-gray-300 truncate"
                                title={customVal}
                              >
                                {customVal || '-'}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Actions: Edit and Delete buttons, Save (tick) when editing */}
                      <td className="py-1.5 px-2 text-center border-b border-gray-200 dark:border-gray-700/80">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            {/* Save (tick) button */}
                            <button
                              type="button"
                              onClick={saveDraftRow}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                              title="Save changes (tick)"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            {/* Cancel button */}
                            <button
                              type="button"
                              onClick={cancelEditRow}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors cursor-pointer"
                              title="Cancel editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {/* Edit button next to delete */}
                            <button
                              type="button"
                              onClick={() => startEditRow(row)}
                              className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                              title="Edit row"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Add Row Footer */}
        <div className="bg-[#F8FAFC] dark:bg-gray-800/80 px-4 py-2.5 border-t border-gray-300 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <button
            type="button"
            onClick={() => handleAddRow()}
            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add new topic row (starts edit mode)</span>
          </button>
          <span>Showing {filteredRows.length} of {rows.length} rows</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS (Add Column, Rename Column, Bulk Add Topics) */}
      {/* ========================================================================= */}
      {showAddColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Add Custom Column</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Column Name / Header
              </label>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g. Reference Book, Target Revision Date, Weightage"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {editingColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <span>Rename Column</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingColumn(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Column Label
              </label>
              <input
                type="text"
                value={editColumnName}
                onChange={(e) => setEditColumnName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingColumn(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditColumn}
                disabled={!editColumnName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span>Bulk Add Syllabus Topics</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkAddModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Exam Phase
                  </label>
                  <select
                    value={bulkPhase}
                    onChange={(e) => setBulkPhase(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white"
                  >
                    <option value="Prelims">Phase 1: Prelims</option>
                    <option value="Mains">Phase 2: Mains</option>
                    <option value="Interview">Phase 3: Interview</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Subject / Paper
                  </label>
                  <input
                    type="text"
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    placeholder="e.g. General Studies I"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Topics (one per line)
                </label>
                <textarea
                  rows={6}
                  value={bulkTopicsText}
                  onChange={(e) => setBulkTopicsText(e.target.value)}
                  placeholder={`Indian Polity & Constitution\nPanchayati Raj & Local Self Governance\nJudicial Review & PIL\nFundamental Rights & Duties`}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkAddModal(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAddSubmit}
                disabled={!bulkTopicsText.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                Insert Rows
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
