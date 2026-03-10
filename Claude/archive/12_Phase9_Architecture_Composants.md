# Phase 9 — Architecture Composants

## Vision

Transformer l'architecture actuelle pour que **tous les éléments de la scène** (title, subtitle, card, neon, lights, et futurs types) soient traités comme des **composants uniformes** d'une bibliothèque.

**Aujourd'hui** : chaque type a son propre code spécifique — machines XState distinctes, hooks distincts, logique de duplication/restore/undo ad hoc dans SceneRenderer, instanceRegistry avec des fonctions par type (`duplicateNeon`, `duplicateText`, `duplicateLight`, `duplicateCard`, etc.).

**Objectif** : un système générique où ajouter un nouveau type de composant = définir un "descriptor" + un renderer, sans toucher au code du framework (timeline, undo, sélection, save/load).

---

## Plan Général — Sous-phases

| # | Sous-phase | Description | Prérequis |
|---|-----------|-------------|-----------|
| 9.0 | **Refactoring préalable** | Découper les fichiers trop gros, réorganiser les dossiers | Aucun |
| 9.1 | **ComponentDescriptor** | Interface unifiée qui décrit un type de composant | 9.0 |
| 9.2 | **ComponentRegistry** | Registry qui remplace instanceRegistry avec une API générique | 9.1 |
| 9.3 | **Cycle de vie uniforme** | enter → steady → exit pour tous les composants | 9.2 |
| 9.4 | **Factorisation undo/redo** | UndoRedoManager générique basé sur les descriptors | 9.2 |
| 9.5 | **Factorisation save/load** | SceneSaveFile générique basé sur les descriptors | 9.2 |
| 9.6 | **Factorisation timeline** | Pistes timeline générées automatiquement par type | 9.3 |
| 9.7 | **Bibliothèque drag & drop** | Panneau UI avec les composants disponibles | 9.2 |
| 9.8 | **Migration types existants** | Migrer neon/text/light/card vers le nouveau système | 9.1–9.6 |
| 9.9 | **Nettoyage** | Supprimer l'ancien code ad hoc | 9.8 |

---

## Sous-phase 9.0 — Refactoring préalable

> **À détailler après analyse des fichiers > 900 lignes.**

Objectif : découper les fichiers monolithiques pour faciliter le travail des sous-phases suivantes.

---

## Sous-phase 9.1 — ComponentDescriptor

Interface qui décrit un type de composant de manière déclarative :

```typescript
interface ComponentDescriptor<TConfig = unknown> {
  type: string;                                    // 'neon' | 'text' | 'light' | 'card' | ...
  displayName: string;                             // Nom affiché dans l'UI
  icon?: string;                                   // Icône pour la bibliothèque

  // Factory
  createObject3D(scene: THREE.Scene, config: TConfig): THREE.Object3D;
  dispose(instance: ComponentInstance<TConfig>, scene: THREE.Scene): void;

  // Config
  defaultConfig(): TConfig;
  cloneConfig(config: TConfig): TConfig;

  // Sérialisation
  serializeConfig(instance: ComponentInstance<TConfig>): unknown;
  deserializeConfig(data: unknown): TConfig;

  // Cycle de vie (optionnel)
  lifecycle?: {
    onEnter?(instance: ComponentInstance<TConfig>): void;
    onSteady?(instance: ComponentInstance<TConfig>): void;
    onExit?(instance: ComponentInstance<TConfig>): void;
  };

  // Rendu par frame (optionnel, pour les systèmes animés comme neon)
  onFrame?(instance: ComponentInstance<TConfig>, delta: number): void;
}
```

### Tâches atomiques
- [ ] Définir l'interface `ComponentDescriptor<TConfig>`
- [ ] Définir l'interface `ComponentInstance<TConfig>` (remplace les unions NeonInstance | TextInstance | ...)
- [ ] Créer les descriptors pour chaque type existant : neon, text, light, card
- [ ] Tests unitaires des descriptors (create, clone, serialize/deserialize)

---

## Sous-phase 9.2 — ComponentRegistry

Remplace `InstanceRegistry` par un système générique :

```typescript
class ComponentRegistry {
  registerDescriptor(descriptor: ComponentDescriptor): void;
  create(type: string, scene: THREE.Scene, config?: unknown): ComponentInstance;
  duplicate(id: string, scene: THREE.Scene): ComponentInstance;
  restore(id: string, type: string, scene: THREE.Scene, config: unknown): ComponentInstance;
  remove(id: string, scene: THREE.Scene): void;
  get(id: string): ComponentInstance | undefined;
  getByType(type: string): ComponentInstance[];
  getAll(): ComponentInstance[];
}
```

