# Plan Phase A — #6a Feedback visuel simple

## Objectif

Ajouter du feedback visuel pour mieux lier la scène 3D et la timeline :
1. **Couleurs eyePath sphères** — jaune (normal) → orange (hover) → blanc (sélectionné)
2. **Highlight piste timeline** — quand un objet 3D est sélectionné, sa piste timeline s'illumine

## Fichiers (3 fichiers)

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `scene/eyePathSystem.ts` | Matériaux individuels + couleur selon état sélection |
| 2 | `components/timeline/TimelinePanel.tsx` | Style highlight piste selon sélection 3D |
| 3 | `components/timeline/constants.ts` | Couleur/style pour le highlight |

Chemins relatifs à `packages/overmind-3d/src/`.

---

## 1. eyePathSystem.ts — Couleurs dynamiques

### Problème actuel

Toutes les sphères partagent UN seul matériau (`this.sharedMat`, ligne 26). Changer la couleur d'une sphère change TOUTES les sphères. Il faut des matériaux individuels.

### 1a. Nouvelles constantes (remplacer lignes 8-9)

```typescript
// AVANT
const CURVE_COLOR = 0xFFEB3B;
const SPHERE_COLOR = 0xFFEB3B;

// APRÈS
const SPHERE_COLOR_DEFAULT = 0xFFEB3B;   // Jaune
const SPHERE_COLOR_HOVER   = 0xFFA726;   // Orange
const SPHERE_COLOR_SELECTED = 0xFFFFFF;  // Blanc
const CURVE_COLOR = 0xFFEB3B;
```

### 1b. Supprimer le matériau partagé

Retirer `sharedMat` du constructeur et des propriétés :

```typescript
// AVANT (ligne 18 + 26)
private sharedMat: THREE.MeshBasicMaterial;
// ...
this.sharedMat = new THREE.MeshBasicMaterial({ color: SPHERE_COLOR });

// APRÈS — supprimer ces deux lignes
// (chaque sphère aura son propre matériau)
```

### 1c. Matériaux individuels dans syncFromState (ligne 54)

```typescript
// AVANT
const mesh = new THREE.Mesh(this.sharedGeo, this.sharedMat);

// APRÈS
const mat = new THREE.MeshBasicMaterial({ color: SPHERE_COLOR_DEFAULT });
const mesh = new THREE.Mesh(this.sharedGeo, mat);
```

### 1d. Nouvelle méthode publique `updateColors`

Ajouter après `getPointPosition()` (~ligne 89) :

```typescript
/**
 * Met à jour les couleurs des sphères selon l'état de sélection/hover.
 * Appelé par le bridge à chaque changement de sélection.
 */
updateColors(selectedIds: Set<string>, hoveredId: string | null): void {
  for (const [idx, mesh] of this.spheres) {
    const id = `eyePath:${idx}`;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (selectedIds.has(id)) {
      mat.color.setHex(SPHERE_COLOR_SELECTED);
    } else if (hoveredId === id) {
      mat.color.setHex(SPHERE_COLOR_HOVER);
    } else {
      mat.color.setHex(SPHERE_COLOR_DEFAULT);
    }
  }
}
```

### 1e. Dispose — nettoyer les matériaux individuels

Modifier `dispose()` pour disposer chaque matériau :

```typescript
// AVANT (ligne 101-103)
this.sharedGeo.dispose();
this.sharedMat.dispose();

// APRÈS
this.sharedGeo.dispose();
for (const mesh of this.spheres.values()) {
  (mesh.material as THREE.Material).dispose();
}
```

Et dans `syncFromState`, disposer les anciens matériaux lors du clear (ligne 40-47) :

```typescript
// Ajouter avant le while loop de clear
for (const mesh of this.spheres.values()) {
  (mesh.material as THREE.Material).dispose();
}
```

~25 lignes de changement.

### 1f. Appeler updateColors — depuis le bridge

Le bridge existant (`timelineBridge.ts` ou `gizmoBridge.ts`) doit appeler `eyePathSystem.updateColors()` quand la sélection change. Ça se fait via le subscription existant de `selectionActor` :

```typescript
// Dans le bridge qui subscribe à selectionActor
selectionActor.subscribe((snap) => {
  const selectedIds = new Set(snap.context.selectedIds ?? []);
  const hoveredId = snap.context.hoveredId ?? null;
  eyePathSystem.updateColors(selectedIds, hoveredId);
});
```

**Note** : Le `hoveredId` n'existe pas encore dans la selectionMachine. Pour la phase A on peut ignorer le hover et juste gérer selected/default. Le hover sera ajouté quand on implémentera un vrai hover system dans le viewport.

