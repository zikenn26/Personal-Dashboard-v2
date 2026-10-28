import React, { useState, useEffect } from 'react';
import { X, BookOpen, Check } from 'lucide-react';
import { ExamSubject, SyllabusTopic } from '../../types';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectToEdit?: ExamSubject | null;
  onSaveSubject: (subject: ExamSubject) => void;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  subjectToEdit,
  onSaveSubject,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [rawTopicsText, setRawTopicsText] = useState('');

  useEffect(() => {
    if (subjectToEdit) {
      setName(subjectToEdit.name);
      setCode(subjectToEdit.code || '');
      setDescription(subjectToEdit.description || '');
      setRawTopicsText(subjectToEdit.topics.map((t) => t.title).join('\n'));
    } else {
      setName('');
      setCode('');
      setDescription('');
      setRawTopicsText('');
    }
  }, [subjectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Parse topics from raw text lines if provided
    let updatedTopics: SyllabusTopic[] = subjectToEdit ? [...subjectToEdit.topics] : [];

    if (rawTopicsText.trim()) {
      const lines = rawTopicsText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));

      if (lines.length > 0) {
        // Build topics preserving existing completion state where title matches
        updatedTopics = lines.map((title, idx) => {
          const existing = updatedTopics.find((t) => t.title.toLowerCase() === title.toLowerCase());
          return {
            id: existing ? existing.id : `top-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            title,
            completed: existing ? existing.completed : false,
          };
        });
      }
    }

    if (updatedTopics.length === 0) {
      updatedTopics.push({
        id: `top-${Date.now()}-1`,
        title: 'Fundamental concepts and introductory syllabus',
        completed: false,
      });
    }

    const subjectData: ExamSubject = {
      id: subjectToEdit ? subjectToEdit.id : `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      topics: updatedTopics,
    };

    onSaveSubject(subjectData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              📑
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {subjectToEdit ? 'Edit Subject & Topics' : 'Add New Subject'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Define the subject title, short code, and syllabus topics
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
        <form id="subject-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Modern Indian History"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Code / Pill
              </label>
              <input
                type="text"
                placeholder="e.g. GS-1"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Description / Weightage
            </label>
            <input
              type="text"
              placeholder="e.g. 250 Marks Mains Descriptive Paper, high conceptual depth"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Syllabus Topics (One per line)
              </label>
              <span className="text-[10px] text-gray-400">Paste bullet points or official syllabus</span>
            </div>
            <textarea
              rows={8}
              placeholder="Topic 1: Early Vedic Period & Archeology&#10;Topic 2: Mauryan Administration and Ashoka&#10;Topic 3: Gupta Empire and Golden Age..."
              value={rawTopicsText}
              onChange={(e) => setRawTopicsText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-mono text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
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
            form="subject-form"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{subjectToEdit ? 'Update Subject' : 'Create Subject'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
