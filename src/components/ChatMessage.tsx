// src/components/ChatMessage.tsx

import React from 'react';
import type { ChatMessage as ChatMessageType } from '../lib/types';

interface ChatMessageProps {
    message: ChatMessageType;
    primaryColor?: string;
}

export function ChatMessage({ message, primaryColor = '#2563eb' }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginBottom: '8px',
            }}
        >
            <div
                style={{
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
                }}
            >
                {message.content}
            </div>
        </div>
    );
}
