const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';

export class ApiClient {
  constructor(private sessionToken: string) {}

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(path, CONVEX_URL);
    if (method === 'GET') {
      url.searchParams.set('sessionToken', this.sessionToken);
    }

    const res = await fetch(url.toString(), {
      method,
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
      body: method !== 'GET'
        ? JSON.stringify({ ...body, sessionToken: this.sessionToken })
        : undefined,
    });

    if (res.status === 401) {
      throw new UnauthorizedError();
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
