import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../server/env';

/**
 * POST /api/session — Server-side proxy that exchanges appSecret
 * (kept in server env) for a short-lived session token.
 *
 * The browser never sees APP_SECRET.
 */
export async function POST() {
  const convexUrl = getServerEnv('NEXT_PUBLIC_CONVEX_URL');
  const appSlug = getServerEnv('NEXT_PUBLIC_APP_SLUG') ?? 'demo';
  const appSecret = getServerEnv('APP_SECRET');

  if (!convexUrl || !appSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing NEXT_PUBLIC_CONVEX_URL or APP_SECRET' },
      { status: 500 },
    );
  }

  const res = await fetch(`${convexUrl}/api/auth/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Avoid putting app secrets in bodies/URLs where possible.
      Authorization: `Bearer ${appSecret}`,
      'X-App-Slug': appSlug,
    },
    // Backwards compatible: Convex accepts appSlug in body; appSecret is in header.
    body: JSON.stringify({ appSlug }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    return NextResponse.json(
      { error: err.error ?? 'Failed to create session' },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
