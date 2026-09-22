import { executeSecretaryTool } from './groqService';
import { Storage } from '../utils/storage';

export type LiveVoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface LiveVoiceCallbacks {
  onStatusChange?: (status: LiveVoiceStatus) => void;
  onVolumeChange?: (volume: number) => void;
  onUserTranscript?: (transcript: string) => void;
  onModelTranscript?: (transcript: string) => void;
  onToolExecuted?: (toolName: string, chip: string) => void;
  onError?: (err: string) => void;
}

export class GeminiLiveVoiceSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  private nextStartTime: number = 0;
  private activeAudioSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveVoiceCallbacks;
  private status: LiveVoiceStatus = 'idle';
  private isMuted: boolean = false;

  constructor(callbacks: LiveVoiceCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public getStatus(): LiveVoiceStatus {
    return this.status;
  }

  private setStatus(newStatus: LiveVoiceStatus) {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  public async start(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'listening' || this.status === 'speaking') {
      return;
    }

    this.setStatus('connecting');

    try {
      // 1. Request microphone permissions
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Initialize Output Audio Context (24kHz for Gemini Live model output)
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
      this.nextStartTime = this.outputAudioCtx.currentTime;

      // 3. Initialize Input Audio Context (16kHz for mic input)
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      // 4. Setup WebSocket to backend /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const userGeminiKey = Storage.getGeminiApiKey();
      const wsUrl = `${protocol}//${window.location.host}/live${userGeminiKey ? `?apiKey=${encodeURIComponent(userGeminiKey)}` : ''}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Gemini Live Client] Connected to Live API bridge');
        this.setStatus('listening');
        this.startMicProcessing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            console.error('[Gemini Live Client] Server reported error:', data.error);
            this.callbacks.onError?.(data.error);
            this.setStatus('error');
            return;
          }

          // Audio response chunk from model
          if (data.audio) {
            this.playAudioChunk(data.audio);
          }

          // Live transcriptions
          if (data.userTranscript) {
            this.callbacks.onUserTranscript?.(data.userTranscript);
          }
          if (data.modelTranscript) {
            this.callbacks.onModelTranscript?.(data.modelTranscript);
          }

          // Handle interruption: stop model audio immediately!
          if (data.interrupted) {
            console.log('[Gemini Live Client] User interrupted model');
            this.stopActivePlayback();
            this.setStatus('listening');
          }

          // Handle tool calls from voice commands
          if (Array.isArray(data.toolCalls)) {
            for (const call of data.toolCalls) {
              this.handleLiveToolCall(call);
            }
          }
        } catch (e) {
          console.warn('[Gemini Live Client] Failed to parse message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Gemini Live Client] WebSocket bridge warning:', err);
        // Do not crash the entire voice session if local speech recognition is active
      };

      this.ws.onclose = () => {
        console.log('[Gemini Live Client] WebSocket connection closed');
        if (this.status === 'connecting') {
          this.setStatus('listening');
        }
      };
    } catch (err: any) {
      console.error('[Gemini Live Client] Start error:', err);
      this.callbacks.onError?.(err?.message || 'Could not access microphone.');
      this.setStatus('error');
      this.cleanup();
    }
  }

  public sendTextMessage(text: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ text }));
        return true;
      } catch (e) {
        console.warn('[Gemini Live Client] Failed to send text:', e);
      }
    }
    return false;
  }

  private startMicProcessing() {
    if (!this.inputAudioCtx || !this.mediaStream) return;

    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.inputAudioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Process in chunks of 4096 samples (~256ms at 16kHz)
    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioCtx.destination);

    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isMuted) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const channelData = e.inputBuffer.getChannelData(0);
      const base64Pcm = this.float32ToPcm16Base64(channelData);

      this.ws.send(JSON.stringify({ audio: base64Pcm }));
    };

    // Start volume meter animation
    this.trackVolume();
  }

  private trackVolume() {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const check = () => {
      if (!this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(1, avg / 128);
      this.callbacks.onVolumeChange?.(normalized);
      this.animFrameId = requestAnimationFrame(check);
    };

    this.animFrameId = requestAnimationFrame(check);
  }

  private float32ToPcm16Base64(float32: Float32Array): string {
    const l = float32.length;
    const pcm16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    let binary = '';
    const bytes = new Uint8Array(pcm16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.outputAudioCtx) return;

    try {
      this.setStatus('speaking');
      const binary = atob(base64Audio);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      // Queue cleanly
      const currentTime = this.outputAudioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      this.activeAudioSources.push(source);

      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx !== -1) this.activeAudioSources.splice(idx, 1);
        if (this.activeAudioSources.length === 0 && this.status === 'speaking') {
          this.setStatus('listening');
        }
      };
    } catch (e) {
      console.warn('[Gemini Live Client] Failed to play chunk:', e);
    }
  }

  private stopActivePlayback() {
    for (const source of this.activeAudioSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeAudioSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  private async handleLiveToolCall(call: any) {
    try {
      let toolName = call.name;
      const args = call.args || {};

      if (toolName === 'createTask') toolName = 'add_task';
      if (toolName === 'logExpense') toolName = 'add_expense';
      if (toolName === 'toggleHabit') {
        const habits = Storage.getHabits();
        if (args.habitTitle && !args.id) {
          const h = habits.find((it) =>
            it.title.toLowerCase().includes(args.habitTitle.toLowerCase())
          );
          if (h) args.id = h.id;
        }
        toolName = 'toggle_habit';
      }
      if (toolName === 'navigateView') toolName = 'navigate_view';

      const res = await executeSecretaryTool(toolName, args);
      if (res.actionChip) {
        this.callbacks.onToolExecuted?.(toolName, res.actionChip);
      }
    } catch (err) {
      console.warn('[Gemini Live Tool] Execution failed:', call.name, err);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public stop(): void {
    this.setStatus('idle');
    this.cleanup();
  }

  private cleanup() {
    this.stopActivePlayback();

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
