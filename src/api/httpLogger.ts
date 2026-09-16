// Browser-console HTTP logging for the axios clients: one collapsed group per
// request with the endpoint, final request headers/params/body and the
// response (mock-served requests included — the interceptors wrap the adapter).
// Enabled in dev unless VITE_HTTP_LOG=false; VITE_HTTP_LOG=true force-enables
// it in a production build.
import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const enabled =
  import.meta.env.VITE_HTTP_LOG === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_HTTP_LOG !== 'false');

const startedAt = new WeakMap<InternalAxiosRequestConfig, number>();

/** Keys whose values must never reach the console. */
const SENSITIVE = /password|token|secret|authorization/i;

/** Recursively masks sensitive values (headers, bodies, responses). */
function mask(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE.test(k) && v != null ? '***' : mask(v),
      ]),
    );
  }
  return value;
}

/**
 * Axios serializes JSON bodies to strings before the adapter — parse back for
 * display. Multipart bodies list their parts instead (a FormData has no
 * enumerable keys, so `mask` would reduce it to {}): string parts are parsed
 * like any body, files become name / type / size, repeated names an array.
 */
function parseBody(data: unknown): unknown {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const parts: Record<string, unknown[]> = {};
    data.forEach((value, key) => {
      (parts[key] ??= []).push(
        typeof value === 'string' ? parseBody(value) : { file: value.name, type: value.type, bytes: value.size },
      );
    });
    return Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length === 1 ? v[0] : v]));
  }
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// ---- file sink (dev server only — see the http-log-sink plugin in vite.config.ts) ----

/** Cap huge payloads so logs/http-<date>.log stays greppable. */
const MAX_FIELD_CHARS = 20_000;
function capped(value: unknown): unknown {
  try {
    const s = JSON.stringify(value);
    if (s === undefined || s.length <= MAX_FIELD_CHARS) return value;
    return { truncated: true, chars: s.length, preview: s.slice(0, MAX_FIELD_CHARS) };
  } catch {
    return String(value);
  }
}

const fileSink = enabled && import.meta.env.DEV;

/** Fire-and-forget append to the dev server's log file — must never break the app. */
function persist(entry: Record<string, unknown>): void {
  if (!fileSink) return;
  try {
    void fetch('/__http-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* no sink available (tests, prod preview) — console logging still works */
  }
}

function log(config: InternalAxiosRequestConfig, response?: AxiosResponse, error?: AxiosError): void {
  const method = (config.method ?? 'get').toUpperCase();
  const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
  const start = startedAt.get(config);
  const ms = start === undefined ? '' : ` · ${Math.round(performance.now() - start)}ms`;
  const status: number | string = response?.status ?? error?.response?.status ?? 'network error';
  const ok = typeof status === 'number' && status < 400;
  console.groupCollapsed(
    `%c⇄ ${method} ${url} → ${status}${ms}`,
    `color:${ok ? '#2FA86A' : '#E7464E'};font-weight:bold`,
  );
  console.log('headers:', mask(config.headers.toJSON()));
  if (config.params !== undefined) console.log('params:', mask(config.params));
  if (config.data !== undefined) console.log('body:', mask(parseBody(config.data)));
  if (response) console.log('response:', mask(response.data));
  else if (error) console.log('error:', mask(error.response?.data) ?? error.message);
  console.groupEnd();

  persist({
    ts: new Date().toISOString(),
    method,
    url,
    status,
    durationMs: start === undefined ? null : Math.round(performance.now() - start),
    headers: mask(config.headers.toJSON()),
    ...(config.params !== undefined ? { params: mask(config.params) } : {}),
    ...(config.data !== undefined ? { body: mask(parseBody(config.data)) } : {}),
    ...(response ? { response: capped(mask(response.data)) } : {}),
    ...(error ? { error: capped(mask(error.response?.data) ?? error.message) } : {}),
  });
}

/**
 * Wires request/response logging onto an axios instance (no-op when disabled).
 * Call it right after `axios.create`, before other interceptors: its response
 * interceptor then runs first, so e.g. a 401 is logged as received, before the
 * refresh interceptor retries (the retry is logged as its own request).
 */
export function attachHttpLogger(instance: AxiosInstance): void {
  if (!enabled) return;
  instance.interceptors.request.use((config) => {
    startedAt.set(config, performance.now());
    return config;
  });
  instance.interceptors.response.use(
    (response) => {
      log(response.config, response);
      return response;
    },
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.config) log(error.config, undefined, error);
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    },
  );
}
