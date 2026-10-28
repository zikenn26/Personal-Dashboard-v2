import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Check, X, RefreshCw, Link as LinkIcon, Trash2, HardDrive } from 'lucide-react';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';

export interface StockCoverItem {
  id: string;
  name: string;
  url: string;
  category: 'workspace' | 'nature' | 'architecture' | 'aesthetic' | 'village';
  tag: string;
  isLocal?: boolean;
}

export const CURATED_STOCK_COVERS: StockCoverItem[] = [
  {
    id: 'local-cov-workspace',
    name: 'Minimalist Workspace & Laptop',
    url: STOCK_IMAGES.workspaceCover,
    category: 'workspace',
    tag: 'Local Stock • Workspace',
    isLocal: true,
  },
  {
    id: 'local-cov-mountains',
    name: 'Serene Alpine Mountain Dawn',
    url: STOCK_IMAGES.mountainsCover,
    category: 'nature',
    tag: 'Local Stock • Nature',
    isLocal: true,
  },
  {
    id: 'local-cov-bamboo',
    name: 'Zen Japanese Bamboo Grove',
    url: STOCK_IMAGES.bambooGardenCover,
    category: 'nature',
    tag: 'Local Stock • Zen',
    isLocal: true,
  },
  {
    id: 'local-cov-arch',
    name: 'Clean Travertine Architecture',
    url: STOCK_IMAGES.architectureCover,
    category: 'architecture',
    tag: 'Local Stock • Architecture',
    isLocal: true,
  },
  {
    id: 'cov-village-1',
    name: 'Lush Farmland & Village Meadow',
    url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2000&q=80',
    category: 'village',
    tag: 'Farmland Village',
  },
  {
    id: 'cov-village-2',
    name: 'Rustic Farmhouse & Golden Fields',
    url: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=2000&q=80',
    category: 'village',
    tag: 'Countryside',
  },
  {
    id: 'cov-workspace-1',
    name: 'Modern Minimalist Developer Desk',
    url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=2000&q=80',
    category: 'workspace',
    tag: 'Workspace',
  },
  {
    id: 'cov-workspace-2',
    name: 'Cozy Coffee & Notebook Setup',
    url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=2000&q=80',
    category: 'workspace',
    tag: 'Study & Coffee',
  },
  {
    id: 'cov-arch-1',
    name: 'Architectural Ribbon Waves',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80',
    category: 'architecture',
    tag: 'Minimalism',
  },
  {
    id: 'cov-nature-1',
    name: 'Alpine Sunrise & Morning Fog',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80',
    category: 'nature',
    tag: 'Mountains',
  },
  {
    id: 'cov-aesthetic-1',
    name: 'Cyberpunk Neon Horizon Gradient',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2000&q=80',
    category: 'aesthetic',
    tag: 'Neon Vibe',
  },
  {
    id: 'cov-aesthetic-2',
    name: 'Starry Cosmic Constellations',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=80',
    category: 'aesthetic',
    tag: 'Night Sky',
  },
];

const RANDOM_UNSPLASH_TOPICS = [
  'farmland,nature',
  'minimalist,architecture',
  'desk,workspace',
  'mountains,fog',
  'forest,greenery',
  'library,books',
  'japan,temple',
];

