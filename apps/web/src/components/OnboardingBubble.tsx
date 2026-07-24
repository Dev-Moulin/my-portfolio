import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MouseScrollHint from './MouseScrollHint.tsx';
import LookAroundHint from './LookAroundHint.tsx';
import CardScrollHint from './CardScrollHint.tsx';
import NavArcHint from './NavArcHint.tsx';

/**
 * OnboardingBubble — bulle « terminal » de la présentation guidée à l'arrivée en B.
 *
 * Pilotée par l'event `overmind:onboarding` (scene/onboardingBridge.ts) : { active, stepIdx, total }.
 * La POSITION (suivi de l'œil) et le remplissage de la mini barre de scroll sont appliqués
 * impérativement par le bridge (ids `onboarding-bubble` / `onboarding-scroll-fill`) → pas de
 * re-render React pour suivre la Sentinelle. Le contenu (typewriter + points) vient d'ici, i18n.
 */

const TYPE_SPEED_MS = 26;
const ACCENT = '#00d0fa';

interface OnboardingDetail {
  active: boolean;
  stepIdx: number;
  stepId?: string; // identifiant sémantique de l'étape courante ('welcome' | 'scroll' | 'look' | …)
  total: number;
  teach?: { active: boolean; upDone: boolean; downDone: boolean };
  look?: { active: boolean; done: boolean };  // étape free-look (globe + œil)
  edge?: { active: boolean; done: boolean };  // étape bords d'écran (bandeau plein écran)
  screen?: { active: boolean; opened: boolean; scrolled: boolean; closed: boolean }; // étape écran holo (essai carte)
}

