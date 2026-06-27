import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioChunk {
  data: string;   // base64
  mimeType: string;
}

export const useGeminiLiveAPI = (wsUrl: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [aiState, setAiState] = useState<'idle' | 'connecting' | 'ready' | 'listening' | 'speaking'>('idle');
  
  // Real-time transcripts
  const [userTranscript, setUserTranscript] = useState('');
  const userTranscriptRef = useRef(''); // Synchronize for stopRecording access
  const [aiTranscript, setAiTranscript] = useState('');

  // Auto-flush user transcript on Hands-Free VAD interruption
  useEffect(() => {
    if (aiState === 'speaking' && userTranscriptRef.current.trim()) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          userTranscript: userTranscriptRef.current 
        }));
      }
      userTranscriptRef.current = '';
      setUserTranscript('');
    }
  }, [aiState]);

  const wsRef = useRef<WebSocket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const recordCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  
  const recognitionRef = useRef<any>(null); // Web Speech API

  // ── Decode base64 to Uint8Array ───────────────────────────────
  const b64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  // ── Play a single audio chunk ─────────────────────────────────
  const playChunk = async (chunk: AudioChunk): Promise<void> => {
    const ctx = playbackCtxRef.current!;
    if (ctx.state === 'suspended') await ctx.resume();

    const bytes = b64ToBytes(chunk.data);

    if (chunk.mimeType.includes('pcm')) {
      const rate = parseInt(chunk.mimeType.match(/rate=(\d+)/)?.[1] || '24000');
      let bufToUse = bytes.buffer;
      if (bytes.length % 2 !== 0) {
        const padded = new Uint8Array(bytes.length + 1);
        padded.set(bytes);
        bufToUse = padded.buffer;
      }
      
      const int16 = new Int16Array(bufToUse);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

      if (float32.length === 0) return;
      
      const buf = ctx.createBuffer(1, float32.length, rate);
      buf.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      return new Promise<void>(r => { src.onended = () => r(); src.start(); });
    }

    try {
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      return new Promise<void>(r => { src.onended = () => r(); src.start(); });
    } catch (decodeErr) {
      console.warn('[Audio] decodeAudioData failed, trying Blob/Audio fallback:', decodeErr);
    }

    const blob = new Blob([bytes], { type: chunk.mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    return new Promise<void>((resolve, reject) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); console.error('[Audio] Audio element error:', e); reject(e); };
      audio.play().catch(reject);
    });
  };

  // ── Drain the audio queue ─────────────────────────────────────
  const drainQueue = useCallback(async () => {
    if (!audioUnlockedRef.current) return;
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;
      try {
        await playChunk(chunk);
      } catch (err) {
        console.error('[Audio] Failed to play chunk:', err);
      }
    }

    isPlayingRef.current = false;
    setAiState(prev => prev === 'speaking' ? 'ready' : prev);
  }, []);

  // Must be called from a user click
  const initAudioPlayback = useCallback(async () => {
    if (audioUnlockedRef.current) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate: 24000 });
    playbackCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    audioUnlockedRef.current = true;
    if (audioQueueRef.current.length > 0) setAiState('speaking');
    drainQueue();
  }, [drainQueue]);

  // ── WebSocket connection ──────────────────────────────────────
  const connect = useCallback((onReady: () => void, candidateData: string) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setAiState('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    let disposed = false;

    ws.onopen = () => {
      if (disposed) return;
      ws.send(candidateData);
    };

    ws.onmessage = async (event) => {
      if (disposed) return;
      
      let raw = '';
      if (event.data instanceof Blob) {
        raw = await event.data.text();
      } else if (typeof event.data === 'string') {
        raw = event.data;
      }
      
      if (raw === 'SYSTEM_READY') {
        setAiState('ready');
        onReady();
        return;
      }
      
      try {
        const data = JSON.parse(raw);
        if (data?.type === 'ai_transcript') {
          setAiTranscript(data.text);
          return;
        }

        const parts = data?.serverContent?.modelTurn?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            // Check for inlineData
            if (part?.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
              setAiState('speaking');
              audioQueueRef.current.push({ data: part.inlineData.data, mimeType });
              drainQueue();
            }
          }
        }

        if (data?.serverContent?.turnComplete) {
          const waitDrain = () => {
            if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
              setAiState(prev => prev === 'speaking' ? 'ready' : prev);
            } else { setTimeout(waitDrain, 80); }
          };
          waitDrain();
        }
      } catch {
        // Ignore non-JSON
      }
    };

    ws.onerror = () => { if (!disposed) setAiState('idle'); };
    ws.onclose = () => { if (!disposed) setAiState('idle'); };
    return () => { disposed = true; ws.close(); };
  }, [wsUrl, drainQueue]);

  // ── Microphone recording ──────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!audioUnlockedRef.current) await initAudioPlayback();
    
    // Reset transcripts for the new turn
    setUserTranscript('');
    userTranscriptRef.current = '';
    setAiTranscript('');

    // Start Web Speech API for real-time transcription
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setUserTranscript(transcript);
        userTranscriptRef.current = transcript;
      };
      recognition.start();
      recognitionRef.current = recognition;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      recordCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
        const u8 = new Uint8Array(i16.buffer);
        
        let bin = '';
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        
        const payload = { 
          realtimeInput: { 
            mediaChunks: [{ 
              mimeType: 'audio/pcm;rate=16000', 
              data: btoa(bin) 
            }] 
          } 
        };
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
      };
      
      source.connect(processor);
      processor.connect(ctx.destination);
      processorRef.current = processor;
      setIsRecording(true);
      setAiState('listening');
    } catch (err) { console.error('[Mic] error:', err); }
  }, [initAudioPlayback]);

  const stopRecording = useCallback(() => {
    // Send final transcript AND turn completion in a single guaranteed message
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        clientContent: { turnComplete: true },
        userTranscript: userTranscriptRef.current 
      }));
    }

    // Stop Web Speech API
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    processorRef.current?.disconnect(); processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null;
    if (recordCtxRef.current && recordCtxRef.current.state !== 'closed') recordCtxRef.current.close();
    recordCtxRef.current = null;
    
    setIsRecording(false);
  }, []);

  return { connect, startRecording, stopRecording, isRecording, aiState, initAudioPlayback, userTranscript, aiTranscript };
};
