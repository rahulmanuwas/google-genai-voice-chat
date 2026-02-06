// src/telemetry/useTelemetry.ts

import { useCallback, useEffect, useRef } from 'react';
import type { VoiceChatEvent, ChatMessage } from '../lib/types';
import type { createConvexHelper, EventPayload } from './convexHelper';

const NOISE_EVENTS = new Set([
    'audio_output_queue_overflow',
    'playback_context_state',
]);

const BUFFER_FLUSH_SIZE = 20;
const BUFFER_FLUSH_INTERVAL_MS = 5000;

interface UseTelemetryOptions {
    convex: ReturnType<typeof createConvexHelper>;
}

export function useTelemetry(options: UseTelemetryOptions) {
    const { convex } = options;

    const sessionIdRef = useRef(
        `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
    const sessionStartRef = useRef(Date.now());

    const eventBufferRef = useRef<EventPayload[]>([]);
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
            void convex.saveConversation(
                sessionIdRef.current,
                messages.map((m) => ({ role: m.role, content: m.content, ts: m.ts })),
                sessionStartRef.current
            );
        },
        [convex]
    );

    const resetSession = useCallback(() => {
        sessionIdRef.current = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStartRef.current = Date.now();
    }, []);

    // Flush remaining events on page unload via sendBeacon for reliable delivery
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handlePageHide = () => {
            if (eventBufferRef.current.length === 0) return;
            const batch = eventBufferRef.current.splice(0);
            convex.beaconEvents(sessionIdRef.current, batch);
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
        };
    }, []);

    return { sessionId: sessionIdRef, onEvent, flushEvents, saveTranscript, resetSession };
}
