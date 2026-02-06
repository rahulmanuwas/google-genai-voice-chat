// src/hooks/useVoiceInput.ts

/**
 * Hook for managing microphone input and streaming to Gemini Live API
 * Ported from tested g2p implementation (server-side VAD mode)
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { AudioDropPolicy, LiveSession, VoiceChatEvent } from '../lib/types';
import { INPUT_SAMPLE_RATE, encodeAudioToBase64, calculateRMSLevel } from '../lib/audio-utils';

// Microphone settings
const MIC_BUFFER_SIZE = 2048;
const MIC_CHANNELS = 1;

interface UseVoiceInputOptions {
    session: LiveSession | null;
    isEnabled: boolean;
    maxConsecutiveErrors?: number;
    errorCooldownMs?: number;
    inputMinSendIntervalMs?: number;
    inputMaxQueueMs?: number;
    inputMaxQueueChunks?: number;
    inputDropPolicy?: AudioDropPolicy;
    preferAudioWorklet?: boolean;
    audioWorkletBufferSize?: number;
    restartMicOnDeviceChange?: boolean;
    onEvent?: (event: VoiceChatEvent) => void;
    onVoiceStart?: () => void;
    onVoiceEnd?: () => void;
    onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
    isListening: boolean;
    micLevel: number;
    startMic: () => Promise<void>;
    stopMic: () => void;
    getStats: () => {
        queueMs: number;
        queueChunks: number;
        droppedChunks: number;
        droppedMs: number;
        sendErrorStreak: number;
        blockedUntil: number;
        lastSendAt: number;
        usingWorklet: boolean;
    };
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
    const {
        session,
        isEnabled,
        maxConsecutiveErrors,
        errorCooldownMs,
        inputMinSendIntervalMs,
        inputMaxQueueMs,
        inputMaxQueueChunks,
        inputDropPolicy,
        preferAudioWorklet,
        audioWorkletBufferSize,
        restartMicOnDeviceChange,
        onEvent,
        onVoiceStart,
        onVoiceEnd,
        onError,
    } = options;

    const [isListening, setIsListening] = useState(false);
    const [micLevel, setMicLevel] = useState(0);

    // Refs for audio context and nodes
    const micCtxRef = useRef<AudioContext | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micProcRef = useRef<AudioNode | null>(null);
    const micWorkletRef = useRef<AudioWorkletNode | null>(null);
    const micWorkletUrlRef = useRef<string | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micSilenceGainRef = useRef<GainNode | null>(null);
    const lastMicLevelUpdateRef = useRef(0);
    const sendErrorStreakRef = useRef(0);
    const sendBlockedUntilRef = useRef(0);
    const lastSendAtRef = useRef(0);
    const maxConsecutiveErrorsRef = useRef(maxConsecutiveErrors ?? 3);
    const errorCooldownMsRef = useRef(errorCooldownMs ?? 750);
    const inputMinSendIntervalMsRef = useRef(inputMinSendIntervalMs ?? 0);
    const inputMaxQueueMsRef = useRef(inputMaxQueueMs ?? 0);
    const inputMaxQueueChunksRef = useRef(inputMaxQueueChunks ?? 0);
    const inputDropPolicyRef = useRef<AudioDropPolicy>(inputDropPolicy ?? 'drop-oldest');
    const preferAudioWorkletRef = useRef(preferAudioWorklet ?? true);
    const audioWorkletBufferSizeRef = useRef(audioWorkletBufferSize ?? MIC_BUFFER_SIZE);
    const restartMicOnDeviceChangeRef = useRef(restartMicOnDeviceChange ?? true);
    const onEventRef = useRef(onEvent);

    // Refs for state that needs to be accessed in callbacks
    const isListeningRef = useRef(false);
    const isEnabledRef = useRef(isEnabled);
    const sessionRef = useRef(session);
    const usingWorkletRef = useRef(false);

    // Input queue/backpressure
    const sendQueueRef = useRef<Array<{ data: string; mimeType: string; durationMs: number }>>([]);
    const queuedMsRef = useRef(0);
    const queuedChunksRef = useRef(0);
    const droppedChunksRef = useRef(0);
    const droppedMsRef = useRef(0);
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stopMicRef = useRef<() => void>(() => {});
    const startMicRef = useRef<() => Promise<void>>(() => Promise.resolve());

    // Callback refs
    const onVoiceStartRef = useRef(onVoiceStart);
    const onVoiceEndRef = useRef(onVoiceEnd);
    const onErrorRef = useRef(onError);

    // Keep refs updated
    useEffect(() => { sessionRef.current = session; }, [session]);
    useEffect(() => { isEnabledRef.current = isEnabled; }, [isEnabled]);
    useEffect(() => { onVoiceStartRef.current = onVoiceStart; }, [onVoiceStart]);
    useEffect(() => { onVoiceEndRef.current = onVoiceEnd; }, [onVoiceEnd]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => { maxConsecutiveErrorsRef.current = maxConsecutiveErrors ?? 3; }, [maxConsecutiveErrors]);
    useEffect(() => { errorCooldownMsRef.current = errorCooldownMs ?? 750; }, [errorCooldownMs]);
    useEffect(() => { inputMinSendIntervalMsRef.current = inputMinSendIntervalMs ?? 0; }, [inputMinSendIntervalMs]);
    useEffect(() => { inputMaxQueueMsRef.current = inputMaxQueueMs ?? 0; }, [inputMaxQueueMs]);
    useEffect(() => { inputMaxQueueChunksRef.current = inputMaxQueueChunks ?? 0; }, [inputMaxQueueChunks]);
    useEffect(() => { inputDropPolicyRef.current = inputDropPolicy ?? 'drop-oldest'; }, [inputDropPolicy]);
    useEffect(() => { preferAudioWorkletRef.current = preferAudioWorklet ?? true; }, [preferAudioWorklet]);
    useEffect(() => { audioWorkletBufferSizeRef.current = audioWorkletBufferSize ?? MIC_BUFFER_SIZE; }, [audioWorkletBufferSize]);
    useEffect(() => { restartMicOnDeviceChangeRef.current = restartMicOnDeviceChange ?? true; }, [restartMicOnDeviceChange]);
    useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

    const emitEvent = useCallback((type: string, data?: Record<string, unknown>) => {
        onEventRef.current?.({ type, ts: Date.now(), data });
    }, []);

    const flushQueueRef = useRef<() => void>(() => {});

    const clearFlushTimer = useCallback(() => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
    }, []);

    const scheduleFlush = useCallback((delayMs: number) => {
        clearFlushTimer();
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null;
            flushQueueRef.current();
        }, Math.max(0, delayMs));
    }, [clearFlushTimer]);

    const cleanup = useCallback(() => {
        try { micProcRef.current?.disconnect(); } catch (e) { void e; }
        try {
            if (micWorkletRef.current) {
                micWorkletRef.current.port.onmessage = null;
                micWorkletRef.current.disconnect();
            }
        } catch (e) { void e; }
        try { micSourceRef.current?.disconnect(); } catch (e) { void e; }
        try { micSilenceGainRef.current?.disconnect(); } catch (e) { void e; }
        try { micCtxRef.current?.close(); } catch (e) { void e; }

        micProcRef.current = null;
        micWorkletRef.current = null;
        micSourceRef.current = null;
        micSilenceGainRef.current = null;
        micCtxRef.current = null;

        if (micWorkletUrlRef.current) {
            try {
                URL.revokeObjectURL(micWorkletUrlRef.current);
            } catch (e) { void e; }
            micWorkletUrlRef.current = null;
        }

        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;

        isListeningRef.current = false;
        setIsListening(false);
        setMicLevel(0);
        sendErrorStreakRef.current = 0;
        sendBlockedUntilRef.current = 0;
        lastSendAtRef.current = 0;
        sendQueueRef.current = [];
        queuedMsRef.current = 0;
        queuedChunksRef.current = 0;
        droppedChunksRef.current = 0;
        droppedMsRef.current = 0;
        usingWorkletRef.current = false;
        clearFlushTimer();
    }, [clearFlushTimer]);

    useEffect(() => {
        const flushQueue = () => {
            if (!sessionRef.current) return;

            if (sendQueueRef.current.length === 0) return;

            const now = performance.now();
            if (now < sendBlockedUntilRef.current) {
                scheduleFlush(sendBlockedUntilRef.current - now);
                return;
            }

            const minInterval = inputMinSendIntervalMsRef.current;
            if (minInterval > 0 && now - lastSendAtRef.current < minInterval) {
                scheduleFlush(minInterval - (now - lastSendAtRef.current));
                return;
            }

            while (sendQueueRef.current.length > 0) {
                const item = sendQueueRef.current.shift();
                if (!item) break;
                queuedMsRef.current = Math.max(0, queuedMsRef.current - item.durationMs);
                queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);

                try {
                    sessionRef.current?.sendRealtimeInput({ audio: { data: item.data, mimeType: item.mimeType } });
                    sendErrorStreakRef.current = 0;
                    lastSendAtRef.current = performance.now();
                } catch (err) {
                    console.error('sendRealtimeInput error:', err);
                    sendErrorStreakRef.current += 1;
                    sendBlockedUntilRef.current = performance.now() + errorCooldownMsRef.current;
                    emitEvent('audio_input_send_error', {
                        streak: sendErrorStreakRef.current,
                        error: (err as Error).message,
                    });
                    if (sendErrorStreakRef.current >= maxConsecutiveErrorsRef.current) {
                        emitEvent('audio_input_stream_halted', { reason: 'too_many_errors' });
                        onErrorRef.current?.('Audio streaming unstable. Please reconnect.');
                        setTimeout(() => stopMicRef.current(), 0);
                    }
                    scheduleFlush(errorCooldownMsRef.current);
                    return;
                }

                if (minInterval > 0 && sendQueueRef.current.length > 0) {
                    scheduleFlush(minInterval);
                    return;
                }
            }
        };

        flushQueueRef.current = flushQueue;
    }, [emitEvent, scheduleFlush]);

    const enqueueInputChunk = useCallback((data: string, mimeType: string, durationMs: number) => {
        const maxMs = inputMaxQueueMsRef.current;
        const maxChunks = inputMaxQueueChunksRef.current;
        const policy = inputDropPolicyRef.current;

        const wouldOverflow = (extraMs: number, extraChunks: number) =>
            (maxMs > 0 && queuedMsRef.current + extraMs > maxMs) ||
            (maxChunks > 0 && queuedChunksRef.current + extraChunks > maxChunks);

        let droppedChunks = 0;
        let droppedMs = 0;

        if (policy === 'drop-newest' && wouldOverflow(durationMs, 1)) {
            droppedChunks = 1;
            droppedMs = durationMs;
        } else {
            if (policy === 'drop-all' && wouldOverflow(durationMs, 1)) {
                droppedChunks = sendQueueRef.current.length;
                droppedMs = queuedMsRef.current;
                sendQueueRef.current = [];
                queuedMsRef.current = 0;
                queuedChunksRef.current = 0;
            }

            sendQueueRef.current.push({ data, mimeType, durationMs });
            queuedMsRef.current += durationMs;
            queuedChunksRef.current += 1;

            if (policy === 'drop-oldest') {
                while (
                    (maxMs > 0 && queuedMsRef.current > maxMs) ||
                    (maxChunks > 0 && queuedChunksRef.current > maxChunks)
                ) {
                    const dropped = sendQueueRef.current.shift();
                    if (!dropped) break;
                    queuedMsRef.current = Math.max(0, queuedMsRef.current - dropped.durationMs);
                    queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
                    droppedChunks += 1;
                    droppedMs += dropped.durationMs;
                }
            }
        }

        if (droppedChunks > 0) {
            droppedChunksRef.current += droppedChunks;
            droppedMsRef.current += droppedMs;
            emitEvent('audio_input_queue_overflow', {
                droppedChunks,
                droppedMs,
                queueMs: queuedMsRef.current,
                queueChunks: queuedChunksRef.current,
                policy,
            });
            if (policy === 'drop-newest') {
                emitEvent('audio_input_dropped', { reason: 'queue_overflow', policy });
                return;
            }
        }

        flushQueueRef.current();
    }, [emitEvent]);

    const processInputChunk = useCallback((inputData: Float32Array) => {
        if (!micCtxRef.current || !isListeningRef.current || !sessionRef.current) return;

        const now = performance.now();

        // Calculate and smooth mic level for visual feedback
        if (now - lastMicLevelUpdateRef.current > 50) {
            lastMicLevelUpdateRef.current = now;
            const rms = calculateRMSLevel(inputData);
            const visualLevel = Math.min(1, rms * 10); // Scale for visibility
            setMicLevel(prev => prev * 0.8 + visualLevel * 0.2);
        }

        const sourceSampleRate = micCtxRef.current.sampleRate || 48000;
        const { data, mimeType } = encodeAudioToBase64(inputData, sourceSampleRate, INPUT_SAMPLE_RATE);

        const ratio = sourceSampleRate / INPUT_SAMPLE_RATE;
        const processedLength = Math.floor(inputData.length / (ratio || 1));
        const durationMs = (processedLength / INPUT_SAMPLE_RATE) * 1000;

        enqueueInputChunk(data, mimeType, durationMs);
    }, [enqueueInputChunk]);

    const stopMic = useCallback((): void => {
        if (!isListeningRef.current) return;

        console.log('Stopping microphone...');

        // Signal end of audio to API (server VAD mode)
        try {
            sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
        } catch (e) {
            console.warn('Audio stream end failed:', e);
        }

        cleanup();
        emitEvent('mic_stopped');
        onVoiceEndRef.current?.();
    }, [cleanup, emitEvent]);

    const startMic = useCallback(async (): Promise<void> => {
        if (!sessionRef.current || isListeningRef.current) {
            console.log('Cannot start mic: session missing or already listening');
            return;
        }

        try {
            console.log('Starting microphone...');

            if (!navigator?.mediaDevices?.getUserMedia) {
                const message = 'Microphone access is not supported in this browser.';
                emitEvent('mic_error', { error: message });
                onErrorRef.current?.(message);
                return;
            }

            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: MIC_CHANNELS,
                    sampleRate: 48000, // Request high rate, will downsample
                },
            } as MediaStreamConstraints);
            micStreamRef.current = stream;

            // Create audio context
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            micCtxRef.current = new Ctx();

            if (micCtxRef.current.state === 'suspended') {
                await micCtxRef.current.resume();
            }

            micSourceRef.current = micCtxRef.current.createMediaStreamSource(stream);

            // Connect nodes (with silence to prevent feedback)
            micSilenceGainRef.current = micCtxRef.current.createGain();
            micSilenceGainRef.current.gain.value = 0;

            const bufferSize = Math.max(256, Math.min(16384, audioWorkletBufferSizeRef.current || MIC_BUFFER_SIZE));
            const canUseWorklet = preferAudioWorkletRef.current
                && !!micCtxRef.current.audioWorklet
                && typeof AudioWorkletNode !== 'undefined';

            let usingWorklet = false;

            if (canUseWorklet) {
                try {
                    const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = ${bufferSize};
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;
    let i = 0;
    while (i < channel.length) {
      const space = this.bufferSize - this.offset;
      const toCopy = Math.min(space, channel.length - i);
      this.buffer.set(channel.subarray(i, i + toCopy), this.offset);
      this.offset += toCopy;
      i += toCopy;
      if (this.offset >= this.bufferSize) {
        const out = new Float32Array(this.bufferSize);
        out.set(this.buffer);
        this.port.postMessage(out, [out.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;
                    const blob = new Blob([workletCode], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    micWorkletUrlRef.current = url;
                    await micCtxRef.current.audioWorklet.addModule(url);

                    const workletNode = new AudioWorkletNode(micCtxRef.current, 'pcm-processor', {
                        numberOfInputs: 1,
                        numberOfOutputs: 1,
                        channelCount: MIC_CHANNELS,
                    });
                    workletNode.port.onmessage = (event) => {
                        const inputData = event.data as Float32Array | undefined;
                        if (!inputData || !isListeningRef.current) return;
                        processInputChunk(inputData);
                    };

                    micWorkletRef.current = workletNode;
                    micProcRef.current = workletNode;
                    micSourceRef.current.connect(workletNode);
                    workletNode.connect(micSilenceGainRef.current);
                    usingWorklet = true;
                } catch (err) {
                    if (micWorkletUrlRef.current) {
                        try {
                            URL.revokeObjectURL(micWorkletUrlRef.current);
                        } catch (e) { void e; }
                        micWorkletUrlRef.current = null;
                    }
                    emitEvent('mic_worklet_error', { error: (err as Error).message });
                }
            }

            if (!usingWorklet) {
                const audioProcessor = micCtxRef.current.createScriptProcessor(bufferSize, MIC_CHANNELS, MIC_CHANNELS);
                audioProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
                    const inputData = event.inputBuffer.getChannelData(0);
                    processInputChunk(inputData);
                };
                micProcRef.current = audioProcessor;
                micSourceRef.current.connect(audioProcessor);
                audioProcessor.connect(micSilenceGainRef.current);
            }

            micSilenceGainRef.current.connect(micCtxRef.current.destination);
            usingWorkletRef.current = usingWorklet;

            isListeningRef.current = true;
            setIsListening(true);
            sendErrorStreakRef.current = 0;
            sendBlockedUntilRef.current = 0;
            lastSendAtRef.current = 0;
            emitEvent('mic_started', { usingWorklet });

            console.log(`Microphone started at ${micCtxRef.current.sampleRate}Hz`);
            onVoiceStartRef.current?.();
        } catch (err) {
            console.error('Mic start failed:', err);
            cleanup();
            const error = err as Error & { name?: string };
            let message = `Microphone error: ${error.message}`;
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                message = 'Microphone permission denied. Please allow access and try again.';
                emitEvent('mic_permission_blocked');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                message = 'No microphone device found.';
            } else if (error.name === 'NotReadableError') {
                message = 'Microphone is in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                message = 'Requested microphone settings are not supported.';
            }
            emitEvent('mic_error', { error: message, code: error.name });
            onErrorRef.current?.(message);
        }
    }, [cleanup, emitEvent, processInputChunk]);

    // Stop/start mic refs to avoid effect dependency warnings
    useEffect(() => { stopMicRef.current = stopMic; }, [stopMic]);
    useEffect(() => { startMicRef.current = startMic; }, [startMic]);

    useEffect(() => {
        if (!isEnabled && isListeningRef.current) {
            stopMicRef.current();
        }
    }, [isEnabled]);

    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        const mediaDevices = navigator.mediaDevices;
        if (!mediaDevices?.addEventListener) return;

        const handleDeviceChange = () => {
            if (!restartMicOnDeviceChangeRef.current) return;
            if (!isEnabledRef.current) return;
            if (!isListeningRef.current) return;

            emitEvent('mic_device_change');
            stopMicRef.current();
            setTimeout(() => {
                if (isEnabledRef.current) {
                    void startMicRef.current();
                }
            }, 250);
        };

        mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => {
            mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [emitEvent]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isListeningRef.current) {
                cleanup();
            } else {
                clearFlushTimer();
            }
        };
    }, [cleanup, clearFlushTimer]);

    const getStats = useCallback(() => ({
        queueMs: queuedMsRef.current,
        queueChunks: queuedChunksRef.current,
        droppedChunks: droppedChunksRef.current,
        droppedMs: droppedMsRef.current,
        sendErrorStreak: sendErrorStreakRef.current,
        blockedUntil: sendBlockedUntilRef.current,
        lastSendAt: lastSendAtRef.current,
        usingWorklet: usingWorkletRef.current,
    }), []);

    return useMemo(() => ({
        isListening,
        micLevel,
        startMic,
        stopMic,
        getStats,
    }), [isListening, micLevel, startMic, stopMic, getStats]);
}
