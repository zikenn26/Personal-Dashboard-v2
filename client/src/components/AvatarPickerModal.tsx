import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Check, X, Link as LinkIcon, Trash2, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Sound } from '../utils/audio';
import { uploadAvatarImage } from '../utils/imageUtils';
import { getUserInitials, isDummyMockAvatar, getInitialsColorClass } from '../utils/userUtils';

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentAvatarUrl: string;
  userName?: string;
  onSelectAvatar: (url: string) => void;
  onClose: () => void;
  soundEnabled: boolean;
  userId?: string;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentAvatarUrl,
  userName = 'User',
  onSelectAvatar,
  onClose,
  soundEnabled,
  userId,
}) => {
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomUrlInput('');
      setErrorMessage(null);
      setIsProcessing(false);
      setIsDragging(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMock = isDummyMockAvatar(currentAvatarUrl);
  const hasValidCustomPhoto = Boolean(currentAvatarUrl && !isMock);
  const initials = getUserInitials(userName);
  const palette = getInitialsColorClass(userName);

  const handleFileSelected = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WebP, etc.).');
      Sound.error(soundEnabled);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 15MB limit. Please choose a smaller photo.');
      Sound.error(soundEnabled);
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      Sound.click(soundEnabled);

      const targetUserId = userId || 'user_local';
      const result = await uploadAvatarImage(file, targetUserId);

      if (result && result.url) {
        Sound.success(soundEnabled);
        onSelectAvatar(result.url);
        onClose();
      } else {
        throw new Error(result?.error || 'Failed to process and upload image.');
      }
    } catch (err: any) {
      console.error('Error processing avatar:', err);
      setErrorMessage(err?.message || 'Failed to process image. You can also paste an image URL below.');
      Sound.error(soundEnabled);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleFileSelected(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      void handleFileSelected(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
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

  const handleResetToInitials = () => {
    setErrorMessage(null);
    Sound.click(soundEnabled);
    onSelectAvatar('');
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
            <span className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white">
                Update Profile Photo
              </h3>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                Upload your own photo or use your initials avatar ({initials})
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
                ? 'border-violet-600 bg-violet-50/70 dark:bg-violet-950/40 ring-2 ring-violet-500/40'
                : 'border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/60'
            }`}
          >
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-violet-500 shadow-sm shrink-0 flex items-center justify-center">
              {hasValidCustomPhoto ? (
                <img
                  src={currentAvatarUrl}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => onSelectAvatar('')}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center font-bold text-xl ${palette.bg} ${palette.text}`}>
                  {initials}
                </div>
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
                  <span>Upload Personal Photo</span>
                </h4>
                <span className="text-[10px] text-[#9CA3AF]">Max 15MB</span>
              </div>
              <p className="text-[11px] text-[#6B7280] dark:text-[#94A3B8]">
                Drag and drop your picture here or choose from your files
              </p>

              <div className="pt-1.5 flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleInputChange}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Initials Default Option */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A2234] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shadow-xs ${palette.bg} ${palette.text}`}>
                {initials}
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  Initials Avatar ({initials})
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Default avatar generated cleanly from your name ({userName})
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing || !hasValidCustomPhoto}
              onClick={handleResetToInitials}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                !hasValidCustomPhoto
                  ? 'bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-violet-50 hover:text-violet-600'
              }`}
            >
              {!hasValidCustomPhoto ? 'Active' : 'Use Initials'}
            </button>
          </div>

          {/* Custom URL Input Bar */}
          <div className="pt-2 border-t border-[#EDECE9] dark:border-[#1F2937] space-y-2">
            <label className="text-[11px] font-bold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-violet-600" />
              <span>Or Paste Direct Photo URL</span>
            </label>
            <form onSubmit={handleApplyCustom} className="flex items-center gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://example.com/my-photo.jpg"
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="submit"
                disabled={!customUrlInput.trim() || isProcessing}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
              >
                Apply
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#EDECE9] dark:border-[#1F2937] bg-[#FAF9F6] dark:bg-[#1F2937]/50 flex items-center justify-between gap-2">
          {hasValidCustomPhoto ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleResetToInitials}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#374151] text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Photo (Use Initials)</span>
            </button>
          ) : (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Using clean {initials} initials
            </span>
          )}

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
