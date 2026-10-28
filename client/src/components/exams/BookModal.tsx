import React, { useState, useEffect } from 'react';
import { X, Book, Plus, Check, ExternalLink } from 'lucide-react';
import { ExamBook, ExamSubject, ExamBookStatus } from '../../types';

interface BookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: ExamSubject[];
  defaultSubjectId?: string;
  bookToEdit?: ExamBook | null;
  onSaveBook: (book: ExamBook) => void;
}

export const BookModal: React.FC<BookModalProps> = ({
  isOpen,
  onClose,
  subjects,
  defaultSubjectId,
  bookToEdit,
  onSaveBook,
}) => {
  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<ExamBookStatus>('to_read');
  const [currentPage, setCurrentPage] = useState<string>('');
  const [totalPages, setTotalPages] = useState<string>('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | 'essential' | 'recommended'>('high');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (bookToEdit) {
      setSubjectId(bookToEdit.subjectId || defaultSubjectId || subjects[0]?.id || '');
      setTitle(bookToEdit.title || '');
      setAuthor(bookToEdit.author || '');
      setStatus(bookToEdit.status || 'to_read');
      setCurrentPage(bookToEdit.currentPage !== undefined ? String(bookToEdit.currentPage) : '');
      setTotalPages(bookToEdit.totalPages !== undefined ? String(bookToEdit.totalPages) : '');
      setPriority(bookToEdit.priority || 'high');
      setNotes(bookToEdit.notes || '');
      setLink(bookToEdit.link || '');
    } else {
      setSubjectId(defaultSubjectId || subjects[0]?.id || '');
      setTitle('');
      setAuthor('');
      setStatus('to_read');
      setCurrentPage('');
      setTotalPages('');
      setPriority('high');
      setNotes('');
      setLink('');
    }
  }, [isOpen, bookToEdit?.id]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;

    const bookData: ExamBook = {
      id: bookToEdit ? bookToEdit.id : `book-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      subjectId,
      title: title.trim(),
      author: author.trim() || undefined,
      status,
      currentPage: currentPage ? parseInt(currentPage, 10) : undefined,
      totalPages: totalPages ? parseInt(totalPages, 10) : undefined,
      priority,
      notes: notes.trim() || undefined,
      link: link.trim() || undefined,
    };

    onSaveBook(bookData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              📚
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {bookToEdit ? 'Edit Reference Book' : 'Add Book Followed'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track textbook progress, key chapters, and reading milestones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="book-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Associated Subject *
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code ? `[${sub.code}] ` : ''}{sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Book Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Indian Polity (6th/7th Edition)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Author / Publication
              </label>
              <input
                type="text"
                placeholder="e.g. M. Laxmikanth / McGraw Hill"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Reading Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExamBookStatus)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="to_read">To Read / Backlog</option>
                <option value="reading">Currently Reading</option>
                <option value="completed">Completed (1st Read)</option>
                <option value="revision">In Revision Phase</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Current Page
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 140"
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Total Pages
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 620"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="high">High (Must Read)</option>
                <option value="medium">Medium (Reference)</option>
                <option value="low">Low (Optional)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              PDF / Notes Link (Optional)
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/... or buy link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Personal Notes / Chapter Priority
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Focus on Part III (Fundamental Rights) and Part V (Union Judiciary)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="book-form"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{bookToEdit ? 'Save Changes' : 'Add to Books Followed'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
