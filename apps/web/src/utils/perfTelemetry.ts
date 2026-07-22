/**
 * Télémétrie DEV-ONLY — le « F12 à distance » pour les tests mobile.
 *
 * Capture et POST vers le dev-server (/__perf, cf. perfPlugin.ts) :
 *  - erreurs JS (window.onerror / unhandledrejection) + console.error/warn ;
 *  - FPS moyen + pire frame, échantillonnés toutes les 2 s via requestAnimationFrame ;
 *  - timings de chargement (navigation start → first sample) ;
 *  - événements de navigation 3D (les CustomEvents overmind:*) comme CONTEXTE ;
 *  - détecteur de MORT : un heartbeat en sessionStorage ; si Safari tue la page (OOM →
 *    reload auto), au boot suivant on retrouve le dernier battement de la session morte
 *    et on le rapporte (`previous-session-died` + dernier contexte connu). C'est ce qui
 *    transforme « ça a crashé quelque part » en « mort à t=42s, point B, tuto affiché ».
 *
 * Importé dynamiquement par main.tsx UNIQUEMENT en dev (import.meta.env.DEV) → le build
 * prod ne contient pas une ligne de ce fichier. Pas de dépendance : fetch/sendBeacon.
 */

interface PerfEvent {
  t: number;                 // ms depuis le boot de la page
  type: string;
  [key: string]: unknown;
}

const FLUSH_MS = 2500;
const SAMPLE_MS = 2000;
const HB_KEY = 'perf-heartbeat';

export function startPerfTelemetry(): void {
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);
  const sessionId = Math.random().toString(36).slice(2, 8);
  let buffer: PerfEvent[] = [];
  let lastContext: Record<string, unknown> = {};

  const push = (type: string, data: Record<string, unknown> = {}) => {
    buffer.push({ t: now(), type, session: sessionId, ...data });
  };

  // ── Détecteur de mort : la session précédente a-t-elle fini proprement ? ──
  try {
    const prev = sessionStorage.getItem(HB_KEY);
    if (prev) {
      // Un heartbeat traîne → la page précédente est morte SANS pagehide (crash/kill).
      push('previous-session-died', { lastHeartbeat: JSON.parse(prev) });
    }
  } catch { /* sessionStorage indispo : tant pis */ }

  // ── Identité de l'appareil (1 fois au boot) ──
  push('boot', {
    ua: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency ?? null,
    // performance.memory n'existe pas sur Safari iOS — présent = Chrome desktop.
    memoryMB: (performance as unknown as { memory?: { jsHeapSizeLimit: number } }).memory
      ? Math.round((performance as unknown as { memory: { jsHeapSizeLimit: number } }).memory.jsHeapSizeLimit / 1048576)
      : null,
  });

  // ── Erreurs & console (ce qu'on verrait en F12) ──
  window.addEventListener('error', (e) => {
    push('error', { message: e.message, source: `${e.filename}:${e.lineno}:${e.colno}` });
  });
  window.addEventListener('unhandledrejection', (e) => {
    push('unhandled-rejection', { reason: String(e.reason).slice(0, 500) });
  });
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      push(`console-${level}`, { message: args.map((a) => String(a)).slice(0, 5).join(' ').slice(0, 500) });
      original(...args);
    };
  }

  // ── Contexte : les événements de navigation 3D existants ──
  const CONTEXT_EVENTS = [
    'overmind:nav-goto', 'overmind:nav-transition', 'overmind:reading-mode',
    'overmind:camera-mode', 'overmind:set-bloom-color', 'overmind:quality-tier',
  ];
  for (const type of CONTEXT_EVENTS) {
    window.addEventListener(type, (e) => {
      const detail = (e as CustomEvent).detail;
      lastContext[type] = detail ?? true;
      push('nav-event', { event: type, detail: typeof detail === 'object' ? JSON.stringify(detail).slice(0, 200) : detail });
    });
  }

  // ── FPS : compter les frames rAF, échantillonner toutes les 2 s ──
  let frames = 0;
  let worstMs = 0;
  let lastFrame = performance.now();
  const onFrame = () => {
    const nowMs = performance.now();
    worstMs = Math.max(worstMs, nowMs - lastFrame);
    lastFrame = nowMs;
    frames++;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  setInterval(() => {
    const fps = Math.round(frames / (SAMPLE_MS / 1000));
    push('fps', { fps, worstFrameMs: Math.round(worstMs) });
    frames = 0;
    worstMs = 0;
    // Heartbeat : le dernier état connu, retrouvé au boot suivant si on meurt ici.
    try {
      sessionStorage.setItem(HB_KEY, JSON.stringify({ t: now(), fps, context: lastContext }));
    } catch { /* ignore */ }
  }, SAMPLE_MS);

  // ── Envoi : flush périodique + au masquage de page (sendBeacon survit à la fermeture) ──
  const flush = (useBeacon = false) => {
    if (!buffer.length) return;
    const body = JSON.stringify(buffer);
    buffer = [];
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/__perf', body);
    } else {
      fetch('/__perf', { method: 'POST', body, keepalive: true }).catch(() => { /* dev only */ });
    }
  };
  setInterval(flush, FLUSH_MS);
  window.addEventListener('pagehide', () => {
    // Sortie PROPRE (nav volontaire, reload manuel) : on efface le heartbeat pour ne pas
    // la compter comme un crash, et on flushe ce qui reste.
    try { sessionStorage.removeItem(HB_KEY); } catch { /* ignore */ }
    push('pagehide', {});
    flush(true);
  });
}
