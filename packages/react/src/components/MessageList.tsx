import React, { memo } from 'react';
import type { ChatMessage as ChatMessageType } from '../lib/types';
import { ChatMessage } from './ChatMessage';

interface MessageListProps {
    messages: ChatMessageType[];
    isLoading: boolean;
    isConnected: boolean;
    isReconnecting: boolean;
    suggestedQuestions: string[];
    onSuggestionClick: (suggestion: string) => void;
    primaryColor: string;
}

export const MessageList = memo(function MessageList({
    messages,
    isLoading,
    isConnected,
    isReconnecting,
    suggestedQuestions,
    onSuggestionClick,
    primaryColor,
}: MessageListProps) {
    const userMessageCount = messages.filter((m) => m.role === 'user').length;

    return (
        <>
            {/* Suggested Questions */}
            {userMessageCount === 0 && isConnected && suggestedQuestions.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                        Suggested questions
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {suggestedQuestions.map((question) => (
                            <button
                                key={question}
                                onClick={() => onSuggestionClick(question)}
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
        </>
    );
});
