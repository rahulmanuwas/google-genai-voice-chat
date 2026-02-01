import React, { memo } from 'react';

interface AudioStatusProps {
    isListening: boolean;
    isMuted: boolean;
    micLevel: number;
    isAISpeaking: boolean;
    isSpeakerPaused: boolean;
    primaryColor: string;
}

export const AudioStatus = memo(function AudioStatus({
    isListening,
    isMuted,
    micLevel,
    isAISpeaking,
    isSpeakerPaused,
    primaryColor,
}: AudioStatusProps) {
    if ((!isListening || isMuted) && (!isAISpeaking || isSpeakerPaused)) {
        return null;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
        </div>
    );
});
