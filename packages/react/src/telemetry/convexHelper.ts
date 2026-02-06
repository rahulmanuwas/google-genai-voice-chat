// src/telemetry/convexHelper.ts

export interface ConvexHelperConfig {
    url: string;
    appSlug: string;
    appSecret: string;
}

export interface EventPayload {
    eventType: string;
    ts: number;
    data?: string;
}

export interface MessagePayload {
    role: string;
    content: string;
    ts: number;
}

export function createConvexHelper(config: ConvexHelperConfig) {
    const { url, appSlug, appSecret } = config;

    async function fetchToken(): Promise<string> {
        const res = await fetch(`${url}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appSlug, appSecret }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`Token fetch failed: ${err.error || res.statusText}`);
        }

        const data = await res.json();
        return data.token;
    }

    async function postEvents(sessionId: string, events: EventPayload[]) {
        try {
            await fetch(`${url}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appSlug, appSecret, sessionId, events }),
            });
        } catch {
            // Fire-and-forget: don't let event logging failures affect the user
        }
    }

    async function saveConversation(
        sessionId: string,
        messages: MessagePayload[],
        startedAt: number
    ) {
        try {
            await fetch(`${url}/api/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appSlug, appSecret, sessionId, startedAt, messages }),
            });
        } catch {
            // Fire-and-forget
        }
    }

    function beaconEvents(sessionId: string, events: EventPayload[]) {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon || events.length === 0) return;
        const blob = new Blob(
            [JSON.stringify({ appSlug, appSecret, sessionId, events })],
            { type: 'application/json' }
        );
        navigator.sendBeacon(`${url}/api/events`, blob);
    }

    function beaconConversation(
        sessionId: string,
        messages: MessagePayload[],
        startedAt: number
    ) {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon || messages.length === 0) return;
        const blob = new Blob(
            [JSON.stringify({ appSlug, appSecret, sessionId, startedAt, messages })],
            { type: 'application/json' }
        );
        navigator.sendBeacon(`${url}/api/conversations`, blob);
    }

    return { fetchToken, postEvents, saveConversation, beaconEvents, beaconConversation };
}
