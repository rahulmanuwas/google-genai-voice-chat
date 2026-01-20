// src/hooks/useVoiceInput.ts

/**
 * Hook for managing microphone input and streaming to Gemini Live API
 * Ported from tested g2p implementation (server-side VAD mode)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveSession } from '../lib/types';
import { INPUT_SAMPLE_RATE, encodeAudioToBase64, calculateRMSLevel } from '../lib/audio-utils';

// Microphone settings
const MIC_BUFFER_SIZE = 2048;
const MIC_CHANNELS = 1;

interface UseVoiceInputOptions {
    session: LiveSession | null;
    isEnabled: boolean;
    onVoiceStart?: () => void;
    onVoiceEnd?: () => void;
    onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
    isListening: boolean;
    micLevel: number;
    startMic: () => Promise<void>;
    stopMic: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
    const { session, isEnabled, onVoiceStart, onVoiceEnd, onError } = options;

    const [isListening, setIsListening] = useState(false);
    const [micLevel, setMicLevel] = useState(0);

    // Refs for audio context and nodes
    const micCtxRef = useRef<AudioContext | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micProcRef = useRef<ScriptProcessorNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micSilenceGainRef = useRef<GainNode | null>(null);

    // Refs for state that needs to be accessed in callbacks
    const isListeningRef = useRef(false);
    const sessionRef = useRef(session);

    // Callback refs
    const onVoiceStartRef = useRef(onVoiceStart);
    const onVoiceEndRef = useRef(onVoiceEnd);
    const onErrorRef = useRef(onError);

    // Keep refs updated
    useEffect(() => { sessionRef.current = session; }, [session]);
    useEffect(() => { onVoiceStartRef.current = onVoiceStart; }, [onVoiceStart]);
    useEffect(() => { onVoiceEndRef.current = onVoiceEnd; }, [onVoiceEnd]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const cleanup = useCallback(() => {
        try { micProcRef.current?.disconnect(); } catch (e) { void e; }
        try { micSourceRef.current?.disconnect(); } catch (e) { void e; }
        try { micSilenceGainRef.current?.disconnect(); } catch (e) { void e; }
        try { micCtxRef.current?.close(); } catch (e) { void e; }

        micProcRef.current = null;
        micSourceRef.current = null;
        micSilenceGainRef.current = null;
        micCtxRef.current = null;

        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;

        isListeningRef.current = false;
        setIsListening(false);
        setMicLevel(0);
    }, []);

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
        onVoiceEndRef.current?.();
    }, [cleanup]);

    const startMic = useCallback(async (): Promise<void> => {
        if (!sessionRef.current || isListeningRef.current) {
            console.log('Cannot start mic: session missing or already listening');
            return;
        }

        try {
            console.log('Starting microphone...');

            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
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

            // Smoothing for mic level
            let previousLevel = 0;

            // Create audio processor
            const audioProcessor = micCtxRef.current.createScriptProcessor(MIC_BUFFER_SIZE, MIC_CHANNELS, MIC_CHANNELS);

            audioProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
                if (!micCtxRef.current || !isListeningRef.current) return;

                const inputData = event.inputBuffer.getChannelData(0);

                // Calculate and smooth mic level for visual feedback
                const rms = calculateRMSLevel(inputData);
                const visualLevel = Math.min(1, rms * 10); // Scale for visibility
                previousLevel = previousLevel * 0.8 + visualLevel * 0.2;
                setMicLevel(previousLevel);

                // Encode and send audio (server VAD mode - send all audio)
                const sourceSampleRate = micCtxRef.current.sampleRate;
                const { data, mimeType } = encodeAudioToBase64(inputData, sourceSampleRate, INPUT_SAMPLE_RATE);

                try {
                    sessionRef.current?.sendRealtimeInput({ audio: { data, mimeType } });
                } catch (err) {
                    console.error('sendRealtimeInput error:', err);
                    onErrorRef.current?.('Audio streaming error');
                }
            };

            // Connect nodes (with silence to prevent feedback)
            micSilenceGainRef.current = micCtxRef.current.createGain();
            micSilenceGainRef.current.gain.value = 0;
            micSourceRef.current.connect(audioProcessor);
            audioProcessor.connect(micSilenceGainRef.current);
            micSilenceGainRef.current.connect(micCtxRef.current.destination);
            micProcRef.current = audioProcessor;

            isListeningRef.current = true;
            setIsListening(true);

            console.log(`Microphone started at ${micCtxRef.current.sampleRate}Hz`);
            onVoiceStartRef.current?.();
        } catch (err) {
            console.error('Mic start failed:', err);
            cleanup();
            onErrorRef.current?.(`Microphone error: ${(err as Error).message}`);
        }
    }, [cleanup]);

    // Stop mic when disabled - use ref to avoid effect dependency warning
    const stopMicRef = useRef(stopMic);
    useEffect(() => { stopMicRef.current = stopMic; }, [stopMic]);

    useEffect(() => {
        if (!isEnabled && isListeningRef.current) {
            stopMicRef.current();
        }
    }, [isEnabled]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isListeningRef.current) {
                cleanup();
            }
        };
    }, [cleanup]);

    return {
        isListening,
        micLevel,
        startMic,
        stopMic,
    };
}
