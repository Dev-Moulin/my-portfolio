# Recherche : Libs, Patterns & Best Practices

## 1. Libraries de timeline pour le web

### Theatre.js — la reference animation 3D web

- **Packages :** `@theatre/core` + `@theatre/studio` + `@theatre/r3f`
- **Repo :** github.com/theatre-js/theatre
- **Site :** theatrejs.com

Architecture Theatre.js :
- **Project** : conteneur racine (serialise en JSON)
- **Sheet** : regroupe des objets animes (= une scene)
- **Sheet Object** : un objet anime avec des props typees
- **Sequence** : une timeline unique par Sheet contenant tous les keyframes

Le studio integre fournit un editeur complet (dope sheet, curve editor, scrub temps reel). Export/import JSON.

**Pattern scroll-driven avec Theatre.js :**
```typescript
// Lie la position de la sequence au scroll offset
sheet.sequence.position = scroll.offset * sequenceLength;
```
Pas de lerp supplementaire — le scroll pilote directement la sequence.

**Verdict :** Theatre.js est la Rolls de l'animation 3D web mais c'est un framework complet qu'on importe tel quel. On ne va pas l'utiliser directement mais s'en inspirer fortement pour le modele de donnees et l'UX timeline.

### react-timeline-editor — composant React NLE

- **Package :** `@xzdarcy/react-timeline-editor`
- **Repo :** github.com/xzdarcy/react-timeline-editor

Composant React le plus pertinent pour construire une timeline custom. Fonctionnalites :
- **Tracks (rows)** avec clips positionnables
- **Drag & scale** des clips
- **Grid snapping**
- **Hooks de controle** (lecture, scrub, pause)
- API `TimelineRow`, `TimelineEffect` ouverte

**Verdict :** Bon candidat comme base pour notre timeline. Fournit les primitives visuelles (barre, pistes, curseur) tout en laissant le modele de donnees ouvert.

### Autres libs notables

| Package | Usage |
|---------|-------|
| `bezier-easing` | Courbes cubic-bezier custom pour easing |
| `react-chrono` | Timeline visuelle chronologique (pas animation) |
| `react-sequencer` | Choreographie d'etats via hook |

---

## 2. Navigation camera Three.js

### Comparatif des controles

| Controles | Type | Forces | Faiblesses |
|-----------|------|--------|------------|
| `OrbitControls` | Orbite autour d'un target | Simple, intuitif | Pas de deplacement libre |
| `FlyControls` | Vol libre WASD/souris | Liberte totale | Complexe a combiner avec scroll-driven |
| `PointerLockControls` | FPS (lock curseur) | Immersif | UX intrusive |
| **`camera-controls`** | **Hybride orbit/pan/zoom** | **Le plus complet, transitions lisses, save/restore natif** | Dep tierce |

### camera-controls (yomotsu) — recommande

- **Package :** `camera-controls`
- **Repo :** github.com/yomotsu/camera-controls
- **Wrapper drei :** `@react-three/drei` (`<CameraControls />`)

Superieur a OrbitControls car il offre :
- `getPosition(vec3)` / `getTarget(vec3)` — recuperer l'etat camera
- `saveState()` / `reset()` — sauvegarder/restaurer
- `setLookAt(px, py, pz, tx, ty, tz, transition)` — positionner avec transition
- Transitions lisses integrees entre etats
- Pas de "saut" au switch entre modes (probleme connu avec FlyControls → OrbitControls)

### Pattern toggle camera libre / animee

```typescript
// Mode free : desactiver keyframes, activer controls
keyframeSystem.setEnabled(false);
controls.enabled = true;

// Capturer un keyframe : lire la position actuelle
const pos = controls.getPosition(new THREE.Vector3());
const target = controls.getTarget(new THREE.Vector3());
const keyframe = { at: progress, posX: pos.x, ... lookAtX: target.x, ... fov: camera.fov };

// Retour mode scroll-driven : desactiver controls, reactiver keyframes
controls.enabled = false;
keyframeSystem.setEnabled(true);
```

