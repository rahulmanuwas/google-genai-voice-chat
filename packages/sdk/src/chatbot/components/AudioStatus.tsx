import React, { memo } from 'react';

interface AudioStatusProps {
    isListening: boolean;
    isMuted: boolean;
    micLevel: number;
    isAISpeaking: boolean;
    isSpeakerPaused: boolean;
    primaryColor: string;
}

const PILL_STYLE: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    transition: 'all 150ms ease',
};

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

    const listeningColor = '#ef4444';
    const speakingColor = primaryColor;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
            {/* Listening indicator — red pulsing dot */}
            {isListening && !isMuted && (
                <div style={{
                    ...PILL_STYLE,
                    backgroundColor: `${listeningColor}12`,
                    border: `1px solid ${listeningColor}30`,
                    color: listeningColor,
                }}>
                    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                        <span style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            backgroundColor: listeningColor,
                            opacity: 0.6,
                            animation: 'audio-status-pulse 1.5s ease-in-out infinite',
                        }} />
                        <span style={{
                            position: 'relative',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: listeningColor,
                        }} />
                    </span>
                    <span>Listening</span>
                    {/* Mic level bar */}
                    <div style={{
                        width: 40,
                        height: 4,
                        backgroundColor: `${listeningColor}20`,
                        borderRadius: 2,
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${Math.max(5, Math.min(100, Math.round(micLevel * 100)))}%`,
                            height: '100%',
                            backgroundColor: listeningColor,
                            borderRadius: 2,
                            transition: 'width 75ms',
                        }} />
                    </div>
                </div>
            )}

            {/* AI Speaking — green indicator */}
            {isAISpeaking && !isSpeakerPaused && (
                <div style={{
                    ...PILL_STYLE,
                    backgroundColor: `${speakingColor}12`,
                    border: `1px solid ${speakingColor}30`,
                    color: speakingColor,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span style={{ width: 3, height: 10, backgroundColor: speakingColor, borderRadius: 2, animation: 'audio-status-bar 0.8s ease-in-out infinite' }} />
                        <span style={{ width: 3, height: 14, backgroundColor: speakingColor, borderRadius: 2, animation: 'audio-status-bar 0.8s ease-in-out infinite 0.1s' }} />
                        <span style={{ width: 3, height: 7, backgroundColor: speakingColor, borderRadius: 2, animation: 'audio-status-bar 0.8s ease-in-out infinite 0.2s' }} />
                    </div>
                    <span>Speaking</span>
                </div>
            )}

            <style>{`
                @keyframes audio-status-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(2); opacity: 0; }
                }
                @keyframes audio-status-bar {
                    0%, 100% { transform: scaleY(0.5); }
                    50% { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
});
