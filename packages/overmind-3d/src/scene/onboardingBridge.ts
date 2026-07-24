import * as THREE from 'three';
import { createActor, type ActorRefFrom } from 'xstate';
import { onboardingMachine, type StepId } from '../machines/onboardingMachine.ts';
import type { SentinelCreatureSystem } from '../sentinelCreature/SentinelCreatureSystem.ts';
import type { ScrollCameraAnimator } from './scrollCameraAnimator.ts';
import type { LinkSystem } from './linkSystem.ts';
import type { FrameGlowSystem } from './frameGlowSystem.ts';

/**
 * OnboardingBridge — câble l'onboardingMachine (XState) au monde 3D + au DOM.
 *
 * - Déclencheur (brique A) : `creature.setOnArriveB` → ARRIVE_B / LEAVE_B.
 * - Effets selon l'état (briques B/C) : accroche Sentinelle, biais caméra 4° gauche, verrou nav.
 * - Détour du scroll (brique D) : pendant la présentation, un écouteur `wheel` accumule et émet
 *   NEXT / PREV ; sur la dernière étape, un seuil RENFORCÉ émet CLOSE.
 * - React (brique E) : état relayé via l'event `overmind:onboarding`; la bulle est ancrée sur l'œil
 *   par projection 3D→2D (positionnement DOM impératif, sans re-render).
 */

const LOOK_BIAS_DEG = 9;     // cadrage : la caméra part de 9° à gauche pour mieux voir la Sentinelle (6→7→9 accord Paul)
const TUTO_FREELOOK_RETURN_S = 1; // free-look autorisé pendant le tuto, mais retour auto raccourci (5→3→2→1.5 s, accord Paul)
const STEP_PER_WHEEL = 25;   // granularité molette (= ScrollGaugeInput)
const STEP_THRESHOLD = 100;  // seuil pour changer d'étape
const CLOSE_THRESHOLD = 260; // seuil RENFORCÉ pour fermer (« scroll appuyé » sur la dernière étape)
const DECAY_DELAY_MS = 300;
const DECAY_RATE = 200;
const BUBBLE_PIXEL_UP = 90;  // décalage de la bulle au-dessus de l'œil (px écran)
const CLOSE_GRACE_MS = 1800; // après fermeture : nav bloquée le temps d'absorber la fin du scroll
const PULSE_MIN = 0.5;       // intensité glow basse du pulse (cible mise en valeur)
const PULSE_MAX = 2.4;       // intensité glow haute du pulse
const PULSE_SPEED = 5;       // pulsation (rad/s)
const LINK_NAMES = ['Logo_LinkedIn', 'Logo_X', 'Logo_Gmail', 'Logo_GitHub']; // pulse à l'étape liens
const CV_NAMES = ['Logo_Download'];                                          // pulse à l'étape CV
const SCREEN_FLASH_DURATION = 1.6; // durée du clignotement de l'écran à l'entrée de l'étape écran holo (s)
const SCREEN_FLASH_CYCLES = 3;     // nombre de clignotements
const CARD_SCROLL_EPS = 0.02;      // tolérance : offset à ε près du max = « scrollé jusqu'en bas »
// Étapes à ACTION imposée (léger) — free-look (idx 1) & bords d'écran (idx 2) :
const LOOK_SWEEP_PX = 220;   // amplitude cumulée de drag (px) pour valider « regarder autour »
const EDGE_REACH_MIN = 0.4;  // intensité de bord (0..1, cf. getEdgeReach) pour valider « approcher un bord »
// (Auto-pan démo de la vraie caméra retiré 2026-07-13 : donnait le mal de mer. La démonstration du
//  geste est désormais 100 % dans la bulle — main animée qui orbite + drag, cf. LookAroundHint.)

export class OnboardingBridge {
  private creature: SentinelCreatureSystem;
  private animator: ScrollCameraAnimator;
  private camera: THREE.Camera;
  private actor: ActorRefFrom<typeof onboardingMachine>;
  private linkSystem: LinkSystem | null;            // pour pulser les liens/CV par étape (brique F)
  private frameGlow: FrameGlowSystem | null;        // halo pulsant du cadre de la carte (étape écran holo)
  private pulseTime = 0;
  private getHoloScreenMats: () => THREE.ShaderMaterial[]; // écrans de cartes (clignotement étape 2)
  private flashTime = Infinity;                     // chrono du clignotement écran (Infinity = inactif)
  private lastStep: StepId | null = null;           // détecte l'entrée dans une étape (par id)

