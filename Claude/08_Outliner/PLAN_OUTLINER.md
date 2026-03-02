# Phase 8 — Outliner + Visibility Toggle

## Contexte

Quand la scène contient beaucoup d'objets (model, neon, textes, lights, + instances dupliquées de la Phase 6), il devient difficile de :
1. **Voir** quels objets existent dans la scène
2. **Sélectionner** un objet précis (surtout s'il est caché derrière un autre)
3. **Masquer temporairement** un objet pour travailler sur ce qu'il y a derrière

L'Outliner (comme dans Blender, en haut à droite) résout ces 3 problèmes.

## Sous-phase 8.1 : Extension du SelectionSystem

### État actuel

**Fichier** : `packages/overmind-3d/src/scene/selectionSystem.ts`

Le SelectionSystem utilise une `Map<string, THREE.Object3D>` interne (`selectables`) avec :
- `register(id, obj)` / `unregister(id)`
- `select(id)` / `deselect()`
- `getSelectedId()` / `getSelectedObject()`
- `onSelectionChange(callback)` / `onObjectChange(callback)` / `onDraggingChanged(callback)`

**Ce qui manque** :
- Pas de méthode pour lister tous les objets enregistrés
- Pas de gestion de la visibilité
- Pas de moyen d'accéder à un objet par ID depuis l'extérieur

### Méthodes à ajouter

```typescript
/** Retourne tous les IDs enregistrés */
getAllIds(): string[] {
  return Array.from(this.selectables.keys());
}

/** Retourne l'objet 3D par ID */
getObjectById(id: string): THREE.Object3D | null {
  return this.selectables.get(id) ?? null;
}

/** Toggle la visibilité d'un objet */
setObjectVisible(id: string, visible: boolean): void {
  const obj = this.selectables.get(id);
  if (!obj) return;
  obj.visible = visible;
  // Pour les CSS3DObject (card), il faut aussi masquer le DOM
  if (id === 'card') {
    // CardSystem gère la visibilité via setOpacity(0)
    // → dispatch un event custom plutôt
    window.dispatchEvent(new CustomEvent('overmind:set-visibility', { detail: { id, visible } }));
  }
  this.visibilityCallbacks.forEach(cb => cb(id, visible));
}

/** Vérifie la visibilité d'un objet */
isObjectVisible(id: string): boolean {
  const obj = this.selectables.get(id);
  return obj?.visible ?? false;
}

/** Callback quand la visibilité change */
onVisibilityChange(callback: (id: string, visible: boolean) => void): () => void {
  this.visibilityCallbacks.add(callback);
  return () => this.visibilityCallbacks.delete(callback);
}
```

### Fix raycasting : skip objets invisibles

**Problème** : `THREE.Raycaster` intersecte les objets même si `visible === false` au niveau parent. Il faut ajouter un check dans le handler de click.

**Dans SelectionSystem.handleClick()** :

```typescript
private handleClick(clientX: number, clientY: number): void {
  // ... setup raycaster, get intersections ...

  for (const hit of intersections) {
    const id = this.findSelectableId(hit.object);
    if (id) {
      const registeredObj = this.selectables.get(id);
      // Skip objets invisibles
      if (registeredObj && !registeredObj.visible) continue;

      this.select(id);
      return;
    }
  }

  this.deselect();
}
```

**Note** : en réalité, Three.js Raycaster respecte `object.visible` dans la plupart des cas. Mais si on cache un parent et pas l'enfant, le raycaster peut quand même intersect. Le check explicite est une sécurité.

### Fichiers impactés

- **Modifié** : `packages/overmind-3d/src/scene/selectionSystem.ts`

---

## Sous-phase 8.2 : Composant OutlinerTab

### Emplacement

Le DevPanel a déjà une tab **"Select"** (`components/devPanel/tabs/SelectTab.tsx`) qui affiche :
- Selected: [ID]
- Transforming: Yes/No
- Mode buttons (Translate/Rotate/Scale)
- Shortcuts list

**Deux options** :
1. **Remplacer** SelectTab par OutlinerTab (qui inclut la sélection + la liste)
2. **Ajouter** OutlinerTab comme nouvelle tab séparée

**Recommandation** : option 1 — remplacer SelectTab. L'outliner inclut naturellement la fonctionnalité de sélection (click sur un item = sélectionne).

### UI

```
┌─────────────────────────────────┐
│  SCENE HIERARCHY                │
├─────────────────────────────────┤
│                                 │
│  👁 model          [selected]  │
│  👁 neon                       │
│  👁 title                      │
│  👁 subtitle                   │
│  👁 card                       │
│  👁 dirLight                   │
│  👁 pointLight                 │
│  ─── Instances ───             │
│  👁 neon_copy_1                │
│  👁 text_copy_1                │
│                                 │
├─────────────────────────────────┤
│  TRANSFORM                      │
│  Mode: [G] [R] [S]             │
│  Pos: x:1.2 y:3.4 z:0.0       │
├─────────────────────────────────┤
│  SHORTCUTS                      │
│  T: Frame Selected              │
│  H: Home                        │
│  ...                            │
└─────────────────────────────────┘
```

### Composant OutlinerTab

```typescript
// packages/overmind-3d/src/components/devPanel/tabs/OutlinerTab.tsx

interface OutlinerItem {
  id: string;
  visible: boolean;
  isSelected: boolean;
  isInstance: boolean;  // true si c'est un duplicat (Phase 6)
}

interface OutlinerTabProps {
  items: OutlinerItem[];
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  selection: ReturnType<typeof useSelection>;
}

function OutlinerTab({ items, onSelect, onToggleVisible, selection }: OutlinerTabProps) {
  return (
    <div>
      {/* Section Hierarchy */}
      <div style={s.section}>
        <h3 style={s.h3}>Scene Hierarchy</h3>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {items.filter(i => !i.isInstance).map(item => (
            <OutlinerRow key={item.id} item={item} onSelect={onSelect} onToggleVisible={onToggleVisible} />
          ))}
          {items.some(i => i.isInstance) && (
            <>
              <div style={{ ...s.h3, marginTop: '8px' }}>Instances</div>
              {items.filter(i => i.isInstance).map(item => (
                <OutlinerRow key={item.id} item={item} onSelect={onSelect} onToggleVisible={onToggleVisible} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Section Transform (comme SelectTab actuel) */}
      <div style={s.section}>
        <h3 style={s.h3}>Transform</h3>
        {/* Mode buttons G/R/S */}
        {/* Position display */}
      </div>
    </div>
  );
}

function OutlinerRow({ item, onSelect, onToggleVisible }) {
  return (
    <div
      onClick={() => onSelect(item.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '3px 6px', cursor: 'pointer',
        background: item.isSelected ? '#2a3a5a' : 'transparent',
        borderRadius: '3px',
      }}
    >
      {/* Eye icon */}
      <span
        onClick={(e) => { e.stopPropagation(); onToggleVisible(item.id); }}
        style={{ opacity: item.visible ? 1 : 0.3, cursor: 'pointer', fontSize: '11px' }}
      >
        {item.visible ? '👁' : '👁‍🗨'}
      </span>
      {/* Name */}
      <span style={{ fontSize: '11px', color: item.visible ? '#ccc' : '#555' }}>
        {item.id}
      </span>
    </div>
  );
}
```

### Styles

Cohérent avec le DevPanel existant :
- Background : `#141414`
- Border : `1px solid #2a2a2a`
- Text : `fontSize: 9-11px`, `color: #777` (labels) / `#ccc` (values)
- Selected row : `background: #2a3a5a` (bleu subtle)
- Hover : `background: #1e1e1e`
- Scrollbar : thin, dark theme

### Flux de données

Le composant OutlinerTab a besoin de connaître la liste des objets et leur visibilité. Le problème : `SelectionSystem` vit dans `SceneRenderer.tsx` (closure d'un useEffect).

**Solution** : étendre `selectionMachine` pour stocker la liste des IDs et leur visibilité :

```typescript
// selectionMachine.ts — context étendu
context: {
  selectedId: string | null;
  mode: 'translate' | 'rotate' | 'scale';
  isTransforming: boolean;
  // Nouveau :
  registeredIds: string[];           // Liste de tous les IDs enregistrés
  visibility: Record<string, boolean>; // Visibilité par ID
}

// Nouveaux events
| { type: 'REGISTER_ID'; id: string }
| { type: 'UNREGISTER_ID'; id: string }
| { type: 'TOGGLE_VISIBILITY'; id: string }
| { type: 'SET_VISIBILITY'; id: string; visible: boolean }
```

**Bridge dans SceneRenderer.tsx** :
```typescript
// Quand on register un objet dans SelectionSystem :
selection.register('neon', neonBands.getGroup());
selectionActor?.send({ type: 'REGISTER_ID', id: 'neon' });

// Quand le hook useSelection lit la liste :
const registeredIds = useSelector(selectionActor, s => s.context.registeredIds);
const visibility = useSelector(selectionActor, s => s.context.visibility);
```

### Hook useOutliner (optionnel)

```typescript
// packages/overmind-3d/src/hooks/useOutliner.ts

function useOutliner() {
  const { selectionActor } = useOvermind();
  const registeredIds = useSelector(selectionActor, s => s.context.registeredIds);
  const visibility = useSelector(selectionActor, s => s.context.visibility);
  const selectedId = useSelector(selectionActor, s => s.context.selectedId);

  const items: OutlinerItem[] = registeredIds.map(id => ({
    id,
    visible: visibility[id] ?? true,
    isSelected: id === selectedId,
    isInstance: id.includes('_copy_'),
  }));

  const select = (id: string) => selectionActor?.send({ type: 'SELECT', id });
  const toggleVisible = (id: string) => selectionActor?.send({ type: 'TOGGLE_VISIBILITY', id });

  return { items, select, toggleVisible };
}
```

### Fichiers impactés

- **Nouveau** : `packages/overmind-3d/src/components/devPanel/tabs/OutlinerTab.tsx`
- **Modifié** : `packages/overmind-3d/src/machines/selectionMachine.ts` — registeredIds, visibility, events
- **Modifié** : `packages/overmind-3d/src/hooks/useSelection.ts` — exposer les nouveaux champs
- **Modifié** : `packages/overmind-3d/src/components/devPanel/DevControlPanel.tsx` — remplacer SelectTab par OutlinerTab
- **Modifié** : `packages/overmind-3d/src/scene/SceneRenderer.tsx` — bridge register → selectionActor

---

## Sous-phase 8.3 : Interaction visibility ↔ systèmes 3D

### Comportement attendu

| Action | Résultat |
|--------|---------|
| Toggle eye icon OFF sur "neon" | Le groupe neon disparaît visuellement |
| Toggle eye icon OFF sur "model" | Le modèle disparaît |
| Toggle eye icon OFF sur "card" | La card CSS3D disparaît |
| Click sur un objet invisible | Pas de sélection (raycaster skip) |
| Toggle eye icon ON | L'objet réapparaît |
| Frame Selected (T) sur objet invisible | Ne fait rien (pas sélectionnable) |

### Cas spéciaux

**Card (CSS3DObject)** : `object.visible = false` masque la CSS3DObject dans le rendu CSS3D, mais le proxy mesh doit aussi être masqué pour le raycaster.

**Neon (Group)** : `group.visible = false` masque tous les enfants. L'animation (`update(delta)`) continue en arrière-plan mais n'a pas d'effet visible.

**Outline** : Si un objet invisible était sélectionné et qu'on le masque, il faut le désélectionner automatiquement :
```typescript
setObjectVisible(id, false) → if (selectedId === id) deselect()
```

### Fichiers impactés

- **Modifié** : `packages/overmind-3d/src/scene/selectionSystem.ts` — logique de deselect auto
- **Modifié** : `packages/overmind-3d/src/scene/SceneRenderer.tsx` — listener `overmind:set-visibility` pour la card

---

## Résumé des sous-phases

| Sous-phase | Description | Fichiers |
|-----------|-------------|----------|
| 8.1 | Extension SelectionSystem (getAllIds, visibility, raycaster fix) | selectionSystem.ts |
| 8.2 | OutlinerTab + selectionMachine étendu + hook | OutlinerTab.tsx, selectionMachine.ts, useSelection.ts, DevControlPanel.tsx, SceneRenderer.tsx |
| 8.3 | Interactions visibility ↔ systèmes 3D (card, outline, deselect auto) | selectionSystem.ts, SceneRenderer.tsx |

## Vérification

1. Le DevPanel affiche la tab Outliner avec la liste de tous les objets
2. Click sur un item dans l'outliner → sélection de l'objet dans la scène + outline
3. Click sur l'eye icon → l'objet disparaît visuellement
4. Click dans la scène sur la position de l'objet invisible → pas de sélection
5. Toggle ON → l'objet réapparaît
6. Les instances dupliquées (Phase 6) apparaissent dans la section "Instances"
7. Masquer un objet sélectionné → il est désélectionné automatiquement
8. `pnpm type-check` → 0 erreurs
