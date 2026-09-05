import { ExamItem, ExamSubject, SyllabusTableColumn, SyllabusTableRow } from '../types';

export const DEFAULT_SYLLABUS_COLUMNS: SyllabusTableColumn[] = [
  { id: 'col-phase', label: 'Phase', key: 'phase', isCustom: false },
  { id: 'col-subject', label: 'Paper / Subject', key: 'subject', isCustom: false },
  { id: 'col-topic', label: 'Syllabus Topic / Unit', key: 'topic', isCustom: false },
  { id: 'col-status', label: 'Status', key: 'status', isCustom: false },
  { id: 'col-times', label: 'Times Completed', key: 'timesCompleted', type: 'number', isCustom: false },
  { id: 'col-remarks', label: 'Remarks & Notes', key: 'remarks', isCustom: false },
];

export function detectPhaseFromSubjectName(subjectName: string): string {
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
    return exam.syllabusTableRows;
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

export function exportSyllabusToCSV(rows: SyllabusTableRow[], columns: SyllabusTableColumn[], examName: string): void {
  const headers = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`);
  const csvLines: string[] = [headers.join(',')];

  for (const row of rows) {
    const lineValues = columns.map((col) => {
      let val = '';
      if (col.key === 'phase') val = row.phase || '';
      else if (col.key === 'subject') val = row.subject || '';
      else if (col.key === 'topic') val = row.topic || '';
      else if (col.key === 'status') val = row.status || '';
      else if (col.key === 'timesCompleted') val = String(row.timesCompleted ?? 0);
      else if (col.key === 'remarks') val = row.remarks || '';
      else if (col.isCustom) {
        val = (row.customData && row.customData[col.key]) || '';
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvLines.push(lineValues.join(','));
  }

  const csvBlob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${examName.replace(/[^a-zA-Z0-9]/g, '_')}_Syllabus.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
