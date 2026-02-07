/**
 * Reads a server-side env var from process.env.
 * Next.js automatically loads apps/demo/.env.local — no root .env fallback needed.
 */
export function getServerEnv(name: string): string | undefined {
  return process.env[name];
}
