# Phase 9 — Toolbar UI

## Contexte

Actuellement, tous les raccourcis clavier (F, G, R, S, I, E, T, H, Shift+D, Delete, Ctrl+Z...) sont invisibles — il faut les mémoriser. L'utilisateur n'a aucun repère visuel sur :
1. Quels raccourcis existent
2. Quel mode est actif (free camera ? gizmo translate/rotate/scale ?)
3. Quelles actions sont disponibles (objet sélectionné ou non)

Une toolbar visuelle résout ces 3 problèmes, comme la barre d'outils en haut de Blender.

## Layout actuel de l'écran

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────┐                                             │
│ │DevControl│                                             │
│ │Panel     │           SceneRenderer                     │
│ │(300px)   │          (full viewport)                    │
│ │top:20    │                                             │
│ │left:20   │                                             │
│ │z:9999    │                                             │
│ └──────────┘                                             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ TimelinePanel (position:fixed, bottom:0, z:9998, 180px)  │
└──────────────────────────────────────────────────────────┘
```

**Zones libres** : top-center, top-right, left (sous DevPanel)

## Position de la toolbar

**Recommandation : top-center**, horizontale, flottante au-dessus de la scène.

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────┐  ┌──────── TOOLBAR ──────────┐              │
│ │DevControl│  │ F | G R S | I E V | ⇧D ✕ │              │
│ │Panel     │  └───────────────────────────┘              │
│ │          │                                             │
│ │          │           SceneRenderer                     │
│ └──────────┘                                             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ TimelinePanel                                            │
└──────────────────────────────────────────────────────────┘
```

**Style** :
- `position: fixed`, `top: 10px`, `left: 50%`, `transform: translateX(-50%)`
- `zIndex: 9997` (sous DevPanel et TimelinePanel)
- Visible uniquement quand `showDevPanel === true` (mode authoring)

## Groupes de boutons

### 1. Camera Mode

| Bouton | Raccourci | Action | Indicateur |
|--------|-----------|--------|------------|
| Free Cam | **F** | Toggle free ↔ scroll | Bleu si actif |

### 2. Navigation (visible en free camera uniquement)

| Bouton | Raccourci | Action | Condition |
|--------|-----------|--------|-----------|
| Frame | **T** | Frame selected | Sélection requise |
| Home | **H** | Revenir vue initiale | Free camera |

### 3. Transform (visible si objet sélectionné)

| Bouton | Raccourci | Action | Indicateur |
|--------|-----------|--------|------------|
| Move | **G** | Mode translate | Bleu si actif |
| Rotate | **R** | Mode rotate | Bleu si actif |
| Scale | **S** | Mode scale | Bleu si actif |

### 4. Capture

| Bouton | Raccourci | Action | Condition |
|--------|-----------|--------|-----------|
| Keyframe | **I** | Capturer KF camera ou element | — |
| Eye WP | **E** | Capturer eye waypoint | — |
| Visual KF | **V** | Ajouter visual KF | — |

### 5. Scene (Phase 6+)

| Bouton | Raccourci | Action | Condition |
|--------|-----------|--------|-----------|
| Duplicate | **Shift+D** | Dupliquer l'objet sélectionné | Sélection duplicable |
| Delete | **Del** | Supprimer le duplicat sélectionné | Instance sélectionnée |

### 6. History (Phase 7+)

| Bouton | Raccourci | Action | Indicateur |
|--------|-----------|--------|------------|
| Undo | **Ctrl+Z** | Annuler | Grisé si undoStack vide |
| Redo | **Ctrl+⇧+Z** | Rétablir | Grisé si redoStack vide |

## Composant Toolbar

```typescript
// packages/overmind-3d/src/components/Toolbar.tsx

interface ToolbarProps {
  freeCameraActive: boolean;
  selectedId: string | null;
  gizmoMode: 'translate' | 'rotate' | 'scale';
  canUndo?: boolean;
  canRedo?: boolean;
}

function Toolbar({ freeCameraActive, selectedId, gizmoMode, canUndo, canRedo }: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      {/* Camera Mode */}
      <ToolbarGroup>
        <ToolbarButton
          label="F"
          tooltip="Free Camera (F)"
          active={freeCameraActive}
          onClick={() => dispatch('toggle-camera')}
        />
      </ToolbarGroup>

      <ToolbarSeparator />

      {/* Navigation */}
      {freeCameraActive && (
        <ToolbarGroup>
          <ToolbarButton label="T" tooltip="Frame Selected (T)" disabled={!selectedId} onClick={...} />
          <ToolbarButton label="H" tooltip="Home (H)" onClick={...} />
        </ToolbarGroup>
      )}

      <ToolbarSeparator />

      {/* Transform */}
      {selectedId && (
        <ToolbarGroup>
          <ToolbarButton label="G" tooltip="Move (G)" active={gizmoMode === 'translate'} onClick={...} />
          <ToolbarButton label="R" tooltip="Rotate (R)" active={gizmoMode === 'rotate'} onClick={...} />
          <ToolbarButton label="S" tooltip="Scale (S)" active={gizmoMode === 'scale'} onClick={...} />
        </ToolbarGroup>
      )}

      <ToolbarSeparator />

      {/* Capture */}
      <ToolbarGroup>
        <ToolbarButton label="I" tooltip="Keyframe (I)" onClick={...} />
        <ToolbarButton label="E" tooltip="Eye Waypoint (E)" onClick={...} />
        <ToolbarButton label="V" tooltip="Visual KF (V)" onClick={...} />
      </ToolbarGroup>

      {/* Scene (Phase 6) */}
      <ToolbarSeparator />
      <ToolbarGroup>
        <ToolbarButton label="⇧D" tooltip="Duplicate (Shift+D)" disabled={!selectedId} onClick={...} />
        <ToolbarButton label="✕" tooltip="Delete (Del)" disabled={!selectedId} onClick={...} />
      </ToolbarGroup>

      {/* History (Phase 7) */}
      <ToolbarSeparator />
      <ToolbarGroup>
        <ToolbarButton label="↩" tooltip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={...} />
        <ToolbarButton label="↪" tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={...} />
      </ToolbarGroup>
    </div>
  );
}
```

