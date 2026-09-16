import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios, { AxiosError } from 'axios';

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

// ---- passthrough: endpoints already integrated with the real API ----
const passthroughRoutes: {
  method: MockMethod;
  segments: string[];
  when?: (pathParams: Record<string, string>) => boolean;
}[] = [];

/**
 * Send matching requests to the real network instead of the mock, even while
 * VITE_API_MOCK is on. Registered per endpoint as the backend integration
 * lands; once everything is real, set VITE_API_MOCK=false and delete the mock.
 * `:param` segments are supported like in `register`; `when` narrows the match
 * by their values — e.g. only real UUIDs go to the network while mock ids
 * (C-2041) on the same route stay mocked.
 */
export function passthrough(
  method: MockMethod,
  pattern: string,
  when?: (pathParams: Record<string, string>) => boolean,
): void {
  passthroughRoutes.push({ method, segments: pattern.split('/').filter(Boolean), ...(when ? { when } : {}) });
}

/** `:param` values of `parts` under `segments` (callers check the match first). */
function paramsOf(segments: string[], parts: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  segments.forEach((seg, i) => {
    const part = parts[i];
    if (seg.startsWith(':') && part !== undefined) params[seg.slice(1)] = decodeURIComponent(part);
  });
  return params;
}

/**
 * Number of literal (non-`:param`) segments matched, or null when the pattern
 * doesn't match at all — a specificity score: `/commandes/worklist` scores 2,
 * `/commandes/:id` scores 1 on the same path.
 */
function matchSpecificity(segments: string[], parts: string[]): number | null {
  if (segments.length !== parts.length) return null;
  let literals = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === undefined) return null;
    if (seg.startsWith(':')) continue;
    if (seg !== parts[i]) return null;
    literals++;
  }
  return literals;
}

/**
 * A more specific mock route wins over a wildcard passthrough; on equal
 * specificity the passthrough wins. So `passthrough('GET', '/commandes/:id')`
 * does not swallow the mock worklist route, and commenting a passthrough line
 * out really does fall back to its mock.
 */
function isPassthrough(method: MockMethod, path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  let best: number | null = null;
  for (const r of passthroughRoutes) {
    if (r.method !== method) continue;
    const score = matchSpecificity(r.segments, parts);
    if (score === null || (r.when && !r.when(paramsOf(r.segments, parts)))) continue;
    if (best === null || score > best) best = score;
  }
  if (best === null) return false;
  const passthroughScore = best;
  return !routes.some((r) => {
    if (r.method !== method) return false;
    const score = matchSpecificity(r.segments, parts);
    return score !== null && score > passthroughScore;
  });
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
  const method = (config.method ?? 'get').toUpperCase() as MockMethod;
  const raw = `${config.baseURL ?? ''}${config.url ?? ''}`;
  const url = new URL(raw, 'http://mock.local');
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '');

  // Integrated endpoints skip the mock and hit the real API (through the
  // /api dev proxy), with the request untouched — headers, params and the
  // response interceptors all behave exactly as with the mock off.
  if (isPassthrough(method, path)) {
    return axios.getAdapter(axios.defaults.adapter)(config);
  }

  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

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
