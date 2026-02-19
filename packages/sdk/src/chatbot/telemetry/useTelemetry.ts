// src/telemetry/useTelemetry.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceChatEvent, ChatMessage } from '../lib/types';
import type { createConvexHelper, EventPayload, MessagePayload } from './convexHelper';

const NOISE_EVENTS = new Set([
    'audio_output_queue_overflow',
    'playback_context_state',
]);

const BUFFER_FLUSH_SIZE = 20;
const BUFFER_FLUSH_INTERVAL_MS = 5000;

function generateSessionId(): string {
    return `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface UseTelemetryOptions {
    convex: ReturnType<typeof createConvexHelper>;
}

export function useTelemetry(options: UseTelemetryOptions) {
    const { convex } = options;

    // useState lazy initializer is the React-approved escape hatch for impure init
    const [initialSession] = useState(() => ({
        id: generateSessionId(),
        start: Date.now(),
    }));
    const sessionIdRef = useRef(initialSession.id);
    const sessionStartRef = useRef(initialSession.start);

    const eventBufferRef = useRef<EventPayload[]>([]);
    const latestMessagesRef = useRef<MessagePayload[]>([]);
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushEvents = useCallback(() => {
        if (eventBufferRef.current.length === 0) return;
        const batch = eventBufferRef.current.splice(0);
        void convex.postEvents(sessionIdRef.current, batch);
    }, [convex]);

    const onEvent = useCallback(
        (event: VoiceChatEvent) => {
            if (NOISE_EVENTS.has(event.type)) return;

            eventBufferRef.current.push({
                eventType: event.type,
                ts: event.ts,
                data: event.data ? JSON.stringify(event.data) : undefined,
            });

            if (eventBufferRef.current.length >= BUFFER_FLUSH_SIZE) {
                flushEvents();
            } else if (!flushTimerRef.current) {
                flushTimerRef.current = setTimeout(() => {
                    flushTimerRef.current = null;
                    flushEvents();
                }, BUFFER_FLUSH_INTERVAL_MS);
            }
        },
        [flushEvents]
    );

    const saveTranscript = useCallback(
        (messages: ChatMessage[]) => {
            if (messages.length === 0) return;
            const payload = messages.map((m) => ({ role: m.role, content: m.content, ts: m.ts }));
            latestMessagesRef.current = payload;
            void convex.saveConversation(
                sessionIdRef.current,
                payload,
                sessionStartRef.current,
                { status: 'active' },
            );
        },
        [convex]
    );

    const resetSession = useCallback(() => {
        sessionIdRef.current = generateSessionId();
        sessionStartRef.current = Date.now();
        latestMessagesRef.current = [];
    }, []);

    // Flush remaining events on page unload via sendBeacon for reliable delivery
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handlePageHide = () => {
            if (eventBufferRef.current.length > 0) {
                const batch = eventBufferRef.current.splice(0);
                convex.beaconEvents(sessionIdRef.current, batch);
            }
            if (latestMessagesRef.current.length > 0) {
                convex.beaconConversation(
                    sessionIdRef.current,
                    latestMessagesRef.current,
                    sessionStartRef.current,
                    { status: 'resolved', resolution: 'completed' },
                );
            }
        };

        window.addEventListener('pagehide', handlePageHide);
        return () => {
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [convex]);

    // Cleanup flush timer on unmount
    useEffect(() => {
        return () => {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            if (latestMessagesRef.current.length > 0) {
                void convex.saveConversation(
                    sessionIdRef.current,
                    latestMessagesRef.current,
                    sessionStartRef.current,
                    { status: 'resolved', resolution: 'completed' },
                );
            }
        };
    }, [convex]);

    return { sessionId: sessionIdRef, onEvent, flushEvents, saveTranscript, resetSession };
}
