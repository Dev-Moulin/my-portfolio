# Phase 7 — Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)

## Contexte

Un éditeur sans undo/redo est frustrant. Actuellement, si on fait une erreur (déplacer un objet au mauvais endroit, supprimer un keyframe par accident, changer un paramètre), il faut tout refaire manuellement. C'est le feature #1 pour un workflow d'authoring productif.

## Architecture XState v5 existante

Le projet utilise **XState v5.28.0** avec **15 machines** enfants spawnées par `applicationMachine` :

```
applicationMachine (parent — packages/overmind-3d/src/machines/applicationMachine.ts)
├── bloomMachine
├── lightingMachine
├── materialMachine
├── modelMachine
├── pbrMachine
├── sceneMachine
├── performanceMachine
├── revelationMachine
├── popMachine
├── visualPresetMachine
├── neonBandsMachine
├── steeringMachine
├── timelineMachine
└── selectionMachine
```

Les machines sont exposées via `useOvermind()` (hook dans `hooks/useOvermind.ts`).

## API XState v5 pour les snapshots

```typescript
// Obtenir un snapshot persistable
const snapshot = actor.getPersistedSnapshot();
// Type: Snapshot<unknown>

// Restaurer depuis un snapshot
const restoredActor = createActor(machine, { snapshot: previousSnapshot });
restoredActor.start();
```

**Important** : La restauration via `snapshot` option recrée l'acteur entier. Or nos machines ont des refs THREE.js qui ne survivent pas à la sérialisation. On ne peut donc **pas** utiliser cette approche directement.

## Problème : sérialisabilité des machines

### Machines 100% sérialisables (contexte = pure data)

| Machine | Contexte |
|---------|----------|
| `timelineMachine` | Nombres, strings, arrays de keyframes, layouts |
| `steeringMachine` | Uniquement des `number` |
| `neonBandsMachine` | BandConfig[], nombres, booleans |
| `modelMachine` | Position, scale, rotation (nombres) |
| `selectionMachine` | selectedId, mode, isTransforming |

### Machines avec refs THREE.js (non-sérialisables)

| Machine | Champs non-sérialisables |
|---------|------------------------|
| `bloomMachine` | `bloomPass: UnrealBloomPass` |
| `lightingMachine` | `ambientLight`, `directionalLight`, `pointLight`, `renderer` |
| `materialMachine` | `materials[]`, `objects[]` (THREE.Material[]) |
| `sceneMachine` | `scene`, `camera`, `gridHelper`, `axesHelper` |
| `performanceMachine` | `renderer` |
| `pbrMachine` | `materials[]` |
| `revelationMachine` | `rings[]`, `modelRef`, `tempVec`, `tempZone` |

## Solution : snapshot de la config pure + restauration via events

### Principe

1. **Sauvegarder** : extraire les champs sérialisables de chaque machine (ignorer les refs THREE.js)
2. **Restaurer** : envoyer des events aux machines pour remettre les valeurs (les refs THREE.js restent en mémoire GPU, seules leurs propriétés config sont restaurées)

### Type UndoRedoSnapshot

```typescript
interface UndoRedoSnapshot {
  // Machines 100% sérialisables — snapshot complet du context
  timeline: TimelineContext;
  steering: SteeringContext;
  neonBands: NeonBandsContext;
  model: ModelContext;
  selection: { selectedId: string | null; mode: 'translate' | 'rotate' | 'scale' };

  // Machines partielles — config pure extraite
  bloom: {
    threshold: number;
    strength: number;
    radius: number;
    enabled: boolean;
    bloomColor: string;
  };
  lighting: {
    ambientIntensity: number;
    directionalIntensity: number;
    pointIntensity: number;
    exposure: number;
    hdrBoostMultiplier: number;
    directionalPosition: { x: number; y: number; z: number };
    pointPosition: { x: number; y: number; z: number };
  };
  material: {
    iris: { emissiveColor: string; emissiveIntensity: number };
    eyeRings: { emissiveColor: string; emissiveIntensity: number };
    revealRings: { emissiveColor: string; emissiveIntensity: number };
  };
  scene: {
    backgroundColor: string;
    gridVisible: boolean;
    axesVisible: boolean;
  };

  // Instances (Phase 6)
  instances: Array<{
    id: string;
    type: string;
    config: unknown;
  }>;
}
```

### Classe UndoRedoManager

