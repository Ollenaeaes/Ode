import type { ApiResponse, RequestOptions, TwinClient } from './types.js';

/**
 * Create an API client pre-configured for a specific twin.
 *
 * Uses Node 18+ built-in fetch — no external HTTP libraries.
 */
export function createTwinClient(baseUrl: string, defaultToken?: string): TwinClient {
  async function request<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers: extraHeaders = {}, token } = options;

    // Determine which token to use: explicit per-request > default > none
    const effectiveToken = token === null ? undefined : (token ?? defaultToken);

    const headers: Record<string, string> = {
      ...extraHeaders,
    };

    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const url = `${baseUrl}${path}`;

    const resp = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Parse body: try JSON first, fall back to text
    let parsedBody: T;
    const contentType = resp.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      parsedBody = (await resp.json()) as T;
    } else {
      // Non-JSON response — return raw text as the body
      parsedBody = (await resp.text()) as unknown as T;
    }

    return {
      status: resp.status,
      body: parsedBody,
      headers: resp.headers,
    };
  }

  return {
    request,

    get<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, { ...options, method: 'GET' });
    },

    post<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, { ...options, method: 'POST', body });
    },

    put<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, { ...options, method: 'PUT', body });
    },

    delete<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, { ...options, method: 'DELETE' });
    },

    reset() {
      return request('/admin/reset', { method: 'POST' });
    },

    advanceTime(hours: number) {
      return request(`/admin/time/advance?hours=${hours}`, { method: 'POST' });
    },
  };
}
