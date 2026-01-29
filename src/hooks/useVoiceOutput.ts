// src/hooks/useVoiceOutput.ts

/**
 * Hook for managing audio playback from Gemini Live API responses
 * Ported from tested g2p implementation
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { OUTPUT_SAMPLE_RATE, PLAYBACK_COMPLETE_DELAY_MS, base64ToPCM16, pcm16ToFloat32 } from '../lib/audio-utils';

interface UseVoiceOutputOptions {
    playbackContext: AudioContext | null;
    isPaused: boolean;
    onPlaybackStart?: () => void;
    onPlaybackComplete?: () => void;
}

interface UseVoiceOutputReturn {
    isPlaying: boolean;
    enqueueAudio: (base64Data: string, sampleRate?: number) => void;
    stopPlayback: () => void;
    clearQueue: () => void;
}

export function useVoiceOutput(options: UseVoiceOutputOptions): UseVoiceOutputReturn {
    const { playbackContext, isPaused, onPlaybackStart, onPlaybackComplete } = options;

    const [isPlaying, setIsPlaying] = useState(false);

    // Audio queue and state refs
    const playQueueRef = useRef<Array<{ pcm: Int16Array; sampleRate: number }>>([]);
    const isDrainingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const scheduledEndTimeRef = useRef(0);

    // Callback refs
    const onPlaybackStartRef = useRef(onPlaybackStart);
    const onPlaybackCompleteRef = useRef(onPlaybackComplete);
    const playCtxRef = useRef(playbackContext);
    const isPausedRef = useRef(isPaused);
    const isPlayingRef = useRef(isPlaying);

    // Keep refs updated
    useEffect(() => { onPlaybackStartRef.current = onPlaybackStart; }, [onPlaybackStart]);
    useEffect(() => { onPlaybackCompleteRef.current = onPlaybackComplete; }, [onPlaybackComplete]);
    useEffect(() => { playCtxRef.current = playbackContext; }, [playbackContext]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Use a ref for recursive scheduling to avoid circular dependency
    const scheduleChunksRef = useRef<() => void>(() => { });

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
                setTimeout(() => {
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
            while (playQueueRef.current.length > 0 && playQueueRef.current[0].sampleRate === targetRate) {
                const next = playQueueRef.current.shift();
                if (!next) break;
                chunks.push(next.pcm);
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
            const startTime = Math.max(now, scheduledEndTimeRef.current);
            scheduledEndTimeRef.current = startTime + audioBuffer.duration;

            source.onended = () => {
                currentSourceRef.current = null;

                // Check for more chunks using ref
                if (playQueueRef.current.length > 0) {
                    scheduleChunksRef.current();
                } else {
                    // Wait a bit for more chunks
                    setTimeout(() => {
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
    }, []);

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
        setIsPlaying(false);

        // Note: Don't call onPlaybackComplete here - that's for natural completion only

        // Suspend context
        if (playCtxRef.current && playCtxRef.current.state === 'running') {
            playCtxRef.current.suspend().catch(console.warn);
        }
    }, []);

    const clearQueue = useCallback(() => {
        playQueueRef.current = [];
    }, []);

    const enqueueAudio = useCallback((base64Data: string, sampleRate?: number) => {
        if (isPausedRef.current) return;

        try {
            const pcm16 = base64ToPCM16(base64Data);

            if (pcm16.length > 0) {
                const targetRate = sampleRate ?? OUTPUT_SAMPLE_RATE;
                // Clone to avoid buffer reuse issues
                const chunk = new Int16Array(pcm16.length);
                chunk.set(pcm16);
                playQueueRef.current.push({ pcm: chunk, sampleRate: targetRate });

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
    }, [drainQueue]);

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
        };
    }, []);

    return {
        isPlaying,
        enqueueAudio,
        stopPlayback,
        clearQueue,
    };
}
