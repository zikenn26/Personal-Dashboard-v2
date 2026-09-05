import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
  FileSpreadsheet,
  Layers,
  Edit2,
  PlusCircle,
  HelpCircle,
  Check,
  Copy,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Undo2,
  MoveRight,
  Filter,
} from 'lucide-react';
import { ExamItem, SyllabusTableColumn, SyllabusTableRow } from '../../types';
import {
  DEFAULT_SYLLABUS_COLUMNS,
  exportSyllabusToCSV,
  getOrInitializeSyllabusRows,
  normalizePhase,
  parseCSVToSyllabusRows,
} from '../../utils/syllabusTableHelper';

interface EditableSyllabusTableProps {
  exam: ExamItem;
  onUpdateExam: (updatedExam: ExamItem) => void;
  soundEnabled?: boolean;
}

type PhaseKey = 'Prelims' | 'Mains' | 'Interview';

interface PhaseConfig {
  id: PhaseKey;
  name: string;
  phaseNumber: number;
  tag: string;
  badgeClass: string;
  headerBg: string;
  borderColor: string;
  progressFill: string;
  defaultSubject: string;
  description: string;
}

const PHASES: PhaseConfig[] = [
  {
    id: 'Prelims',
    name: 'PRELIMS',
    phaseNumber: 1,
    tag: 'Phase 1',
    badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    headerBg: 'bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/40',
    borderColor: 'border-amber-300/80 dark:border-amber-700/60',
    progressFill: 'bg-amber-500',
    defaultSubject: 'Prelims Paper I: General Studies',
    description: 'Screening & Objective Evaluation (General Studies & CSAT)',
  },
  {
    id: 'Mains',
    name: 'MAINS',
    phaseNumber: 2,
    tag: 'Phase 2',
    badgeClass: 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-800',
    headerBg: 'bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/40',
    borderColor: 'border-blue-300/80 dark:border-blue-700/60',
    progressFill: 'bg-blue-600',
    defaultSubject: 'Mains: General Studies I',
    description: 'Written Descriptive Examination (Compulsory Language, Essay, GS & Optionals)',
  },
  {
    id: 'Interview',
    name: 'INTERVIEW',
    phaseNumber: 3,
    tag: 'Phase 3',
    badgeClass: 'bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border-purple-300 dark:border-purple-800',
    headerBg: 'bg-purple-50/70 dark:bg-purple-950/30 hover:bg-purple-50 dark:hover:bg-purple-950/40',
    borderColor: 'border-purple-300/80 dark:border-purple-700/60',
    progressFill: 'bg-purple-600',
    defaultSubject: 'Personality Test & DAF',
    description: 'Personality Test, Board Assessment & Leadership Verification',
  },
];

const DEFAULT_WIDTHS: Record<string, number> = {
  subject: 210,
  topic: 400,
  status: 140,
  timesCompleted: 110,
  remarks: 210,
};

