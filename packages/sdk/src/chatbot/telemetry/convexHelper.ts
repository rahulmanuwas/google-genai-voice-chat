// src/telemetry/convexHelper.ts

export interface ConvexHelperConfig {
    url: string;
    appSlug: string;
    /** @deprecated Use getSessionToken for browser clients */
    appSecret?: string;
    /** Async callback returning a short-lived session token (browser-safe) */
    getSessionToken?: () => Promise<string>;
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

export interface ConversationSaveOptions {
    status?: string;
    resolution?: string;
    channel?: string;
}

export function createConvexHelper(config: ConvexHelperConfig) {
    const { url, appSlug, appSecret, getSessionToken } = config;

    // Cache the last resolved token for sendBeacon (sync, can't call async)
    let cachedSessionToken: string | undefined;

    /** Resolve auth credentials for a request body */
    async function resolveAuth(): Promise<Record<string, string>> {
        if (getSessionToken) {
            const token = await getSessionToken();
            cachedSessionToken = token;
            return { sessionToken: token };
        }
        if (!appSecret) {
            throw new Error('createConvexHelper: provide either getSessionToken() (recommended) or appSecret');
        }
        return { appSlug, appSecret };
    }

    /** Resolve auth credentials synchronously (for sendBeacon) using cached token */
    function resolveAuthSync(): Record<string, string> {
        if (cachedSessionToken) {
            return { sessionToken: cachedSessionToken };
        }
        if (!appSecret) {
            // Best-effort: sendBeacon can't await getSessionToken().
            // Callers should ensure the token is fetched at least once before unload.
            throw new Error('createConvexHelper: missing cached sessionToken and no appSecret provided');
        }
        return { appSlug, appSecret };
    }

    async function fetchToken(): Promise<string> {
        const auth = await resolveAuth();
        const res = await fetch(`${url}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(auth),
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
            const auth = await resolveAuth();
            await fetch(`${url}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...auth, sessionId, events }),
            });
        } catch {
            // Fire-and-forget: don't let event logging failures affect the user
        }
    }

    async function saveConversation(
        sessionId: string,
        messages: MessagePayload[],
        startedAt: number,
        options?: ConversationSaveOptions,
    ) {
        try {
            const auth = await resolveAuth();
            await fetch(`${url}/api/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...auth,
                    sessionId,
                    startedAt,
                    messages,
                    ...(options?.status !== undefined && { status: options.status }),
                    ...(options?.resolution !== undefined && { resolution: options.resolution }),
                    ...(options?.channel !== undefined && { channel: options.channel }),
                }),
            });
        } catch {
            // Fire-and-forget
        }
    }

    function beaconEvents(sessionId: string, events: EventPayload[]) {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon || events.length === 0) return;
        const auth = resolveAuthSync();
        const blob = new Blob(
            [JSON.stringify({ ...auth, sessionId, events })],
            { type: 'application/json' }
        );
        navigator.sendBeacon(`${url}/api/events`, blob);
    }

    function beaconConversation(
        sessionId: string,
        messages: MessagePayload[],
        startedAt: number,
        options?: ConversationSaveOptions,
    ) {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon || messages.length === 0) return;
        const auth = resolveAuthSync();
        const blob = new Blob(
            [JSON.stringify({
                ...auth,
                sessionId,
                startedAt,
                messages,
                ...(options?.status !== undefined && { status: options.status }),
                ...(options?.resolution !== undefined && { resolution: options.resolution }),
                ...(options?.channel !== undefined && { channel: options.channel }),
            })],
            { type: 'application/json' }
        );
        navigator.sendBeacon(`${url}/api/conversations`, blob);
    }

    return { fetchToken, postEvents, saveConversation, beaconEvents, beaconConversation };
}
