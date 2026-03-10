# Phase 6 — Scene Management (Instance Registry)

## Contexte

Pour construire la scène du portfolio dans un workflow Blender-like, il faut pouvoir :
1. **Dupliquer** des éléments avec leur propre config indépendante (ex: 2 cascades neon différentes, 3 textes avec des contenus différents)
2. **Éditer** les propriétés de chaque instance (contenu texte, intensité neon, couleur light...)
3. **Exporter/Importer** toute la scène en un seul JSON centralisé
4. **Supprimer** des instances

Le scope a évolué depuis le plan initial : on passe d'un simple `obj.clone()` à un vrai **Instance Registry** avec per-instance config.

---

## Sous-phase 6.1 : Instance Registry + Shift+D

### Architecture

#### Instance Registry (`scene/instanceRegistry.ts`)

Registre central de toutes les instances dupliquées :

```typescript
type InstanceType = 'neon' | 'text' | 'light';

interface InstanceConfig {
  neon: NeonBandsContext;      // Config complète de la neonBandsMachine
  text: TextInstanceConfig;     // text, fontSize, color, emissiveIntensity, font
  light: LightInstanceConfig;   // type (dir|point), intensity, color, position
}

interface SceneInstance<T extends InstanceType = InstanceType> {
  id: string;                   // ex: 'neon_copy_1', 'text_copy_2'
  type: T;
  config: InstanceConfig[T];    // Config per-instance
  object3D: THREE.Object3D;     // Ref vers l'objet 3D dans la scène
}

class InstanceRegistry {
  private instances = new Map<string, SceneInstance>();
  private counters = new Map<InstanceType, number>();

  generateId(type: InstanceType): string;
  register(instance: SceneInstance): void;
  unregister(id: string): SceneInstance | undefined;
  get(id: string): SceneInstance | undefined;
  getAll(): SceneInstance[];
  getAllByType(type: InstanceType): SceneInstance[];
  getConfig<T extends InstanceType>(id: string): InstanceConfig[T] | undefined;
  updateConfig<T extends InstanceType>(id: string, updates: Partial<InstanceConfig[T]>): void;
  dispose(): void;
}
```

#### Éléments duplicables vs non-duplicables

| Type | Duplicable | Méthode de duplication | Complexité |
|------|-----------|----------------------|------------|
| **Neon** | Oui | Nouveau `NeonBandsSystem` + spawn `neonBandsMachine` | Élevée |
| **Text** | Oui | Nouveau mesh Troika `Text` indépendant | Élevée |
| **Light** | Oui | Clone `DirectionalLight` ou `PointLight` | Faible |
| **Card** | Non | Un seul CSS3DRenderer/portal React | — |
| **Model** | Non | Un seul GLTF chargé | — |

### Duplication par type

#### Neon (le plus complexe)

Le `NeonBandsSystem` actuel est piloté par `neonBandsMachine`. Chaque instance dupliquée a besoin de :
1. **Sa propre `neonBandsMachine`** (contexte indépendant : bands[], spacing, flow, position, scale...)
2. **Son propre `NeonBandsSystem`** (géométries, shaders, animations indépendants)
3. **Sa propre subscription** (machine → système 3D)

Constructeur du NeonBandsSystem (11 paramètres) :
```typescript
new NeonBandsSystem(scene, bands, spacing, posX, posY, posZ, scale, arcRadius, depthSpread, lineLength)
```

**Config copiée** : on prend le `getSnapshot().context` de la neonBandsMachine actuelle comme config initiale du clone.

**Spawn dynamique** : la nouvelle machine est créée via `createActor(neonBandsMachine, { input: copiedConfig })` et démarrée. Elle n'est PAS gérée par `applicationMachine` (qui spawn les acteurs au démarrage) — elle vit dans le registry.

#### Text (complexe)

Le `ScrollTextSystem` actuel gère 2 meshes Troika (title + subtitle). Pour une instance dupliquée :
1. **Nouveau mesh `Text` de troika-three-text** (indépendant du ScrollTextSystem)
2. **Config stockée dans le registry** :
   ```typescript
   interface TextInstanceConfig {
     text: string;
     fontUrl: string;          // chemin vers la font OTF/TTF
     fontSize: number;
     color: string;            // hex
     emissiveIntensity: number;
     anchorX: 'center' | 'left' | 'right';
     anchorY: 'middle' | 'top' | 'bottom';
   }
   ```
3. **Pas de ScrollTextSystem** pour les duplicats — juste un mesh Text positionné via element tracks
4. **Pas de layout/phases** (entrance/steady/exit) — le texte est statique, positionné manuellement

Le mesh est créé directement via troika :
```typescript
import { Text } from 'troika-three-text';
const textMesh = new Text();
textMesh.text = config.text;
textMesh.font = config.fontUrl;
textMesh.fontSize = config.fontSize;
textMesh.color = config.color;
// ...
textMesh.sync(); // async — construit la géométrie MDF
scene.add(textMesh);
```

