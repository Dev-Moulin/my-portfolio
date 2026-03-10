# Plan Phase C — Gros morceaux

## Vue d'ensemble

Phase C contient les 3 chantiers les plus complexes de la roadmap :

1. **#2 Eye Path Bézier** — Courbes Bézier avec handles, follow path, assignation générique
2. **#4 Outliner contextuel** — Properties Panel adaptatif à la Blender
3. **#8 Phase 2-4** — Migration des onglets Dev Panel vers l'Outliner contextuel

---

## C.1 — #2 Eye Path Bézier (6 étapes)

### Objectif

Passer de CatmullRom (courbe auto) à CubicBezier (courbe contrôlable avec handles) pour toutes les courbes de l'app. Rendre le follow path assignable à n'importe quel objet.

### Prérequis : Phase B #7 Modes (Tab = Edit Mode)

### Étapes progressives

#### Étape 1 — Handles data + conversion + rendu
- **Data model** : ajouter `handleIn: {x,y,z}`, `handleOut: {x,y,z}`, `handleType: 'auto'|'aligned'|'free'` à `EyePathPoint`
- **Auto-calc** : conversion CatmullRom → Bézier exacte (`handleOut = P + T/3`)
- **Rendu 3D** : sphères plus petites pour handles + lignes point↔handle
- **CurvePath** + `CubicBezierCurve3` remplace `CatmullRomCurve3`
- **La courbe garde la même forme** — pur changement de représentation

Fichiers : `machines/timeline/types.ts`, `scene/eyePathSystem.ts`, `machines/timeline/compute.ts`

#### Étape 2 — Math CubicBezier dans compute.ts
- Remplacer `catmullRomPoint()` par évaluation Bézier cubique directe
- Remplacer l'arc-length CatmullRom par Three.js `CurvePath.getPointAt(u)`
- Garder le système de dwells, blend, smoothstep existant
- ~120 lignes de math à réécrire

Fichiers : `machines/timeline/compute.ts`

#### Étape 3 — Types de handles + menu V
- **3 types** : Auto (jaune), Aligned (rose), Free (noir)
- Auto → Aligned automatiquement quand on drag un handle
- Menu V pour changer le type (réutiliser pattern de EasingMenu)
- Contraintes Aligned : handles colinéaires, longueurs indépendantes
- Contraintes Free : handles totalement indépendants

Fichiers : `scene/keyboardHandler.ts`, `scene/eyePathSystem.ts`, `scene/selectionSystem.ts`

#### Étape 4 — Workflow simplifié (modes)
- Tab = toggle Edit Mode sur la courbe (remplace Shift+C)
- E = extrude (contextuel en Edit Mode)
- Subdivide via menu contextuel
- Intégration avec `interactionModeMachine` de Phase B

Fichiers : `scene/keyboardHandler.ts` (section editMode curve)

#### Étape 5 — Follow Path générique
- Constraint "Follow Path" assignable à tout objet
- Paramètre position (0-1) + Influence (0-1) dans la timeline
- Piste timeline dédiée par assignation objet→courbe
- UI pour assigner/désassigner

Fichiers : `machines/timelineMachine.ts`, `scene/animationLoop.ts`, nouveaux fichiers constraint

#### Étape 6 — Blend semi-autonome + suppression Eye WP
- Influence max réglable (0.8 par défaut pour Eye)
- L'Eye regarde dans la direction de la tangente (automatique)
- Supprimer le système Eye WP (events, machine, bridge, piste timeline)
- Nettoyer le code eye waypoint dans compute.ts, keyboardHandler.ts, etc.

Fichiers : `machines/timelineMachine.ts`, `scene/animationLoop.ts`, `scene/keyboardHandler.ts`

### Complexité : Très élevée

Chaque étape est testable indépendamment. L'étape 2 (math) est la plus technique.

---

## C.2 — #4 Outliner contextuel (Properties Panel)

### Objectif

Remplacer les onglets fixes du Dev Panel par un panneau de propriétés contextuel qui s'adapte à l'objet sélectionné.

### Prérequis : Phase A #8a (suppressions initiales), Phase B #7 (modes)

### Architecture

```
components/propertiesPanel/
  PropertiesPanel.tsx       ← switch contextuel principal
  uiRegistry.ts             ← Map<string, React.FC>
  registerAll.ts            ← enregistrement side-effect
  types.ts                  ← InstanceHook, MixedValue
  panels/
    NeonPropertiesPanel.tsx
    TextPropertiesPanel.tsx
    LightPropertiesPanel.tsx
    CardPropertiesPanel.tsx
    CurvePropertiesPanel.tsx
  shared/
    CollapsibleSection.tsx
    SliderRow.tsx
    MixedNumberField.tsx
    ColorRow.tsx
```

### Étapes

1. **uiRegistry** : `Map<string, React.FC<{ selectedIds: string[] }>>` + `registerAll.ts`
2. **PropertiesPanel.tsx** : switch sur `selectedIds.length` → 0=SceneOverview, 1=SingleObject (via registry), N=MultiSelection
3. **Panels par type** : migrer les réglages depuis les onglets Dev Panel existants
4. **Multi-sélection** : `mergeConfigs()` → valeurs communes ou "mixed"
5. **Intégration** : remplacer OutlinerTab dans le Dev Panel par PropertiesPanel

### Complexité : Élevée

Le nombre de fichiers est important mais chaque panel est indépendant. La multi-sélection est la partie la plus complexe.

---

## C.3 — #8 Phase 2-4 (Migration Dev Panel)

### Objectif

Migrer les onglets restants du Dev Panel vers l'Outliner contextuel, en ne gardant que les onglets globaux (Presets, Bloom, Lighting, PBR, Materials, Scene, Perf, Reveal, Model, Steering).

### Prérequis : C.2 Outliner contextuel opérationnel

### Phases

#### Phase 2 — Setup Properties Panel
- Intégrer PropertiesPanel dans le layout
- Wiring avec selectionActor + componentRegistry

#### Phase 3 — Migrer les systèmes
- ScrollText → TextPropertiesPanel
- Neon → NeonPropertiesPanel
- Card → CardPropertiesPanel

#### Phase 4 — Finaliser
- Supprimer les imports orphelins dans DevControlPanel
- TABS array final : `['Presets', 'Bloom', 'Neon', 'Lighting', 'PBR', 'Materials', 'Scene', 'Perf', 'Reveal', 'Model', 'Steering']`
- L'onglet "Neon" global reste (paramètres globaux comme flowSpeed, globalIntensity) — les réglages par-instance vont dans le panel contextuel

### Complexité : Moyenne (migration, pas de nouvelle logique)

---

## Ordre d'implémentation Phase C

1. **#2 Étapes 1-3** (handles + math + types) — peut commencer dès que #7 est fait
2. **#4 Outliner contextuel** — peut commencer en parallèle de #2
3. **#2 Étapes 4-6** (workflow + follow path + blend) — après #7 modes bien stabilisé
4. **#8 Phases 2-4** — après #4 opérationnel

Le travail peut être parallélisé : Bézier math (#2 étapes 1-2) et uiRegistry (#4 étapes 1-2) sont indépendants.
