/**
 * Brand voice and persona types.
 *
 * Every Sierra customer has a named, branded AI persona.
 * This system goes beyond systemPrompt to define structured
 * personality, tone, and language guidelines.
 */

/** Tone presets */
export type PersonaTone =
  | 'formal'
  | 'casual'
  | 'empathetic'
  | 'professional'
  | 'playful'
  | 'authoritative';

/** Persona definition */
export interface PersonaConfig {
  /** Display name (e.g. "Luna", "Madi", "Sunny") */
  name: string;

  /** Greeting message (e.g. "Hello Beautiful!" for Madison Reed) */
  greeting: string;

  /** Personality traits (e.g. ["warm", "knowledgeable", "patient"]) */
  personality: string[];

  /** Primary tone */
  tone: PersonaTone;

  /** Language rules */
  language: {
    /** Terms to prefer (e.g. { "Points": "budget" } for WeightWatchers) */
    preferredTerms: Record<string, string>;
    /** Terms to never use */
    avoidTerms: string[];
    /** How much domain jargon to use */
    jargonLevel: 'none' | 'moderate' | 'expert';
  };

  /** How the AI says "let me get a human" */
  escalationPhrase: string;

  /** How the AI signs off */
  closingPhrase: string;
}
