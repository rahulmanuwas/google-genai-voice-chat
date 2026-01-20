// src/hooks/useVoiceOutput.ts

/**
 * Hook for managing audio playback of AI responses
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIO_CONFIG } from '../lib/constants';
import { decodeAudioFromAPI, resample } from '../lib/audio-utils';

interface UseVoiceOutputOptions {
    playbackContext: AudioContext | null;
    isPaused: boolean;
    onPlaybackStart?: () => void;
    onPlaybackComplete?: () => void;
}

interface UseVoiceOutputReturn {
    isPlaying: boolean;
    enqueueAudio: (base64Data: string) => void;
    stopPlayback: () => void;
}

export function useVoiceOutput(options: UseVoiceOutputOptions): UseVoiceOutputReturn {
    const { playbackContext, isPaused, onPlaybackStart, onPlaybackComplete } = options;

    const [isPlaying, setIsPlaying] = useState(false);

    const queueRef = useRef<Float32Array[]>([]);
    const isProcessingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Keep callbacks in refs
    const onPlaybackStartRef = useRef(onPlaybackStart);
    const onPlaybackCompleteRef = useRef(onPlaybackComplete);

    useEffect(() => { onPlaybackStartRef.current = onPlaybackStart; }, [onPlaybackStart]);
    useEffect(() => { onPlaybackCompleteRef.current = onPlaybackComplete; }, [onPlaybackComplete]);

    const stopPlayback = useCallback(() => {
        console.log('Stopping playback...');

        if (currentSourceRef.current) {
            try {
                currentSourceRef.current.stop();
                currentSourceRef.current.disconnect();
            } catch (e) {
                // Ignore errors from already stopped sources
            }
            currentSourceRef.current = null;
        }

        queueRef.current = [];
        isProcessingRef.current = false;
        setIsPlaying(false);
        onPlaybackCompleteRef.current?.();
    }, []);

    const processQueue = useCallback(async () => {
        if (isProcessingRef.current || !playbackContext || isPaused) return;
        if (queueRef.current.length === 0) {
            setIsPlaying(false);
            onPlaybackCompleteRef.current?.();
            return;
        }

        isProcessingRef.current = true;
        setIsPlaying(true);

        const chunk = queueRef.current.shift()!;

        try {
            // Resample to playback context's sample rate if needed
            const resampled = resample(chunk, AUDIO_CONFIG.OUTPUT_SAMPLE_RATE, playbackContext.sampleRate);

            // Create audio buffer
            const buffer = playbackContext.createBuffer(1, resampled.length, playbackContext.sampleRate);
            buffer.getChannelData(0).set(resampled);

            // Create and play source
            const source = playbackContext.createBufferSource();
            source.buffer = buffer;
            source.connect(playbackContext.destination);
            currentSourceRef.current = source;

            source.onended = () => {
                currentSourceRef.current = null;
                isProcessingRef.current = false;
                // Process next chunk
                void processQueue();
            };

            if (onPlaybackStartRef.current && !isPlaying) {
                onPlaybackStartRef.current();
            }

            source.start();
        } catch (err) {
            console.error('Playback error:', err);
            isProcessingRef.current = false;
            // Try next chunk
            void processQueue();
        }
    }, [playbackContext, isPaused, isPlaying]);

    const enqueueAudio = useCallback((base64Data: string) => {
        try {
            const audioData = decodeAudioFromAPI(base64Data);
            queueRef.current.push(audioData);

            // Start processing if not already
            if (!isProcessingRef.current && !isPaused) {
                void processQueue();
            }
        } catch (err) {
            console.error('Failed to decode audio:', err);
        }
    }, [isPaused, processQueue]);

    // Stop when paused
    useEffect(() => {
        if (isPaused && isPlaying) {
            stopPlayback();
        }
    }, [isPaused, isPlaying, stopPlayback]);

    // Resume when unpaused
    useEffect(() => {
        if (!isPaused && queueRef.current.length > 0 && !isProcessingRef.current) {
            void processQueue();
        }
    }, [isPaused, processQueue]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPlayback();
        };
    }, [stopPlayback]);

    return {
        isPlaying,
        enqueueAudio,
        stopPlayback,
    };
}
