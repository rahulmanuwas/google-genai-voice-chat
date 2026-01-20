// src/hooks/useVoiceInput.ts

/**
 * Hook for managing microphone input and voice activity detection
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveSession } from '../lib/types';
import { AUDIO_CONFIG } from '../lib/constants';
import { encodeAudioForAPI, calculateRMSLevel } from '../lib/audio-utils';

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

    const streamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Keep callbacks in refs
    const onVoiceStartRef = useRef(onVoiceStart);
    const onVoiceEndRef = useRef(onVoiceEnd);
    const onErrorRef = useRef(onError);
    const sessionRef = useRef(session);

    useEffect(() => { onVoiceStartRef.current = onVoiceStart; }, [onVoiceStart]);
    useEffect(() => { onVoiceEndRef.current = onVoiceEnd; }, [onVoiceEnd]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => { sessionRef.current = session; }, [session]);

    const stopMic = useCallback(() => {
        console.log('Stopping microphone...');

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            void audioCtxRef.current.close();
            audioCtxRef.current = null;
        }

        setIsListening(false);
        setMicLevel(0);
        onVoiceEndRef.current?.();
    }, []);

    const startMic = useCallback(async (): Promise<void> => {
        if (isListening) return;
        if (!sessionRef.current) {
            console.warn('Cannot start mic: no session');
            return;
        }

        try {
            console.log('Starting microphone...');

            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            streamRef.current = stream;

            // Create audio context
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new Ctx({ sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE });
            audioCtxRef.current = audioCtx;

            // Create source from stream
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Create script processor for audio processing
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (!sessionRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const level = calculateRMSLevel(inputData);
                setMicLevel(level);

                // Encode and send to API
                const encoded = encodeAudioForAPI(inputData, audioCtx.sampleRate);

                try {
                    sessionRef.current.sendRealtimeInput({
                        audio: {
                            data: encoded,
                            mimeType: AUDIO_CONFIG.INPUT_MIME_TYPE,
                        },
                    });
                } catch (err) {
                    console.warn('Failed to send audio:', err);
                }
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);

            setIsListening(true);
            onVoiceStartRef.current?.();
            console.log('Microphone started at', audioCtx.sampleRate, 'Hz');

        } catch (err) {
            console.error('Failed to start microphone:', err);
            const message = (err as Error).message;

            if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
                onErrorRef.current?.('Microphone access denied. Please allow microphone access.');
            } else {
                onErrorRef.current?.(`Microphone error: ${message}`);
            }

            stopMic();
        }
    }, [isListening, stopMic]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopMic();
        };
    }, [stopMic]);

    // Stop when disabled
    useEffect(() => {
        if (!isEnabled && isListening) {
            stopMic();
        }
    }, [isEnabled, isListening, stopMic]);

    return {
        isListening,
        micLevel,
        startMic,
        stopMic,
    };
}
