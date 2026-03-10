# Phase C — Mini Viewport Debug (PIP)

## Objectif

Un mini viewport overlay (Picture-in-Picture) qui affiche une vue "bird's eye" de la scène avec le frustum de la caméra visible. Deux tailles disponibles. Orbit interactif dans le PIP.

## Fonctionnalités

### Vue debug
- Caméra ortho ou perspective dézoomée
- Affiche : grille au sol, frustum caméra (CameraHelper), bounding boxes des objets, axes
- Vue par défaut : 3/4 plongeant (isométrique-like)

### Deux tailles
- **Taille S** : ~200×150px — coin bas-droite, au-dessus de la timeline. Juste pour se repérer
- **Taille L** : ~400×300px — même position, plus grand pour travailler confortablement
- Toggle entre les deux via un bouton sur le PIP ou raccourci clavier

### Interaction dans le PIP
- **Orbit** : clic gauche + drag dans le PIP = orbiter la vue debug (OrbitControls dédiés)
- **Zoom** : molette dans le PIP = zoom de la vue debug
- Les interactions dans le PIP ne doivent PAS affecter la scène principale

### Masquable
- Bouton pour cacher/montrer le PIP
- Raccourci clavier (ex: **P** pour PIP toggle)

## Architecture technique

### Rendu split viewport

Three.js supporte le rendu en deux passes avec `setViewport` et `setScissor` :

```ts
// 1. Rendu principal (plein écran)
renderer.setViewport(0, 0, width, height);
renderer.setScissor(0, 0, width, height);
renderer.setScissorTest(true);
composer.render(); // avec camera principale ou debugCamera

// 2. Rendu PIP (coin)
const pipW = pipSize === 'S' ? 200 : 400;
const pipH = pipSize === 'S' ? 150 : 300;
const pipX = width - pipW - 10;
const pipY = timelineHeight + 10; // au-dessus de la timeline
renderer.setViewport(pipX, pipY, pipW, pipH);
renderer.setScissor(pipX, pipY, pipW, pipH);
renderer.render(scene, pipCamera); // rendu simple (pas de post-process)
```

### PIP Camera

```ts
// Caméra ortho pour vue debug dézoomée
const pipCamera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 1000);
pipCamera.position.set(30, 30, 30);
pipCamera.lookAt(0, 0, 0);

// OrbitControls dédiés au PIP
// Nécessite un élément DOM overlay transparent positionné sur le PIP
const pipControls = new OrbitControls(pipCamera, pipOverlayElement);
```

### Éléments visuels dans le PIP

- `THREE.CameraHelper(camera)` — frustum de la caméra animée (réutilisé de Phase B)
- `THREE.GridHelper(50, 50)` — grille au sol
- `THREE.AxesHelper(5)` — axes XYZ à l'origine
- Optionnel : wireframe bounding boxes des objets principaux

### Overlay DOM pour les interactions PIP

Un `<div>` transparent positionné par-dessus le PIP canvas pour capturer les événements souris sans interférer avec la scène principale :

```tsx
<div style={{
  position: 'fixed',
  right: 10,
  bottom: timelineHeight + 10,
  width: pipW,
  height: pipH,
  pointerEvents: 'auto', // capture les events dans le PIP
  zIndex: 9999,
}}>
  {/* Boutons : taille S/L, fermer */}
  <div style={{ position: 'absolute', top: 2, right: 2 }}>
    <button onClick={toggleSize}>S/L</button>
    <button onClick={closePip}>×</button>
  </div>
</div>
```

## Machine XState v5 (OBLIGATOIRE — tout état passe par XState)

Étendre la `cameraMachine` (Phase A+B) avec l'état PIP :

```ts
// Ajout au context de cameraMachine
context: {
  fov: 45, near: 0.1, far: 100,       // Phase A
  viewMode: 'camera' as 'camera' | 'free',  // Phase B
  pipVisible: false,                    // Phase C
  pipSize: 'S' as 'S' | 'L',          // Phase C
},

// Events additionnels
| { type: 'TOGGLE_PIP' }
| { type: 'SET_PIP_SIZE'; size: 'S' | 'L' }

// Handlers
TOGGLE_PIP: {
  actions: assign({ pipVisible: ({ context }) => !context.pipVisible }),
},
SET_PIP_SIZE: {
  actions: assign({ pipSize: ({ event }) => event.size }),
},
```

- Hook `useCamera()` expose `pipVisible` et `pipSize` via `useSelector`
- `actorRef.send({ type: 'TOGGLE_PIP' })` depuis le raccourci P

## Interaction avec les autres phases

- **Phase A** : les changements FOV/near/far sont immédiatement visibles dans le frustum du PIP
- **Phase B** : le CameraHelper est partagé entre le mode Free View et le PIP
- **Phase D** : le PIP montrera l'offset du monde (floating origin) — les objets bougent, la caméra reste au centre

## Fichiers à modifier / créer

- `packages/overmind-3d/src/scene/sceneSetup.ts` — créer pipCamera, GridHelper, AxesHelper
- `packages/overmind-3d/src/scene/SceneRenderer.tsx` — double rendu (viewport + PIP)
- `packages/overmind-3d/src/scene/pipViewport.ts` — (nouveau) logique PIP, OrbitControls dédiés
- `packages/overmind-3d/src/components/PipOverlay.tsx` — (nouveau) overlay DOM pour boutons + events
- `packages/overmind-3d/src/machines/` — état PIP
- `packages/overmind-3d/src/scene/keyboardGlobal.ts` — raccourci P

## Estimation

Complexité : élevée — double rendu, overlay DOM, OrbitControls séparés, gestion des events
