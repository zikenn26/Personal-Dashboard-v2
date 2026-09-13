import React from 'react';
import { BrandLogo } from './BrandLogo';
import { AISecretaryWidget } from './AISecretaryWidget';

interface AIAssistantViewProps {
  onNavigate: (view: any) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Top Heading with Official Zikenn Brand Logo */}
      <div className="pb-3 border-b border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={36} className="rounded-lg" />
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
      </div>

      {/* Neat, uncluttered main chat console */}
      <div className="w-full">
        <AISecretaryWidget isExpandedView={true} onNavigate={onNavigate} />
      </div>
    </div>
  );
};