#### Light (simple)

Clone simple :
```typescript
const original = selection.getSelectedObject() as THREE.Light;
const clone = original.clone();
clone.position.copy(original.position).add(new THREE.Vector3(2, 0, 0)); // offset
scene.add(clone);
```

Config :
```typescript
interface LightInstanceConfig {
  lightType: 'directional' | 'point';
  intensity: number;
  color: string;
  position: { x: number; y: number; z: number };
}
```

### Raccourci Shift+D

Dans `SceneRenderer.tsx`, handler `onKeyDown` :

```typescript
// Shift+D = Duplicate selected
if (e.key === 'D' && e.shiftKey && freeCameraActive) {
  const selectedId = selection.getSelectedId();
  if (!selectedId) return;
  e.preventDefault();

  const type = getInstanceType(selectedId); // 'neon' | 'text' | 'light' | null
  if (!type) return; // model, card → non duplicable

  const instance = instanceRegistry.duplicate(selectedId, type, /* factory params */);
  if (!instance) return;

  // 1. Register dans SelectionSystem
  selection.register(instance.id, instance.object3D);
  // 2. Créer element track vide
  timelineActor?.send({ type: 'ADD_ELEMENT_KF', elementId: instance.id, keyframe: {
    frame: 0, position: { x: instance.object3D.position.x, y: instance.object3D.position.y, z: instance.object3D.position.z },
    rotation: { x: 0, y: 0, z: 0 }, scale: 1, easing: 'smoothstep',
  }});
  // 3. Sélectionner + gizmo translate
  selection.select(instance.id);
  selection.setMode('translate');
  selection.attachGizmo();
}
```

### IDs uniques

Format : `{type}_copy_{n}` avec compteur auto-incrémenté par type :
- `neon_copy_1`, `neon_copy_2`, `neon_copy_3`
- `text_copy_1`, `text_copy_2`
- `light_copy_1`

### resolveElementObject — mise à jour

La fonction `resolveElementObject(id)` dans SceneRenderer doit être étendue :
```typescript
function resolveElementObject(id: string): THREE.Object3D | null {
  if (id === 'title') return scrollText?.getTitleMesh() ?? null;
  if (id === 'subtitle') return scrollText?.getSubtitleMesh() ?? null;
  if (id === 'neon') return neonBands?.getGroup() ?? null;
  if (id === 'card') return cardSystem.getProxyMesh();
  // Instances dupliquées
  const instance = instanceRegistry.get(id);
  if (instance) return instance.object3D;
  return null;
}
```

### Fichiers impactés

- **Nouveau** : `packages/overmind-3d/src/scene/instanceRegistry.ts`
- **Modifié** : `packages/overmind-3d/src/scene/SceneRenderer.tsx` — handler Shift+D, resolveElementObject, cleanup
- **Modifié** : `packages/overmind-3d/src/scene/selectionSystem.ts` — rien à changer (register/unregister existent déjà)
- **Modifié** : `packages/overmind-3d/src/machines/timelineMachine.ts` — les element tracks acceptent déjà n'importe quel ID

---

## Sous-phase 6.2 : DevPanel per-instance

### Comportement

Quand un objet dupliqué est sélectionné :
- Le DevPanel affiche un onglet **"Instance"** (ou remplace le contenu de la tab Select)
- Les contrôles sont spécifiques au type de l'instance

### Contrôles par type

