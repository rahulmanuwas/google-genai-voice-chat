// src/components/ChatMessage.tsx

import React, { useMemo } from 'react';
import type { ChatMessage as ChatMessageType } from '../lib/types';

interface ChatMessageProps {
    message: ChatMessageType;
    primaryColor?: string;
}

export const ChatMessage = React.memo(function ChatMessage({ message, primaryColor = '#2563eb' }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    const containerStyle = useMemo(() => ({
        display: 'flex' as const,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '8px',
    }), [isUser]);

    const bubbleStyle = useMemo(() => ({
        maxWidth: '80%',
        padding: '8px 12px',
        borderRadius: '12px',
        fontSize: '14px',
        lineHeight: '1.4',
        ...(isUser
            ? {
                backgroundColor: primaryColor,
                color: 'white',
                borderBottomRightRadius: '4px',
            }
            : isSystem
                ? {
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    fontStyle: 'italic',
                }
                : {
                    backgroundColor: '#f3f4f6',
                    color: '#1f2937',
                    borderBottomLeftRadius: '4px',
                }),
    }), [isUser, isSystem, primaryColor]);

    return (
        <div style={containerStyle}>
            <div style={bubbleStyle}>
                {message.content}
            </div>
        </div>
    );
});