Version simplifiée :

```typescript
// subscription dans SceneRenderer ou timelineBridge
eyePathSystem.updateColors(new Set(selectedIds), null);
```

---

## 2. TimelinePanel.tsx — Highlight piste

### Principe

Quand un objet est sélectionné dans la scène 3D (via `selectionActor.context.selectedIds`), la piste timeline correspondante a un fond légèrement lumineux.

### 2a. Lire la sélection 3D

Le `selectionActor` est déjà passé au composant (ligne 26). Ajouter un `useSelector` :

```typescript
import { useSelector } from '@xstate/react';

// Dans TimelinePanelContent, après les autres hooks :
const selectedSceneIds = useSelector(
  selectionActor,
  (s) => s?.context.selectedIds ?? [],
);
```

### 2b. Mapper selectedIds vers TrackId

Créer un Set de track IDs à highlight :

```typescript
const highlightedTracks = useMemo(() => {
  const set = new Set<TrackId>();
  for (const id of selectedSceneIds) {
    if (id.startsWith('eyePath:')) {
      set.add('eye-path');
    } else if (id === 'model') {
      // pas de piste spécifique
    } else {
      // instance → piste el:xxx
      set.add(`el:${id}` as TrackId);
    }
  }
  return set;
}, [selectedSceneIds]);
```

### 2c. Appliquer le style dans le trackRow (ligne 443)

```typescript
// AVANT
<div key={id} style={{
  ...s.trackRow,
  height: isCollapsed ? '14px' : undefined,
  opacity: isDragged ? 0.4 : 1,
  position: 'relative' as const,
}}>

// APRÈS
const isHighlighted = highlightedTracks.has(id);
// ...
<div key={id} style={{
  ...s.trackRow,
  height: isCollapsed ? '14px' : undefined,
  opacity: isDragged ? 0.4 : 1,
  position: 'relative' as const,
  background: isHighlighted ? 'rgba(255, 255, 255, 0.06)' : undefined,
  borderLeft: isHighlighted ? `2px solid ${getTrackColor(id)}` : undefined,
}}>
```

Le highlight est subtil : fond blanc 6% opacité + bordure gauche colorée (couleur de la piste). Assez visible sans être intrusif.

~15 lignes ajoutées.

---

## 3. constants.ts — Pas de changement

Les couleurs de piste (`getTrackColor`) sont déjà définies et suffisantes. Pas besoin d'ajouter de constantes supplémentaires — le highlight utilise `rgba` inline + la couleur de piste existante.

---

## Flux complet

```
Sphères eyePath :
1. Utilisateur clique sur une sphère eyePath dans le viewport
2. SelectionSystem → selectionActor.send(SELECT, id: 'eyePath:3')
3. Bridge subscribe → eyePathSystem.updateColors({eyePath:3}, null)
4. Sphère 3 → blanc, autres → jaune

Timeline highlight :
1. Utilisateur sélectionne un objet 3D (clic viewport)
2. selectionActor.context.selectedIds = ['neon_1']
3. useSelector → selectedSceneIds = ['neon_1']
4. highlightedTracks = Set(['el:neon_1'])
5. La piste 'el:neon_1' a un fond lumineux + bordure colorée
```

---

## Cas limites

1. **Multi-sélection** : Plusieurs sphères blanches + plusieurs pistes highlight → fonctionne car on utilise des Sets
2. **Aucune sélection** : Tous jaunes + aucun highlight → état par défaut
3. **Performance** : `updateColors` est O(n) sur le nombre de sphères (max ~20 en pratique) → négligeable
4. **Matériaux individuels vs partagé** : ~20 matériaux au lieu d'un. Overhead mémoire négligeable pour MeshBasicMaterial
5. **Piste 'eye-path' highlight** : Quand on sélectionne UNE sphère eyePath, toute la piste s'illumine (pas un seul diamant). C'est le comportement souhaité pour la phase A.

---

## Vérification

1. `source ~/.nvm/nvm.sh && nvm use 22 && cd packages/overmind-3d && pnpm tsc --noEmit`
2. Tests manuels :
   - Cliquer sur une sphère eyePath → elle devient blanche, les autres restent jaunes
   - Multi-sélectionner (Shift+clic) → toutes les sélectionnées deviennent blanches
   - Déselectionner (Alt+A) → toutes redeviennent jaunes
   - Sélectionner un objet dans le viewport → sa piste dans la timeline s'illumine
   - Sélectionner une sphère eyePath → la piste "Eye Path" s'illumine
   - Aucune sélection → aucun highlight de piste
