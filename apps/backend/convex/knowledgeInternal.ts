"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

type SearchSignal = "vector" | "keyword";

interface SearchCandidate {
  _id: string;
  title: string;
  content: string;
  category: string;
  sourceType: string;
  sourceSessionId?: string;
  updatedAt: number;
  vectorScore?: number;
  keywordScore?: number;
}

interface WeightedScores {
  alphaVector: number;
  alphaKeyword: number;
  alphaMemory: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MEMORY_CHUNKS = 12;
const MAX_MEMORY_CHARS_PER_CHUNK = 900;

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

/** Generate embedding for text using Gemini embedding model */
async function generateEmbedding(text: string): Promise<number[]> {
  const ai = getGenAI();
  try {
    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: { outputDimensionality: 768 },
    });
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("Embedding API returned empty values");
    }
    return values;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to generate embedding: ${message}`);
  }
}

function clampWeight(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1.5, value as number));
}

function normalizeScores(values: number[]): (value: number | undefined) => number {
  const filtered = values.filter((v) => Number.isFinite(v));
  if (filtered.length === 0) {
    return () => 0;
  }

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  if (max === min) {
    return (value) => ((value ?? 0) > 0 ? 1 : 0);
  }

  return (value) => {
    if (!Number.isFinite(value)) return 0;
    return ((value as number) - min) / (max - min);
  };
}

function mergeSignal(
  map: Map<string, SearchCandidate>,
  records: Array<{
    _id: string;
    title: string;
    content: string;
    category: string;
    sourceType: string;
    sourceSessionId?: string;
    score: number;
    updatedAt: number;
  }>,
  signal: SearchSignal,
) {
  for (const record of records) {
    const key = `${record.sourceType}:${record._id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        _id: record._id,
        title: record.title,
        content: record.content,
        category: record.category,
        sourceType: record.sourceType,
        sourceSessionId: record.sourceSessionId,
        updatedAt: record.updatedAt,
        ...(signal === "vector"
          ? { vectorScore: record.score }
          : { keywordScore: record.score }),
      });
      continue;
    }

    existing.updatedAt = Math.max(existing.updatedAt, record.updatedAt);
    if (signal === "vector") {
      existing.vectorScore = Math.max(existing.vectorScore ?? -Infinity, record.score);
    } else {
      existing.keywordScore = Math.max(existing.keywordScore ?? -Infinity, record.score);
    }
  }
}

function rankCandidates(
  candidates: SearchCandidate[],
  weights: WeightedScores,
): Array<SearchCandidate & { fusedScore: number }> {
  const normalizeVector = normalizeScores(
    candidates.map((candidate) => candidate.vectorScore ?? 0)
  );
  const normalizeKeyword = normalizeScores(
    candidates.map((candidate) => candidate.keywordScore ?? 0)
  );
  const now = Date.now();

  const ranked = candidates.map((candidate) => {
    const vectorNorm = normalizeVector(candidate.vectorScore);
    const keywordNorm = normalizeKeyword(candidate.keywordScore);
    const recencyDays = Math.max(0, (now - candidate.updatedAt) / DAY_MS);
    const recencyBonus = 0.05 / (1 + recencyDays);
    const memoryBoost = candidate.sourceType === "transcript"
      ? weights.alphaMemory * Math.max(vectorNorm, keywordNorm)
      : 0;
    const fusedScore =
      (weights.alphaVector * vectorNorm)
      + (weights.alphaKeyword * keywordNorm)
      + memoryBoost
      + recencyBonus;

    return { ...candidate, fusedScore };
  });

  ranked.sort((a, b) => b.fusedScore - a.fusedScore || b.updatedAt - a.updatedAt);
  return ranked;
}

function normalizeMessageText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildTranscriptChunks(
  sessionId: string,
  messages: Array<{ role: string; content: string; ts: number }>,
) {
  const sorted = messages
    .map((message) => ({
      role: message.role,
      content: normalizeMessageText(message.content),
      ts: message.ts ?? Date.now(),
    }))
    .filter((message) => message.content.length > 0)
    .sort((a, b) => a.ts - b.ts);

  if (sorted.length === 0) return [];

  const chunks: Array<{
    chunkId: string;
    title: string;
    content: string;
    roleSummary: string;
    sourceTs: number;
  }> = [];

  let lines: string[] = [];
  let chars = 0;
  let chunkStart = 0;
  let chunkEnd = 0;
  const roleSet = new Set<string>();

  const pushChunk = () => {
    if (lines.length === 0) return;
    const chunkIndex = chunks.length;
    chunks.push({
      chunkId: `chunk-${chunkIndex.toString().padStart(3, "0")}`,
      title: `Session ${sessionId} memory #${chunkIndex + 1}`,
      content: lines.join("\n"),
      roleSummary: Array.from(roleSet).join(", "),
      sourceTs: chunkEnd || Date.now(),
    });
    lines = [];
    chars = 0;
    roleSet.clear();
  };

  for (const message of sorted) {
    const line = `${message.role.toUpperCase()}: ${message.content}`;
    if (lines.length === 0) {
      chunkStart = message.ts;
    }

    if (lines.length > 0 && chars + line.length > MAX_MEMORY_CHARS_PER_CHUNK) {
      pushChunk();
      chunkStart = message.ts;
    }

    lines.push(line);
    chars += line.length;
    chunkEnd = message.ts;
    roleSet.add(message.role);
  }

  pushChunk();

  const sliced = chunks.slice(-MAX_MEMORY_CHUNKS);
  return sliced.map((chunk, index) => ({
    ...chunk,
    chunkId: `chunk-${index.toString().padStart(3, "0")}`,
    title: `Session ${sessionId} memory #${index + 1}`,
    sourceTs: chunk.sourceTs || chunkStart || Date.now(),
  }));
}

