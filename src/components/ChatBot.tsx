// src/components/ChatBot.tsx

import { useCallback, useEffect, useState, useRef } from 'react';
import type { VoiceChatConfig } from '../lib/types';
import { mergeConfig } from '../lib/constants';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { ChatMessage } from './ChatMessage';

interface ChatBotProps {
    config: VoiceChatConfig;
    apiKey: string;
}

export function ChatBot({ config: userConfig, apiKey }: ChatBotProps) {
    const config = mergeConfig(userConfig);
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        isConnected,
        isReconnecting,
        isListening,
        isAISpeaking,
        micLevel,
        isMuted,
        isMicEnabled: _isMicEnabled,
        isSpeakerPaused,
        messages,
        isLoading,
        connect,
        disconnect,
        sendText,
        toggleMute,
        toggleMic,
        toggleSpeaker,
    } = useVoiceChat({ config: userConfig, apiKey });

    // Connect when chat opens
    useEffect(() => {
        if (isOpen && !isConnected) {
            void connect();
        }
    }, [isOpen, isConnected, connect]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Cleanup when chat closes
    const handleClose = useCallback(async () => {
        await disconnect();
        setIsOpen(false);
    }, [disconnect]);

    // Send text message
    const handleSendText = useCallback(() => {
        if (!inputText.trim() || !isConnected) return;
        sendText(inputText.trim());
        setInputText('');
    }, [inputText, isConnected, sendText]);

    // Handle suggestion click
    const handleSuggestionClick = useCallback(
        (suggestion: string) => {
            if (!isConnected) return;
            sendText(suggestion);
        },
        [isConnected, sendText]
    );

    const userMessageCount = messages.filter((m) => m.role === 'user').length;
    const primaryColor = config.theme.primaryColor || '#2563eb';
    const position = config.theme.position || 'bottom-right';

    const positionStyles = position === 'bottom-left'
        ? { bottom: '24px', left: '24px' }
        : { bottom: '24px', right: '24px' };

    const cardPositionStyles = position === 'bottom-left'
        ? { bottom: '96px', left: '24px' }
        : { bottom: '96px', right: '24px' };

    return (
        <>
            {/* Launcher Button */}
            <button
                onClick={() => {
                    if (isOpen) {
                        void handleClose();
                    } else {
                        setIsOpen(true);
                    }
                }}
                style={{
                    position: 'fixed',
                    ...positionStyles,
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: primaryColor,
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
                {isOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}
            </button>

            {/* Chat Card */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        ...cardPositionStyles,
                        width: '380px',
                        maxWidth: 'calc(100vw - 48px)',
                        height: '500px',
                        maxHeight: 'calc(100vh - 120px)',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 999,
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: '16px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#f9fafb',
                        }}
                    >
                        <span style={{ fontWeight: 600, color: '#1f2937' }}>{config.chatTitle}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Mute Button */}
                            <button
                                onClick={toggleMute}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: isMuted ? '#ef4444' : '#6b7280',
                                }}
                            >
                                {isMuted ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <line x1="23" y1="9" x2="17" y2="15" />
                                        <line x1="17" y1="9" x2="23" y2="15" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                )}
                            </button>

                            {/* Status */}
                            {isReconnecting && (
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>Reconnecting...</span>
                            )}
                            {isListening && !isMuted && !isReconnecting && (
                                <span style={{ fontSize: '12px', color: primaryColor }}>● Live</span>
                            )}

                            {/* Connection dot */}
                            <span
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: isReconnecting ? '#f59e0b' : isConnected ? '#22c55e' : '#d1d5db',
                                }}
                            />
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                        {/* Suggested Questions */}
                        {userMessageCount === 0 && isConnected && config.suggestedQuestions.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                                    Suggested questions
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {config.suggestedQuestions.map((question) => (
                                        <button
                                            key={question}
                                            onClick={() => handleSuggestionClick(question)}
                                            disabled={isLoading || isReconnecting}
                                            style={{
                                                textAlign: 'left',
                                                padding: '12px',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                color: '#1f2937',
                                                transition: 'border-color 0.2s',
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = primaryColor)}
                                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        {messages.map((m) => (
                            <ChatMessage key={m.id} message={m} primaryColor={primaryColor} />
                        ))}

                        {/* Loading */}
                        {isLoading && (
                            <div style={{ fontSize: '14px', color: '#6b7280', padding: '8px' }}>
                                Processing...
                            </div>
                        )}

                        {/* Listening indicator */}
                        {isListening && !isMuted && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280', padding: '8px 0' }}>
                                <div
                                    style={{
                                        width: '60px',
                                        height: '6px',
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: '3px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.max(5, Math.min(100, Math.round(micLevel * 100)))}%`,
                                            height: '100%',
                                            backgroundColor: primaryColor,
                                            borderRadius: '3px',
                                            transition: 'width 75ms',
                                        }}
                                    />
                                </div>
                                <span>Listening</span>
                            </div>
                        )}

                        {/* AI Speaking */}
                        {isAISpeaking && !isSpeakerPaused && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: primaryColor, padding: '8px 0' }}>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    <span style={{ width: '3px', height: '12px', backgroundColor: primaryColor, borderRadius: '2px', animation: 'pulse 1s infinite' }} />
                                    <span style={{ width: '3px', height: '16px', backgroundColor: primaryColor, borderRadius: '2px', animation: 'pulse 1s infinite 0.1s' }} />
                                    <span style={{ width: '3px', height: '8px', backgroundColor: primaryColor, borderRadius: '2px', animation: 'pulse 1s infinite 0.2s' }} />
                                </div>
                                <span>Speaking</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Audio Controls */}
                    <div
                        style={{
                            padding: '12px',
                            borderTop: '1px solid #e5e7eb',
                            backgroundColor: '#f9fafb',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '12px',
                        }}
                    >
                        {/* Mic Toggle */}
                        <button
                            onClick={toggleMic}
                            disabled={!isConnected || isMuted || isReconnecting}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: isListening ? primaryColor : '#e5e7eb',
                                color: isListening ? 'white' : '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: (!isConnected || isMuted || isReconnecting) ? 0.5 : 1,
                            }}
                        >
                            {isListening ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            )}
                        </button>

                        {/* Mic Level */}
                        {isListening && (
                            <div style={{ width: '80px', display: 'flex', alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: '100%',
                                        height: '8px',
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.max(5, Math.min(100, Math.round(micLevel * 100)))}%`,
                                            height: '100%',
                                            backgroundColor: primaryColor,
                                            borderRadius: '4px',
                                            transition: 'width 75ms',
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Speaker Toggle */}
                        <button
                            onClick={toggleSpeaker}
                            disabled={!isConnected || isReconnecting}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: isSpeakerPaused ? '#e5e7eb' : primaryColor,
                                color: isSpeakerPaused ? '#6b7280' : 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: (!isConnected || isReconnecting) ? 0.5 : 1,
                            }}
                        >
                            {isSpeakerPaused ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="6" y="4" width="4" height="16" />
                                    <rect x="14" y="4" width="4" height="16" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Text Input */}
                    <div
                        style={{
                            padding: '16px',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            gap: '8px',
                        }}
                    >
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendText();
                                }
                            }}
                            placeholder={isListening && !isMuted ? 'Listening... or type here' : 'Type a message...'}
                            disabled={!isConnected || isReconnecting}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={handleSendText}
                            disabled={!inputText.trim() || !isConnected || isLoading || isReconnecting}
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: primaryColor,
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: (!inputText.trim() || !isConnected || isLoading || isReconnecting) ? 0.5 : 1,
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Global animation styles */}
            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </>
    );
}