  private presenting = false;
  private steps: StepId[] = [];                      // parcours actif (reçu du contexte machine)
  private stepIdx = 0;
  // Étape 0 = apprentissage du scroll : l'utilisateur doit tester les DEUX sens (haut ET bas)
  // avant de pouvoir avancer (puis un dernier scroll valide, via l'accumulateur normal).
  private scrollUpDone = false;
  private scrollDownDone = false;
  // Étape 1 = free-look (clic-glisser) : un drag suffit à valider. Étape 2 = bords d'écran :
  // approcher un bord suffit. Tant que l'action n'est pas faite, le scroll ne change pas d'étape.
  private lookDone = false;
  private edgeDone = false;
  // Étape 3 (écran holo) — essai guidé de la carte : ouvrir → défiler → cliquer dehors.
  private screenOpened = false;   // ouverte au moins une fois (coupe aussi le pulse du cadre)
  private screenScrolled = false; // contenu défilé jusqu'en bas (ou carte trop courte → auto)
  private screenClosed = false;   // refermée (clic dehors) APRÈS ouverture + défilement → étape validée
  // Dernier état du mode lecture (via l'event overmind:reading-mode) — pour mesurer le défilement.
  private readingOffset = 0;
  private readingMaxOffset = 0;
  private boundReading: (e: Event) => void;
  private accumulator = 0;
  private lastInputTime = 0;
  private tmp = new THREE.Vector3();
  private boundWheel: (e: WheelEvent) => void;
  private graceTimer: number | null = null;

  constructor(
    creature: SentinelCreatureSystem,
    animator: ScrollCameraAnimator,
    camera: THREE.Camera,
    linkSystem: LinkSystem | null,
    getHoloScreenMats: () => THREE.ShaderMaterial[],
    frameGlow: FrameGlowSystem | null,
  ) {
    this.creature = creature;
    this.animator = animator;
    this.camera = camera;
    this.linkSystem = linkSystem;
    this.getHoloScreenMats = getHoloScreenMats;
    this.frameGlow = frameGlow;
    this.boundWheel = this.onWheel.bind(this);
    // Écoute le mode lecture des cartes → alimente la détection « défilé » de l'étape écran holo.
    this.boundReading = (e: Event) => {
      const d = (e as CustomEvent<{ active: boolean; offset: number; viewportFrac: number }>).detail;
      this.readingOffset = d.offset ?? 0;
      this.readingMaxOffset = Math.max(0, 1 - (d.viewportFrac ?? 0));
    };
    window.addEventListener('overmind:reading-mode', this.boundReading);

    this.actor = createActor(onboardingMachine);
    this.actor.subscribe((snap) =>
      this.onState(snap.value === 'presenting', snap.context.stepIdx, snap.context.steps),
    );
    this.actor.start();

    // Déclencheur (brique A) : la créature notifie l'arrivée/le départ du repos B-via-AB.
    creature.setOnArriveB((active) => this.actor.send({ type: active ? 'ARRIVE_B' : 'LEAVE_B' }));
  }

  /** L'identifiant de l'étape courante (ou null hors présentation). Tout le bridge raisonne dessus. */
  private currentStep(): StepId | null {
    return this.presenting ? (this.steps[this.stepIdx] ?? null) : null;
  }

  private onState(presenting: boolean, stepIdx: number, steps: StepId[]): void {
    const wasPresenting = this.presenting;
    this.presenting = presenting;
    this.steps = steps;
    this.stepIdx = stepIdx;
    const step = this.currentStep();
    if (presenting && !wasPresenting) this.enter();
    else if (!presenting && wasPresenting) this.exit();
    // Clignotement de l'écran à l'ENTRÉE de l'étape « écran holo ».
    if (step === 'screen' && this.lastStep !== 'screen') this.flashTime = 0;
    this.lastStep = step;
    this.dispatchState();
  }

