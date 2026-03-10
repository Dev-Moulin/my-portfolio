# Phase 2 : Scroll-Driven Camera, Textes 3D & Card HTML

> Commit depuis : `81d4bc5` (Apply glassmorphism visual polish + bloom color picker)

---

## Systemes ajoutes

### 1. Scroll Progress & Dwell System (`apps/web/src/App.tsx`)

- `ScrollProgressEmitter` : ecoute le scroll natif, calcule un progress normalise (0-1), et emet un custom event `overmind:scroll-progress`
- `remapProgress()` : systeme multi-dwell qui "gele" le progress a des points cles du scroll pour laisser le temps a l'utilisateur de lire
  - Dwell a `0.300` (vue titre) — duree 10% du scroll brut
  - Dwell a `0.685` (apparition card) — duree 10% du scroll brut
- Architecture extensible : tableau `DWELLS` avec `{ at, duration }`

### 2. Camera Keyframe System (XState)

**Fichiers crees :**
- `packages/overmind-3d/src/machines/cameraKeyframeMachine.ts` — machine XState v5 avec contexte `keyframes[]`, `scrollProgress`, `enabled`
- `packages/overmind-3d/src/hooks/useCameraKeyframes.ts` — hook React pour interagir avec l'actor
- `packages/overmind-3d/src/scene/cameraKeyframes.ts` — `CameraKeyframeSystem` classe Three.js qui interpole position/lookAt/fov entre keyframes avec easing + smooth lerp

**Fonctionnalites :**
- Import/Export JSON des keyframes (ex: `camera-keyframes2.json` avec 4 keyframes)
- Interpolation avec easing configurable par keyframe (linear, easeIn, easeOut, smoothstep, etc.)
- Smooth lerp temporel pour eviter les sauts brusques

### 3. Scroll Text System (XState + Troika)

**Fichiers crees :**
- `packages/overmind-3d/src/machines/scrollTextMachine.ts` — machine XState avec `TextElementLayout` (enter + exit phases)
- `packages/overmind-3d/src/hooks/useScrollText.ts` — hook React
- `packages/overmind-3d/src/scene/scrollText.ts` — `ScrollTextSystem` utilisant `troika-three-text` pour du texte 3D dans la scene
- `packages/overmind-3d/src/types/troika-three-text.d.ts` — types TypeScript pour troika

**Animation 5 phases par element :**
1. Avant entree : position start, opacity 0
2. Entree : lerp start → end, opacity 0 → 1
3. Repos : position end, opacity 1
4. Sortie : lerp end → exit, opacity 1 → 0
5. Apres sortie : position exit, opacity 0

**Textes :**
- Titre "Paul Moulin" — entre de la gauche (offsetX = -20), sort en Z
- Sous-titre "Web3 Full-Stack Developer & 3D Enthusiast" — meme pattern, timings decales

### 4. ScrollCard System (XState + HTML glassmorphism)

**Fichiers crees :**
- `packages/overmind-3d/src/machines/scrollCardMachine.ts` — machine XState avec `enabled`, `posTop`, `posLeft`, `scrollProgress`
- `packages/overmind-3d/src/hooks/useScrollCard.ts` — hook React
- `packages/overmind-3d/src/components/ScrollCard.tsx` — composant React

**Fonctionnalites :**
- Card HTML glassmorphism positionnee en fixed (top 26.7%, left 83.6%)
- Entree scroll-driven de la droite vers la gauche (0.685 → 0.783) avec smoothstep
- Flip 3D CSS : face avant (presentation + liens) ↔ face arriere (CV)
- **Sequence flip → scale x3** : clic "View CV" → rotation 0.6s → agrandissement x3 0.4s
- L'agrandissement se fait vers le bas et la gauche (`transform-origin: top right`)
- Sequence inverse pour fermer : shrink → flip back
- Face avant : avatar, nom, role, liens GitHub/X/LinkedIn, bouton "View CV"
- Face arriere : contenu CV, boutons "Back" et "Download PDF"
- Off par defaut, activable via DevPanel

### 5. Easing Utilities

**Fichier cree :** `packages/overmind-3d/src/utils/easing.ts`
- 7 fonctions d'easing : linear, easeIn, easeOut, easeInOut, smoothstep, easeOutBack, easeOutElastic
- `EASING_MAP` et `EASING_OPTIONS` exportes pour usage dans machines et DevPanel

---

## Fichiers modifies (existants)

| Fichier | Changements |
|---------|-------------|
| `apps/web/src/App.tsx` | ScrollProgressEmitter + multi-dwell remapProgress |
| `apps/web/src/components/home/Home.tsx` | Section home videe (titre/sous-titre maintenant en 3D) |
| `apps/web/src/styles/global.css` | Classes `.hide-html-content` pour toggle visibilite HTML |
| `packages/overmind-3d/package.json` | Ajout dep `troika-three-text` |
| `packages/overmind-3d/src/components/DevControlPanel.tsx` | 3 nouveaux onglets (ScrollText, CamPath, Card) + scroll progress slider + import/export JSON + overscrollBehavior contain |
| `packages/overmind-3d/src/components/OvermindOverlay.tsx` | ScrollBridge (dispatch scroll aux 3 actors) + ScrollCard rendu |
| `packages/overmind-3d/src/hooks/useOvermind.ts` | Expose scrollTextActor, cameraKeyframeActor, scrollCardActor |
| `packages/overmind-3d/src/machines/applicationMachine.ts` | Spawn des 3 nouveaux actors enfants |
| `packages/overmind-3d/src/scene/SceneRenderer.tsx` | Integration ScrollTextSystem + CameraKeyframeSystem |
| `packages/overmind-3d/src/scene/MobileSceneRenderer.tsx` | Integration ScrollTextSystem + CameraKeyframeSystem |
| `packages/overmind-3d/src/utils/dracoPath.ts` | Correction chemin Draco |

---

## Fichiers de reference (Claude/)

- `Claude/keyframes/camera-keyframes.json` — 2 keyframes (0 → 0.300)
- `Claude/keyframes/camera-keyframes2.json` — 4 keyframes (0 → 0.300 → 0.44 → 0.685)
- `Claude/keyframes/scroll-text-layout.json` — positions titre/sous-titre exportees depuis DevPanel

---

## Architecture XState

Tous les nouveaux systemes suivent le pattern projet :

```
machine (xstate v5) → hook (useSelector/send) → actor (spawne par applicationMachine)
```

L'`applicationMachine` parent spawn maintenant 3 actors supplementaires :
- `scrollTextActor` (scrollTextMachine)
- `cameraKeyframeActor` (cameraKeyframeMachine)
- `scrollCardActor` (scrollCardMachine)

Communication app → overmind-3d via custom DOM events (`overmind:scroll-progress`, `overmind:set-bloom-color`), relayee par des bridges React dans `OvermindOverlay.tsx`.
