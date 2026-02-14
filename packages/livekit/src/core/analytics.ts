/**
 * Analytics and insights types.
 *
 * Aggregated metrics, CSAT tracking, topic clustering,
 * and knowledge gap detection for continuous improvement.
 */

/** Aggregated insights for a time period */
export interface PeriodInsights {
  appSlug: string;
  period: string;
  totalConversations: number;
  resolutionRate: number;
  handoffRate: number;
  avgDurationMs: number;
  avgCSAT?: number;
  topTopics: TopicCount[];
  knowledgeGaps: string[];
  toolUsage: Record<string, number>;
}

/** Topic frequency count */
export interface TopicCount {
  topic: string;
  count: number;
}

/** CSAT rating from a user */
export interface CSATRating {
  id: string;
  appSlug: string;
  sessionId: string;
  rating: number;
  comment?: string;
  createdAt: number;
}

/** Experiment definition for A/B testing */
export interface Experiment {
  id: string;
  appSlug: string;
  name: string;
  variants: ExperimentVariant[];
  isActive: boolean;
  createdAt: number;
}

/** A single experiment variant */
export interface ExperimentVariant {
  id: string;
  weight: number;
  config: Record<string, unknown>;
}

/** Record of a user being exposed to an experiment variant */
export interface ExperimentExposure {
  experimentId: string;
  sessionId: string;
  variantId: string;
  createdAt: number;
}
