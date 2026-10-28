import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Palette,
  Eraser,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Save,
  Sparkles,
  Check,
} from 'lucide-react';
import { DoodleItem } from '../types';
import { Sound } from '../utils/audio';

interface DoodleCanvasProps {
  doodles: DoodleItem[];
  onSaveDoodle: (title: string, dataUrl: string) => void;
  onDeleteDoodle: (id: string) => void;
  soundEnabled: boolean;
}

const COLORS = [
  { name: 'Ink Black', value: '#171717', darkValue: '#f5f5f5' },
  { name: 'Cobalt Blue', value: '#2563eb', darkValue: '#60a5fa' },
  { name: 'Crimson', value: '#dc2626', darkValue: '#f87171' },
  { name: 'Amber', value: '#d97706', darkValue: '#fbbf24' },
  { name: 'Emerald', value: '#059669', darkValue: '#34d399' },
  { name: 'Purple', value: '#7c3aed', darkValue: '#a78bfa' },
];

const BRUSH_SIZES = [2, 4, 8, 14];

export const DoodleCanvas: React.FC<DoodleCanvasProps> = ({
  doodles,
  onSaveDoodle,
  onDeleteDoodle,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tools state (doesn't trigger redraw on mousemove)
  const [selectedColor, setSelectedColor] = useState<string>('#171717');
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(3);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Undo / Redo history stacks
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and size canvas with DPR
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width) || 360;
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Save initial blank state to history
    const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [initialData];
    historyIndexRef.current = 0;
  }, []);

  useEffect(() => {
    initCanvas();

    const handleResize = () => {
      // Re-init canvas on window resize
      initCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Truncate future redos
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(imgData);
    if (newHistory.length > 20) newHistory.shift(); // Limit to 20 steps
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    lastPointRef.current = { x, y };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, (isEraser ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? '#ffffff' : selectedColor;
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = isEraser ? '#ffffff' : selectedColor;
    ctx.lineWidth = isEraser ? brushSize * 2.5 : brushSize;
    ctx.stroke();

    lastPointRef.current = { x: currentX, y: currentY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      saveState();
    }
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    Sound.click(soundEnabled);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    historyIndexRef.current -= 1;
    const prevState = historyRef.current[historyIndexRef.current];
    ctx.putImageData(prevState, 0, 0);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    Sound.click(soundEnabled);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    historyIndexRef.current += 1;
    const nextState = historyRef.current[historyIndexRef.current];
    ctx.putImageData(nextState, 0, 0);
  };

  const handleClear = () => {
    Sound.click(soundEnabled);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  const handleSaveToGallery = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    Sound.success(soundEnabled);

    const dataUrl = canvas.toDataURL('image/png');
    const title = `Sketch ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    onSaveDoodle(title, dataUrl);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    Sound.click(soundEnabled);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `doodle-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-3">
      {/* Canvas Tool Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setSelectedColor(c.value);
                setIsEraser(false);
              }}
              className={`w-5 h-5 rounded-full transition-transform cursor-pointer shadow-2xs border ${
                selectedColor === c.value && !isEraser
                  ? 'scale-125 ring-2 ring-[#6366F1] border-white'
                  : 'border-black/10'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}

          {/* Eraser */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsEraser(!isEraser);
            }}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isEraser
                ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                : 'text-[#6B7280] hover:bg-[#E5E7EB] dark:hover:bg-[#374151]'
            }`}
            title="Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-1.5">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setBrushSize(size);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                brushSize === size
                  ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827] font-bold shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827] dark:hover:text-[#F3F4F6]'
              }`}
            >
              {size}px
            </button>
          ))}
        </div>

        {/* Actions (Undo, Redo, Clear, Save, Download) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            className="p-1 text-[#6B7280] hover:text-[#111827] dark:hover:text-[#F3F4F6] rounded cursor-pointer transition-colors"
            title="Undo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            className="p-1 text-[#6B7280] hover:text-[#111827] dark:hover:text-[#F3F4F6] rounded cursor-pointer transition-colors"
            title="Redo"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-[#6B7280] hover:text-rose-500 rounded cursor-pointer transition-colors"
            title="Clear Canvas"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownloadPNG}
            className="p-1 text-[#6B7280] hover:text-[#6366F1] rounded cursor-pointer transition-colors"
            title="Download PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSaveToGallery}
            className="px-2 py-1 rounded text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white transition-opacity flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            {savedSuccess ? <Check className="w-3 h-3 text-emerald-300" /> : <Save className="w-3 h-3" />}
            <span>{savedSuccess ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* HTML5 Canvas Element */}
      <div
        ref={containerRef}
        className="w-full h-[220px] rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white relative cursor-crosshair shadow-inner"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="touch-none w-full h-full block"
        />
      </div>

      {/* Saved Doodles strip */}
      {doodles.length > 0 && (
        <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
          <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1.5">
            Saved Sketches & Ideas ({doodles.length})
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {doodles.map((doodle) => (
              <div
                key={doodle.id}
                className="relative group shrink-0 w-20 h-14 rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white flex items-center justify-center"
              >
                {doodle.dataUrl ? (
                  <img src={doodle.dataUrl} alt={doodle.title} className="w-full h-full object-contain" />
                ) : null}
                <button
                  onClick={() => {
                    Sound.click(soundEnabled);
                    onDeleteDoodle(doodle.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white hover:text-rose-400 transition-opacity cursor-pointer"
                  title="Delete sketch"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