  private enter(): void {
    if (this.graceTimer !== null) { clearTimeout(this.graceTimer); this.graceTimer = null; }
    this.creature.setAccrocheB(true);
    this.animator.setLookYawBias(LOOK_BIAS_DEG);
    this.animator.setFreeLookIdleDelay(TUTO_FREELOOK_RETURN_S); // regard libre mais rappel plus court
    this.animator.setNavigationLocked(true);
    // Tuto DESKTOP : lecture PLATE (pas de zoom/orbite V2) — le zoom lecture ne s'active qu'une fois
    // le tuto terminé (décision Paul). Sur mobile (pointeur grossier), on GARDERA la lecture zoomée
    // guidée (PR F) → on n'inhibe que sur pointeur fin. Rétabli à l'exit.
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.animator.setReadingZoomSuppressed(!coarse);
    this.accumulator = 0;
    this.scrollUpDone = false;
    this.scrollDownDone = false;
    this.lookDone = false;
    this.edgeDone = false;
    this.screenOpened = false;
    this.screenScrolled = false;
    this.screenClosed = false;
    this.animator.resetFreeLookSwept();
    window.addEventListener('wheel', this.boundWheel, { passive: false });
  }

  private exit(): void {
    this.creature.setAccrocheB(false);
    this.animator.setLookYawBias(0);
    this.animator.setFreeLookIdleDelay(null); // retour au délai normal du free-look
    this.animator.setReadingZoomSuppressed(false); // tuto fini → le zoom lecture V2 reprend (desktop)
    this.linkSystem?.setHighlight(null, 0); // restaure le glow de repos des liens/CV
    this.frameGlow?.reset();                // éteint le halo du cadre de la carte
    window.removeEventListener('wheel', this.boundWheel);
    // Grace period : on GARDE la nav verrouillée un court instant pour absorber la fin du geste de
    // scroll qui vient de fermer la bulle (sinon il enchaîne aussitôt sur le trajet BC). Puis on
    // déverrouille et on remet l'accumulateur molette à zéro pour repartir propre.
    if (this.graceTimer !== null) clearTimeout(this.graceTimer);
    this.graceTimer = window.setTimeout(() => {
      this.animator.setNavigationLocked(false);
      this.animator.resetScrollAccumulator();
      this.graceTimer = null;
    }, CLOSE_GRACE_MS);
  }

  private onWheel(e: WheelEvent): void {
    // Si une carte (écran) est en mode lecture, on LAISSE le scroll défiler l'écran (géré par
    // ScrollGaugeInput) → on ne change PAS d'étape d'onboarding tant qu'on n'est pas ressorti.
    if (this.animator.isReading()) return;
    e.preventDefault();
    // Bloque la navigation tant que le free-look n'est pas revenu à la vue neutre : évite d'avancer
    // « de travers » alors que l'utilisateur regarde encore ailleurs. Le scroll DÉCLENCHE le retour
    // (sinon un mouvement de souris réarmerait sans cesse l'attente → blocage sans fin).
    if (!this.animator.isFreeLookNeutral()) { this.animator.requestFreeLookReturn(); return; }
    const sign = Math.sign(e.deltaY);
    if (sign === 0) return;
    const step = this.currentStep();

    // Étape 'scroll' (apprentissage) : tant que les 2 sens n'ont pas été validés, un scroll ne
    // change PAS d'étape — il CHARGE la jauge (accumulateur) dans son sens ; le sens n'est coché
    // qu'une fois le SEUIL atteint (comme la vraie nav — pas de validation au 1er cran). La charge
    // s'affiche sur la grande barre (via update → overmind:onboarding-charge). Une fois les deux
    // faits, on retombe sur le comportement normal → un dernier scroll (bas) chargé valide et avance.
    if (step === 'scroll' && !(this.scrollUpDone && this.scrollDownDone)) {
      // Ordre IMPOSÉ (guidage) : le BAS d'abord, puis le HAUT. On n'accepte que le sens attendu ;
      // scroller dans l'autre sens ne fait rien (la bulle indique quoi faire).
      const wantSign = !this.scrollDownDone ? 1 : -1;
      if (sign !== wantSign) return;
      this.accumulator = Math.max(-STEP_THRESHOLD, Math.min(STEP_THRESHOLD, this.accumulator + sign * STEP_PER_WHEEL));
      this.lastInputTime = performance.now();
      if (this.accumulator >= STEP_THRESHOLD) { this.scrollDownDone = true; this.accumulator = 0; this.dispatchState(); }
      else if (this.accumulator <= -STEP_THRESHOLD) { this.scrollUpDone = true; this.accumulator = 0; this.dispatchState(); }
      return;
    }

    // Étapes à ACTION imposée (léger) : tant que l'action n'est pas validée, le scroll ne fait RIEN
    // (la bulle guide l'utilisateur). Une fois faite → comportement normal (scroll bas = avancer).
    if (step === 'look' && !this.lookDone) return;  // free-look : cliquer-glisser d'abord
    if (step === 'edge' && !this.edgeDone) return;  // bords : approcher un bord d'abord
    if (step === 'screen' && !this.screenClosed) return; // écran holo : ouvrir → défiler → fermer d'abord

    const last = this.stepIdx >= this.steps.length - 1;
    // Recul bloqué avant la 1re étape.
    if (sign < 0 && this.stepIdx <= 0) { this.accumulator = Math.max(this.accumulator, 0); return; }

    this.accumulator += sign * STEP_PER_WHEEL;
    const fwdThreshold = last ? CLOSE_THRESHOLD : STEP_THRESHOLD;
    this.accumulator = Math.max(-STEP_THRESHOLD, Math.min(fwdThreshold, this.accumulator));
    this.lastInputTime = performance.now();

    if (this.accumulator >= fwdThreshold) {
      this.accumulator = 0;
      this.actor.send({ type: last ? 'CLOSE' : 'NEXT' });
    } else if (this.accumulator <= -STEP_THRESHOLD) {
      this.accumulator = 0;
      this.actor.send({ type: 'PREV' });
    }
  }

