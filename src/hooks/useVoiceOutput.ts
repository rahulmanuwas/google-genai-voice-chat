// src/hooks/useVoiceOutput.ts

/**
 * Hook for managing audio playback from Gemini Live API responses
 * Ported from tested g2p implementation
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { OUTPUT_SAMPLE_RATE, PLAYBACK_COMPLETE_DELAY_MS, base64ToPCM16, pcm16ToFloat32 } from '../lib/audio-utils';
import type { AudioDropPolicy, VoiceChatEvent } from '../lib/types';

interface UseVoiceOutputOptions {
    playbackContext: AudioContext | null;
    isPaused: boolean;
    startBufferMs?: number;
    maxQueueMs?: number;
    maxQueueChunks?: number;
    dropPolicy?: AudioDropPolicy;
    onEvent?: (event: VoiceChatEvent) => void;
    onPlaybackStart?: () => void;
    onPlaybackComplete?: () => void;
}

interface UseVoiceOutputReturn {
    isPlaying: boolean;
    enqueueAudio: (base64Data: string, sampleRate?: number) => void;
    stopPlayback: () => void;
    clearQueue: () => void;
    getStats: () => {
        queueMs: number;
        queueChunks: number;
        droppedChunks: number;
        droppedMs: number;
        contextState: AudioContextState | 'none';
    };
}

export function useVoiceOutput(options: UseVoiceOutputOptions): UseVoiceOutputReturn {
    const { playbackContext, isPaused, startBufferMs, maxQueueMs, maxQueueChunks, dropPolicy, onEvent, onPlaybackStart, onPlaybackComplete } = options;

    const [isPlaying, setIsPlaying] = useState(false);

    // Audio queue and state refs
    const playQueueRef = useRef<Array<{ pcm: Int16Array; sampleRate: number; durationMs: number }>>([]);
    const isDrainingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const scheduledEndTimeRef = useRef(0);
    const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const queuedMsRef = useRef(0);
    const queuedChunksRef = useRef(0);
    const droppedChunksRef = useRef(0);
    const droppedMsRef = useRef(0);

    // Callback refs
    const onPlaybackStartRef = useRef(onPlaybackStart);
    const onPlaybackCompleteRef = useRef(onPlaybackComplete);
    const playCtxRef = useRef(playbackContext);
    const isPausedRef = useRef(isPaused);
    const isPlayingRef = useRef(isPlaying);
    const startBufferMsRef = useRef(startBufferMs ?? 0);
    const maxQueueMsRef = useRef(maxQueueMs ?? 0);
    const maxQueueChunksRef = useRef(maxQueueChunks ?? 0);
    const dropPolicyRef = useRef<AudioDropPolicy>(dropPolicy ?? 'drop-oldest');
    const onEventRef = useRef(onEvent);

    // Keep refs updated
    useEffect(() => { onPlaybackStartRef.current = onPlaybackStart; }, [onPlaybackStart]);
    useEffect(() => { onPlaybackCompleteRef.current = onPlaybackComplete; }, [onPlaybackComplete]);
    useEffect(() => { playCtxRef.current = playbackContext; }, [playbackContext]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { startBufferMsRef.current = startBufferMs ?? 0; }, [startBufferMs]);
    useEffect(() => { maxQueueMsRef.current = maxQueueMs ?? 0; }, [maxQueueMs]);
    useEffect(() => { maxQueueChunksRef.current = maxQueueChunks ?? 0; }, [maxQueueChunks]);
    useEffect(() => { dropPolicyRef.current = dropPolicy ?? 'drop-oldest'; }, [dropPolicy]);
    useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

    const emitEvent = useCallback((type: string, data?: Record<string, unknown>) => {
        onEventRef.current?.({ type, ts: Date.now(), data });
    }, []);

    // Use a ref for recursive scheduling to avoid circular dependency
    const scheduleChunksRef = useRef<() => void>(() => { });

    const clearCompleteTimer = useCallback(() => {
        if (completeTimerRef.current) {
            clearTimeout(completeTimerRef.current);
            completeTimerRef.current = null;
        }
    }, []);

    // Define scheduleChunks implementation
    useEffect(() => {
        const scheduleChunks = () => {
            const ctx = playCtxRef.current;
            if (!ctx) {
                isDrainingRef.current = false;
                return;
            }

            // No more chunks to play
            if (playQueueRef.current.length === 0) {
                isDrainingRef.current = false;
                currentSourceRef.current = null;
                scheduledEndTimeRef.current = 0;

                // Delay callback to allow for more chunks
                clearCompleteTimer();
                completeTimerRef.current = setTimeout(() => {
                    if (playQueueRef.current.length === 0) {
                        setIsPlaying(false);
                        onPlaybackCompleteRef.current?.();
                    }
                }, PLAYBACK_COMPLETE_DELAY_MS);
                return;
            }

            // Combine queued chunks that share the same sample rate
            const first = playQueueRef.current.shift();
            if (!first) {
                isDrainingRef.current = false;
                return;
            }
            const targetRate = first.sampleRate;
            const chunks = [first.pcm];
            queuedMsRef.current = Math.max(0, queuedMsRef.current - first.durationMs);
            queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
            while (playQueueRef.current.length > 0 && playQueueRef.current[0].sampleRate === targetRate) {
                const next = playQueueRef.current.shift();
                if (!next) break;
                chunks.push(next.pcm);
                queuedMsRef.current = Math.max(0, queuedMsRef.current - next.durationMs);
                queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
            }
            let totalLength = 0;
            for (const chunk of chunks) {
                totalLength += chunk.length;
            }

            const combined = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            // Convert to Float32 for Web Audio
            const float32 = pcm16ToFloat32(combined);

            // Create buffer at the chunk's sample rate (defaults to Gemini 24kHz)
            const audioBuffer = ctx.createBuffer(1, float32.length, targetRate);
            audioBuffer.getChannelData(0).set(float32);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            currentSourceRef.current = source;

            // Schedule playback precisely
            const now = ctx.currentTime;
            const bufferSeconds = startBufferMsRef.current / 1000;
            const baseStart = scheduledEndTimeRef.current === 0 ? now + bufferSeconds : scheduledEndTimeRef.current;
            const startTime = Math.max(now, baseStart);
            scheduledEndTimeRef.current = startTime + audioBuffer.duration;

            source.onended = () => {
                currentSourceRef.current = null;

                // Check for more chunks using ref
                if (playQueueRef.current.length > 0) {
                    scheduleChunksRef.current();
                } else {
                    // Wait a bit for more chunks
                    clearCompleteTimer();
                    completeTimerRef.current = setTimeout(() => {
                        if (playQueueRef.current.length > 0) {
                            scheduleChunksRef.current();
                        } else {
                            isDrainingRef.current = false;
                            scheduledEndTimeRef.current = 0;
                            setIsPlaying(false);
                            onPlaybackCompleteRef.current?.();
                        }
                    }, PLAYBACK_COMPLETE_DELAY_MS);
                }
            };

            source.start(startTime);
        };

        scheduleChunksRef.current = scheduleChunks;
    }, [clearCompleteTimer]);

    const drainQueue = useCallback(() => {
        const ctx = playCtxRef.current;
        if (!ctx || isDrainingRef.current) return;

        isDrainingRef.current = true;

        // Resume context if needed
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => scheduleChunksRef.current()).catch(console.warn);
        } else {
            scheduleChunksRef.current();
        }
    }, []);

    const stopPlayback = useCallback(() => {
        // Stop current source
        if (currentSourceRef.current) {
            try {
                currentSourceRef.current.onended = null;
                currentSourceRef.current.stop(0);
            } catch (e) {
                console.warn('Stop playback error:', e);
            }
            currentSourceRef.current = null;
        }

        // Clear queue
        playQueueRef.current = [];
        isDrainingRef.current = false;
        scheduledEndTimeRef.current = 0;
        clearCompleteTimer();
        queuedMsRef.current = 0;
        queuedChunksRef.current = 0;
        setIsPlaying(false);

        // Note: Don't call onPlaybackComplete here - that's for natural completion only

        // Suspend context
        if (playCtxRef.current && playCtxRef.current.state === 'running') {
            playCtxRef.current.suspend().catch(console.warn);
        }
    }, [clearCompleteTimer]);

    const clearQueue = useCallback(() => {
        playQueueRef.current = [];
        queuedMsRef.current = 0;
        queuedChunksRef.current = 0;
        clearCompleteTimer();
    }, [clearCompleteTimer]);

    const enqueueAudio = useCallback((base64Data: string, sampleRate?: number) => {
        if (isPausedRef.current) {
            emitEvent('audio_output_dropped', { reason: 'speaker_paused' });
            return;
        }

        try {
            const ctx = playCtxRef.current;
            if (!ctx || ctx.state === 'closed') {
                emitEvent('audio_output_dropped', { reason: 'playback_context_missing' });
                return;
            }
            const pcm16 = base64ToPCM16(base64Data);

            if (pcm16.length > 0) {
                const targetRate = Number.isFinite(sampleRate) && (sampleRate ?? 0) > 0 ? (sampleRate as number) : OUTPUT_SAMPLE_RATE;
                // Clone to avoid buffer reuse issues
                const chunk = new Int16Array(pcm16.length);
                chunk.set(pcm16);
                const durationMs = (chunk.length / targetRate) * 1000;
                const maxMs = maxQueueMsRef.current;
                const maxChunks = maxQueueChunksRef.current;
                const policy = dropPolicyRef.current;

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
                        droppedChunks = playQueueRef.current.length;
                        droppedMs = queuedMsRef.current;
                        playQueueRef.current = [];
                        queuedMsRef.current = 0;
                        queuedChunksRef.current = 0;
                    }

                    playQueueRef.current.push({ pcm: chunk, sampleRate: targetRate, durationMs });
                    queuedMsRef.current += durationMs;
                    queuedChunksRef.current += 1;

                    if (policy === 'drop-oldest') {
                        while (
                            (maxMs > 0 && queuedMsRef.current > maxMs) ||
                            (maxChunks > 0 && queuedChunksRef.current > maxChunks)
                        ) {
                            const dropped = playQueueRef.current.shift();
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
                    emitEvent('audio_output_queue_overflow', {
                        droppedChunks,
                        droppedMs,
                        queueMs: queuedMsRef.current,
                        queueChunks: queuedChunksRef.current,
                        policy,
                    });
                    if (policy === 'drop-newest') {
                        emitEvent('audio_output_dropped', { reason: 'queue_overflow', policy });
                        return;
                    }
                }

                clearCompleteTimer();

                // Signal playback started
                if (!isPlayingRef.current) {
                    setIsPlaying(true);
                    onPlaybackStartRef.current?.();
                }

                // Start draining if not already
                if (!isDrainingRef.current) {
                    drainQueue();
                }
            }
        } catch (e) {
            console.error('Failed to enqueue audio:', e);
        }
    }, [drainQueue, clearCompleteTimer, emitEvent]);

    // Handle pause state changes
    const stopPlaybackRef = useRef(stopPlayback);
    useEffect(() => { stopPlaybackRef.current = stopPlayback; }, [stopPlayback]);

    useEffect(() => {
        if (isPaused) {
            stopPlaybackRef.current();
        }
    }, [isPaused]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear resources directly without calling setState
            if (currentSourceRef.current) {
                try {
                    currentSourceRef.current.onended = null;
                    currentSourceRef.current.stop(0);
                } catch (e) { void e; }
            }
            playQueueRef.current = [];
            isDrainingRef.current = false;
            queuedMsRef.current = 0;
            queuedChunksRef.current = 0;
            clearCompleteTimer();
        };
    }, [clearCompleteTimer]);

    const getStats = useCallback(() => ({
        queueMs: queuedMsRef.current,
        queueChunks: queuedChunksRef.current,
        droppedChunks: droppedChunksRef.current,
        droppedMs: droppedMsRef.current,
        contextState: (playCtxRef.current?.state ?? 'none') as AudioContextState | 'none',
    }), []);

    return useMemo(() => ({
        isPlaying,
        enqueueAudio,
        stopPlayback,
        clearQueue,
        getStats,
    }), [isPlaying, enqueueAudio, stopPlayback, clearQueue, getStats]);
}
