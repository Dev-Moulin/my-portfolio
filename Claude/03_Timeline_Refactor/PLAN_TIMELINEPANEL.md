# Plan 2 — Refactoring TimelinePanel (996 → ~720 lignes)

## Objectif

Extraire les sous-composants purs + constantes/types dans des fichiers dédiés.
**On ne touche PAS aux hooks/effets** (trop couplés = risque pour pas assez de gain).

## Principes

- **Aucun changement fonctionnel**
- On extrait uniquement ce qui est découplé et autonome
- Le composant principal `TimelinePanelContent` reste intact

---

## Structure cible

```
components/
  timeline/
    TimelinePanel.tsx        (~720 lignes)  ← composant principal inchangé
    sub-components.tsx       (~280 lignes)  ← Ruler, EdgeHandle, ClipBar, KeyframeDiamond, DwellMarker, Cursor
    constants.ts             (~50 lignes)   ← dimensions, COLORS, styles `s`, TRACK_COLORS, TRACK_LABELS, edgeToField()
    types.ts                 (~20 lignes)   ← TrackId, ClipEdge, DragState, ClipOriginal, DEFAULT_TRACK_ORDER
```

---

## Détails

### `types.ts`

Contient (lignes 17-133 actuelles) :
- `type TrackId = 'camera' | 'title' | 'subtitle' | 'card'`
- `type ClipEdge = 'start' | 'enterEnd' | 'exitStart' | 'end'`
- `const DEFAULT_TRACK_ORDER: TrackId[]`
- `interface ClipOriginal`
- `type DragState` (les 5 variants)

### `constants.ts`

Contient (lignes 9-117 + 421-433 + 989-996) :
- Dimensions : `TRACK_HEIGHT`, `HEADER_WIDTH`, `PANEL_HEIGHT_COLLAPSED/EXPANDED`, `EDGE_HANDLE_W`
- `COLORS` object
- Styles `s` object
- `TRACK_COLORS` et `TRACK_LABELS` records
- `edgeToField()` helper function

### `sub-components.tsx`

Contient (lignes 137-417) — 6 composants purs :
- `Ruler` (lignes 137-186) — graduation de la timeline
- `EdgeHandle` (lignes 188-219) — poignée de redimensionnement des clips
- `ClipBar` (lignes 221-294) — barre de clip avec phases enter/exit
- `KeyframeDiamond` (lignes 296-330) — losange de keyframe camera
- `DwellMarker` (lignes 332-386) — marqueur de dwell interactif
- `Cursor` (lignes 388-417) — curseur rouge de lecture

Chaque composant importe `COLORS`, `s`, `EDGE_HANDLE_W` etc. depuis `constants.ts`.

### `TimelinePanel.tsx`

Garde intact (lignes 437-985) :
- `TimelinePanel()` — composant public avec guard
- `TimelinePanelContent()` — toute la logique : hooks, effets, keyboard, drag, JSX
- Importe les sous-composants, constantes et types depuis les nouveaux fichiers

---

## Imports à mettre à jour

- `OvermindOverlay.tsx` ou `index.ts` : adapter le chemin d'import de `TimelinePanel`

---

## Étapes d'exécution

1. Créer le dossier `components/timeline/`
2. Extraire `types.ts`
3. Extraire `constants.ts`
4. Extraire `sub-components.tsx`
5. Déplacer + adapter `TimelinePanel.tsx`
6. Mettre à jour les imports externes
7. `pnpm type-check` → 0 erreurs
8. `pnpm build` → succès
