// src/hooks/useVoiceChat.ts

/**
 * Unified hook for voice chat that orchestrates session, input, and output
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveServerMessage } from '@google/genai';
import type { ChatMessage, ChatRole, VoiceChatConfig } from '../lib/types';
import { mergeConfig } from '../lib/constants';
import { useLiveSession } from './useLiveSession';
import { useVoiceInput } from './useVoiceInput';
import { useVoiceOutput } from './useVoiceOutput';

interface UseVoiceChatOptions {
    config: VoiceChatConfig;
    apiKey: string;
}

interface UseVoiceChatReturn {
    // Connection state
    isConnected: boolean;
    isReconnecting: boolean;

    // Voice state
    isListening: boolean;
    isAISpeaking: boolean;
    micLevel: number;

    // Audio controls
    isMuted: boolean;
    isMicEnabled: boolean;
    isSpeakerPaused: boolean;

    // Messages
    messages: ChatMessage[];
    isLoading: boolean;

    // Actions
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    sendText: (text: string) => void;
    toggleMute: () => void;
    toggleMic: () => void;
    toggleSpeaker: () => void;
}

export function useVoiceChat(options: UseVoiceChatOptions): UseVoiceChatReturn {
    const { config: userConfig, apiKey } = options;
    const config = mergeConfig(userConfig);

    // Message state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const maxMessages = config.maxMessages ?? 0;
    const maxTranscriptChars = config.maxTranscriptChars ?? 0;

    // Audio control state
    const [isMuted, setIsMuted] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isSpeakerPaused, setIsSpeakerPaused] = useState(false);
    const [isAISpeaking, setIsAISpeaking] = useState(false);

    // Refs for state access in callbacks
    const isMutedRef = useRef(false);
    const isMicEnabledRef = useRef(true);
    const micEnabledBeforeMuteRef = useRef(true);
    const isSpeakerPausedRef = useRef(isSpeakerPaused);

    const limitText = useCallback((text: string): string => {
        if (!maxTranscriptChars || maxTranscriptChars <= 0) return text;
        if (text.length <= maxTranscriptChars) return text;
        return text.slice(text.length - maxTranscriptChars);
    }, [maxTranscriptChars]);

    const appendWithLimit = useCallback((base: string, addition: string): string => {
        if (!addition) return base;
        return limitText(base + addition);
    }, [limitText]);

    const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        setMessages(prev => {
            const next = updater(prev);
            if (maxMessages && maxMessages > 0 && next.length > maxMessages) {
                return next.slice(next.length - maxMessages);
            }
            return next;
        });
    }, [maxMessages]);

    const emitEvent = useCallback((type: string, data?: Record<string, unknown>) => {
        config.onEvent?.({ type, ts: Date.now(), data });
    }, [config.onEvent]);

    // Transcript handling
    const currentTranscriptRef = useRef('');
    const streamingMsgIdRef = useRef<string | null>(null);

    // Input transcription handling (user's speech)
    const currentInputTranscriptRef = useRef('');
    const streamingInputMsgIdRef = useRef<string | null>(null);
    const pendingMicResumeRef = useRef(false);
    const sessionConnectedRef = useRef(false);
    const welcomeSentRef = useRef(false);
    const sawAudioRef = useRef(false);
    const wasListeningBeforeHideRef = useRef(false);
    const wasListeningBeforeOfflineRef = useRef(false);
    const micResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs for cross-hook communication (avoids circular dependencies)
    const voiceOutputRef = useRef<{ stopPlayback: () => void; enqueueAudio: (data: string, sampleRate?: number) => void } | null>(null);
    const voiceInputRef = useRef<{ stopMic: () => void; startMic: () => Promise<void>; isListening: boolean } | null>(null);

    // Keep refs synced
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);
    useEffect(() => { isSpeakerPausedRef.current = isSpeakerPaused; }, [isSpeakerPaused]);

    // Helper to add messages
    const pushMsg = useCallback((content: string, role: ChatRole) => {
        const safeContent = limitText(content);
        updateMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            content: safeContent,
            role,
            ts: Date.now(),
        }]);
    }, [limitText, updateMessages]);

    const pauseMicForModelReply = useCallback(() => {
        pendingMicResumeRef.current = true;
        sawAudioRef.current = false;
        voiceInputRef.current?.stopMic();
    }, []);

    const resumeMicIfAllowed = useCallback(() => {
        if (
            !pendingMicResumeRef.current ||
            !sessionConnectedRef.current ||
            isMutedRef.current ||
            !isMicEnabledRef.current
        ) {
            return;
        }

        pendingMicResumeRef.current = false;
        const delay = config.micResumeDelayMs ?? 200;
        setTimeout(() => {
            if (!voiceInputRef.current?.isListening) {
                void voiceInputRef.current?.startMic();
            }
        }, delay);
    }, [config.micResumeDelayMs]);

    const scheduleMicResume = useCallback((reason: string) => {
        if (micResumeTimerRef.current) {
            clearTimeout(micResumeTimerRef.current);
        }

        const delay = config.micResumeDelayMs ?? 200;
        micResumeTimerRef.current = setTimeout(() => {
            micResumeTimerRef.current = null;
            if (
                !sessionConnectedRef.current ||
                isMutedRef.current ||
                !isMicEnabledRef.current ||
                isAISpeakingRef.current
            ) {
                return;
            }

            if (!voiceInputRef.current?.isListening) {
                void voiceInputRef.current?.startMic();
            }
        }, delay);

        emitEvent('mic_resume_scheduled', { reason, delay });
    }, [config.micResumeDelayMs, emitEvent]);

    // Message handler for processing Gemini responses
    const handleMessage = useCallback((msg: LiveServerMessage) => {
        const parseSampleRate = (mimeType?: string): number | undefined => {
            if (!mimeType) return undefined;
            const match = mimeType.match(/rate=(\d+)/i);
            if (!match) return undefined;
            const rate = Number(match[1]);
            return Number.isFinite(rate) ? rate : undefined;
        };
        // Handle input transcription (user's speech)
        const inputTranscript = msg.serverContent?.inputTranscription?.text;
        if (inputTranscript && config.replyAsAudio) {
            console.log('Received input transcription:', inputTranscript);

            if (!streamingInputMsgIdRef.current) {
                const id = `input-${Date.now()}-${Math.random()}`;
                streamingInputMsgIdRef.current = id;
                currentInputTranscriptRef.current = limitText(inputTranscript);
                updateMessages(prev => [...prev, { id, content: currentInputTranscriptRef.current, role: 'user', ts: Date.now() }]);
            } else {
                const id = streamingInputMsgIdRef.current;
                currentInputTranscriptRef.current = appendWithLimit(currentInputTranscriptRef.current, inputTranscript);
                updateMessages(prev => prev.map(m => m.id === id ? { ...m, content: appendWithLimit(m.content, inputTranscript) } : m));
            }
        }

        // Handle interruptions
        if (msg.serverContent?.interrupted) {
            console.log('Generation interrupted');
            voiceOutputRef.current?.stopPlayback();
            currentTranscriptRef.current = '';
            streamingMsgIdRef.current = null;
        }

        // Handle generation complete
        if (msg.serverContent?.generationComplete) {
            setIsLoading(false);
            if (config.replyAsAudio && streamingMsgIdRef.current && currentTranscriptRef.current.trim()) {
                const cleanTranscript = limitText(currentTranscriptRef.current.replace(/\s+/g, ' ').trim());
                const id = streamingMsgIdRef.current;
                updateMessages(prev => prev.map(m => m.id === id ? { ...m, content: cleanTranscript } : m));
                currentTranscriptRef.current = '';
                streamingMsgIdRef.current = null;
            }
        }

        // Direct text response (non-audio mode) - cast for runtime properties
        const msgAny = msg as LiveServerMessage & { text?: string; data?: string };
        if (msgAny.text && !config.replyAsAudio) {
            pushMsg(msgAny.text, 'model');
            setIsLoading(false);
        }

        // Parts from modelTurn
        const parts = msg.serverContent?.modelTurn?.parts ?? [];
        for (const p of parts) {
            if (p.text && !config.replyAsAudio) {
                pushMsg(p.text, 'model');
                setIsLoading(false);
            }

            // Audio data
            if (p.inlineData?.mimeType?.startsWith('audio/') && p.inlineData.data && config.replyAsAudio) {
                if (isSpeakerPausedRef.current) {
                    pauseMicForModelReply();
                    emitEvent('audio_output_dropped', { reason: 'speaker_paused' });
                } else {
                    sawAudioRef.current = true;
                    setIsAISpeaking(true);
                    voiceOutputRef.current?.enqueueAudio(p.inlineData.data, parseSampleRate(p.inlineData.mimeType));
                }
            }
        }

        // Direct audio data (when not in parts)
        if (msgAny.data && config.replyAsAudio && !parts.some(p => p.inlineData?.data)) {
            if (isSpeakerPausedRef.current) {
                pauseMicForModelReply();
                emitEvent('audio_output_dropped', { reason: 'speaker_paused' });
            } else {
                sawAudioRef.current = true;
                setIsAISpeaking(true);
                voiceOutputRef.current?.enqueueAudio(msgAny.data);
            }
        }

        // Output transcription (streaming)
        const transcript = msg.serverContent?.outputTranscription?.text;
        if (transcript && config.replyAsAudio) {
            // Finalize pending user input transcription
            if (streamingInputMsgIdRef.current && currentInputTranscriptRef.current.trim()) {
                const cleanInput = limitText(currentInputTranscriptRef.current.replace(/\s+/g, ' ').trim());
                const inputId = streamingInputMsgIdRef.current;
                updateMessages(prev => prev.map(m => m.id === inputId ? { ...m, content: cleanInput } : m));
                streamingInputMsgIdRef.current = null;
                currentInputTranscriptRef.current = '';
            }

            if (!streamingMsgIdRef.current) {
                const id = `${Date.now()}-${Math.random()}`;
                streamingMsgIdRef.current = id;
                updateMessages(prev => [...prev, { id, content: limitText(transcript), role: 'model', ts: Date.now() }]);
            } else {
                const id = streamingMsgIdRef.current;
                updateMessages(prev => prev.map(m => m.id === id ? { ...m, content: appendWithLimit(m.content, transcript) } : m));
            }
            currentTranscriptRef.current = appendWithLimit(currentTranscriptRef.current, transcript);
        }

        // Turn complete
        if (msg.serverContent?.turnComplete && config.replyAsAudio) {
            setIsLoading(false);
            // Finalize user input transcription
            if (streamingInputMsgIdRef.current && currentInputTranscriptRef.current.trim()) {
                const cleanInput = limitText(currentInputTranscriptRef.current.replace(/\s+/g, ' ').trim());
                const inputId = streamingInputMsgIdRef.current;
                updateMessages(prev => prev.map(m => m.id === inputId ? { ...m, content: cleanInput } : m));
                streamingInputMsgIdRef.current = null;
                currentInputTranscriptRef.current = '';
            }

            // Finalize model output transcription
            if (streamingMsgIdRef.current && currentTranscriptRef.current.trim()) {
                const cleanTranscript = limitText(currentTranscriptRef.current.replace(/\s+/g, ' ').trim());
                const id = streamingMsgIdRef.current;
                updateMessages(prev => prev.map(m => m.id === id ? { ...m, content: cleanTranscript } : m));
            }
            currentTranscriptRef.current = '';
            streamingMsgIdRef.current = null;

            if (!sawAudioRef.current || isSpeakerPausedRef.current) {
                resumeMicIfAllowed();
            }
        }
    }, [config.replyAsAudio, pushMsg, resumeMicIfAllowed, appendWithLimit, updateMessages, limitText, emitEvent, pauseMicForModelReply]);

    // Session hook
    const session = useLiveSession({
        config: userConfig,
        apiKey,
        onMessage: handleMessage,
        onConnected: () => {
            if (config.welcomeMessage) {
                pushMsg(config.welcomeMessage, 'system');
            }
        },
        onDisconnected: () => {
            setIsAISpeaking(false);
            setIsLoading(false);
            pendingMicResumeRef.current = false;
        },
        onError: (error) => {
            pushMsg(error, 'system');
            setIsLoading(false);
        },
        onSystemMessage: (message) => {
            pushMsg(message, 'system');
        },
    });

    useEffect(() => {
        sessionConnectedRef.current = session.isConnected;
    }, [session.isConnected]);

    // Voice output hook
    const voiceOutput = useVoiceOutput({
        playbackContext: session.playbackContext,
        isPaused: isSpeakerPaused,
        startBufferMs: config.playbackStartDelayMs,
        maxQueueMs: config.maxOutputQueueMs,
        maxQueueChunks: config.maxOutputQueueChunks,
        onEvent: config.onEvent,
        onPlaybackStart: () => {
            setIsAISpeaking(true);
            pendingMicResumeRef.current = true;
            voiceInputRef.current?.stopMic();
        },
        onPlaybackComplete: () => {
            setIsAISpeaking(false);
            resumeMicIfAllowed();
        },
    });

    // Voice input hook
    const voiceInput = useVoiceInput({
        session: session.session,
        isEnabled: session.isConnected && !isMuted && isMicEnabled,
        maxConsecutiveErrors: config.maxConsecutiveInputErrors,
        errorCooldownMs: config.inputErrorCooldownMs,
        onEvent: config.onEvent,
        onVoiceStart: () => {
            // Barge-in: stop AI playback when user speaks
            voiceOutputRef.current?.stopPlayback();
            setIsAISpeaking(false);
        },
        onError: (error) => {
            pushMsg(error, 'system');
        },
    });

    // Update refs when hooks are ready
    useEffect(() => {
        voiceOutputRef.current = voiceOutput;
    }, [voiceOutput]);

    useEffect(() => {
        voiceInputRef.current = voiceInput;
    }, [voiceInput]);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handleVisibility = () => {
            if (document.hidden) {
                wasListeningBeforeHideRef.current = !!voiceInputRef.current?.isListening || pendingMicResumeRef.current;
                voiceInputRef.current?.stopMic();
                voiceOutputRef.current?.stopPlayback();
                pendingMicResumeRef.current = false;
                if (micResumeTimerRef.current) {
                    clearTimeout(micResumeTimerRef.current);
                    micResumeTimerRef.current = null;
                }
                emitEvent('visibility_hidden');
            } else {
                emitEvent('visibility_visible');
                if (wasListeningBeforeHideRef.current) {
                    wasListeningBeforeHideRef.current = false;
                    scheduleMicResume('visibility');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [emitEvent, scheduleMicResume]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOffline = () => {
            wasListeningBeforeOfflineRef.current = !!voiceInputRef.current?.isListening || pendingMicResumeRef.current;
            voiceInputRef.current?.stopMic();
            voiceOutputRef.current?.stopPlayback();
            pendingMicResumeRef.current = false;
            if (micResumeTimerRef.current) {
                clearTimeout(micResumeTimerRef.current);
                micResumeTimerRef.current = null;
            }
        };

        const handleOnline = () => {
            if (wasListeningBeforeOfflineRef.current) {
                wasListeningBeforeOfflineRef.current = false;
                scheduleMicResume('online');
            }
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [scheduleMicResume]);

    useEffect(() => {
        return () => {
            if (micResumeTimerRef.current) {
                clearTimeout(micResumeTimerRef.current);
                micResumeTimerRef.current = null;
            }
        };
    }, []);

    // Auto-start mic when connected (simplified from Daejung)
    const startMicRef = useRef(voiceInput.startMic);
    useEffect(() => { startMicRef.current = voiceInput.startMic; }, [voiceInput.startMic]);

    useEffect(() => {
        if (
            session.isConnected &&
            config.autoStartMicOnConnect !== false &&
            !voiceInput.isListening &&
            !isMuted &&
            isMicEnabled &&
            !session.isReconnecting &&
            !pendingMicResumeRef.current &&
            !isAISpeakingRef.current
        ) {
            console.log('Auto-starting mic after connection...');
            const timer = setTimeout(() => {
                void startMicRef.current();
            }, config.sessionInitDelayMs);
            return () => clearTimeout(timer);
        }
    }, [session.isConnected, session.isReconnecting, voiceInput.isListening, isMuted, isMicEnabled, config.sessionInitDelayMs]);

    useEffect(() => {
        if (
            session.isConnected &&
            config.autoWelcomeAudio &&
            config.welcomeAudioPrompt &&
            !welcomeSentRef.current
        ) {
            welcomeSentRef.current = true;
            pauseMicForModelReply();
            session.sendText(config.welcomeAudioPrompt);
        }
    }, [session.isConnected, config.autoWelcomeAudio, config.welcomeAudioPrompt, pauseMicForModelReply, session]);

    // Stop everything when disconnected
    const isAISpeakingRef = useRef(false);
    useEffect(() => { isAISpeakingRef.current = isAISpeaking; }, [isAISpeaking]);

    useEffect(() => {
        if (!session.isConnected) {
            voiceInputRef.current?.stopMic();
            voiceOutputRef.current?.stopPlayback();
            pendingMicResumeRef.current = false;
            if (micResumeTimerRef.current) {
                clearTimeout(micResumeTimerRef.current);
                micResumeTimerRef.current = null;
            }
        }
    }, [session.isConnected]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newMuted = !prev;
            if (newMuted) {
                micEnabledBeforeMuteRef.current = isMicEnabledRef.current;
                setIsMicEnabled(false);
                voiceInputRef.current?.stopMic();
                voiceOutputRef.current?.stopPlayback();
            } else {
                setIsMicEnabled(micEnabledBeforeMuteRef.current);
                if (session.isConnected && micEnabledBeforeMuteRef.current) {
                    setTimeout(() => void voiceInputRef.current?.startMic(), 200);
                }
            }
            return newMuted;
        });
    }, [session.isConnected]);

    // Toggle mic
    const toggleMic = useCallback(() => {
        if (voiceInput.isListening) {
            setIsMicEnabled(false);
            voiceInput.stopMic();
        } else if (session.isConnected && !isMuted) {
            session.playbackContext?.resume().catch((e) => {
                console.warn('Playback context resume failed:', e);
            });
            setIsMicEnabled(true);
            void voiceInput.startMic();
        }
    }, [voiceInput, session.isConnected, isMuted]);

    // Toggle speaker
    const toggleSpeaker = useCallback(() => {
        setIsSpeakerPaused(prev => {
            const newPaused = !prev;
            if (newPaused) {
                voiceOutputRef.current?.stopPlayback();
                setIsAISpeaking(false);
                resumeMicIfAllowed();
            }
            return newPaused;
        });
    }, [resumeMicIfAllowed]);

    // Send text
    const sendTextMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        pushMsg(text, 'user');
        if (config.replyAsAudio && config.autoPauseMicOnSendText !== false) {
            pauseMicForModelReply();
        }
        setIsLoading(true);
        session.sendText(text);
    }, [session, pushMsg, config.replyAsAudio, config.autoPauseMicOnSendText, pauseMicForModelReply]);

    return {
        // Connection
        isConnected: session.isConnected,
        isReconnecting: session.isReconnecting,

        // Voice
        isListening: voiceInput.isListening,
        isAISpeaking,
        micLevel: voiceInput.micLevel,

        // Controls
        isMuted,
        isMicEnabled,
        isSpeakerPaused,

        // Messages
        messages,
        isLoading,

        // Actions
        connect: session.connect,
        disconnect: session.disconnect,
        sendText: sendTextMessage,
        toggleMute,
        toggleMic,
        toggleSpeaker,
    };
}
