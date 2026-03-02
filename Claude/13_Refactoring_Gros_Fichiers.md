# Analyse Refactoring — Fichiers > 900 lignes

Pré-requis de la Phase 9.0. Découper les fichiers monolithiques avant de commencer l'architecture composants.

---

## Résumé

| Fichier | Lignes | Priorité | Complexité |
|---------|--------|----------|------------|
| SceneRenderer.tsx | 1543 | Critique | Haute |
| timelineMachine.ts | 1069 | Haute | Moyenne |
| selectionSystem.ts | 950 | Moyenne | Moyenne |
| TimelinePanel.tsx | 937 | Moyenne | Moyenne |

---

## 1. SceneRenderer.tsx (1543 lignes) — GOD OBJECT

### Problème

Un seul `useEffect` de ~1460 lignes contient **tout** : init scène, animation loop, keyboard handlers, duplication, undo, save/load, steering, gizmos. 13 responsabilités mélangées.

### Plan de découpe

| Nouveau fichier | Lignes extraites | Responsabilité |
|----------------|-----------------|----------------|
| `scene/sceneInit.ts` | 74–156 | Création scène, renderer, composer, lumières, helpers |
| `scene/steeringSetup.ts` | 1193–1287 | Vehicle Yuka, behaviors, subscription steeringActor |
| `scene/animationLoop.ts` | 1298–1487 | Boucle render, toutes les mises à jour par frame |
| `scene/keyboardHandlers.ts` | 416–748 | Tous les handlers clavier (G/R/S, Shift+D, Delete, etc.) |
| `scene/gizmoSync.ts` | 779–887 | Callbacks onObjectChange / onMultiObjectChange |
| `scene/selectionCallbacks.ts` | 889–1002 | Callbacks sélection, drag, HUD, card portals |
| `scene/sceneSaveLoad.ts` | 1066–1171 | Save/load sérialisation + réconciliation instances |
| `scene/configBridge.ts` | 1005–1063 | Visibility bridge + devPanel config updates |

### Résultat attendu

SceneRenderer.tsx devient un **orchestrateur** qui :
1. Importe et appelle les modules ci-dessus
2. Gère les refs/state React
3. Retourne le JSX (container + portails)

~200–300 lignes au lieu de 1543.

---

## 2. timelineMachine.ts (1069 lignes) — 3 couches mélangées

### Problème

Types, fonctions de calcul pures, et machine XState dans le même fichier. 48 event handlers inline.

### Plan de découpe

| Nouveau fichier | Lignes | Responsabilité |
|----------------|--------|----------------|
| `machines/timeline/types.ts` | 10–148, 564–668 | ~250 lignes de types + interfaces |
| `machines/timeline/compute.ts` | 156–560 | Fonctions pures (lerp, interpolation, recompute) |
| `machines/timeline/defaults.ts` | 149–154, 416–459, 690–728 | Constantes + valeurs par défaut |
| `machines/timeline/machine.ts` | 732–1069 | La machine XState uniquement |
| `machines/timeline/index.ts` | — | Ré-export public |

### Détail compute.ts

Peut encore être split si trop gros :
- `compute/element.ts` — computeElementState, computeCardState
- `compute/camera.ts` — computeCameraState
- `compute/visual.ts` — lerpVisualState, lerpColor, computeVisualState
- `compute/transform.ts` — computeElementTrackTransform
- `compute/eye.ts` — computeEyeWaypointTarget
- `compute/index.ts` — recompute() orchestrateur

---

## 3. selectionSystem.ts (950 lignes)

### Problème

La classe SelectionSystem accumule 3 "modaux" (sélection, numeric rotation, custom scale) + multi-select delta propagation.

### Plan de découpe

| Nouveau fichier | Lignes | Responsabilité |
|----------------|--------|----------------|
| `scene/modals/NumericRotationModal.ts` | 498–682 | 185 lignes — mode rotation numérique |
| `scene/modals/CustomScaleModal.ts` | 684–933 | 250 lignes — mode scale modal |
| `scene/selectionSystem.ts` | reste | ~515 lignes — core sélection + gizmo + multi-select |

### Avantage

Chaque modal devient une classe indépendante avec son propre état, ses listeners, et sa méthode dispose(). Le SelectionSystem leur délègue via `enterNumericRotation()` / `enterCustomScale()`.

---

## 4. TimelinePanel.tsx (937 lignes)

### Problème

Composant monolithique avec 8 concerns : drag (8 modes), hover (4 states), zoom/pan, keyboard, rendering par type de track, export/import.

### Plan de découpe

| Nouveau fichier | Lignes | Responsabilité |
|----------------|--------|----------------|
| `timeline/hooks/useTimelineDrag.ts` | 178–331 | Hook custom pour les 8 modes de drag |
| `timeline/hooks/useTimelineViewport.ts` | 333–377 | Zoom, pan, scroll |
| `timeline/hooks/useTimelineKeyboard.ts` | 379–484 | Raccourcis clavier (I, D, Ctrl+D, W) |
| `timeline/tracks/CameraTrack.tsx` | 557–579 | Rendu piste caméra |
| `timeline/tracks/EyeTrack.tsx` | 580–603 | Rendu piste eye waypoints |
| `timeline/tracks/TextTrack.tsx` | 604–668 | Rendu pistes title/subtitle |
| `timeline/tracks/CardTrack.tsx` | 670–702 | Rendu piste card |
| `timeline/tracks/VisualTrack.tsx` | 704–729 | Rendu piste visual keyframes |
| `timeline/tracks/ElementTrack.tsx` | 730–768 | Rendu pistes dynamiques |
| `timeline/timelineExportImport.ts` | 502–527 | Fonctions export/import |

### Résultat attendu

TimelinePanel.tsx devient un composant de ~250 lignes qui orchestre les hooks et les track renderers.

---

## Fichiers 500–900 lignes (surveillance)

| Fichier | Lignes | Action |
|---------|--------|--------|
| neonBands.ts | 536 | OK pour l'instant, bien structuré après Phase 8 |
| ScrollCard.tsx | 505 | À évaluer — possible split composant/logique |

---

## Ordre d'exécution recommandé

1. **timelineMachine.ts** — Le plus simple à découper (types/compute/machine sont déjà séparés logiquement)
2. **selectionSystem.ts** — Extraction des modaux (classes autonomes, refactoring mécanique)
3. **TimelinePanel.tsx** — Extraction des hooks et track renderers
4. **SceneRenderer.tsx** — Le plus complexe, à faire en dernier (beaucoup de dépendances croisées)

Chaque étape doit compiler (`pnpm type-check`) avant de passer à la suivante.
