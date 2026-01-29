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

    // Audio control state
    const [isMuted, setIsMuted] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isSpeakerPaused, setIsSpeakerPaused] = useState(false);
    const [isAISpeaking, setIsAISpeaking] = useState(false);

    // Refs for state access in callbacks
    const isMutedRef = useRef(false);
    const isMicEnabledRef = useRef(true);
    const micEnabledBeforeMuteRef = useRef(true);

    // Transcript handling
    const currentTranscriptRef = useRef('');
    const streamingMsgIdRef = useRef<string | null>(null);

    // Input transcription handling (user's speech)
    const currentInputTranscriptRef = useRef('');
    const streamingInputMsgIdRef = useRef<string | null>(null);

    // Refs for cross-hook communication (avoids circular dependencies)
    const voiceOutputRef = useRef<{ stopPlayback: () => void; enqueueAudio: (data: string) => void } | null>(null);
    const voiceInputRef = useRef<{ stopMic: () => void; startMic: () => Promise<void>; isListening: boolean } | null>(null);

    // Keep refs synced
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);

    // Helper to add messages
    const pushMsg = useCallback((content: string, role: ChatRole) => {
        setMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            content,
            role,
            ts: Date.now(),
        }]);
    }, []);

    // Message handler for processing Gemini responses
    const handleMessage = useCallback((msg: LiveServerMessage) => {
        // Handle input transcription (user's speech)
        const inputTranscript = msg.serverContent?.inputTranscription?.text;
        if (inputTranscript && config.replyAsAudio) {
            console.log('Received input transcription:', inputTranscript);

            if (!streamingInputMsgIdRef.current) {
                const id = `input-${Date.now()}-${Math.random()}`;
                streamingInputMsgIdRef.current = id;
                currentInputTranscriptRef.current = inputTranscript;
                setMessages(prev => [...prev, { id, content: inputTranscript, role: 'user', ts: Date.now() }]);
            } else {
                const id = streamingInputMsgIdRef.current;
                currentInputTranscriptRef.current += inputTranscript;
                setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + inputTranscript } : m));
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
                const cleanTranscript = currentTranscriptRef.current.replace(/\s+/g, ' ').trim();
                const id = streamingMsgIdRef.current;
                setMessages(prev => prev.map(m => m.id === id ? { ...m, content: cleanTranscript } : m));
                currentTranscriptRef.current = '';
                streamingMsgIdRef.current = null;
            }
        }

        // Direct text response (non-audio mode) - cast for runtime properties
        const msgAny = msg as LiveServerMessage & { text?: string; data?: string };
        if (msgAny.text && !config.replyAsAudio) {
            pushMsg(msgAny.text, 'model');
        }

        // Parts from modelTurn
        const parts = msg.serverContent?.modelTurn?.parts ?? [];
        for (const p of parts) {
            if (p.text && !config.replyAsAudio) {
                pushMsg(p.text, 'model');
            }

            // Audio data
            if (p.inlineData?.mimeType?.startsWith('audio/') && p.inlineData.data && config.replyAsAudio) {
                setIsAISpeaking(true);
                voiceOutputRef.current?.enqueueAudio(p.inlineData.data);
            }
        }

        // Direct audio data (when not in parts)
        if (msgAny.data && config.replyAsAudio && !parts.some(p => p.inlineData?.data)) {
            setIsAISpeaking(true);
            voiceOutputRef.current?.enqueueAudio(msgAny.data);
        }

        // Output transcription (streaming)
        const transcript = msg.serverContent?.outputTranscription?.text;
        if (transcript && config.replyAsAudio) {
            // Finalize pending user input transcription
            if (streamingInputMsgIdRef.current && currentInputTranscriptRef.current.trim()) {
                const cleanInput = currentInputTranscriptRef.current.replace(/\s+/g, ' ').trim();
                const inputId = streamingInputMsgIdRef.current;
                setMessages(prev => prev.map(m => m.id === inputId ? { ...m, content: cleanInput } : m));
                streamingInputMsgIdRef.current = null;
                currentInputTranscriptRef.current = '';
            }

            if (!streamingMsgIdRef.current) {
                const id = `${Date.now()}-${Math.random()}`;
                streamingMsgIdRef.current = id;
                setMessages(prev => [...prev, { id, content: transcript, role: 'model', ts: Date.now() }]);
            } else {
                const id = streamingMsgIdRef.current;
                setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + transcript } : m));
            }
            currentTranscriptRef.current += transcript;
        }

        // Turn complete
        if (msg.serverContent?.turnComplete && config.replyAsAudio) {
            // Finalize user input transcription
            if (streamingInputMsgIdRef.current && currentInputTranscriptRef.current.trim()) {
                const cleanInput = currentInputTranscriptRef.current.replace(/\s+/g, ' ').trim();
                const inputId = streamingInputMsgIdRef.current;
                setMessages(prev => prev.map(m => m.id === inputId ? { ...m, content: cleanInput } : m));
                streamingInputMsgIdRef.current = null;
                currentInputTranscriptRef.current = '';
            }

            // Finalize model output transcription
            if (streamingMsgIdRef.current && currentTranscriptRef.current.trim()) {
                const cleanTranscript = currentTranscriptRef.current.replace(/\s+/g, ' ').trim();
                const id = streamingMsgIdRef.current;
                setMessages(prev => prev.map(m => m.id === id ? { ...m, content: cleanTranscript } : m));
            }
            currentTranscriptRef.current = '';
            streamingMsgIdRef.current = null;
        }
    }, [config.replyAsAudio, pushMsg]);

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
        },
        onError: (error) => {
            pushMsg(error, 'system');
        },
        onSystemMessage: (message) => {
            pushMsg(message, 'system');
        },
    });

    // Voice output hook
    const voiceOutput = useVoiceOutput({
        playbackContext: session.playbackContext,
        isPaused: isSpeakerPaused,
        onPlaybackStart: () => {
            setIsAISpeaking(true);
            voiceInputRef.current?.stopMic();
        },
        onPlaybackComplete: () => {
            setIsAISpeaking(false);
            if (session.isConnected && !isMutedRef.current && isMicEnabledRef.current) {
                void voiceInputRef.current?.startMic();
            }
        },
    });

    // Voice input hook
    const voiceInput = useVoiceInput({
        session: session.session,
        isEnabled: session.isConnected && !isMuted && isMicEnabled,
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

    // Auto-start mic when connected (simplified from Daejung)
    const startMicRef = useRef(voiceInput.startMic);
    useEffect(() => { startMicRef.current = voiceInput.startMic; }, [voiceInput.startMic]);

    useEffect(() => {
        if (session.isConnected && !voiceInput.isListening && !isMuted && isMicEnabled && !session.isReconnecting) {
            console.log('Auto-starting mic after connection...');
            const timer = setTimeout(() => {
                void startMicRef.current();
            }, config.sessionInitDelayMs);
            return () => clearTimeout(timer);
        }
    }, [session.isConnected, session.isReconnecting, voiceInput.isListening, isMuted, isMicEnabled, config.sessionInitDelayMs]);

    // Stop everything when disconnected
    const isAISpeakingRef = useRef(false);
    useEffect(() => { isAISpeakingRef.current = isAISpeaking; }, [isAISpeaking]);

    useEffect(() => {
        if (!session.isConnected) {
            voiceInputRef.current?.stopMic();
            voiceOutputRef.current?.stopPlayback();
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
            }
            return newPaused;
        });
    }, []);

    // Send text
    const sendTextMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        pushMsg(text, 'user');
        setIsLoading(true);
        session.sendText(text);
        setIsLoading(false);
    }, [session, pushMsg]);

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
