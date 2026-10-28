import React from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';
import { Sound } from '../utils/audio';

interface ResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadPDF: () => void;
  onPrint: () => void;
  isExportingPDF: boolean;
  soundEnabled: boolean;
  children: React.ReactNode;
}

export const ResumePreviewModal: React.FC<ResumePreviewModalProps> = ({
  isOpen,
  onClose,
  onDownloadPDF,
  onPrint,
  isExportingPDF,
  soundEnabled,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white/95 dark:bg-[#18181B]/95 border-b border-gray-200 dark:border-zinc-800 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            Document Fullscreen Preview
          </span>
          <span className="hidden sm:inline text-xs text-gray-500 font-mono">
            (Ready for Recruiters &amp; Printing)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onDownloadPDF();
            }}
            disabled={isExportingPDF}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onPrint();
            }}
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preview Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-gray-100/70 dark:bg-[#0c0d0e]">
        <div className="w-full max-w-4xl">{children}</div>
      </div>
    </div>
  );
};
