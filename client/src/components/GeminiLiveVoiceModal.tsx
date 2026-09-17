import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Radio,
  Zap,
  Send,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  matchCommandTrigger,
  executeCommandMapping,
} from '../services/commandMappingService';
import {
  sendGeminiMessage,
  speakTextWithGemini,
  stopGeminiSpeech,
  transcribeAudioWithGemini,
} from '../services/geminiService';
import { Sound } from '../utils/audio';
import { WaveformVisualizer } from './WaveformVisualizer';

interface GeminiLiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: any, tabOrFilter?: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  onOpenCommandMappings?: () => void;
  onCommandExecuted?: (commandText: string) => void;
}

type LiveVoiceStatus = 'listening' | 'speaking' | 'processing' | 'error';

const SAMPLE_COMMANDS = [
  'log breakfast 150',
  'add task review notes',
  'open expenses',
  'open habits',
  'morning coffee 80',
  'open dashboard',
];

export const GeminiLiveVoiceModal: React.FC<GeminiLiveVoiceModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onListeningChange,
  onOpenCommandMappings,
  onCommandExecuted,
}) => {
  const [status, setStatus] = useState<LiveVoiceStatus>('listening');
  const [volume, setVolume] = useState<number>(0);
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [modelTranscript, setModelTranscript] = useState<string>('');
  const [executedTools, setExecutedTools] = useState<Array<{ name: string; chip: string; id: string }>>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');

  // Subtle visual indicator state when voice input is successfully processed
  const [isCommandProcessed, setIsCommandProcessed] = useState<boolean>(false);
  const [lastProcessedMessage, setLastProcessedMessage] = useState<string>('');

  // Stable refs for callbacks to prevent re-render teardown cycles
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onCommandExecutedRef = useRef(onCommandExecuted);
  onCommandExecutedRef.current = onCommandExecuted;

  // Audio & Speech references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const executedPhraseRef = useRef<Set<string>>(new Set());
  const silenceTimerRef = useRef<any>(null);
  const successIndicatorTimerRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const isSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;

  // Sync listening state to parent component
  useEffect(() => {
    if (onListeningChangeRef.current) {
      const active = isOpen && (status === 'listening' || isCommandProcessed) && !isMuted;
      onListeningChangeRef.current(active);
    }
  }, [isOpen, status, isMuted, isCommandProcessed]);

  // Mark command as processed with visual indicator transition
  const triggerCommandProcessedIndicator = useCallback((message: string) => {
    setIsCommandProcessed(true);
    setLastProcessedMessage(message);
    if (successIndicatorTimerRef.current) {
      clearTimeout(successIndicatorTimerRef.current);
    }
    successIndicatorTimerRef.current = setTimeout(() => {
      setIsCommandProcessed(false);
    }, 3600);
  }, []);

  // Stop all audio & recognition
  const stopAllAudio = useCallback(() => {
    stopGeminiSpeech();
    isSpeakingRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // Execute a command trigger
  const handleExecuteTrigger = useCallback(
    async (rawText: string) => {
      const match = matchCommandTrigger(rawText);
      if (!match) return false;

      const triggerKey = `${match.mapping.id}-${rawText.toLowerCase().trim()}`;
      if (executedPhraseRef.current.has(triggerKey)) {
        return true; // already handled
      }
      executedPhraseRef.current.add(triggerKey);

      try {
        Sound.voiceProcessing(true);
        setStatus('processing');

        const res = await executeCommandMapping(match.mapping, match.extractedParams);
        if (res.success) {
          Sound.success(true);
          const chipText = res.actionChip || `✓ Executed: "${match.mapping.triggerPhrase}"`;
          setExecutedTools((prev) => [
            ...prev,
            {
              name: match.mapping.actionType,
              chip: chipText,
              id: 'cmd-live-' + Date.now(),
            },
          ]);

          // Visual indicator on WaveformVisualizer & modal
          triggerCommandProcessedIndicator(res.message);
          onCommandExecutedRef.current?.(rawText);

          setModelTranscript(res.message);
          setStatus('speaking');
          isSpeakingRef.current = true;

          // Vocal confirmation
          await speakTextWithGemini(res.message, 'Zephyr', () => {
            isSpeakingRef.current = false;
            setStatus('listening');
          });

          if (match.mapping.actionType === 'navigate_view' && onNavigateRef.current && res.details?.view) {
            onNavigateRef.current(res.details.view);
          }
          return true;
        }
      } catch (err) {
        console.error('Failed to execute command trigger:', err);
      }
      isSpeakingRef.current = false;
      setStatus('listening');
      return false;
    },
    [triggerCommandProcessedIndicator]
  );

  // Send query to AI Secretary / Gemini if not a custom trigger
  const handleAiFallback = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || executedPhraseRef.current.has(prompt.toLowerCase())) return;
      executedPhraseRef.current.add(prompt.toLowerCase());

      try {
        setStatus('processing');
        Sound.voiceProcessing(true);

        const response = await sendGeminiMessage({
          message: prompt,
          history: [],
        });

        if (response.actionChips && response.actionChips.length > 0) {
          for (const chip of response.actionChips) {
            setExecutedTools((prev) => [
              ...prev,
              {
                name: 'ai_tool',
                chip,
                id: 'ai-chip-' + Date.now() + Math.random(),
              },
            ]);
          }
          // Visual confirmation on WaveformVisualizer
          triggerCommandProcessedIndicator(response.reply || 'Action completed');
          onCommandExecutedRef.current?.(prompt);
        }

        const reply = response.reply || 'Command completed.';
        setModelTranscript(reply);
        setStatus('speaking');
        isSpeakingRef.current = true;

        await speakTextWithGemini(reply, 'Zephyr', () => {
          isSpeakingRef.current = false;
          setStatus('listening');
        });
      } catch (err: any) {
        console.warn('AI processing error:', err);
        isSpeakingRef.current = false;
        setStatus('listening');
      }
    },
    [triggerCommandProcessedIndicator]
  );

  // Helper to restart speech recognition without tearing down the audio stream
  const restartSpeechRecognition = useCallback(() => {
    if (!isOpen || isMutedRef.current || isSpeakingRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (!isSpeakingRef.current) {
          setStatus('listening');
        }
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        if (isMutedRef.current || isSpeakingRef.current) return;

        // Iterate through all results to build cumulative transcript
        let finalStr = '';
        let interimStr = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalStr += item[0].transcript + ' ';
          } else {
            interimStr += item[0].transcript;
          }
        }

        const fullText = (finalStr + interimStr).trim();
        if (fullText) {
          latestTranscriptRef.current = fullText;
          setUserTranscript(fullText);
          setInterimTranscript(interimStr.trim());
          Sound.voiceRegistered(true);

          // Check if it matches a custom voice trigger
          handleExecuteTrigger(fullText).then((matched) => {
            if (matched) {
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            } else {
              // Debounce silence timer for general AI prompt
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                if (latestTranscriptRef.current && !isSpeakingRef.current) {
                  handleAiFallback(latestTranscriptRef.current);
                }
              }, 1800);
            }
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
          setStatus('error');
        } else if (event.error === 'network') {
          setErrorMessage('Speech service network issue. You can still type below or use quick actions.');
        } else if (event.error === 'audio-capture') {
          setErrorMessage('Microphone device busy or unavailable.');
        }
      };

      recognition.onend = () => {
        // Automatically restart speech recognition after brief pause
        if (isOpen && !isMutedRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isOpen && !isMutedRef.current && !isSpeakingRef.current) {
              restartSpeechRecognition();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start skipped:', e);
    }
  }, [isOpen, handleExecuteTrigger, handleAiFallback]);

  // Initialize Speech Recognition & Microphone Volume Monitor
  const startVoiceEngine = useCallback(() => {
    stopAllAudio();

    // 1. Microphone level monitoring (for animated waveform)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaStreamRef.current = stream;
          try {
            const AudioContextClass =
              window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateVolume = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              // Smooth normalized volume
              setVolume(Math.min(1, avg / 70));
              animFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

            // Setup MediaRecorder fallback if browser SpeechRecognition is absent
            const SpeechRecognition =
              (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition && typeof MediaRecorder !== 'undefined') {
              try {
                const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunksRef.current = [];
                mr.ondataavailable = (e) => {
                  if (e.data.size > 0) audioChunksRef.current.push(e.data);
                };
                mr.onstop = async () => {
                  if (audioChunksRef.current.length > 0) {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    audioChunksRef.current = [];
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      if (base64) {
                        const transcript = await transcribeAudioWithGemini(base64, 'audio/webm');
                        if (transcript && transcript.trim()) {
                          setUserTranscript(transcript.trim());
                          latestTranscriptRef.current = transcript.trim();
                          handleExecuteTrigger(transcript.trim()).then((matched) => {
                            if (!matched) handleAiFallback(transcript.trim());
                          });
                        }
                      }
                    };
                    reader.readAsDataURL(blob);
                  }
                };
                mediaRecorderRef.current = mr;
                mr.start(3000); // 3-second slices
              } catch (mrErr) {
                console.warn('MediaRecorder fallback setup:', mrErr);
              }
            }
          } catch (e) {
            console.warn('AudioContext visualization setup skipped:', e);
          }
        })
        .catch((err) => {
          console.warn('Microphone permission error:', err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setErrorMessage('Microphone access blocked. Please enable microphone permissions in your browser bar.');
          }
        });
    }

    // 2. Start Speech Recognition
    restartSpeechRecognition();
  }, [stopAllAudio, restartSpeechRecognition, handleExecuteTrigger, handleAiFallback]);

  // Primary lifecycle: triggers only when modal is opened or closed
  useEffect(() => {
    if (!isOpen) {
      stopAllAudio();
      return;
    }

    setErrorMessage(null);
    setUserTranscript('');
    setInterimTranscript('');
    setModelTranscript('');
    setExecutedTools([]);
    setIsMuted(false);
    setIsCommandProcessed(false);
    setLastProcessedMessage('');
    executedPhraseRef.current.clear();
    latestTranscriptRef.current = '';
    isSpeakingRef.current = false;

    startVoiceEngine();

    return () => {
      stopAllAudio();
      if (successIndicatorTimerRef.current) {
        clearTimeout(successIndicatorTimerRef.current);
      }
    };
  }, [isOpen, startVoiceEngine, stopAllAudio]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    if (next) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    } else {
      restartSpeechRecognition();
    }
  };

  const handleInterrupt = () => {
    stopGeminiSpeech();
    isSpeakingRef.current = false;
    setStatus('listening');
    restartSpeechRecognition();
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = manualInput.trim();
    if (!text) return;

    setUserTranscript(text);
    setManualInput('');

    handleExecuteTrigger(text).then((matched) => {
      if (!matched) {
        handleAiFallback(text);
      }
    });
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
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-gray-900 via-[#131927] to-[#0D1117] text-white rounded-3xl shadow-2xl border border-indigo-500/20 overflow-hidden flex flex-col p-6 sm:p-8 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                isCommandProcessed
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-400'
                  : 'bg-indigo-500/20 border border-indigo-400/30 text-indigo-400'
              }`}>
                {isCommandProcessed ? (
                  <Check className="w-5 h-5 text-emerald-400 animate-in zoom-in" />
                ) : (
                  <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                    Voice Assistant & Commands
                  </h2>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors duration-300 ${
                    isCommandProcessed
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}>
                    {isCommandProcessed ? 'Command Processed' : 'Microphone Live'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Continuous speech recognition, instant command matching & AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenCommandMappings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCommandMappings();
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Manage Voice Command Mappings"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Triggers</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close voice assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Central Animated Voice Orb */}
          <div className="my-6 flex flex-col items-center justify-center relative min-h-[170px]">
            {/* Outer Pulsing Wave Rings */}
            <div
              className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
                isCommandProcessed
                  ? 'bg-emerald-500/25 animate-pulse'
                  : status === 'speaking'
                  ? 'bg-purple-500/25 animate-ping'
                  : status === 'listening'
                  ? 'bg-cyan-500/20 animate-pulse'
                  : 'bg-gray-500/10'
              }`}
              style={{
                width: `${140 + volume * 100}px`,
                height: `${140 + volume * 100}px`,
              }}
            />
            <div
              className={`absolute rounded-full transition-all duration-150 pointer-events-none ${
                isCommandProcessed
                  ? 'bg-emerald-400/30 blur-md'
                  : status === 'speaking'
                  ? 'bg-purple-400/30 blur-md'
                  : status === 'listening'
                  ? 'bg-cyan-400/30 blur-md'
                  : 'bg-gray-500/10'
              }`}
              style={{
                width: `${120 + volume * 70}px`,
                height: `${120 + volume * 70}px`,
              }}
            />

            {/* Core Orb Button */}
            <motion.button
              type="button"
              onClick={status === 'speaking' ? handleInterrupt : undefined}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer ${
                isCommandProcessed
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-green-500 shadow-emerald-500/50 ring-4 ring-emerald-400/60'
                  : status === 'speaking'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 shadow-purple-500/40'
                  : status === 'listening'
                  ? 'bg-gradient-to-tr from-indigo-600 via-cyan-600 to-blue-500 shadow-indigo-500/40'
                  : status === 'processing'
                  ? 'bg-gradient-to-tr from-amber-600 to-indigo-600 shadow-amber-500/40 animate-pulse'
                  : 'bg-rose-900 shadow-rose-900/40'
              }`}
            >
              {isCommandProcessed ? (
                <>
                  <Check className="w-8 h-8 text-white animate-in zoom-in" strokeWidth={3} />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-white">
                    Executed
                  </span>
                </>
              ) : status === 'speaking' ? (
                <>
                  <Volume2 className="w-8 h-8 text-white animate-bounce" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-white/90">
                    Speaking
                  </span>
                </>
              ) : status === 'listening' ? (
                <>
                  <Mic className="w-8 h-8 text-white animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-white/90">
                    {isMuted ? 'Muted' : 'Listening'}
                  </span>
                </>
              ) : status === 'processing' ? (
                <>
                  <Sparkles className="w-8 h-8 text-amber-200 animate-spin" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-amber-100">
                    Executing
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-8 h-8 text-rose-300" />
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-rose-200">
                    Error
                  </span>
                </>
              )}
            </motion.button>

            {/* Enhanced Waveform Visualizer with dynamic color shift & subtle success indicator */}
            <div className="mt-3 flex items-center justify-center">
              <WaveformVisualizer
                isActive={(status === 'listening' || status === 'speaking' || isCommandProcessed) && !isMuted}
                volume={volume}
                barCount={7}
                size="md"
                colorTheme={isCommandProcessed ? 'emerald' : 'cyan'}
                isProcessed={isCommandProcessed}
                showSuccessBadge={true}
              />
            </div>

            {/* Status Text Label */}
            <div className="mt-3 text-center px-4">
              {isCommandProcessed ? (
                <p className="text-xs text-emerald-300 font-semibold flex items-center justify-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline-block" />
                  {lastProcessedMessage || 'Command processed successfully!'}
                </p>
              ) : status === 'listening' ? (
                <p className="text-xs text-cyan-300 font-medium">
                  {isMuted
                    ? 'Microphone muted. Click Unmute to speak.'
                    : 'Listening... Speak a command or question anytime.'}
                </p>
              ) : status === 'speaking' ? (
                <p className="text-xs text-purple-300">
                  Assistant speaking. Click the orb to interrupt.
                </p>
              ) : status === 'processing' ? (
                <p className="text-xs text-amber-300 animate-pulse">
                  Executing command & updating your dashboard...
                </p>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-rose-400">
                    {errorMessage || 'Voice service encountered an issue.'}
                  </p>
                  <button
                    type="button"
                    onClick={startVoiceEngine}
                    className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-200 rounded border border-rose-500/40 hover:bg-rose-500/30 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Live Transcripts & Executed Tool Badges */}
          <div className="space-y-3 min-h-[120px] max-h-[160px] overflow-y-auto pr-1 text-xs border-t border-white/10 pt-3">
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

            {/* User Speech Transcription with Live Dynamic Feedback */}
            <div className={`p-3 rounded-2xl border transition-all duration-300 ${
              isCommandProcessed
                ? 'bg-emerald-950/30 border-emerald-500/40 shadow-xs shadow-emerald-500/20'
                : userTranscript
                ? 'bg-white/5 border-white/15'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    isCommandProcessed
                      ? 'bg-emerald-400'
                      : userTranscript
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-gray-500'
                  }`} />
                  <span className={isCommandProcessed ? 'text-emerald-400' : 'text-cyan-400'}>
                    {isCommandProcessed
                      ? 'Command Executed'
                      : userTranscript
                      ? 'Live Speech Transcription'
                      : 'Speech Recognition'}
                  </span>
                </span>
                {interimTranscript && (
                  <span className="text-[9px] text-cyan-300/80 font-normal italic animate-pulse">
                    hearing you...
                  </span>
                )}
              </div>

              {userTranscript ? (
                <p className="font-mono text-xs sm:text-sm text-white leading-relaxed font-medium">
                  “{userTranscript}”
                </p>
              ) : (
                <p className="text-gray-400 text-xs italic">
                  Say something aloud like “log breakfast 150” or “open expenses”...
                </p>
              )}
            </div>

            {/* Model Speech Transcription */}
            {modelTranscript && (
              <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-100">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-0.5">
                  Assistant Response
                </span>
                <p>{modelTranscript}</p>
              </div>
            )}
          </div>

          {/* Sample Command Quick Trigger Chips */}
          <div className="mt-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-gray-400">
                Quick commands (speak or tap to execute):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_COMMANDS.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setUserTranscript(cmd);
                    latestTranscriptRef.current = cmd;
                    handleExecuteTrigger(cmd);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 hover:text-white border border-white/10 hover:border-indigo-400/40 transition-colors cursor-pointer text-left"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or type a voice command..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
              title="Execute command"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

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
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
