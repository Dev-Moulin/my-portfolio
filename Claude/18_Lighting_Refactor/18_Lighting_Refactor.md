# 18 — Lighting Refactor

## Problème actuel

Deux systèmes de lumières parallèles et découplés :

1. **Onglet Lighting** — `lightingMachine` (XState) contrôle 3 lumières globales fixes (ambient, directional, point) + exposure + HDR. Limitations : point light sans position dans l'UI, directional sans rotation, pas de suppression possible.

2. **Onglet Properties** — `componentRegistry` + `lightDescriptor` (impératif, pas XState) gère des lumières custom (point, dir, spot, area). Plus puissant mais découplé de XState.

**Résultat** : incohérences, doublons, code mort, UX confuse.

---

## Objectif

Un seul système de lumières, entièrement piloté par XState, dans un seul onglet, avec des paramètres proches de Blender.

---

## Architecture cible

```
LightingTab (UI React)
    ↕ useSelector() / send()
lightsMachine (XState v5)
    ↕ actions internes
componentRegistry + lightDescriptor (Three.js)
```

- **lightsMachine** = source de vérité (état réactif, undo-friendly)
- **componentRegistry** = couche d'exécution 3D (créer/supprimer les objets Three.js)
- **lightDescriptor** = adapté pour recevoir les nouveaux params (power, decay, etc.)

---

## lightsMachine — context

```typescript
interface LightsContext {
  // ── Environnement (global) ──
  ambientIntensity: number;       // 0–2, défaut 0.5
  ambientColor: string;           // défaut '#ffffff'
  exposure: number;               // toneMappingExposure, 0.5–3, défaut 1.0
  hdrBoostEnabled: boolean;       // défaut false
  hdrBoostMultiplier: number;     // 1–5, défaut 2.5
  currentPreset: string | null;

  // ── Lumières individuelles ──
  lights: Map<string, LightEntry>;

  // ── Refs Three.js (assignés au setup) ──
  ambientLight: THREE.AmbientLight | null;
  renderer: THREE.WebGLRenderer | null;
}

interface LightEntry {
  id: string;
  type: 'point' | 'directional' | 'spot' | 'area';
  power: number;            // en Watts (converti en intensity Three.js)
  color: string;
  // Position & rotation
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  // Point + Spot
  distance: number;         // 0 = infini (défaut)
  decay: number;            // 0/1/2, défaut 2 (physiquement correct)
  // Spot only
  angle: number;            // radians, défaut π/6
  penumbra: number;         // 0–1, défaut 0.3
  volumetric: boolean;
  // Area only
  areaWidth: number;
  areaHeight: number;
  // Track To
  trackToTargetId: string | null;
  trackToMaintainDistance: boolean;
  trackToFollowPosition: boolean;
}
```

---

## lightsMachine — events

```typescript
type LightsEvent =
  // Environnement
  | { type: 'SET_AMBIENT_INTENSITY'; value: number }
  | { type: 'SET_AMBIENT_COLOR'; color: string }
  | { type: 'SET_EXPOSURE'; value: number }
  | { type: 'TOGGLE_HDR_BOOST' }
  | { type: 'SET_HDR_MULTIPLIER'; value: number }
  | { type: 'APPLY_PRESET'; preset: string }
  // CRUD lumières
  | { type: 'ADD_LIGHT'; entry: LightEntry }
  | { type: 'REMOVE_LIGHT'; id: string }
  | { type: 'UPDATE_LIGHT'; id: string; patch: Partial<LightEntry> }
  // Sync depuis gizmo / transform
  | { type: 'SYNC_TRANSFORM'; id: string; position: Vec3; rotation: Vec3 }
  // Init refs
  | { type: 'SET_REFS'; ambientLight: THREE.AmbientLight; renderer: THREE.WebGLRenderer }
  // Save/Load
  | { type: 'RESTORE'; snapshot: LightsSnapshot }
```

---

## Conversion Power (Watts) → Intensity (Three.js)

Three.js attend des unités différentes selon le type :

