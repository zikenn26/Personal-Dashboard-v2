import { ExamItem, ExamSubject, SyllabusTableColumn, SyllabusTableRow } from '../types';

export const DEFAULT_SYLLABUS_COLUMNS: SyllabusTableColumn[] = [
  { id: 'col-subject', label: 'Paper / Subject', key: 'subject', width: 200, isCustom: false },
  { id: 'col-topic', label: 'Syllabus Topic / Unit', key: 'topic', width: 380, isCustom: false },
  { id: 'col-status', label: 'Status', key: 'status', width: 135, isCustom: false },
  { id: 'col-times', label: 'Revisions', key: 'timesCompleted', width: 110, type: 'number', isCustom: false },
  { id: 'col-remarks', label: 'Remarks & Notes', key: 'remarks', width: 200, isCustom: false },
];

export function normalizePhase(phase: any): 'Prelims' | 'Mains' | 'Interview' {
  if (!phase) return 'Prelims';
  const str = String(phase).trim().toLowerCase();
  if (
    str === '1' ||
    str === 'prelims' ||
    str.includes('prelim') ||
    str.includes('phase 1') ||
    str.includes('tier 1')
  ) {
    return 'Prelims';
  }
  if (
    str === '2' ||
    str === 'mains' ||
    str.includes('main') ||
    str.includes('phase 2') ||
    str.includes('tier 2')
  ) {
    return 'Mains';
  }
  if (
    str === '3' ||
    str === 'interview' ||
    str.includes('interview') ||
    str.includes('personality') ||
    str.includes('viva') ||
    str.includes('phase 3') ||
    str.includes('tier 3')
  ) {
    return 'Interview';
  }
  return 'Prelims';
}

export function detectPhaseFromSubjectName(subjectName: string): 'Prelims' | 'Mains' | 'Interview' {
  const lower = (subjectName || '').toLowerCase();
  if (
    lower.includes('prelim') ||
    lower.includes('screening') ||
    lower.includes('tier 1') ||
    lower.includes('phase 1') ||
    lower.includes('csat') ||
    lower.includes('pre-')
  ) {
    return 'Prelims';
  }
  if (
    lower.includes('main') ||
    lower.includes('tier 2') ||
    lower.includes('phase 2') ||
    lower.includes('descriptive') ||
    lower.includes('essay') ||
    lower.includes('optional') ||
    lower.includes('gs-') ||
    lower.includes('odia') ||
    lower.includes('english language')
  ) {
    return 'Mains';
  }
  if (
    lower.includes('interview') ||
    lower.includes('personality') ||
    lower.includes('viva') ||
    lower.includes('tier 3') ||
    lower.includes('phase 3')
  ) {
    return 'Interview';
  }
  return 'Prelims';
}

/**
 * Initializes or normalizes syllabus table rows from exam subjects
 */
export function getOrInitializeSyllabusRows(exam: ExamItem): SyllabusTableRow[] {
  if (exam.syllabusTableRows && exam.syllabusTableRows.length > 0) {
    return exam.syllabusTableRows.map((r) => ({
      ...r,
      phase: normalizePhase(r.phase),
      status: r.status || 'Not Started',
      timesCompleted: typeof r.timesCompleted === 'number' ? r.timesCompleted : 0,
      customData: r.customData || {},
    }));
  }

  const generatedRows: SyllabusTableRow[] = [];
  let rowIndex = 1;

  // Generate rows from subjects
  if (exam.subjects && exam.subjects.length > 0) {
    for (const sub of exam.subjects) {
      const phase = detectPhaseFromSubjectName(sub.name);
      if (sub.topics && sub.topics.length > 0) {
        for (const top of sub.topics) {
          generatedRows.push({
            id: `row-${rowIndex++}-${top.id || Math.random().toString(36).substr(2, 5)}`,
            phase,
            subject: sub.name,
            topic: top.title,
            status: top.completed ? 'Completed' : 'Not Started',
            timesCompleted: top.completed ? 1 : 0,
            remarks: top.notes || '',
            customData: {},
          });
        }
      } else {
        generatedRows.push({
          id: `row-${rowIndex++}`,
          phase,
          subject: sub.name,
          topic: 'General Overview & Foundations',
          status: 'Not Started',
          timesCompleted: 0,
          remarks: '',
          customData: {},
        });
      }
    }
  }

  // If exam has no subjects, provide starter rows for the 3 phases
  if (generatedRows.length === 0) {
    generatedRows.push(
      {
        id: 'row-1',
        phase: 'Prelims',
        subject: 'Paper I: General Studies',
        topic: 'Indian Polity & Governance',
        status: 'In Progress',
        timesCompleted: 1,
        remarks: 'Focus on Fundamental Rights & DPSP',
        customData: {},
      },
      {
        id: 'row-2',
        phase: 'Prelims',
        subject: 'Paper I: General Studies',
        topic: 'History of India & National Movement',
        status: 'Not Started',
        timesCompleted: 0,
        remarks: 'NCERTs & Bipin Chandra',
        customData: {},
      },
      {
        id: 'row-3',
        phase: 'Mains',
        subject: 'General Studies I',
        topic: 'Indian Culture, Art & Architecture',
        status: 'Not Started',
        timesCompleted: 0,
        remarks: 'Nitin Singhania reference',
        customData: {},
      },
      {
        id: 'row-4',
        phase: 'Interview',
        subject: 'Personality Test',
        topic: 'Detailed Application Form (DAF) Analysis',
        status: 'Not Started',
        timesCompleted: 0,
        remarks: 'Home state, hobbies & current events',
        customData: {},
      }
    );
  }

  return generatedRows;
}

