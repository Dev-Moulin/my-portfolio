# Phase A — Contrôles Caméra (near / far / FOV)

## Objectif

Ajouter des sliders dans le DevPanel pour contrôler le FOV, near et far de la caméra perspective. Ces valeurs pourront ensuite être animées par keyframes.

## Rappel : FOV vs Near vs Far

```
        near        far
         |           |
    \    |           |    /
     \   |   visible |   /
      \  |   volume  |  /
  FOV  \ |           | /
   ↕    \|___________|/
         camera
```

- **FOV** (Field of View) : angle d'ouverture vertical. Plus grand = grand angle. Plus petit = télé-objectif / zoom
- **Near** : distance minimum de rendu. Objets plus proches = clippés
- **Far** : distance maximum de rendu. Objets au-delà = invisibles

## Valeurs

| Paramètre | Min | Max | Défaut | Step |
|-----------|-----|-----|--------|------|
| FOV | 10° | 120° | 45° | 1 |
| Near | 0.001 | 10 | 0.1 | logarithmique |
| Far | 10 | 10000 | 100 | logarithmique |

## Implémentation

### 1. Machine XState (OBLIGATOIRE — tout état passe par XState)

Créer une machine `cameraMachine` (XState v5) ou étendre une machine existante :

```ts
// Machine XState v5
import { setup, assign } from 'xstate';

export const cameraMachine = setup({
  types: {
    context: {} as {
      fov: number;
      near: number;
      far: number;
    },
    events: {} as
      | { type: 'SET_FOV'; value: number }
      | { type: 'SET_NEAR'; value: number }
      | { type: 'SET_FAR'; value: number },
  },
}).createMachine({
  id: 'camera',
  context: { fov: 45, near: 0.1, far: 100 },
  on: {
    SET_FOV: { actions: assign({ fov: ({ event }) => event.value }) },
    SET_NEAR: { actions: assign({ near: ({ event }) => event.value }) },
    SET_FAR: { actions: assign({ far: ({ event }) => event.value }) },
  },
});
```

- Hook `useCamera()` avec `useSelector` pour lire fov/near/far
- `actorRef.send({ type: 'SET_FOV', value: 60 })` pour modifier

### 2. UI dans le DevPanel

Ajouter une section "Camera" dans l'onglet Properties (ou nouvel onglet) :
- Slider FOV avec valeur numérique
- Slider Near (échelle log)
- Slider Far (échelle log)

### 3. Appliquer à la caméra

Dans la boucle d'animation (SceneRenderer) :
```ts
camera.fov = fovFromMachine;
camera.near = nearFromMachine;
camera.far = farFromMachine;
camera.updateProjectionMatrix();
```

### 4. Optionnel futur : animer par keyframes

Les CameraKeyframes pourraient inclure `fov`, `near`, `far` pour des effets dramatiques (dolly zoom, etc.).

## Fichiers à modifier

- `packages/overmind-3d/src/machines/` — machine caméra ou scene (ajouter fov/near/far)
- `packages/overmind-3d/src/components/devPanel/tabs/PropertiesPanel.tsx` — section Camera UI
- `packages/overmind-3d/src/scene/SceneRenderer.tsx` — appliquer les valeurs à la caméra
- `packages/overmind-3d/src/scene/sceneSetup.ts` — valeurs initiales

## Estimation

Complexité : faible — ~1h de travail