| Type | Three.js unit | Conversion |
|------|---------------|------------|
| PointLight | candela (cd) | `intensity = power / (4 * Math.PI)` |
| SpotLight | candela (cd) | `intensity = power / (4 * Math.PI)` |
| DirectionalLight | lux (lx) | `intensity = power` (1:1, pas de conversion) |
| RectAreaLight | lux (lx) | `intensity = power / (width * height)` |

**Slider UI** : 0–1000 W (label "Power (W)")
**Valeurs typiques** :
- Lampe de bureau : 40–60 W
- Éclairage pièce : 100–300 W
- Soleil (directional) : 1–5 lux dans l'UI
- Projecteur spot : 200–1000 W

---

## Paramètres par type de lumière

### Point
| Param | Slider range | Défaut | Notes |
|-------|-------------|--------|-------|
| Power (W) | 0–1000 | 100 | → cd via / 4π |
| Color | picker | #ffffff | |
| Distance | 0–100 | 0 | 0 = portée infinie |
| Decay | 0–2 | 2 | 2 = physiquement correct |

### Directional (Sun)
| Param | Slider range | Défaut | Notes |
|-------|-------------|--------|-------|
| Power (lux) | 0–10 | 2 | Pas de conversion |
| Color | picker | #ffffff | |
| Rotation X/Y/Z | -180°–180° | 0 | Direction du soleil |
| Track To | pick | — | Optionnel |

### Spot
| Param | Slider range | Défaut | Notes |
|-------|-------------|--------|-------|
| Power (W) | 0–1000 | 200 | → cd via / 4π |
| Color | picker | #ffffff | |
| Distance | 0–100 | 0 | 0 = infini |
| Decay | 0–2 | 2 | |
| Angle | 1°–90° | 30° | Ouverture du cône |
| Penumbra | 0–1 | 0.3 | Dégradé bord |
| Volumetric | toggle | off | Cône volumétrique |
| Track To | pick | — | |

### Area
| Param | Slider range | Défaut | Notes |
|-------|-------------|--------|-------|
| Power (W) | 0–1000 | 100 | → lux via / (w×h) |
| Color | picker | #ffffff | |
| Width | 0.1–20 | 2 | Largeur panneau |
| Height | 0.1–20 | 2 | Hauteur panneau |

---

## UI — Onglet unifié

```
┌─── LIGHTING ─────────────────────────────┐
│                                          │
│ ▸ Environment                            │
│   Ambient     [────●──] 0.5  [■ color]   │
│   Exposure    [────●──] 1.0              │
│   HDR Boost   [✓]  ×[──●──] 2.5         │
│   Preset      [Studio Classic ▾]         │
│                                          │
│ ▸ Scene Lights              [+ Add ▾]   │
│                                          │
│   ▾ SpotLight_1                    [🗑]  │
│     Power (W)  [──────●──] 200           │
│     Color [■]                            │
│     Distance   [●────────] 0 (∞)        │
│     Decay      [────────●] 2            │
│     Angle      [────●────] 30°          │
│     Penumbra   [──●──────] 0.3          │
│     Volumetric [✓]                       │
│     Track To   [Pick...] / [Clear]       │
│                                          │
│   ▸ AreaLight_1                    [🗑]  │
│   ▸ AreaLight_2                    [🗑]  │
│   ▸ PointLight_1                   [🗑]  │
│                                          │
│ ▸ Show Light Helpers [✓]                │
└──────────────────────────────────────────┘
```

Chaque lumière est un accordéon dépliable. La lumière sélectionnée dans la scène se déplie automatiquement.

---

## Presets

Les presets configurent l'environnement + créent un set de lumières :

| Preset | Ambient | Exposure | Lumières créées |
|--------|---------|----------|-----------------|
| Studio Classic | 0.3 | 1.0 | 1 dir (45° haut-gauche) + 1 area (fill droite) |
| Top Down | 0.2 | 1.0 | 1 dir (droit dessus) |
| Side Dramatic | 0.1 | 1.2 | 1 spot (côté, angle serré) |
| Soft Ambient | 0.8 | 1.0 | 2 area (gauche + droite, large) |
| Neon Night | 0.05 | 1.5 | pas de lumière (juste bloom + émissifs) |
| Custom | — | — | Pas de reset (preset actuel) |

