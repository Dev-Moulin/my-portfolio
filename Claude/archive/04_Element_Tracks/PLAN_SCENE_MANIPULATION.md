# Phase — Manipulation directe des objets 3D (style Blender)

## Concept

Pouvoir cliquer sur un objet dans la scene 3D, le selectionner (contour orange),
puis le deplacer / tourner / scaler visuellement avec des gizmos — comme dans Blender.

```
 Clic sur l'oeil  →  contour orange  →  G (grab)  →  drag pour deplacer
                                         R (rotate) → drag pour tourner
                                         S (scale)  → drag pour scaler
                                         X/Y/Z      → contraindre a un axe
```

---

## Objets manipulables

| Objet | Type | Manipulation possible | Stockage actuel |
|-------|------|----------------------|-----------------|
| Modele (oeil Overmind) | Mesh 3D (GLTF) | Position, Rotation, Scale | `modelRef` dans SceneRenderer |
| Titre 3D | Troika Text mesh | Position | Prive dans `ScrollTextSystem` |
| Sous-titre 3D | Troika Text mesh | Position | Prive dans `ScrollTextSystem` |
| Neon Bands (groupe) | THREE.Group | Position, Scale | Prive dans `NeonBandsSystem` |
| Lumiere directionnelle | THREE.DirectionalLight | Position | `lightingActor` context |
| Lumiere point | THREE.PointLight | Position | `lightingActor` context |
| ScrollCard | HTML/CSS | Drag 2D (top/left %) | `timelineActor` context |

---

## Etat actuel du code

### Ce qui existe deja
- **Three.js 0.178** avec `EffectComposer` + `UnrealBloomPass`
- **camera-controls** pour la camera libre (toggle F)
- **InputTracker** qui suit la souris en NDC (-1 to 1)
- **Machines XState** pour chaque systeme (model, lighting, scene, neon, etc.)

### Ce qui n'existe PAS encore
- **Aucun Raycaster** — pas de detection de clic sur les objets
- **Aucun systeme de selection** — pas d'outline, pas de highlight
- **Aucun gizmo** — pas de poignees de transformation
- **Acces prive** — les meshes de ScrollText et NeonBands sont prives dans leurs systemes

---

## Architecture proposee

### Nouveau fichier : `scene/selectionSystem.ts`

Gere :
- Le **raycaster** (THREE.Raycaster)
- La **liste d'objets selectionnables** (registre)
- L'**objet selectionne** courant
- L'**outline** de selection (OutlinePass ou shader custom)

### Nouveau fichier : `scene/gizmoSystem.ts`

Gere :
- Les **gizmos** visuels (fleches translate, cercles rotate, cubes scale)
- Le **mode actif** (translate / rotate / scale)
- La **contrainte d'axe** (X, Y, Z, ou libre)
- Le **drag** (calcul de la transformation depuis le mouvement souris)

### Nouvelle machine : `machines/selectionMachine.ts`

```typescript
SelectionContext {
  selectedId: string | null;         // 'model' | 'title' | 'subtitle' | 'neon' | 'dirLight' | 'pointLight' | null
  mode: 'translate' | 'rotate' | 'scale';
  axisLock: 'x' | 'y' | 'z' | null; // contrainte d'axe
  isTransforming: boolean;           // drag en cours
}
```

Events : `SELECT`, `DESELECT`, `SET_MODE`, `SET_AXIS`, `START_TRANSFORM`, `END_TRANSFORM`

---

## Sous-phases d'implementation

### Sous-phase 1 — Exposer les meshes prives

**Fichiers** : `scene/scrollText.ts`, `scene/neonBands.ts`

Ajouter des getters publics :
```typescript
// scrollText.ts
getSelectableObjects(): THREE.Object3D[] {
  return [this.titleMesh, this.subtitleMesh].filter(Boolean);
}
getGroup(): THREE.Group { return this.group; }

// neonBands.ts
getSelectableObjects(): THREE.Object3D[] { return [this.group]; }
getGroup(): THREE.Group { return this.group; }
```

Attacher des `userData.id` aux meshes pour identification :
```typescript
this.titleMesh.userData.selectableId = 'title';
this.subtitleMesh.userData.selectableId = 'subtitle';
this.group.userData.selectableId = 'neon';
```