**Neon instance** (mêmes contrôles que NeonTab, mais scoped à l'instance) :
- Nombre de bandes, espacement
- Couleur/intensité par bande
- Flow speed, global intensity
- Arc radius, depth spread, line length
- Scale, position (déjà via gizmo)

**Text instance** :
- Input text : champ texte éditable pour le contenu
- Font : dropdown (Cynatar, SF-TransRobotics, ou custom)
- Font size : slider
- Color : color picker
- Emissive intensity : slider

**Light instance** :
- Intensity : slider
- Color : color picker
- Position : affichage (modifiable via gizmo)

### Flux de données

1. L'utilisateur modifie un slider/input dans le DevPanel
2. Le composant appelle `instanceRegistry.updateConfig(id, { newProp: value })`
3. Le registry émet un event (callback) vers SceneRenderer
4. SceneRenderer applique le changement au système 3D correspondant

### Fichiers impactés

- **Nouveau** : `packages/overmind-3d/src/components/devPanel/tabs/InstanceTab.tsx`
- **Modifié** : `packages/overmind-3d/src/components/devPanel/DevControlPanel.tsx` — affichage conditionnel de InstanceTab

---

## Sous-phase 6.3 : Export/Import centralisé ("Save Scene")

### Problème actuel

L'état de la scène est réparti dans ~10 machines XState indépendantes. Pour sauvegarder/restaurer la scène entière, il faut un export unifié.

### Sérialisabilité des machines

| Machine | Contexte sérialisable ? | Refs THREE.js |
|---------|------------------------|---------------|
| timelineMachine | Oui (tout primitif) | Aucune |
| bloomMachine | Partiel | `bloomPass: UnrealBloomPass` |
| lightingMachine | Partiel | `ambientLight`, `directionalLight`, `pointLight`, `renderer` |
| materialMachine | Partiel | `materials[]`, `objects[]` |
| sceneMachine | Partiel | `scene`, `camera`, `gridHelper`, `axesHelper` |
| steeringMachine | Oui (tout number) | Aucune |
| neonBandsMachine | Oui (tout primitif) | Aucune |
| modelMachine | Oui (tout number) | Aucune |
| selectionMachine | Oui | Aucune |
| performanceMachine | Partiel | `renderer` |
| pbrMachine | Partiel | `materials[]` |
| revelationMachine | Partiel | `rings[]`, `modelRef`, `tempVec` |

### Solution : extraction de la config pure

Pour chaque machine avec des refs THREE.js, extraire uniquement les champs sérialisables :

```typescript
interface SceneExport {
  version: number;
  timestamp: string;

  // Machines 100% sérialisables
  timeline: TimelineContext;
  steering: SteeringContext;
  neonBands: NeonBandsContext;
  model: ModelContext;

  // Machines partiellement sérialisables (config pure extraite)
  bloom: { threshold: number; strength: number; radius: number; enabled: boolean; bloomColor: string };
  lighting: {
    ambientIntensity: number; directionalIntensity: number; pointIntensity: number;
    exposure: number; hdrBoostMultiplier: number;
    directionalPosition: { x: number; y: number; z: number };
    pointPosition: { x: number; y: number; z: number };
  };
  material: {
    iris: { emissiveColor: string; emissiveIntensity: number };
    eyeRings: { emissiveColor: string; emissiveIntensity: number };
    revealRings: { emissiveColor: string; emissiveIntensity: number };
  };
  scene: { backgroundColor: string; gridVisible: boolean; axesVisible: boolean };

  // Instances dupliquées
  instances: Array<{
    id: string;
    type: InstanceType;
    config: InstanceConfig[InstanceType];
    elementTrack: ElementTransformKf[];
  }>;
}
```

### Boutons Save/Load

- **Save Scene** : collecte les snapshots de toutes les machines, extrait la config pure, sérialise en JSON, déclenche le téléchargement
- **Load Scene** : parse le JSON, restaure chaque machine via events, recrée les instances dupliquées

### Fichiers impactés

- **Nouveau** : `packages/overmind-3d/src/utils/sceneExport.ts`
- **Modifié** : `packages/overmind-3d/src/components/devPanel/DevControlPanel.tsx` — boutons Save/Load

---

## Sous-phase 6.4 : Suppression d'un duplicat

### Raccourci

**Delete** sur un objet dupliqué sélectionné.

### Comportement

1. Vérifier que l'objet sélectionné est un duplicat (existe dans le registry)
2. Retirer l'Object3D de la scène (`scene.remove(obj)`)
3. Unregister du SelectionSystem (`selection.unregister(id)`)
4. Supprimer les element tracks associés dans timelineMachine
5. Dispose les resources :
   - Neon : `NeonBandsSystem.dispose()` + stop de la machine XState
   - Text : `textMesh.dispose()`
   - Light : pas de dispose nécessaire
6. Retirer du registry (`instanceRegistry.unregister(id)`)

### Guard : ne pas supprimer les objets originaux

Les objets originaux (model, title, subtitle, neon, card, dirLight, pointLight) ne sont PAS dans le registry → le handler Delete ne fait rien pour eux.

### Fichiers impactés

- **Modifié** : `packages/overmind-3d/src/scene/SceneRenderer.tsx` — handler Delete
- **Modifié** : `packages/overmind-3d/src/machines/timelineMachine.ts` — event `DELETE_ELEMENT_TRACK` pour supprimer une track entière

---

## Résumé des raccourcis

| Touche | Action | Condition |
|--------|--------|-----------|
| **Shift+D** | Duplicate selected | Objet sélectionné (neon, text, light), free camera |
| **Delete** | Supprimer duplicat | Duplicat sélectionné (pas un original) |

## Vérification

1. Sélectionner neon → Shift+D → un clone apparaît avec la même config, gizmo translate attaché
2. Déplacer le clone → I → keyframe capturé sur la track `el:neon_copy_1`
3. Le clone a sa propre track dans le TimelinePanel
4. Modifier la config du clone (intensity, color) via DevPanel → indépendant de l'original
5. Sélectionner title → Shift+D → un nouveau texte apparaît avec le même contenu
6. Modifier le texte du clone dans le DevPanel → contenu indépendant
7. Save Scene → JSON contient timeline + bloom + lighting + ... + instances[]
8. Load Scene → tout est restauré identiquement (instances incluses)
9. Delete sur un duplicat → retiré de la scène + track supprimée
10. Delete sur un original (model, neon) → ne fait rien
11. `pnpm type-check` → 0 erreurs
