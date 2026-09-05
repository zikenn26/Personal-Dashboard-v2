import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  Sparkles,
  BookMarked,
  HelpCircle,
  Save,
  Check,
  Search,
  Filter,
  BarChart3,
  Bookmark,
} from 'lucide-react';
import {
  ExamItem,
  ExamSubject,
  SyllabusTopic,
  ExamBook,
  ExamStage,
  ExamPattern,
} from '../../types';
import { ExamCountdown } from './ExamCountdown';
import { BookModal } from './BookModal';
import { SubjectModal } from './SubjectModal';
import { StageModal } from './StageModal';
import { EditableSyllabusTable } from './EditableSyllabusTable';
import { ExamPhasesView } from './ExamPhasesView';
import { Sound } from '../../utils/audio';

interface ExamDetailViewProps {
  exam: ExamItem;
  onBack: () => void;
  onUpdateExam: (updated: Partial<ExamItem>) => void;
  soundEnabled: boolean;
}

type DetailTab = 'syllabus-table' | 'phases' | 'books' | 'pattern' | 'strategy';

export const ExamDetailView: React.FC<ExamDetailViewProps> = ({
  exam,
  onBack,
  onUpdateExam,
  soundEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('syllabus-table');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    exam.subjects[0]?.id || ''
  );

  // Modals state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookToEdit, setBookToEdit] = useState<ExamBook | null>(null);
  const [defaultBookSubjectId, setDefaultBookSubjectId] = useState<string>(selectedSubjectId);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<ExamSubject | null>(null);

  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageToEdit, setStageToEdit] = useState<ExamStage | null>(null);

  // Inline topic editing
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = useState('');

  // Strategy notes local state
  const [strategyText, setStrategyText] = useState(exam.strategyNotes || '');
  const [isStrategySaved, setIsStrategySaved] = useState(false);

  // Quick edit exam meta state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState(exam.name);
  const [metaTargetDate, setMetaTargetDate] = useState(exam.targetExamDate);
  const [metaRegStart, setMetaRegStart] = useState(exam.registrationStartDate || '');
  const [metaRegEnd, setMetaRegEnd] = useState(exam.registrationEndDate || '');
  const [metaConductingBody, setMetaConductingBody] = useState(exam.conductingBody);
  const [metaWebsite, setMetaWebsite] = useState(exam.officialWebsite || '');

  // Current selected subject object
  const currentSubject = exam.subjects.find((s) => s.id === selectedSubjectId) || exam.subjects[0];

  // ===================== SYLLABUS TOPIC HANDLERS =====================
  const handleToggleTopic = (topicId: string) => {
    if (!currentSubject) return;

    const updatedSubjects = exam.subjects.map((sub) => {
      if (sub.id !== currentSubject.id) return sub;
      return {
        ...sub,
        topics: sub.topics.map((top) => {
          if (top.id !== topicId) return top;
          const nextCompleted = !top.completed;
          if (nextCompleted) Sound.success(soundEnabled);
          else Sound.click(soundEnabled);
          return { ...top, completed: nextCompleted };
        }),
      };
    });

    onUpdateExam({ subjects: updatedSubjects, updatedAt: Date.now() });
  };

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim() || !currentSubject) return;

    const newTopic: SyllabusTopic = {
      id: `top-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: newTopicTitle.trim(),
      completed: false,
    };

    const updatedSubjects = exam.subjects.map((sub) => {
      if (sub.id !== currentSubject.id) return sub;
      return {
        ...sub,
        topics: [...sub.topics, newTopic],
      };
    });

    onUpdateExam({ subjects: updatedSubjects, updatedAt: Date.now() });
    setNewTopicTitle('');
    Sound.click(soundEnabled);
  };

  const handleSaveTopicTitle = (topicId: string) => {
    if (!editingTopicTitle.trim() || !currentSubject) return;

    const updatedSubjects = exam.subjects.map((sub) => {
      if (sub.id !== currentSubject.id) return sub;
      return {
        ...sub,
        topics: sub.topics.map((t) => (t.id === topicId ? { ...t, title: editingTopicTitle.trim() } : t)),
      };
    });

    onUpdateExam({ subjects: updatedSubjects, updatedAt: Date.now() });
    setEditingTopicId(null);
    setEditingTopicTitle('');
    Sound.click(soundEnabled);
  };

  const handleDeleteTopic = (topicId: string) => {
    if (!currentSubject) return;

    const updatedSubjects = exam.subjects.map((sub) => {
      if (sub.id !== currentSubject.id) return sub;
      return {
        ...sub,
        topics: sub.topics.filter((t) => t.id !== topicId),
      };
    });

    onUpdateExam({ subjects: updatedSubjects, updatedAt: Date.now() });
    Sound.click(soundEnabled);
  };

  // ===================== SUBJECT HANDLERS =====================
  const handleSaveSubject = (savedSubject: ExamSubject) => {
    const exists = exam.subjects.some((s) => s.id === savedSubject.id);
    let updatedSubjects: ExamSubject[];

    if (exists) {
      updatedSubjects = exam.subjects.map((s) => (s.id === savedSubject.id ? savedSubject : s));
    } else {
      updatedSubjects = [...exam.subjects, savedSubject];
    }

    onUpdateExam({ subjects: updatedSubjects, updatedAt: Date.now() });
    setSelectedSubjectId(savedSubject.id);
    Sound.success(soundEnabled);
  };

  const handleDeleteSubject = (subjectId: string) => {
    if (exam.subjects.length <= 1) {
      alert('An examination requires at least one subject. You can edit this subject instead.');
      return;
    }
    if (!window.confirm('Delete this subject along with its topics? Associated books will also be unlinked.')) {
      return;
    }

    const updatedSubjects = exam.subjects.filter((s) => s.id !== subjectId);
    const updatedBooks = exam.books.filter((b) => b.subjectId !== subjectId);

    onUpdateExam({
      subjects: updatedSubjects,
      books: updatedBooks,
      updatedAt: Date.now(),
    });

    if (selectedSubjectId === subjectId) {
      setSelectedSubjectId(updatedSubjects[0]?.id || '');
    }
    Sound.click(soundEnabled);
  };

  // ===================== BOOKS HANDLERS =====================
  const handleOpenAddBook = (subjectIdToPreselect?: string) => {
    setDefaultBookSubjectId(subjectIdToPreselect || selectedSubjectId || exam.subjects[0]?.id || '');
    setBookToEdit(null);
    setIsBookModalOpen(true);
    Sound.click(soundEnabled);
  };

  const handleEditBook = (book: ExamBook) => {
    setBookToEdit(book);
    setIsBookModalOpen(true);
    Sound.click(soundEnabled);
  };

  const handleSaveBook = (savedBook: ExamBook) => {
    const exists = exam.books.some((b) => b.id === savedBook.id);
    let updatedBooks: ExamBook[];

    if (exists) {
      updatedBooks = exam.books.map((b) => (b.id === savedBook.id ? savedBook : b));
    } else {
      updatedBooks = [...exam.books, savedBook];
    }

    onUpdateExam({ books: updatedBooks, updatedAt: Date.now() });
    Sound.success(soundEnabled);
  };

  const handleDeleteBook = (bookId: string) => {
    if (!window.confirm('Remove this book from your study list?')) return;
    const updatedBooks = exam.books.filter((b) => b.id !== bookId);
    onUpdateExam({ books: updatedBooks, updatedAt: Date.now() });
    Sound.click(soundEnabled);
  };

  // ===================== STAGES HANDLERS =====================
  const handleSaveStage = (savedStage: ExamStage) => {
    const exists = exam.stages.some((s) => s.id === savedStage.id);
    let updatedStages: ExamStage[];

    if (exists) {
      updatedStages = exam.stages.map((s) => (s.id === savedStage.id ? savedStage : s));
    } else {
      updatedStages = [...exam.stages, savedStage];
    }

    onUpdateExam({ stages: updatedStages, updatedAt: Date.now() });
    Sound.success(soundEnabled);
  };

  const handleDeleteStage = (stageId: string) => {
    if (!window.confirm('Delete this stage?')) return;
    const updatedStages = exam.stages.filter((s) => s.id !== stageId);
    onUpdateExam({ stages: updatedStages, updatedAt: Date.now() });
    Sound.click(soundEnabled);
  };

  // ===================== METADATA SAVE =====================
  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateExam({
      name: metaName.trim(),
      targetExamDate: metaTargetDate,
      registrationStartDate: metaRegStart || undefined,
      registrationEndDate: metaRegEnd || undefined,
      conductingBody: metaConductingBody.trim(),
      officialWebsite: metaWebsite.trim() || undefined,
      updatedAt: Date.now(),
    });
    setIsEditingMeta(false);
    Sound.success(soundEnabled);
  };

  // Strategy save
  const handleSaveStrategy = () => {
    onUpdateExam({ strategyNotes: strategyText, updatedAt: Date.now() });
    setIsStrategySaved(true);
    Sound.success(soundEnabled);
    setTimeout(() => setIsStrategySaved(false), 2500);
  };

  // Progress metrics
  const totalExamTopics = exam.subjects.reduce((a, b) => a + b.topics.length, 0);
  const completedExamTopics = exam.subjects.reduce((a, b) => a + b.topics.filter((t) => t.completed).length, 0);
  const overallPercentage = totalExamTopics > 0 ? Math.round((completedExamTopics / totalExamTopics) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-2xs transition-colors cursor-pointer"
            title="Back to all exams"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">{exam.icon || '🏛️'}</span>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {exam.name}
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                {exam.shortName}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
              <span>Conducted by {exam.conductingBody}</span>
              {exam.officialWebsite && (
                <>
                  <span>•</span>
                  <a
                    href={exam.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    <span>Official Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsEditingMeta(!isEditingMeta)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
            <span>{isEditingMeta ? 'Cancel Edit' : 'Edit Exam Details'}</span>
          </button>
        </div>
      </div>

      {/* Edit Meta Dropdown / Panel */}
      {isEditingMeta && (
        <form onSubmit={handleSaveMeta} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-indigo-200 dark:border-indigo-900/60 shadow-xs space-y-3 animate-in slide-in-from-top-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Edit Examination Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                Exam Title
              </label>
              <input
                type="text"
                value={metaName}
                onChange={(e) => setMetaName(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                Target Exam Date
              </label>
              <input
                type="date"
                value={metaTargetDate}
                onChange={(e) => setMetaTargetDate(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                Conducting Body
              </label>
              <input
                type="text"
                value={metaConductingBody}
                onChange={(e) => setMetaConductingBody(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                Registration Start Date
              </label>
              <input
                type="date"
                value={metaRegStart}
                onChange={(e) => setMetaRegStart(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                Registration End Date
              </label>
              <input
                type="date"
                value={metaRegEnd}
                onChange={(e) => setMetaRegEnd(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                Official Website Link
              </label>
              <input
                type="url"
                value={metaWebsite}
                onChange={(e) => setMetaWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditingMeta(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
            >
              Save Details
            </button>
          </div>
        </form>
      )}

      {/* Prominent Live Countdown Card inside individual exam */}
      <ExamCountdown
        targetDateStr={exam.targetExamDate}
        label={`${exam.shortName} D-Day`}
        size="lg"
      />

      {/* Primary Navigation Tabs: Syllabus Spreadsheet | Exam Phases | Books | Pattern | Strategy */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-2 overflow-x-auto pb-1" aria-label="Tabs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('syllabus-table');
              Sound.click(soundEnabled);
            }}
            className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'syllabus-table'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Syllabus Spreadsheet (Excel)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('phases');
              Sound.click(soundEnabled);
            }}
            className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'phases'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Exam Phases (Prelims / Mains / Interview)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('books');
              Sound.click(soundEnabled);
            }}
            className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'books'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Books Followed ({exam.books.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('pattern');
              Sound.click(soundEnabled);
            }}
            className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pattern'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pattern &amp; Marking</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('strategy');
              Sound.click(soundEnabled);
            }}
            className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'strategy'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Strategy &amp; Notes</span>
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EDITABLE SPREADSHEET SYLLABUS TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'syllabus-table' && (
        <div className="space-y-4">
          <EditableSyllabusTable
            exam={exam}
            onUpdateExam={onUpdateExam}
            soundEnabled={soundEnabled}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DISTINCT EXAMINATION PHASES (Prelims / Mains / Interview) */}
      {/* ========================================================================= */}
      {activeTab === 'phases' && (
        <div className="space-y-6">
          <ExamPhasesView
            exam={exam}
            onSelectPhaseInSpreadsheet={() => {
              setActiveTab('syllabus-table');
            }}
          />
        </div>
      )}



      {/* ========================================================================= */}
      {/* TAB 2: BOOKS SECTION */}
      {/* ========================================================================= */}
      {activeTab === 'books' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Books & Reference Materials Followed
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Organized consistently by examination subjects. Track your reading progress and revisions.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddBook()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Book Followed</span>
            </button>
          </div>

          {/* Grouped by consistent subjects */}
          <div className="space-y-6">
            {exam.subjects.map((subject) => {
              const subjectBooks = exam.books.filter((b) => b.subjectId === subject.id);

              return (
                <div
                  key={subject.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {subject.code || 'SUBJECT'}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {subject.name}
                      </h4>
                      <span className="text-xs text-gray-400 font-medium">
                        ({subjectBooks.length} {subjectBooks.length === 1 ? 'book' : 'books'})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddBook(subject.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Book for this Subject</span>
                    </button>
                  </div>

                  {subjectBooks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-gray-50/60 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-700 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No books added yet for <strong>{subject.name}</strong>. Click the "+" button above to add a book you are following.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {subjectBooks.map((book) => {
                        const hasPages = book.currentPage !== undefined && book.totalPages !== undefined;
                        const pagePct = hasPages && book.totalPages! > 0
                          ? Math.min(100, Math.round((book.currentPage! / book.totalPages!) * 100))
                          : 0;

                        const statusBadge = {
                          to_read: { label: 'To Read', bg: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
                          reading: { label: 'Reading', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold' },
                          completed: { label: 'Completed', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold' },
                          revision: { label: 'Revision', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold' },
                        }[book.status];

                        return (
                          <div
                            key={book.id}
                            className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-400/50 dark:hover:border-indigo-500/50 bg-white dark:bg-gray-800/40 flex flex-col justify-between transition-all"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${statusBadge.bg}`}>
                                  {statusBadge.label}
                                </span>
                                <div className="flex items-center gap-1">
                                  {book.link && (
                                    <a
                                      href={book.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-gray-400 hover:text-indigo-600"
                                      title="Open book link"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleEditBook(book)}
                                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                                    title="Edit book"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBook(book.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                                    title="Remove book"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                                {book.title}
                              </h5>
                              {book.author && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  by {book.author}
                                </p>
                              )}
                              {book.notes && (
                                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/80 italic line-clamp-2">
                                  "{book.notes}"
                                </p>
                              )}
                            </div>

                            {hasPages && (
                              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                                  <span>Progress: {book.currentPage} / {book.totalPages} pages</span>
                                  <span className="font-bold text-gray-900 dark:text-white">{pagePct}%</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-600 h-1.5 rounded-full"
                                    style={{ width: `${pagePct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PATTERN & STAGES */}
      {/* ========================================================================= */}
      {activeTab === 'pattern' && (
        <div className="space-y-6">
          {/* Examination Pattern Summary */}
          {exam.pattern && (
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Exam Pattern & Marking Scheme</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Exam Mode
                  </span>
                  <strong className="text-gray-900 dark:text-white font-semibold mt-1 block">
                    {exam.pattern.mode}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Total Duration
                  </span>
                  <strong className="text-gray-900 dark:text-white font-semibold mt-1 block">
                    {exam.pattern.totalDuration}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Total Marks
                  </span>
                  <strong className="text-gray-900 dark:text-white font-semibold mt-1 block">
                    {exam.pattern.totalMarks}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Negative Marking
                  </span>
                  <strong className="text-gray-900 dark:text-white font-semibold mt-1 block">
                    {exam.pattern.negativeMarking}
                  </strong>
                </div>
              </div>

              {/* Pattern Sections if available */}
              {exam.pattern.sections && exam.pattern.sections.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Sectional Breakdown:
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-2.5 rounded-l-lg">Section</th>
                          <th className="p-2.5">Questions</th>
                          <th className="p-2.5">Marks</th>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5 rounded-r-lg">Negative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {exam.pattern.sections.map((sec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                            <td className="p-2.5 font-bold text-gray-900 dark:text-white">{sec.name}</td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-300">{sec.questions}</td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-300">{sec.marks}</td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-300">
                              {sec.durationMinutes ? `${sec.durationMinutes} mins` : '-'}
                            </td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-300">
                              {sec.negativeMarking || 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Examination Stages Timeline */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Examination Stages & Milestones
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Registration, Prelims, Mains, Interview and key dates
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStageToEdit(null);
                  setIsStageModalOpen(true);
                  Sound.click(soundEnabled);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stage</span>
              </button>
            </div>

            <div className="space-y-3">
              {exam.stages.map((stage, idx) => {
                const isCompleted = stage.status === 'completed';
                const isOngoing = stage.status === 'ongoing';

                return (
                  <div
                    key={stage.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCompleted
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                        : isOngoing
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            {stage.name}
                          </h4>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              isCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                : isOngoing
                                ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {stage.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {stage.startDate && stage.endDate
                              ? `${stage.startDate} – ${stage.endDate}`
                              : stage.date || 'TBD'}
                          </span>
                        </div>
                        {stage.notes && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 italic">
                            {stage.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {stage.date && !isCompleted && (
                        <ExamCountdown
                          targetDateStr={stage.date}
                          label={stage.name}
                          size="sm"
                          showSeconds={false}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setStageToEdit(stage);
                          setIsStageModalOpen(true);
                          Sound.click(soundEnabled);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                        title="Edit stage"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Delete stage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STRATEGY & NOTES */}
      {/* ========================================================================= */}
      {activeTab === 'strategy' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Preparation Strategy & Personal Study Log
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Write notes on study schedules, answer writing tips, revision cycles, and mock test scores.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveStrategy}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isStrategySaved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              <span>{isStrategySaved ? 'Notes Saved!' : 'Save Notes'}</span>
            </button>
          </div>

          <textarea
            rows={14}
            value={strategyText}
            onChange={(e) => setStrategyText(e.target.value)}
            placeholder="Type your study plan here:&#10;- Daily routine: 6 hours core syllabus + 1 hour current affairs&#10;- Weekly Sunday: 1 full-length GS mock test & analysis&#10;- Monthly revision cycle..."
            className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
          />
        </div>
      )}

      {/* Modals */}
      <BookModal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        subjects={exam.subjects}
        defaultSubjectId={defaultBookSubjectId}
        bookToEdit={bookToEdit}
        onSaveBook={handleSaveBook}
      />

      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        subjectToEdit={subjectToEdit}
        onSaveSubject={handleSaveSubject}
      />

      <StageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        stageToEdit={stageToEdit}
        onSaveStage={handleSaveStage}
      />
    </div>
  );
};