  /** Appelé chaque frame depuis la boucle d'animation. */
  update(dt: number): void {
    if (!this.presenting) return;

    // Décroissance douce de l'accumulateur (comme ScrollGaugeInput).
    const now = performance.now();
    if (now - this.lastInputTime > DECAY_DELAY_MS && this.accumulator !== 0) {
      const decay = DECAY_RATE * dt;
      this.accumulator = Math.abs(this.accumulator) <= decay
        ? 0
        : this.accumulator - Math.sign(this.accumulator) * decay;
    }

    const step = this.currentStep();

    // Étape 'scroll' : reflète la CHARGE (accumulateur, signé) sur la grande barre de scroll →
    // l'utilisateur voit la jauge se remplir dans le sens scrollé et se vider s'il s'arrête.
    if (step === 'scroll') {
      window.dispatchEvent(new CustomEvent('overmind:onboarding-charge', {
        detail: { value: this.accumulator / STEP_THRESHOLD },
      }));
    }

    // Étape 'look' (free-look) : détecte le geste clic-glisser (la vraie caméra reste au cadrage fixe —
    // pas d'auto-pan, évite le mal de mer). La démo du geste est dans la bulle (main animée).
    // La CHARGE du globe (0..1) suit l'amplitude du geste jusqu'à validation.
    if (step === 'look') {
      const swept = this.animator.getFreeLookSwept();
      if (!this.lookDone && swept >= LOOK_SWEEP_PX) { this.lookDone = true; this.dispatchState(); }
      window.dispatchEvent(new CustomEvent('overmind:onboarding-look', {
        detail: { value: Math.max(0, Math.min(1, swept / LOOK_SWEEP_PX)) },
      }));
    } else if (step === 'edge') {
      // Étape 'edge' (bords d'écran) : validée dès que la souris s'engage franchement dans une bande de bord.
      if (!this.edgeDone && this.animator.getEdgeReach() >= EDGE_REACH_MIN) {
        this.edgeDone = true;
        this.dispatchState();
      }
    } else if (step === 'screen') {
      // Étape 3 (écran holo) : essai guidé — ouvrir → défiler → cliquer dehors. Détecté via le mode
      // lecture (isReading + offset de l'event reading-mode). Le clic dehors ne valide qu'après défilement.
      const bO = this.screenOpened, bS = this.screenScrolled, bC = this.screenClosed;
      if (this.animator.isReading()) {
        this.screenOpened = true;
        if (this.readingMaxOffset <= CARD_SCROLL_EPS || this.readingOffset >= this.readingMaxOffset - CARD_SCROLL_EPS) {
          this.screenScrolled = true; // scrollé jusqu'en bas (ou carte trop courte → auto-validé)
        }
      } else if (this.screenOpened && this.screenScrolled) {
        this.screenClosed = true;
      }
      if (this.screenOpened !== bO || this.screenScrolled !== bS || this.screenClosed !== bC) this.dispatchState();
      const cardCharge = this.readingMaxOffset > CARD_SCROLL_EPS
        ? Math.max(0, Math.min(1, this.readingOffset / this.readingMaxOffset))
        : (this.screenOpened ? 1 : 0);
      window.dispatchEvent(new CustomEvent('overmind:onboarding-card', { detail: { value: cardCharge } }));
    }

    // Les étapes à ACTION (scroll/free-look/bords) bloquent la progression tant qu'elles ne sont pas
    // validées → la mini-barre reste vide (elle montre l'état de validation, pas l'avancement scroll).
    const actionPending =
      (step === 'scroll' && !(this.scrollUpDone && this.scrollDownDone)) ||
      (step === 'look' && !this.lookDone) ||
      (step === 'edge' && !this.edgeDone) ||
      (step === 'screen' && !this.screenClosed);

    // Ancre la bulle sur l'œil (projection 3D→2D, positionnement DOM impératif).
    const el = document.getElementById('onboarding-bubble');
    if (el) {
      this.creature.getEyeWorldPosition(this.tmp).project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this.tmp.y * 0.5 + 0.5) * window.innerHeight - BUBBLE_PIXEL_UP;
      const onScreen = this.tmp.z < 1;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.opacity = onScreen ? '1' : '0';
    }

