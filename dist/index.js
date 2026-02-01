'use strict';

var react = require('react');
var genai = require('@google/genai');
var jsxRuntime = require('react/jsx-runtime');

// src/components/ChatBot.tsx

// src/lib/audio-utils.ts
var INPUT_SAMPLE_RATE = 16e3;
var OUTPUT_SAMPLE_RATE = 24e3;
var PLAYBACK_COMPLETE_DELAY_MS = 200;
function float32ToPCM16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return out;
}
function pcm16ToFloat32(pcm16) {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}
function uint8ToBase64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) {
    s += String.fromCharCode(u8[i]);
  }
  return btoa(s);
}
function base64ToPCM16(base64) {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    buf[i] = bin.charCodeAt(i);
  }
  return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
}
function downsample(inputData, inputSampleRate, targetSampleRate) {
  if (inputSampleRate === targetSampleRate) {
    return inputData;
  }
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.floor(inputData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), inputData.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += inputData[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
}
function encodeAudioToBase64(audioData, sourceSampleRate, targetSampleRate = INPUT_SAMPLE_RATE) {
  const processedData = downsample(audioData, sourceSampleRate, targetSampleRate);
  const pcm16 = float32ToPCM16(processedData);
  const u8 = new Uint8Array(pcm16.buffer);
  const base64 = uint8ToBase64(u8);
  return {
    data: base64,
    mimeType: `audio/pcm;rate=${targetSampleRate}`
  };
}
function calculateRMSLevel(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

// src/lib/constants.ts
var DEFAULT_CONFIG = {
  welcomeMessage: "Hello! How can I help you today?",
  suggestedQuestions: [],
  sessionStorageKey: "genai-voice-chat-session",
  sessionHandleTtlMs: 6 * 60 * 60 * 1e3,
  replyAsAudio: true,
  useClientVAD: false,
  serverVADPrefixPaddingMs: 500,
  serverVADSilenceDurationMs: 1e3,
  serverVADStartSensitivity: genai.StartSensitivity.START_SENSITIVITY_LOW,
  serverVADEndSensitivity: genai.EndSensitivity.END_SENSITIVITY_HIGH,
  sessionInitDelayMs: 300,
  connectTimeoutMs: 12e3,
  reconnectMaxRetries: 3,
  reconnectBaseDelayMs: 1500,
  reconnectBackoffFactor: 1.5,
  reconnectMaxDelayMs: 15e3,
  reconnectJitterPct: 0.2,
  micResumeDelayMs: 600,
  playbackStartDelayMs: 120,
  playbackSampleRate: 24e3,
  maxMessages: 200,
  maxTranscriptChars: 6e3,
  maxOutputQueueMs: 15e3,
  maxOutputQueueChunks: 200,
  outputDropPolicy: "drop-oldest",
  maxConsecutiveInputErrors: 3,
  inputErrorCooldownMs: 750,
  inputMinSendIntervalMs: 0,
  inputMaxQueueMs: 0,
  inputMaxQueueChunks: 0,
  inputDropPolicy: "drop-oldest",
  clearSessionOnMount: true,
  preferAudioWorklet: true,
  audioWorkletBufferSize: 2048,
  restartMicOnDeviceChange: true,
  speechConfig: {},
  thinkingConfig: {},
  enableAffectiveDialog: false,
  proactivity: {},
  autoPauseMicOnSendText: true,
  autoWelcomeAudio: false,
  welcomeAudioPrompt: "",
  autoStartMicOnConnect: true,
  chatTitle: "AI Assistant",
  theme: {
    primaryColor: "#2563eb",
    position: "bottom-right"
  }
};
var AUDIO_CONFIG = {
  /** Input sample rate for microphone */
  INPUT_SAMPLE_RATE: 16e3,
  /** Output sample rate for playback */
  OUTPUT_SAMPLE_RATE: 24e3,
  /** Audio MIME type for sending to API */
  INPUT_MIME_TYPE: "audio/pcm;rate=16000",
  /** Audio MIME type for playback */
  OUTPUT_MIME_TYPE: "audio/pcm;rate=24000"
};
var STABLE_PRESET = {
  micResumeDelayMs: 600,
  playbackStartDelayMs: 120
};
function mergeConfig(userConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...userConfig.theme
    }
  };
}
function useLiveSession(options) {
  const { config: userConfig, apiKey, getApiKey, onMessage, onConnected, onDisconnected, onError, onSystemMessage } = options;
  const config = mergeConfig(userConfig);
  const [isConnected, setIsConnected] = react.useState(false);
  const [isReconnecting, setIsReconnecting] = react.useState(false);
  const [sessionHandle, setSessionHandle] = react.useState(null);
  const sessionRef = react.useRef(null);
  const playCtxRef = react.useRef(null);
  const isReconnectingRef = react.useRef(false);
  const sessionHandleRef = react.useRef(null);
  const isConnectedRef = react.useRef(false);
  const connectPromiseRef = react.useRef(null);
  const reconnectTimerRef = react.useRef(null);
  const closeReasonRef = react.useRef("none");
  const offlineRef = react.useRef(false);
  const shouldReconnectRef = react.useRef(false);
  const connectAttemptRef = react.useRef(0);
  const activeAttemptRef = react.useRef(0);
  const reconnectAttemptsRef = react.useRef(0);
  const lastConnectAttemptAtRef = react.useRef(null);
  const lastDisconnectRef = react.useRef(null);
  const apiKeyRef = react.useRef(apiKey);
  const getApiKeyRef = react.useRef(getApiKey);
  const onMessageRef = react.useRef(onMessage);
  const onConnectedRef = react.useRef(onConnected);
  const onDisconnectedRef = react.useRef(onDisconnected);
  const onErrorRef = react.useRef(onError);
  const onSystemMessageRef = react.useRef(onSystemMessage);
  react.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  react.useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);
  react.useEffect(() => {
    onDisconnectedRef.current = onDisconnected;
  }, [onDisconnected]);
  react.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  react.useEffect(() => {
    onSystemMessageRef.current = onSystemMessage;
  }, [onSystemMessage]);
  react.useEffect(() => {
    sessionHandleRef.current = sessionHandle;
  }, [sessionHandle]);
  react.useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  react.useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);
  react.useEffect(() => {
    getApiKeyRef.current = getApiKey;
  }, [getApiKey]);
  const emitEvent = react.useCallback((type, data) => {
    config.onEvent?.({ type, ts: Date.now(), data });
  }, [config.onEvent]);
  const getJitteredDelay = react.useCallback((delayMs) => {
    const jitterPct = Math.max(0, Math.min(1, config.reconnectJitterPct ?? 0));
    if (!jitterPct) return Math.max(0, delayMs);
    const jitter = delayMs * jitterPct * (Math.random() * 2 - 1);
    return Math.max(0, delayMs + jitter);
  }, [config.reconnectJitterPct]);
  const getBackoffDelay = react.useCallback((attempt) => {
    const base = Math.max(0, config.reconnectBaseDelayMs ?? 1500);
    const factor = Math.max(1, config.reconnectBackoffFactor ?? 1.5);
    const maxDelay = Math.max(base, config.reconnectMaxDelayMs ?? 15e3);
    const raw = Math.min(maxDelay, base * Math.pow(factor, Math.max(0, attempt - 1)));
    return getJitteredDelay(raw);
  }, [config.reconnectBaseDelayMs, config.reconnectBackoffFactor, config.reconnectMaxDelayMs, getJitteredDelay]);
  react.useEffect(() => {
    const storageKey = config.sessionStorageKey;
    if (config.clearSessionOnMount !== false) {
      try {
        localStorage.removeItem(storageKey);
        console.log("Cleared stored session handle on mount");
      } catch (e) {
        console.warn("Failed to clear stored session handle:", e);
      }
      return;
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      let handle = null;
      let ts = 0;
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.handle === "string") {
          handle = parsed.handle;
          ts = typeof parsed.ts === "number" ? parsed.ts : Date.now();
        }
      } catch {
        handle = stored;
        ts = Date.now();
      }
      if (!handle) return;
      const ttl = config.sessionHandleTtlMs ?? 0;
      if (ttl > 0 && Date.now() - ts > ttl) {
        localStorage.removeItem(storageKey);
        emitEvent("session_handle_expired", { ttlMs: ttl });
        console.log("Stored session handle expired");
        return;
      }
      setSessionHandle(handle);
      console.log("Loaded stored session handle");
    } catch (e) {
      console.warn("Failed to load stored session handle:", e);
    }
  }, [config.sessionStorageKey, config.clearSessionOnMount, config.sessionHandleTtlMs, emitEvent]);
  const storeSessionHandle = react.useCallback((handle) => {
    setSessionHandle(handle);
    try {
      const payload = JSON.stringify({ handle, ts: Date.now() });
      localStorage.setItem(config.sessionStorageKey, payload);
      console.log("Session handle stored for resumption");
      emitEvent("session_handle_stored");
    } catch (e) {
      console.warn("Failed to store session handle:", e);
    }
  }, [config.sessionStorageKey, emitEvent]);
  const clearSessionHandle = react.useCallback(() => {
    setSessionHandle(null);
    try {
      localStorage.removeItem(config.sessionStorageKey);
      console.log("Session handle cleared");
      emitEvent("session_handle_cleared");
    } catch (e) {
      console.warn("Failed to clear session handle:", e);
    }
  }, [config.sessionStorageKey, emitEvent]);
  const attemptReconnectionRef = react.useRef(() => Promise.resolve(false));
  const clearReconnectTimer = react.useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);
  const scheduleReconnect = react.useCallback((reason, delayMs) => {
    if (isReconnectingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    clearReconnectTimer();
    isReconnectingRef.current = true;
    setIsReconnecting(true);
    const finalDelay = getJitteredDelay(delayMs);
    emitEvent("session_reconnect_scheduled", { reason, delayMs: finalDelay });
    reconnectTimerRef.current = setTimeout(() => {
      void attemptReconnectionRef.current();
    }, Math.max(0, finalDelay));
  }, [clearReconnectTimer, emitEvent, getJitteredDelay]);
  const handleInternalMessage = react.useCallback((msg) => {
    if (msg.sessionResumptionUpdate) {
      if (msg.sessionResumptionUpdate.resumable && msg.sessionResumptionUpdate.newHandle) {
        storeSessionHandle(msg.sessionResumptionUpdate.newHandle);
      }
    }
    if (msg.goAway) {
      console.warn("GoAway received, connection will terminate in:", msg.goAway.timeLeft);
      onSystemMessageRef.current?.(`Connection will terminate in ${msg.goAway.timeLeft}`);
      const delay = Math.max(1e3, parseInt(msg.goAway.timeLeft?.replace(/[^0-9]/g, "") || "5000") - 2e3);
      scheduleReconnect("goaway", delay);
    }
    onMessageRef.current?.(msg);
  }, [storeSessionHandle, scheduleReconnect]);
  const ensurePlaybackContext = react.useCallback(() => {
    if (!playCtxRef.current || playCtxRef.current.state === "closed") {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      playCtxRef.current = new Ctx({ sampleRate: config.playbackSampleRate ?? 24e3 });
      console.log("Created playback context at", playCtxRef.current.sampleRate, "Hz");
      playCtxRef.current.onstatechange = () => {
        emitEvent("playback_context_state", { state: playCtxRef.current?.state });
      };
    }
    if (playCtxRef.current.state === "suspended") {
      playCtxRef.current.resume().catch((e) => {
        console.warn("Playback context resume failed:", e);
      });
    }
  }, [config.playbackSampleRate, emitEvent]);
  const resolveApiKey = react.useCallback(async () => {
    if (apiKeyRef.current) return apiKeyRef.current;
    if (getApiKeyRef.current) {
      try {
        const key = await getApiKeyRef.current();
        return key;
      } catch (e) {
        emitEvent("session_connect_error", { reason: "token_provider_failed" });
        throw e;
      }
    }
    return "";
  }, [emitEvent]);
  const initializeSession = react.useCallback(async (resumptionHandle) => {
    const attemptId = ++connectAttemptRef.current;
    activeAttemptRef.current = attemptId;
    lastConnectAttemptAtRef.current = Date.now();
    emitEvent("session_connect_attempt", { attemptId });
    const isStale = () => attemptId !== activeAttemptRef.current;
    let resolvedKey = "";
    try {
      resolvedKey = await resolveApiKey();
    } catch (e) {
      onErrorRef.current?.("AI Assistant unavailable. Please check configuration.");
      emitEvent("session_connect_error", { reason: "token_provider_failed" });
      return false;
    }
    if (!resolvedKey) {
      onErrorRef.current?.("AI Assistant unavailable. Please check configuration.");
      emitEvent("session_connect_error", { reason: "missing_api_key" });
      return false;
    }
    try {
      const ai = new genai.GoogleGenAI({ apiKey: resolvedKey });
      ensurePlaybackContext();
      console.log("Connecting to Google GenAI Live...", { model: config.modelId, hasResumption: !!resumptionHandle });
      emitEvent("session_connect_start", { hasResumption: !!resumptionHandle });
      const hasKeys = (obj) => !!obj && Object.keys(obj).length > 0;
      const connectTimeoutMs = Math.max(1e3, config.connectTimeoutMs ?? 12e3);
      let timeoutId = null;
      let timedOut = false;
      const connectPromise = ai.live.connect({
        model: config.modelId,
        config: {
          responseModalities: [config.replyAsAudio ? genai.Modality.AUDIO : genai.Modality.TEXT],
          ...config.replyAsAudio ? {
            outputAudioTranscription: {},
            inputAudioTranscription: {}
          } : {},
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
          realtimeInputConfig: config.useClientVAD ? {
            automaticActivityDetection: { disabled: true }
          } : {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: config.serverVADStartSensitivity ?? genai.StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: config.serverVADEndSensitivity ?? genai.EndSensitivity.END_SENSITIVITY_HIGH,
              prefixPaddingMs: config.serverVADPrefixPaddingMs,
              silenceDurationMs: config.serverVADSilenceDurationMs
            },
            activityHandling: genai.ActivityHandling.NO_INTERRUPTION
          },
          systemInstruction: { parts: [{ text: config.systemPrompt }] },
          ...hasKeys(config.speechConfig) ? { speechConfig: config.speechConfig } : {},
          ...hasKeys(config.proactivity) ? { proactivity: config.proactivity } : {},
          ...config.thinkingConfig && (config.thinkingConfig.thinkingBudget !== void 0 || config.thinkingConfig.includeThoughts !== void 0) ? { thinkingConfig: config.thinkingConfig } : {},
          ...config.enableAffectiveDialog ? { enableAffectiveDialog: true } : {}
        },
        callbacks: {
          onopen: () => {
            if (isStale()) {
              emitEvent("session_open_stale", { attemptId });
              return;
            }
            console.log("Google GenAI Live connection opened");
            setIsConnected(true);
            setIsReconnecting(false);
            isReconnectingRef.current = false;
            reconnectAttemptsRef.current = 0;
            clearReconnectTimer();
            shouldReconnectRef.current = true;
            offlineRef.current = false;
            emitEvent("session_connected");
            onConnectedRef.current?.();
          },
          onmessage: (msg) => {
            if (isStale()) return;
            handleInternalMessage(msg);
          },
          onerror: (err) => {
            if (isStale()) return;
            console.error("Google GenAI Live error:", err);
            setIsConnected(false);
            emitEvent("session_error", { error: typeof err === "string" ? err : "Connection error" });
            onErrorRef.current?.(typeof err === "string" ? err : "Connection error");
          },
          onclose: (event) => {
            if (isStale()) return;
            const code = event?.code || 0;
            const reason = event?.reason || "";
            const closeReason = closeReasonRef.current;
            closeReasonRef.current = "none";
            lastDisconnectRef.current = { code, reason };
            console.log("Connection closed - Code:", code, "Reason:", reason);
            emitEvent("session_closed", { code, reason, closeReason });
            setIsConnected(false);
            if (closeReason === "intentional" || closeReason === "offline" || closeReason === "pagehide") {
              onDisconnectedRef.current?.();
              return;
            }
            let errorMsg = null;
            let shouldReconnect = code !== 1e3;
            if (code === 1008 && reason.includes("session not found")) {
              errorMsg = "Session expired. Reconnecting...";
              clearSessionHandle();
            } else if (code === 1008 || reason.includes("API key")) {
              errorMsg = "API key may not have Live API access.";
              shouldReconnect = false;
            } else if (code === 1013 || reason.includes("quota")) {
              errorMsg = "Usage limits reached.";
              shouldReconnect = false;
            } else if (code !== 1e3) {
              errorMsg = "AI Assistant disconnected";
            }
            if (errorMsg) {
              onErrorRef.current?.(errorMsg);
            }
            if (!shouldReconnect) {
              shouldReconnectRef.current = false;
            }
            if (shouldReconnect && !isReconnectingRef.current) {
              scheduleReconnect("close", getBackoffDelay(1));
            }
            onDisconnectedRef.current?.();
          }
        }
      });
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(new Error("Connection timeout"));
        }, connectTimeoutMs);
      });
      let session;
      try {
        session = await Promise.race([connectPromise, timeoutPromise]);
      } catch (err) {
        if (timedOut) {
          emitEvent("session_connect_timeout", { timeoutMs: connectTimeoutMs });
          connectPromise.then((lateSession) => {
            try {
              lateSession.close();
            } catch {
            }
          }).catch(() => {
          });
        }
        throw err;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
      if (isStale()) {
        emitEvent("session_connect_stale", { attemptId });
        try {
          session.close();
        } catch {
        }
        return false;
      }
      sessionRef.current = session;
      console.log("Google GenAI Live session initialized successfully");
      emitEvent("session_initialized");
      return true;
    } catch (err) {
      console.error("Failed to initialize Google GenAI Live:", err);
      setIsConnected(false);
      emitEvent("session_connect_error", { reason: err.message });
      onErrorRef.current?.(`Failed to initialize: ${err.message}`);
      return false;
    }
  }, [config, handleInternalMessage, clearSessionHandle, ensurePlaybackContext, emitEvent, scheduleReconnect, clearReconnectTimer, resolveApiKey, getBackoffDelay]);
  const initializeSessionWithFallback = react.useCallback(async (resumptionHandle) => {
    const hadHandle = !!resumptionHandle;
    const success = await initializeSession(resumptionHandle || void 0);
    if (!success && hadHandle) {
      clearSessionHandle();
      return initializeSession(void 0);
    }
    return success;
  }, [initializeSession, clearSessionHandle]);
  const attemptReconnection = react.useCallback(async (maxRetriesOverride) => {
    if (connectPromiseRef.current) {
      try {
        await connectPromiseRef.current;
      } catch {
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      emitEvent("session_reconnect_skipped", { reason: "offline" });
      return false;
    }
    if (!isReconnectingRef.current) {
      isReconnectingRef.current = true;
      setIsReconnecting(true);
    }
    const maxRetries = Math.max(1, maxRetriesOverride ?? config.reconnectMaxRetries ?? 3);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        reconnectAttemptsRef.current = attempt;
        console.log(`Reconnection attempt ${attempt}/${maxRetries}`);
        onSystemMessageRef.current?.(`Reconnecting... (${attempt}/${maxRetries})`);
        emitEvent("session_reconnect_attempt", { attempt, maxRetries });
        if (sessionRef.current) {
          try {
            if (!config.useClientVAD) {
              sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
            }
            sessionRef.current.close();
          } catch (e) {
            console.warn("Session cleanup during reconnection:", e);
          }
          sessionRef.current = null;
        }
        await initializeSessionWithFallback(sessionHandleRef.current);
        if (sessionRef.current) {
          console.log("Reconnection successful");
          onSystemMessageRef.current?.("Reconnected successfully");
          emitEvent("session_reconnect_success", { attempt });
          return true;
        }
      } catch (error) {
        console.warn(`Reconnection attempt ${attempt} failed:`, error);
        emitEvent("session_reconnect_error", { attempt, error: error.message });
        if (attempt < maxRetries) {
          const delayMs = getBackoffDelay(attempt + 1);
          emitEvent("session_reconnect_delay", { attempt: attempt + 1, delayMs });
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    setIsReconnecting(false);
    isReconnectingRef.current = false;
    onSystemMessageRef.current?.("Reconnection failed. Please refresh the page.");
    emitEvent("session_reconnect_failed", { maxRetries });
    return false;
  }, [initializeSessionWithFallback, config.useClientVAD, config.reconnectMaxRetries, emitEvent, getBackoffDelay]);
  react.useEffect(() => {
    attemptReconnectionRef.current = attemptReconnection;
  }, [attemptReconnection]);
  react.useEffect(() => {
    return () => {
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);
  react.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      offlineRef.current = false;
      emitEvent("network_online");
      if (!isConnectedRef.current && shouldReconnectRef.current && !isReconnectingRef.current) {
        scheduleReconnect("online", 500);
      }
    };
    const handleOffline = () => {
      offlineRef.current = true;
      emitEvent("network_offline");
      clearReconnectTimer();
      if (sessionRef.current) {
        closeReasonRef.current = "offline";
        try {
          sessionRef.current.close();
        } catch (e) {
          console.warn("Session close failed during offline:", e);
        }
        sessionRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
      isReconnectingRef.current = false;
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [emitEvent, scheduleReconnect, clearReconnectTimer]);
  react.useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = (event) => {
      emitEvent("page_hide", { persisted: event.persisted });
      clearReconnectTimer();
      shouldReconnectRef.current = true;
      if (sessionRef.current) {
        closeReasonRef.current = "pagehide";
        try {
          sessionRef.current.close();
        } catch (e) {
          console.warn("Session close failed during pagehide:", e);
        }
        sessionRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
      isReconnectingRef.current = false;
    };
    const handlePageShow = (event) => {
      emitEvent("page_show", { persisted: event.persisted });
      if (!isConnectedRef.current && shouldReconnectRef.current && !isReconnectingRef.current) {
        scheduleReconnect("pageshow", getBackoffDelay(1));
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [emitEvent, scheduleReconnect, clearReconnectTimer, getBackoffDelay]);
  const connect = react.useCallback(async () => {
    if (connectPromiseRef.current) {
      await connectPromiseRef.current;
      return;
    }
    if (isConnectedRef.current) return;
    const connectTask = (async () => {
      ensurePlaybackContext();
      await initializeSessionWithFallback(sessionHandleRef.current);
    })();
    connectPromiseRef.current = connectTask;
    try {
      await connectTask;
    } finally {
      connectPromiseRef.current = null;
    }
  }, [ensurePlaybackContext, initializeSessionWithFallback]);
  const disconnect = react.useCallback(async () => {
    console.log("Disconnecting session...");
    closeReasonRef.current = "intentional";
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    activeAttemptRef.current += 1;
    reconnectAttemptsRef.current = 0;
    if (connectPromiseRef.current) {
      try {
        await connectPromiseRef.current;
      } catch {
      }
    }
    if (sessionRef.current) {
      try {
        if (!config.useClientVAD) {
          sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
        }
        sessionRef.current.close();
      } catch (e) {
        console.warn("Session close failed:", e);
      }
      sessionRef.current = null;
    }
    if (playCtxRef.current && playCtxRef.current.state !== "closed") {
      try {
        await playCtxRef.current.close();
      } catch (e) {
        console.warn("Playback context close failed:", e);
      }
      playCtxRef.current = null;
    }
    setIsConnected(false);
    setIsReconnecting(false);
    isReconnectingRef.current = false;
  }, [config.useClientVAD, clearReconnectTimer]);
  const sendText = react.useCallback((text) => {
    if (!sessionRef.current || !text.trim()) return;
    try {
      console.log("Sending text message:", text);
      sessionRef.current.sendClientContent({ turns: text, turnComplete: true });
    } catch (e) {
      console.error("Send text failed:", e);
      onErrorRef.current?.(`Send failed: ${e.message}`);
    }
  }, []);
  return {
    session: sessionRef.current,
    isConnected,
    isReconnecting,
    sessionHandle,
    connect,
    disconnect,
    sendText,
    playbackContext: playCtxRef.current,
    getStats: () => ({
      reconnectAttempts: reconnectAttemptsRef.current,
      lastConnectAttemptAt: lastConnectAttemptAtRef.current,
      lastDisconnectCode: lastDisconnectRef.current?.code ?? null,
      lastDisconnectReason: lastDisconnectRef.current?.reason ?? null
    })
  };
}
var MIC_BUFFER_SIZE = 2048;
var MIC_CHANNELS = 1;
function useVoiceInput(options) {
  const {
    session,
    isEnabled,
    maxConsecutiveErrors,
    errorCooldownMs,
    inputMinSendIntervalMs,
    inputMaxQueueMs,
    inputMaxQueueChunks,
    inputDropPolicy,
    preferAudioWorklet,
    audioWorkletBufferSize,
    restartMicOnDeviceChange,
    onEvent,
    onVoiceStart,
    onVoiceEnd,
    onError
  } = options;
  const [isListening, setIsListening] = react.useState(false);
  const [micLevel, setMicLevel] = react.useState(0);
  const micCtxRef = react.useRef(null);
  const micSourceRef = react.useRef(null);
  const micProcRef = react.useRef(null);
  const micWorkletRef = react.useRef(null);
  const micWorkletUrlRef = react.useRef(null);
  const micStreamRef = react.useRef(null);
  const micSilenceGainRef = react.useRef(null);
  const lastMicLevelUpdateRef = react.useRef(0);
  const sendErrorStreakRef = react.useRef(0);
  const sendBlockedUntilRef = react.useRef(0);
  const lastSendAtRef = react.useRef(0);
  const maxConsecutiveErrorsRef = react.useRef(maxConsecutiveErrors ?? 3);
  const errorCooldownMsRef = react.useRef(errorCooldownMs ?? 750);
  const inputMinSendIntervalMsRef = react.useRef(inputMinSendIntervalMs ?? 0);
  const inputMaxQueueMsRef = react.useRef(inputMaxQueueMs ?? 0);
  const inputMaxQueueChunksRef = react.useRef(inputMaxQueueChunks ?? 0);
  const inputDropPolicyRef = react.useRef(inputDropPolicy ?? "drop-oldest");
  const preferAudioWorkletRef = react.useRef(preferAudioWorklet ?? true);
  const audioWorkletBufferSizeRef = react.useRef(audioWorkletBufferSize ?? MIC_BUFFER_SIZE);
  const restartMicOnDeviceChangeRef = react.useRef(restartMicOnDeviceChange ?? true);
  const onEventRef = react.useRef(onEvent);
  const isListeningRef = react.useRef(false);
  const isEnabledRef = react.useRef(isEnabled);
  const sessionRef = react.useRef(session);
  const usingWorkletRef = react.useRef(false);
  const sendQueueRef = react.useRef([]);
  const queuedMsRef = react.useRef(0);
  const queuedChunksRef = react.useRef(0);
  const droppedChunksRef = react.useRef(0);
  const droppedMsRef = react.useRef(0);
  const flushTimerRef = react.useRef(null);
  const stopMicRef = react.useRef(() => {
  });
  const startMicRef = react.useRef(() => Promise.resolve());
  const onVoiceStartRef = react.useRef(onVoiceStart);
  const onVoiceEndRef = react.useRef(onVoiceEnd);
  const onErrorRef = react.useRef(onError);
  react.useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  react.useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);
  react.useEffect(() => {
    onVoiceStartRef.current = onVoiceStart;
  }, [onVoiceStart]);
  react.useEffect(() => {
    onVoiceEndRef.current = onVoiceEnd;
  }, [onVoiceEnd]);
  react.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  react.useEffect(() => {
    maxConsecutiveErrorsRef.current = maxConsecutiveErrors ?? 3;
  }, [maxConsecutiveErrors]);
  react.useEffect(() => {
    errorCooldownMsRef.current = errorCooldownMs ?? 750;
  }, [errorCooldownMs]);
  react.useEffect(() => {
    inputMinSendIntervalMsRef.current = inputMinSendIntervalMs ?? 0;
  }, [inputMinSendIntervalMs]);
  react.useEffect(() => {
    inputMaxQueueMsRef.current = inputMaxQueueMs ?? 0;
  }, [inputMaxQueueMs]);
  react.useEffect(() => {
    inputMaxQueueChunksRef.current = inputMaxQueueChunks ?? 0;
  }, [inputMaxQueueChunks]);
  react.useEffect(() => {
    inputDropPolicyRef.current = inputDropPolicy ?? "drop-oldest";
  }, [inputDropPolicy]);
  react.useEffect(() => {
    preferAudioWorkletRef.current = preferAudioWorklet ?? true;
  }, [preferAudioWorklet]);
  react.useEffect(() => {
    audioWorkletBufferSizeRef.current = audioWorkletBufferSize ?? MIC_BUFFER_SIZE;
  }, [audioWorkletBufferSize]);
  react.useEffect(() => {
    restartMicOnDeviceChangeRef.current = restartMicOnDeviceChange ?? true;
  }, [restartMicOnDeviceChange]);
  react.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const emitEvent = react.useCallback((type, data) => {
    onEventRef.current?.({ type, ts: Date.now(), data });
  }, []);
  const flushQueueRef = react.useRef(() => {
  });
  const clearFlushTimer = react.useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);
  const scheduleFlush = react.useCallback((delayMs) => {
    clearFlushTimer();
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushQueueRef.current();
    }, Math.max(0, delayMs));
  }, [clearFlushTimer]);
  const cleanup = react.useCallback(() => {
    try {
      micProcRef.current?.disconnect();
    } catch (e) {
    }
    try {
      if (micWorkletRef.current) {
        micWorkletRef.current.port.onmessage = null;
        micWorkletRef.current.disconnect();
      }
    } catch (e) {
    }
    try {
      micSourceRef.current?.disconnect();
    } catch (e) {
    }
    try {
      micSilenceGainRef.current?.disconnect();
    } catch (e) {
    }
    try {
      micCtxRef.current?.close();
    } catch (e) {
    }
    micProcRef.current = null;
    micWorkletRef.current = null;
    micSourceRef.current = null;
    micSilenceGainRef.current = null;
    micCtxRef.current = null;
    if (micWorkletUrlRef.current) {
      try {
        URL.revokeObjectURL(micWorkletUrlRef.current);
      } catch (e) {
      }
      micWorkletUrlRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    setMicLevel(0);
    sendErrorStreakRef.current = 0;
    sendBlockedUntilRef.current = 0;
    lastSendAtRef.current = 0;
    sendQueueRef.current = [];
    queuedMsRef.current = 0;
    queuedChunksRef.current = 0;
    droppedChunksRef.current = 0;
    droppedMsRef.current = 0;
    usingWorkletRef.current = false;
    clearFlushTimer();
  }, [clearFlushTimer]);
  react.useEffect(() => {
    const flushQueue = () => {
      if (!sessionRef.current) return;
      if (sendQueueRef.current.length === 0) return;
      const now = performance.now();
      if (now < sendBlockedUntilRef.current) {
        scheduleFlush(sendBlockedUntilRef.current - now);
        return;
      }
      const minInterval = inputMinSendIntervalMsRef.current;
      if (minInterval > 0 && now - lastSendAtRef.current < minInterval) {
        scheduleFlush(minInterval - (now - lastSendAtRef.current));
        return;
      }
      while (sendQueueRef.current.length > 0) {
        const item = sendQueueRef.current.shift();
        if (!item) break;
        queuedMsRef.current = Math.max(0, queuedMsRef.current - item.durationMs);
        queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
        try {
          sessionRef.current?.sendRealtimeInput({ audio: { data: item.data, mimeType: item.mimeType } });
          sendErrorStreakRef.current = 0;
          lastSendAtRef.current = performance.now();
        } catch (err) {
          console.error("sendRealtimeInput error:", err);
          sendErrorStreakRef.current += 1;
          sendBlockedUntilRef.current = performance.now() + errorCooldownMsRef.current;
          emitEvent("audio_input_send_error", {
            streak: sendErrorStreakRef.current,
            error: err.message
          });
          if (sendErrorStreakRef.current >= maxConsecutiveErrorsRef.current) {
            emitEvent("audio_input_stream_halted", { reason: "too_many_errors" });
            onErrorRef.current?.("Audio streaming unstable. Please reconnect.");
            setTimeout(() => stopMicRef.current(), 0);
          }
          scheduleFlush(errorCooldownMsRef.current);
          return;
        }
        if (minInterval > 0 && sendQueueRef.current.length > 0) {
          scheduleFlush(minInterval);
          return;
        }
      }
    };
    flushQueueRef.current = flushQueue;
  }, [emitEvent, scheduleFlush]);
  const enqueueInputChunk = react.useCallback((data, mimeType, durationMs) => {
    const maxMs = inputMaxQueueMsRef.current;
    const maxChunks = inputMaxQueueChunksRef.current;
    const policy = inputDropPolicyRef.current;
    const wouldOverflow = (extraMs, extraChunks) => maxMs > 0 && queuedMsRef.current + extraMs > maxMs || maxChunks > 0 && queuedChunksRef.current + extraChunks > maxChunks;
    let droppedChunks = 0;
    let droppedMs = 0;
    if (policy === "drop-newest" && wouldOverflow(durationMs, 1)) {
      droppedChunks = 1;
      droppedMs = durationMs;
    } else {
      if (policy === "drop-all" && wouldOverflow(durationMs, 1)) {
        droppedChunks = sendQueueRef.current.length;
        droppedMs = queuedMsRef.current;
        sendQueueRef.current = [];
        queuedMsRef.current = 0;
        queuedChunksRef.current = 0;
      }
      sendQueueRef.current.push({ data, mimeType, durationMs });
      queuedMsRef.current += durationMs;
      queuedChunksRef.current += 1;
      if (policy === "drop-oldest") {
        while (maxMs > 0 && queuedMsRef.current > maxMs || maxChunks > 0 && queuedChunksRef.current > maxChunks) {
          const dropped = sendQueueRef.current.shift();
          if (!dropped) break;
          queuedMsRef.current = Math.max(0, queuedMsRef.current - dropped.durationMs);
          queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
          droppedChunks += 1;
          droppedMs += dropped.durationMs;
        }
      }
    }
    if (droppedChunks > 0) {
      droppedChunksRef.current += droppedChunks;
      droppedMsRef.current += droppedMs;
      emitEvent("audio_input_queue_overflow", {
        droppedChunks,
        droppedMs,
        queueMs: queuedMsRef.current,
        queueChunks: queuedChunksRef.current,
        policy
      });
      if (policy === "drop-newest") {
        emitEvent("audio_input_dropped", { reason: "queue_overflow", policy });
        return;
      }
    }
    flushQueueRef.current();
  }, [emitEvent]);
  const processInputChunk = react.useCallback((inputData) => {
    if (!micCtxRef.current || !isListeningRef.current || !sessionRef.current) return;
    const now = performance.now();
    if (now - lastMicLevelUpdateRef.current > 50) {
      lastMicLevelUpdateRef.current = now;
      const rms = calculateRMSLevel(inputData);
      const visualLevel = Math.min(1, rms * 10);
      setMicLevel((prev) => prev * 0.8 + visualLevel * 0.2);
    }
    const sourceSampleRate = micCtxRef.current.sampleRate || 48e3;
    const { data, mimeType } = encodeAudioToBase64(inputData, sourceSampleRate, INPUT_SAMPLE_RATE);
    const ratio = sourceSampleRate / INPUT_SAMPLE_RATE;
    const processedLength = Math.floor(inputData.length / (ratio || 1));
    const durationMs = processedLength / INPUT_SAMPLE_RATE * 1e3;
    enqueueInputChunk(data, mimeType, durationMs);
  }, [enqueueInputChunk]);
  const stopMic = react.useCallback(() => {
    if (!isListeningRef.current) return;
    console.log("Stopping microphone...");
    try {
      sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    } catch (e) {
      console.warn("Audio stream end failed:", e);
    }
    cleanup();
    emitEvent("mic_stopped");
    onVoiceEndRef.current?.();
  }, [cleanup, emitEvent]);
  const startMic = react.useCallback(async () => {
    if (!sessionRef.current || isListeningRef.current) {
      console.log("Cannot start mic: session missing or already listening");
      return;
    }
    try {
      console.log("Starting microphone...");
      if (!navigator?.mediaDevices?.getUserMedia) {
        const message = "Microphone access is not supported in this browser.";
        emitEvent("mic_error", { error: message });
        onErrorRef.current?.(message);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: MIC_CHANNELS,
          sampleRate: 48e3
          // Request high rate, will downsample
        }
      });
      micStreamRef.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      micCtxRef.current = new Ctx();
      if (micCtxRef.current.state === "suspended") {
        await micCtxRef.current.resume();
      }
      micSourceRef.current = micCtxRef.current.createMediaStreamSource(stream);
      micSilenceGainRef.current = micCtxRef.current.createGain();
      micSilenceGainRef.current.gain.value = 0;
      const bufferSize = Math.max(256, Math.min(16384, audioWorkletBufferSizeRef.current || MIC_BUFFER_SIZE));
      const canUseWorklet = preferAudioWorkletRef.current && !!micCtxRef.current.audioWorklet && typeof AudioWorkletNode !== "undefined";
      let usingWorklet = false;
      if (canUseWorklet) {
        try {
          const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = ${bufferSize};
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;
    let i = 0;
    while (i < channel.length) {
      const space = this.bufferSize - this.offset;
      const toCopy = Math.min(space, channel.length - i);
      this.buffer.set(channel.subarray(i, i + toCopy), this.offset);
      this.offset += toCopy;
      i += toCopy;
      if (this.offset >= this.bufferSize) {
        const out = new Float32Array(this.bufferSize);
        out.set(this.buffer);
        this.port.postMessage(out, [out.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;
          const blob = new Blob([workletCode], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          micWorkletUrlRef.current = url;
          await micCtxRef.current.audioWorklet.addModule(url);
          const workletNode = new AudioWorkletNode(micCtxRef.current, "pcm-processor", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: MIC_CHANNELS
          });
          workletNode.port.onmessage = (event) => {
            const inputData = event.data;
            if (!inputData || !isListeningRef.current) return;
            processInputChunk(inputData);
          };
          micWorkletRef.current = workletNode;
          micProcRef.current = workletNode;
          micSourceRef.current.connect(workletNode);
          workletNode.connect(micSilenceGainRef.current);
          usingWorklet = true;
        } catch (err) {
          if (micWorkletUrlRef.current) {
            try {
              URL.revokeObjectURL(micWorkletUrlRef.current);
            } catch (e) {
              void e;
            }
            micWorkletUrlRef.current = null;
          }
          emitEvent("mic_worklet_error", { error: err.message });
        }
      }
      if (!usingWorklet) {
        const audioProcessor = micCtxRef.current.createScriptProcessor(bufferSize, MIC_CHANNELS, MIC_CHANNELS);
        audioProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          processInputChunk(inputData);
        };
        micProcRef.current = audioProcessor;
        micSourceRef.current.connect(audioProcessor);
        audioProcessor.connect(micSilenceGainRef.current);
      }
      micSilenceGainRef.current.connect(micCtxRef.current.destination);
      usingWorkletRef.current = usingWorklet;
      isListeningRef.current = true;
      setIsListening(true);
      sendErrorStreakRef.current = 0;
      sendBlockedUntilRef.current = 0;
      lastSendAtRef.current = 0;
      emitEvent("mic_started", { usingWorklet });
      console.log(`Microphone started at ${micCtxRef.current.sampleRate}Hz`);
      onVoiceStartRef.current?.();
    } catch (err) {
      console.error("Mic start failed:", err);
      cleanup();
      const error = err;
      let message = `Microphone error: ${error.message}`;
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        message = "Microphone permission denied. Please allow access and try again.";
        emitEvent("mic_permission_blocked");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        message = "No microphone device found.";
      } else if (error.name === "NotReadableError") {
        message = "Microphone is in use by another application.";
      } else if (error.name === "OverconstrainedError") {
        message = "Requested microphone settings are not supported.";
      }
      emitEvent("mic_error", { error: message, code: error.name });
      onErrorRef.current?.(message);
    }
  }, [cleanup, emitEvent, processInputChunk]);
  react.useEffect(() => {
    stopMicRef.current = stopMic;
  }, [stopMic]);
  react.useEffect(() => {
    startMicRef.current = startMic;
  }, [startMic]);
  react.useEffect(() => {
    if (!isEnabled && isListeningRef.current) {
      stopMicRef.current();
    }
  }, [isEnabled]);
  react.useEffect(() => {
    if (typeof navigator === "undefined") return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const handleDeviceChange = () => {
      if (!restartMicOnDeviceChangeRef.current) return;
      if (!isEnabledRef.current) return;
      if (!isListeningRef.current) return;
      emitEvent("mic_device_change");
      stopMicRef.current();
      setTimeout(() => {
        if (isEnabledRef.current) {
          void startMicRef.current();
        }
      }, 250);
    };
    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [emitEvent]);
  react.useEffect(() => {
    return () => {
      if (isListeningRef.current) {
        cleanup();
      } else {
        clearFlushTimer();
      }
    };
  }, [cleanup, clearFlushTimer]);
  return {
    isListening,
    micLevel,
    startMic,
    stopMic,
    getStats: () => ({
      queueMs: queuedMsRef.current,
      queueChunks: queuedChunksRef.current,
      droppedChunks: droppedChunksRef.current,
      droppedMs: droppedMsRef.current,
      sendErrorStreak: sendErrorStreakRef.current,
      blockedUntil: sendBlockedUntilRef.current,
      lastSendAt: lastSendAtRef.current,
      usingWorklet: usingWorkletRef.current
    })
  };
}
function useVoiceOutput(options) {
  const { playbackContext, isPaused, startBufferMs, maxQueueMs, maxQueueChunks, dropPolicy, onEvent, onPlaybackStart, onPlaybackComplete } = options;
  const [isPlaying, setIsPlaying] = react.useState(false);
  const playQueueRef = react.useRef([]);
  const isDrainingRef = react.useRef(false);
  const currentSourceRef = react.useRef(null);
  const scheduledEndTimeRef = react.useRef(0);
  const completeTimerRef = react.useRef(null);
  const queuedMsRef = react.useRef(0);
  const queuedChunksRef = react.useRef(0);
  const droppedChunksRef = react.useRef(0);
  const droppedMsRef = react.useRef(0);
  const onPlaybackStartRef = react.useRef(onPlaybackStart);
  const onPlaybackCompleteRef = react.useRef(onPlaybackComplete);
  const playCtxRef = react.useRef(playbackContext);
  const isPausedRef = react.useRef(isPaused);
  const isPlayingRef = react.useRef(isPlaying);
  const startBufferMsRef = react.useRef(startBufferMs ?? 0);
  const maxQueueMsRef = react.useRef(maxQueueMs ?? 0);
  const maxQueueChunksRef = react.useRef(maxQueueChunks ?? 0);
  const dropPolicyRef = react.useRef(dropPolicy ?? "drop-oldest");
  const onEventRef = react.useRef(onEvent);
  react.useEffect(() => {
    onPlaybackStartRef.current = onPlaybackStart;
  }, [onPlaybackStart]);
  react.useEffect(() => {
    onPlaybackCompleteRef.current = onPlaybackComplete;
  }, [onPlaybackComplete]);
  react.useEffect(() => {
    playCtxRef.current = playbackContext;
  }, [playbackContext]);
  react.useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  react.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  react.useEffect(() => {
    startBufferMsRef.current = startBufferMs ?? 0;
  }, [startBufferMs]);
  react.useEffect(() => {
    maxQueueMsRef.current = maxQueueMs ?? 0;
  }, [maxQueueMs]);
  react.useEffect(() => {
    maxQueueChunksRef.current = maxQueueChunks ?? 0;
  }, [maxQueueChunks]);
  react.useEffect(() => {
    dropPolicyRef.current = dropPolicy ?? "drop-oldest";
  }, [dropPolicy]);
  react.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const emitEvent = react.useCallback((type, data) => {
    onEventRef.current?.({ type, ts: Date.now(), data });
  }, []);
  const scheduleChunksRef = react.useRef(() => {
  });
  const clearCompleteTimer = react.useCallback(() => {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  }, []);
  react.useEffect(() => {
    const scheduleChunks = () => {
      const ctx = playCtxRef.current;
      if (!ctx) {
        isDrainingRef.current = false;
        return;
      }
      if (playQueueRef.current.length === 0) {
        isDrainingRef.current = false;
        currentSourceRef.current = null;
        scheduledEndTimeRef.current = 0;
        clearCompleteTimer();
        completeTimerRef.current = setTimeout(() => {
          if (playQueueRef.current.length === 0) {
            setIsPlaying(false);
            onPlaybackCompleteRef.current?.();
          }
        }, PLAYBACK_COMPLETE_DELAY_MS);
        return;
      }
      const first = playQueueRef.current.shift();
      if (!first) {
        isDrainingRef.current = false;
        return;
      }
      const targetRate = first.sampleRate;
      const chunks = [first.pcm];
      queuedMsRef.current = Math.max(0, queuedMsRef.current - first.durationMs);
      queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
      while (playQueueRef.current.length > 0 && playQueueRef.current[0].sampleRate === targetRate) {
        const next = playQueueRef.current.shift();
        if (!next) break;
        chunks.push(next.pcm);
        queuedMsRef.current = Math.max(0, queuedMsRef.current - next.durationMs);
        queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
      }
      let totalLength = 0;
      for (const chunk of chunks) {
        totalLength += chunk.length;
      }
      const combined = new Int16Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const float32 = pcm16ToFloat32(combined);
      const audioBuffer = ctx.createBuffer(1, float32.length, targetRate);
      audioBuffer.getChannelData(0).set(float32);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentSourceRef.current = source;
      const now = ctx.currentTime;
      const bufferSeconds = startBufferMsRef.current / 1e3;
      const baseStart = scheduledEndTimeRef.current === 0 ? now + bufferSeconds : scheduledEndTimeRef.current;
      const startTime = Math.max(now, baseStart);
      scheduledEndTimeRef.current = startTime + audioBuffer.duration;
      source.onended = () => {
        currentSourceRef.current = null;
        if (playQueueRef.current.length > 0) {
          scheduleChunksRef.current();
        } else {
          clearCompleteTimer();
          completeTimerRef.current = setTimeout(() => {
            if (playQueueRef.current.length > 0) {
              scheduleChunksRef.current();
            } else {
              isDrainingRef.current = false;
              scheduledEndTimeRef.current = 0;
              setIsPlaying(false);
              onPlaybackCompleteRef.current?.();
            }
          }, PLAYBACK_COMPLETE_DELAY_MS);
        }
      };
      source.start(startTime);
    };
    scheduleChunksRef.current = scheduleChunks;
  }, [clearCompleteTimer]);
  const drainQueue = react.useCallback(() => {
    const ctx = playCtxRef.current;
    if (!ctx || isDrainingRef.current) return;
    isDrainingRef.current = true;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => scheduleChunksRef.current()).catch(console.warn);
    } else {
      scheduleChunksRef.current();
    }
  }, []);
  const stopPlayback = react.useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop(0);
      } catch (e) {
        console.warn("Stop playback error:", e);
      }
      currentSourceRef.current = null;
    }
    playQueueRef.current = [];
    isDrainingRef.current = false;
    scheduledEndTimeRef.current = 0;
    clearCompleteTimer();
    queuedMsRef.current = 0;
    queuedChunksRef.current = 0;
    setIsPlaying(false);
    if (playCtxRef.current && playCtxRef.current.state === "running") {
      playCtxRef.current.suspend().catch(console.warn);
    }
  }, [clearCompleteTimer]);
  const clearQueue = react.useCallback(() => {
    playQueueRef.current = [];
    queuedMsRef.current = 0;
    queuedChunksRef.current = 0;
    clearCompleteTimer();
  }, [clearCompleteTimer]);
  const enqueueAudio = react.useCallback((base64Data, sampleRate) => {
    if (isPausedRef.current) {
      emitEvent("audio_output_dropped", { reason: "speaker_paused" });
      return;
    }
    try {
      const ctx = playCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        emitEvent("audio_output_dropped", { reason: "playback_context_missing" });
        return;
      }
      const pcm16 = base64ToPCM16(base64Data);
      if (pcm16.length > 0) {
        const targetRate = Number.isFinite(sampleRate) && (sampleRate ?? 0) > 0 ? sampleRate : OUTPUT_SAMPLE_RATE;
        const chunk = new Int16Array(pcm16.length);
        chunk.set(pcm16);
        const durationMs = chunk.length / targetRate * 1e3;
        const maxMs = maxQueueMsRef.current;
        const maxChunks = maxQueueChunksRef.current;
        const policy = dropPolicyRef.current;
        const wouldOverflow = (extraMs, extraChunks) => maxMs > 0 && queuedMsRef.current + extraMs > maxMs || maxChunks > 0 && queuedChunksRef.current + extraChunks > maxChunks;
        let droppedChunks = 0;
        let droppedMs = 0;
        if (policy === "drop-newest" && wouldOverflow(durationMs, 1)) {
          droppedChunks = 1;
          droppedMs = durationMs;
        } else {
          if (policy === "drop-all" && wouldOverflow(durationMs, 1)) {
            droppedChunks = playQueueRef.current.length;
            droppedMs = queuedMsRef.current;
            playQueueRef.current = [];
            queuedMsRef.current = 0;
            queuedChunksRef.current = 0;
          }
          playQueueRef.current.push({ pcm: chunk, sampleRate: targetRate, durationMs });
          queuedMsRef.current += durationMs;
          queuedChunksRef.current += 1;
          if (policy === "drop-oldest") {
            while (maxMs > 0 && queuedMsRef.current > maxMs || maxChunks > 0 && queuedChunksRef.current > maxChunks) {
              const dropped = playQueueRef.current.shift();
              if (!dropped) break;
              queuedMsRef.current = Math.max(0, queuedMsRef.current - dropped.durationMs);
              queuedChunksRef.current = Math.max(0, queuedChunksRef.current - 1);
              droppedChunks += 1;
              droppedMs += dropped.durationMs;
            }
          }
        }
        if (droppedChunks > 0) {
          droppedChunksRef.current += droppedChunks;
          droppedMsRef.current += droppedMs;
          emitEvent("audio_output_queue_overflow", {
            droppedChunks,
            droppedMs,
            queueMs: queuedMsRef.current,
            queueChunks: queuedChunksRef.current,
            policy
          });
          if (policy === "drop-newest") {
            emitEvent("audio_output_dropped", { reason: "queue_overflow", policy });
            return;
          }
        }
        clearCompleteTimer();
        if (!isPlayingRef.current) {
          setIsPlaying(true);
          onPlaybackStartRef.current?.();
        }
        if (!isDrainingRef.current) {
          drainQueue();
        }
      }
    } catch (e) {
      console.error("Failed to enqueue audio:", e);
    }
  }, [drainQueue, clearCompleteTimer, emitEvent]);
  const stopPlaybackRef = react.useRef(stopPlayback);
  react.useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);
  react.useEffect(() => {
    if (isPaused) {
      stopPlaybackRef.current();
    }
  }, [isPaused]);
  react.useEffect(() => {
    return () => {
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.onended = null;
          currentSourceRef.current.stop(0);
        } catch (e) {
        }
      }
      playQueueRef.current = [];
      isDrainingRef.current = false;
      queuedMsRef.current = 0;
      queuedChunksRef.current = 0;
      clearCompleteTimer();
    };
  }, [clearCompleteTimer]);
  return {
    isPlaying,
    enqueueAudio,
    stopPlayback,
    clearQueue,
    getStats: () => ({
      queueMs: queuedMsRef.current,
      queueChunks: queuedChunksRef.current,
      droppedChunks: droppedChunksRef.current,
      droppedMs: droppedMsRef.current,
      contextState: playCtxRef.current?.state ?? "none"
    })
  };
}