### Sous-composants

```typescript
function ToolbarButton({ label, tooltip, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        background: active ? '#3b82f6' : '#1e1e1e',
        color: active ? '#fff' : disabled ? '#444' : '#bbb',
        border: '1px solid #3a3a3a',
        borderRadius: '4px',
        padding: '4px 8px',
        fontSize: '11px',
        fontFamily: '"Courier New", monospace',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        minWidth: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

function ToolbarGroup({ children }) {
  return <div style={{ display: 'flex', gap: '2px' }}>{children}</div>;
}

function ToolbarSeparator() {
  return <div style={{ width: '1px', height: '20px', background: '#2a2a2a', margin: '0 6px' }} />;
}
```

### Style de la toolbar

```typescript
const toolbarStyle: React.CSSProperties = {
  position: 'fixed',
  top: '10px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 9997,
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px 8px',
  background: '#141414',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  fontFamily: '"Courier New", monospace',
};
```

## Communication toolbar → SceneRenderer

### Option 1 : Custom Events (recommandé)

La toolbar dispatch des events custom que SceneRenderer écoute :

```typescript
// Toolbar dispatch
window.dispatchEvent(new CustomEvent('overmind:toolbar-action', {
  detail: { action: 'toggle-camera' }
}));

// SceneRenderer écoute
window.addEventListener('overmind:toolbar-action', (e) => {
  const { action } = (e as CustomEvent).detail;
  switch (action) {
    case 'toggle-camera': toggleCameraMode(); break;
    case 'frame-selected': /* ... */ break;
    case 'home': /* ... */ break;
    case 'gizmo-translate': /* ... */ break;
    // ...
  }
});
```

**Avantage** : découplage total, la toolbar ne connaît pas SceneRenderer.

### Option 2 : Simuler les touches clavier

```typescript
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
```

**Avantage** : réutilise les handlers existants, zéro duplication.
**Inconvénient** : fragile, les guards (e.target instanceof HTMLInputElement) pourraient bloquer.

### Recommandation : Option 2 pour le MVP

C'est le plus simple et garantit que toolbar et clavier ont exactement le même comportement. Si un bug apparaît, on passera à l'Option 1.

## État réactif de la toolbar

La toolbar a besoin de connaître :
- `freeCameraActive` → via event `overmind:camera-mode` (existe déjà)
- `selectedId` → via `selectionActor` (useSelector)
- `gizmoMode` → via `selectionActor` (useSelector)
- `canUndo` / `canRedo` → via UndoRedoManager (Phase 7)

### Hook useToolbar

```typescript
// packages/overmind-3d/src/hooks/useToolbar.ts

function useToolbar() {
  const { selectionActor } = useOvermind();
  const [freeCameraActive, setFreeCameraActive] = useState(false);

  // Écouter le custom event camera mode
  useEffect(() => {
    const handler = (e: Event) => {
      setFreeCameraActive((e as CustomEvent).detail === 'free');
    };
    window.addEventListener('overmind:camera-mode', handler);
    return () => window.removeEventListener('overmind:camera-mode', handler);
  }, []);

  const selectedId = useSelector(selectionActor, s => s?.context.selectedId ?? null);
  const gizmoMode = useSelector(selectionActor, s => s?.context.mode ?? 'translate');

  return { freeCameraActive, selectedId, gizmoMode };
}
```

## Intégration dans OvermindOverlay

```typescript
// OvermindOverlay.tsx
import { Toolbar } from './Toolbar.tsx';

// Dans le JSX :
{showDevPanel && !isMobile && <Toolbar />}
{showDevPanel && !isMobile && <DevControlPanel />}
{showDevPanel && !isMobile && <TimelinePanel />}
```

## Fichiers impactés

- **Nouveau** : `packages/overmind-3d/src/components/Toolbar.tsx`
- **Nouveau** : `packages/overmind-3d/src/hooks/useToolbar.ts` (optionnel, peut être inline)
- **Modifié** : `packages/overmind-3d/src/components/OvermindOverlay.tsx` — import + rendu de Toolbar
- **Modifié** : `packages/overmind-3d/src/index.ts` — export si nécessaire

## Progressive delivery

La toolbar peut être implémentée **progressivement** :
1. **MVP** : boutons Camera (F), Transform (G/R/S), Capture (I/E/V) — fonctionnel immédiatement
2. **Après Phase 6** : ajouter Duplicate (Shift+D) et Delete
3. **Après Phase 7** : ajouter Undo/Redo
4. **Après Phase 8** : indicateur de visibilité pour l'objet sélectionné

## Vérification

1. La toolbar apparaît en top-center quand `showDevPanel === true`
2. Chaque bouton déclenche la même action que le raccourci clavier correspondant
3. Les boutons reflètent l'état actif (free camera bleu, gizmo mode bleu)
4. Les boutons désactivés sont grisés (Frame Selected sans sélection, etc.)
5. Tooltip au hover montre le nom + raccourci
6. Responsive : la toolbar ne chevauche pas le DevPanel
7. `pnpm type-check` → 0 erreurs