/** Upsert a knowledge document with auto-generated embedding */
export const upsertWithEmbeddingAction = internalAction({
  args: {
    appSlug: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    sourceType: v.string(),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const embedding = await generateEmbedding(
      `${args.title}\n\n${args.content}`
    );

    return await ctx.runMutation(internal.knowledge.upsertKnowledgeDocumentRecord, {
      ...args,
      embedding,
    });
  },
});

/** Build transcript-memory embeddings for a session transcript. */
export const indexSessionTranscriptAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    channel: v.optional(v.string()),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        ts: v.float64(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const chunks = buildTranscriptChunks(args.sessionId, args.messages);
    if (chunks.length === 0) {
      await ctx.runMutation(internal.knowledge.upsertTranscriptMemoryChunkRecords, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        chunks: [],
      });
      return { indexed: 0 };
    }

    const embeddings = await Promise.all(
      chunks.map((chunk) => generateEmbedding(chunk.content))
    );

    await ctx.runMutation(internal.knowledge.upsertTranscriptMemoryChunkRecords, {
      appSlug: args.appSlug,
      sessionId: args.sessionId,
      chunks: chunks.map((chunk, index) => ({
        chunkId: chunk.chunkId,
        title: chunk.title,
        content: chunk.content,
        roleSummary: chunk.roleSummary,
        channel: args.channel,
        sourceTs: chunk.sourceTs,
        embedding: embeddings[index],
      })),
    });

    return { indexed: chunks.length };
  },
});

/** Search knowledge base using weighted vector + BM25 + transcript memory fusion. */
export const searchKnowledgeAction = internalAction({
  args: {
    appSlug: v.string(),
    query: v.string(),
    category: v.optional(v.string()),
    topK: v.float64(),
    sessionId: v.optional(v.string()),
    traceId: v.optional(v.string()),
    includeTranscriptMemory: v.optional(v.boolean()),
    alphaVector: v.optional(v.float64()),
    alphaKeyword: v.optional(v.float64()),
    alphaMemory: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const queryEmbedding = await generateEmbedding(args.query);
    const limit = Math.max(5, Math.min(30, Math.ceil((args.topK ?? 5) * 4)));

    const includeTranscriptMemory = args.includeTranscriptMemory !== false;
    const weights: WeightedScores = {
      alphaVector: clampWeight(args.alphaVector, 0.62),
      alphaKeyword: clampWeight(args.alphaKeyword, 0.38),
      alphaMemory: clampWeight(args.alphaMemory, 0.2),
    };

    const [
      vectorDocs,
      keywordDocs,
      vectorMemory,
      keywordMemory,
      threshold,
    ] = await Promise.all([
      ctx.runQuery(internal.knowledge.searchKnowledgeVectorRecords, {
        embedding: queryEmbedding,
        appSlug: args.appSlug,
        category: args.category,
        limit,
      }),
      ctx.runQuery(internal.knowledge.searchKnowledgeKeywordRecords, {
        query: args.query,
        appSlug: args.appSlug,
        category: args.category,
        limit,
      }),
      includeTranscriptMemory
        ? ctx.runQuery(internal.knowledge.searchTranscriptMemoryVectorRecords, {
            embedding: queryEmbedding,
            appSlug: args.appSlug,
            limit,
          })
        : Promise.resolve([]),
      includeTranscriptMemory
        ? ctx.runQuery(internal.knowledge.searchTranscriptMemoryKeywordRecords, {
            query: args.query,
            appSlug: args.appSlug,
            limit,
          })
        : Promise.resolve([]),
      ctx.runQuery(internal.knowledge.getAppKnowledgeThresholdRecord, {
        appSlug: args.appSlug,
      }),
    ]);

    const merged = new Map<string, SearchCandidate>();
    mergeSignal(merged, vectorDocs, "vector");
    mergeSignal(merged, keywordDocs, "keyword");
    mergeSignal(merged, vectorMemory, "vector");
    mergeSignal(merged, keywordMemory, "keyword");

    const ranked = rankCandidates(Array.from(merged.values()), weights);
    const results = ranked.slice(0, args.topK).map((item) => ({
      _id: item._id,
      title: item.title,
      content: item.content,
      category: item.category,
      sourceType: item.sourceType,
      sourceSessionId: item.sourceSessionId,
      score: item.fusedScore,
    }));

    const topScore = results[0]?.score ?? 0;
    const gapDetected = results.length === 0 || topScore < threshold;

    await ctx.runMutation(internal.knowledge.logKnowledgeSearchRecord, {
      appSlug: args.appSlug,
      sessionId: args.sessionId ?? "search-api",
      query: args.query,
      topScore,
      resultCount: results.length,
      gapDetected,
      traceId: args.traceId,
    });

    if (gapDetected) {
      await ctx.runMutation(internal.knowledge.logKnowledgeGapRecord, {
        appSlug: args.appSlug,
        sessionId: args.sessionId ?? "search-api",
        query: args.query,
        bestMatchScore: topScore,
      });
    }

    return results;
  },
});
