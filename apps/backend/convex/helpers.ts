import { internal } from "./_generated/api";

/** Shared CORS + JSON response headers */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  // Keep permissive for now (will be locked down in a follow-up PR).
  // Needed for header-based auth (Authorization + X-App-Slug).
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Slug, X-Trace-Id",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export interface AuthCredentials {
  appSlug?: string;
  appSecret?: string;
  sessionToken?: string;
  /**
   * Header auth: Authorization: Bearer <token>.
   * Token can be either a sessionToken or an appSecret.
   */
  bearerToken?: string;
  /**
   * When bearerToken is an appSecret, the app slug must also be provided.
   * Accept via X-App-Slug header (preferred) or fallback to query/body appSlug.
   */
  bearerAppSlug?: string;
}

export interface AuthResult {
  app: {
    _id: string;
    slug: string;
    secret: string;
    isActive: boolean;
    [key: string]: unknown;
  };
  authMethod: "appSecret" | "sessionToken";
}

/**
 * Authenticate a request using either appSecret (server-to-server)
 * or sessionToken (browser-safe). Returns null if unauthorized.
 */
export async function authenticateRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { runQuery: (...args: any[]) => any },
  creds: AuthCredentials,
): Promise<AuthResult | null> {
  const trySessionToken = async (token: string): Promise<AuthResult | null> => {
    const session = await ctx.runQuery(internal.sessionsDb.getSessionByToken, { token });
    if (!session) return null;

    const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: session.appSlug });
    if (!app || !app.isActive) return null;

    return { app, authMethod: "sessionToken" };
  };

  const tryAppSecret = async (appSlug: string | undefined, appSecret: string): Promise<AuthResult | null> => {
    if (!appSlug) return null;
    const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
    if (!app || app.secret !== appSecret || !app.isActive) return null;
    return { app, authMethod: "appSecret" };
  };

  // Path 0: Authorization header (Bearer sessionToken OR appSecret)
  if (creds.bearerToken) {
    const fromSession = await trySessionToken(creds.bearerToken);
    if (fromSession) return fromSession;

    // Bearer token wasn't a session token; treat as app secret.
    const slug = creds.bearerAppSlug ?? creds.appSlug;
    const fromSecret = await tryAppSecret(slug, creds.bearerToken);
    if (fromSecret) return fromSecret;
    return null;
  }

  // Path A: Session token (query/body)
  if (creds.sessionToken) {
    const fromSession = await trySessionToken(creds.sessionToken);
    if (fromSession) return fromSession;
    // Fall through to app secret if provided (helps with mixed clients).
  }

  // Path B: App secret (server-to-server)
  if (creds.appSlug && creds.appSecret) {
    const fromSecret = await tryAppSecret(creds.appSlug, creds.appSecret);
    if (fromSecret) return fromSecret;
  }

  return null;
}

/** Extract trace ID from request header */
export function getTraceId(request: Request): string | undefined {
  return request.headers.get("X-Trace-Id") ?? request.headers.get("x-trace-id") ?? undefined;
}

/**
 * Extract auth credentials from either query params (legacy) or headers (preferred).
 *
 * Header-based auth:
 * - Authorization: Bearer <token> (token is sessionToken OR appSecret)
 * - X-App-Slug: <appSlug> (required when token is an appSecret)
 */
export function getAuthCredentialsFromRequest(request: Request): AuthCredentials {
  const url = new URL(request.url);

  const queryAppSlug = url.searchParams.get("appSlug") ?? undefined;
  const queryAppSecret = url.searchParams.get("appSecret") ?? undefined;
  const querySessionToken = url.searchParams.get("sessionToken") ?? undefined;

  const authHeader = request.headers.get("Authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch?.[1]?.trim() || undefined;

  // Prefer header app slug for bearer appSecret flows; fall back to query param.
  const headerAppSlug =
    request.headers.get("X-App-Slug")
    ?? request.headers.get("x-app-slug")
    ?? undefined;

  return {
    appSlug: headerAppSlug ?? queryAppSlug,
    appSecret: queryAppSecret,
    sessionToken: querySessionToken,
    bearerToken,
    bearerAppSlug: headerAppSlug,
  };
}
