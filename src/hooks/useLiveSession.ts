// src/hooks/useLiveSession.ts

/**
 * Hook for managing Gemini Live API session lifecycle
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    GoogleGenAI,
    Modality,
    StartSensitivity,
    EndSensitivity,
    ActivityHandling,
    type LiveServerMessage,
} from '@google/genai';
import type { LiveSession, MessageHandler, VoiceChatConfig } from '../lib/types';
import { mergeConfig } from '../lib/constants';

interface UseLiveSessionOptions {
    config: VoiceChatConfig;
    apiKey: string;
    onMessage?: MessageHandler;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
    onSystemMessage?: (message: string) => void;
}

interface UseLiveSessionReturn {
    session: LiveSession | null;
    isConnected: boolean;
    isReconnecting: boolean;
    sessionHandle: string | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    sendText: (text: string) => void;
    playbackContext: AudioContext | null;
}

export function useLiveSession(options: UseLiveSessionOptions): UseLiveSessionReturn {
    const { config: userConfig, apiKey, onMessage, onConnected, onDisconnected, onError, onSystemMessage } = options;
    const config = mergeConfig(userConfig);

    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [sessionHandle, setSessionHandle] = useState<string | null>(null);

    const sessionRef = useRef<LiveSession | null>(null);
    const playCtxRef = useRef<AudioContext | null>(null);
    const isReconnectingRef = useRef(false);

    // Keep callbacks in refs to avoid stale closures
    const onMessageRef = useRef(onMessage);
    const onConnectedRef = useRef(onConnected);
    const onDisconnectedRef = useRef(onDisconnected);
    const onErrorRef = useRef(onError);
    const onSystemMessageRef = useRef(onSystemMessage);

    useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
    useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);
    useEffect(() => { onDisconnectedRef.current = onDisconnected; }, [onDisconnected]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => { onSystemMessageRef.current = onSystemMessage; }, [onSystemMessage]);

    // Clear stored session handle on mount - stale handles cause issues on page refresh
    useEffect(() => {
        try {
            localStorage.removeItem(config.sessionStorageKey);
            console.log('Cleared stored session handle on mount');
        } catch (e) {
            console.warn('Failed to clear stored session handle:', e);
        }
    }, [config.sessionStorageKey]);

    const storeSessionHandle = useCallback((handle: string) => {
        setSessionHandle(handle);
        try {
            localStorage.setItem(config.sessionStorageKey, handle);
            console.log('Session handle stored for resumption');
        } catch (e) {
            console.warn('Failed to store session handle:', e);
        }
    }, [config.sessionStorageKey]);

    const clearSessionHandle = useCallback(() => {
        setSessionHandle(null);
        try {
            localStorage.removeItem(config.sessionStorageKey);
            console.log('Session handle cleared');
        } catch (e) {
            console.warn('Failed to clear session handle:', e);
        }
    }, [config.sessionStorageKey]);

    // Ref for attemptReconnection to avoid circular dependency
    const attemptReconnectionRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

    const handleInternalMessage = useCallback((msg: LiveServerMessage) => {
        // Handle session resumption updates
        if (msg.sessionResumptionUpdate) {
            if (msg.sessionResumptionUpdate.resumable && msg.sessionResumptionUpdate.newHandle) {
                storeSessionHandle(msg.sessionResumptionUpdate.newHandle);
            }
        }

        // Handle GoAway messages (proactive reconnection)
        if (msg.goAway) {
            console.warn('GoAway received, connection will terminate in:', msg.goAway.timeLeft);
            onSystemMessageRef.current?.(`Connection will terminate in ${msg.goAway.timeLeft}`);

            if (!isReconnectingRef.current) {
                isReconnectingRef.current = true;
                setIsReconnecting(true);

                const delay = Math.max(1000, parseInt(msg.goAway.timeLeft?.replace(/[^0-9]/g, '') || '5000') - 2000);
                setTimeout(() => {
                    void attemptReconnectionRef.current();
                }, delay);
            }
        }

        // Forward to external handler
        onMessageRef.current?.(msg);
    }, [storeSessionHandle]);

    const initializeSession = useCallback(async (resumptionHandle?: string): Promise<void> => {
        if (!apiKey) {
            onErrorRef.current?.('AI Assistant unavailable. Please check configuration.');
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            // Initialize playback context
            if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
                const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                playCtxRef.current = new Ctx();
                console.log('Created playback context at', playCtxRef.current.sampleRate, 'Hz');
            } else if (playCtxRef.current.state === 'suspended') {
                await playCtxRef.current.resume();
            }

            console.log('Connecting to Google GenAI Live...', { model: config.modelId, hasResumption: !!resumptionHandle });

            const session = await ai.live.connect({
                model: config.modelId,
                config: {
                    responseModalities: [config.replyAsAudio ? Modality.AUDIO : Modality.TEXT],
                    ...(config.replyAsAudio ? {
                        outputAudioTranscription: {},
                        inputAudioTranscription: {},
                    } : {}),
                    contextWindowCompression: { slidingWindow: {} },
                    sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
                    realtimeInputConfig: config.useClientVAD ? {
                        automaticActivityDetection: { disabled: true },
                    } : {
                        automaticActivityDetection: {
                            disabled: false,
                            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
                            prefixPaddingMs: config.serverVADPrefixPaddingMs,
                            silenceDurationMs: config.serverVADSilenceDurationMs,
                        },
                        activityHandling: ActivityHandling.NO_INTERRUPTION,
                    },
                    systemInstruction: { parts: [{ text: config.systemPrompt }] },
                },
                callbacks: {
                    onopen: () => {
                        console.log('Google GenAI Live connection opened');
                        setIsConnected(true);
                        setIsReconnecting(false);
                        isReconnectingRef.current = false;
                        onConnectedRef.current?.();
                    },
                    onmessage: handleInternalMessage,
                    onerror: (err: Event | string) => {
                        console.error('Google GenAI Live error:', err);
                        setIsConnected(false);
                        onErrorRef.current?.(typeof err === 'string' ? err : 'Connection error');
                    },
                    onclose: (event) => {
                        const code = event?.code || 0;
                        const reason = event?.reason || '';
                        console.log('Connection closed - Code:', code, 'Reason:', reason);
                        setIsConnected(false);

                        if (code !== 1000) {
                            let errorMsg = 'AI Assistant disconnected';
                            if (code === 1008 && reason.includes('session not found')) {
                                errorMsg = 'Session could not be established. Please refresh.';
                                clearSessionHandle();
                            } else if (code === 1008 || reason.includes('API key')) {
                                errorMsg = 'API key may not have Live API access.';
                            } else if (code === 1013 || reason.includes('quota')) {
                                errorMsg = 'Usage limits reached.';
                            }
                            onErrorRef.current?.(errorMsg);
                        }

                        onDisconnectedRef.current?.();
                    },
                },
            });

            sessionRef.current = session as unknown as LiveSession;
            console.log('Google GenAI Live session initialized successfully');
        } catch (err) {
            console.error('Failed to initialize Google GenAI Live:', err);
            setIsConnected(false);
            onErrorRef.current?.(`Failed to initialize: ${(err as Error).message}`);
        }
    }, [apiKey, config, handleInternalMessage, clearSessionHandle]);

    const attemptReconnection = useCallback(async (maxRetries = 3): Promise<boolean> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Reconnection attempt ${attempt}/${maxRetries}`);
                onSystemMessageRef.current?.(`Reconnecting... (${attempt}/${maxRetries})`);

                // Close existing session gracefully
                if (sessionRef.current) {
                    try {
                        if (!config.useClientVAD) {
                            sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
                        }
                        sessionRef.current.close();
                    } catch (e) {
                        console.warn('Session cleanup during reconnection:', e);
                    }
                    sessionRef.current = null;
                }

                await initializeSession(sessionHandle || undefined);

                if (sessionRef.current) {
                    console.log('Reconnection successful');
                    onSystemMessageRef.current?.('Reconnected successfully');
                    return true;
                }
            } catch (error) {
                console.warn(`Reconnection attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000 * Math.pow(1.5, attempt - 1)));
                }
            }
        }

        setIsReconnecting(false);
        isReconnectingRef.current = false;
        onSystemMessageRef.current?.('Reconnection failed. Please refresh the page.');
        return false;
    }, [initializeSession, sessionHandle, config.useClientVAD]);

    // Keep attemptReconnection ref updated
    useEffect(() => {
        attemptReconnectionRef.current = attemptReconnection;
    }, [attemptReconnection]);

    const connect = useCallback(async (): Promise<void> => {
        await initializeSession(sessionHandle || undefined);
    }, [initializeSession, sessionHandle]);

    const disconnect = useCallback(async (): Promise<void> => {
        console.log('Disconnecting session...');

        if (sessionRef.current) {
            try {
                if (!config.useClientVAD) {
                    sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
                }
                sessionRef.current.close();
            } catch (e) {
                console.warn('Session close failed:', e);
            }
            sessionRef.current = null;
        }

        if (playCtxRef.current && playCtxRef.current.state !== 'closed') {
            try {
                await playCtxRef.current.close();
            } catch (e) {
                console.warn('Playback context close failed:', e);
            }
            playCtxRef.current = null;
        }

        setIsConnected(false);
        setIsReconnecting(false);
        isReconnectingRef.current = false;
    }, [config.useClientVAD]);

    const sendText = useCallback((text: string): void => {
        if (!sessionRef.current || !text.trim()) return;

        try {
            console.log('Sending text message:', text);
            sessionRef.current.sendClientContent({ turns: text, turnComplete: true });
        } catch (e) {
            console.error('Send text failed:', e);
            onErrorRef.current?.(`Send failed: ${(e as Error).message}`);
        }
    }, []);

    return {
        session: sessionRef.current,
        isConnected,
        isReconnecting,
        sessionHandle,
        connect,
        disconnect,
        sendText,
        playbackContext: playCtxRef.current,
    };
}
