import React, { useState, useMemo } from 'react';
import { Film, Book, Gamepad2, Tv, Plus, Star, Trash2, Check, Sparkles } from 'lucide-react';
import { MediaItem } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { useLongPress } from '../../gestures/useLongPress';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';
import { BottomSheet } from '../../gestures/BottomSheet';

export interface AndroidLibraryScreenProps {
  media: MediaItem[];
  onAddMedia?: (item: Omit<MediaItem, 'id'>) => void;
  onUpdateRating?: (id: string, rating: number) => void;
  onDeleteMedia?: (id: string) => void;
}

type MediaTypeFilter = 'all' | 'book' | 'movie' | 'series' | 'game';

export const AndroidLibraryScreen: React.FC<AndroidLibraryScreenProps> = ({
  media,
  onAddMedia,
  onUpdateRating,
  onDeleteMedia,
}) => {
  const [filterType, setFilterType] = useState<MediaTypeFilter>('all');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activeActionMedia, setActiveActionMedia] = useState<MediaItem | null>(null);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newCreator, setNewCreator] = useState('');
  const [newType, setNewType] = useState<'book' | 'movie' | 'series' | 'game'>('book');
  const [newStatus, setNewStatus] = useState<'completed' | 'in-progress' | 'wishlist'>('completed');
  const [newRating, setNewRating] = useState(5);

  const filteredMedia = useMemo(() => {
    if (filterType === 'all') return media;
    return media.filter((m) => m.type === filterType);
  }, [media, filterType]);

  const handleRate = (id: string, rating: number) => {
    void nativeService.triggerHaptic('selection');
    if (onUpdateRating) onUpdateRating(id, rating);
  };

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteMedia) onDeleteMedia(id);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !onAddMedia) return;
    void nativeService.triggerHaptic('success');
    onAddMedia({
      title: newTitle.trim(),
      creator: newCreator.trim() || 'Unknown',
      type: newType,
      rating: newRating,
      status: newStatus,
      coverUrl: '',
      genres: [],
    });
    setNewTitle('');
    setNewCreator('');
    setIsAddSheetOpen(false);
  };

  const actionItems: ActionSheetItem[] = activeActionMedia
    ? [
        {
          label: 'Delete from Library',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => handleDelete(activeActionMedia.id),
        },
      ]
    : [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'book':
        return <Book className="w-4 h-4 text-emerald-500" />;
      case 'movie':
        return <Film className="w-4 h-4 text-violet-500" />;
      case 'series':
        return <Tv className="w-4 h-4 text-pink-500" />;
      case 'game':
        return <Gamepad2 className="w-4 h-4 text-amber-500" />;
      default:
        return <Film className="w-4 h-4 text-violet-500" />;
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Media Library
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {media.length} items logged (books, films, series)
          </p>
        </div>

        {onAddMedia && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] select-none">
        {(['all', 'book', 'movie', 'series', 'game'] as MediaTypeFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setFilterType(tab);
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              filterType === tab
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'series' ? 'TV' : tab}
          </button>
        ))}
      </div>

      {/* Media List */}
      <div className="space-y-2.5">
        {filteredMedia.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <Film className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No media items
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Track books you read, films you watch, and games you play.
            </p>
          </div>
        ) : (
          filteredMedia.map((item) => (
            <MediaCardRow
              key={item.id}
              item={item}
              typeIcon={getTypeIcon(item.type)}
              onRate={(rating) => handleRate(item.id, rating)}
              onLongPress={() => setActiveActionMedia(item)}
            />
          ))
        )}
      </div>

      {/* Add Media Bottom Sheet */}
      <BottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="Add Media Item"
        subtitle="Log a book, film, series, or video game"
      >
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Atomic Habits, Interstellar, Cyberpunk"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Creator / Author
              </label>
              <input
                type="text"
                value={newCreator}
                onChange={(e) => setNewCreator(e.target.value)}
                placeholder="Author, Director, Studio"
                className="w-full px-3 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Media Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white"
              >
                <option value="book">Book</option>
                <option value="movie">Movie</option>
                <option value="series">TV / Series</option>
                <option value="game">Game</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Add to Library
          </button>
        </form>
      </BottomSheet>

      {/* Action Sheet */}
      <AndroidActionSheet
        isOpen={Boolean(activeActionMedia)}
        onClose={() => setActiveActionMedia(null)}
        title={activeActionMedia?.title || 'Media Options'}
        subtitle={`Creator: ${activeActionMedia?.creator} · Type: ${activeActionMedia?.type}`}
        actions={actionItems}
      />
    </div>
  );
};

interface MediaCardRowProps {
  item: MediaItem;
  typeIcon: React.ReactNode;
  onRate: (rating: number) => void;
  onLongPress: () => void;
}

const MediaCardRow: React.FC<MediaCardRowProps> = ({
  item,
  typeIcon,
  onRate,
  onLongPress,
}) => {
  const longPressProps = useLongPress(() => {
    onLongPress();
  });

  return (
    <div
      {...longPressProps}
      className="p-3.5 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs select-none space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] flex items-center justify-center shrink-0">
            {typeIcon}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
              {item.title}
            </h4>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
              {item.creator}
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
            item.status === 'completed'
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              : item.status === 'in-progress'
              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
              : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
          }`}
        >
          {item.status}
        </span>
      </div>

      {/* 5-Star Interactive Rating */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-semibold text-gray-400">Rating:</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onRate(star)}
              className="p-1 text-gray-300 hover:text-amber-400 active:scale-110 transition-all cursor-pointer"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  star <= item.rating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
