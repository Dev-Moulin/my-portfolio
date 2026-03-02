# Architecture Technique : Timeline Refactor

## 1. Pipeline Scroll — Avant / Apres

### Avant (actuel)

```
scroll event (60Hz)
  → App.tsx: remapProgress(raw) avec dwells
    → CustomEvent('overmind:scroll-progress')
      → ScrollBridge: 3x actor.send(UPDATE_SCROLL)
        → scrollTextMachine → syncFromState → ScrollTextSystem.lerp → mesh
        → cameraKeyframeMachine → syncFromState → CameraKeyframeSystem.lerp → camera
        → scrollCardMachine → useSelector → React re-render → DOM
```

Problemes : double-lerp, 3 envois, re-render React haute frequence, timings disperses

### Apres (propose)

```
scroll event (60Hz)
  → App.tsx: remapProgress(raw) avec dwells
    → CustomEvent('overmind:scroll-progress')
      → ScrollBridge: 1x timelineActor.send(UPDATE_SCROLL)
        → timelineMachine calcule TOUT :
           camera: { pos, lookAt, fov }
           title: { pos, opacity }
           subtitle: { pos, opacity }
           card: { opacity, translateX }
        → Systems lisent le contexte directement (pas de lerp interne)
```

Un seul actor, un seul calcul, pas de double-lerp.

---

## 2. Modele de donnees : timelineMachine

### Contexte XState

```typescript
interface TimelineContext {
  // Source
  scrollProgress: number;

  // Donnees de la timeline
  tracks: Track[];
  dwells: Dwell[];

  // Mode camera
  cameraMode: 'scroll-driven' | 'free';

  // Resultats calcules (caches, mis a jour a chaque UPDATE_SCROLL)
  computed: {
    camera: { posX: number; posY: number; posZ: number;
              lookAtX: number; lookAtY: number; lookAtZ: number;
              fov: number } | null;
    textElements: Array<{ id: string; x: number; y: number; z: number; opacity: number }>;
    htmlElements: Array<{ id: string; opacity: number; translateX: number }>;
  };
}

interface Track {
  id: string;
  name: string;
  type: 'camera' | 'text-3d' | 'html-element';
  clips: Clip[];
  color: string;
  locked: boolean;
  visible: boolean;
}

interface Clip {
  id: string;
  start: number;  // 0-1
  end: number;     // 0-1
  keyframes: Keyframe[];
}

interface Keyframe {
  id: string;
  at: number;  // position relative dans le clip (0-1)
  values: Record<string, number>;
  easing: EasingType;
}

interface Dwell {
  at: number;       // progress ou le scroll se bloque
  duration: number;  // duree en raw scroll
}
```

### Evenements

```typescript
type TimelineEvents =
  // Scroll
  | { type: 'UPDATE_SCROLL'; progress: number }
  // Camera mode
  | { type: 'SET_CAMERA_MODE'; mode: 'scroll-driven' | 'free' }
  | { type: 'CAPTURE_KEYFRAME'; atProgress: number; camera: CameraState }
  // Tracks
  | { type: 'ADD_TRACK'; track: Track }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'UPDATE_TRACK'; trackId: string; changes: Partial<Track> }
  // Clips
  | { type: 'ADD_CLIP'; trackId: string; clip: Clip }
  | { type: 'MOVE_CLIP'; trackId: string; clipId: string; newStart: number; newEnd: number }
  | { type: 'REMOVE_CLIP'; trackId: string; clipId: string }
  // Keyframes
  | { type: 'ADD_KEYFRAME'; trackId: string; clipId: string; keyframe: Keyframe }
  | { type: 'UPDATE_KEYFRAME'; trackId: string; clipId: string; kfId: string; values: Record<string, number> }
  | { type: 'REMOVE_KEYFRAME'; trackId: string; clipId: string; kfId: string }
  // Dwells
  | { type: 'ADD_DWELL'; dwell: Dwell }
  | { type: 'REMOVE_DWELL'; index: number }
  // Serialisation
  | { type: 'IMPORT_TIMELINE'; data: { tracks: Track[]; dwells: Dwell[] } }
  | { type: 'EXPORT_TIMELINE' }
  | { type: 'RESTORE_DEFAULTS' };
```

---

## 3. Camera libre — Integration

### Package : `camera-controls` (yomotsu)

Pas besoin de R3F / drei — on utilise Three.js pur dans notre SceneRenderer.

```typescript
import CameraControls from 'camera-controls';
CameraControls.install({ THREE });

// Dans SceneRenderer
const controls = new CameraControls(camera, renderer.domElement);

// Mode free : controls.enabled = true, keyframeSystem desactive
// Mode scroll : controls.enabled = false, keyframeSystem active
```

### Capture de keyframe

```typescript
function captureKeyframe(controls: CameraControls, atProgress: number): Keyframe {
  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  controls.getPosition(pos);
  controls.getTarget(target);

  return {
    id: crypto.randomUUID(),
    at: atProgress,
    values: {
      posX: pos.x, posY: pos.y, posZ: pos.z,
      lookAtX: target.x, lookAtY: target.y, lookAtZ: target.z,
      fov: camera.fov,
    },
    easing: 'smoothstep',
  };
}
```

