import React, { useState } from 'react';
import {
  Heart,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  X,
  Smile,
  Activity,
  Compass,
  Check,
} from 'lucide-react';
import { HobbyItem } from '../types';
import { Sound } from '../utils/audio';

interface HobbiesSectionProps {
  hobbies: HobbyItem[];
  onUpdateHobbies: (hobbies: HobbyItem[]) => void;
  soundEnabled: boolean;
}

const PRESET_CATEGORIES = [
  'All',
  'Intellectual',
  'Tech & Gaming',
  'Sports & Fitness',
  'Creative',
  'Lifestyle',
];

const PRESET_HOBBIES_INSPIRATION = [
  { icon: '♟️', title: 'Chess & Strategy', category: 'Intellectual', level: 'Daily Passion', desc: 'Tactical analysis, blitz games, and endgame study.' },
  { icon: '💻', title: 'Open Source Coding', category: 'Tech & Gaming', level: 'Weekend Passion', desc: 'Building developer tools, UI templates, and exploring AI agents.' },
  { icon: '📚', title: 'Reading Non-Fiction', category: 'Intellectual', level: 'Daily Habit', desc: 'System architectures, psychology of focus, and software craftsmanship.' },
  { icon: '🚴', title: 'Cycling & Trekking', category: 'Sports & Fitness', level: 'Active Routine', desc: 'Weekend outdoor cycling routes, trail hiking, and endurance.' },
  { icon: '📷', title: 'Photography & Aesthetics', category: 'Creative', level: 'Creative Pursuit', desc: 'Architecture photography, street captures, and visual storytelling.' },
  { icon: '🎸', title: 'Music & Guitar', category: 'Creative', level: 'Leisure Activity', desc: 'Acoustic fingerstyle chord progressions and relaxing compositions.' },
  { icon: '✍️', title: 'Technical Blogging', category: 'Intellectual', level: 'Monthly Habit', desc: 'Writing insightful articles on frontend performance and clean code.' },
  { icon: '🎮', title: 'Strategy Video Games', category: 'Tech & Gaming', level: 'Weekend Leisure', desc: 'Real-time strategy, simulation, and puzzle games.' },
];

export const HobbiesSection: React.FC<HobbiesSectionProps> = ({
  hobbies,
  onUpdateHobbies,
  soundEnabled,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingHobby, setEditingHobby] = useState<HobbyItem | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Intellectual');
  const [formIcon, setFormIcon] = useState('♟️');
  const [formDescription, setFormDescription] = useState('');
  const [formPassionLevel, setFormPassionLevel] = useState('Daily Passion');

  const filteredHobbies = hobbies.filter((h) =>
    selectedCategory === 'All' ? true : h.category === selectedCategory
  );

  const openAddModal = (preset?: typeof PRESET_HOBBIES_INSPIRATION[0]) => {
    Sound.click(soundEnabled);
    setEditingHobby(null);
    if (preset) {
      setFormTitle(preset.title);
      setFormCategory(preset.category);
      setFormIcon(preset.icon);
      setFormDescription(preset.desc);
      setFormPassionLevel(preset.level);
    } else {
      setFormTitle('');
      setFormCategory('Intellectual');
      setFormIcon('✨');
      setFormDescription('');
      setFormPassionLevel('Daily Passion');
    }
    setShowModal(true);
  };

  const openEditModal = (h: HobbyItem) => {
    Sound.click(soundEnabled);
    setEditingHobby(h);
    setFormTitle(h.title);
    setFormCategory(h.category);
    setFormIcon(h.icon || '✨');
    setFormDescription(h.description);
    setFormPassionLevel(h.passionLevel || 'Daily Passion');
    setShowModal(true);
  };

  const handleDeleteHobby = (id: string) => {
    Sound.click(soundEnabled);
    const updated = hobbies.filter((h) => h.id !== id);
    onUpdateHobbies(updated);
  };

  const handleSaveHobby = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    Sound.success(soundEnabled);

    if (editingHobby) {
      const updated = hobbies.map((h) =>
        h.id === editingHobby.id
          ? {
              ...h,
              title: formTitle.trim(),
              category: formCategory,
              icon: formIcon.trim() || '✨',
              description: formDescription.trim(),
              passionLevel: formPassionLevel.trim() || undefined,
            }
          : h
      );
      onUpdateHobbies(updated);
    } else {
      const newHobby: HobbyItem = {
        id: `hob-${Date.now()}`,
        title: formTitle.trim(),
        category: formCategory,
        icon: formIcon.trim() || '✨',
        description: formDescription.trim(),
        passionLevel: formPassionLevel.trim() || undefined,
      };
      onUpdateHobbies([...hobbies, newHobby]);
    }

    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDECE9] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="workspace-heading font-black text-[#111827] dark:text-white flex items-center gap-2.5">
              <Heart className="w-6 h-6 text-rose-500" />
              <span>Hobbies &amp; Personal Interests</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
              {hobbies.length} Interests
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Personal passions, intellectual pursuits, sports, and creative hobbies that round out your professional and personal identity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openAddModal()}
          className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Hobby</span>
        </button>
      </div>

      {/* Category Pills Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setSelectedCategory(cat);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-xs'
                : 'bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Grid of Hobbies */}
      {filteredHobbies.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-dashed border-[#E2E8F0] dark:border-[#334155] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto text-2xl">
            ✨
          </div>
          <h3 className="text-base font-bold text-[#111827] dark:text-white">
            No Hobbies in this Category
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
            Choose from popular presets below or click "+ Add Hobby" to showcase your personal passions.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {PRESET_HOBBIES_INSPIRATION.slice(0, 4).map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => openAddModal(preset)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-xs font-semibold text-[#374151] dark:text-[#CBD5E1] hover:border-[#6366F1] flex items-center gap-1.5 cursor-pointer"
              >
                <span>{preset.icon}</span>
                <span>{preset.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHobbies.map((hobby) => (
            <div
              key={hobby.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs hover:border-[#6366F1] dark:hover:border-[#6366F1] transition-all space-y-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{hobby.icon || '✨'}</span>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827] dark:text-white group-hover:text-[#6366F1] transition-colors">
                      {hobby.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1] dark:text-[#818CF8]">
                        {hobby.category}
                      </span>
                      {hobby.passionLevel && (
                        <>
                          <span className="text-[#9CA3AF] text-[10px]">•</span>
                          <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium">
                            {hobby.passionLevel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEditModal(hobby)}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteHobby(hobby.id)}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {hobby.description && (
                <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                  {hobby.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Hobby Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-[#334155]">
              <h3 className="text-base font-black text-[#111827] dark:text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                <span>{editingHobby ? 'Edit Hobby / Passion' : 'Add New Hobby'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHobby} className="space-y-4">
              {/* Emoji Icon & Title */}
              <div className="grid grid-cols-[60px_1fr] gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="♟️"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full px-2 py-2.5 text-center text-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Hobby / Interest Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chess & Strategy / Open Source Coding"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Category & Passion Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden"
                  >
                    <option value="Intellectual">Intellectual</option>
                    <option value="Tech & Gaming">Tech &amp; Gaming</option>
                    <option value="Sports & Fitness">Sports &amp; Fitness</option>
                    <option value="Creative">Creative</option>
                    <option value="Lifestyle">Lifestyle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Passion Frequency
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Daily Habit / Weekend Passion"
                    value={formPassionLevel}
                    onChange={(e) => setFormPassionLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Description / Personal Passion Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Tactical analysis, competitive matches, and daily puzzle solving."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {editingHobby ? 'Save Changes' : 'Add Hobby'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
