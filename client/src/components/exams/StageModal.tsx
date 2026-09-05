import React, { useState, useEffect } from 'react';
import { X, Calendar, Check } from 'lucide-react';
import { ExamStage, ExamStageStatus } from '../../types';

interface StageModalProps {
  isOpen: boolean;
  onClose: () => void;
  stageToEdit?: ExamStage | null;
  onSaveStage: (stage: ExamStage) => void;
}

export const StageModal: React.FC<StageModalProps> = ({
  isOpen,
  onClose,
  stageToEdit,
  onSaveStage,
}) => {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ExamStageStatus>('upcoming');
  const [isRange, setIsRange] = useState(false);
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (stageToEdit) {
      setName(stageToEdit.name);
      setStatus(stageToEdit.status);
      setDate(stageToEdit.date || '');
      setStartDate(stageToEdit.startDate || '');
      setEndDate(stageToEdit.endDate || '');
      setIsRange(Boolean(stageToEdit.startDate || stageToEdit.endDate));
      setNotes(stageToEdit.notes || '');
    } else {
      setName('');
      setStatus('upcoming');
      setDate('');
      setStartDate('');
      setEndDate('');
      setIsRange(false);
      setNotes('');
    }
  }, [stageToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const stageData: ExamStage = {
      id: stageToEdit ? stageToEdit.id : `stg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      status,
      date: !isRange ? date || undefined : undefined,
      startDate: isRange ? startDate || undefined : undefined,
      endDate: isRange ? endDate || undefined : undefined,
      notes: notes.trim() || undefined,
    };

    onSaveStage(stageData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              🗓️
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {stageToEdit ? 'Edit Exam Stage' : 'Add Examination Stage'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure milestone dates, registration, and status
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
        <form id="stage-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Stage Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Preliminary Examination, Admit Card, Mains"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ExamStageStatus)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Active / Ongoing</option>
              <option value="completed">Completed / Past</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Date Format
              </label>
              <button
                type="button"
                onClick={() => setIsRange(!isRange)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                {isRange ? 'Switch to Single Date' : 'Switch to Date Window (Range)'}
              </button>
            </div>

            {!isRange ? (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block mb-0.5">End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Instructions / Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Cutoff, reporting time, admit card link, required documents..."
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
            form="stage-form"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{stageToEdit ? 'Save Changes' : 'Add Stage'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
