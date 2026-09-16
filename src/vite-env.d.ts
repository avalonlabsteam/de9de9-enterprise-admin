/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the mocked business API. Defaults to `/api`. */
  readonly VITE_API_URL?: string;
  /** Set to the string `'false'` to bypass the in-memory mock backend. */
  readonly VITE_API_MOCK?: string;
  /** Base URL of the real auth API, including the version segment. */
  readonly VITE_AUTH_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
