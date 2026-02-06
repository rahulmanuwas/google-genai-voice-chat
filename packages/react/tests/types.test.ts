import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import type {
    ChatMessage,
    ChatRole,
    VoiceChatConfig,
    VoiceChatEvent,
    AudioDropPolicy,
    VoiceChatStats,
    ChatTheme,
    ChatHandlerConfig,
} from '../src/lib/types';

describe('type definitions', () => {
    test('ChatRole accepts valid values', () => {
        const roles: ChatRole[] = ['user', 'model', 'system'];
        assert.equal(roles.length, 3);
    });

    test('ChatMessage shape is valid', () => {
        const msg: ChatMessage = {
            id: 'msg-1',
            content: 'Hello',
            role: 'user',
            ts: Date.now(),
        };
        assert.ok(msg.id);
        assert.ok(msg.content);
        assert.ok(msg.role);
        assert.ok(msg.ts > 0);
    });

    test('VoiceChatEvent shape is valid', () => {
        const event: VoiceChatEvent = {
            type: 'connect',
            ts: Date.now(),
            data: { reconnectAttempt: 1 },
        };
        assert.ok(event.type);
        assert.ok(event.ts);

        // data is optional
        const eventNoData: VoiceChatEvent = {
            type: 'disconnect',
            ts: Date.now(),
        };
        assert.equal(eventNoData.data, undefined);
    });

    test('AudioDropPolicy accepts all valid values', () => {
        const policies: AudioDropPolicy[] = ['drop-oldest', 'drop-newest', 'drop-all'];
        assert.equal(policies.length, 3);
    });

    test('ChatTheme has optional fields', () => {
        const empty: ChatTheme = {};
        assert.ok(empty !== null);

        const full: ChatTheme = {
            primaryColor: '#ff0000',
            position: 'bottom-left',
            cardClassName: 'custom-card',
            launcherClassName: 'custom-launcher',
        };
        assert.equal(full.position, 'bottom-left');
    });

    test('VoiceChatConfig requires systemPrompt and modelId', () => {
        const config: VoiceChatConfig = {
            systemPrompt: 'You are a test assistant',
            modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
        };
        assert.ok(config.systemPrompt);
        assert.ok(config.modelId);
        // All other fields are optional
    });

    test('VoiceChatConfig accepts all optional fields', () => {
        const config: VoiceChatConfig = {
            systemPrompt: 'Test',
            modelId: 'test-model',
            welcomeMessage: 'Hi',
            suggestedQuestions: ['Q1', 'Q2'],
            sessionStorageKey: 'key',
            sessionHandleTtlMs: 3600000,
            replyAsAudio: false,
            useClientVAD: true,
            serverVADPrefixPaddingMs: 300,
            serverVADSilenceDurationMs: 1500,
            sessionInitDelayMs: 200,
            connectTimeoutMs: 10000,
            reconnectMaxRetries: 5,
            reconnectBaseDelayMs: 1000,
            reconnectBackoffFactor: 2,
            reconnectMaxDelayMs: 30000,
            reconnectJitterPct: 0.3,
            micResumeDelayMs: 400,
            playbackStartDelayMs: 100,
            playbackSampleRate: 24000,
            maxMessages: 100,
            maxTranscriptChars: 4000,
            maxOutputQueueMs: 10000,
            maxOutputQueueChunks: 150,
            outputDropPolicy: 'drop-oldest',
            maxConsecutiveInputErrors: 5,
            inputErrorCooldownMs: 500,
            inputMinSendIntervalMs: 50,
            inputMaxQueueMs: 5000,
            inputMaxQueueChunks: 100,
            inputDropPolicy: 'drop-newest',
            clearSessionOnMount: true,
            preferAudioWorklet: false,
            audioWorkletBufferSize: 4096,
            restartMicOnDeviceChange: false,
            speechConfig: { voiceName: 'test' },
            thinkingConfig: { thinkingBudget: 5, includeThoughts: true },
            enableAffectiveDialog: true,
            proactivity: { enabled: true },
            autoPauseMicOnSendText: false,
            autoWelcomeAudio: true,
            welcomeAudioPrompt: 'Welcome!',
            autoStartMicOnConnect: false,
            theme: { primaryColor: '#000', position: 'bottom-left' },
            chatTitle: 'Test Chat',
            onEvent: () => {},
            httpOptions: { apiVersion: 'v1alpha' },
        };
        assert.ok(config);
    });

    test('ChatHandlerConfig requires systemPrompt', () => {
        const config: ChatHandlerConfig = {
            systemPrompt: 'You are a test assistant',
        };
        assert.ok(config.systemPrompt);
        assert.equal(config.model, undefined);
    });

    test('ChatHandlerConfig accepts optional fields', () => {
        const config: ChatHandlerConfig = {
            systemPrompt: 'Test',
            model: 'gemini-2.0-flash',
            modelAcknowledgment: 'Understood.',
        };
        assert.equal(config.model, 'gemini-2.0-flash');
    });

    test('VoiceChatStats shape matches expected structure', () => {
        const stats: VoiceChatStats = {
            ts: Date.now(),
            session: {
                isConnected: true,
                isReconnecting: false,
                reconnectAttempts: 0,
                lastConnectAttemptAt: Date.now(),
                lastDisconnectCode: null,
                lastDisconnectReason: null,
            },
            input: {
                isListening: true,
                queueMs: 0,
                queueChunks: 0,
                droppedChunks: 0,
                droppedMs: 0,
                sendErrorStreak: 0,
                blockedUntil: 0,
                lastSendAt: Date.now(),
                usingWorklet: true,
            },
            output: {
                isPlaying: false,
                queueMs: 0,
                queueChunks: 0,
                droppedChunks: 0,
                droppedMs: 0,
                contextState: 'running',
            },
        };
        assert.ok(stats.ts > 0);
        assert.equal(stats.session.isConnected, true);
        assert.equal(stats.input.usingWorklet, true);
        assert.equal(stats.output.contextState, 'running');
    });
});
