// The sound of a live alert: two short knocks, generated in the browser — no
// audio file to ship or to license (a chat app's own notification sound is its
// publisher's recording). To use a recording instead, replace `knocks` with an
// <audio> element's `play()`: everything around it stays.
//
// Browsers keep a page silent until the user has touched it. The audio context
// is therefore opened on the first click or key press (`armAlerteSon`), and an
// alert that arrives before that makes no sound.
import { useAlerteSonStore } from '../stores/sonStore';

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

/** A burst of alerts knocks once. */
const MIN_GAP_MS = 1_500;
/** A context that only wakes later (a gesture long after the alert) must not play a stale knock. */
const WAKE_LIMIT_MS = 1_000;
/**
 * Held by the tab that knocks, for as long as a burst lasts: the console's
 * other tabs receive the same alert at the same instant and stay quiet. A lock
 * rather than a shared storage key — two tabs reading a key at once both find
 * it free.
 */
const LOCK_NAME = 'de9de9-alertes-son';

/** One knock: a sine that drops in pitch under a few milliseconds of attack, with a quieter overtone for the wood. */
function knock(ac: BaseAudioContext, out: AudioNode, at: number, freq: number, peak: number): void {
  for (const [ratio, level, length] of [
    [1, 1, 0.16],
    [2.6, 0.3, 0.06],
  ] as const) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ratio, at);
    osc.frequency.exponentialRampToValueAtTime(freq * ratio * 0.6, at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * level, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }
}

/** « Toc-toc »: the second knock a little higher, 130 ms after the first. Under a third of a second in all. */
export function knocks(ac: BaseAudioContext, at: number = ac.currentTime): void {
  const out = ac.createGain();
  out.gain.value = 0.9;
  out.connect(ac.destination);
  knock(ac, out, at + 0.01, 420, 0.3);
  knock(ac, out, at + 0.14, 540, 0.24);
}

/**
 * Knock for a new alert. `preview`: the speaker button being switched on —
 * played whatever the setting, the last knock and the other tabs.
 */
export function playAlerteSon(preview = false): void {
  if (!preview && !useAlerteSonStore.getState().actif) return;
  const ac = ctx;
  if (!ac) return;
  const now = performance.now();
  if (!preview && now - lastPlayedAt < MIN_GAP_MS) return;

  const knockNow = (): void => {
    lastPlayedAt = performance.now();
    knocks(ac);
  };
  const play = (): void => {
    // A browser without locks: every tab knocks.
    if (preview || !navigator.locks) {
      knockNow();
      return;
    }
    void navigator.locks
      .request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return;
        knockNow();
        await new Promise((done) => setTimeout(done, MIN_GAP_MS));
      })
      .catch(() => undefined);
  };

  if (ac.state === 'running') {
    play();
    return;
  }
  // Put to sleep by the browser (a long idle tab): wake it, and knock only if it wakes at once.
  void ac
    .resume()
    .then(() => {
      if (performance.now() - now < WAKE_LIMIT_MS) play();
    })
    .catch(() => undefined);
}

/**
 * Open the audio context on the user's first gesture, and wake it on a later
 * one if the browser suspended it. Answers the function that removes the
 * listeners.
 */
export function armAlerteSon(): () => void {
  const unlock = (): void => {
    if (!ctx) {
      const Ctor: AudioContextCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) return;
      try {
        ctx = new Ctor();
      } catch {
        return;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}
