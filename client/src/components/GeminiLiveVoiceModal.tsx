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
  ExternalLink,
  Info,
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
  transcribeAudioWithGroqWhisper,
  checkGeminiHealth,
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
  // Server deployment health & API key status
  const [serverHealth, setServerHealth] = useState<{ status: string; hasApiKey: boolean } | null>(null);

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

  // Live microphone audio input level (0-100) for real-time visual feedback
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // 10-second Voice Activity Detection (VAD) state
  const [vadRemainingSeconds, setVadRemainingSeconds] = useState<number>(10);
  const [hasDetectedSpeech, setHasDetectedSpeech] = useState<boolean>(false);

  // Subtle green flash glow state on successful command execution
  const [isSuccessGlow, setIsSuccessGlow] = useState<boolean>(false);

  // Refs for tracking active audio and speech instances
  const isMicActiveRef = useRef<boolean>(false);
  isMicActiveRef.current = isMicActive;

  const micStartTimeRef = useRef<number>(0);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const hasDetectedSpeechRef = useRef<boolean>(false);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioBlobChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
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

  const speechRecognitionFailedRef = useRef<boolean>(false);

  // Check backend Gemini API status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkGeminiHealth()
        .then((h) => {
          setServerHealth({ status: h.status, hasApiKey: h.hasApiKey });
        })
        .catch(() => {
          setServerHealth({ status: 'offline', hasApiKey: false });
        });
    }
  }, [isOpen]);

  // Cleanup helper to stop all audio streams & recognition
  const stopAudioTracks = useCallback(() => {
    isMicActiveRef.current = false;
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    setAudioLevel(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (pcmProcessorRef.current) {
      try {
        pcmProcessorRef.current.disconnect();
        pcmProcessorRef.current.onaudioprocess = null;
      } catch {}
      pcmProcessorRef.current = null;
    }

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
          if (res.success) {
            setIsSuccessGlow(true);
            setTimeout(() => setIsSuccessGlow(false), 2500);
          }
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
        setIsSuccessGlow(true);
        setTimeout(() => setIsSuccessGlow(false), 2500);
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
    setAudioLevel(0);
    Sound.voiceRegistered(true);

    // Stop Web Speech cleanly and allow any in-flight results to flush
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Stop MediaRecorder cleanly and wait for final chunks
    let recordedMime = 'audio/webm';
    if (mediaRecorderRef.current) {
      recordedMime = mediaRecorderRef.current.mimeType || 'audio/webm';
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    const speechText = (latestTranscriptRef.current || liveTranscript || interimText).trim();

    // Snapshot recorded audio before stopping tracks
    let recordedBlob: Blob | null = null;
    let pcmSnapshot: Float32Array[] = [...pcmChunksRef.current];
    const sampleRate = audioCtxRef.current?.sampleRate || 44100;

    if (audioBlobChunksRef.current.length > 0) {
      recordedBlob = new Blob(audioBlobChunksRef.current, { type: recordedMime });
    }

    // Now stop audio capture safely
    stopAudioTracks();

    // 1. If Web Speech produced text, execute immediately
    if (speechText) {
      setIsProcessing(true);
      await executeCommand(speechText);
      isExecutingRef.current = false;
      return;
    }

    // 2. Fallback to Gemini Transcribe if Web Speech was silent
    setIsProcessing(true);
    let lastGeminiError: any = null;
    let fallbackWavBlob: Blob | null = null;

    // Try PCM WAV first (16kHz 16-bit PCM is rock-solid and verified to work with Gemini)
    if (pcmSnapshot.length > 0) {
      try {
        let totalSamples = 0;
        for (const c of pcmSnapshot) totalSamples += c.length;

        if (totalSamples >= sampleRate * 0.25) {
          const fullPcm = new Float32Array(totalSamples);
          let offset = 0;
          for (const c of pcmSnapshot) {
            fullPcm.set(c, offset);
            offset += c.length;
          }

          const pcm16k = downsampleTo16k(fullPcm, sampleRate);
          fallbackWavBlob = encodePcmToWav(pcm16k, 16000);
          const base64 = await blobToBase64(fallbackWavBlob);

          if (base64) {
            setLiveTranscript('Transcribing speech...');
            const geminiRes = await transcribeAudioWithGemini(base64, 'audio/wav');
            if (geminiRes.transcript && geminiRes.transcript.trim()) {
              const clean = geminiRes.transcript.trim();
              setLiveTranscript(clean);
              setInterimText('');
              await executeCommand(clean);
              isExecutingRef.current = false;
              return;
            }
            if (geminiRes.error) {
              lastGeminiError = geminiRes;
            }
          }
        }
      } catch (e) {
        console.warn('PCM WAV Gemini transcription error:', e);
      }
    }

    // Try MediaRecorder Blob if PCM WAV was empty or had errors
    if (!lastGeminiError?.transcript && recordedBlob && recordedBlob.size > 200) {
      try {
        const base64 = await blobToBase64(recordedBlob);
        if (base64) {
          setLiveTranscript('Transcribing speech...');
          const mimeType = recordedBlob.type.split(';')[0] || 'audio/webm';
          const geminiRes = await transcribeAudioWithGemini(base64, mimeType);
          if (geminiRes.transcript && geminiRes.transcript.trim()) {
            const clean = geminiRes.transcript.trim();
            setLiveTranscript(clean);
            setInterimText('');
            await executeCommand(clean);
            isExecutingRef.current = false;
            return;
          }
          if (geminiRes.error) {
            lastGeminiError = geminiRes;
          }
        }
      } catch (e) {
        console.warn('MediaRecorder Gemini transcription error:', e);
      }
    }

    // 3. Fallback to Groq Whisper if available (transcribes speech reliably even without Gemini key)
    const audioForWhisper = fallbackWavBlob || recordedBlob;
    if (audioForWhisper && audioForWhisper.size > 200) {
      try {
        setLiveTranscript('Transcribing speech...');
        const whisperText = await transcribeAudioWithGroqWhisper(audioForWhisper);
        if (whisperText && whisperText.trim()) {
          const clean = whisperText.trim();
          setLiveTranscript(clean);
          setInterimText('');
          await executeCommand(clean);
          isExecutingRef.current = false;
          return;
        }
      } catch (e) {
        console.warn('Groq Whisper fallback error:', e);
      }
    }

    // 4. Handle Case where speech was heard by audio level detection, but transcription could not succeed
    if (hasDetectedSpeechRef.current) {
      if (lastGeminiError?.isMissingApiKey) {
        setAcknowledgment({
          commandText: '(Transcription API Key Missing)',
          success: false,
          message:
            'Speech was detected by your microphone, but transcription failed because GEMINI_API_KEY is not configured on this deployed server. Please set GEMINI_API_KEY in your hosting environment variables (e.g. Render/Vercel/Railway), or type your command in the prompt bar below.',
          timestamp: Date.now(),
        });
      } else if (lastGeminiError?.isOffline) {
        setAcknowledgment({
          commandText: '(Backend API Offline)',
          success: false,
          message:
            'Speech was detected, but the backend API server is offline on this deployment (/api/gemini/transcribe returned 404). Please ensure the backend Node.js server (npm start) is deployed, or type your command below.',
          timestamp: Date.now(),
        });
      } else {
        setAcknowledgment({
          commandText: '(Speech Processing Issue)',
          success: false,
          message:
            'Speech was heard from your microphone, but could not be converted to text. Please check your mic clarity or speak closer to the mic, or type your command below.',
          timestamp: Date.now(),
        });
      }
      setIsProcessing(false);
      isExecutingRef.current = false;
      return;
    }

    // Truly no sound / silence detected
    await executeCommand('');
    isExecutingRef.current = false;
  }, [liveTranscript, interimText, stopAudioTracks, executeCommand]);

  // Auto-close mic when no speech is detected after 10 seconds of inactivity
  const autoCloseInactivity = useCallback(() => {
    if (isExecutingRef.current) return;

    // If speech was detected or Web Speech captured transcript, process it!
    const speechText = (latestTranscriptRef.current || liveTranscript || interimText).trim();
    if (speechText || hasDetectedSpeechRef.current) {
      turnOffAndExecute();
      return;
    }

    // If only silence occurred, pause cleanly without displaying a red execution error
    stopAudioTracks();
    setIsMicActive(false);
    onListeningChangeRef.current?.(false);
    setAudioLevel(0);
    Sound.toggle(false);
    setLiveTranscript('');
    setInterimText('');
    setAcknowledgment({
      commandText: '(Listening paused)',
      success: false,
      message: 'Listening paused after 10 seconds of silence. Tap the microphone when you are ready to speak, or type your command below.',
      timestamp: Date.now(),
    });
  }, [stopAudioTracks, liveTranscript, interimText, turnOffAndExecute]);

  // Turn on mic and start recording / speech recognition
  const turnOnMic = useCallback(async () => {
    stopGeminiSpeech();
    setIsSpeaking(false);
    setMicError(null);
    setLiveTranscript('');
    setInterimText('');
    setAudioLevel(0);
    latestTranscriptRef.current = '';
    isExecutingRef.current = false;
    audioBlobChunksRef.current = [];
    pcmChunksRef.current = [];
    lastSpeechTimeRef.current = Date.now();
    micStartTimeRef.current = Date.now();
    hasDetectedSpeechRef.current = false;
    speechRecognitionFailedRef.current = false;
    setHasDetectedSpeech(false);
    setVadRemainingSeconds(10);

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Microphone API is not supported in this browser environment.');
      setIsMicActive(false);
      onListeningChangeRef.current?.(false);
      return;
    }

    try {
      // 1. Request microphone access with automatic fallback to basic constraints if advanced flags are overconstrained
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (firstErr: any) {
        if (
          firstErr?.name === 'OverconstrainedError' ||
          firstErr?.name === 'NotFoundError' ||
          firstErr?.name === 'DevicesNotFoundError' ||
          String(firstErr?.message || '').toLowerCase().includes('device')
        ) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw firstErr;
        }
      }

      mediaStreamRef.current = stream;
      isMicActiveRef.current = true;
      setIsMicActive(true);
      onListeningChangeRef.current?.(true);
      Sound.toggle(true);

      // 2. Setup AudioContext, AnalyserNode for volume meter & PCM processor
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);

        // Real-time audio volume visualizer analyser
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateAudioLevel = () => {
          if (!isMicActiveRef.current && !mediaStreamRef.current?.active) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // Scale 0-100
          const level = Math.min(100, Math.round((average / 75) * 100));
          setAudioLevel(level);

          // Voice Activity Detection from audio input
          // Allow an 800ms grace window after mic starts so the startup chime / click does not trip speech detection
          const elapsedSinceStart = Date.now() - micStartTimeRef.current;
          if (elapsedSinceStart > 800) {
            // Human speech volume typically registers average >= 6 or level >= 8 (above ambient room hum)
            if (average >= 6 || level >= 8) {
              hasDetectedSpeechRef.current = true;
              lastSpeechTimeRef.current = Date.now();
              setHasDetectedSpeech(true);
            }
          }

          if (isMicActiveRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(updateAudioLevel);
          }
        };
        animationFrameIdRef.current = requestAnimationFrame(updateAudioLevel);

        // PCM recording processor for raw audio fallback
        try {
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          pcmProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (!isMicActiveRef.current) return;
            const channelData = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(channelData.length);
            copy.set(channelData);
            pcmChunksRef.current.push(copy);

            // Keep up to 12 seconds of audio
            const maxChunks = Math.ceil((audioCtx.sampleRate * 12) / 4096);
            if (pcmChunksRef.current.length > maxChunks) {
              pcmChunksRef.current.splice(0, pcmChunksRef.current.length - maxChunks);
            }
          };

          source.connect(processor);
          const silenceGain = audioCtx.createGain();
          silenceGain.gain.value = 0;
          processor.connect(silenceGain);
          silenceGain.connect(audioCtx.destination);
        } catch (procErr) {
          console.warn('ScriptProcessor init warning:', procErr);
        }
      }

      // 3. Setup MediaRecorder for high-reliability audio capture
      if (typeof MediaRecorder !== 'undefined') {
        let preferredMime = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          preferredMime = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          preferredMime = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          preferredMime = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          preferredMime = 'audio/wav';
        }

        try {
          const recorder = preferredMime
            ? new MediaRecorder(stream, { mimeType: preferredMime })
            : new MediaRecorder(stream);

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioBlobChunksRef.current.push(event.data);
            }
          };

          recorder.start(250); // Slice every 250ms
          mediaRecorderRef.current = recorder;
        } catch (recErr) {
          console.warn('MediaRecorder start warning:', recErr);
        }
      }

      // 4. Setup Web Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

          rec.onaudiostart = () => {
            const elapsed = Date.now() - micStartTimeRef.current;
            if (elapsed > 800) {
              hasDetectedSpeechRef.current = true;
              lastSpeechTimeRef.current = Date.now();
            }
          };

          rec.onspeechstart = () => {
            hasDetectedSpeechRef.current = true;
            lastSpeechTimeRef.current = Date.now();
            setHasDetectedSpeech(true);
          };

          rec.onsoundstart = () => {
            const elapsed = Date.now() - micStartTimeRef.current;
            if (elapsed > 800) {
              hasDetectedSpeechRef.current = true;
              lastSpeechTimeRef.current = Date.now();
              setHasDetectedSpeech(true);
            }
          };

          rec.onresult = (event: any) => {
            hasDetectedSpeechRef.current = true;
            lastSpeechTimeRef.current = Date.now();
            setHasDetectedSpeech(true);

            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTranscript += res[0].transcript + ' ';
              } else {
                interimTranscript += res[0].transcript;
              }
            }

            const combined = (finalTranscript + interimTranscript).trim();
            if (combined) {
              latestTranscriptRef.current = combined;
            }

            if (finalTranscript.trim()) {
              setLiveTranscript(finalTranscript.trim());
            }
            setInterimText(interimTranscript.trim());
          };

          rec.onerror = (event: any) => {
            console.warn('SpeechRecognition warning:', event.error);
            if (
              event.error === 'not-allowed' ||
              event.error === 'service-not-allowed' ||
              event.error === 'audio-capture' ||
              event.error === 'network'
            ) {
              speechRecognitionFailedRef.current = true;
            }
          };

          rec.onend = () => {
            if (
              isMicActiveRef.current &&
              !isExecutingRef.current &&
              !speechRecognitionFailedRef.current
            ) {
              try {
                rec.start();
              } catch {}
            }
          };

          rec.start();
          recognitionRef.current = rec;
        } catch (recInitErr) {
          console.warn('SpeechRecognition init error:', recInitErr);
        }
      }
    } catch (err: any) {
      console.warn('Microphone access not granted:', err?.name, err?.message || err);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        (err?.message && String(err.message).toLowerCase().includes('denied'));

      const isNotFound =
        err?.name === 'NotFoundError' ||
        err?.name === 'DevicesNotFoundError' ||
        (err?.message && String(err.message).toLowerCase().includes('not found')) ||
        (err?.message && String(err.message).toLowerCase().includes('device'));

      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      let errorMessage = 'Unable to start microphone: ' + (err?.message || 'Please check device permissions.');
      if (isDenied) {
        errorMessage = isInIframe
          ? 'Microphone permission could not be acquired inside the preview iframe. Browsers often restrict microphone access within embedded preview frames. Click "Open in New Tab" below to test with direct microphone access.'
          : 'Microphone permission was denied. Tap "Grant Permission / Retry" below or check your browser address bar settings to allow microphone access.';
      } else if (isNotFound) {
        errorMessage = 'No audio input hardware detected (Requested device not found). Please connect an external microphone or headset, verify system audio settings, or type commands directly into the prompt bar below.';
      }

      setMicError(errorMessage);
      setIsMicActive(false);
      isMicActiveRef.current = false;
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

  // 10-second Voice Activity Detection (VAD) Timeout & Automatic Speech Endpointing Loop
  useEffect(() => {
    if (!isMicActive) return;

    const vadInterval = setInterval(() => {
      if (!isMicActiveRef.current || isExecutingRef.current) return;

      const now = Date.now();

      // Case A: No speech detected yet since microphone was turned on
      if (!hasDetectedSpeechRef.current) {
        const elapsed = now - micStartTimeRef.current;
        const remaining = Math.max(0, Math.ceil((10000 - elapsed) / 1000));
        setVadRemainingSeconds(remaining);

        // 10-second VAD timeout: automatically stop listening if no speech is detected
        if (elapsed >= 10000) {
          clearInterval(vadInterval);
          autoCloseInactivity();
        }
      } else {
        // Case B: Speech detected! Check for end-of-speech silence (sentence completion)
        const silenceElapsed = now - lastSpeechTimeRef.current;
        // If user finished speaking and has been silent for 2.8 seconds, auto-execute command!
        if (silenceElapsed >= 2800) {
          clearInterval(vadInterval);
          turnOffAndExecute();
        }
      }
    }, 100);

    return () => {
      clearInterval(vadInterval);
    };
  }, [isMicActive, autoCloseInactivity, turnOffAndExecute]);

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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close voice assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Server Config Notice if Gemini key is missing on deployed host */}
          {serverHealth && (!serverHealth.hasApiKey || serverHealth.status === 'offline') && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-300">
                  {serverHealth.status === 'offline' ? 'Backend Server Unreachable' : 'GEMINI_API_KEY Not Set on Host'}
                </p>
                <p className="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
                  {serverHealth.status === 'offline'
                    ? 'The full-stack server is offline on this URL. Voice will use browser recognition or Groq Whisper, or type commands below.'
                    : 'To enable Gemini audio transcription in production, add GEMINI_API_KEY to your deployment host environment variables.'}
                </p>
              </div>
            </div>
          )}

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
                {typeof window !== 'undefined' && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in New Tab
                  </a>
                )}
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
            <div className="mt-4 flex flex-col items-center gap-1.5 text-center min-h-[44px]">
              {isProcessing ? (
                <span className="text-amber-300 text-xs font-semibold animate-pulse flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing voice command...
                </span>
              ) : isMicActive ? (
                hasDetectedSpeech ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-emerald-300 text-xs font-bold flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Voice detected ({audioLevel}%)
                    </span>
                    <span className="text-[11px] text-emerald-400/80 font-medium">
                      Auto-executes when you finish speaking (or tap mic)
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-rose-300 text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                      Listening... Speak your command now
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium">
                      <span>Auto-pauses in {vadRemainingSeconds}s if silent</span>
                      <div className="flex items-center gap-1 ml-0.5">
                        {[2, 4, 6, 8, 10].map((step) => (
                          <span
                            key={step}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              vadRemainingSeconds >= step ? 'bg-amber-400' : 'bg-amber-400/20'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              ) : isSpeaking ? (
                <span className="text-purple-300 text-xs font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                  Speaking response...
                </span>
              ) : (
                <span className="text-gray-400 text-xs font-medium">Tap mic to speak command</span>
              )}
            </div>
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
                <div
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                    hasDetectedSpeech
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span
                      className={`w-1 rounded-full transition-all duration-75 ${
                        hasDetectedSpeech ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                      style={{
                        height: `${Math.max(4, Math.min(14, hasDetectedSpeech ? (audioLevel * 0.14) + 4 : 5))}px`,
                      }}
                    />
                    <span
                      className={`w-1 rounded-full transition-all duration-75 ${
                        hasDetectedSpeech ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                      style={{
                        height: `${Math.max(4, Math.min(14, hasDetectedSpeech ? (audioLevel * 0.18) + 6 : 9))}px`,
                      }}
                    />
                    <span
                      className={`w-1 rounded-full transition-all duration-75 ${
                        hasDetectedSpeech ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                      style={{
                        height: `${Math.max(4, Math.min(14, hasDetectedSpeech ? (audioLevel * 0.14) + 4 : 5))}px`,
                      }}
                    />
                  </div>
                  <span>{hasDetectedSpeech ? 'HEARING VOICE' : `VAD: ${vadRemainingSeconds}s`}</span>
                </div>
              ) : isProcessing ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-semibold animate-pulse">
                  PROCESSING
                </span>
              ) : liveTranscript ? (
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Captured
                </span>
              ) : null}
            </div>

            {/* Dedicated Transcript Container with Large Readable Typography */}
            <div
              ref={transcriptContainerRef}
              className={`relative min-h-[130px] max-h-[190px] overflow-y-auto p-4 sm:p-5 rounded-2xl transition-all duration-200 border ${
                isMicActive
                  ? hasDetectedSpeech
                    ? 'bg-gradient-to-b from-[#0B1A14] to-[#0A1210] border-emerald-500/50 ring-2 ring-emerald-500/30 shadow-inner'
                    : 'bg-gradient-to-b from-[#140F14] to-[#0D0A0E] border-rose-500/40 ring-2 ring-rose-500/20 shadow-inner'
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
                      <span
                        className={`inline-block w-2.5 h-5 ml-1.5 align-middle animate-pulse rounded-sm ${
                          hasDetectedSpeech ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                    )}
                  </p>
                </div>
              ) : (
                <div className="h-full min-h-[90px] flex flex-col items-center justify-center text-center p-2">
                  {isMicActive ? (
                    <div className="flex flex-col items-center gap-1.5">
                      {hasDetectedSpeech ? (
                        <>
                          <p className="text-lg sm:text-xl font-semibold text-emerald-300">
                            Hearing your voice...
                          </p>
                          <p className="text-xs text-emerald-400/80">
                            Transcribing words in real-time
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg sm:text-xl font-medium text-rose-300 animate-pulse">
                            Listening... speak your command now
                          </p>
                          <p className="text-xs text-amber-300/80">
                            Auto-pauses in {vadRemainingSeconds}s if no speech is detected
                          </p>
                        </>
                      )}
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
                  {!acknowledgment.success && !isMicActive && !isProcessing && (
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={turnOnMic}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Tap to speak again
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
