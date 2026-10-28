import React, { useState } from 'react';
import {
  Award,
  PenTool,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { AchievementItem, DoodleItem } from '../types';
import { DoodleCanvas } from './DoodleCanvas';
import { Sound } from '../utils/audio';

interface AchievementsWallProps {
  achievements: AchievementItem[];
  doodles: DoodleItem[];
  onAddAchievement: (item: Omit<AchievementItem, 'id'>) => void;
  onDeleteAchievement: (id: string) => void;
  onSaveDoodle: (title: string, dataUrl: string) => void;
  onDeleteDoodle: (id: string) => void;
  soundEnabled: boolean;
}

export const AchievementsWall: React.FC<AchievementsWallProps> = ({
  achievements,
  doodles,
  onAddAchievement,
  onDeleteAchievement,
  onSaveDoodle,
  onDeleteDoodle,
  soundEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'certificates' | 'doodle'>('certificates');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newIssuer, setNewIssuer] = useState('');
  const [newDate, setNewDate] = useState('2026');
  const [newCategory, setNewCategory] = useState<AchievementItem['category']>('Certification');
  const [newBadgeIcon, setNewBadgeIcon] = useState('🏆');
  const [newDescription, setNewDescription] = useState('');
  const [newCredUrl, setNewCredUrl] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    Sound.success(soundEnabled);
    onAddAchievement({
      title: newTitle.trim(),
      issuer: newIssuer.trim() || 'Verified Organization',
      date: newDate,
      category: newCategory,
      badgeIcon: newBadgeIcon,
      description: newDescription.trim(),
      credentialUrl: newCredUrl.trim() || undefined,
    });

    setNewTitle('');
    setNewIssuer('');
    setNewDescription('');
    setNewCredUrl('');
    setShowAddModal(false);
  };

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors notion-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            {activeTab === 'certificates' ? <Award className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#111827] dark:text-white">
              Achievements & Doodle Wall
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
              Verified milestones, certificates, and freeform sketches
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-[#F9FAFB] dark:bg-[#1F2937] p-0.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151] text-xs">
          <button
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveTab('certificates');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'certificates'
                ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-neutral-200'
            }`}
          >
            Certificates
          </button>
          <button
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveTab('doodle');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'doodle'
                ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-neutral-200'
            }`}
          >
            Sketchpad
          </button>
        </div>
      </div>

      {activeTab === 'certificates' ? (
        /* Certificates & Accolades Gallery */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
              Verified Credentials ({achievements.length})
            </span>
            <button
              onClick={() => {
                Sound.click(soundEnabled);
                setShowAddModal(true);
              }}
              className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Plus className="w-3 h-3" />
              <span>Add Credential</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className="p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#1F2937]/50 hover:border-[#D1D5DB] dark:hover:border-[#4B5563] transition-all flex flex-col justify-between group space-y-2"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{ach.badgeIcon}</span>
                      <div>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8]">
                          {ach.category}
                        </span>
                        <h4 className="text-xs font-bold text-[#111827] dark:text-white mt-1 leading-snug">
                          {ach.title}
                        </h4>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        Sound.click(soundEnabled);
                        onDeleteAchievement(ach.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 rounded transition-opacity cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed pt-1">
                    {ach.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] dark:border-[#374151] text-[10px] text-[#9CA3AF] font-mono">
                  <span>{ach.issuer} • {ach.date}</span>

                  {ach.credentialUrl && (
                    <a
                      href={ach.credentialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6366F1] dark:text-[#818CF8] hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <span>Verify</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Doodle Sketchpad */
        <DoodleCanvas
          doodles={doodles}
          onSaveDoodle={onSaveDoodle}
          onDeleteDoodle={onDeleteDoodle}
          soundEnabled={soundEnabled}
        />
      )}

      {/* Add Achievement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Add Certificate or Award</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Achievement Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. AWS Certified Solutions Architect"
                autoFocus
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Issuer / Org
                </label>
                <input
                  type="text"
                  value={newIssuer}
                  onChange={(e) => setNewIssuer(e.target.value)}
                  placeholder="AWS, CNCF, ETHGlobal"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Year / Date
                </label>
                <input
                  type="text"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder="2026"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as AchievementItem['category'])}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                >
                  <option value="Certification">Certification</option>
                  <option value="Award">Award</option>
                  <option value="Hackathon">Hackathon</option>
                  <option value="Publication">Publication</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Badge Emoji
                </label>
                <div className="flex gap-1">
                  {['🏆', '☁️', '⚓', '📜', '🥇', '🌟'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewBadgeIcon(em)}
                      className={`p-1 rounded text-xs ${
                        newBadgeIcon === em ? 'bg-amber-100 dark:bg-amber-900/50 scale-110' : 'hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Short Description
              </label>
              <textarea
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What was achieved?"
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Credential Verification URL (Optional)
              </label>
              <input
                type="text"
                value={newCredUrl}
                onChange={(e) => setNewCredUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Save Achievement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
