import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../server/env';

async function parseJsonSafe(res: Response) {
  return res.json().catch(() => ({ error: 'Invalid response from backend' }));
}

export async function GET(request: Request) {
  const convexUrl = getServerEnv('NEXT_PUBLIC_CONVEX_URL');
  const appSecret = getServerEnv('APP_SECRET');

  if (!convexUrl || !appSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const appSlug = url.searchParams.get('appSlug');
  if (!appSlug) {
    return NextResponse.json({ error: 'appSlug required' }, { status: 400 });
  }

  const target = new URL('/api/scenario-state', convexUrl);
  // Avoid putting app secrets in query strings.
  const res = await fetch(target.toString(), {
    headers: {
      Authorization: `Bearer ${appSecret}`,
      'X-App-Slug': appSlug,
    },
  });
  const data = await parseJsonSafe(res);
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const convexUrl = getServerEnv('NEXT_PUBLIC_CONVEX_URL');
  const appSecret = getServerEnv('APP_SECRET');

  if (!convexUrl || !appSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const appSlug = body && typeof body === 'object' && typeof (body as { appSlug?: unknown }).appSlug === 'string'
    ? (body as { appSlug: string }).appSlug
    : '';
  if (!appSlug) {
    return NextResponse.json({ error: 'appSlug required' }, { status: 400 });
  }

  const res = await fetch(`${convexUrl}/api/scenario-state/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appSecret}`,
      'X-App-Slug': appSlug,
    },
    // Backwards compatible for deployments still reading body auth fields.
    body: JSON.stringify({ appSlug, appSecret }),
  });

  const data = await parseJsonSafe(res);
  return NextResponse.json(data, { status: res.status });
}