**Complexite** : Faible

---

### Sous-phase 2 — Raycaster + Selection

**Fichiers** : nouveau `scene/selectionSystem.ts`, modifier `SceneRenderer.tsx`

Le SelectionSystem :
1. Maintient un **registre** d'objets selectionnables (`Map<string, THREE.Object3D>`)
2. Au **clic** (pas drag, sinon c'est une rotation camera) :
   - Cast un ray depuis la camera vers le point clique
   - Teste l'intersection avec tous les objets du registre
   - Selectionne le plus proche
3. **Clic dans le vide** → deselectionne

Integration dans SceneRenderer :
- Creer le SelectionSystem au setup
- Enregistrer les objets au fur et a mesure qu'ils sont crees (modele, textes, neons, lights)
- Ecouter les clics sur le canvas

**Complexite** : Moyenne

---

### Sous-phase 3 — Outline de selection

**Fichiers** : `scene/selectionSystem.ts`, modifier `SceneRenderer.tsx`

Deux options :

**Option A — OutlinePass** (post-processing, integre a Three.js)
- Ajouter un `OutlinePass` au `EffectComposer` existant
- Quand un objet est selectionne → `outlinePass.selectedObjects = [mesh]`
- Couleur : orange (#FF9800) comme Blender
- Pro : simple, deja dans Three.js
- Con : un pass de rendu supplementaire

**Option B — Shader custom** (edge detection sur le mesh)
- Dupliquer le mesh, agrandir legerement, render en wireframe orange
- Pro : pas de pass supplementaire
- Con : plus de code, gestion des geometries complexes

**Recommandation** : Option A (OutlinePass) — plus simple, performance acceptable.

**Complexite** : Faible-Moyenne

---

### Sous-phase 4 — Gizmo de translation (G = grab)

**Fichiers** : nouveau `scene/gizmoSystem.ts`, modifier `SceneRenderer.tsx`

Le GizmoSystem :
1. Cree les **fleches gizmo** (3 fleches X/Y/Z + plan central) comme meshes Three.js
2. Les positionne sur l'objet selectionne
3. Au **mousedown sur une fleche** :
   - Detecte quel axe est clique
   - Calcule le plan de projection
   - Au mousemove : projette le mouvement souris sur l'axe → delta de position
   - Applique le delta a l'objet
4. Au **mouseup** : finalise et envoie la position a la machine XState correspondante

Raccourcis :
- **G** → active le mode translate (drag libre)
- **G puis X** → contraint a l'axe X
- **G puis Y** → contraint a l'axe Y
- **G puis Z** → contraint a l'axe Z
- **Echap** → annule le deplacement

**Complexite** : Elevee (c'est le coeur du systeme)

---

### Sous-phase 5 — Gizmo de rotation (R)

**Fichiers** : `scene/gizmoSystem.ts`

Meme pattern que translate mais avec des cercles :
- 3 cercles (X/Y/Z) autour de l'objet
- Drag sur un cercle = rotation autour de cet axe
- **R** → mode rotation libre
- **R puis X/Y/Z** → contraindre

**Complexite** : Moyenne (le pattern existe deja depuis translate)

---

### Sous-phase 6 — Gizmo de scale (S)

**Fichiers** : `scene/gizmoSystem.ts`

Meme pattern avec des cubes aux extremites :
- 3 cubes (X/Y/Z) + cube central (scale uniforme)
- Drag = scale sur l'axe
- **S** → mode scale
- **S puis X/Y/Z** → contraindre

**Complexite** : Moyenne

---

### Sous-phase 7 — Synchronisation avec les machines XState

**Fichiers** : `scene/gizmoSystem.ts`, machines existantes

Quand on deplace un objet via le gizmo, il faut mettre a jour la machine correspondante :

| Objet | Machine | Event a envoyer |
|-------|---------|-----------------|
| Modele | `modelActor` | `SET_POSITION(x,y,z)`, `SET_SCALE(s)`, `SET_BASE_ROTATION_Y(r)` |
| Titre | `timelineActor` | `UPDATE_TITLE_LAYOUT({ endX, endY, endZ })` |
| Sous-titre | `timelineActor` | `UPDATE_SUBTITLE_LAYOUT({ endX, endY, endZ })` |
| Neon group | `neonBandsActor` | `UPDATE_POSITION_X/Y/Z(v)`, `UPDATE_SCALE(v)` |
| Dir. light | `lightingActor` | `UPDATE_DIRECTIONAL_POSITION({x,y,z})` |
| Point light | `lightingActor` | (ajouter event `UPDATE_POINT_POSITION`) |

**Complexite** : Moyenne

---

### Sous-phase 8 — Drag 2D pour les elements HTML

**Fichiers** : `components/ScrollCard.tsx` ou nouveau composant wrapper

Pour la ScrollCard (et futurs elements HTML) :
- Mode edition : drag direct sur l'element
- Convertir le mouvement pixel en pourcentages (top/left)
- Mettre a jour `timelineActor` (`SET_CARD_POS_TOP`, `SET_CARD_POS_LEFT`)

**Complexite** : Faible (c'est du drag HTML classique)

---

### Sous-phase 9 — Machine de selection + hook + DevPanel

**Fichiers** : `machines/selectionMachine.ts`, `hooks/useSelection.ts`, nouveau onglet DevPanel

- Machine : gere l'etat de selection
- Hook : expose `selectedId`, `mode`, `select()`, `deselect()`, `setMode()`, etc.
- Onglet DevPanel "Select" : affiche l'objet selectionne, permet de changer de mode, affiche les coordonnees en temps reel

**Complexite** : Faible-Moyenne

---

## Resume des sous-phases

| # | Sous-phase | Fichiers | Complexite | Dependances |
|---|-----------|----------|------------|-------------|
| 1 | Exposer les meshes prives | scrollText.ts, neonBands.ts | Faible | — |
| 2 | Raycaster + Selection | nouveau selectionSystem.ts, SceneRenderer.tsx | Moyenne | 1 |
| 3 | Outline de selection | selectionSystem.ts, SceneRenderer.tsx | Faible | 2 |
| 4 | Gizmo translate (G) | nouveau gizmoSystem.ts, SceneRenderer.tsx | Elevee | 2, 3 |
| 5 | Gizmo rotate (R) | gizmoSystem.ts | Moyenne | 4 |
| 6 | Gizmo scale (S) | gizmoSystem.ts | Moyenne | 4 |
| 7 | Sync XState machines | gizmoSystem.ts, machines existantes | Moyenne | 4 |
| 8 | Drag 2D elements HTML | ScrollCard.tsx | Faible | — |
| 9 | Machine selection + hook + DevPanel | selectionMachine.ts, useSelection.ts | Faible | 2 |

---

## Raccourcis clavier (style Blender)

| Touche | Action |
|--------|--------|
| Clic gauche | Selectionner l'objet sous la souris |
| Clic dans le vide | Deselectionner |
| G | Mode translate (grab) |
| R | Mode rotate |
| S | Mode scale |
| X | Contraindre a l'axe X (apres G/R/S) |
| Y | Contraindre a l'axe Y |
| Z | Contraindre a l'axe Z |
| Echap | Annuler la transformation en cours |
| F | Toggle camera libre (existant) |

---

## Risques et decisions

1. **Conflit avec la camera libre** : Quand F est actif (camera libre), les clics controlent la camera. Il faudra un mode "edition" distinct ou un modifier (ex: Alt+clic pour selectionner quand la camera est libre).

2. **Conflit avec les raccourcis timeline** : I/D/W sont deja pris. G/R/S/X/Y/Z sont libres.

3. **Performance du raycaster** : Le modele GLTF a beaucoup de geometrie. On peut optimiser en raycastant d'abord contre les bounding boxes.

4. **Gizmo from scratch vs librairie** : Three.js a `TransformControls` dans ses examples/addons. C'est une option pour la sous-phase 4 au lieu de coder from scratch. Pro : fonctionnel immediatement. Con : moins customisable, style different de Blender.

5. **Undo/Redo** : Pas prevu dans cette phase. A ajouter plus tard si necessaire.
