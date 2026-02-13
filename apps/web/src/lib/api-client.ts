const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';

interface ApiClientOptions {
  getSessionToken: () => string | null;
  onUnauthorized?: () => Promise<string | null>;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export class ApiClient {
  private getSessionToken: () => string | null;
  private onUnauthorized?: () => Promise<string | null>;

  constructor(options: ApiClientOptions) {
    this.getSessionToken = options.getSessionToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    hasRetried = false,
  ): Promise<T> {
    if (!CONVEX_URL) {
      throw new Error('Missing NEXT_PUBLIC_CONVEX_URL');
    }

    const sessionToken = this.getSessionToken();
    if (!sessionToken) {
      throw new UnauthorizedError();
    }

    const url = new URL(path, CONVEX_URL);
    // Use query-param auth for GET (avoids CORS preflight) and body auth for
    // POST/PATCH. Will switch to header-based auth once the backend CORS
    // allowlist is deployed.
    if (method === 'GET') {
      url.searchParams.set('sessionToken', sessionToken);
    }

    const headers: Record<string, string> = {};

    const res = await fetch(url.toString(), {
      method,
      headers: method !== 'GET'
        ? { ...headers, 'Content-Type': 'application/json' }
        : headers,
      body: method !== 'GET'
        ? JSON.stringify({ ...body, sessionToken })
        : undefined,
    });

    if (res.status === 401) {
      if (!hasRetried && this.onUnauthorized) {
        const refreshedToken = await this.onUnauthorized();
        if (refreshedToken) {
          return this.request<T>(method, path, body, true);
        }
      }
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

  delete<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
