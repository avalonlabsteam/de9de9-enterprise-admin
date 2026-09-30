import { toast } from 'sonner';
import type { NavigateFunction } from 'react-router-dom';
import type { Alerte } from '../schemas/alertes';
import { alertesActions } from '../stores/alertesStore';
import { AlerteToast, AlertesSummaryToast } from '../components/AlerteToast';
import { isSameScreen, toastDuration } from './alertes';
import { openAlerte, refreshScreen } from './actions';

// When a live alert toasts (guide 11 §7.1, 11a §4.3). The Toaster keeps at
// most three on screen; beyond three in five seconds they fold into one
// « {n} nouvelles alertes » that opens the drawer.

const BURST_WINDOW_MS = 5_000;
const BURST_LIMIT = 3;
const BURST_ID = 'alertes-burst';
const SUMMARY_ID = 'alertes-summary';

/** Alerts toasted in the current window, by toast id (= alert id). */
let recent: { at: number; id: string }[] = [];

export interface ToastContext {
  pathname: string;
  drawerOpen: boolean;
  navigate: NavigateFunction;
}

function showSummary(id: string, n: number): void {
  toast.custom(
    (tid) => (
      <AlertesSummaryToast
        n={n}
        onOpen={() => {
          toast.dismiss(tid);
          alertesActions.setDrawerOpen(true);
        }}
        onClose={() => toast.dismiss(tid)}
      />
    ),
    { id, duration: 8_000 },
  );
}

/** A new live `alerte` (already deduped by id). */
export function notifyAlerte(a: Alerte, ctx: ToastContext): void {
  // The console already shows what it is about: refresh that screen instead.
  if (isSameScreen(a, ctx.pathname)) {
    refreshScreen();
    return;
  }
  // The drawer lists it already; an `info` row does not need to interrupt.
  if (a.ton === 'info' && ctx.drawerOpen) return;

  const now = Date.now();
  recent = recent.filter((r) => now - r.at < BURST_WINDOW_MS);
  recent.push({ at: now, id: a.id });
  if (recent.length > BURST_LIMIT) {
    for (const r of recent) toast.dismiss(r.id);
    showSummary(BURST_ID, recent.length);
    return;
  }

  toast.custom(
    (tid) => (
      <AlerteToast
        alerte={a}
        onOpen={() => {
          toast.dismiss(tid);
          openAlerte(a, ctx.navigate);
        }}
        onClose={() => toast.dismiss(tid)}
      />
    ),
    { id: a.id, duration: toastDuration(a.ton) },
  );
}

/** A catch-up brought rows the console missed: one summary, never one toast each. */
export function notifyCaughtUp(n: number): void {
  if (n > 0) showSummary(SUMMARY_ID, n);
}
