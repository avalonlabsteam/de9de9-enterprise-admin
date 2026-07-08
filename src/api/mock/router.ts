import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';

export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockRequest {
  method: MockMethod;
  path: string;
  /** merged query string + axios `params` */
  query: Record<string, string>;
  /** `:param` segments captured from the route pattern */
  pathParams: Record<string, string>;
  body: unknown;
}

export interface MockResponse {
  status?: number;
  data: unknown;
}

export type MockHandler = (req: MockRequest) => MockResponse | Promise<MockResponse>;

interface MockRoute {
  method: MockMethod;
  segments: string[];
  handler: MockHandler;
}

const routes: MockRoute[] = [];

/** Register a mock route, e.g. `register('POST', '/commandes/:id/actions', handler)`. */
export function register(method: MockMethod, pattern: string, handler: MockHandler): void {
  routes.push({ method, segments: pattern.split('/').filter(Boolean), handler });
}

function matchRoute(method: MockMethod, path: string): { route: MockRoute; pathParams: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== parts.length) continue;
    const pathParams: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const seg = route.segments[i];
      const part = parts[i];
      if (seg === undefined || part === undefined) { ok = false; break; }
      if (seg.startsWith(':')) pathParams[seg.slice(1)] = decodeURIComponent(part);
      else if (seg !== part) { ok = false; break; }
    }
    if (ok) return { route, pathParams };
  }
  return null;
}

const LATENCY_MS = 120;

function buildResponse(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return {
    data,
    status,
    statusText: status < 400 ? 'OK' : 'Error',
    headers: {},
    config,
    request: {},
  };
}

/**
 * Custom Axios adapter serving the in-memory mock backend.
 * Swap to the real network by setting VITE_API_MOCK=false (see apiClient).
 */
export const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

  const method = (config.method ?? 'get').toUpperCase() as MockMethod;
  const raw = `${config.baseURL ?? ''}${config.url ?? ''}`;
  const url = new URL(raw, 'http://mock.local');
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '');

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  if (config.params && typeof config.params === 'object') {
    for (const [key, value] of Object.entries(config.params as Record<string, unknown>)) {
      if (value !== undefined && value !== null) query[key] = String(value);
    }
  }

  let body: unknown = config.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* keep raw string body */
    }
  }

  const matched = matchRoute(method, path);
  if (!matched) {
    throw new AxiosError(
      `Mock route not found: ${method} ${path}`,
      String(404),
      config,
      {},
      buildResponse(config, 404, { message: `Not found: ${method} ${path}` }),
    );
  }

  try {
    const result = await matched.route.handler({
      method,
      path,
      query,
      pathParams: matched.pathParams,
      body,
    });
    const status = result.status ?? 200;
    if (status >= 400) {
      throw new AxiosError(
        `Mock error ${status}`,
        String(status),
        config,
        {},
        buildResponse(config, status, result.data),
      );
    }
    return buildResponse(config, status, result.data);
  } catch (err) {
    if (err instanceof AxiosError) throw err;
    const message = err instanceof Error ? err.message : 'Mock handler failure';
    throw new AxiosError(message, '500', config, {}, buildResponse(config, 500, { message }));
  }
};
