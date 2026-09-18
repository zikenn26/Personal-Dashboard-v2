import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mic,
  Volume2,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Wifi,
  X,
  Radio,
  Layers,
  HelpCircle,
  ChevronRight,
  Info,
} from 'lucide-react';
import { encodePcmToWav } from '../utils/audioUtils';

export type DiagnosticStatus = 'idle' | 'running' | 'pass' | 'warning' | 'fail';

export interface DiagnosticItem {
  id: string;
  name: string;
  category: 'browser' | 'permission' | 'audio' | 'network' | 'speech';
  status: DiagnosticStatus;
  title: string;
  details: string;
  recommendation?: string;
  metrics?: Record<string, any>;
}

interface VoiceDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryVoiceAssistant?: () => void;
}

export const VoiceDiagnosticModal: React.FC<VoiceDiagnosticModalProps> = ({
  isOpen,
  onClose,
  onRetryVoiceAssistant,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'browser' | 'permission' | 'audio' | 'network'>('all');
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Live Sound Check State
  const [isSoundChecking, setIsSoundChecking] = useState<boolean>(false);
  const [soundCheckSecondsLeft, setSoundCheckSecondsLeft] = useState<number>(0);
  const [liveAudioLevel, setLiveAudioLevel] = useState<number>(0);
  const [peakAudioLevel, setPeakAudioLevel] = useState<number>(0);
  const [soundCheckResult, setSoundCheckResult] = useState<{
    tested: boolean;
    hasVoice: boolean;
    peak: number;
  }>({ tested: false, hasVoice: false, peak: 0 });

  // Audio Stream Refs for sound check
  const soundCheckStreamRef = useRef<MediaStream | null>(null);
  const soundCheckAudioCtxRef = useRef<AudioContext | null>(null);
  const soundCheckAnimFrameRef = useRef<number | null>(null);

  // Diagnostic Results State
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    {
      id: 'secure-context',
      name: 'Secure Context (HTTPS / Localhost)',
      category: 'browser',
      status: 'idle',
      title: 'Pending check',
      details: 'Microphone access requires a secure origin (HTTPS or localhost).',
    },
    {
      id: 'iframe-isolation',
      name: 'Iframe & Permissions Policy',
      category: 'browser',
      status: 'idle',
      title: 'Pending check',
      details: 'Checks if running inside an iframe and whether microphone access is allowed.',
    },
    {
      id: 'web-speech-api',
      name: 'Web Speech Recognition Engine',
      category: 'browser',
      status: 'idle',
      title: 'Pending check',
      details: 'Checks if browser supports window.SpeechRecognition or webkitSpeechRecognition.',
    },
    {
      id: 'audio-context-api',
      name: 'Web Audio API & MediaRecorder',
      category: 'browser',
      status: 'idle',
      title: 'Pending check',
      details: 'Required for real-time volume visualizer and raw PCM fallback capture.',
    },
    {
      id: 'mic-permission',
      name: 'Microphone Permission State',
      category: 'permission',
      status: 'idle',
      title: 'Pending check',
      details: 'Queries the browser permissions API and tests getUserMedia authorization.',
    },
    {
      id: 'audio-input-devices',
      name: 'Physical Audio Input Devices',
      category: 'permission',
      status: 'idle',
      title: 'Pending check',
      details: 'Enumerates connected hardware microphones.',
    },
    {
      id: 'sound-level-check',
      name: 'Live Microphone Audio Signal',
      category: 'audio',
      status: 'idle',
      title: 'Pending check',
      details: 'Tests whether live audio amplitude can be read from the microphone.',
    },
    {
      id: 'network-server-health',
      name: 'AI Backend Server Connectivity',
      category: 'network',
      status: 'idle',
      title: 'Pending check',
      details: 'Pings /api/gemini/health to verify local proxy and GEMINI_API_KEY.',
    },
    {
      id: 'gemini-transcribe-api',
      name: 'Gemini Cloud Transcription API',
      category: 'network',
      status: 'idle',
      title: 'Pending check',
      details: 'Verifies audio transcription endpoint (/api/gemini/transcribe) responds without errors.',
    },
  ]);

  const updateItem = useCallback((id: string, updates: Partial<DiagnosticItem>) => {
    setDiagnostics((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  // Cleanup helper for sound check
  const stopSoundCheck = useCallback(() => {
    if (soundCheckAnimFrameRef.current) {
      cancelAnimationFrame(soundCheckAnimFrameRef.current);
      soundCheckAnimFrameRef.current = null;
    }
    if (soundCheckStreamRef.current) {
      soundCheckStreamRef.current.getTracks().forEach((track) => track.stop());
      soundCheckStreamRef.current = null;
    }
    if (soundCheckAudioCtxRef.current) {
      try {
        soundCheckAudioCtxRef.current.close();
      } catch {}
      soundCheckAudioCtxRef.current = null;
    }
    setIsSoundChecking(false);
    setLiveAudioLevel(0);
  }, []);

  // 1. Browser & Environment Check
  const runBrowserDiagnostics = useCallback(async () => {
    // A. Secure Context
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    updateItem('secure-context', {
      status: isSecure ? 'pass' : 'fail',
      title: isSecure ? 'Secure Context Active' : 'Insecure Context Detected',
      details: isSecure
        ? `Protocol: ${window.location.protocol}//${window.location.host}. Microphone APIs are permitted.`
        : `Protocol: ${window.location.protocol}. Browsers block microphone on non-HTTPS origins!`,
      recommendation: isSecure
        ? undefined
        : 'Please access the application over HTTPS or via localhost.',
    });

    // B. Iframe Isolation
    const isInsideIframe = window.self !== window.top;
    updateItem('iframe-isolation', {
      status: isInsideIframe ? 'warning' : 'pass',
      title: isInsideIframe ? 'Running in Iframe Preview' : 'Top-Level Window (No Iframe)',
      details: isInsideIframe
        ? 'Application is embedded in an iframe preview. Some browsers (Chrome/Brave) restrict speech recognition inside iframes without explicit parent permission.'
        : 'Running in a standalone top-level browser window with full hardware capabilities.',
      recommendation: isInsideIframe
        ? 'If transcripts remain empty, click "Open in New Tab" at the top right to open the dashboard directly in a full browser tab.'
        : undefined,
    });

    // C. Web Speech API
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const hasWebSpeech = Boolean(SpeechRecognitionClass);
    updateItem('web-speech-api', {
      status: hasWebSpeech ? 'pass' : 'warning',
      title: hasWebSpeech ? 'Web Speech API Available' : 'Web Speech API Not Supported',
      details: hasWebSpeech
        ? `Found ${(window as any).SpeechRecognition ? 'standard SpeechRecognition' : 'webkitSpeechRecognition'}. Provides instant speech-to-text.`
        : 'This browser does not support the Web Speech API (common in Firefox/Brave). The Gemini Cloud Transcribe fallback will be used instead.',
      recommendation: hasWebSpeech
        ? undefined
        : 'For optimal real-time typing, use Google Chrome, Microsoft Edge, or Apple Safari.',
    });

    // D. AudioContext & MediaRecorder
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const hasAudioCtx = Boolean(AudioCtxClass);
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const supportedMimes: string[] = [];
    if (hasMediaRecorder) {
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'].forEach((mime) => {
        if (MediaRecorder.isTypeSupported(mime)) supportedMimes.push(mime);
      });
    }

    const audioApiPass = hasAudioCtx && hasMediaRecorder;
    updateItem('audio-context-api', {
      status: audioApiPass ? 'pass' : 'fail',
      title: audioApiPass ? 'AudioContext & MediaRecorder Ready' : 'Audio APIs Missing',
      details: audioApiPass
        ? `AudioContext: available. MediaRecorder codecs: ${supportedMimes.join(', ') || 'basic'}.`
        : `AudioContext: ${hasAudioCtx ? 'yes' : 'no'}, MediaRecorder: ${hasMediaRecorder ? 'yes' : 'no'}. Fallback recording may fail.`,
      recommendation: audioApiPass
        ? undefined
        : 'Update your browser to a recent version supporting the Web Audio API.',
    });
  }, [updateItem]);

  // 2. Microphone Permissions & Hardware Devices Check
  const runPermissionDiagnostics = useCallback(async () => {
    updateItem('mic-permission', { status: 'running', title: 'Checking permissions...', details: 'Querying browser permission status...' });
    updateItem('audio-input-devices', { status: 'running', title: 'Scanning devices...', details: 'Enumerating audio input hardware...' });

    // Check navigator.permissions if available
    let permState: PermissionState | 'unknown' = 'unknown';
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        permState = status.state;
      } catch {
        permState = 'unknown';
      }
    }

    // Try live test with getUserMedia
    let stream: MediaStream | null = null;
    let micGranted = false;
    let permError = '';

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micGranted = true;
      } catch (err: any) {
        permError = err?.name || err?.message || 'Permission denied';
      }
    } else {
      permError = 'navigator.mediaDevices.getUserMedia is not supported';
    }

    // Update mic-permission diagnostic
    if (micGranted) {
      updateItem('mic-permission', {
        status: 'pass',
        title: 'Microphone Permission Granted',
        details: `Microphone access was successfully authorized (Permission API: ${permState}). Audio tracks are accessible.`,
      });
    } else if (permState === 'denied' || permError.includes('NotAllowed') || permError.includes('PermissionDenied')) {
      updateItem('mic-permission', {
        status: 'fail',
        title: 'Microphone Permission Blocked / Denied',
        details: `The browser or operating system denied microphone access (${permError}).`,
        recommendation:
          'Click the lock/settings icon in your browser address bar -> Permissions -> allow "Microphone", then refresh.',
      });
    } else {
      updateItem('mic-permission', {
        status: 'warning',
        title: 'Microphone Needs Authorization',
        details: `Permission is currently in '${permState}' state. When prompted, you must click "Allow". (${permError})`,
        recommendation: 'Tap the microphone button in the voice assistant and click "Allow" on the browser popup.',
      });
    }

    // Check audio input devices
    let inputDevices: MediaDeviceInfo[] = [];
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        inputDevices = allDevices.filter((d) => d.kind === 'audioinput');
      } catch (devErr: any) {
        console.warn('enumerateDevices error:', devErr);
      }
    }

    if (inputDevices.length > 0) {
      const labels = inputDevices.map((d) => d.label || 'Default Microphone').filter(Boolean);
      updateItem('audio-input-devices', {
        status: 'pass',
        title: `${inputDevices.length} Audio Input Device(s) Detected`,
        details: `Found microphones: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ` (+${labels.length - 3} more)` : ''}.`,
      });
    } else {
      updateItem('audio-input-devices', {
        status: 'warning',
        title: 'No Specific Audio Devices Listed',
        details: micGranted
          ? 'Default system microphone is working, but specific device names are hidden by browser privacy settings.'
          : 'No microphones were detected. Ensure a headset or microphone is plugged in.',
        recommendation: micGranted ? undefined : 'Connect a working microphone or headset to your device.',
      });
    }

    // Clean up temporary stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  }, [updateItem]);

  // 3. Network & Gemini Cloud AI Check
  const runNetworkDiagnostics = useCallback(async () => {
    updateItem('network-server-health', { status: 'running', title: 'Connecting to server...', details: 'Testing backend /api/gemini/health...' });
    updateItem('gemini-transcribe-api', { status: 'running', title: 'Testing AI model...', details: 'Testing audio transcription pipeline...' });

    // A. Ping /api/gemini/health
    const startTime = Date.now();
    let healthData: any = null;
    let isServerOk = false;

    try {
      const res = await fetch('/api/gemini/health', { method: 'GET' });
      const latency = Date.now() - startTime;
      if (res.ok) {
        healthData = await res.json();
        isServerOk = true;
        updateItem('network-server-health', {
          status: healthData.hasApiKey ? 'pass' : 'warning',
          title: healthData.hasApiKey ? 'AI Server Connected (API Key Active)' : 'AI Server Connected (No API Key)',
          details: `Connected to backend in ${latency}ms. Default Model: ${healthData.defaultModel || 'gemini-3.8-flash'}. GEMINI_API_KEY is ${healthData.hasApiKey ? 'configured' : 'missing'}.`,
          recommendation: healthData.hasApiKey
            ? undefined
            : 'Add your GEMINI_API_KEY in Settings > Secrets to enable cloud transcription and voice AI.',
        });
      } else {
        updateItem('network-server-health', {
          status: 'fail',
          title: `Server Error HTTP ${res.status}`,
          details: `The health endpoint returned status ${res.status}: ${res.statusText}`,
          recommendation: 'Check that the dev server is running properly on port 3000.',
        });
      }
    } catch (err: any) {
      updateItem('network-server-health', {
        status: 'fail',
        title: 'Cannot Connect to Server',
        details: `Network request to /api/gemini/health failed: ${err?.message || 'Failed to fetch'}`,
        recommendation: 'Verify your internet connection and ensure the server is running.',
      });
    }

    // B. Test /api/gemini/transcribe with a micro dummy sample
    if (isServerOk && healthData?.hasApiKey) {
      try {
        // Create 0.2s 16kHz silent WAV (6400 bytes)
        const dummyPcm = new Float32Array(3200);
        const dummyWavBlob = encodePcmToWav(dummyPcm, 16000);
        const reader = new FileReader();

        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const b64 = (reader.result as string)?.split(',')[1] || '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(dummyWavBlob);
        });

        const base64Data = await base64Promise;
        const transcribeRes = await fetch('/api/gemini/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64Data, mimeType: 'audio/wav', isDiagnosticTest: true }),
        });

        if (transcribeRes.ok) {
          const transData = await transcribeRes.json();
          updateItem('gemini-transcribe-api', {
            status: 'pass',
            title: 'Gemini Transcription API Verified',
            details: 'Model responded successfully to test audio payload. Cloud AI fallback is operational.',
          });
        } else {
          const errBody = await transcribeRes.json().catch(() => ({}));
          updateItem('gemini-transcribe-api', {
            status: 'warning',
            title: `Transcription API Status ${transcribeRes.status}`,
            details: errBody?.error || errBody?.warning || transcribeRes.statusText,
            recommendation: 'If quota limits are reached, the assistant will retry with lighter models automatically.',
          });
        }
      } catch (transErr: any) {
        updateItem('gemini-transcribe-api', {
          status: 'warning',
          title: 'Transcription Ping Interrupted',
          details: `Could not verify transcribe endpoint: ${transErr?.message}`,
        });
      }
    } else {
      updateItem('gemini-transcribe-api', {
        status: 'warning',
        title: 'Skipped Transcribe Test',
        details: healthData?.hasApiKey ? 'Server health check was not successful.' : 'Requires GEMINI_API_KEY to be configured.',
      });
    }
  }, [updateItem]);

  // 4. Live Sound Check & VU Meter Test
  const startLiveSoundCheck = useCallback(async () => {
    stopSoundCheck();
    setIsSoundChecking(true);
    setLiveAudioLevel(0);
    setPeakAudioLevel(0);
    setSoundCheckSecondsLeft(5);
    setSoundCheckResult({ tested: false, hasVoice: false, peak: 0 });

    updateItem('sound-level-check', {
      status: 'running',
      title: 'Listening for speech (5s test)...',
      details: 'Please speak "Hello testing 1 2 3" clearly into your microphone now.',
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      soundCheckStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      soundCheckAudioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let localPeak = 0;

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const currentLvl = Math.min(100, Math.round((average / 90) * 100));
        setLiveAudioLevel(currentLvl);
        if (currentLvl > localPeak) {
          localPeak = currentLvl;
          setPeakAudioLevel(localPeak);
        }
        soundCheckAnimFrameRef.current = requestAnimationFrame(updateMeter);
      };
      soundCheckAnimFrameRef.current = requestAnimationFrame(updateMeter);

      // Countdown 5 seconds
      let secondsRemaining = 5;
      const countdownTimer = setInterval(() => {
        secondsRemaining -= 1;
        setSoundCheckSecondsLeft(secondsRemaining);
        if (secondsRemaining <= 0) {
          clearInterval(countdownTimer);
          stopSoundCheck();

          // Evaluate result
          const hasVoice = localPeak >= 6;
          setSoundCheckResult({ tested: true, hasVoice, peak: localPeak });

          if (hasVoice) {
            updateItem('sound-level-check', {
              status: 'pass',
              title: `Sound Detected Successfully (Peak: ${localPeak}%)`,
              details: `The microphone received clear audio waveforms. Hardware and OS input levels are functional.`,
            });
          } else {
            updateItem('sound-level-check', {
              status: 'fail',
              title: `No Audio Signal Detected (Peak: ${localPeak}%)`,
              details: `Microphone stream was opened, but audio volume stayed at 0% or below background noise. This is why speech transcripts remain empty!`,
              recommendation:
                '1. Check your headset/mic physical mute switch. 2. Increase input volume in your system sound settings. 3. Ensure your browser is selecting the correct microphone.',
            });
          }
        }
      }, 1000);
    } catch (soundErr: any) {
      stopSoundCheck();
      updateItem('sound-level-check', {
        status: 'fail',
        title: 'Microphone Failed to Open',
        details: soundErr?.message || 'Could not access audio stream for sound check.',
        recommendation: 'Grant microphone permissions in browser settings.',
      });
    }
  }, [stopSoundCheck, updateItem]);

  // Run All Diagnostics in sequence
  const runAllDiagnostics = useCallback(async () => {
    setIsRunningAll(true);
    try {
      await runBrowserDiagnostics();
      await runPermissionDiagnostics();
      await runNetworkDiagnostics();
      // Auto-trigger live sound check
      await startLiveSoundCheck();
    } finally {
      setIsRunningAll(false);
    }
  }, [runBrowserDiagnostics, runPermissionDiagnostics, runNetworkDiagnostics, startLiveSoundCheck]);

  // Run initial diagnostic check when modal opens
  useEffect(() => {
    if (isOpen) {
      runBrowserDiagnostics();
      runPermissionDiagnostics();
      runNetworkDiagnostics();
    } else {
      stopSoundCheck();
    }
    return () => {
      stopSoundCheck();
    };
  }, [isOpen, runBrowserDiagnostics, runPermissionDiagnostics, runNetworkDiagnostics, stopSoundCheck]);

  // Copy diagnostic report to clipboard
  const handleCopyReport = useCallback(() => {
    const reportLines = [
      '# Personal Dashboard - Voice Assistant Diagnostic Report',
      `Generated: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      `URL: ${window.location.href}`,
      `Secure Context: ${window.isSecureContext}`,
      `In Iframe: ${window.self !== window.top}`,
      '',
      '## Diagnostic Test Results:',
    ];

    diagnostics.forEach((item) => {
      reportLines.push(`- [${item.status.toUpperCase()}] ${item.name}`);
      reportLines.push(`  Title: ${item.title}`);
      reportLines.push(`  Details: ${item.details}`);
      if (item.recommendation) {
        reportLines.push(`  Fix: ${item.recommendation}`);
      }
    });

    if (soundCheckResult.tested) {
      reportLines.push('');
      reportLines.push('## Live Sound Check:');
      reportLines.push(`- Voice Detected: ${soundCheckResult.hasVoice ? 'YES' : 'NO'}`);
      reportLines.push(`- Peak Audio Level: ${soundCheckResult.peak}%`);
    }

    navigator.clipboard.writeText(reportLines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  }, [diagnostics, soundCheckResult]);

  // Overall Health Summary
  const passCount = diagnostics.filter((d) => d.status === 'pass').length;
  const warningCount = diagnostics.filter((d) => d.status === 'warning').length;
  const failCount = diagnostics.filter((d) => d.status === 'fail').length;

  const filteredDiagnostics =
    activeTab === 'all'
      ? diagnostics
      : diagnostics.filter((d) => d.category === activeTab);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Diagnostic Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-gradient-to-b from-[#161B22] to-[#0D1117] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col z-10 my-auto"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Voice Assistant Diagnostic Suite
                </h2>
                <p className="text-xs text-gray-400">
                  Step-by-step test for mic permissions, audio stream, and transcription
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-xs flex items-center gap-1.5 border border-white/5"
                title="Copy Diagnostic Log"
              >
                {copiedReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copiedReport ? 'Copied!' : 'Copy Log'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Top Status & Overall Health Card */}
          <div className="p-5 sm:p-6 pt-4 pb-3 bg-white/[0.02] border-b border-white/5 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    failCount > 0
                      ? 'bg-rose-500 animate-ping'
                      : warningCount > 0
                      ? 'bg-amber-400'
                      : passCount > 0
                      ? 'bg-emerald-400'
                      : 'bg-gray-500'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    {failCount > 0
                      ? 'Action Required (Issues Detected)'
                      : warningCount > 0
                      ? 'Functional with Warnings'
                      : passCount > 0
                      ? 'All Systems Ready'
                      : 'Diagnostics Idle'}
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                    <span className="text-emerald-400 font-semibold">{passCount} Passed</span>
                    <span>•</span>
                    <span className="text-amber-400 font-semibold">{warningCount} Warnings</span>
                    <span>•</span>
                    <span className="text-rose-400 font-semibold">{failCount} Failed</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runAllDiagnostics}
                  disabled={isRunningAll || isSoundChecking}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
                  {isRunningAll ? 'Testing...' : 'Re-Run All Tests'}
                </button>

                {window.self !== window.top && (
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Open app in a top-level tab to bypass iframe sandbox restrictions"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    Open in New Tab
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'All Checks' },
                { id: 'permission', label: 'Microphone & Hardware' },
                { id: 'audio', label: 'Live Sound Meter' },
                { id: 'browser', label: 'Browser APIs' },
                { id: 'network', label: 'Cloud AI & Network' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Live Sound Check Meter Banner */}
          <div className="p-4 sm:p-5 mx-5 sm:mx-6 my-3 rounded-2xl bg-gradient-to-r from-[#101924] to-[#0F141C] border border-indigo-500/20 shadow-inner shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Interactive Sound & Hardware Signal Check
                  </h3>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {isSoundChecking
                    ? `Listening now! Speak into your mic (${soundCheckSecondsLeft}s remaining)...`
                    : soundCheckResult.tested
                    ? soundCheckResult.hasVoice
                      ? `Microphone picked up sound waveforms! Peak level reached ${soundCheckResult.peak}%.`
                      : `Silence detected (Peak: ${soundCheckResult.peak}%). Microphone stream is active but no speech was heard.`
                    : 'Test whether your microphone is picking up sound waveforms right now.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={isSoundChecking ? stopSoundCheck : startLiveSoundCheck}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    isSoundChecking
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  {isSoundChecking ? `Stop Check (${soundCheckSecondsLeft}s)` : 'Start 5s Sound Check'}
                </button>
              </div>
            </div>

            {/* VU Meter Bars */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
                <motion.div
                  className={`h-full rounded-full transition-all duration-75 ${
                    liveAudioLevel > 20
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500'
                      : liveAudioLevel > 5
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gray-600'
                  }`}
                  style={{ width: `${Math.max(2, Math.min(100, liveAudioLevel))}%` }}
                />
              </div>
              <div className="w-16 text-right font-mono text-xs font-bold text-gray-300">
                {liveAudioLevel}%
              </div>
            </div>
          </div>

          {/* Diagnostic Items List (Scrollable Area) */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-2 space-y-2.5">
            {filteredDiagnostics.map((item) => {
              const isPass = item.status === 'pass';
              const isWarning = item.status === 'warning';
              const isFail = item.status === 'fail';
              const isRunning = item.status === 'running';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isPass
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : isFail
                      ? 'bg-rose-950/25 border-rose-500/40'
                      : isWarning
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-white/[0.02] border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {isFail && <XCircle className="w-4 h-4 text-rose-400" />}
                        {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {isRunning && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />}
                        {item.status === 'idle' && <Activity className="w-4 h-4 text-gray-500" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">{item.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                              isPass
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isFail
                                ? 'bg-rose-500/20 text-rose-300'
                                : isWarning
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-gray-200">{item.title}</p>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{item.details}</p>

                        {item.recommendation && (
                          <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-start gap-2 text-[11px] text-amber-200">
                            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="leading-snug">
                              <span className="font-semibold text-amber-300">Remedy: </span>
                              {item.recommendation}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Troubleshooting Advice Guide */}
          <div className="p-4 sm:p-5 bg-white/[0.02] border-t border-white/10 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Need help? Check your browser lock icon to ensure microphone is allowed.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {onRetryVoiceAssistant && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRetryVoiceAssistant();
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/30"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Retry Voice Assistant
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