### Gizmo d'orientation

- **Package :** `ThreeOrbitControlsGizmo` (github.com/Fennec-hub/ThreeOrbitControlsGizmo)
- Widget leger style Blender pour l'orientation de la camera

---

## 3. Scroll-driven animation best practices

### Le probleme du double-smoothing

Notre code actuel applique un lerp dans chaque systeme :
```typescript
this.currentProgress = lerp(this.currentProgress, this.targetProgress, lerpSpeed);
```

Si le scroll est deja lisse en amont (par Lenis, GSAP ScrollSmoother, ou meme le navigateur), c'est un **double smoothing** qui cause :
- Retard perceptible ("la camera traine")
- Perte de reactivite
- Jitter sur mobile

**Solution :** Supprimer le lerp interne et utiliser directement `targetProgress`. Le smoothing doit etre fait une seule fois, a la source.

### Lenis — smooth scroll de reference

- **Package :** `lenis` (anciennement `@studio-freight/lenis`)
- **Repo :** github.com/darkroomengineering/lenis
- Sync avec la render loop Three.js via `addEffect()`

### Performance scroll + Three.js

- Cible : < 100 draw calls pour 60fps fluide
- WebGPU supporte partout depuis Safari 26 (sept 2025)
- Compression : Draco (geometrie) + KTX2 (textures)
- Mesure : `stats-gl` + `renderer.info`
- Mobile : desactiver smooth scroll et effets lourds

---

## 4. Modele de donnees timeline

### Architecture standard Track/Clip/Keyframe

Modele consensuel tire de Theatre.js, Unity Timeline, Unreal Sequencer :

```typescript
interface TimelineProject {
  duration: number;       // 0-1 pour scroll-progress
  tracks: Track[];
}

interface Track {
  id: string;
  name: string;
  type: 'camera' | 'text-3d' | 'html-element' | 'visibility' | 'custom';
  targetRef: string;      // reference a l'objet anime
  clips: Clip[];
  color: string;          // couleur dans l'editeur
  locked: boolean;
  visible: boolean;
}

interface Clip {
  id: string;
  start: number;          // debut (0-1)
  end: number;            // fin (0-1)
  keyframes: Keyframe[];
  easing: EasingDefinition;
}

interface Keyframe {
  id: string;
  at: number;             // position relative dans le clip (0-1)
  values: Record<string, number | string | boolean>;
  easing: EasingDefinition;
}

interface EasingDefinition {
  type: 'preset' | 'cubic-bezier';
  preset?: 'linear' | 'ease-in' | 'ease-out' | 'smoothstep';
  controlPoints?: [number, number, number, number];
}
```

### Mapping avec notre systeme actuel

| Notre concept actuel | Equivalent timeline |
|---|---|
| `CameraKeyframe[]` | Track "camera" avec keyframes |
| `TextElementLayout` (5 phases) | Track "title" avec 1 clip (enter→steady→exit = 3 sous-keyframes) |
| `CARD_SCROLL_START/END` | Track "card" avec 1 clip d'entree |
| `DWELLS[]` | Markers/regions sur la timeline (pas des tracks) |
| `scrollTextMachine` | Track handler pour type "text-3d" |
| `cameraKeyframeMachine` | Track handler pour type "camera" |
| `scrollCardMachine` | Track handler pour type "html-element" |

---

## Sources

- Theatre.js : theatrejs.com, github.com/theatre-js/theatre
- react-timeline-editor : github.com/xzdarcy/react-timeline-editor
- camera-controls : github.com/yomotsu/camera-controls
- Lenis : github.com/darkroomengineering/lenis
- r3f-scroll-rig : github.com/14islands/r3f-scroll-rig
- bezier-easing : github.com/gre/bezier-easing
- Codrops - Camera Fly-through with Theatre.js (fev 2023)
- Codrops - Cinematic 3D Scroll with GSAP (nov 2025)
- 100 Three.js Performance Tips (2026)
