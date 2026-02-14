/**
 * Knowledge management and RAG types.
 *
 * Structured knowledge base that goes beyond a flat systemPrompt —
 * supports vector search, content categories, and gap detection.
 */

/** Knowledge document source type */
export type KnowledgeSourceType = 'document' | 'faq' | 'api' | 'webpage';

/** A knowledge document stored with vector embedding */
export interface KnowledgeDocument {
  id: string;
  appSlug: string;
  title: string;
  content: string;
  category: string;
  sourceType: KnowledgeSourceType;
  /** Vector embedding for similarity search */
  embedding?: number[];
  lastUpdated: number;
  updatedBy?: string;
}

/** Result of a knowledge search */
export interface KnowledgeSearchResult {
  document: KnowledgeDocument;
  score: number;
}

/** A detected knowledge gap (question the AI couldn't answer) */
export interface KnowledgeGap {
  id: string;
  appSlug: string;
  sessionId: string;
  query: string;
  bestMatchScore: number;
  createdAt: number;
  resolved: boolean;
}

/** Knowledge base configuration */
export interface KnowledgeConfig {
  enabled: boolean;
  /** Number of documents to retrieve per query */
  topK: number;
  /** Minimum similarity score to include a result */
  similarityThreshold: number;
  /** Log queries with no good matches as knowledge gaps */
  gapDetection: boolean;
}
