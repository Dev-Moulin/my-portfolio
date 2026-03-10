# Phase B — Vue Libre + Toggle (touche 0)

## Objectif

Permettre de basculer entre la vue caméra (animée par keyframes) et une vue libre (OrbitControls) pour inspecter la scène. Un CameraHelper affiche le frustum de la caméra animée quand on est en vue libre.

## Deux modes

### Mode "Camera View" (défaut)
- La caméra est pilotée par les keyframes (comportement actuel)
- Pas d'OrbitControls
- C'est ce que le visiteur voit en production

### Mode "Free View" (touche 0)
- OrbitControls activés sur une caméra secondaire ("debugCamera")
- La caméra animée continue de recevoir les keyframes mais n'est plus utilisée pour le rendu
- Un `THREE.CameraHelper` est ajouté à la scène pour visualiser le frustum de la caméra animée
- On peut orbiter librement pour voir la scène sous tous les angles
- La grille au sol (optionnelle) aide à se repérer

## Raccourci

- **Touche 0** (zéro, clavier normal — compatible laptop sans pavé numérique)
- Toggle entre les deux modes
- Indicateur visuel dans le coin de l'écran : "Camera View" / "Free View"

## Architecture

```
sceneSetup.ts
  ├── camera (PerspectiveCamera) — toujours animée par keyframes
  └── debugCamera (PerspectiveCamera) — utilisée en mode Free View

SceneRenderer.tsx
  ├── Si mode "camera" → composer.render() avec camera
  └── Si mode "free"  → composer.render() avec debugCamera
                        + CameraHelper visible (frustum de camera)
                        + OrbitControls sur debugCamera
```

### Machine XState v5 (OBLIGATOIRE — tout état passe par XState)

Étendre la `cameraMachine` créée en Phase A :

```ts
// Ajout au context de cameraMachine
context: {
  fov: 45, near: 0.1, far: 100,  // Phase A
  viewMode: 'camera' as 'camera' | 'free',  // Phase B
},

// Events additionnels
| { type: 'TOGGLE_VIEW_MODE' }
| { type: 'SET_VIEW_MODE'; mode: 'camera' | 'free' }

// Handlers
TOGGLE_VIEW_MODE: {
  actions: assign({
    viewMode: ({ context }) => context.viewMode === 'camera' ? 'free' : 'camera',
  }),
},
SET_VIEW_MODE: {
  actions: assign({ viewMode: ({ event }) => event.mode }),
},
```

- Hook `useCamera()` expose aussi `viewMode` via `useSelector`
- `actorRef.send({ type: 'TOGGLE_VIEW_MODE' })` depuis le raccourci touche 0

### OrbitControls

```ts
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Créés une fois, activés/désactivés selon le mode
const orbitControls = new OrbitControls(debugCamera, renderer.domElement);
orbitControls.enabled = false; // par défaut

// En mode free :
orbitControls.enabled = true;
orbitControls.target.copy(camera.position); // centré sur la caméra animée
```

### CameraHelper

```ts
const cameraHelper = new THREE.CameraHelper(camera);
scene.add(cameraHelper);
cameraHelper.visible = false; // visible seulement en mode free

// Dans la boucle d'animation :
if (viewMode === 'free') {
  camera.updateProjectionMatrix();
  cameraHelper.update();
  cameraHelper.visible = true;
} else {
  cameraHelper.visible = false;
}
```

## Interaction avec Phase A

Les sliders FOV/near/far de la Phase A affectent `camera` (la caméra animée). En mode Free View, on voit immédiatement l'effet sur le frustum via le CameraHelper.

## Fichiers à modifier / créer

- `packages/overmind-3d/src/scene/sceneSetup.ts` — créer debugCamera
- `packages/overmind-3d/src/scene/SceneRenderer.tsx` — toggle rendu, OrbitControls, CameraHelper
- `packages/overmind-3d/src/scene/keyboardGlobal.ts` — raccourci touche 0
- `packages/overmind-3d/src/machines/` — viewMode state
- `packages/overmind-3d/src/scene/types.ts` — ajouter debugCamera au SceneSetupResult

## Estimation

Complexité : moyenne — nécessite la gestion de deux caméras + OrbitControls + CameraHelper
