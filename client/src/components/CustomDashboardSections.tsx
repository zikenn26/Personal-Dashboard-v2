import React, { useState } from 'react';
import { DashboardSection, DashboardBlock, DashboardBlockType } from '../types';
import { Sound } from '../utils/audio';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckSquare,
  FileText,
  Bookmark,
  Quote,
  Code2,
  TrendingUp,
  Image as ImageIcon,
  ExternalLink,
  Edit2,
  Check,
  X,
  Layers,
  MoveUp,
  MoveDown,
} from 'lucide-react';

interface CustomDashboardSectionsProps {
  sections: DashboardSection[];
  onUpdateSections: (sections: DashboardSection[]) => void;
  soundEnabled: boolean;
}

export const CustomDashboardSections: React.FC<CustomDashboardSectionsProps> = ({
  sections,
  onUpdateSections,
  soundEnabled,
}) => {
  // New section modal state
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSecTitle, setNewSecTitle] = useState('');
  const [newSecIcon, setNewSecIcon] = useState('📌');
  const [newSecDesc, setNewSecDesc] = useState('');

  // New block modal state
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [blockType, setBlockType] = useState<DashboardBlockType>('text');
  const [blockContent, setBlockContent] = useState('');
  const [blockUrl, setBlockUrl] = useState('');
  const [blockCaption, setBlockCaption] = useState('');
  const [blockIcon, setBlockIcon] = useState('💡');
  const [blockMetricVal, setBlockMetricVal] = useState('100%');
  const [blockMetricChange, setBlockMetricChange] = useState('+5%');

  // Drag-and-drop state
  const [draggedBlockInfo, setDraggedBlockInfo] = useState<{
    sectionId: string;
    blockIndex: number;
  } | null>(null);

  // 1. Add New Section
  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecTitle.trim()) return;

    Sound.success(soundEnabled);
    const newSection: DashboardSection = {
      id: `sec-${Date.now()}`,
      title: `${newSecIcon} ${newSecTitle.trim()}`,
      icon: newSecIcon,
      description: newSecDesc.trim() || undefined,
      collapsed: false,
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'text',
          content: 'Click "+ Add Block" or edit this block to customize this section.',
        },
      ],
    };

    const updated = [...sections, newSection];
    onUpdateSections(updated);
    setNewSecTitle('');
    setNewSecDesc('');
    setShowAddSectionModal(false);
  };

  // 2. Delete Section
  const handleDeleteSection = (sectionId: string) => {
    if (window.confirm('Are you sure you want to delete this entire custom section?')) {
      Sound.click(soundEnabled);
      const updated = sections.filter((s) => s.id !== sectionId);
      onUpdateSections(updated);
    }
  };

  // 3. Toggle Section Collapse
  const handleToggleCollapse = (sectionId: string) => {
    Sound.click(soundEnabled);
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s
    );
    onUpdateSections(updated);
  };

  // 4. Move Section Up / Down
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    Sound.click(soundEnabled);
    const newSections = [...sections];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIdx, 0, moved);
    onUpdateSections(newSections);
  };

  // 5. Add Block to Section
  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSectionId || !blockContent.trim()) return;

    Sound.success(soundEnabled);
    const newBlock: DashboardBlock = {
      id: `blk-${Date.now()}`,
      type: blockType,
      content: blockContent.trim(),
      properties: {
        url: blockUrl.trim() || undefined,
        caption: blockCaption.trim() || undefined,
        icon: blockIcon.trim() || undefined,
        value: blockMetricVal.trim() || undefined,
        change: blockMetricChange.trim() || undefined,
        items:
          blockType === 'todo_list'
            ? [
                { id: `it-1`, text: blockContent.trim(), done: false },
                { id: `it-2`, text: 'Sample secondary action step', done: true },
              ]
            : undefined,
      },
    };

    const updated = sections.map((sec) => {
      if (sec.id === targetSectionId) {
        return {
          ...sec,
          blocks: [...sec.blocks, newBlock],
        };
      }
      return sec;
    });

    onUpdateSections(updated);
    setTargetSectionId(null);
    setBlockContent('');
    setBlockUrl('');
    setBlockCaption('');
  };

  // 6. Delete Block
  const handleDeleteBlock = (sectionId: string, blockId: string) => {
    Sound.click(soundEnabled);
    const updated = sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          blocks: sec.blocks.filter((b) => b.id !== blockId),
        };
      }
      return sec;
    });
    onUpdateSections(updated);
  };

  // 7. Move Block Up/Down within section
  const handleMoveBlock = (sectionId: string, blockIdx: number, direction: 'up' | 'down') => {
    Sound.click(soundEnabled);
    const updated = sections.map((sec) => {
      if (sec.id === sectionId) {
        const blocks = [...sec.blocks];
        const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
        if (targetIdx < 0 || targetIdx >= blocks.length) return sec;
        const [moved] = blocks.splice(blockIdx, 1);
        blocks.splice(targetIdx, 0, moved);
        return { ...sec, blocks };
      }
      return sec;
    });
    onUpdateSections(updated);
  };

  // 8. Toggle Checklist item inside block
  const handleToggleChecklistItem = (sectionId: string, blockId: string, itemId: string) => {
    Sound.click(soundEnabled);
    const updated = sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          blocks: sec.blocks.map((blk) => {
            if (blk.id === blockId && blk.properties?.items) {
              const newItems = blk.properties.items.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item
              );
              return {
                ...blk,
                properties: { ...blk.properties, items: newItems },
              };
            }
            return blk;
          }),
        };
      }
      return sec;
    });
    onUpdateSections(updated);
  };

  // 9. Drag and Drop handlers
  const handleDragStart = (sectionId: string, blockIndex: number) => {
    setDraggedBlockInfo({ sectionId, blockIndex });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetSectionId: string, targetBlockIndex: number) => {
    if (!draggedBlockInfo) return;
    Sound.click(soundEnabled);

    const { sectionId: srcSecId, blockIndex: srcIdx } = draggedBlockInfo;
    const updated = [...sections];

    const srcSection = updated.find((s) => s.id === srcSecId);
    const destSection = updated.find((s) => s.id === targetSectionId);

    if (!srcSection || !destSection) {
      setDraggedBlockInfo(null);
      return;
    }

    const [movedBlock] = srcSection.blocks.splice(srcIdx, 1);
    destSection.blocks.splice(targetBlockIndex, 0, movedBlock);

    onUpdateSections(updated);
    setDraggedBlockInfo(null);
  };

  return (
    <div className="space-y-6">
      {/* Section Header & Notion Customizer Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🧱</span>
            <h2 className="text-lg font-bold text-[#111827] dark:text-white tracking-tight">
              Customizable Notion Sections & Blocks
            </h2>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
            Add new subsections, rearrange elements with drag-and-drop, and tailor your dashboard
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            Sound.click(soundEnabled);
            setShowAddSectionModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#D1D5DB] dark:hover:border-[#4B5563] text-xs font-semibold text-[#111827] dark:text-white shadow-2xs hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] transition-all cursor-pointer w-fit"
        >
          <Plus className="w-3.5 h-3.5 text-[#6366F1]" />
          <span>+ Add New Section</span>
        </button>
      </div>

      {/* Render All Sections */}
      <div className="space-y-6">
        {sections.length === 0 ? (
          <div className="p-8 rounded-2xl border-2 border-dashed border-[#E5E7EB] dark:border-[#374151] text-center space-y-3">
            <p className="text-sm font-semibold text-[#111827] dark:text-white">
              No custom sections created yet
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-sm mx-auto">
              Create customized Notion blocks such as checklist roadmaps, metric highlights, quotes, image cards, and bookmarks.
            </p>
            <button
              type="button"
              onClick={() => setShowAddSectionModal(true)}
              className="px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#4F46E5] shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Section</span>
            </button>
          </div>
        ) : (
          sections.map((section, secIdx) => (
            <div
              key={section.id}
              className="rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-2xs space-y-4 transition-all"
            >
              {/* Section Header Controls */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCollapse(section.id)}
                    className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] cursor-pointer"
                    title={section.collapsed ? 'Expand Section' : 'Collapse Section'}
                  >
                    {section.collapsed ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white truncate">
                      {section.title}
                    </h3>
                    {section.description && (
                      <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate">
                        {section.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Reorder Section Up/Down */}
                  <button
                    type="button"
                    disabled={secIdx === 0}
                    onClick={() => handleMoveSection(secIdx, 'up')}
                    className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white disabled:opacity-30 rounded hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] cursor-pointer"
                    title="Move Section Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={secIdx === sections.length - 1}
                    onClick={() => handleMoveSection(secIdx, 'down')}
                    className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white disabled:opacity-30 rounded hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] cursor-pointer"
                    title="Move Section Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Add Block */}
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setTargetSectionId(section.id);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] text-xs font-semibold hover:opacity-90 cursor-pointer ml-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Block</span>
                  </button>

                  {/* Delete Section */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.id)}
                    className="p-1 text-[#9CA3AF] hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete Section"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Section Body (Blocks) */}
              {!section.collapsed && (
                <div className="space-y-3">
                  {section.blocks.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[#9CA3AF] border border-dashed border-[#E5E7EB] dark:border-[#374151] rounded-xl">
                      No blocks inside this section yet. Click &quot;+ Add Block&quot; above to insert elements.
                    </div>
                  ) : (
                    section.blocks.map((block, blkIdx) => (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => handleDragStart(section.id, blkIdx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(section.id, blkIdx)}
                        className="group relative flex items-start gap-2.5 p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/50 hover:border-[#D1D5DB] dark:hover:border-[#374151] transition-all"
                      >
                        {/* Drag Handle */}
                        <div
                          className="pt-0.5 text-[#9CA3AF] group-hover:text-[#4B5563] dark:group-hover:text-[#D1D5DB] cursor-grab active:cursor-grabbing shrink-0"
                          title="Drag to reorder block"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Block Content by Type */}
                        <div className="flex-1 min-w-0">
                          {/* 1. Heading Block */}
                          {block.type === 'heading' && (
                            <h4 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                              <span>{block.properties?.icon || '📌'}</span>
                              <span>{block.content}</span>
                            </h4>
                          )}

                          {/* 2. Text Block */}
                          {block.type === 'text' && (
                            <p className="text-xs sm:text-sm text-[#374151] dark:text-[#D1D5DB] leading-relaxed whitespace-pre-line">
                              {block.content}
                            </p>
                          )}

                          {/* 3. Todo / Checklist Block */}
                          {block.type === 'todo_list' && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-[#111827] dark:text-white">
                                {block.content}
                              </p>
                              {block.properties?.items?.map((it) => (
                                <div
                                  key={it.id}
                                  onClick={() => handleToggleChecklistItem(section.id, block.id, it.id)}
                                  className="flex items-center gap-2 text-xs text-[#374151] dark:text-[#D1D5DB] cursor-pointer hover:opacity-80"
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                      it.done
                                        ? 'bg-[#6366F1] border-[#6366F1] text-white'
                                        : 'border-[#9CA3AF] bg-white dark:bg-[#111827]'
                                    }`}
                                  >
                                    {it.done && <Check className="w-2.5 h-2.5" />}
                                  </div>
                                  <span className={it.done ? 'line-through text-[#9CA3AF]' : ''}>
                                    {it.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 4. Callout Block */}
                          {block.type === 'callout' && (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                              <span className="text-base shrink-0">
                                {block.properties?.icon || '💡'}
                              </span>
                              <div className="min-w-0 flex-1">
                                {block.properties?.badge && (
                                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 mb-1">
                                    {block.properties.badge}
                                  </span>
                                )}
                                <p className="text-xs font-medium text-blue-950 dark:text-blue-100 leading-relaxed">
                                  {block.content}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 5. Bookmark Block */}
                          {block.type === 'bookmark' && (
                            <a
                              href={block.properties?.url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#6366F1] transition-all group/bm"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Bookmark className="w-3.5 h-3.5 text-[#6366F1]" />
                                  <span className="text-xs font-bold text-[#111827] dark:text-white truncate">
                                    {block.content}
                                  </span>
                                </div>
                                {block.properties?.caption && (
                                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate mt-0.5">
                                    {block.properties.caption}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF] group-hover/bm:text-[#6366F1] shrink-0" />
                            </a>
                          )}

                          {/* 6. Quote Block */}
                          {block.type === 'quote' && (
                            <div className="pl-3 border-l-2 border-[#6366F1] space-y-1">
                              <p className="text-xs sm:text-sm italic font-serif text-[#111827] dark:text-[#F3F4F6]">
                                &ldquo;{block.content}&rdquo;
                              </p>
                              {block.properties?.caption && (
                                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-sans">
                                  — {block.properties.caption}
                                </p>
                              )}
                            </div>
                          )}

                          {/* 7. Image Card Block */}
                          {block.type === 'image' && (
                            <div className="space-y-1.5">
                              <div className="rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#374151] max-h-56 bg-slate-950">
                                <img
                                  src={block.properties?.url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80'}
                                  alt={block.content}
                                  className="w-full h-full object-cover max-h-56"
                                />
                              </div>
                              <p className="text-[11px] font-semibold text-[#111827] dark:text-white">
                                {block.content}
                              </p>
                              {block.properties?.caption && (
                                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                                  {block.properties.caption}
                                </p>
                              )}
                            </div>
                          )}

                          {/* 8. Metric Block */}
                          {block.type === 'metric' && (
                            <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] uppercase font-bold tracking-wider">
                                  {block.content}
                                </p>
                                <p className="text-xl font-extrabold text-[#111827] dark:text-white mt-0.5">
                                  {block.properties?.value || '98.5%'}
                                </p>
                                {block.properties?.caption && (
                                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                                    {block.properties.caption}
                                  </p>
                                )}
                              </div>
                              {block.properties?.change && (
                                <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                  {block.properties.change}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 9. Code Snippet Block */}
                          {block.type === 'code' && (
                            <div className="p-3 rounded-xl bg-[#1E1E1E] text-[#D4D4D4] font-mono text-[11px] overflow-x-auto">
                              <pre>{block.content}</pre>
                            </div>
                          )}
                        </div>

                        {/* Block Action Controls */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                          <button
                            type="button"
                            disabled={blkIdx === 0}
                            onClick={() => handleMoveBlock(section.id, blkIdx, 'up')}
                            className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <MoveUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={blkIdx === section.blocks.length - 1}
                            onClick={() => handleMoveBlock(section.id, blkIdx, 'down')}
                            className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <MoveDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(section.id, block.id)}
                            className="p-1 text-[#9CA3AF] hover:text-rose-500 cursor-pointer"
                            title="Delete Block"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add New Section Modal */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSection}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-6 shadow-2xl space-y-4 animate-in fade-in-50"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h3 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6366F1]" />
                <span>Add New Notion Section</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                  Emoji Icon
                </label>
                <select
                  value={newSecIcon}
                  onChange={(e) => setNewSecIcon(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl text-sm bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none"
                >
                  <option value="🎯">🎯 Target</option>
                  <option value="📌">📌 Pin</option>
                  <option value="🎨">🎨 Art</option>
                  <option value="💡">💡 Idea</option>
                  <option value="🚀">🚀 Rocket</option>
                  <option value="⚡">⚡ Focus</option>
                  <option value="📚">📚 Docs</option>
                  <option value="💼">💼 Work</option>
                </select>
              </div>

              <div className="col-span-3">
                <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                  Section Title
                </label>
                <input
                  type="text"
                  value={newSecTitle}
                  onChange={(e) => setNewSecTitle(e.target.value)}
                  placeholder="e.g. Design Principles & Review"
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newSecDesc}
                onChange={(e) => setNewSecDesc(e.target.value)}
                placeholder="Short tagline explaining this section"
                className="w-full px-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSecTitle.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Create Section
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Block Modal */}
      {targetSectionId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBlock}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-6 shadow-2xl space-y-4 animate-in fade-in-50"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h3 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#6366F1]" />
                <span>Add Notion Block</span>
              </h3>
              <button
                type="button"
                onClick={() => setTargetSectionId(null)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Block Type Selection */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1.5">
                Block Format Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { type: 'text' as const, label: 'Text Note', icon: '📝' },
                  { type: 'heading' as const, label: 'Heading', icon: '🏷️' },
                  { type: 'todo_list' as const, label: 'Checklist', icon: '☑️' },
                  { type: 'callout' as const, label: 'Callout', icon: '💡' },
                  { type: 'bookmark' as const, label: 'Bookmark', icon: '🔗' },
                  { type: 'quote' as const, label: 'Quote', icon: '💬' },
                  { type: 'image' as const, label: 'Image Card', icon: '🖼️' },
                  { type: 'metric' as const, label: 'Metric Stat', icon: '📊' },
                  { type: 'code' as const, label: 'Code Block', icon: '💻' },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setBlockType(item.type);
                    }}
                    className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      blockType === item.type
                        ? 'border-[#6366F1] bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8]'
                        : 'border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF]'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Block Main Content */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                Content / Title / Text
              </label>
              {blockType === 'text' || blockType === 'code' ? (
                <textarea
                  value={blockContent}
                  onChange={(e) => setBlockContent(e.target.value)}
                  placeholder="Enter block text content..."
                  rows={3}
                  autoFocus
                  className="w-full p-2.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1] resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={blockContent}
                  onChange={(e) => setBlockContent(e.target.value)}
                  placeholder="Enter block title or statement..."
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              )}
            </div>

            {/* Additional parameters for specific block types */}
            {(blockType === 'bookmark' || blockType === 'image') && (
              <div>
                <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                  URL ({blockType === 'image' ? 'Image URL' : 'Target Link'})
                </label>
                <input
                  type="text"
                  value={blockUrl}
                  onChange={(e) => setBlockUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none"
                />
              </div>
            )}

            {(blockType === 'quote' || blockType === 'bookmark' || blockType === 'image') && (
              <div>
                <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                  Caption / Author / Subtitle
                </label>
                <input
                  type="text"
                  value={blockCaption}
                  onChange={(e) => setBlockCaption(e.target.value)}
                  placeholder="e.g. Author name, source or note"
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none"
                />
              </div>
            )}

            {blockType === 'metric' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    value={blockMetricVal}
                    onChange={(e) => setBlockMetricVal(e.target.value)}
                    placeholder="99.4%"
                    className="w-full px-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#9CA3AF] block mb-1">
                    Delta / Change
                  </label>
                  <input
                    type="text"
                    value={blockMetricChange}
                    onChange={(e) => setBlockMetricChange(e.target.value)}
                    placeholder="+12%"
                    className="w-full px-3 py-1.5 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
              <button
                type="button"
                onClick={() => setTargetSectionId(null)}
                className="px-3 py-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!blockContent.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Insert Block
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