**Comportement** : appliquer un preset **remplace** toutes les lumières actuelles (avec confirmation).

---

## Migration — ce qui change

### Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `lightingMachine.ts` | **Remplacé** par `lightsMachine.ts` |
| `useLighting.ts` | **Remplacé** par `useLights.ts` |
| `LightingTab.tsx` | **Réécrit** — onglet unifié |
| `lightDescriptor.ts` | **Modifié** — ajout decay, distance=0 défaut, conversion power |
| `sceneSetup.ts` | **Modifié** — ne crée plus directional/point globales |
| `SceneRenderer.tsx` | **Modifié** — init lightsMachine, brancher refs |
| `useOvermind.ts` | **Modifié** — remplacer lightingActor par lightsActor |
| `InstanceEditSection.tsx` | **Modifié** — section lumière redirige vers LightingTab |
| `PropertiesPanel.tsx` | **Modifié** — plus de SCENE_OBJECTS pour dirLight/pointLight |
| `useSceneSave.ts` | **Modifié** — snapshot format adapté |
| `configBridge.ts` | **Modifié** — events track-to passent par lightsMachine |
| `animationLoop.ts` | **Vérifié** — track-to loop reste identique |

### Fichiers à supprimer

| Fichier | Raison |
|---------|--------|
| `lightPresets.ts` (ancien) | Remplacé par presets intégrés dans lightsMachine |

### Code mort à nettoyer

- `UPDATE_POINT_POSITION` dans lightingMachine (supprimé avec le fichier)
- `SCENE_OBJECTS` entries `dirLight` / `pointLight` dans PropertiesPanel
- `pointLight` / `directionalLight` dans sceneSetup (ambient reste)

---

## Phases d'implémentation

### Phase A — lightsMachine + hook
- [ ] Créer `lightsMachine.ts` avec context (environment + lights map)
- [ ] Events : SET_AMBIENT_*, SET_EXPOSURE, TOGGLE_HDR, ADD/REMOVE/UPDATE_LIGHT
- [ ] Actions : piloter componentRegistry pour le CRUD 3D
- [ ] Conversion power → intensity dans les actions
- [ ] Créer `useLights.ts` hook
- [ ] Brancher dans useOvermind + SceneRenderer

### Phase B — Migration sceneSetup
- [ ] Retirer directionalLight et pointLight de sceneSetup (garder ambient)
- [ ] Passer la ref ambientLight à lightsMachine
- [ ] Passer la ref renderer à lightsMachine (pour toneMappingExposure)
- [ ] Nettoyer les anciens events dans SceneRenderer

### Phase C — UI unifiée
- [ ] Réécrire LightingTab avec section Environment + Scene Lights
- [ ] Bouton "+ Add Light" (dropdown type)
- [ ] Accordéon par lumière avec tous les params
- [ ] Auto-dépliage de la lumière sélectionnée
- [ ] Bouton suppression par lumière
- [ ] Slider Power (W) au lieu d'Intensity

### Phase D — lightDescriptor amélioré
- [ ] Ajouter `decay` au create/applyConfig (défaut 2)
- [ ] Changer `distance` défaut à 0 (infini)
- [ ] Supporter la conversion power dans applyConfig
- [ ] Vérifier que Track To fonctionne toujours

### Phase E — Presets + Save/Load
- [ ] Définir les presets (environment + lumières associées)
- [ ] APPLY_PRESET : reset environment + replace toutes les lumières
- [ ] Adapter useSceneSave pour le nouveau format snapshot
- [ ] Rétro-compatibilité : charger les anciennes sauvegardes

### Phase F — Nettoyage
- [ ] Supprimer lightingMachine.ts (ancien)
- [ ] Supprimer useLighting.ts (ancien)
- [ ] Nettoyer PropertiesPanel (plus de SCENE_OBJECTS dirLight/pointLight)
- [ ] Nettoyer InstanceEditSection (light section → redirige vers LightingTab)
- [ ] Supprimer lightPresets.ts si obsolète
- [ ] Supprimer code mort (UPDATE_POINT_POSITION, etc.)
