import type { Channel, Message, PlatformEvent } from './types';

/** Feature flags that describe what a channel adapter supports. */
export interface ChannelCapabilities {
  supportsTextIn: boolean;
  supportsTextOut: boolean;
  supportsAudioIn: boolean;
  supportsAudioOut: boolean;
  supportsStreaming: boolean;
  supportsGroups: boolean;
  supportsTypingIndicators: boolean;
  supportsAttachments: boolean;
}

/** Minimal context shared across channel adapter calls. */
export interface ChannelContext {
  appSlug: string;
  sessionId: string;
  channel: Channel;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

/** Outbound attachment payload. */
export interface ChannelAttachment {
  url: string;
  mimeType?: string;
  filename?: string;
  sizeBytes?: number;
}

/** Core adapter identity + lifecycle contract. */
export interface BaseChannelAdapter {
  id: string;
  channel: Channel;
  capabilities: ChannelCapabilities;
  start?: (context: ChannelContext) => Promise<void> | void;
  stop?: (context: ChannelContext) => Promise<void> | void;
}

/** Send/edit/delete message operations. */
export interface ChannelMessagingAdapter {
  sendMessage: (context: ChannelContext, message: Message) => Promise<{ externalId?: string } | void>;
  editMessage?: (context: ChannelContext, externalId: string, content: string) => Promise<void>;
  deleteMessage?: (context: ChannelContext, externalId: string) => Promise<void>;
}

/** Streaming operations for token-by-token responses. */
export interface ChannelStreamingAdapter {
  beginStream: (context: ChannelContext) => Promise<{ streamId: string }>;
  appendStreamChunk: (context: ChannelContext, streamId: string, chunk: string) => Promise<void>;
  endStream: (context: ChannelContext, streamId: string) => Promise<void>;
}

/** Group/conversation membership operations. */
export interface ChannelGroupAdapter {
  listMembers: (context: ChannelContext, groupId: string) => Promise<Array<{ id: string; displayName?: string }>>;
  mentionMember?: (context: ChannelContext, groupId: string, memberId: string, text: string) => Promise<void>;
}

/** Presence/typing indicator operations. */
export interface ChannelPresenceAdapter {
  setTyping: (context: ChannelContext, isTyping: boolean) => Promise<void>;
}

/** Attachment transport operations. */
export interface ChannelAttachmentAdapter {
  sendAttachment: (context: ChannelContext, attachment: ChannelAttachment, caption?: string) => Promise<void>;
}

/** Inbound message/event subscription operations. */
export interface ChannelInboundAdapter {
  onMessage?: (handler: (message: Message, context: ChannelContext) => void | Promise<void>) => void;
  onEvent?: (handler: (event: PlatformEvent, context: ChannelContext) => void | Promise<void>) => void;
}

/** Unified channel adapter surface (granular interfaces are optional per capability). */
export type ChannelAdapter =
  & BaseChannelAdapter
  & Partial<ChannelMessagingAdapter>
  & Partial<ChannelStreamingAdapter>
  & Partial<ChannelGroupAdapter>
  & Partial<ChannelPresenceAdapter>
  & Partial<ChannelAttachmentAdapter>
  & Partial<ChannelInboundAdapter>;

/** In-memory channel adapter registry. */
export interface ChannelAdapterRegistry {
  register: (adapter: ChannelAdapter) => void;
  unregister: (id: string) => void;
  get: (id: string) => ChannelAdapter | undefined;
  list: () => ChannelAdapter[];
  clear: () => void;
}

/** Create a simple in-memory channel adapter registry. */
export function createChannelAdapterRegistry(): ChannelAdapterRegistry {
  const adapters = new Map<string, ChannelAdapter>();
  return {
    register(adapter) {
      adapters.set(adapter.id, adapter);
    },
    unregister(id) {
      adapters.delete(id);
    },
    get(id) {
      return adapters.get(id);
    },
    list() {
      return Array.from(adapters.values());
    },
    clear() {
      adapters.clear();
    },
  };
}
