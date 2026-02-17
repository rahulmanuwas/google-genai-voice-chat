// @genai-voice/sdk/core — shared types for the genai-voice platform

// Conversation protocol
export type {
  Channel,
  Role,
  Message,
  ConversationStatus,
  Conversation,
  PlatformEvent,
} from './types';

// Channel adapter interfaces
export type {
  ChannelCapabilities,
  ChannelContext,
  ChannelAttachment,
  BaseChannelAdapter,
  ChannelMessagingAdapter,
  ChannelStreamingAdapter,
  ChannelGroupAdapter,
  ChannelPresenceAdapter,
  ChannelAttachmentAdapter,
  ChannelInboundAdapter,
  ChannelAdapter,
  ChannelAdapterRegistry,
} from './channel';
export { createChannelAdapterRegistry } from './channel';

// Tool/action framework
export type {
  JSONSchemaProperty,
  ToolParametersSchema,
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolExecutionStatus,
  ToolExecution,
} from './tool';

// Human handoff
export type {
  HandoffReason,
  HandoffStatus,
  HandoffPriority,
  Handoff,
  HandoffTrigger,
  HandoffConfig,
} from './handoff';

// Guardrails & trust/safety
export type {
  GuardrailType,
  GuardrailAction,
  GuardrailRule,
  GuardrailDirection,
  GuardrailViolation,
  GuardrailConfig,
} from './guardrail';

// Knowledge management
export type {
  KnowledgeSourceType,
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeGap,
  KnowledgeConfig,
} from './knowledge';

// Analytics & insights
export type {
  PeriodInsights,
  TopicCount,
  CSATRating,
  Experiment,
  ExperimentVariant,
  ExperimentExposure,
} from './analytics';

// Persona / brand voice
export type {
  PersonaTone,
  PersonaConfig,
} from './persona';
