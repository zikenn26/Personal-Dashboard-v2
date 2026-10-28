import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { AISecretaryWidget } from './AISecretaryWidget';

interface AIAssistantViewProps {
  onNavigate: (view: any) => void;
  onOpenCommandMappings?: () => void;
  activeView?: string;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  onNavigate,
  onOpenCommandMappings,
  activeView,
}) => {
  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Top Heading */}
      <div className="pb-3 border-b border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="workspace-heading font-extrabold flex items-center gap-2">
              <span className="font-serif tracking-wide text-black dark:text-white transition-colors duration-200">
                ZIKENN
              </span>
              <span className="text-indigo-600 dark:text-cyan-400 text-sm font-sans font-bold uppercase tracking-wider">
                AI
              </span>
            </h1>
          </div>
        </div>

        {onOpenCommandMappings && (
          <button
            type="button"
            onClick={onOpenCommandMappings}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-amber-200/60 dark:border-amber-800/40 cursor-pointer shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            <span>Voice Command Mappings</span>
          </button>
        )}
      </div>

      {/* Neat, uncluttered main chat console */}
      <div className="w-full">
        <AISecretaryWidget
          isExpandedView={true}
          onNavigate={onNavigate}
          onOpenCommandMappings={onOpenCommandMappings}
          activeView={activeView}
        />
      </div>
    </div>
  );
};