```typescript
// packages/overmind-3d/src/systems/UndoRedoManager.ts

class UndoRedoManager {
  private undoStack: UndoRedoSnapshot[] = [];
  private redoStack: UndoRedoSnapshot[] = [];
  private maxHistory = 50;

  constructor(private actors: {
    bloom: ActorRef; lighting: ActorRef; material: ActorRef;
    model: ActorRef; scene: ActorRef; steering: ActorRef;
    neonBands: ActorRef; timeline: ActorRef; selection: ActorRef;
  }) {}

  /** Capture l'état actuel de toutes les machines */
  captureSnapshot(): UndoRedoSnapshot {
    return {
      timeline: this.actors.timeline.getSnapshot().context,
      steering: this.actors.steering.getSnapshot().context,
      neonBands: this.actors.neonBands.getSnapshot().context,
      model: this.actors.model.getSnapshot().context,
      selection: {
        selectedId: this.actors.selection.getSnapshot().context.selectedId,
        mode: this.actors.selection.getSnapshot().context.mode,
      },
      bloom: extractPureBloom(this.actors.bloom.getSnapshot().context),
      lighting: extractPureLighting(this.actors.lighting.getSnapshot().context),
      material: extractPureMaterial(this.actors.material.getSnapshot().context),
      scene: extractPureScene(this.actors.scene.getSnapshot().context),
      instances: [], // Phase 6 — rempli par instanceRegistry.serialize()
    };
  }

  /** Enregistre une action (appelé AVANT la modification) */
  recordAction(): void {
    this.undoStack.push(this.captureSnapshot());
    this.redoStack = []; // Nouvelle action → clear redo
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  /** Annuler la dernière action */
  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.captureSnapshot()); // Sauvegarder l'état actuel pour redo
    const previous = this.undoStack.pop()!;
    this.restoreSnapshot(previous);
  }

  /** Rétablir la dernière action annulée */
  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.captureSnapshot());
    const next = this.redoStack.pop()!;
    this.restoreSnapshot(next);
  }

  /** Restaure un snapshot en envoyant des events aux machines */
  private restoreSnapshot(snap: UndoRedoSnapshot): void {
    // Timeline — le plus critique
    // Option 1 : event RESTORE_CONTEXT dédié dans timelineMachine
    this.actors.timeline.send({ type: 'RESTORE_CONTEXT', context: snap.timeline });

    // Bloom
    this.actors.bloom.send({ type: 'SET_THRESHOLD', threshold: snap.bloom.threshold });
    this.actors.bloom.send({ type: 'SET_STRENGTH', strength: snap.bloom.strength });
    this.actors.bloom.send({ type: 'SET_RADIUS', radius: snap.bloom.radius });
    this.actors.bloom.send({ type: snap.bloom.enabled ? 'ENABLE' : 'DISABLE' });
    this.actors.bloom.send({ type: 'SET_BLOOM_COLOR', color: snap.bloom.bloomColor });

    // Lighting
    this.actors.lighting.send({ type: 'UPDATE_AMBIENT_INTENSITY', intensity: snap.lighting.ambientIntensity });
    this.actors.lighting.send({ type: 'UPDATE_DIRECTIONAL_INTENSITY', intensity: snap.lighting.directionalIntensity });
    this.actors.lighting.send({ type: 'UPDATE_POINT_INTENSITY', intensity: snap.lighting.pointIntensity });
    this.actors.lighting.send({ type: 'UPDATE_EXPOSURE', exposure: snap.lighting.exposure });
    this.actors.lighting.send({ type: 'UPDATE_HDR_MULTIPLIER', multiplier: snap.lighting.hdrBoostMultiplier });
    this.actors.lighting.send({ type: 'UPDATE_DIRECTIONAL_POSITION', position: snap.lighting.directionalPosition });
    this.actors.lighting.send({ type: 'UPDATE_POINT_POSITION', position: snap.lighting.pointPosition });

    // Material
    for (const group of ['iris', 'eyeRings', 'revealRings'] as const) {
      this.actors.material.send({ type: 'UPDATE_GROUP_EMISSIVE_COLOR', group, color: snap.material[group].emissiveColor });
      this.actors.material.send({ type: 'UPDATE_GROUP_EMISSIVE_INTENSITY', group, intensity: snap.material[group].emissiveIntensity });
    }

    // Scene
    this.actors.scene.send({ type: 'SET_BACKGROUND_COLOR', color: snap.scene.backgroundColor });

    // Model
    this.actors.model.send({ type: 'SET_POSITION', ...snap.model });
    this.actors.model.send({ type: 'SET_SCALE', scale: snap.model.scale });

    // Steering
    this.actors.steering.send({ type: 'RESTORE_CONTEXT', context: snap.steering });

    // NeonBands
    this.actors.neonBands.send({ type: 'RESTORE_CONTEXT', context: snap.neonBands });
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
}
```

