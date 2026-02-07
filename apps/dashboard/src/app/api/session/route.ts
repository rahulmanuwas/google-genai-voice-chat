import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../server/env';

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
    headers: { 'Content-Type': 'application/json' },
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