### Tâches atomiques
- [ ] Implémenter `ComponentRegistry`
- [ ] Méthode `create()` : utilise le descriptor pour instancier
- [ ] Méthode `duplicate()` : clone config + offset position
- [ ] Méthode `restore()` : recrée avec ID explicite (pour undo/redo)
- [ ] Méthode `remove()` : dispose via le descriptor
- [ ] Intégrer le SelectionBridge (userData.selectableId + register)
- [ ] Remplacer les appels à `InstanceRegistry` dans SceneRenderer

---

## Sous-phase 9.3 — Cycle de vie uniforme

Chaque composant dans la timeline a un cycle : **enter → steady → exit**, avec des durées configurables.

### Tâches atomiques
- [ ] Définir le modèle de données lifecycle dans la timeline (startTime, enterDuration, steadyDuration, exitDuration)
- [ ] Machine XState ou logique pour gérer les transitions de phase
- [ ] Callbacks `onEnter`/`onSteady`/`onExit` du descriptor appelés automatiquement
- [ ] UI dans les clips timeline pour configurer les durées
- [ ] Migration : card utilise déjà ce pattern → extraire la logique générique

---

## Sous-phase 9.4 — Factorisation undo/redo

L'UndoRedoManager utilise les descriptors au lieu de code spécifique par type.

### Tâches atomiques
- [ ] Snapshot générique : `{ type, id, config: descriptor.serializeConfig() }`
- [ ] Restore générique : `registry.restore(id, type, scene, descriptor.deserializeConfig(data))`
- [ ] Supprimer les switch/case par type dans UndoRedoManager
- [ ] Tests : undo/redo fonctionne pour chaque type

---

## Sous-phase 9.5 — Factorisation save/load

SceneSaveFile utilise les descriptors pour sérialiser/désérialiser.

### Tâches atomiques
- [ ] Format save : `instances: Array<{ type, id, config }>` (déjà proche de l'actuel)
- [ ] Save : itérer `registry.getAll()`, appeler `descriptor.serializeConfig()`
- [ ] Load : itérer les instances sauvegardées, appeler `registry.restore()`
- [ ] Rétrocompat : migration des anciens formats de save
- [ ] Tests : save → load roundtrip pour chaque type

---

## Sous-phase 9.6 — Factorisation timeline

Les pistes timeline sont générées automatiquement pour chaque instance.

### Tâches atomiques
- [ ] Chaque instance a automatiquement un clip dans la timeline
- [ ] Le descriptor peut déclarer des "tracks" supplémentaires (ex: visual keyframes)
- [ ] Supprimer le code de création de pistes ad hoc par type
- [ ] UI timeline s'adapte dynamiquement aux instances présentes

---

## Sous-phase 9.7 — Bibliothèque drag & drop

Panneau UI listant tous les ComponentDescriptors enregistrés.

### Tâches atomiques
- [ ] Composant `ComponentLibrary` : liste les descriptors avec icônes/noms
- [ ] Drag & drop ou clic pour ajouter une instance à la scène
- [ ] Position initiale : devant la caméra ou au centre
- [ ] Animation d'ajout (fade in)

---

## Sous-phase 9.8 — Migration types existants

Migrer progressivement chaque type vers le nouveau système.

### Tâches atomiques
- [ ] Migrer `light` (le plus simple)
- [ ] Migrer `text` (title/subtitle)
- [ ] Migrer `card`
- [ ] Migrer `neon` (le plus complexe — système animé + cylindre)
- [ ] Vérifier que chaque migration ne casse rien (type-check + test visuel)

---

## Sous-phase 9.9 — Nettoyage

- [ ] Supprimer `instanceRegistry.ts` (remplacé par ComponentRegistry)
- [ ] Supprimer les fonctions `duplicate*/restore*` ad hoc
- [ ] Supprimer les switch/case par type dans SceneRenderer
- [ ] Supprimer les types unions (Instance = NeonInstance | TextInstance | ...)
- [ ] Audit : aucun code spécifique à un type dans le framework

---

## Notes

- **Ordre strict** : 9.0 → 9.1 → 9.2 → (9.3, 9.4, 9.5, 9.6 en parallèle possible) → 9.7 → 9.8 → 9.9
- **Chaque sous-phase doit compiler** (type-check) avant de passer à la suivante
- **Migration incrémentale** : on peut garder l'ancien code en parallèle pendant la transition (9.8)
- Les plans détaillés de chaque sous-phase seront créés au moment de l'implémentation
