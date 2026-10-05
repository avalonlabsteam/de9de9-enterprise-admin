import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { refreshSession } from '@/features/auth/api/auth';
import { isSessionValid, useAuthStore } from '@/stores/authStore';
import { fetchAlertesPage, fetchCompteurs, reloadAlertesFeed, ALERTES_PAGE_SIZE } from '../api/alertes';
import { alerteCompteursSchema, alerteSchema, fileSignalSchema } from '../schemas/alertes';
import { alertesActions, useAlertesStore } from '../stores/alertesStore';
import { invalidateForAlerte, invalidateQueue } from './actions';
import { notifyAlerte, notifyCaughtUp } from './toasts';

// One hub connection for the whole console (guide 11 §4, 11a §3), mounted in
// AppLayout: it lives exactly as long as the signed-in shell. Same-origin
// `/hubs/notifications` — nginx proxies it as WebSocket in production, the
// Vite dev server in development. The hub is one-way: reading, filtering and
// marking read stay on REST.

const HUB_URL = import.meta.env.VITE_HUB_URL || '/hubs/notifications';
const RESTART_DELAY_MS = 5_000;
/** Absorbs rows that committed slightly after a later one (guide 11 §5). */
const CATCH_UP_OVERLAP_MS = 120_000;

/**
 * The CURRENT access token on every call — the socket dies with its token, and
 * the restart must carry the refreshed one. Throws when the session is gone.
 */
async function currentToken(): Promise<string> {
  const s = useAuthStore.getState();
  if (s.accessToken && isSessionValid(s)) return s.accessToken;
  return refreshSession();
}

/**
 * Read what was missed over REST (guide 11 §5) — at start and after every
 * reconnect. Nothing is queued server-side for an offline console. Rows found
 * this way never toast one by one: at most one summary.
 */
async function catchUp(): Promise<void> {
  const newest = alertesActions.newestAt();
  if (newest === null) {
    alertesActions.replace((await fetchAlertesPage({ page: 1, pageSize: ALERTES_PAGE_SIZE })).data);
  } else {
    const depuis = new Date(newest - CATCH_UP_OVERLAP_MS).toISOString();
    const missed = await fetchAlertesPage({ depuis, pageSize: 200 });
    if (missed.meta.has_more_pages) {
      // Away too long: start over from the first page.
      alertesActions.replace((await fetchAlertesPage({ page: 1, pageSize: ALERTES_PAGE_SIZE })).data);
      reloadAlertesFeed();
    } else {
      notifyCaughtUp(alertesActions.merge(missed.data).length);
    }
  }
  alertesActions.setCompteurs(await fetchCompteurs());
}

let catchUpInFlight: Promise<void> | null = null;

/** Single-flight: a reconnect during the start's catch-up reuses it. Failures stay quiet — the next reconnect retries. */
function catchUpOnce(): Promise<void> {
  catchUpInFlight ??= catchUp()
    .catch(() => undefined)
    .finally(() => {
      catchUpInFlight = null;
    });
  return catchUpInFlight;
}

export function useAlertesHub(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Handlers are bound once per connection; they read the latest route here.
  const route = useRef({ navigate, pathname });
  useEffect(() => {
    route.current = { navigate, pathname };
  });

  useEffect(() => {
    let active = true;
    let caughtUp = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hub = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: currentToken })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    hub.on('alerte', (raw: unknown) => {
      const parsed = alerteSchema.safeParse(raw);
      if (!parsed.success) return;
      if (alertesActions.add(parsed.data)) {
        invalidateForAlerte(parsed.data);
        notifyAlerte(parsed.data, { ...route.current, drawerOpen: useAlertesStore.getState().drawerOpen });
      }
    });

    hub.on('compteurs', (raw: unknown) => {
      const parsed = alerteCompteursSchema.safeParse(raw);
      if (!parsed.success) return;
      alertesActions.setCompteurs(parsed.data);
      // Another admin read rows this console still shows unread; rows are not
      // pushed again, so reload the open drawer's pages (guide 11 §6.3).
      if (useAlertesStore.getState().drawerOpen && parsed.data.nonLues < alertesActions.unreadHeld()) {
        reloadAlertesFeed();
      }
    });

    hub.on('file', (raw: unknown) => {
      const parsed = fileSignalSchema.safeParse(raw);
      if (parsed.success) invalidateQueue(parsed.data);
    });

    // Legacy events still arrive on the admins group: ignored (registered so
    // the client does not warn about them).
    for (const legacy of ['ReceiveNotification', 'AdminSignal', 'BadgeCountsUpdated']) hub.on(legacy, () => undefined);

    const start = async (): Promise<void> => {
      if (!active || hub.state !== HubConnectionState.Disconnected) return;
      try {
        await hub.start();
      } catch {
        if (!active) return;
        // No socket yet: the bell still fills from REST.
        if (!caughtUp) {
          caughtUp = true;
          void catchUpOnce();
        }
        timer = setTimeout(() => void start(), RESTART_DELAY_MS);
        return;
      }
      if (!active) return;
      caughtUp = true;
      await catchUpOnce();
    };

    hub.onreconnected(() => void catchUpOnce());
    // Token expired (the server closes the socket) or the retries ran out:
    // start again — `currentToken` refreshes first.
    hub.onclose(() => {
      if (!active) return;
      timer = setTimeout(() => void start(), 1_000);
    });

    // Next tick: a mount discarded at once (StrictMode's dev double-mount)
    // never opens a connection it would stop mid-negotiation.
    timer = setTimeout(() => void start(), 0);

    return () => {
      active = false;
      clearTimeout(timer);
      void hub.stop();
      // Signed out (or another admin signs in next): never keep the old rows.
      alertesActions.clear();
    };
  }, []);
}
