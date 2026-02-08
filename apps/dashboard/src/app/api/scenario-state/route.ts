import { NextResponse } from 'next/server';
import { getServerEnv } from '../../../server/env';

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
  target.searchParams.set('appSlug', appSlug);
  target.searchParams.set('appSecret', appSecret);

  const res = await fetch(target.toString());
  const data = await res.json();
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

  const body = await request.json();
  const appSlug = body.appSlug;
  if (!appSlug) {
    return NextResponse.json({ error: 'appSlug required' }, { status: 400 });
  }

  const res = await fetch(`${convexUrl}/api/scenario-state/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appSlug, appSecret }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
