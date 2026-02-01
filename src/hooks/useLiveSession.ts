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
    const sessionHandleRef = useRef<string | null>(null);
    const isConnectedRef = useRef(false);
    const connectPromiseRef = useRef<Promise<void> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeReasonRef = useRef<'none' | 'intentional' | 'offline'>('none');
    const offlineRef = useRef(false);
    const shouldReconnectRef = useRef(false);

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
    useEffect(() => { sessionHandleRef.current = sessionHandle; }, [sessionHandle]);
    useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

    const emitEvent = useCallback((type: string, data?: Record<string, unknown>) => {
        config.onEvent?.({ type, ts: Date.now(), data });
    }, [config.onEvent]);

    // Session handle lifecycle on mount
    useEffect(() => {
        const storageKey = config.sessionStorageKey;
        if (config.clearSessionOnMount !== false) {
            try {
                localStorage.removeItem(storageKey);
                console.log('Cleared stored session handle on mount');
            } catch (e) {
                console.warn('Failed to clear stored session handle:', e);
            }
            return;
        }

        try {
            const stored = localStorage.getItem(storageKey);
            if (!stored) return;

            let handle: string | null = null;
            let ts = 0;

            try {
                const parsed = JSON.parse(stored) as { handle?: unknown; ts?: unknown };
                if (parsed && typeof parsed.handle === 'string') {
                    handle = parsed.handle;
                    ts = typeof parsed.ts === 'number' ? parsed.ts : Date.now();
                }
            } catch {
                handle = stored;
                ts = Date.now();
            }

            if (!handle) return;

            const ttl = config.sessionHandleTtlMs ?? 0;
            if (ttl > 0 && Date.now() - ts > ttl) {
                localStorage.removeItem(storageKey);
                emitEvent('session_handle_expired', { ttlMs: ttl });
                console.log('Stored session handle expired');
                return;
            }

            setSessionHandle(handle);
            console.log('Loaded stored session handle');
        } catch (e) {
            console.warn('Failed to load stored session handle:', e);
        }
    }, [config.sessionStorageKey, config.clearSessionOnMount, config.sessionHandleTtlMs, emitEvent]);

    const storeSessionHandle = useCallback((handle: string) => {
        setSessionHandle(handle);
        try {
            const payload = JSON.stringify({ handle, ts: Date.now() });
            localStorage.setItem(config.sessionStorageKey, payload);
            console.log('Session handle stored for resumption');
            emitEvent('session_handle_stored');
        } catch (e) {
            console.warn('Failed to store session handle:', e);
        }
    }, [config.sessionStorageKey, emitEvent]);

    const clearSessionHandle = useCallback(() => {
        setSessionHandle(null);
        try {
            localStorage.removeItem(config.sessionStorageKey);
            console.log('Session handle cleared');
            emitEvent('session_handle_cleared');
        } catch (e) {
            console.warn('Failed to clear session handle:', e);
        }
    }, [config.sessionStorageKey, emitEvent]);

    // Ref for attemptReconnection to avoid circular dependency
    const attemptReconnectionRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const scheduleReconnect = useCallback((reason: string, delayMs: number) => {
        if (isReconnectingRef.current) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

        clearReconnectTimer();
        isReconnectingRef.current = true;
        setIsReconnecting(true);
        emitEvent('session_reconnect_scheduled', { reason, delayMs });

        reconnectTimerRef.current = setTimeout(() => {
            void attemptReconnectionRef.current();
        }, Math.max(0, delayMs));
    }, [clearReconnectTimer, emitEvent]);

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

            const delay = Math.max(1000, parseInt(msg.goAway.timeLeft?.replace(/[^0-9]/g, '') || '5000') - 2000);
            scheduleReconnect('goaway', delay);
        }

        // Forward to external handler
        onMessageRef.current?.(msg);
    }, [storeSessionHandle, scheduleReconnect]);

    const ensurePlaybackContext = useCallback(() => {
        if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            playCtxRef.current = new Ctx({ sampleRate: config.playbackSampleRate ?? 24000 });
            console.log('Created playback context at', playCtxRef.current.sampleRate, 'Hz');
        }

        if (playCtxRef.current.state === 'suspended') {
            playCtxRef.current.resume().catch((e) => {
                console.warn('Playback context resume failed:', e);
            });
        }
    }, [config.playbackSampleRate]);

    const initializeSession = useCallback(async (resumptionHandle?: string | null): Promise<boolean> => {
        if (!apiKey) {
            onErrorRef.current?.('AI Assistant unavailable. Please check configuration.');
            emitEvent('session_connect_error', { reason: 'missing_api_key' });
            return false;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            // Initialize playback context (best-effort unlock)
            ensurePlaybackContext();

            console.log('Connecting to Google GenAI Live...', { model: config.modelId, hasResumption: !!resumptionHandle });
            emitEvent('session_connect_start', { hasResumption: !!resumptionHandle });

            const hasKeys = (obj?: Record<string, unknown>) => !!obj && Object.keys(obj).length > 0;
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
                            startOfSpeechSensitivity: config.serverVADStartSensitivity ?? StartSensitivity.START_SENSITIVITY_LOW,
                            endOfSpeechSensitivity: config.serverVADEndSensitivity ?? EndSensitivity.END_SENSITIVITY_HIGH,
                            prefixPaddingMs: config.serverVADPrefixPaddingMs,
                            silenceDurationMs: config.serverVADSilenceDurationMs,
                        },
                        activityHandling: ActivityHandling.NO_INTERRUPTION,
                    },
                    systemInstruction: { parts: [{ text: config.systemPrompt }] },
                    ...(hasKeys(config.speechConfig) ? { speechConfig: config.speechConfig } : {}),
                    ...(hasKeys(config.proactivity) ? { proactivity: config.proactivity } : {}),
                    ...(config.thinkingConfig && (config.thinkingConfig.thinkingBudget !== undefined || config.thinkingConfig.includeThoughts !== undefined)
                        ? { thinkingConfig: config.thinkingConfig }
                        : {}),
                    ...(config.enableAffectiveDialog ? { enableAffectiveDialog: true } : {}),
                },
                callbacks: {
                    onopen: () => {
                        console.log('Google GenAI Live connection opened');
                        setIsConnected(true);
                        setIsReconnecting(false);
                        isReconnectingRef.current = false;
                        clearReconnectTimer();
                        shouldReconnectRef.current = true;
                        offlineRef.current = false;
                        emitEvent('session_connected');
                        onConnectedRef.current?.();
                    },
                    onmessage: handleInternalMessage,
                    onerror: (err: Event | string) => {
                        console.error('Google GenAI Live error:', err);
                        setIsConnected(false);
                        emitEvent('session_error', { error: typeof err === 'string' ? err : 'Connection error' });
                        onErrorRef.current?.(typeof err === 'string' ? err : 'Connection error');
                    },
                    onclose: (event) => {
                        const code = event?.code || 0;
                        const reason = event?.reason || '';
                        const closeReason = closeReasonRef.current;
                        closeReasonRef.current = 'none';
                        console.log('Connection closed - Code:', code, 'Reason:', reason);
                        emitEvent('session_closed', { code, reason, closeReason });
                        setIsConnected(false);

                        if (closeReason === 'intentional') {
                            onDisconnectedRef.current?.();
                            return;
                        }

                        if (closeReason === 'offline') {
                            onDisconnectedRef.current?.();
                            return;
                        }

                        let errorMsg: string | null = null;
                        let shouldReconnect = code !== 1000;

                        if (code === 1008 && reason.includes('session not found')) {
                            errorMsg = 'Session expired. Reconnecting...';
                            clearSessionHandle();
                        } else if (code === 1008 || reason.includes('API key')) {
                            errorMsg = 'API key may not have Live API access.';
                            shouldReconnect = false;
                        } else if (code === 1013 || reason.includes('quota')) {
                            errorMsg = 'Usage limits reached.';
                            shouldReconnect = false;
                        } else if (code !== 1000) {
                            errorMsg = 'AI Assistant disconnected';
                        }

                        if (errorMsg) {
                            onErrorRef.current?.(errorMsg);
                        }

                        if (!shouldReconnect) {
                            shouldReconnectRef.current = false;
                        }

                        if (shouldReconnect && !isReconnectingRef.current) {
                            scheduleReconnect('close', 1500);
                        }

                        onDisconnectedRef.current?.();
                    },
                },
            });

            sessionRef.current = session as unknown as LiveSession;
            console.log('Google GenAI Live session initialized successfully');
            emitEvent('session_initialized');
            return true;
        } catch (err) {
            console.error('Failed to initialize Google GenAI Live:', err);
            setIsConnected(false);
            emitEvent('session_connect_error', { reason: (err as Error).message });
            onErrorRef.current?.(`Failed to initialize: ${(err as Error).message}`);
            return false;
        }
    }, [apiKey, config, handleInternalMessage, clearSessionHandle, ensurePlaybackContext, emitEvent, scheduleReconnect, clearReconnectTimer]);

    const initializeSessionWithFallback = useCallback(async (resumptionHandle?: string | null): Promise<boolean> => {
        const hadHandle = !!resumptionHandle;
        const success = await initializeSession(resumptionHandle || undefined);
        if (!success && hadHandle) {
            clearSessionHandle();
            return initializeSession(undefined);
        }
        return success;
    }, [initializeSession, clearSessionHandle]);

    const attemptReconnection = useCallback(async (maxRetries = 3): Promise<boolean> => {
        if (connectPromiseRef.current) {
            try {
                await connectPromiseRef.current;
            } catch {
                // Ignore - we'll continue with reconnection attempts
            }
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            emitEvent('session_reconnect_skipped', { reason: 'offline' });
            return false;
        }

        if (!isReconnectingRef.current) {
            isReconnectingRef.current = true;
            setIsReconnecting(true);
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Reconnection attempt ${attempt}/${maxRetries}`);
                onSystemMessageRef.current?.(`Reconnecting... (${attempt}/${maxRetries})`);
                emitEvent('session_reconnect_attempt', { attempt, maxRetries });

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

                await initializeSessionWithFallback(sessionHandleRef.current);

                if (sessionRef.current) {
                    console.log('Reconnection successful');
                    onSystemMessageRef.current?.('Reconnected successfully');
                    emitEvent('session_reconnect_success', { attempt });
                    return true;
                }
            } catch (error) {
                console.warn(`Reconnection attempt ${attempt} failed:`, error);
                emitEvent('session_reconnect_error', { attempt, error: (error as Error).message });
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000 * Math.pow(1.5, attempt - 1)));
                }
            }
        }

        setIsReconnecting(false);
        isReconnectingRef.current = false;
        onSystemMessageRef.current?.('Reconnection failed. Please refresh the page.');
        emitEvent('session_reconnect_failed', { maxRetries });
        return false;
    }, [initializeSessionWithFallback, config.useClientVAD, emitEvent]);

    // Keep attemptReconnection ref updated
    useEffect(() => {
        attemptReconnectionRef.current = attemptReconnection;
    }, [attemptReconnection]);

    useEffect(() => {
        return () => {
            clearReconnectTimer();
        };
    }, [clearReconnectTimer]);

    // Network status handling
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOnline = () => {
            offlineRef.current = false;
            emitEvent('network_online');
            if (!isConnectedRef.current && shouldReconnectRef.current && !isReconnectingRef.current) {
                scheduleReconnect('online', 500);
            }
        };

        const handleOffline = () => {
            offlineRef.current = true;
            emitEvent('network_offline');
            clearReconnectTimer();

            if (sessionRef.current) {
                closeReasonRef.current = 'offline';
                try {
                    sessionRef.current.close();
                } catch (e) {
                    console.warn('Session close failed during offline:', e);
                }
                sessionRef.current = null;
            }

            setIsConnected(false);
            setIsReconnecting(false);
            isReconnectingRef.current = false;
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [emitEvent, scheduleReconnect, clearReconnectTimer]);

    const connect = useCallback(async (): Promise<void> => {
        if (connectPromiseRef.current) {
            await connectPromiseRef.current;
            return;
        }
        if (isConnectedRef.current) return;

        const connectTask = (async () => {
            // Try to unlock audio on a user gesture
            ensurePlaybackContext();
            await initializeSessionWithFallback(sessionHandleRef.current);
        })();

        connectPromiseRef.current = connectTask;
        try {
            await connectTask;
        } finally {
            connectPromiseRef.current = null;
        }
    }, [ensurePlaybackContext, initializeSessionWithFallback]);

    const disconnect = useCallback(async (): Promise<void> => {
        console.log('Disconnecting session...');
        closeReasonRef.current = 'intentional';
        shouldReconnectRef.current = false;
        clearReconnectTimer();

        if (connectPromiseRef.current) {
            try {
                await connectPromiseRef.current;
            } catch {
                // Ignore connection errors when explicitly disconnecting
            }
        }

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
    }, [config.useClientVAD, clearReconnectTimer]);

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
