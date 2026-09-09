import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Check, X, RefreshCw, Link as LinkIcon, Trash2, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';
import { uploadAvatarImage } from '../utils/imageUtils';

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
  userId?: string;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentAvatarUrl,
  onSelectAvatar,
  onClose,
  soundEnabled,
  userId,
}) => {
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setCustomUrlInput('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP, etc.).');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus('Optimizing photo for instant sync...');

    try {
      const result = await uploadAvatarImage(file, userId);
      setProcessingStatus(result.isCloudStorage ? 'Synced to Cloud Storage!' : 'Photo optimized & ready!');
      Sound.success(soundEnabled);
      onSelectAvatar(result.url);
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Error processing avatar:', err);
      setErrorMessage(err?.message || 'Failed to process image. Please try another photo.');
      setIsProcessing(false);
      Sound.error(soundEnabled);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void processImageFile(file);
    // Reset file input so same file can be re-selected if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const urlToApply = customUrlInput.trim();
    if (!urlToApply) return;
    setErrorMessage(null);
    Sound.success(soundEnabled);
    onSelectAvatar(urlToApply);
    onClose();
  };

  const handleResetDefault = () => {
    setErrorMessage(null);
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
                Upload from your device, choose a curated preset, or paste an image URL
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#EDECE9] dark:hover:bg-[#374151] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Error Message Banner if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Current Avatar Preview & Drop/Upload Box */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              isDragging
                ? 'border-[#6366F1] bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-[#6366F1]/40'
                : 'border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/60'
            }`}
          >
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#6366F1] shadow-sm shrink-0 flex items-center justify-center bg-purple-50 dark:bg-purple-950/40">
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = STOCK_IMAGES.avatar;
                  }}
                />
              ) : (
                <User className="w-8 h-8 text-[#6366F1]" />
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#111827] dark:text-white flex items-center gap-1.5">
                  <span>Upload Photo</span>
                  <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> Auto-synced
                  </span>
                </h4>
              </div>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Drag &amp; drop or browse. Automatically optimized to sync across all devices instantly.
              </p>
              <div className="pt-1.5 flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{processingStatus || 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose From Device</span>
                    </>
                  )}
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
                    disabled={isProcessing}
                    onClick={() => {
                      Sound.success(soundEnabled);
                      onSelectAvatar(preset.url);
                      onClose();
                    }}
                    className={`group relative p-2 rounded-2xl border transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
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
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = STOCK_IMAGES.avatar;
                          }}
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
                disabled={!customUrlInput.trim() || isProcessing}
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
            disabled={isProcessing}
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#374151] text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] hover:text-rose-500 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Default Photo</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
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
