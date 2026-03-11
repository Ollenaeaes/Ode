/** Configuration for creating a twin test suite */
export interface TestSuiteConfig {
  /** Human-readable twin name (e.g., "Mercatus Farmer") */
  name: string;
  /** Base URL of the twin service (e.g., "http://localhost:3001") */
  baseUrl: string;
  /** Bearer token to use for authenticated requests */
  token?: string;
  /** Timeout in ms for health check / service discovery (default: 2000) */
  discoveryTimeoutMs?: number;
}

/** Parsed API response returned by TwinClient */
export interface ApiResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Parsed response body (JSON parsed if content-type is JSON, raw text otherwise) */
  body: T;
  /** Response headers */
  headers: Headers;
}

/** Options for a single request made via TwinClient */
export interface RequestOptions {
  /** HTTP method (default: GET) */
  method?: string;
  /** Request body — will be JSON.stringify'd automatically */
  body?: unknown;
  /** Additional headers (merged with defaults) */
  headers?: Record<string, string>;
  /** Override the default Bearer token for this request */
  token?: string | null;
}

/** Thin fetch wrapper pre-configured for a specific twin */
export interface TwinClient {
  /** Make a request to the twin API */
  request<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  /** Convenience: GET request */
  get<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;
  /** Convenience: POST request */
  post<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;
  /** Convenience: PUT request */
  put<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;
  /** Convenience: DELETE request */
  delete<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;
  /** Reset twin to initial seeded state via POST /admin/reset */
  reset(): Promise<ApiResponse>;
  /** Advance twin's internal clock via POST /admin/time/advance?hours=N */
  advanceTime(hours: number): Promise<ApiResponse>;
}
