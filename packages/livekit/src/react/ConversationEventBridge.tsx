/**
 * Renderless component that bridges LiveKit room events to host-app callbacks.
 *
 * Must be rendered INSIDE a <LiveKitRoom> context (uses hooks that depend on it).
 * Fires ConversationEventCallbacks for agent state, transcripts, handoff, etc.
 * Also accumulates transcripts for imperative export via TranscriptHandle.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  useVoiceAssistant,
  useTranscriptions,
  useRoomInfo,
} from '@livekit/components-react';
import type { ConversationEventCallbacks, TranscriptMessage, TranscriptHandle } from './types';

export interface ConversationEventBridgeProps extends ConversationEventCallbacks {}

export const ConversationEventBridge = forwardRef<TranscriptHandle, ConversationEventBridgeProps>(
  function ConversationEventBridge(props, ref) {
    const { onAgentStateChange, onTranscript, onConversationEnd, onHandoff } = props;

    // Store callbacks in refs to avoid stale closures
    const onAgentStateChangeRef = useRef(onAgentStateChange);
    const onTranscriptRef = useRef(onTranscript);
    const onConversationEndRef = useRef(onConversationEnd);
    const onHandoffRef = useRef(onHandoff);

    useEffect(() => { onAgentStateChangeRef.current = onAgentStateChange; }, [onAgentStateChange]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onConversationEndRef.current = onConversationEnd; }, [onConversationEnd]);
    useEffect(() => { onHandoffRef.current = onHandoff; }, [onHandoff]);

    // --- Agent state tracking ---
    const { state, agent } = useVoiceAssistant();
    const prevStateRef = useRef(state);

    useEffect(() => {
      if (state !== prevStateRef.current) {
        prevStateRef.current = state;
        onAgentStateChangeRef.current?.(state);
      }
    }, [state]);

    // --- Transcript tracking ---
    const transcriptions = useTranscriptions();
    const prevLengthRef = useRef(0);
    const messagesRef = useRef<TranscriptMessage[]>([]);
    const agentIdentity = agent?.identity;

    useEffect(() => {
      if (transcriptions.length <= prevLengthRef.current) return;

      const newEntries = transcriptions.slice(prevLengthRef.current);
      prevLengthRef.current = transcriptions.length;

      for (const t of newEntries) {
        const text = t.text.replace(/<noise>/gi, '').trim();
        if (!text) continue;

        const message: TranscriptMessage = {
          role: t.participantInfo.identity === agentIdentity ? 'agent' : 'user',
          text,
          timestamp: t.streamInfo.timestamp,
          id: t.streamInfo.id,
        };

        messagesRef.current.push(message);
        onTranscriptRef.current?.(message);
      }
    }, [transcriptions, agentIdentity]);

    // --- Room metadata (handoff detection) ---
    const { metadata } = useRoomInfo();
    const prevMetadataRef = useRef<string | undefined>(undefined);

    useEffect(() => {
      if (!metadata || metadata === prevMetadataRef.current) return;
      prevMetadataRef.current = metadata;

      try {
        const parsed = JSON.parse(metadata);
        if (parsed.handoff) {
          onHandoffRef.current?.({
            reason: parsed.handoff.reason ?? 'unknown',
            priority: parsed.handoff.priority ?? 'normal',
            timestamp: parsed.handoff.timestamp ?? Date.now(),
          });
        }
      } catch {
        // Metadata isn't JSON or doesn't have handoff — ignore
      }
    }, [metadata]);

    // --- Conversation end (fires when component unmounts = room disconnects) ---
    useEffect(() => {
      return () => {
        onConversationEndRef.current?.('disconnected');
      };
    }, []);

    // --- Imperative transcript export ---
    useImperativeHandle(ref, () => ({
      getTranscript(): TranscriptMessage[] {
        return [...messagesRef.current];
      },
    }), []);

    return null;
  },
);