interface CoverPickerModalProps {
  isOpen: boolean;
  currentCoverUrl: string;
  onSelectCover: (url: string) => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const CoverPickerModal: React.FC<CoverPickerModalProps> = ({
  isOpen,
  currentCoverUrl,
  onSelectCover,
  onClose,
  soundEnabled,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [previewCustomUrl, setPreviewCustomUrl] = useState('');

  if (!isOpen) return null;

  const filteredCovers = CURATED_STOCK_COVERS.filter(
    (c) => selectedCategory === 'all' || c.category === selectedCategory
  );

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const urlToApply = (customUrlInput.trim() || previewCustomUrl.trim());
    if (!urlToApply) return;
    Sound.success(soundEnabled);
    onSelectCover(urlToApply);
    onClose();
  };

  const handlePickRandom = () => {
    Sound.click(soundEnabled);
    const randomTopic = RANDOM_UNSPLASH_TOPICS[Math.floor(Math.random() * RANDOM_UNSPLASH_TOPICS.length)];
    const randomUrl = `https://images.unsplash.com/photo-${Date.now()}?auto=format&fit=crop&w=2000&q=80&sig=${Math.floor(Math.random() * 1000)}`;
    // Select from stock pool or generate dynamic url
    const randomStock = CURATED_STOCK_COVERS[Math.floor(Math.random() * CURATED_STOCK_COVERS.length)];
    onSelectCover(randomStock.url);
    onClose();
  };

  const handleResetDefault = () => {
    Sound.click(soundEnabled);
    onSelectCover(CURATED_STOCK_COVERS[0].url);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        id="cover-picker-modal"
        className="w-full max-w-2xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EDECE9] dark:border-[#1F2937] flex items-center justify-between bg-[#FAF9F6] dark:bg-[#1F2937]/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8]">
              <ImageIcon className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#37352F] dark:text-white">
                Change Workspace Cover
              </h3>
              <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF]">
                Select from curated stock covers or paste any custom image URL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#EDECE9] dark:hover:bg-[#374151] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Covers' },
              { id: 'village', label: '🌾 Farmland & Village' },
              { id: 'workspace', label: '💻 Workspace & Desk' },
              { id: 'architecture', label: '🏛️ Architecture' },
              { id: 'nature', label: '🌿 Nature & Zen' },
              { id: 'aesthetic', label: '🌌 Aesthetic & Neon' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setSelectedCategory(cat.id);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#6366F1] text-white shadow-2xs'
                    : 'bg-[#F7F7F5] dark:bg-[#1F2937] text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#EDECE9] dark:hover:bg-[#374151]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Curated Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredCovers.map((cover) => {
              const isSelected = currentCoverUrl === cover.url;
              return (
                <button
                  key={cover.id}
                  type="button"
                  onClick={() => {
                    Sound.success(soundEnabled);
                    onSelectCover(cover.url);
                    onClose();
                  }}
                  className={`group relative aspect-16/10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer text-left shadow-2xs hover:scale-[1.02] ${
                    isSelected
                      ? 'border-[#6366F1] ring-2 ring-[#6366F1]/30'
                      : 'border-[#EDECE9] dark:border-[#374151] hover:border-[#6366F1]'
                  }`}
                >
                  {cover.url ? (
                    <img
                      src={cover.url}
                      alt={cover.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

                  {/* Tag */}
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-medium text-white">
                    {cover.tag}
                  </span>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#6366F1] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3" />
                    </span>
                  )}

                  {/* Title */}
                  <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate drop-shadow-xs">
                    {cover.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom URL Input Bar */}
          <div className="pt-3 border-t border-[#EDECE9] dark:border-[#1F2937] space-y-2">
            <label className="text-[11px] font-bold text-[#787774] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Or Paste Custom Image Link</span>
            </label>
            <form onSubmit={handleApplyCustom} className="flex items-center gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => {
                  setCustomUrlInput(e.target.value);
                  setPreviewCustomUrl(e.target.value);
                }}
                placeholder="https://images.unsplash.com/photo-..."
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[#37352F] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
              <button
                type="submit"
                disabled={!customUrlInput.trim()}
                className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
              >
                Apply URL
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#EDECE9] dark:border-[#1F2937] bg-[#FAF9F6] dark:bg-[#1F2937]/50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePickRandom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#374151] text-xs font-semibold text-[#37352F] dark:text-white hover:border-[#6366F1] transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Shuffle Random</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#374151] text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] hover:text-rose-500 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] hover:bg-[#EDECE9] dark:hover:bg-[#374151] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
