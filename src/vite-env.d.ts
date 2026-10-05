/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the mocked business API. Defaults to `/api`. */
  readonly VITE_API_URL?: string;
  /** Set to the string `'false'` to bypass the in-memory mock backend. */
  readonly VITE_API_MOCK?: string;
  /** Base URL of the real auth API, including the version segment. */
  readonly VITE_AUTH_API_URL?: string;
  /** Alerts hub. Defaults to same-origin `/hubs/notifications` (proxied like /api). */
  readonly VITE_HUB_URL?: string;
  /**
   * Host of the de9de9 app's media: a pro's `photoUrl` that is a path is read
   * from there. Unset, such a photo falls back to the initials.
   */
  readonly VITE_DE9DE9_MEDIA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