/**
 * Export syllabus rows to CSV format including Phase as the leading column
 */
export function exportSyllabusToCSV(
  rows: SyllabusTableRow[],
  columns: SyllabusTableColumn[],
  examName: string,
  filterPhase?: 'Prelims' | 'Mains' | 'Interview'
): void {
  // Exclude legacy 'phase' column from inner loop to avoid duplication with leading Phase column
  const contentColumns = columns.filter((col) => col.key !== 'phase');
  const headers = ['"Phase"', ...contentColumns.map((col) => `"${col.label.replace(/"/g, '""')}"`)];
  const csvLines: string[] = [headers.join(',')];

  const targetRows = filterPhase ? rows.filter((r) => r.phase === filterPhase) : rows;

  for (const row of targetRows) {
    const lineValues = [
      `"${normalizePhase(row.phase)}"`,
      ...contentColumns.map((col) => {
        let val = '';
        if (col.key === 'subject') val = row.subject || '';
        else if (col.key === 'topic') val = row.topic || '';
        else if (col.key === 'status') val = row.status || '';
        else if (col.key === 'timesCompleted') val = String(row.timesCompleted ?? 0);
        else if (col.key === 'remarks') val = row.remarks || '';
        else if (col.isCustom) {
          val = (row.customData && row.customData[col.key]) || '';
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }),
    ];
    csvLines.push(lineValues.join(','));
  }

  const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.href = url;
  const suffix = filterPhase ? `_${filterPhase}` : '';
  link.setAttribute('download', `${examName.replace(/[^a-zA-Z0-9]/g, '_')}_Syllabus${suffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV content and import syllabus rows
 */
export function parseCSVToSyllabusRows(
  csvText: string,
  defaultPhase: 'Prelims' | 'Mains' | 'Interview' = 'Prelims'
): SyllabusTableRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header line
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headerCells = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const phaseIdx = headerCells.findIndex((h) => h.includes('phase'));
  const subjectIdx = headerCells.findIndex((h) => h.includes('subject') || h.includes('paper'));
  const topicIdx = headerCells.findIndex((h) => h.includes('topic') || h.includes('unit') || h.includes('syllabus'));
  const statusIdx = headerCells.findIndex((h) => h.includes('status'));
  const timesIdx = headerCells.findIndex((h) => h.includes('revision') || h.includes('times') || h.includes('completed'));
  const remarksIdx = headerCells.findIndex((h) => h.includes('remark') || h.includes('note'));

  const rows: SyllabusTableRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length === 0 || cells.every((c) => !c)) continue;

    const rawPhase = phaseIdx >= 0 && cells[phaseIdx] ? cells[phaseIdx] : defaultPhase;
    const phase = normalizePhase(rawPhase);
    const subject = subjectIdx >= 0 && cells[subjectIdx] ? cells[subjectIdx] : `${phase} General Studies`;
    const topic = topicIdx >= 0 && cells[topicIdx] ? cells[topicIdx] : cells[0] || 'Topic';
    let status: SyllabusTableRow['status'] = 'Not Started';
    if (statusIdx >= 0 && cells[statusIdx]) {
      const s = cells[statusIdx].toLowerCase();
      if (s.includes('comp')) status = 'Completed';
      else if (s.includes('prog')) status = 'In Progress';
      else if (s.includes('rev')) status = 'Revision Needed';
    }
    const timesCompleted = timesIdx >= 0 && cells[timesIdx] ? parseInt(cells[timesIdx], 10) || 0 : 0;
    const remarks = remarksIdx >= 0 && cells[remarksIdx] ? cells[remarksIdx] : '';

    rows.push({
      id: `row-import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      phase,
      subject,
      topic,
      status,
      timesCompleted,
      remarks,
      customData: {},
    });
  }

  return rows;
}