### Events RESTORE_CONTEXT

Certaines machines (timeline, steering, neonBands) ont un contexte complexe. Plutôt que d'envoyer 20+ events individuels, ajouter un event `RESTORE_CONTEXT` qui remplace le contexte entier :

```typescript
// Dans timelineMachine.ts
on: {
  RESTORE_CONTEXT: {
    actions: assign(({ event }) => ({
      ...event.context,
      computed: recompute(event.context),
    })),
  },
}
```

**Avantage** : atomique, un seul event = un seul recompute.
**Guard** : ne restaurer que les champs sérialisables (pas de refs THREE.js).

## Granularité : snapshot GLOBAL

On capture **toutes les machines** d'un coup, pas par-machine. Raisons :
1. Les actions affectent souvent plusieurs machines (ex: visual keyframe → bloom + lighting + material + scene + neon)
2. Cohérence garantie (pas de risque d'état incohérent entre machines)
3. Le contexte le plus lourd (timelineMachine) fait ~10-20KB — 50 snapshots = ~1MB max, acceptable

## Quand appeler recordAction() ?

### Option 1 : Wrapper les actions (MVP)

Avant chaque action dans les composants DevPanel/TimelinePanel :
```typescript
function handleAddKeyframe(kf) {
  undoManager.recordAction();
  timelineActor.send({ type: 'ADD_KEYFRAME', keyframe: kf });
}
```

### Option 2 : Middleware intercept (futur)

Intercepter tous les events envoyés aux machines et capturer automatiquement. Plus complexe mais pas d'oubli.

### Recommandation : Option 1 pour le MVP

Les points d'enregistrement principaux :
- Keyboard shortcuts : I (keyframe), E (eye wp), Shift+D (duplicate), Delete
- DevPanel : chaque slider/input change (avec debounce)
- TimelinePanel : add/delete/edit keyframe, add/delete track

## Raccourcis clavier

```typescript
// Dans SceneRenderer.tsx onKeyDown
if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
  e.preventDefault();
  undoManager.undo();
}
if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
  e.preventDefault();
  undoManager.redo();
}
```

## Fichiers impactés

- **Nouveau** : `packages/overmind-3d/src/systems/UndoRedoManager.ts`
- **Modifié** : `packages/overmind-3d/src/machines/timelineMachine.ts` — event RESTORE_CONTEXT
- **Modifié** : `packages/overmind-3d/src/machines/steeringMachine.ts` — event RESTORE_CONTEXT
- **Modifié** : `packages/overmind-3d/src/machines/neonBandsMachine.ts` — event RESTORE_CONTEXT
- **Modifié** : `packages/overmind-3d/src/scene/SceneRenderer.tsx` — instanciation UndoRedoManager + raccourcis Ctrl+Z
- **Modifié** : composants DevPanel/TimelinePanel — appeler recordAction() avant chaque action

## Limitations connues

| Limitation | Mitigation |
|-----------|------------|
| Les animations en cours (AnimationMixer) ne sont pas undo-ables | Seulement la config est restaurée, pas le playback |
| 50 snapshots max (~1MB) | Suffisant pour une session d'authoring |
| Pas de undo granulaire (slider drag = 1 undo par mouseup) | Debounce sur les sliders |
| Les instances 3D (Phase 6) doivent être recréées si undo de la suppression | Le registry serialise/deserialise les instances |

## Vérification

1. Déplacer un objet avec le gizmo → Ctrl+Z → l'objet revient à sa position précédente
2. Ajouter un keyframe (I) → Ctrl+Z → le keyframe disparaît
3. Changer le bloom threshold dans le DevPanel → Ctrl+Z → le threshold revient
4. Ctrl+Z multiple fois → remonte dans l'historique correctement
5. Ctrl+Shift+Z → rétablit les actions annulées
6. Nouvelle action après undo → le redo stack est vidé
7. `pnpm type-check` → 0 erreurs