export default function OnboardingBubble() {
  const { t } = useTranslation();
  const [state, setState] = useState<OnboardingDetail>({ active: false, stepIdx: 0, total: 0 });
  const [typed, setTyped] = useState('');
  const [charge, setCharge] = useState(0); // charge de la jauge pendant l'apprentissage (-1..+1)
  const [lookCharge, setLookCharge] = useState(0); // amplitude du geste free-look (0..1)
  const [cardCharge, setCardCharge] = useState(0); // défilement du contenu de la carte (0..1)
  const [navArcOpen, setNavArcOpen] = useState(false); // NavArc déployée (étape navarc) → indication « fermer »
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<OnboardingDetail>).detail;
      setState(d);
      if (!d.look?.active) setLookCharge(0); // hors étape free-look → vide l'anneau de charge
      if (!d.screen?.active) setCardCharge(0); // hors étape écran holo → vide la barre de charge
    };
    const onCharge = (e: Event) => setCharge((e as CustomEvent<{ value: number }>).detail?.value ?? 0);
    const onLook = (e: Event) => setLookCharge((e as CustomEvent<{ value: number }>).detail?.value ?? 0);
    const onCard = (e: Event) => setCardCharge((e as CustomEvent<{ value: number }>).detail?.value ?? 0);
    const onNavOpen = (e: Event) => setNavArcOpen(!!(e as CustomEvent<{ open: boolean }>).detail?.open);
    window.addEventListener('overmind:onboarding', handler);
    window.addEventListener('overmind:onboarding-charge', onCharge);
    window.addEventListener('overmind:onboarding-look', onLook);
    window.addEventListener('overmind:onboarding-card', onCard);
    window.addEventListener('overmind:navarc-open', onNavOpen);
    return () => {
      window.removeEventListener('overmind:onboarding', handler);
      window.removeEventListener('overmind:onboarding-charge', onCharge);
      window.removeEventListener('overmind:onboarding-look', onLook);
      window.removeEventListener('overmind:onboarding-card', onCard);
      window.removeEventListener('overmind:navarc-open', onNavOpen);
    };
  }, []);

  const { active, stepIdx, total } = state;
  const stepId = state.stepId ?? '';
  const fullText = active ? t(`onboarding.b.${stepId}`) : '';

  // Typewriter : ré-écrit le texte à chaque changement d'étape.
  useEffect(() => {
    if (!active) { setTyped(''); return; }
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) window.clearInterval(id);
      // Étape 'navarc' : texte plus long → frappe un peu plus rapide (moins de décalage du hint dessous).
    }, stepId === 'navarc' ? 17 : TYPE_SPEED_MS);
    return () => window.clearInterval(id);
  }, [fullText, active]);

  // Masque la bulle tant que le bridge ne l'a pas positionnée (évite un flash en (0,0)).
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.opacity = '0';
  }, [active]);

  if (!active) return null;

  const teach = state.teach;
  const look = state.look;
  const edge = state.edge;
  const screen = state.screen;
  // « Étape-action » = pilotée par les drapeaux .active envoyés par le bridge (source de vérité,
  // robuste aux 2 parcours). Sur mobile, 'scroll' n'est PAS une action (teach inactif) → hint swipe.
  const isActionStep = !!(teach?.active || look?.active || edge?.active || screen?.active);
  const isLast = stepIdx >= total - 1;      // dernière étape → « … pour terminer »
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  // Guidage scroll : le BAS d'abord, puis le HAUT, puis « scrollez pour continuer ».
  const awaiting: 'down' | 'up' | 'none' = !teach?.downDone ? 'down' : !teach?.upDone ? 'up' : 'none';
  // Instruction guidée selon l'étape-action ACTIVE (chaque action → « Parfait ✓ … pour continuer »).
  const guideKey = teach?.active
    ? (awaiting === 'down' ? 'guideDown' : awaiting === 'up' ? 'guideUp' : 'guideDone')
    : look?.active ? (look?.done ? 'guideLookDone' : 'guideLook')
    : edge?.active ? (edge?.done ? 'guideEdgeDone' : 'guideEdge')
    : screen?.active ? (
        !screen?.opened ? 'guideCardOpen'
        : !screen?.scrolled ? 'guideCardScroll'
        : !screen?.closed ? 'guideCardClose'
        : 'guideCardDone')
    : '';

  return (
    <div
      id="onboarding-bubble"
      ref={ref}
      style={{ position: 'fixed', top: 0, left: 0, zIndex: 70, pointerEvents: 'none', willChange: 'transform, opacity' }}
    >
      <style>{'@keyframes ob-blink{0%,49%{opacity:1}50%,100%{opacity:0}}'
        + '@keyframes ob-bar-pulse{0%,100%{box-shadow:0 0 6px ' + ACCENT + '80;border-color:' + ACCENT + '80}50%{box-shadow:0 0 16px ' + ACCENT + ';border-color:' + ACCENT + '}}'}</style>
      {/* Étape 'navarc' : bulle plus étroite (texte long → on la comprime pour limiter le décalage
          du hint dessous pendant la frappe, retour Paul). Autres étapes : largeur habituelle. */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, width: 'max-content', maxWidth: stepId === 'navarc' ? 288 : 400 }}>
        {/* Bulle terminal */}
        <div
          style={{
            flex: '1 1 auto',
            background: 'rgba(8,14,22,0.92)',
            border: `1px solid ${ACCENT}80`,
            borderRadius: 10,
            padding: '14px 18px 12px',
            boxShadow: `0 0 18px ${ACCENT}40, inset 0 0 12px ${ACCENT}14`,
            backdropFilter: 'blur(3px)',
            fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
            fontSize: 14,
            lineHeight: 1.55,
            color: '#dff6ff',
            textShadow: `0 0 6px ${ACCENT}55`,
          }}
        >
          <div style={{ minHeight: '3.1em', whiteSpace: 'pre-line' }}>
            <span style={{ color: ACCENT, opacity: 0.7, marginRight: 6 }}>&gt;</span>
            {typed}
            <span style={{ animation: 'ob-blink 1s step-end infinite', color: ACCENT }}>▋</span>
          </div>

          {/* Étapes à ACTION (scroll / free-look / bords) : indicateur animé + instruction guidée.
              Chaque action remplace un ancien texte « Scroller pour la suite ». */}
          {isActionStep && (
            <>
              {teach?.active && (
                <MouseScrollHint
                  upDone={teach?.upDone ?? false}
                  downDone={teach?.downDone ?? false}
                  awaiting={awaiting}
                />
              )}
              {look?.active && <LookAroundHint done={look?.done ?? false} charge={lookCharge} />}
              {screen?.active && (
                <CardScrollHint
                  opened={screen?.opened ?? false}
                  scrolled={screen?.scrolled ?? false}
                  closed={screen?.closed ?? false}
                  scrollCharge={cardCharge}
                />
              )}
              {/* isEdge : pas d'indicateur dans la bulle — le bandeau plein écran (ScreenEdgeHint) guide. */}

              {/* Instruction guidée (change à chaque validation) */}
              <div style={{
                marginTop: 8, textAlign: 'center', fontSize: 12.5, fontWeight: 600,
                letterSpacing: 0.3, color: ACCENT, textShadow: `0 0 7px ${ACCENT}70`,
              }}>
                {t(`onboarding.b.${guideKey}`)}
              </div>
            </>
          )}

          {/* Indication de FERMETURE (mobile) : affichée DANS la bulle quand la NavArc est ouverte —
              au doigt il n'y a pas de mouseleave. ENTRE le texte d'explication et l'animation (retour Paul). */}
          {stepId === 'navarc' && coarse && navArcOpen && (
            <div style={{
              marginTop: 8, textAlign: 'center', fontSize: 12.5, fontWeight: 600,
              letterSpacing: 0.3, color: ACCENT, textShadow: `0 0 7px ${ACCENT}70`,
            }}>
              {t('navArc.tapToClose')}
            </div>
          )}

          {/* Étape 'navarc' : mini-tuto visuel (ouvrir la NavArc → cliquer la langue), en plus du texte. */}
          {stepId === 'navarc' && <NavArcHint coarse={coarse} />}

          {/* Étapes PASSIVES (bienvenue, navarc, swipe mobile, réseaux, CV, fin) : rappel explicite de
              comment avancer — sinon rien n'indique le geste (retour Paul). Device-aware : molette / swipe. */}
          {!isActionStep && (
            <div style={{
              marginTop: 8, textAlign: 'center', fontSize: 12.5, fontWeight: 600,
              letterSpacing: 0.3, color: ACCENT, textShadow: `0 0 7px ${ACCENT}70`,
            }}>
              {t(coarse
                ? (isLast ? 'onboarding.b.hintLastTouch' : 'onboarding.b.hintTouch')
                : (isLast ? 'onboarding.b.hintLast' : 'onboarding.b.hint'))}
            </div>
          )}

          {/* Rangée de points d'étape */}
          <div style={{ display: 'flex', gap: 7, marginTop: 12, alignItems: 'center' }}>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: i === stepIdx ? ACCENT : 'transparent',
                  border: `1px solid ${ACCENT}${i === stepIdx ? 'ff' : '66'}`,
                  boxShadow: i === stepIdx ? `0 0 6px ${ACCENT}` : 'none',
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Mini barre de scroll (progression vers l'étape suivante) — remplie par le bridge.
            À l'étape 1, on l'ÉLARGIT + on la fait pulser pour la faire remarquer. */}
        <div
          style={{
            width: isActionStep ? 12 : 8,
            borderRadius: 5,
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${ACCENT}55`,
            position: 'relative',
            overflow: 'hidden',
            alignSelf: 'stretch',
            animation: isActionStep ? 'ob-bar-pulse 1.4s ease-in-out infinite' : 'none',
            transition: 'width 300ms ease',
          }}
        >
          {/* Étape 'scroll' DESKTOP — comme la grande barre : zones par POSITION (haut = cyan/scroll
              haut, bas = orange/scroll bas) qui se valident + remplissage de charge qui suit le geste.
              (Mobile : teach inactif → pas de zones, la barre reste neutre.) */}
          {teach?.active && (() => {
            const v = Math.max(-1, Math.min(1, -charge)); // suit le geste : scroll haut → +, bas → −
            return (
              <>
                {/* zones validées (fond) */}
                <div style={{
                  position: 'absolute', top: 0, bottom: '50%', left: 0, right: 0,
                  background: teach?.upDone ? 'rgba(0,188,212,0.55)' : 'rgba(0,188,212,0.12)',
                  boxShadow: teach?.upDone ? '0 0 8px rgba(0,188,212,0.8)' : 'none',
                  transition: 'background 250ms ease, box-shadow 250ms ease',
                }} />
                <div style={{
                  position: 'absolute', top: '50%', bottom: 0, left: 0, right: 0,
                  background: teach?.downDone ? 'rgba(77,255,102,0.5)' : 'rgba(77,255,102,0.12)',
                  boxShadow: teach?.downDone ? '0 0 8px rgba(77,255,102,0.8)' : 'none',
                  transition: 'background 250ms ease, box-shadow 250ms ease',
                }} />
                {/* charge en cours (par-dessus) : cyan vers le haut / vert vers le bas */}
                {v > 0 && <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: '50%', height: `${(v * 50).toFixed(0)}%`,
                  background: 'linear-gradient(to top, #4dd0e1, #00bcd4)', boxShadow: '0 0 8px rgba(0,188,212,0.7)',
                }} />}
                {v < 0 && <div style={{
                  position: 'absolute', left: 0, right: 0, top: '50%', height: `${(-v * 50).toFixed(0)}%`,
                  background: 'linear-gradient(to bottom, #a5ffb5, #1fe84a)', boxShadow: '0 0 8px rgba(77,255,102,0.7)',
                }} />}
              </>
            );
          })()}
          <div
            id="onboarding-scroll-fill"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '0%',
              background: `linear-gradient(to top, ${ACCENT}, ${ACCENT}aa)`,
              boxShadow: `0 0 8px ${ACCENT}`,
              transition: 'height 80ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
