import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  CornerDownRight,
  Radio,
  Zap,
} from 'lucide-react';
import { GeminiLiveVoiceSession, LiveVoiceStatus } from '../services/geminiLiveService';
import { Sound } from '../utils/audio';
import { WaveformVisualizer } from './WaveformVisualizer';

interface GeminiLiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: any, tabOrFilter?: string) => void;
  onListeningChange?: (isListening: boolean) => void;
}

const VOICE_COMMAND_HINTS = [
  '“Add high-priority task: Submit design draft”',
  '“Log an expense of ₹250 for lunch”',
  '“Show me my pending tasks”',
  '“Check off today’s morning meditation habit”',
  '“Navigate to my habits page”',
];

export const GeminiLiveVoiceModal: React.FC<GeminiLiveVoiceModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onListeningChange,
}) => {
  const [status, setStatus] = useState<LiveVoiceStatus>('connecting');
  const [volume, setVolume] = useState<number>(0);
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [modelTranscript, setModelTranscript] = useState<string>('');
  const [executedTools, setExecutedTools] = useState<Array<{ name: string; chip: string; id: string }>>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionRef = useRef<GeminiLiveVoiceSession | null>(null);

  // Sync listening state to parent component (for floating button waveform)
  useEffect(() => {
    if (onListeningChange) {
      onListeningChange(isOpen && (status === 'listening' || status === 'connecting') && !isMuted);
    }
  }, [isOpen, status, isMuted, onListeningChange]);

  useEffect(() => {
    if (!isOpen) {
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
      onListeningChange?.(false);
      return;
    }

    setErrorMessage(null);
    setUserTranscript('');
    setModelTranscript('');
    setExecutedTools([]);
    setIsMuted(false);

    const session = new GeminiLiveVoiceSession({
      onStatusChange: (s) => {
        setStatus(s);
        if (s === 'speaking') {
          Sound.voiceProcessing(true);
        }
      },
      onVolumeChange: (v) => setVolume(v),
      onUserTranscript: (t) => {
        setUserTranscript((prev) => (prev ? `${prev} ${t}` : t));
        Sound.voiceRegistered(true);
      },
      onModelTranscript: (t) => setModelTranscript((prev) => (prev ? `${prev} ${t}` : t)),
      onToolExecuted: (toolName, chip) => {
        Sound.success(true);
        setExecutedTools((prev) => [
          ...prev,
          { name: toolName, chip, id: 'tool-' + Date.now() + Math.random() },
        ]);
        if (toolName === 'navigate_view' && onNavigate) {
          // auto navigate if requested
          try {
            const raw = chip.toLowerCase();
            if (raw.includes('task')) onNavigate('tasks');
            else if (raw.includes('habit')) onNavigate('habits');
            else if (raw.includes('expense')) onNavigate('expenses');
            else if (raw.includes('diary')) onNavigate('diary');
            else if (raw.includes('exam')) onNavigate('exams');
          } catch {
            // ignore
          }
        }
      },
      onError: (err) => {
        setErrorMessage(err);
        setStatus('error');
      },
    });

    sessionRef.current = session;
    session.start();

    return () => {
      session.stop();
      sessionRef.current = null;
      onListeningChange?.(false);
    };
  }, [isOpen, onNavigate, onListeningChange]);

  const handleToggleMute = () => {
    if (!sessionRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    sessionRef.current.setMuted(next);
  };

  const handleInterrupt = () => {
    // If speaking, clicking the orb or interrupt clears current audio output
    if (status === 'speaking' && sessionRef.current) {
      // Re-trigger mic state
      setStatus('listening');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-gray-900 via-[#131927] to-[#0D1117] text-white rounded-3xl shadow-2xl border border-indigo-500/20 overflow-hidden flex flex-col p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                    Gemini 3.8 Live Voice
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Live API
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Real-time bidirectional speech & voice commands
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close voice assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Central Animated Voice Orb */}
          <div className="my-8 flex flex-col items-center justify-center relative min-h-[190px]">
            {/* Outer Pulsing Wave Rings */}
            <div
              className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
                status === 'speaking'
                  ? 'bg-purple-500/20 animate-ping'
                  : status === 'listening'
                  ? 'bg-indigo-500/20 animate-pulse'
                  : 'bg-gray-500/10'
              }`}
              style={{
                width: `${160 + volume * 120}px`,
                height: `${160 + volume * 120}px`,
              }}
            />
            <div
              className={`absolute rounded-full transition-all duration-150 pointer-events-none ${
                status === 'speaking'
                  ? 'bg-purple-400/30 blur-md'
                  : status === 'listening'
                  ? 'bg-cyan-400/25 blur-md'
                  : 'bg-gray-500/10'
              }`}
              style={{
                width: `${130 + volume * 80}px`,
                height: `${130 + volume * 80}px`,
              }}
            />

            {/* Core Orb Button */}
            <motion.button
              type="button"
              onClick={handleInterrupt}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer ${
                status === 'speaking'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 shadow-purple-500/40'
                  : status === 'listening'
                  ? 'bg-gradient-to-tr from-indigo-600 via-cyan-600 to-blue-500 shadow-indigo-500/40'
                  : status === 'connecting'
                  ? 'bg-gradient-to-tr from-gray-700 to-gray-800 shadow-gray-700/30 animate-pulse'
                  : 'bg-rose-900 shadow-rose-900/40'
              }`}
            >
              {status === 'speaking' ? (
                <>
                  <Volume2 className="w-9 h-9 text-white animate-bounce" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-white/90">
                    Speaking
                  </span>
                </>
              ) : status === 'listening' ? (
                <>
                  <Mic className="w-9 h-9 text-white" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-white/90">
                    {isMuted ? 'Muted' : 'Listening'}
                  </span>
                </>
              ) : status === 'connecting' ? (
                <>
                  <Radio className="w-8 h-8 text-indigo-300 animate-spin" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-indigo-200">
                    Connecting
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-9 h-9 text-rose-300" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-rose-200">
                    Error
                  </span>
                </>
              )}
            </motion.button>

            {/* Waveform Visualizer indicating active microphone */}
            <div className="mt-4 flex items-center justify-center">
              <WaveformVisualizer
                isActive={status === 'listening' && !isMuted}
                volume={volume}
                barCount={7}
                size="md"
                colorTheme="cyan"
              />
            </div>

            {/* Status Text Label */}
            <div className="mt-5 text-center px-4">
              {status === 'connecting' && (
                <p className="text-xs text-indigo-300 animate-pulse">
                  Establishing low-latency WebSocket connection to Gemini 3.8 Live...
                </p>
              )}
              {status === 'listening' && (
                <p className="text-xs text-gray-300">
                  {isMuted
                    ? 'Microphone muted. Unmute to speak.'
                    : 'Listening... Speak naturally or issue a dashboard command.'}
                </p>
              )}
              {status === 'speaking' && (
                <p className="text-xs text-purple-300">
                  Gemini is speaking. You can speak anytime to interrupt.
                </p>
              )}
              {status === 'error' && (
                <p className="text-xs text-rose-400">
                  {errorMessage || 'Live voice service encountered an issue.'}
                </p>
              )}
            </div>
          </div>

          {/* Real-Time Live Transcripts & Executed Tool Badges */}
          <div className="space-y-3 min-h-[110px] max-h-[160px] overflow-y-auto pr-1 text-xs border-t border-white/10 pt-3">
            {/* Executed Tools Badges */}
            {executedTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {executedTools.map((tool) => (
                  <span
                    key={tool.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-medium animate-in fade-in"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {tool.chip}
                  </span>
                ))}
              </div>
            )}

            {/* User Speech Transcription */}
            {userTranscript && (
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-200">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5">
                  You said
                </span>
                <p className="italic">“{userTranscript}”</p>
              </div>
            )}

            {/* Model Speech Transcription */}
            {modelTranscript && (
              <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-100">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-0.5">
                  Gemini Live
                </span>
                <p>{modelTranscript}</p>
              </div>
            )}

            {!userTranscript && !modelTranscript && executedTools.length === 0 && (
              <div className="space-y-1.5 text-center text-gray-500 py-2">
                <span className="text-[11px] font-semibold text-gray-400 block">
                  Try speaking commands like:
                </span>
                <div className="flex flex-wrap gap-1 justify-center">
                  {VOICE_COMMAND_HINTS.slice(0, 3).map((hint, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-400 border border-white/5"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls Bar */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-white/10 text-gray-200 hover:bg-white/15'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            {status === 'speaking' && (
              <button
                type="button"
                onClick={handleInterrupt}
                className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <VolumeX className="w-4 h-4" />
                <span>Interrupt</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              End Voice Call
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
