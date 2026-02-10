import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../server/env';

export async function POST(request: Request) {
  const convexUrl = getServerEnv('NEXT_PUBLIC_CONVEX_URL');
  const defaultSlug = getServerEnv('NEXT_PUBLIC_APP_SLUG') ?? 'demo';
  const appSecret = getServerEnv('APP_SECRET');

  if (!convexUrl || !appSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing NEXT_PUBLIC_CONVEX_URL or APP_SECRET' },
      { status: 500 },
    );
  }

  // Allow callers to specify an appSlug; fall back to env default
  let appSlug = defaultSlug;
  try {
    const body = await request.json();
    if (typeof body.appSlug === 'string' && body.appSlug) {
      appSlug = body.appSlug;
    }
  } catch {
    // No body or invalid JSON — use default slug
  }

  const res = await fetch(`${convexUrl}/api/auth/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Avoid putting app secrets in bodies/URLs where possible.
      Authorization: `Bearer ${appSecret}`,
      'X-App-Slug': appSlug,
    },
    // Backwards compatible: send appSlug + appSecret in body too for
    // deployments that don't yet parse Authorization/X-App-Slug headers.
    body: JSON.stringify({ appSlug, appSecret }),
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
