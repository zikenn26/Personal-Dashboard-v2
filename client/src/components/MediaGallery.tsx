import React, { useState } from 'react';
import {
  Film,
  Plus,
  Star,
  Trash2,
  Tv,
  Book,
  Gamepad2,
  CheckCircle2,
  Clock,
  Bookmark,
} from 'lucide-react';
import { MediaItem } from '../types';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';

interface MediaGalleryProps {
  media: MediaItem[];
  initialFilterType?: string;
  onAddMedia: (item: Omit<MediaItem, 'id'>) => void;
  onUpdateRating: (id: string, rating: number) => void;
  onDeleteMedia: (id: string) => void;
  soundEnabled: boolean;
}

const TYPE_ICONS: Record<MediaItem['type'], React.ReactNode> = {
  movie: <Film className="w-3.5 h-3.5" />,
  series: <Tv className="w-3.5 h-3.5" />,
  book: <Book className="w-3.5 h-3.5" />,
  game: <Gamepad2 className="w-3.5 h-3.5" />,
};

const TYPE_INITIALS: Record<MediaItem['type'], string> = {
  movie: 'M',
  series: 'S',
  book: 'B',
  game: 'G',
};

const SAMPLE_COVERS = [
  STOCK_IMAGES.workspaceCover,
  STOCK_IMAGES.mountainsCover,
  STOCK_IMAGES.bambooGardenCover,
  STOCK_IMAGES.architectureCover,
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&auto=format&fit=crop&q=80',
];

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  media,
  initialFilterType = 'all',
  onAddMedia,
  onUpdateRating,
  onDeleteMedia,
  soundEnabled,
}) => {
  const [filterType, setFilterType] = useState<string>(initialFilterType);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync with prop when navigating specifically to 'book' or 'movie'
  React.useEffect(() => {
    if (initialFilterType) {
      setFilterType(initialFilterType);
    }
  }, [initialFilterType]);

  // New Media Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCreator, setNewCreator] = useState('');
  const [newType, setNewType] = useState<MediaItem['type']>('movie');
  const [newRating, setNewRating] = useState<number>(5);
  const [newStatus, setNewStatus] = useState<MediaItem['status']>('completed');
  const [newCoverUrl, setNewCoverUrl] = useState(SAMPLE_COVERS[0]);
  const [newGenres, setNewGenres] = useState('Sci-Fi, Drama');
  const [newNotes, setNewNotes] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    Sound.success(soundEnabled);
    onAddMedia({
      title: newTitle.trim(),
      creator: newCreator.trim() || 'Unknown',
      type: newType,
      rating: newRating,
      status: newStatus,
      coverUrl: newCoverUrl || SAMPLE_COVERS[0],
      genres: newGenres.split(',').map((g) => g.trim()).filter(Boolean),
      reviewNotes: newNotes.trim() || undefined,
    });

    setNewTitle('');
    setNewCreator('');
    setNewNotes('');
    setShowAddModal(false);
  };

  const filteredMedia = media.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors notion-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
            <Film className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#111827] dark:text-white">
              Media & Cinema Lounge
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
              Curated films, books, games, and ratings
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            Sound.click(soundEnabled);
            setShowAddModal(true);
          }}
          className="px-2.5 py-1 text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Media</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Media' },
            { id: 'movie', label: 'Movies' },
            { id: 'series', label: 'Series' },
            { id: 'book', label: 'Books' },
            { id: 'game', label: 'Games' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                Sound.click(soundEnabled);
                setFilterType(tab.id);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                filterType === tab.id
                  ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827] shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs font-medium">
          {['all', 'completed', 'in-progress', 'wishlist'].map((st) => (
            <button
              key={st}
              onClick={() => {
                Sound.click(soundEnabled);
                setFilterStatus(st);
              }}
              className={`px-2 py-0.5 rounded-md capitalize transition-colors cursor-pointer text-xs ${
                filterStatus === st
                  ? 'bg-[#EEF2FF] text-[#6366F1] dark:bg-[#1E1B4B] dark:text-[#818CF8] font-semibold'
                  : 'text-[#9CA3AF] hover:text-[#111827] dark:hover:text-neutral-300'
              }`}
            >
              {st === 'all' ? 'Any' : st.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Media Entries - List Format Only */}
      <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
        {filteredMedia.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#9CA3AF] space-y-2 border-2 border-dashed border-[#E5E7EB] dark:border-[#1F2937] rounded-xl">
            <Film className="w-8 h-8 mx-auto opacity-30 text-indigo-500" />
            <p className="font-semibold text-[#37352F] dark:text-white">No items in this collection yet.</p>
            <p className="text-[11px] text-[#9CA3AF]">Add your favorite books, movies, games, or shows.</p>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setShowAddModal(true);
              }}
              className="text-xs font-semibold text-[#6366F1] dark:text-[#818CF8] hover:underline cursor-pointer inline-block pt-1"
            >
              + Add {filterType === 'book' ? 'a Book' : filterType === 'movie' ? 'a Movie' : 'an Item'}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB]/60 dark:bg-[#1F2937]/30 divide-y divide-[#E5E7EB] dark:divide-[#374151] overflow-hidden">
            {filteredMedia.map((item) => (
              <div
                key={item.id}
                className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white dark:hover:bg-[#1F2937] transition-all group"
              >
                {/* Left: Cover Thumbnail & Item Metadata */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-indigo-50 dark:bg-indigo-950/40 shrink-0 border border-indigo-100 dark:border-indigo-900 shadow-2xs flex items-center justify-center">
                    <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-300" aria-label={`${item.type} initial`}>
                      {TYPE_INITIALS[item.type]}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-[#111827] dark:text-white truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] capitalize font-medium">
                        {item.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#9CA3AF] flex-wrap">
                      <span className="font-medium text-[#4B5563] dark:text-[#D1D5DB] truncate">
                        {item.creator}
                      </span>
                      {item.genres && item.genres.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] truncate">{item.genres.join(', ')}</span>
                        </>
                      )}
                    </div>

                    {item.reviewNotes && (
                      <p className="text-[11px] italic text-[#6B7280] dark:text-[#9CA3AF] truncate max-w-md">
                        &ldquo;{item.reviewNotes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Star Rating, Status Badge & Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                  {/* Interactive Star Rating */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onUpdateRating(item.id, star);
                        }}
                        className="text-neutral-300 dark:text-neutral-700 hover:text-amber-400 transition-colors cursor-pointer p-0.5"
                        title={`Rate ${star} star`}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            star <= item.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-neutral-300 dark:text-neutral-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold capitalize ${
                      item.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : item.status === 'in-progress'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {item.status === 'completed' ? 'Completed' : item.status.replace('-', ' ')}
                  </span>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onDeleteMedia(item.id);
                    }}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    title="Delete media item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Media Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-[#6366F1]" />
                <span>Add Film / Media Item</span>
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
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Interstellar, Clean Code"
                autoFocus
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Creator / Director
                </label>
                <input
                  type="text"
                  value={newCreator}
                  onChange={(e) => setNewCreator(e.target.value)}
                  placeholder="Director / Author"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Media Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as MediaItem['type'])}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                >
                  <option value="movie">Movie</option>
                  <option value="series">TV Series</option>
                  <option value="book">Book</option>
                  <option value="game">Video Game</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MediaItem['status'])}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                >
                  <option value="completed">Completed</option>
                  <option value="in-progress">In Progress</option>
                  <option value="wishlist">Wishlist / Watch Later</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Rating (1-5)
                </label>
                <select
                  value={newRating}
                  onChange={(e) => setNewRating(parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                >
                  <option value="5">★★★★★ (5/5)</option>
                  <option value="4">★★★★☆ (4/5)</option>
                  <option value="3">★★★☆☆ (3/5)</option>
                  <option value="2">★★☆☆☆ (2/5)</option>
                  <option value="1">★☆☆☆☆ (1/5)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Cover Image URL (or pick preset)
              </label>
              <input
                type="text"
                value={newCoverUrl}
                onChange={(e) => setNewCoverUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
              />
              <div className="flex gap-1.5 mt-1.5">
                {SAMPLE_COVERS.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Preset ${i}`}
                    onClick={() => setNewCoverUrl(url)}
                    className={`w-8 h-8 rounded object-cover cursor-pointer border ${
                      newCoverUrl === url ? 'border-[#6366F1] ring-1 ring-[#6366F1]' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
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
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Save Media
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