// src/hooks/useVoiceChat.ts
function useVoiceChat(options) {
  const { config: userConfig, apiKey, getApiKey } = options;
  const config = mergeConfig(userConfig);
  const [messages, setMessages] = react.useState([]);
  const [isLoading, setIsLoading] = react.useState(false);
  const maxMessages = config.maxMessages ?? 0;
  const maxTranscriptChars = config.maxTranscriptChars ?? 0;
  const [isMuted, setIsMuted] = react.useState(false);
  const [isMicEnabled, setIsMicEnabled] = react.useState(true);
  const [isSpeakerPaused, setIsSpeakerPaused] = react.useState(false);
  const [isAISpeaking, setIsAISpeaking] = react.useState(false);
  const isMutedRef = react.useRef(false);
  const isMicEnabledRef = react.useRef(true);
  const micEnabledBeforeMuteRef = react.useRef(true);
  const isSpeakerPausedRef = react.useRef(isSpeakerPaused);
  const limitText = react.useCallback((text) => {
    if (!maxTranscriptChars || maxTranscriptChars <= 0) return text;
    if (text.length <= maxTranscriptChars) return text;
    return text.slice(text.length - maxTranscriptChars);
  }, [maxTranscriptChars]);
  const appendWithLimit = react.useCallback((base, addition) => {
    if (!addition) return base;
    return limitText(base + addition);
  }, [limitText]);
  const updateMessages = react.useCallback((updater) => {
    setMessages((prev) => {
      const next = updater(prev);
      if (maxMessages && maxMessages > 0 && next.length > maxMessages) {
        return next.slice(next.length - maxMessages);
      }
      return next;
    });
  }, [maxMessages]);
  const emitEvent = react.useCallback((type, data) => {
    config.onEvent?.({ type, ts: Date.now(), data });
  }, [config.onEvent]);
  const currentTranscriptRef = react.useRef("");
  const streamingMsgIdRef = react.useRef(null);
  const currentInputTranscriptRef = react.useRef("");
  const streamingInputMsgIdRef = react.useRef(null);
  const pendingMicResumeRef = react.useRef(false);
  const sessionConnectedRef = react.useRef(false);
  const welcomeSentRef = react.useRef(false);
  const sawAudioRef = react.useRef(false);
  const wasListeningBeforeHideRef = react.useRef(false);
  const wasListeningBeforeOfflineRef = react.useRef(false);
  const micResumeTimerRef = react.useRef(null);
  const voiceOutputRef = react.useRef(null);
  const voiceInputRef = react.useRef(null);
  react.useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  react.useEffect(() => {
    isMicEnabledRef.current = isMicEnabled;
  }, [isMicEnabled]);
  react.useEffect(() => {
    isSpeakerPausedRef.current = isSpeakerPaused;
  }, [isSpeakerPaused]);
  const pushMsg = react.useCallback((content, role) => {
    const safeContent = limitText(content);
    updateMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      content: safeContent,
      role,
      ts: Date.now()
    }]);
  }, [limitText, updateMessages]);
  const pauseMicForModelReply = react.useCallback(() => {
    pendingMicResumeRef.current = true;
    sawAudioRef.current = false;
    voiceInputRef.current?.stopMic();
  }, []);
  const resumeMicIfAllowed = react.useCallback(() => {
    if (!pendingMicResumeRef.current || !sessionConnectedRef.current || isMutedRef.current || !isMicEnabledRef.current) {
      return;
    }
    pendingMicResumeRef.current = false;
    const delay = config.micResumeDelayMs ?? 200;
    setTimeout(() => {
      if (!voiceInputRef.current?.isListening) {
        void voiceInputRef.current?.startMic();
      }
    }, delay);
  }, [config.micResumeDelayMs]);
  const scheduleMicResume = react.useCallback((reason) => {
    if (micResumeTimerRef.current) {
      clearTimeout(micResumeTimerRef.current);
    }
    const delay = config.micResumeDelayMs ?? 200;
    micResumeTimerRef.current = setTimeout(() => {
      micResumeTimerRef.current = null;
      if (!sessionConnectedRef.current || isMutedRef.current || !isMicEnabledRef.current || isAISpeakingRef.current) {
        return;
      }
      if (!voiceInputRef.current?.isListening) {
        void voiceInputRef.current?.startMic();
      }
    }, delay);
    emitEvent("mic_resume_scheduled", { reason, delay });
  }, [config.micResumeDelayMs, emitEvent]);
  const handleMessage = react.useCallback((msg) => {
    const parseSampleRate = (mimeType) => {
      if (!mimeType) return void 0;
      const match = mimeType.match(/rate=(\d+)/i);
      if (!match) return void 0;
      const rate = Number(match[1]);
      return Number.isFinite(rate) ? rate : void 0;
    };
    const inputTranscript = msg.serverContent?.inputTranscription?.text;
    if (inputTranscript && config.replyAsAudio) {
      console.log("Received input transcription:", inputTranscript);
      if (!streamingInputMsgIdRef.current) {
        const id = `input-${Date.now()}-${Math.random()}`;
        streamingInputMsgIdRef.current = id;
        currentInputTranscriptRef.current = limitText(inputTranscript);
        updateMessages((prev) => [...prev, { id, content: currentInputTranscriptRef.current, role: "user", ts: Date.now() }]);
      } else {
        const id = streamingInputMsgIdRef.current;
        currentInputTranscriptRef.current = appendWithLimit(currentInputTranscriptRef.current, inputTranscript);
        updateMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: appendWithLimit(m.content, inputTranscript) } : m));
      }
    }
    if (msg.serverContent?.interrupted) {
      console.log("Generation interrupted");
      voiceOutputRef.current?.stopPlayback();
      currentTranscriptRef.current = "";
      streamingMsgIdRef.current = null;
    }
    if (msg.serverContent?.generationComplete) {
      setIsLoading(false);
      if (config.replyAsAudio && streamingMsgIdRef.current && currentTranscriptRef.current.trim()) {
        const cleanTranscript = limitText(currentTranscriptRef.current.replace(/\s+/g, " ").trim());
        const id = streamingMsgIdRef.current;
        updateMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: cleanTranscript } : m));
        currentTranscriptRef.current = "";
        streamingMsgIdRef.current = null;
      }
    }
    const msgAny = msg;
    if (msgAny.text && !config.replyAsAudio) {
      pushMsg(msgAny.text, "model");
      setIsLoading(false);
    }
    const parts = msg.serverContent?.modelTurn?.parts ?? [];
    for (const p of parts) {
      if (p.text && !config.replyAsAudio) {
        pushMsg(p.text, "model");
        setIsLoading(false);
      }
      if (p.inlineData?.mimeType?.startsWith("audio/") && p.inlineData.data && config.replyAsAudio) {
        if (isSpeakerPausedRef.current) {
          pauseMicForModelReply();
          emitEvent("audio_output_dropped", { reason: "speaker_paused" });
        } else {
          sawAudioRef.current = true;
          setIsAISpeaking(true);
          voiceOutputRef.current?.enqueueAudio(p.inlineData.data, parseSampleRate(p.inlineData.mimeType));
        }
      }
    }
    if (msgAny.data && config.replyAsAudio && !parts.some((p) => p.inlineData?.data)) {
      if (isSpeakerPausedRef.current) {
        pauseMicForModelReply();
        emitEvent("audio_output_dropped", { reason: "speaker_paused" });
      } else {
        sawAudioRef.current = true;
        setIsAISpeaking(true);
        voiceOutputRef.current?.enqueueAudio(msgAny.data);
      }
    }
    const transcript = msg.serverContent?.outputTranscription?.text;
    if (transcript && config.replyAsAudio) {
      if (streamingInputMsgIdRef.current && currentInputTranscriptRef.current.trim()) {
        const cleanInput = limitText(currentInputTranscriptRef.current.replace(/\s+/g, " ").trim());
        const inputId = streamingInputMsgIdRef.current;
        updateMessages((prev) => prev.map((m) => m.id === inputId ? { ...m, content: cleanInput } : m));
        streamingInputMsgIdRef.current = null;
        currentInputTranscriptRef.current = "";
      }
      if (!streamingMsgIdRef.current) {
        const id = `${Date.now()}-${Math.random()}`;
        streamingMsgIdRef.current = id;
        updateMessages((prev) => [...prev, { id, content: limitText(transcript), role: "model", ts: Date.now() }]);
      } else {
        const id = streamingMsgIdRef.current;
        updateMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: appendWithLimit(m.content, transcript) } : m));
      }
      currentTranscriptRef.current = appendWithLimit(currentTranscriptRef.current, transcript);
    }
    if (msg.serverContent?.turnComplete && config.replyAsAudio) {
      setIsLoading(false);
      if (streamingInputMsgIdRef.current && currentInputTranscriptRef.current.trim()) {
        const cleanInput = limitText(currentInputTranscriptRef.current.replace(/\s+/g, " ").trim());
        const inputId = streamingInputMsgIdRef.current;
        updateMessages((prev) => prev.map((m) => m.id === inputId ? { ...m, content: cleanInput } : m));
        streamingInputMsgIdRef.current = null;
        currentInputTranscriptRef.current = "";
      }
      if (streamingMsgIdRef.current && currentTranscriptRef.current.trim()) {
        const cleanTranscript = limitText(currentTranscriptRef.current.replace(/\s+/g, " ").trim());
        const id = streamingMsgIdRef.current;
        updateMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: cleanTranscript } : m));
      }
      currentTranscriptRef.current = "";
      streamingMsgIdRef.current = null;
      if (!sawAudioRef.current || isSpeakerPausedRef.current) {
        resumeMicIfAllowed();
      }
    }
  }, [config.replyAsAudio, pushMsg, resumeMicIfAllowed, appendWithLimit, updateMessages, limitText, emitEvent, pauseMicForModelReply]);
  const session = useLiveSession({
    config: userConfig,
    apiKey,
    getApiKey,
    onMessage: handleMessage,
    onConnected: () => {
      if (config.welcomeMessage) {
        pushMsg(config.welcomeMessage, "system");
      }
    },
    onDisconnected: () => {
      setIsAISpeaking(false);
      setIsLoading(false);
      pendingMicResumeRef.current = false;
    },
    onError: (error) => {
      pushMsg(error, "system");
      setIsLoading(false);
    },
    onSystemMessage: (message) => {
      pushMsg(message, "system");
    }
  });
  react.useEffect(() => {
    sessionConnectedRef.current = session.isConnected;
  }, [session.isConnected]);
  const voiceOutput = useVoiceOutput({
    playbackContext: session.playbackContext,
    isPaused: isSpeakerPaused,
    startBufferMs: config.playbackStartDelayMs,
    maxQueueMs: config.maxOutputQueueMs,
    maxQueueChunks: config.maxOutputQueueChunks,
    dropPolicy: config.outputDropPolicy,
    onEvent: config.onEvent,
    onPlaybackStart: () => {
      setIsAISpeaking(true);
      pendingMicResumeRef.current = true;
      voiceInputRef.current?.stopMic();
    },
    onPlaybackComplete: () => {
      setIsAISpeaking(false);
      resumeMicIfAllowed();
    }
  });
  const voiceInput = useVoiceInput({
    session: session.session,
    isEnabled: session.isConnected && !isMuted && isMicEnabled,
    maxConsecutiveErrors: config.maxConsecutiveInputErrors,
    errorCooldownMs: config.inputErrorCooldownMs,
    inputMinSendIntervalMs: config.inputMinSendIntervalMs,
    inputMaxQueueMs: config.inputMaxQueueMs,
    inputMaxQueueChunks: config.inputMaxQueueChunks,
    inputDropPolicy: config.inputDropPolicy,
    preferAudioWorklet: config.preferAudioWorklet,
    audioWorkletBufferSize: config.audioWorkletBufferSize,
    restartMicOnDeviceChange: config.restartMicOnDeviceChange,
    onEvent: config.onEvent,
    onVoiceStart: () => {
      voiceOutputRef.current?.stopPlayback();
      setIsAISpeaking(false);
    },
    onError: (error) => {
      pushMsg(error, "system");
    }
  });
  react.useEffect(() => {
    voiceOutputRef.current = voiceOutput;
  }, [voiceOutput]);
  react.useEffect(() => {
    voiceInputRef.current = voiceInput;
  }, [voiceInput]);
  react.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden) {
        wasListeningBeforeHideRef.current = !!voiceInputRef.current?.isListening || pendingMicResumeRef.current;
        voiceInputRef.current?.stopMic();
        voiceOutputRef.current?.stopPlayback();
        pendingMicResumeRef.current = false;
        if (micResumeTimerRef.current) {
          clearTimeout(micResumeTimerRef.current);
          micResumeTimerRef.current = null;
        }
        emitEvent("visibility_hidden");
      } else {
        emitEvent("visibility_visible");
        if (wasListeningBeforeHideRef.current) {
          wasListeningBeforeHideRef.current = false;
          scheduleMicResume("visibility");
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [emitEvent, scheduleMicResume]);
  react.useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = (event) => {
      wasListeningBeforeHideRef.current = !!voiceInputRef.current?.isListening || pendingMicResumeRef.current;
      voiceInputRef.current?.stopMic();
      voiceOutputRef.current?.stopPlayback();
      pendingMicResumeRef.current = false;
      if (micResumeTimerRef.current) {
        clearTimeout(micResumeTimerRef.current);
        micResumeTimerRef.current = null;
      }
      emitEvent("page_hide", { persisted: event.persisted });
    };
    const handlePageShow = (event) => {
      emitEvent("page_show", { persisted: event.persisted });
      if (wasListeningBeforeHideRef.current) {
        wasListeningBeforeHideRef.current = false;
        scheduleMicResume("pageshow");
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [emitEvent, scheduleMicResume]);
  react.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOffline = () => {
      wasListeningBeforeOfflineRef.current = !!voiceInputRef.current?.isListening || pendingMicResumeRef.current;
      voiceInputRef.current?.stopMic();
      voiceOutputRef.current?.stopPlayback();
      pendingMicResumeRef.current = false;
      if (micResumeTimerRef.current) {
        clearTimeout(micResumeTimerRef.current);
        micResumeTimerRef.current = null;
      }
    };
    const handleOnline = () => {
      if (wasListeningBeforeOfflineRef.current) {
        wasListeningBeforeOfflineRef.current = false;
        scheduleMicResume("online");
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [scheduleMicResume]);
  react.useEffect(() => {
    return () => {
      if (micResumeTimerRef.current) {
        clearTimeout(micResumeTimerRef.current);
        micResumeTimerRef.current = null;
      }
    };
  }, []);
  const startMicRef = react.useRef(voiceInput.startMic);
  react.useEffect(() => {
    startMicRef.current = voiceInput.startMic;
  }, [voiceInput.startMic]);
  react.useEffect(() => {
    if (session.isConnected && config.autoStartMicOnConnect !== false && !voiceInput.isListening && !isMuted && isMicEnabled && !session.isReconnecting && !pendingMicResumeRef.current && !isAISpeakingRef.current) {
      console.log("Auto-starting mic after connection...");
      const timer = setTimeout(() => {
        void startMicRef.current();
      }, config.sessionInitDelayMs);
      return () => clearTimeout(timer);
    }
  }, [session.isConnected, session.isReconnecting, voiceInput.isListening, isMuted, isMicEnabled, config.sessionInitDelayMs]);
  react.useEffect(() => {
    if (session.isConnected && config.autoWelcomeAudio && config.welcomeAudioPrompt && !welcomeSentRef.current) {
      welcomeSentRef.current = true;
      pauseMicForModelReply();
      session.sendText(config.welcomeAudioPrompt);
    }
  }, [session.isConnected, config.autoWelcomeAudio, config.welcomeAudioPrompt, pauseMicForModelReply, session]);
  const isAISpeakingRef = react.useRef(false);
  react.useEffect(() => {
    isAISpeakingRef.current = isAISpeaking;
  }, [isAISpeaking]);
  react.useEffect(() => {
    if (!session.isConnected) {
      voiceInputRef.current?.stopMic();
      voiceOutputRef.current?.stopPlayback();
      pendingMicResumeRef.current = false;
      if (micResumeTimerRef.current) {
        clearTimeout(micResumeTimerRef.current);
        micResumeTimerRef.current = null;
      }
    }
  }, [session.isConnected]);
  const toggleMute = react.useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (newMuted) {
        micEnabledBeforeMuteRef.current = isMicEnabledRef.current;
        setIsMicEnabled(false);
        voiceInputRef.current?.stopMic();
        voiceOutputRef.current?.stopPlayback();
      } else {
        setIsMicEnabled(micEnabledBeforeMuteRef.current);
        if (session.isConnected && micEnabledBeforeMuteRef.current) {
          setTimeout(() => void voiceInputRef.current?.startMic(), 200);
        }
      }
      return newMuted;
    });
  }, [session.isConnected]);
  const toggleMic = react.useCallback(() => {
    if (voiceInput.isListening) {
      setIsMicEnabled(false);
      voiceInput.stopMic();
    } else if (session.isConnected && !isMuted) {
      session.playbackContext?.resume().catch((e) => {
        console.warn("Playback context resume failed:", e);
      });
      setIsMicEnabled(true);
      void voiceInput.startMic();
    }
  }, [voiceInput, session.isConnected, isMuted]);
  const toggleSpeaker = react.useCallback(() => {
    setIsSpeakerPaused((prev) => {
      const newPaused = !prev;
      if (newPaused) {
        voiceOutputRef.current?.stopPlayback();
        setIsAISpeaking(false);
        resumeMicIfAllowed();
      }
      return newPaused;
    });
  }, [resumeMicIfAllowed]);
  const sendTextMessage = react.useCallback((text) => {
    if (!text.trim()) return;
    pushMsg(text, "user");
    if (config.replyAsAudio && config.autoPauseMicOnSendText !== false) {
      pauseMicForModelReply();
    }
    setIsLoading(true);
    session.sendText(text);
  }, [session, pushMsg, config.replyAsAudio, config.autoPauseMicOnSendText, pauseMicForModelReply]);
  const getStats = react.useCallback(() => {
    const sessionStats = session.getStats();
    const inputStats = voiceInput.getStats();
    const outputStats = voiceOutput.getStats();
    return {
      ts: Date.now(),
      session: {
        isConnected: session.isConnected,
        isReconnecting: session.isReconnecting,
        reconnectAttempts: sessionStats.reconnectAttempts,
        lastConnectAttemptAt: sessionStats.lastConnectAttemptAt,
        lastDisconnectCode: sessionStats.lastDisconnectCode,
        lastDisconnectReason: sessionStats.lastDisconnectReason
      },
      input: {
        isListening: voiceInput.isListening,
        queueMs: inputStats.queueMs,
        queueChunks: inputStats.queueChunks,
        droppedChunks: inputStats.droppedChunks,
        droppedMs: inputStats.droppedMs,
        sendErrorStreak: inputStats.sendErrorStreak,
        blockedUntil: inputStats.blockedUntil,
        lastSendAt: inputStats.lastSendAt,
        usingWorklet: inputStats.usingWorklet
      },
      output: {
        isPlaying: voiceOutput.isPlaying,
        queueMs: outputStats.queueMs,
        queueChunks: outputStats.queueChunks,
        droppedChunks: outputStats.droppedChunks,
        droppedMs: outputStats.droppedMs,
        contextState: outputStats.contextState
      }
    };
  }, [session.isConnected, session.isReconnecting, session.getStats, voiceInput.isListening, voiceInput.getStats, voiceOutput.isPlaying, voiceOutput.getStats]);
  return {
    // Connection
    isConnected: session.isConnected,
    isReconnecting: session.isReconnecting,
    // Voice
    isListening: voiceInput.isListening,
    isAISpeaking,
    micLevel: voiceInput.micLevel,
    // Controls
    isMuted,
    isMicEnabled,
    isSpeakerPaused,
    // Messages
    messages,
    isLoading,
    // Actions
    connect: session.connect,
    disconnect: session.disconnect,
    sendText: sendTextMessage,
    toggleMute,
    toggleMic,
    toggleSpeaker,
    getStats
  };
}
function ChatMessage({ message, primaryColor = "#2563eb" }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "8px"
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          style: {
            maxWidth: "80%",
            padding: "8px 12px",
            borderRadius: "12px",
            fontSize: "14px",
            lineHeight: "1.4",
            ...isUser ? {
              backgroundColor: primaryColor,
              color: "white",
              borderBottomRightRadius: "4px"
            } : isSystem ? {
              backgroundColor: "#f3f4f6",
              color: "#6b7280",
              fontStyle: "italic"
            } : {
              backgroundColor: "#f3f4f6",
              color: "#1f2937",
              borderBottomLeftRadius: "4px"
            }
          },
          children: message.content
        }
      )
    }
  );
}
function ChatBot({ config: userConfig, apiKey, getApiKey }) {
  const config = mergeConfig(userConfig);
  const [isOpen, setIsOpen] = react.useState(false);
  const [inputText, setInputText] = react.useState("");
  const messagesEndRef = react.useRef(null);
  const {
    isConnected,
    isReconnecting,
    isListening,
    isAISpeaking,
    micLevel,
    isMuted,
    isMicEnabled: _isMicEnabled,
    isSpeakerPaused,
    messages,
    isLoading,
    connect,
    disconnect,
    sendText,
    toggleMute,
    toggleMic,
    toggleSpeaker
  } = useVoiceChat({ config: userConfig, apiKey, getApiKey });
  react.useEffect(() => {
    if (isOpen && !isConnected) {
      void connect();
    }
  }, [isOpen, isConnected, connect]);
  react.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const handleClose = react.useCallback(async () => {
    await disconnect();
    setIsOpen(false);
  }, [disconnect]);
  const handleSendText = react.useCallback(() => {
    if (!inputText.trim() || !isConnected) return;
    sendText(inputText.trim());
    setInputText("");
  }, [inputText, isConnected, sendText]);
  const handleSuggestionClick = react.useCallback(
    (suggestion) => {
      if (!isConnected) return;
      sendText(suggestion);
    },
    [isConnected, sendText]
  );
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const primaryColor = config.theme.primaryColor || "#2563eb";
  const position = config.theme.position || "bottom-right";
  const positionStyles = position === "bottom-left" ? { bottom: "24px", left: "24px" } : { bottom: "24px", right: "24px" };
  const cardPositionStyles = position === "bottom-left" ? { bottom: "96px", left: "24px" } : { bottom: "96px", right: "24px" };
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        onClick: () => {
          if (isOpen) {
            void handleClose();
          } else {
            setIsOpen(true);
          }
        },
        style: {
          position: "fixed",
          ...positionStyles,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: primaryColor,
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1e3,
          transition: "transform 0.2s"
        },
        onMouseEnter: (e) => e.currentTarget.style.transform = "scale(1.05)",
        onMouseLeave: (e) => e.currentTarget.style.transform = "scale(1)",
        children: isOpen ? /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
          /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
          /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
        ] }) : /* @__PURE__ */ jsxRuntime.jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) })
      }
    ),
    isOpen && /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        style: {
          position: "fixed",
          ...cardPositionStyles,
          width: "380px",
          maxWidth: "calc(100vw - 48px)",
          height: "500px",
          maxHeight: "calc(100vh - 120px)",
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          display: "flex",
          flexDirection: "column",
          zIndex: 999,
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ jsxRuntime.jsxs(
            "div",
            {
              style: {
                padding: "16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f9fafb"
              },
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontWeight: 600, color: "#1f2937" }, children: config.chatTitle }),
                /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "button",
                    {
                      onClick: toggleMute,
                      style: {
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        color: isMuted ? "#ef4444" : "#6b7280"
                      },
                      children: isMuted ? /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                        /* @__PURE__ */ jsxRuntime.jsx("polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }),
                        /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "23", y1: "9", x2: "17", y2: "15" }),
                        /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "17", y1: "9", x2: "23", y2: "15" })
                      ] }) : /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                        /* @__PURE__ */ jsxRuntime.jsx("polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }),
                        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" })
                      ] })
                    }
                  ),
                  isReconnecting && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "12px", color: "#6b7280" }, children: "Reconnecting..." }),
                  isListening && !isMuted && !isReconnecting && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: "12px", color: primaryColor }, children: "\u25CF Live" }),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "span",
                    {
                      style: {
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isReconnecting ? "#f59e0b" : isConnected ? "#22c55e" : "#d1d5db"
                      }
                    }
                  )
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { flex: 1, overflowY: "auto", padding: "16px" }, children: [
            userMessageCount === 0 && isConnected && config.suggestedQuestions.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { marginBottom: "16px" }, children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: "12px", color: "#6b7280", marginBottom: "8px" }, children: "Suggested questions" }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", flexDirection: "column", gap: "8px" }, children: config.suggestedQuestions.map((question) => /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  onClick: () => handleSuggestionClick(question),
                  disabled: isLoading || isReconnecting,
                  style: {
                    textAlign: "left",
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    backgroundColor: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#1f2937",
                    transition: "border-color 0.2s"
                  },
                  onMouseEnter: (e) => e.currentTarget.style.borderColor = primaryColor,
                  onMouseLeave: (e) => e.currentTarget.style.borderColor = "#e5e7eb",
                  children: question
                },
                question
              )) })
            ] }),
            messages.map((m) => /* @__PURE__ */ jsxRuntime.jsx(ChatMessage, { message: m, primaryColor }, m.id)),
            isLoading && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { fontSize: "14px", color: "#6b7280", padding: "8px" }, children: "Processing..." }),
            isListening && !isMuted && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#6b7280", padding: "8px 0" }, children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "div",
                {
                  style: {
                    width: "60px",
                    height: "6px",
                    backgroundColor: "#e5e7eb",
                    borderRadius: "3px",
                    overflow: "hidden"
                  },
                  children: /* @__PURE__ */ jsxRuntime.jsx(
                    "div",
                    {
                      style: {
                        width: `${Math.max(5, Math.min(100, Math.round(micLevel * 100)))}%`,
                        height: "100%",
                        backgroundColor: primaryColor,
                        borderRadius: "3px",
                        transition: "width 75ms"
                      }
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Listening" })
            ] }),
            isAISpeaking && !isSpeakerPaused && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: primaryColor, padding: "8px 0" }, children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: "2px" }, children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { style: { width: "3px", height: "12px", backgroundColor: primaryColor, borderRadius: "2px", animation: "pulse 1s infinite" } }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { style: { width: "3px", height: "16px", backgroundColor: primaryColor, borderRadius: "2px", animation: "pulse 1s infinite 0.1s" } }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { style: { width: "3px", height: "8px", backgroundColor: primaryColor, borderRadius: "2px", animation: "pulse 1s infinite 0.2s" } })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Speaking" })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { ref: messagesEndRef })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "div",
            {
              style: {
                padding: "12px",
                borderTop: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                display: "flex",
                justifyContent: "center",
                gap: "12px"
              },
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    onClick: toggleMic,
                    disabled: !isConnected || isMuted || isReconnecting,
                    style: {
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: isListening ? primaryColor : "#e5e7eb",
                      color: isListening ? "white" : "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: !isConnected || isMuted || isReconnecting ? 0.5 : 1
                    },
                    children: isListening ? /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                      /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" }),
                      /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
                      /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12", y1: "19", x2: "12", y2: "23" }),
                      /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "8", y1: "23", x2: "16", y2: "23" })
                    ] }) : /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                      /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "1", y1: "1", x2: "23", y2: "23" }),
                      /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" }),
                      /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" }),
                      /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12", y1: "19", x2: "12", y2: "23" }),
                      /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "8", y1: "23", x2: "16", y2: "23" })
                    ] })
                  }
                ),
                isListening && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { width: "80px", display: "flex", alignItems: "center" }, children: /* @__PURE__ */ jsxRuntime.jsx(
                  "div",
                  {
                    style: {
                      width: "100%",
                      height: "8px",
                      backgroundColor: "#e5e7eb",
                      borderRadius: "4px",
                      overflow: "hidden"
                    },
                    children: /* @__PURE__ */ jsxRuntime.jsx(
                      "div",
                      {
                        style: {
                          width: `${Math.max(5, Math.min(100, Math.round(micLevel * 100)))}%`,
                          height: "100%",
                          backgroundColor: primaryColor,
                          borderRadius: "4px",
                          transition: "width 75ms"
                        }
                      }
                    )
                  }
                ) }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    onClick: toggleSpeaker,
                    disabled: !isConnected || isReconnecting,
                    style: {
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: isSpeakerPaused ? "#e5e7eb" : primaryColor,
                      color: isSpeakerPaused ? "#6b7280" : "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: !isConnected || isReconnecting ? 0.5 : 1
                    },
                    children: isSpeakerPaused ? /* @__PURE__ */ jsxRuntime.jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntime.jsx("polygon", { points: "5 3 19 12 5 21 5 3" }) }) : /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                      /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "6", y: "4", width: "4", height: "16" }),
                      /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "14", y: "4", width: "4", height: "16" })
                    ] })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "div",
            {
              style: {
                padding: "16px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: "8px"
              },
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(
                  "input",
                  {
                    type: "text",
                    value: inputText,
                    onChange: (e) => setInputText(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendText();
                      }
                    },
                    placeholder: isListening && !isMuted ? "Listening... or type here" : "Type a message...",
                    disabled: !isConnected || isReconnecting,
                    style: {
                      flex: 1,
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      outline: "none"
                    }
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    onClick: handleSendText,
                    disabled: !inputText.trim() || !isConnected || isLoading || isReconnecting,
                    style: {
                      width: "42px",
                      height: "42px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: primaryColor,
                      color: "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: !inputText.trim() || !isConnected || isLoading || isReconnecting ? 0.5 : 1
                    },
                    children: /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                      /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }),
                      /* @__PURE__ */ jsxRuntime.jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })
                    ] })
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx("style", { children: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      ` })
  ] });
}

exports.AUDIO_CONFIG = AUDIO_CONFIG;
exports.ChatBot = ChatBot;
exports.ChatMessage = ChatMessage;
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
exports.STABLE_PRESET = STABLE_PRESET;
exports.mergeConfig = mergeConfig;
exports.useLiveSession = useLiveSession;
exports.useVoiceChat = useVoiceChat;
exports.useVoiceInput = useVoiceInput;
exports.useVoiceOutput = useVoiceOutput;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map