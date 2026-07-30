import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * AudioControl — musique d'ambiance (Web Audio API).
 *
 * Flux :
 * - Carte de consentement au démarrage (superposée au loader, collée au-dessus de la barre) :
 *   « Activer la musique ? » [Avec son] / [Sans son]. Le clic est le geste utilisateur qui débloque
 *   l'audio (iOS) → « Avec son » démarre tout de suite et accompagne le loader.
 * - CHARGEMENT CONDITIONNEL : le fichier n'est fetch/décodé qu'au premier « Avec son » (ou activation
 *   via le bouton). « Sans son » = rien de chargé.
 * - INTRO PUIS BOUCLE, SANS COUPURE : le fichier `.m4a` contient l'intro (0 → LOOP_START) PUIS la zone
 *   de boucle. On joue tout depuis 0 UNE FOIS (l'intro accompagne le loader), puis le moteur audio
 *   boucle la section [LOOP_START, LOOP_END] via `loop`/`loopStart`/`loopEnd`. Le raccord (LOOP_END →
 *   LOOP_START) est un fondu enchaîné DÉJÀ baké dans le fichier ET calé sur la mesure (86 BPM,
 *   83 mesures) → rebouclage inaudible, géré au sample près (pas de seek, pas de rAF). Un seul buffer
 *   décodé → l'enchaînement intro→boucle est parfait par construction (aucun trou possible).
 * - PAUSE en arrière-plan / autre onglet via `AudioContext.suspend()` ; reprise au retour.
 * - RAM maîtrisée : décodage à 32 kHz (~75 Mo au lieu de ~100), seulement si « Avec son ».
 * - Bouton haut-parleur bas-gauche : toggle, mémorisé (localStorage), rétrécit de 20 % après 15 s
 *   d'inactivité (vers le centre ; hitbox tactile pleine préservée).
 */

// Bornes de la zone de boucle DANS le fichier (l'intro = 0 → LOOP_START, jouée une seule fois).
const LOOP_START = 57.585; // s — début de la boucle (fin de l'intro)
const LOOP_END = 288.856; // s — fin de la boucle (raccord fondu baké, calé sur la mesure)
const DEFAULT_VOLUME = 0.4;
const CTX_SAMPLE_RATE = 32000; // décodage plus léger en RAM (fallback défaut si non supporté)
const SHRINK_DELAY_MS = 15000;
const STORAGE_KEY = 'overmind-audio';
const AUDIO_SRC = import.meta.env.BASE_URL + 'audio/weightless-drift.m4a';

type Ctor = typeof AudioContext;

export default function AudioControl() {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const startedRef = useRef(false); // la source a-t-elle déjà été démarrée ?
  const shrinkRef = useRef<number | null>(null);
  const lastChoiceRef = useRef<string | null>(null);
  if (lastChoiceRef.current === null) {
    try { lastChoiceRef.current = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const [asked, setAsked] = useState(false); // carte de consentement répondue (cette session) ?
  const [cardBottom, setCardBottom] = useState<number | null>(null);

  // Mesure la barre de chargement (#app-loader-bar) pour coller la carte juste au-dessus.
  useLayoutEffect(() => {
    const bar = document.getElementById('app-loader-bar');
    if (bar) {
      const r = bar.getBoundingClientRect();
      setCardBottom(Math.round(window.innerHeight - r.top + 8));
    }
  }, []);

  const persist = (v: 'on' | 'off') => {
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  const bumpShrink = useCallback(() => {
    setShrunk(false);
    if (shrinkRef.current) window.clearTimeout(shrinkRef.current);
    shrinkRef.current = window.setTimeout(() => setShrunk(true), SHRINK_DELAY_MS);
  }, []);

  // crée le contexte (au geste) + décode (une fois) + démarre la source en boucle native
  const start = useCallback(async () => {
    try {
      if (!ctxRef.current) {
        const Ctx: Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
        try {
          ctxRef.current = new Ctx({ sampleRate: CTX_SAMPLE_RATE });
        } catch {
          ctxRef.current = new Ctx(); // sampleRate non supporté -> défaut
        }
      }
      const ctx = ctxRef.current;
      await ctx.resume(); // débloque dans le geste utilisateur

      if (!bufferRef.current) {
        setLoading(true);
        const res = await fetch(AUDIO_SRC);
        const arr = await res.arrayBuffer();
        bufferRef.current = await ctx.decodeAudioData(arr);
        setLoading(false);
      }

      if (!startedRef.current) {
        const src = ctx.createBufferSource();
        src.buffer = bufferRef.current;
        src.loop = true;
        src.loopStart = LOOP_START;
        src.loopEnd = LOOP_END; // intro (0→LOOP_START) jouée une fois, puis boucle [LOOP_START, LOOP_END]
        const gain = ctx.createGain();
        gain.gain.value = DEFAULT_VOLUME;
        src.connect(gain).connect(ctx.destination);
        src.start(0);
        srcRef.current = src;
        gainRef.current = gain;
        startedRef.current = true;
      }
      setOn(true);
    } catch {
      setLoading(false);
    }
  }, []);

  const pause = useCallback(async () => {
    try { await ctxRef.current?.suspend(); } catch { /* ignore */ }
    setOn(false);
  }, []);

  const acceptSound = useCallback(() => {
    setAsked(true);
    persist('on');
    bumpShrink();
    void start();
  }, [start, bumpShrink]);

  const declineSound = useCallback(() => {
    setAsked(true);
    persist('off');
  }, []);

  const toggle = useCallback(() => {
    bumpShrink();
    if (on) {
      void pause();
      persist('off');
    } else {
      void start();
      persist('on');
    }
  }, [on, start, pause, bumpShrink]);

  // pause en arrière-plan / autre onglet, reprise au retour (intention "on" conservée)
  useEffect(() => {
    const onVis = () => {
      const ctx = ctxRef.current;
      if (!ctx || !startedRef.current) return;
      if (document.hidden) {
        void ctx.suspend();
      } else if (on) {
        void ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onVis);
    };
  }, [on]);

  // timer de rétrécissement au montage + cleanup complet au démontage
  useEffect(() => {
    bumpShrink();
    return () => {
      if (shrinkRef.current) window.clearTimeout(shrinkRef.current);
      try { srcRef.current?.stop(); } catch { /* ignore */ }
      try { void ctxRef.current?.close(); } catch { /* ignore */ }
    };
  }, [bumpShrink]);

  // défaut visuel de la carte : « Avec son » mis en avant, sauf si le dernier choix était « off »
  const prefersOn = lastChoiceRef.current !== 'off';

  return (
    <>
      {!asked && (
        <div style={{ ...consentCard, bottom: cardBottom != null ? cardBottom : '42%' }} role="dialog" aria-label="Activer la musique">
          <span style={consentTitle}>Activer la musique&nbsp;?</span>
          <button type="button" onClick={acceptSound} style={{ ...consentBtn, ...(prefersOn ? consentBtnPrimary : null) }}>
            Avec son
          </button>
          <button type="button" onClick={declineSound} style={{ ...consentBtn, ...(!prefersOn ? consentBtnPrimary : null) }}>
            Sans son
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={on ? 'Couper la musique' : 'Activer la musique'}
        aria-pressed={on}
        title={on ? 'Couper la musique' : 'Activer la musique'}
        style={btnStyle}
      >
        <span style={{ ...iconStyle, transform: `scale(${shrunk ? 0.8 : 1})` }}>
          {loading ? <SpinnerIcon /> : on ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </span>
      </button>
    </>
  );
}

/* --- styles bouton --- */
const btnStyle: React.CSSProperties = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  zIndex: 9000,
  width: 44, // hitbox tactile pleine, invariable
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};
const iconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'rgba(6,14,22,0.6)',
  border: '1px solid rgba(0,212,255,0.5)',
  color: '#cfeaff',
  boxShadow: '0 0 10px rgba(0,212,255,0.25)',
  backdropFilter: 'blur(3px)',
  transformOrigin: 'center', // rétrécit vers son centre
  transition: 'transform 0.4s ease',
};

/* --- carte de consentement : liquid glass compact, collé au-dessus de la barre du loader --- */
const consentCard: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)', // `bottom` posé dynamiquement (collé au-dessus de la barre du loader)
  zIndex: 100000,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  whiteSpace: 'nowrap',
  maxWidth: '94vw',
  padding: '7px 12px',
  borderRadius: 14,
  background: 'rgba(14,24,34,0.24)', // très translucide
  border: '1px solid rgba(255,255,255,0.10)', // liseré discret, pas d'encadré marqué
  backdropFilter: 'blur(10px) saturate(1.2)', // « liquid glass » iOS (allégé pour la perf mobile)
  WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
  color: '#eaf6ff',
  fontFamily: 'monospace',
};
const consentTitle: React.CSSProperties = {
  fontSize: 12.5,
  letterSpacing: 0.5,
  color: 'rgba(0,229,255,0.95)',
};
const consentBtn: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 8,
  border: '1px solid rgba(0,229,255,0.5)',
  background: 'rgba(0,20,30,0.55)', // boutons NETS (ils ressortent du flou)
  color: '#cfeaff',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'monospace',
};
const consentBtnPrimary: React.CSSProperties = {
  background: 'rgba(0,229,255,0.32)',
  border: '1px solid #00e5ff',
  color: '#eaffff',
};

/* --- icônes --- */
function SpeakerOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </svg>
  );
}
function SpeakerOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" opacity={0.9}>
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
