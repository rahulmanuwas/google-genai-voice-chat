"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

/** Generate embedding for text */
async function generateEmbedding(ai: GoogleGenAI, text: string): Promise<number[]> {
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
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/** Summarize a conversation transcript in 1 sentence */
async function summarizeTranscript(ai: GoogleGenAI, transcript: string): Promise<string> {
  // Truncate to 3000 chars to stay within limits
  const trimmed = transcript.slice(0, 3000);
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Summarize this voice conversation transcript in exactly one sentence. Strip any PII (names, phone numbers, emails). Focus on the topic and intent.\n\nTranscript:\n${trimmed}`,
  });
  return result.text?.trim() ?? "Unable to summarize";
}

interface ConversationSummary {
  sessionId: string;
  summary: string;
  embedding: number[];
}

interface Cluster {
  members: ConversationSummary[];
  label?: string;
}

/** Greedy clustering by cosine similarity */
function greedyCluster(items: ConversationSummary[], threshold: number): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;

    const cluster: Cluster = { members: [items[i]] };
    assigned.add(i);

    for (let j = i + 1; j < items.length; j++) {
      if (assigned.has(j)) continue;
      const sim = cosineSimilarity(items[i].embedding, items[j].embedding);
      if (sim >= threshold) {
        cluster.members.push(items[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/** Label a cluster using Gemini */
async function labelCluster(ai: GoogleGenAI, summaries: string[]): Promise<string> {
  const joined = summaries.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join("\n");
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `These conversation summaries belong to the same topic cluster. Provide a short label (2-5 words) for the common topic:\n\n${joined}`,
  });
  return result.text?.trim() ?? "Unknown Topic";
}

/** Cluster conversations and store as insight topics */
export const clusterConversationsAction = internalAction({
  args: {
    appSlug: v.string(),
    maxConversations: v.optional(v.float64()),
    similarityThreshold: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const ai = getGenAI();
    const maxConversations = args.maxConversations ?? 100;
    const similarityThreshold = args.similarityThreshold ?? 0.8;

    // 1. Fetch recent conversations with transcripts
    const conversations = await ctx.runQuery(
      internal.analyticsClusterRecords.getRecentConversationTranscriptRecords,
      { appSlug: args.appSlug, maxConversations },
    );

    if (conversations.length === 0) {
      return { clusters: [], message: "No conversations with transcripts found" };
    }

    // 2. Summarize each conversation and generate embeddings
    const summaries: ConversationSummary[] = [];
    for (const conv of conversations) {
      try {
        const summary = await summarizeTranscript(ai, conv.transcript);
        const embedding = await generateEmbedding(ai, summary);
        summaries.push({ sessionId: conv.sessionId, summary, embedding });
      } catch (err) {
        console.warn(`[cluster] Failed to process conversation ${conv.sessionId}:`, err);
      }
    }

    if (summaries.length === 0) {
      return { clusters: [], message: "Failed to process any conversations" };
    }

    // 3. Greedy clustering
    const clusters = greedyCluster(summaries, similarityThreshold);

    // 4. Label clusters with >1 member
    const labeledClusters: Array<{ label: string; count: number; summaries: string[] }> = [];
    for (const cluster of clusters) {
      if (cluster.members.length <= 1) continue;
      try {
        const label = await labelCluster(ai, cluster.members.map((m) => m.summary));
        labeledClusters.push({
          label,
          count: cluster.members.length,
          summaries: cluster.members.map((m) => m.summary),
        });
      } catch (err) {
        console.warn("[cluster] Failed to label cluster:", err);
        labeledClusters.push({
          label: "Unlabeled Topic",
          count: cluster.members.length,
          summaries: cluster.members.map((m) => m.summary),
        });
      }
    }

    // Sort by count descending and take top 15
    labeledClusters.sort((a, b) => b.count - a.count);
    const topClusters = labeledClusters.slice(0, 15);

    // 5. Store as topTopics in today's insight
    const today = new Date().toISOString().split("T")[0];
    const topTopics = topClusters.map((c) => ({ topic: c.label, count: c.count }));
    await ctx.runMutation(internal.analyticsClusterRecords.updateTopTopicsRecord, {
      appSlug: args.appSlug,
      period: today,
      topTopics: JSON.stringify(topTopics),
    });

    return {
      clusters: topClusters.map((c) => ({ label: c.label, count: c.count })),
      totalConversations: conversations.length,
      totalClusters: clusters.length,
      labeledClusters: topClusters.length,
    };
  },
});