### Raccourcis clavier

| Touche | Action |
|--------|--------|
| `F` (toggle) | Basculer entre mode scroll-driven et camera libre |
| `K` | Capturer un keyframe a la position progress actuelle |
| `Espace` | Play/pause le scrub automatique |
| Scroll molette (en mode libre) | Zoom |
| Middle-click drag | Orbite |
| Shift + Middle-click | Pan |

---

## 4. Timeline UI — Composant

### Structure du composant

```
<TimelinePanel position="bottom" collapsible>
  ├─ <TimelineToolbar>
  │    ├─ Bouton play/pause
  │    ├─ Input progress numerique
  │    ├─ Bouton toggle haut/bas
  │    └─ Bouton add track
  │
  ├─ <TimelineTracks>
  │    ├─ <TrackRow name="Camera" type="camera" color="#4FC3F7">
  │    │    └─ <KeyframeDiamonds keyframes={[...]} />
  │    │
  │    ├─ <TrackRow name="Title" type="text-3d" color="#81C784">
  │    │    └─ <ClipBar start={0} end={0.44} phases={enter/steady/exit} />
  │    │
  │    ├─ <TrackRow name="Subtitle" type="text-3d" color="#AED581">
  │    │    └─ <ClipBar start={0.05} end={0.47} phases={enter/steady/exit} />
  │    │
  │    └─ <TrackRow name="Card" type="html-element" color="#FFB74D">
  │         └─ <ClipBar start={0.685} end={0.783} />
  │
  ├─ <DwellMarkers dwells={[{at: 0.3}, {at: 0.685}]} />
  │
  └─ <TimelineCursor progress={0.42} draggable />
</TimelinePanel>
```

### Fonctionnalites

**V1 (MVP) :**
- Affichage des tracks avec clips colores
- Curseur scrub draggable
- Losanges pour les keyframes camera
- Bandes verticales pour les dwells
- Hover = tooltip avec valeurs

**V2 (futur) :**
- Drag les bords des clips pour ajuster timings
- Drag les keyframes camera
- Curve editor pour les easings
- Add/remove tracks
- Import/export JSON de la timeline complete

---

## 5. Reduction des onglets DevPanel

### Regroupement

```typescript
// Avant
const TABS = ['Presets', 'Bloom', 'Neon', 'Lighting', 'PBR', 'Materials',
              'Scene', 'Perf', 'Reveal', 'Model', 'Steering',
              'ScrollText', 'CamPath', 'Card'] as const;

// Apres
const TABS = ['Presets', 'Visual', 'Scene', 'Effects', 'Perf'] as const;
// + TimelinePanel separee (hors onglets, c'est sa propre barre en bas/haut)
```

**Visual** = Bloom + Lighting + PBR + Materials (sous-sections depliables)
**Scene** = Model + position (sliders quand camera libre)
**Effects** = Neon + Reveal + Steering

La **Timeline** n'est PAS un onglet — c'est un panneau independant ancre en bas (ou haut).

---

## 6. Fichiers a creer / modifier

### Nouveaux fichiers

| Fichier | Contenu |
|---------|---------|
| `machines/timelineMachine.ts` | Machine XState unique pour la timeline |
| `hooks/useTimeline.ts` | Hook React pour interagir avec la timeline |
| `components/TimelinePanel.tsx` | UI du panneau timeline |
| `components/TimelineTrack.tsx` | Composant track/clip/keyframe |
| `components/TimelineCursor.tsx` | Curseur scrub draggable |

### Fichiers a modifier

| Fichier | Changement |
|---------|------------|
| `applicationMachine.ts` | Remplacer 3 actors par 1 timelineActor |
| `useOvermind.ts` | Exposer timelineActor au lieu de 3 actors |
| `OvermindOverlay.tsx` | ScrollBridge envoie a 1 seul actor |
| `SceneRenderer.tsx` | Integrer camera-controls, lire computed du timelineActor |
| `DevControlPanel.tsx` | Regrouper onglets, retirer ScrollText/CamPath/Card |
| `ScrollCard.tsx` | Lire l'etat depuis timelineActor.computed |
| `App.tsx` | Dwells lus depuis timelineActor (plus de constantes en dur) |

### Fichiers a supprimer (absorbes par timelineMachine)

| Fichier | Raison |
|---------|--------|
| `machines/scrollTextMachine.ts` | → Track "text-3d" dans timelineMachine |
| `machines/cameraKeyframeMachine.ts` | → Track "camera" dans timelineMachine |
| `machines/scrollCardMachine.ts` | → Track "html-element" dans timelineMachine |
| `hooks/useScrollText.ts` | → useTimeline |
| `hooks/useCameraKeyframes.ts` | → useTimeline |
| `hooks/useScrollCard.ts` | → useTimeline |
| `scene/cameraKeyframes.ts` | → logique dans timelineMachine ou utilitaire |
| `scene/scrollText.ts` | → logique dans timelineMachine ou utilitaire |