    // Mini barre de scroll de la bulle : progression vers l'étape suivante (ou la fermeture).
    // Sur une étape à action non validée, on la laisse à 0 (l'action prime sur le scroll).
    const fill = document.getElementById('onboarding-scroll-fill');
    if (fill) {
      if (actionPending) {
        fill.style.height = '0%';
      } else {
        const last = this.stepIdx >= this.steps.length - 1;
        const thr = last ? CLOSE_THRESHOLD : STEP_THRESHOLD;
        const p = Math.max(0, Math.min(1, this.accumulator / thr));
        fill.style.height = `${(p * 100).toFixed(0)}%`;
      }
    }

    // Pulse commun (sinus 0..1 mappé sur PULSE_MIN..PULSE_MAX) — partagé par les liens et le cadre.
    this.pulseTime += dt;
    const pulse = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.pulseTime * PULSE_SPEED));

    // Pulse de la cible — brique F : liens à l'étape 'links', CV à l'étape 'cv', sinon repos.
    if (this.linkSystem) {
      const names = step === 'links' ? LINK_NAMES : step === 'cv' ? CV_NAMES : null;
      this.linkSystem.setHighlight(names, pulse);
    }

    // Pulse du CADRE de la carte Holo à l'étape 'screen' → halo « c'est cette carte ».
    // On pulse tant que la carte n'a pas été ouverte (screenOpened géré dans le bloc 'screen' ci-dessus).
    if (this.frameGlow) {
      if (step === 'screen' && !this.screenOpened) this.frameGlow.setGlow(pulse);
      else this.frameGlow.reset();
    }

    // Clignotement de l'écran (≈3 fois, fondu sortant) à l'entrée de l'étape 2.
    if (this.flashTime < SCREEN_FLASH_DURATION) {
      this.flashTime += dt;
      const p = Math.min(1, this.flashTime / SCREEN_FLASH_DURATION);
      const glow = p >= 1 ? 0 : Math.abs(Math.sin(p * Math.PI * SCREEN_FLASH_CYCLES)) * (1 - p);
      for (const m of this.getHoloScreenMats()) {
        const u = m.uniforms?.uHoverGlow;
        if (u) u.value = glow;
      }
    }
  }

  private dispatchState(): void {
    const step = this.currentStep();
    window.dispatchEvent(new CustomEvent('overmind:onboarding', {
      detail: {
        active: this.presenting,
        stepIdx: this.stepIdx,
        stepId: step,                 // identifiant sémantique → la bulle switch dessus (pas l'index)
        total: this.steps.length,
        // Apprentissage du scroll (étape 'scroll') : met en valeur les 2 barres + coche les sens testés.
        teach: {
          active: step === 'scroll',
          upDone: this.scrollUpDone,
          downDone: this.scrollDownDone,
        },
        // Free-look (étape 'look') : pilote le globe+œil dans la bulle.
        look: {
          active: step === 'look',
          done: this.lookDone,
        },
        // Bords d'écran (étape 'edge') : pilote le bandeau lumineux plein écran.
        edge: {
          active: step === 'edge',
          done: this.edgeDone,
        },
        // Écran holo (étape 'screen') : essai guidé de la carte (ouvrir → défiler → fermer).
        screen: {
          active: step === 'screen',
          opened: this.screenOpened,
          scrolled: this.screenScrolled,
          closed: this.screenClosed,
        },
      },
    }));
  }

  dispose(): void {
    if (this.graceTimer !== null) clearTimeout(this.graceTimer);
    window.removeEventListener('wheel', this.boundWheel);
    window.removeEventListener('overmind:reading-mode', this.boundReading);
    this.actor.stop();
  }
}