export const EditableSyllabusTable: React.FC<EditableSyllabusTableProps> = ({
  exam,
  onUpdateExam,
  soundEnabled,
}) => {
  // 1. Rows state (automatically normalized through normalizePhase)
  const rows = useMemo(() => getOrInitializeSyllabusRows(exam), [exam]);

  // 2. Columns state (excluding legacy 'phase' column from table rows)
  const [columns, setColumns] = useState<SyllabusTableColumn[]>(() => {
    const raw =
      exam.syllabusTableColumns && exam.syllabusTableColumns.length > 0
        ? exam.syllabusTableColumns
        : DEFAULT_SYLLABUS_COLUMNS;
    return raw.filter((c) => c.key !== 'phase');
  });

  useEffect(() => {
    if (exam.syllabusTableColumns && exam.syllabusTableColumns.length > 0) {
      setColumns(exam.syllabusTableColumns.filter((c) => c.key !== 'phase'));
    }
  }, [exam.syllabusTableColumns]);

  // Load saved custom widths from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`syllabus_col_widths_${exam.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, number>;
        setColumns((prev) =>
          prev.map((col) => (parsed[col.key] ? { ...col, width: parsed[col.key] } : col))
        );
      }
    } catch {
      // ignore
    }
  }, [exam.id]);

  // 3. Collapsed phases state: defaults to all expanded
  const [collapsedPhases, setCollapsedPhases] = useState<Record<PhaseKey, boolean>>({
    Prelims: false,
    Mains: false,
    Interview: false,
  });

  // 4. Filters & Search
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<'All' | PhaseKey>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Not Started' | 'In Progress' | 'Completed' | 'Revision Needed'>('All');

  // 5. Inline Row Editing State (only editable when Edit pencil is clicked)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftRow, setDraftRow] = useState<SyllabusTableRow | null>(null);

  // 6. Undo deletion state
  const [undoToast, setUndoToast] = useState<{ row: SyllabusTableRow; index: number } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 7. Column Resizing State (Excel-like continuous drag)
  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // 8. Modals
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumn, setEditingColumn] = useState<SyllabusTableColumn | null>(null);
  const [editColumnName, setEditColumnName] = useState('');

  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkPhase, setBulkPhase] = useState<PhaseKey>('Prelims');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkTopicsText, setBulkTopicsText] = useState('');

  const [showAddSyllabusModal, setShowAddSyllabusModal] = useState(false);
  const [addSyllabusPhase, setAddSyllabusPhase] = useState<PhaseKey>('Prelims');
  const [addSubjectInput, setAddSubjectInput] = useState('');
  const [addTopicInput, setAddTopicInput] = useState('');
  const [addStatusInput, setAddStatusInput] = useState<SyllabusTableRow['status']>('Not Started');
  const [addRemarksInput, setAddRemarksInput] = useState('');

  const [showImportCSVModal, setShowImportCSVModal] = useState(false);
  const [importCSVPhase, setImportCSVPhase] = useState<PhaseKey>('Prelims');
  const [importCSVText, setImportCSVText] = useState('');

  // 9. Active phase header dropdown
  const [activeMenuPhase, setActiveMenuPhase] = useState<PhaseKey | null>(null);

  // Persistence helpers
  const commitRows = (updatedRows: SyllabusTableRow[]) => {
    onUpdateExam({
      ...exam,
      syllabusTableRows: updatedRows,
      updatedAt: Date.now(),
    });
  };

  const commitColumns = (updatedColumns: SyllabusTableColumn[]) => {
    setColumns(updatedColumns);
    onUpdateExam({
      ...exam,
      syllabusTableColumns: updatedColumns,
      updatedAt: Date.now(),
    });
    try {
      const widthMap: Record<string, number> = {};
      updatedColumns.forEach((c) => {
        if (c.width) widthMap[c.key] = c.width;
      });
      localStorage.setItem(`syllabus_col_widths_${exam.id}`, JSON.stringify(widthMap));
    } catch {
      // ignore
    }
  };

  // Toggle single phase collapse
  const togglePhaseCollapse = (phase: PhaseKey) => {
    setCollapsedPhases((prev) => ({
      ...prev,
      [phase]: !prev[phase],
    }));
  };

  const handleExpandAll = () => {
    setCollapsedPhases({ Prelims: false, Mains: false, Interview: false });
  };

  const handleCollapseAll = () => {
    setCollapsedPhases({ Prelims: true, Mains: true, Interview: true });
  };

  // Inline edit handlers
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

  // Quick duplicate row inside same phase
  const handleDuplicateRow = (row: SyllabusTableRow) => {
    const originalIndex = rows.findIndex((r) => r.id === row.id);
    const newRow: SyllabusTableRow = {
      ...row,
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      topic: `${row.topic} (Copy)`,
      timesCompleted: 0,
      status: 'Not Started',
      customData: { ...(row.customData || {}) },
    };
    const nextRows = [...rows];
    nextRows.splice(originalIndex + 1, 0, newRow);
    commitRows(nextRows);
    startEditRow(newRow);
  };

  // Move row to another phase
  const handleMoveRowToPhase = (rowId: string, targetPhase: PhaseKey) => {
    const nextRows = rows.map((r) => (r.id === rowId ? { ...r, phase: targetPhase } : r));
    commitRows(nextRows);
  };

  // Move row Up/Down within the same phase
  const handleMoveRowUpDown = (rowId: string, direction: 'up' | 'down') => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const phaseRows = rows.filter((r) => r.phase === row.phase);
    const phaseIndex = phaseRows.findIndex((r) => r.id === rowId);

    const targetIndex = direction === 'up' ? phaseIndex - 1 : phaseIndex + 1;
    if (targetIndex < 0 || targetIndex >= phaseRows.length) return;

    const otherRow = phaseRows[targetIndex];
    const globalIdx1 = rows.findIndex((r) => r.id === row.id);
    const globalIdx2 = rows.findIndex((r) => r.id === otherRow.id);

    const nextRows = [...rows];
    nextRows[globalIdx1] = otherRow;
    nextRows[globalIdx2] = row;
    commitRows(nextRows);
  };

  // Delete row with Undo toast support
  const handleDeleteRow = (rowId: string) => {
    const originalIndex = rows.findIndex((r) => r.id === rowId);
    const rowToDelete = rows[originalIndex];
    if (!rowToDelete) return;

    if (rows.length <= 1) {
      alert('You must keep at least one syllabus topic.');
      return;
    }

    if (editingRowId === rowId) {
      cancelEditRow();
    }

    commitRows(rows.filter((r) => r.id !== rowId));

    // Show Undo Toast
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoToast({ row: rowToDelete, index: originalIndex });
    undoTimeoutRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 6000);
  };

  const handleRestoreDeletedRow = () => {
    if (!undoToast) return;
    const nextRows = [...rows];
    const insertAt = Math.min(undoToast.index, nextRows.length);
    nextRows.splice(insertAt, 0, undoToast.row);
    commitRows(nextRows);
    setUndoToast(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  };

  // Add Syllabus explicitly to a phase
  const handleOpenAddSyllabus = (phase: PhaseKey) => {
    setAddSyllabusPhase(phase);
    const phaseConf = PHASES.find((p) => p.id === phase);
    setAddSubjectInput(phaseConf?.defaultSubject || 'General Studies');
    setAddTopicInput('');
    setAddStatusInput('Not Started');
    setAddRemarksInput('');
    setShowAddSyllabusModal(true);
  };

  const handleSaveNewSyllabus = () => {
    if (!addTopicInput.trim()) {
      alert('Please enter a syllabus topic or unit title.');
      return;
    }
    const newRow: SyllabusTableRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      phase: addSyllabusPhase,
      subject: addSubjectInput.trim() || `${addSyllabusPhase} Subject`,
      topic: addTopicInput.trim(),
      status: addStatusInput,
      timesCompleted: 0,
      remarks: addRemarksInput.trim(),
      customData: {},
    };
    commitRows([...rows, newRow]);
    // Ensure that target phase is expanded so user sees it
    setCollapsedPhases((prev) => ({ ...prev, [addSyllabusPhase]: false }));
    setShowAddSyllabusModal(false);
  };

  // Quick inline add row directly inside phase
  const handleQuickAddRowInPhase = (phase: PhaseKey) => {
    const phaseConf = PHASES.find((p) => p.id === phase);
    const newRow: SyllabusTableRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      phase,
      subject: phaseConf?.defaultSubject || 'General Studies',
      topic: 'New Syllabus Topic',
      status: 'Not Started',
      timesCompleted: 0,
      remarks: '',
      customData: {},
    };
    commitRows([...rows, newRow]);
    setCollapsedPhases((prev) => ({ ...prev, [phase]: false }));
    startEditRow(newRow);
  };

  // Bulk Add Topics with target phase pre-selection
  const handleOpenBulkAdd = (phase?: PhaseKey) => {
    const target = phase || (selectedPhaseFilter !== 'All' ? selectedPhaseFilter : 'Prelims');
    setBulkPhase(target);
    const phaseConf = PHASES.find((p) => p.id === target);
    setBulkSubject(phaseConf?.defaultSubject || 'General Studies');
    setBulkTopicsText('');
    setShowBulkAddModal(true);
    setActiveMenuPhase(null);
  };

  const handleBulkAddSubmit = () => {
    const lines = bulkTopicsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const baseSubject = bulkSubject.trim() || `${bulkPhase} Subject`;

    const newRows: SyllabusTableRow[] = lines.map((line, idx) => {
      // Support "Subject | Topic" syntax or simple topic lines
      let subject = baseSubject;
      let topic = line;
      if (line.includes('|')) {
        const parts = line.split('|');
        subject = parts[0].trim() || baseSubject;
        topic = parts.slice(1).join('|').trim();
      }

      return {
        id: `row-bulk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        phase: bulkPhase,
        subject,
        topic,
        status: 'Not Started',
        timesCompleted: 0,
        remarks: '',
        customData: {},
      };
    });

    commitRows([...rows, ...newRows]);
    setCollapsedPhases((prev) => ({ ...prev, [bulkPhase]: false }));
    setBulkTopicsText('');
    setBulkSubject('');
    setShowBulkAddModal(false);
  };

  // CSV Import handler
  const handleImportCSVSubmit = () => {
    if (!importCSVText.trim()) return;
    const importedRows = parseCSVToSyllabusRows(importCSVText, importCSVPhase);
    if (importedRows.length === 0) {
      alert('Could not parse valid syllabus rows from CSV. Please check the format.');
      return;
    }
    commitRows([...rows, ...importedRows]);
    setImportCSVText('');
    setShowImportCSVModal(false);
    alert(`Successfully imported ${importedRows.length} syllabus topics!`);
  };

  // Column resizing: Excel / Google Sheets style drag handler
  const handleResizeStart = (e: React.MouseEvent, col: SyllabusTableColumn) => {
    e.preventDefault();
    e.stopPropagation();

    const startWidth = col.width || DEFAULT_WIDTHS[col.key] || 180;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = startWidth;
    setResizingColId(col.id);

    // Disable text selection and change cursor globally while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - resizeStartX.current;
      const minWidth = col.key === 'timesCompleted' ? 85 : col.key === 'status' ? 115 : 100;
      const nextWidth = Math.max(minWidth, Math.min(750, resizeStartWidth.current + diff));

      setColumns((prevCols) =>
        prevCols.map((c) => (c.id === col.id ? { ...c, width: nextWidth } : c))
      );
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setResizingColId(null);

      // Save columns to state & exam object
      setColumns((latestCols) => {
        commitColumns(latestCols);
        return latestCols;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Double click boundary to auto-fit / reset to standard width
  const handleDoubleClickResize = (col: SyllabusTableColumn) => {
    const defaultW = DEFAULT_WIDTHS[col.key] || 180;
    const nextCols = columns.map((c) => (c.id === col.id ? { ...c, width: defaultW } : c));
    commitColumns(nextCols);
  };

  // Add Custom Column
  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    const newKey = `col_custom_${Date.now()}`;
    const newCol: SyllabusTableColumn = {
      id: newKey,
      label: newColumnName.trim(),
      key: newKey,
      type: 'text',
      width: 170,
      isCustom: true,
    };
    commitColumns([...columns, newCol]);
    setNewColumnName('');
    setShowAddColumnModal(false);
  };

  // Delete Custom Column
  const handleDeleteColumn = (columnId: string) => {
    if (window.confirm('Are you sure you want to remove this column? Custom entries will be hidden.')) {
      commitColumns(columns.filter((c) => c.id !== columnId));
    }
  };

  // Rename Custom Column
  const handleSaveEditColumn = () => {
    if (!editingColumn || !editColumnName.trim()) return;
    const nextCols = columns.map((col) =>
      col.id === editingColumn.id ? { ...col, label: editColumnName.trim() } : col
    );
    commitColumns(nextCols);
    setEditingColumn(null);
  };

  // Filtered rows calculation
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const normalizedRowPhase = normalizePhase(r.phase);
      if (selectedPhaseFilter !== 'All' && normalizedRowPhase !== selectedPhaseFilter) {
        return false;
      }
      if (statusFilter !== 'All' && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTopic = (r.topic || '').toLowerCase().includes(q);
        const matchesSubject = (r.subject || '').toLowerCase().includes(q);
        const matchesRemarks = (r.remarks || '').toLowerCase().includes(q);
        return matchesTopic || matchesSubject || matchesRemarks;
      }
      return true;
    });
  }, [rows, selectedPhaseFilter, statusFilter, searchQuery]);

  // Overall Statistics & per-phase metrics
  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.status === 'Completed').length;
    const inProgress = rows.filter((r) => r.status === 'In Progress').length;
    const totalRevisions = rows.reduce((acc, r) => acc + (r.timesCompleted || 0), 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const phaseStats: Record<PhaseKey, { total: number; completed: number; inProgress: number; revisions: number; percent: number }> = {
      Prelims: { total: 0, completed: 0, inProgress: 0, revisions: 0, percent: 0 },
      Mains: { total: 0, completed: 0, inProgress: 0, revisions: 0, percent: 0 },
      Interview: { total: 0, completed: 0, inProgress: 0, revisions: 0, percent: 0 },
    };

    PHASES.forEach((p) => {
      const pRows = rows.filter((r) => normalizePhase(r.phase) === p.id);
      const pComp = pRows.filter((r) => r.status === 'Completed').length;
      const pProg = pRows.filter((r) => r.status === 'In Progress').length;
      const pRev = pRows.reduce((acc, r) => acc + (r.timesCompleted || 0), 0);
      const pPct = pRows.length > 0 ? Math.round((pComp / pRows.length) * 100) : 0;
      phaseStats[p.id] = {
        total: pRows.length,
        completed: pComp,
        inProgress: pProg,
        revisions: pRev,
        percent: pPct,
      };
    });

    return {
      total,
      completed,
      inProgress,
      totalRevisions,
      percent,
      phaseStats,
    };
  }, [rows]);

  return (
    <div id="editable-syllabus-spreadsheet" className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. TOP OVERALL PROGRESS & EXCEL SPREADSHEET TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-700/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Phase-Grouped Syllabus Spreadsheet</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800">
                OPSC / UPSC Scheme
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Structured into <strong>Prelims</strong>, <strong>Mains</strong>, and <strong>Interview</strong>. Click headers to expand or collapse. Drag column dividers to resize.
            </p>
          </div>

          {/* Quick Header Actions: Expand/Collapse All, Add Column, Bulk Add, Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-semibold cursor-pointer transition-colors"
              title="Expand all 3 phases"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-semibold cursor-pointer transition-colors"
              title="Collapse all phases"
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={() => setShowAddColumnModal(true)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Add custom column across all phase tables"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>+ Add Column</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenBulkAdd()}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Bulk import topics into a selected phase"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Bulk Add</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImportCSVModal(true)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Import syllabus from CSV"
            >
              <Upload className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportSyllabusToCSV(rows, columns, exam.name)}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export complete syllabus with phase column to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Dynamic Overall Progress Summary */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-gray-700 dark:text-gray-300">
                Overall Progress: <strong>{stats.completed}</strong> of <strong>{stats.total}</strong> completed ({stats.percent}%)
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {stats.totalRevisions} total revisions
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          {/* Quick Phase Progress Badges */}
          <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap">
            {PHASES.map((p) => {
              const pStat = stats.phaseStats[p.id];
              return (
                <div
                  key={p.id}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 ${p.badgeClass}`}
                >
                  <span>{p.name}:</span>
                  <span>
                    {pStat.completed}/{pStat.total} ({pStat.percent}%)
                  </span>
                </div>
              );
            })}
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
            placeholder="Search topic, paper/subject, or remarks across all phases..."
            className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
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
          {/* Phase Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Phase:</span>
            </span>
            <select
              value={selectedPhaseFilter}
              onChange={(e) => setSelectedPhaseFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs font-medium cursor-pointer"
            >
              <option value="All">All Phases ({rows.length})</option>
              <option value="Prelims">1: Prelims ({stats.phaseStats.Prelims.total})</option>
              <option value="Mains">2: Mains ({stats.phaseStats.Mains.total})</option>
              <option value="Interview">3: Interview ({stats.phaseStats.Interview.total})</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs font-medium cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Revision Needed">Revision Needed</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VERTICALLY STACKED PHASE SECTIONS (PRELIMS, MAINS, INTERVIEW) */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {PHASES.map((phaseConfig) => {
          // If a phase filter is applied and not matching, hide this section
          if (selectedPhaseFilter !== 'All' && selectedPhaseFilter !== phaseConfig.id) {
            return null;
          }

          const phaseStats = stats.phaseStats[phaseConfig.id];
          const phaseFilteredRows = filteredRows.filter(
            (r) => normalizePhase(r.phase) === phaseConfig.id
          );
          const isCollapsed = collapsedPhases[phaseConfig.id];

          return (
            <div
              key={phaseConfig.id}
              className={`border-2 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-xs transition-all duration-200 ${phaseConfig.borderColor}`}
            >
              {/* ------------------------------------------------------------- */}
              {/* PROMINENT FULL-WIDTH PHASE HEADER BAR                         */}
              {/* ------------------------------------------------------------- */}
              <div
                className={`p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${phaseConfig.headerBg}`}
              >
                <div
                  onClick={() => togglePhaseCollapse(phaseConfig.id)}
                  className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
                >
                  <button
                    type="button"
                    className="p-1 rounded-md text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-transform shrink-0"
                    title={isCollapsed ? `Expand ${phaseConfig.name}` : `Collapse ${phaseConfig.name}`}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-5 h-5 transition-transform" />
                    ) : (
                      <ChevronDown className="w-5 h-5 transition-transform" />
                    )}
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md border shadow-2xs ${phaseConfig.badgeClass}`}
                    >
                      {phaseConfig.tag}
                    </span>
                    <h3 className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
                      {phaseConfig.name}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden md:inline">
                      • {phaseConfig.description}
                    </span>
                  </div>
                </div>

                {/* Progress & Quick Phase Actions */}
                <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                  {/* Topic Count & Progress Pill */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {phaseFilteredRows.length !== phaseStats.total ? (
                        <span>
                          {phaseFilteredRows.length} of {phaseStats.total} topics
                        </span>
                      ) : (
                        <span>{phaseStats.total} topics</span>
                      )}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">•</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {phaseStats.completed} completed ({phaseStats.percent}%)
                    </span>
                  </div>

                  {/* Compact Progress Bar */}
                  <div className="w-20 sm:w-24 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden shrink-0 hidden xs:block">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${phaseConfig.progressFill}`}
                      style={{ width: `${phaseStats.percent}%` }}
                    />
                  </div>

                  {/* Prominent + Add Syllabus Button for this phase */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddSyllabus(phaseConfig.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    title={`Add syllabus item specifically to ${phaseConfig.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Syllabus</span>
                  </button>

                  {/* Phase Actions Dropdown Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuPhase(
                          activeMenuPhase === phaseConfig.id ? null : phaseConfig.id
                        );
                      }}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                      title={`${phaseConfig.name} options`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {activeMenuPhase === phaseConfig.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setActiveMenuPhase(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1 z-40 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPhase(null);
                              handleOpenAddSyllabus(phaseConfig.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Add topic to {phaseConfig.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPhase(null);
                              handleOpenBulkAdd(phaseConfig.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Bulk Add to {phaseConfig.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPhase(null);
                              exportSyllabusToCSV(rows, columns, exam.name, phaseConfig.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Export {phaseConfig.name} CSV</span>
                          </button>
                          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPhase(null);
                              togglePhaseCollapse(phaseConfig.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer"
                          >
                            <span>{isCollapsed ? 'Expand Section' : 'Collapse Section'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* PHASE EXPANDED TABLE CONTENT                                  */}
              {/* ------------------------------------------------------------- */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-[#F8FAFC] dark:bg-gray-800/90 sticky top-0 z-10 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-300 dark:border-gray-700 select-none">
                      <tr>
                        {/* Index column */}
                        <th className="py-2 px-2.5 w-12 text-center text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700 font-mono text-[11px]">
                          #
                        </th>

                        {/* Content columns (with Excel-like drag resize handles, NO +/- buttons) */}
                        {columns.map((col) => {
                          const colWidth = col.width || DEFAULT_WIDTHS[col.key] || 180;
                          const isResizingThis = resizingColId === col.id;

                          return (
                            <th
                              key={col.id}
                              style={{ width: `${colWidth}px`, minWidth: `${Math.max(60, colWidth)}px` }}
                              className={`relative py-2.5 px-3 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap group/th bg-[#F8FAFC] dark:bg-gray-800 ${
                                isResizingThis ? 'bg-indigo-50/80 dark:bg-indigo-950/40' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">
                                  {col.label}
                                </span>

                                {col.isCustom && (
                                  <div className="flex items-center gap-1 opacity-70 group-hover/th:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingColumn(col);
                                        setEditColumnName(col.label);
                                      }}
                                      className="p-0.5 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                      title="Rename column"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteColumn(col.id)}
                                      className="p-0.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                      title="Delete custom column"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Excel / Google Sheets Boundary Drag Resize Handle */}
                              <div
                                onMouseDown={(e) => handleResizeStart(e, col)}
                                onDoubleClick={() => handleDoubleClickResize(col)}
                                className="absolute top-0 right-0 w-3 -mr-1.5 h-full cursor-col-resize z-20 group/handle flex items-center justify-center select-none"
                                title="Drag left/right to resize column (Double-click to reset)"
                              >
                                <div
                                  className={`w-[2px] h-full transition-colors ${
                                    isResizingThis
                                      ? 'bg-indigo-600 dark:bg-indigo-400 shadow-sm'
                                      : 'bg-transparent group-hover/handle:bg-indigo-400'
                                  }`}
                                />
                              </div>
                            </th>
                          );
                        })}

                        {/* Actions column */}
                        <th className="py-2.5 px-3 w-28 text-center text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700/80 bg-white dark:bg-gray-900">
                      {phaseFilteredRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns.length + 2}
                            className="py-8 px-4 text-center text-gray-500 dark:text-gray-400"
                          >
                            <div className="max-w-md mx-auto space-y-2">
                              <p className="text-xs font-medium">
                                {searchQuery || statusFilter !== 'All'
                                  ? `No topics in ${phaseConfig.name} match your active filters.`
                                  : `No syllabus topics added yet under ${phaseConfig.name}.`}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpenAddSyllabus(phaseConfig.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add First {phaseConfig.name} Topic</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        phaseFilteredRows.map((row, idx) => {
                          const isEditing = editingRowId === row.id;

                          return (
                            <tr
                              key={row.id}
                              className={`transition-colors hover:bg-gray-50/90 dark:hover:bg-gray-800/60 ${
                                isEditing
                                  ? 'bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-400/60 inset-0'
                                  : idx % 2 === 1
                                  ? 'bg-[#FCFCFD] dark:bg-gray-900/60'
                                  : ''
                              }`}
                            >
                              {/* 1. Row Index Number */}
                              <td className="py-2.5 px-2 text-center text-gray-400 dark:text-gray-500 font-mono text-[11px] border-r border-gray-100 dark:border-gray-800">
                                {idx + 1}
                              </td>

                              {/* Dynamic Columns */}
                              {columns.map((col) => {
                                const colWidth = col.width || DEFAULT_WIDTHS[col.key] || 180;

                                // Paper / Subject Column
                                if (col.key === 'subject') {
                                  return (
                                    <td
                                      key={col.id}
                                      style={{ width: `${colWidth}px`, minWidth: `${Math.max(60, colWidth)}px` }}
                                      className="py-2 px-3 border-r border-gray-100 dark:border-gray-800 font-medium text-gray-800 dark:text-gray-200"
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
                                        <div className="whitespace-normal break-words leading-relaxed">
                                          {row.subject}
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                // Syllabus Topic / Unit Column (Natural text wrapping)
                                if (col.key === 'topic') {
                                  return (
                                    <td
                                      key={col.id}
                                      style={{ width: `${colWidth}px`, minWidth: `${Math.max(80, colWidth)}px` }}
                                      className="py-2.5 px-3 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100"
                                    >
                                      {isEditing ? (
                                        <textarea
                                          value={draftRow?.topic || ''}
                                          onChange={(e) => handleDraftCellChange('topic', e.target.value)}
                                          rows={2}
                                          placeholder="Syllabus topic details..."
                                          className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                                        />
                                      ) : (
                                        <div className="whitespace-normal break-words leading-relaxed font-normal">
                                          {row.topic}
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                // Status Column
                                if (col.key === 'status') {
                                  const currentStatus = isEditing ? draftRow?.status || 'Not Started' : row.status;
                                  const badgeStyles: Record<string, string> = {
                                    'Not Started': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
                                    'In Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                    'Completed': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                                    'Revision Needed': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                                  };

                                  return (
                                    <td
                                      key={col.id}
                                      style={{ width: `${colWidth}px`, minWidth: `${Math.max(60, colWidth)}px` }}
                                      className="py-2 px-3 border-r border-gray-100 dark:border-gray-800"
                                    >
                                      {isEditing ? (
                                        <select
                                          value={draftRow?.status || 'Not Started'}
                                          onChange={(e) => handleDraftCellChange('status', e.target.value)}
                                          className="w-full text-xs font-semibold px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                        >
                                          <option value="Not Started">Not Started</option>
                                          <option value="In Progress">In Progress</option>
                                          <option value="Completed">Completed</option>
                                          <option value="Revision Needed">Revision Needed</option>
                                        </select>
                                      ) : (
                                        <span
                                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyles[currentStatus] || badgeStyles['Not Started']}`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${
                                              currentStatus === 'Completed'
                                                ? 'bg-emerald-500'
                                                : currentStatus === 'In Progress'
                                                ? 'bg-blue-500'
                                                : currentStatus === 'Revision Needed'
                                                ? 'bg-amber-500'
                                                : 'bg-gray-400'
                                            }`}
                                          />
                                          <span className="truncate">{currentStatus}</span>
                                        </span>
                                      )}
                                    </td>
                                  );
                                }

                                // Times Completed / Revisions Column
                                if (col.key === 'timesCompleted') {
                                  return (
                                    <td
                                      key={col.id}
                                      style={{ width: `${colWidth}px`, minWidth: `${Math.max(50, colWidth)}px` }}
                                      className="py-2 px-3 border-r border-gray-100 dark:border-gray-800 text-center"
                                    >
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={99}
                                          value={draftRow?.timesCompleted ?? 0}
                                          onChange={(e) =>
                                            handleDraftCellChange('timesCompleted', parseInt(e.target.value, 10) || 0)
                                          }
                                          className="w-16 px-1.5 py-1 text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                      ) : (
                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono text-[11px] font-bold">
                                          {row.timesCompleted ?? 0}x
                                        </span>
                                      )}
                                    </td>
                                  );
                                }

                                // Remarks Column
                                if (col.key === 'remarks') {
                                  return (
                                    <td
                                      key={col.id}
                                      style={{ width: `${colWidth}px`, minWidth: `${Math.max(60, colWidth)}px` }}
                                      className="py-2 px-3 border-r border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                                    >
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={draftRow?.remarks || ''}
                                          onChange={(e) => handleDraftCellChange('remarks', e.target.value)}
                                          placeholder="Notes, references, sources..."
                                          className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                      ) : (
                                        <div className="whitespace-normal break-words text-[11px]">
                                          {row.remarks || <span className="text-gray-400 italic">—</span>}
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                // Custom User-Added Column
                                const customVal = isEditing
                                  ? (draftRow?.customData && draftRow.customData[col.key]) || ''
                                  : (row.customData && row.customData[col.key]) || '';

                                return (
                                  <td
                                    key={col.id}
                                    style={{ width: `${colWidth}px`, minWidth: `${Math.max(60, colWidth)}px` }}
                                    className="py-2 px-3 border-r border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200"
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
                                      <div className="whitespace-normal break-words text-xs">
                                        {customVal || <span className="text-gray-400 italic">—</span>}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Actions Column (Edit/Save/Cancel, Duplicate, Move, Delete) */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={saveDraftRow}
                                      className="p-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-200 transition-colors cursor-pointer"
                                      title="Save changes (Enter)"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditRow}
                                      className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                                      title="Cancel editing (Esc)"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditRow(row)}
                                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded transition-colors cursor-pointer"
                                      title="Edit syllabus row"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateRow(row)}
                                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded transition-colors cursor-pointer"
                                      title="Duplicate topic"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveRowUpDown(row.id, 'up')}
                                      disabled={idx === 0}
                                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
                                      title="Move up in phase"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveRowUpDown(row.id, 'down')}
                                      disabled={idx === phaseFilteredRows.length - 1}
                                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
                                      title="Move down in phase"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(row.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded transition-colors cursor-pointer"
                                      title="Delete topic"
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

                  {/* Phase Table Footer with inline Add Row button */}
                  <div className="p-2.5 bg-gray-50/80 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickAddRowInPhase(phaseConfig.id)}
                      className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Row to {phaseConfig.name}</span>
                    </button>

                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {phaseStats.total} total {phaseConfig.name} topics • {phaseStats.completed} completed
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 4. FLOATING UNDO TOAST FOR ROW DELETIONS */}
      {/* ========================================================================= */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom-3">
          <span className="text-xs font-medium truncate max-w-xs">
            Deleted &quot;{undoToast.row.topic}&quot;
          </span>
          <button
            type="button"
            onClick={handleRestoreDeletedRow}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setUndoToast(null)}
            className="p-1 text-gray-400 hover:text-white dark:hover:text-black rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ADD SYLLABUS MODAL (Phase-aware) */}
      {/* ========================================================================= */}
      {showAddSyllabusModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Add Syllabus Topic
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSyllabusModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Target Phase
                </label>
                <select
                  value={addSyllabusPhase}
                  onChange={(e) => setAddSyllabusPhase(e.target.value as PhaseKey)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Prelims">Phase 1: Prelims</option>
                  <option value="Mains">Phase 2: Mains</option>
                  <option value="Interview">Phase 3: Interview</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Paper / Subject Name
                </label>
                <input
                  type="text"
                  value={addSubjectInput}
                  onChange={(e) => setAddSubjectInput(e.target.value)}
                  placeholder="e.g. Paper I: General Studies, GS-II, or Odia Language"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Syllabus Topic / Unit Title <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={addTopicInput}
                  onChange={(e) => setAddTopicInput(e.target.value)}
                  rows={3}
                  placeholder="e.g. Current Affairs of National and International Importance, Indian Polity & Governance"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={addStatusInput}
                    onChange={(e) => setAddStatusInput(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Revision Needed">Revision Needed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Remarks / Source
                  </label>
                  <input
                    type="text"
                    value={addRemarksInput}
                    onChange={(e) => setAddRemarksInput(e.target.value)}
                    placeholder="e.g. NCERT, Laxmikanth"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowAddSyllabusModal(false)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewSyllabus}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Add Topic to {addSyllabusPhase}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. BULK ADD TOPICS MODAL */}
      {/* ========================================================================= */}
      {showBulkAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Bulk Add Syllabus Topics
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Paste multiple topics (one per line). Optionally format as <code>Subject | Topic Name</code> to specify papers per topic.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Target Phase
                </label>
                <select
                  value={bulkPhase}
                  onChange={(e) => setBulkPhase(e.target.value as PhaseKey)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Prelims">Phase 1: Prelims</option>
                  <option value="Mains">Phase 2: Mains</option>
                  <option value="Interview">Phase 3: Interview</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Default Paper / Subject
                </label>
                <input
                  type="text"
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  placeholder="e.g. General Studies I"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Topics List (One topic per line)
                </label>
                <textarea
                  value={bulkTopicsText}
                  onChange={(e) => setBulkTopicsText(e.target.value)}
                  rows={6}
                  placeholder={`History of India & Indian National Movement\nIndian & World Geography\nIndian Polity & Governance\nEconomic & Social Development\nGeneral Issues on Environmental Ecology`}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowBulkAddModal(false)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAddSubmit}
                disabled={!bulkTopicsText.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Add Topics Under {bulkPhase}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. IMPORT CSV MODAL */}
      {/* ========================================================================= */}
      {showImportCSVModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Import Syllabus from CSV
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowImportCSVModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Paste raw CSV text with headers (e.g. <code>Phase,Subject,Topic,Status,Revisions</code>). If the CSV doesn&apos;t have a Phase column, rows will be assigned to the default phase selected below.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Default Phase (if not specified in CSV)
                </label>
                <select
                  value={importCSVPhase}
                  onChange={(e) => setImportCSVPhase(e.target.value as PhaseKey)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Prelims">Prelims</option>
                  <option value="Mains">Mains</option>
                  <option value="Interview">Interview</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  CSV Content
                </label>
                <textarea
                  value={importCSVText}
                  onChange={(e) => setImportCSVText(e.target.value)}
                  rows={7}
                  placeholder={`Phase,Paper/Subject,Topic,Status,Revisions\nPrelims,General Studies I,Current Affairs,Not Started,0\nMains,GS I,Modern Indian History,Completed,1`}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowImportCSVModal(false)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCSVSubmit}
                disabled={!importCSVText.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Import Topics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. ADD CUSTOM COLUMN MODAL */}
      {/* ========================================================================= */}
      {showAddColumnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Add Custom Column
              </h4>
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Custom columns appear across all phase tables (Prelims, Mains, Interview) and support Excel-style drag resizing.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Column Label
              </label>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g. Priority, PYQ Year, Target Date"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. RENAME CUSTOM COLUMN MODAL */}
      {/* ========================================================================= */}
      {editingColumn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Rename Column
              </h4>
              <button
                type="button"
                onClick={() => setEditingColumn(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                New Column Label
              </label>
              <input
                type="text"
                value={editColumnName}
                onChange={(e) => setEditColumnName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingColumn(null)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditColumn}
                disabled={!editColumnName.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
