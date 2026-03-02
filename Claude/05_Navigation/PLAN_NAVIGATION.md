# Phase 5 — Navigation (Free Camera)

## Contexte

En mode free camera (touche F), la navigation peut devenir frustrante :
- Le zoom "coince" quand on s'éloigne trop (le pivot point de camera-controls est loin)
- Pas de moyen rapide de recentrer sur un objet sélectionné
- Pas de moyen de reset la vue sur toute la scène

Cette phase ajoute deux raccourcis inspirés de Blender pour améliorer l'expérience d'authoring.

## Raccourcis

| Touche | Action | Blender équivalent |
|--------|--------|-------------------|
| **T** | Frame Selected — recentre sur l'objet sélectionné | Numpad `.` |
| **H** | Frame All — recentre sur toute la scène | `Home` |

Les deux ne fonctionnent qu'en **mode free camera** (F activé).

## Fichier impacté

- `packages/overmind-3d/src/scene/SceneRenderer.tsx`

## Sous-phase 1 : Frame Selected (T)

### Comportement
1. Condition : `freeCameraActive && selection.getSelectedId()`
2. Récupérer l'Object3D sélectionné via `selection.getSelectedObject()`
3. Calculer sa bounding box (`new THREE.Box3().setFromObject(obj)`)
4. Utiliser `cameraControls.fitToBox(box3, true)` — le `true` active la transition animée
5. Ça repositionne le pivot point de camera-controls sur le centre de l'objet → le zoom redevient fluide

### Notes
- `camera-controls` expose `fitToBox(box3: Box3, enableTransition: boolean, options?)`
- Le padding par défaut est correct, mais on peut ajuster avec `{ paddingLeft, paddingRight, paddingTop, paddingBottom }`
- Pour les lights (qui n'ont pas de geometry), créer une petite Box3 centrée sur la position

## Sous-phase 2 : Frame All (H)

### Comportement
1. Condition : `freeCameraActive`
2. Calculer la bounding box de toute la scène (`new THREE.Box3().setFromObject(scene)`)
3. Filtrer les helpers (grid, axes) pour ne pas fausser la box — ou utiliser une box pré-calculée
4. `cameraControls.fitToBox(sceneBox, true)`

### Notes
- La scène contient des objets très éloignés (grid helper 10x10, etc.) qui pourraient donner une box trop large
- Alternative simple : calculer la box uniquement sur les objets "utiles" (model, neon, scroll text, card)
- Ou utiliser `cameraControls.setLookAt(0, 1.5, 12, 0, 1, 0, true)` pour revenir à la vue initiale exacte

## Vérification

1. `pnpm type-check` → 0 erreurs
2. F → sélectionner un objet → T → la caméra anime vers l'objet, zoom correct
3. S'éloigner beaucoup → sélectionner → T → zoom redevient fluide
4. H → la caméra revient à une vue d'ensemble
5. T/H sans mode free camera → ne fait rien
6. T sans sélection → ne fait rien
