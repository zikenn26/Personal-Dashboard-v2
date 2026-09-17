import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  Radio,
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
import { encodePcmToWav, downsampleTo16k, blobToBase64 } from '../utils/audioUtils';
import { Sound } from '../utils/audio';

interface GeminiLiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: any, tabOrFilter?: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  onOpenCommandMappings?: () => void;
  onCommandExecuted?: (commandText: string) => void;
}

interface CommandAcknowledgment {
  commandText: string;
  success: boolean;
  message: string;
  timestamp: number;
}

export const GeminiLiveVoiceModal: React.FC<GeminiLiveVoiceModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onListeningChange,
  onCommandExecuted,
}) => {
  // Mic state: whether active listening is on or off
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Live transcript state
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');

  // Command execution acknowledgment
  const [acknowledgment, setAcknowledgment] = useState<CommandAcknowledgment | null>(null);

  // Error message if mic permission is denied
  const [micError, setMicError] = useState<string | null>(null);
  const [fallbackCommandText, setFallbackCommandText] = useState<string>('');

  // Refs for tracking active audio and speech instances
  const isMicActiveRef = useRef<boolean>(false);
  isMicActiveRef.current = isMicActive;

  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const latestTranscriptRef = useRef<string>('');
  const isExecutingRef = useRef<boolean>(false);

  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const onCommandExecutedRef = useRef(onCommandExecuted);
  onCommandExecutedRef.current = onCommandExecuted;

  // Cleanup helper to stop all audio streams & recognition
  const stopAudioTracks = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (pcmProcessorRef.current) {
      try {
        pcmProcessorRef.current.disconnect();
        pcmProcessorRef.current.onaudioprocess = null;
      } catch {}
      pcmProcessorRef.current = null;
    }
    pcmChunksRef.current = [];

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // Execute command handler
  const executeCommand = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) {
        setAcknowledgment({
          commandText: '(No speech detected)',
          success: false,
          message: 'No speech was detected. Tap the mic and speak your command.',
          timestamp: Date.now(),
        });
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      Sound.voiceProcessing(true);

      // Check if command matches registered triggers
      const match = matchCommandTrigger(trimmed);
      if (match) {
        try {
          const res = await executeCommandMapping(match.mapping, match.extractedParams);
          Sound.success(true);

          const resultAck: CommandAcknowledgment = {
            commandText: trimmed,
            success: res.success,
            message: res.message || (res.success ? 'Command executed successfully.' : 'Execution failed.'),
            timestamp: Date.now(),
          };

          setAcknowledgment(resultAck);
          onCommandExecutedRef.current?.(trimmed);

          if (match.mapping.actionType === 'navigate_view' && onNavigateRef.current && res.details?.view) {
            onNavigateRef.current(res.details.view);
          }

          setIsSpeaking(true);
          await speakTextWithGemini(res.message, 'Zephyr', () => {
            setIsSpeaking(false);
          });
        } catch (err: any) {
          Sound.error(true);
          setAcknowledgment({
            commandText: trimmed,
            success: false,
            message: err?.message || 'Error executing command.',
            timestamp: Date.now(),
          });
        }
        setIsProcessing(false);
        return;
      }

      // Fallback: AI Secretary
      try {
        const response = await sendGeminiMessage({
          message: trimmed,
          history: [],
        });

        const reply = response.reply || 'Command processed.';
        Sound.success(true);

        const resultAck: CommandAcknowledgment = {
          commandText: trimmed,
          success: true,
          message: reply,
          timestamp: Date.now(),
        };

        setAcknowledgment(resultAck);
        onCommandExecutedRef.current?.(trimmed);

        setIsSpeaking(true);
        await speakTextWithGemini(reply, 'Zephyr', () => {
          setIsSpeaking(false);
        });
      } catch (err: any) {
        Sound.error(true);
        setAcknowledgment({
          commandText: trimmed,
          success: false,
          message: err?.message || 'Failed to process command with AI.',
          timestamp: Date.now(),
        });
      }

      setIsProcessing(false);
    },
    []
  );

  // Turn off mic and process whatever was heard
  const turnOffAndExecute = useCallback(async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    setIsMicActive(false);
    onListeningChangeRef.current?.(false);
    Sound.voiceRegistered(true);

    const speechText = (latestTranscriptRef.current || liveTranscript || interimText).trim();

    // Stop audio capture first
    stopAudioTracks();

    if (speechText) {
      setIsProcessing(true);
      await executeCommand(speechText);
      isExecutingRef.current = false;
      return;
    }

    // If Web Speech did not yield text, check if we have recorded PCM frames
    if (pcmChunksRef.current.length > 0) {
      setIsProcessing(true);
      try {
        const chunks = [...pcmChunksRef.current];
        pcmChunksRef.current = [];

        let totalSamples = 0;
        for (const c of chunks) totalSamples += c.length;

        const sampleRate = audioCtxRef.current?.sampleRate || 44100;
        if (totalSamples >= sampleRate * 0.3) {
          const fullPcm = new Float32Array(totalSamples);
          let offset = 0;
          for (const c of chunks) {
            fullPcm.set(c, offset);
            offset += c.length;
          }

          const pcm16k = downsampleTo16k(fullPcm, sampleRate);
          const wavBlob = encodePcmToWav(pcm16k, 16000);
          const base64 = await blobToBase64(wavBlob);

          if (base64) {
            const transcript = await transcribeAudioWithGemini(base64, 'audio/wav');
            if (transcript && transcript.trim()) {
              const clean = transcript.trim();
              setLiveTranscript(clean);
              await executeCommand(clean);
              isExecutingRef.current = false;
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Audio transcription error:', e);
      }
    }

    // Nothing was spoken
    await executeCommand('');
    isExecutingRef.current = false;
  }, [liveTranscript, interimText, stopAudioTracks, executeCommand]);

  // Turn on mic and start recording / speech recognition
  const turnOnMic = useCallback(async () => {
    stopGeminiSpeech();
    setIsSpeaking(false);
    setMicError(null);
    setLiveTranscript('');
    setInterimText('');
    latestTranscriptRef.current = '';
    isExecutingRef.current = false;

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Microphone API is not supported in this browser environment.');
      setIsMicActive(false);
      onListeningChangeRef.current?.(false);
      return;
    }

    try {
      // 1. Setup AudioContext & PCM recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        pcmProcessorRef.current = processor;
        pcmChunksRef.current = [];

        processor.onaudioprocess = (e) => {
          if (!isMicActiveRef.current) return;
          const channelData = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(channelData.length);
          copy.set(channelData);
          pcmChunksRef.current.push(copy);

          // Keep up to 10 seconds of audio
          const maxChunks = Math.ceil((audioCtx.sampleRate * 10) / 4096);
          if (pcmChunksRef.current.length > maxChunks) {
            pcmChunksRef.current.splice(0, pcmChunksRef.current.length - maxChunks);
          }
        };

        source.connect(processor);
        const silenceGain = audioCtx.createGain();
        silenceGain.gain.value = 0;
        processor.connect(silenceGain);
        silenceGain.connect(audioCtx.destination);
      }

      // 2. Setup Web Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let accumulated = '';
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulated += transcriptChunk;
            } else {
              interim += transcriptChunk;
            }
          }

          const fullText = (accumulated || interim || '').trim();
          if (fullText) {
            latestTranscriptRef.current = fullText;
          }

          if (accumulated) {
            setLiveTranscript(accumulated);
            setInterimText('');
          } else if (interim) {
            setInterimText(interim);
          }
        };

        rec.onerror = (event: any) => {
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('SpeechRecognition warning:', event.error);
          }
        };

        rec.onend = () => {
          if (isMicActiveRef.current) {
            try {
              rec.start();
            } catch {}
          }
        };

        rec.start();
        recognitionRef.current = rec;
      }

      setIsMicActive(true);
      onListeningChangeRef.current?.(true);
      Sound.toggle(true);
    } catch (err: any) {
      console.warn('Microphone access not granted:', err?.name, err?.message || err);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        (err?.message && String(err.message).toLowerCase().includes('denied'));

      setMicError(
        isDenied
          ? 'Microphone permission was denied. Tap "Grant Permission" below or check your browser address bar settings to allow microphone access.'
          : 'Unable to start microphone: ' + (err?.message || 'Please check device permissions.')
      );
      setIsMicActive(false);
      onListeningChangeRef.current?.(false);
    }
  }, []);

  // Toggle Mic on/off
  const handleToggleMic = useCallback(() => {
    if (isProcessing) return;

    if (isMicActive) {
      // Turn off and execute
      turnOffAndExecute();
    } else {
      // Turn on
      turnOnMic();
    }
  }, [isProcessing, isMicActive, turnOffAndExecute, turnOnMic]);

  // Lifecycle: open/close handling
  useEffect(() => {
    if (!isOpen) {
      stopGeminiSpeech();
      stopAudioTracks();
      setIsMicActive(false);
      setIsProcessing(false);
      setIsSpeaking(false);
      setLiveTranscript('');
      setInterimText('');
      setAcknowledgment(null);
      setMicError(null);
      onListeningChangeRef.current?.(false);
      return;
    }

    // Modal opened: keep mic in ready state waiting for user click
    setIsMicActive(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    setLiveTranscript('');
    setInterimText('');
    setAcknowledgment(null);
    setMicError(null);

    return () => {
      stopGeminiSpeech();
      stopAudioTracks();
      onListeningChangeRef.current?.(false);
    };
  }, [isOpen, stopAudioTracks]);

  // Auto-scroll transcript container as speech arrives
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [liveTranscript, interimText]);

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

        {/* Streamlined Assistant Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#161B22] to-[#0D1117] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col p-5 sm:p-6 z-10"
        >
          {/* Header: Title & Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isMicActive
                    ? 'bg-rose-500 animate-ping'
                    : isProcessing
                    ? 'bg-amber-400 animate-pulse'
                    : isSpeaking
                    ? 'bg-purple-400'
                    : 'bg-emerald-400'
                }`}
              />
              <h2 className="text-sm font-semibold tracking-tight text-white">
                Voice Assistant
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close voice assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Message if Mic is Denied */}
          {micError && (
            <div className="mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-snug">{micError}</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setMicError(null);
                    turnOnMic();
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  Grant Permission / Retry
                </button>
                <button
                  type="button"
                  onClick={() => setMicError(null)}
                  className="px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              {/* Text Fallback if mic cannot be used */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (fallbackCommandText.trim()) {
                    executeCommand(fallbackCommandText.trim());
                    setFallbackCommandText('');
                  }
                }}
                className="flex items-center gap-1.5 mt-1"
              >
                <input
                  type="text"
                  value={fallbackCommandText}
                  onChange={(e) => setFallbackCommandText(e.target.value)}
                  placeholder="Or type command here..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-400"
                />
                <button
                  type="submit"
                  disabled={!fallbackCommandText.trim() || isProcessing}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Run
                </button>
              </form>
            </div>
          )}

          {/* Central Mic Button Area */}
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              {/* Pulsing Ripple Rings when Mic is ON */}
              {isMicActive && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-28 h-28 rounded-full bg-rose-500/25 pointer-events-none"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    className="absolute w-24 h-24 rounded-full bg-rose-500/30 pointer-events-none"
                  />
                </>
              )}

              {/* The Dedicated Mic Button */}
              <motion.button
                type="button"
                onClick={handleToggleMic}
                disabled={isProcessing}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 cursor-pointer ${
                  isProcessing
                    ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white ring-4 ring-amber-400/40 shadow-amber-500/40'
                    : isMicActive
                    ? 'bg-gradient-to-tr from-rose-600 via-rose-500 to-red-500 text-white ring-4 ring-rose-400/50 shadow-rose-500/50 animate-pulse'
                    : isSpeaking
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white ring-2 ring-purple-400/40 shadow-purple-500/30'
                    : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-600 text-white ring-2 ring-indigo-400/30 shadow-indigo-500/30 hover:shadow-indigo-500/50'
                }`}
                aria-label={isMicActive ? 'Turn off mic and execute command' : 'Turn on microphone'}
              >
                {isProcessing ? (
                  <Loader2 className="w-10 h-10 animate-spin text-white" />
                ) : isSpeaking ? (
                  <Volume2 className="w-10 h-10 text-white animate-bounce" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </motion.button>
            </div>

            {/* Mic State Action Prompt */}
            <p className="mt-4 text-xs font-medium text-center">
              {isProcessing ? (
                <span className="text-amber-300 animate-pulse">Executing command...</span>
              ) : isMicActive ? (
                <span className="text-rose-300 font-semibold">
                  Listening... Tap mic to execute
                </span>
              ) : isSpeaking ? (
                <span className="text-purple-300">Speaking response...</span>
              ) : (
                <span className="text-gray-400">Tap mic to speak</span>
              )}
            </p>
          </div>

          {/* Dedicated Live Transcript Display Area */}
          <div className="mb-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  Live Speech Transcript
                </span>
              </div>

              {isMicActive ? (
                <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-semibold">
                  <div className="flex items-center gap-0.5 h-2.5">
                    <span className="w-1 h-2.5 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-3.5 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce" />
                  </div>
                  <span>LISTENING</span>
                </div>
              ) : isProcessing ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-semibold animate-pulse">
                  PROCESSING
                </span>
              ) : liveTranscript ? (
                <span className="text-[11px] font-medium text-gray-400">
                  Captured
                </span>
              ) : null}
            </div>

            {/* Dedicated Transcript Container with Large Readable Typography */}
            <div
              ref={transcriptContainerRef}
              className={`relative min-h-[130px] max-h-[190px] overflow-y-auto p-4 sm:p-5 rounded-2xl transition-all duration-200 border ${
                isMicActive
                  ? 'bg-gradient-to-b from-[#0F141C] to-[#0A0D14] border-rose-500/40 ring-2 ring-rose-500/20 shadow-inner'
                  : 'bg-[#0B0F15] border-white/10 shadow-inner'
              }`}
            >
              {liveTranscript || interimText ? (
                <div className="relative">
                  <p className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-relaxed select-text">
                    “{liveTranscript}
                    {interimText && !liveTranscript.endsWith(interimText) && (
                      <span className="text-rose-400 font-semibold ml-1.5 animate-pulse">
                        {interimText}
                      </span>
                    )}
                    ”
                    {isMicActive && (
                      <span className="inline-block w-2.5 h-5 ml-1.5 align-middle bg-rose-400 animate-pulse rounded-sm" />
                    )}
                  </p>
                </div>
              ) : (
                <div className="h-full min-h-[90px] flex flex-col items-center justify-center text-center p-2">
                  {isMicActive ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <p className="text-lg sm:text-xl font-medium text-rose-300 animate-pulse">
                        Listening... speak your command now
                      </p>
                      <p className="text-xs text-gray-400">
                        Words appear here in large real-time text
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-base sm:text-lg font-medium text-gray-400">
                        Tap the microphone above to start
                      </p>
                      <p className="text-xs text-gray-500">
                        Speech will appear here in real-time as you talk
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Command Acknowledgment Card */}
          <AnimatePresence>
            {acknowledgment && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className={`p-3.5 rounded-2xl border text-xs transition-colors ${
                  acknowledgment.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                    {acknowledgment.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400">Performed Successfully</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-amber-400">Could Not Perform</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-gray-300">
                    <span className="font-semibold text-gray-400">Command: </span>
                    <span className="font-mono text-white">“{acknowledgment.commandText}”</span>
                  </p>
                  <p className="text-xs text-white/90 leading-relaxed">
                    {acknowledgment.message}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
