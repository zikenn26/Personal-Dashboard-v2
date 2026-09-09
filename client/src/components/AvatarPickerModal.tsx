import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, X, RefreshCw, Link as LinkIcon, Trash2, User } from 'lucide-react';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';

export interface AvatarPreset {
  id: string;
  name: string;
  url: string;
  category: 'professional' | 'developer' | 'illustrated' | 'minimal';
}

export const CURATED_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'local-default',
    name: 'Professional Default',
    url: STOCK_IMAGES.avatar,
    category: 'professional',
  },
  {
    id: 'headshot-pro-1',
    name: 'Studio Portrait • Professional',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    category: 'professional',
  },
  {
    id: 'headshot-pro-2',
    name: 'Tech Lead • Modern Corporate',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    category: 'professional',
  },
  {
    id: 'headshot-pro-3',
    name: 'Software Engineer • Casual',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    category: 'developer',
  },
  {
    id: 'headshot-pro-4',
    name: 'Creative Developer',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    category: 'developer',
  },
  {
    id: 'headshot-pro-5',
    name: 'Minimalist Monochrome',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    category: 'minimal',
  },
];

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentAvatarUrl: string;
  onSelectAvatar: (url: string) => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentAvatarUrl,
  onSelectAvatar,
  onClose,
  soundEnabled,
}) => {
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (under 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Please choose an image file under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        Sound.success(soundEnabled);
        onSelectAvatar(dataUrl);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const urlToApply = customUrlInput.trim();
    if (!urlToApply) return;
    Sound.success(soundEnabled);
    onSelectAvatar(urlToApply);
    onClose();
  };

  const handleResetDefault = () => {
    Sound.click(soundEnabled);
    onSelectAvatar(STOCK_IMAGES.avatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        id="avatar-picker-modal"
        className="w-full max-w-lg bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#1F2937] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EDECE9] dark:border-[#1F2937] flex items-center justify-between bg-[#FAF9F6] dark:bg-[#1F2937]/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8]">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white">
                Update Profile Photo
              </h3>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Upload from your device, choose a professional preset, or paste a photo URL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#EDECE9] dark:hover:bg-[#374151] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Current Avatar Preview & Quick Upload */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#1E293B]/60 border border-[#E2E8F0] dark:border-[#334155]">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#6366F1] shadow-sm shrink-0 flex items-center justify-center bg-purple-50 dark:bg-purple-950/40">
              {(currentAvatarUrl || STOCK_IMAGES.avatar) ? (
                <img
                  src={currentAvatarUrl || STOCK_IMAGES.avatar}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-xs font-bold text-[#111827] dark:text-white">
                Upload New Photo
              </h4>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Supports JPG, PNG, WebP (Max 5MB)
              </p>
              <div className="pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Image File</span>
                </button>
              </div>
            </div>
          </div>

          {/* Curated Presets Grid */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Or Choose a Professional Preset</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {CURATED_AVATAR_PRESETS.map((preset) => {
                const isSelected = currentAvatarUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      Sound.success(soundEnabled);
                      onSelectAvatar(preset.url);
                      onClose();
                    }}
                    className={`group relative p-2 rounded-2xl border transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#6366F1] bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-[#6366F1]/30'
                        : 'border-[#E5E7EB] dark:border-[#374151] hover:border-[#6366F1] bg-white dark:bg-[#1F2937]'
                    }`}
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#374151]">
                      {preset.url ? (
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#6366F1]/40 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-[#4B5563] dark:text-[#CBD5E1] truncate w-full">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom URL Input Bar */}
          <div className="pt-2 border-t border-[#EDECE9] dark:border-[#1F2937] space-y-2">
            <label className="text-[11px] font-bold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Or Paste Direct Photo URL</span>
            </label>
            <form onSubmit={handleApplyCustom} className="flex items-center gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/... or https://..."
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
              <button
                type="submit"
                disabled={!customUrlInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
              >
                Apply
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#EDECE9] dark:border-[#1F2937] bg-[#FAF9F6] dark:bg-[#1F2937]/50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#374151] text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] hover:text-rose-500 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Default Photo</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#EDECE9] dark:hover:bg-[#374151] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
