# Plan Phase D — Polish

## Vue d'ensemble

Phase D ajoute les finitions visuelles et UX. Aucun de ces items n'est bloquant pour les autres — ce sont des améliorations indépendantes.

1. **#6 items restants** — Grille infinie shader, gizmo navigation, marqueur Eye origin
2. **#3 Timeline polish** — Rendu visuel (barres interpolation, formes KF), "Only Show Selected" avancé
3. **#1 Shortcuts overlay** — Overlay avec tous les raccourcis par mode

---

## D.1 — #6 Feedback visuel (items restants)

### Items

#### a. Grille infinie shader
- `InfiniteGridHelper` : plane infini avec shader GLSL custom
- 2 niveaux de grille (fine + grosse), subdivision dynamique selon zoom
- Axes X/Z colorés (rouge/bleu), fade-out progressif à la distance
- Shader : `fwidth()` pour anti-aliasing, mélange alpha selon distance à la caméra
- Un seul fichier nouveau : `scene/InfiniteGrid.ts` (~80 lignes shader + geometry)

#### b. Gizmo navigation (ViewCube)
- Indicateur d'axes X/Y/Z en haut à droite du viewport
- Clic sur un axe → snap vers la vue orthographique correspondante (animation smooth)
- Drag → orbiter la caméra
- Options : `three-viewport-gizmo` (compatible camera-controls) ou `THREE.ViewHelper`
- Fichier : intégration dans `SceneRenderer.tsx`

#### c. Marqueur Eye origin
- Croix 3D + cercle pointillé à la position de départ de l'Eye
- `THREE.Group` avec `THREE.Line` (croix) + `THREE.Points` (cercle)
- `depthTest: false` pour toujours visible
- Fichier : `scene/eyeOriginMarker.ts`

### Prérequis : Aucun (indépendant)

### Complexité : Moyenne

---

## D.2 — #3 Timeline polish

### Items

#### a. Barres d'interpolation entre keyframes
- Segment coloré entre deux KFs consécutifs sur une même piste
- Pas de barre = Bézier (défaut)
- Ligne verte = Linear
- Ligne verte foncée = Constant
- Barre grise = Hold (valeurs identiques)
- Implémenté dans `TrackContent.tsx`

#### b. Formes de KF selon handle type (futur, post-Bézier)
- Cercle = Auto-Clamped
- Diamant pointu = Free
- Losange = Aligned
- Carré = Vector
- Nécessite les handles Bézier de Phase C (#2 étape 3)
- Implémenté dans `sub-components.tsx` (Diamond composant)

#### c. "Only Show Selected" mode avancé
- Si implémenté en Phase B (version basique), ajouter :
  - "Always Show Active" — l'objet actif reste visible même si filtre actif
  - Filtre par nom (champ de recherche)
  - Filtre par type d'objet (icônes cliquables)

#### d. Summary channel (optionnel)
- Piste spéciale en haut qui agrège tous les KFs visibles
- Diamant par frame contenant au moins 1 KF
- Clic = sélectionner tous les KFs à cette frame

### Prérequis : Phase B #3 fixes (baseline), Phase C #2 étape 3 (pour les formes)

### Complexité : Moyenne

---

## D.3 — #1 Shortcuts overlay

### Items

- Overlay HTML semi-transparent affichant tous les raccourcis
- Organisé par mode (Object Mode / Edit Mode / Preview)
- Toggle via un bouton ou raccourci (ex: `?` ou `Shift+/`)
- Format : grille 2 colonnes (raccourci | description)
- Sections par catégorie : Navigation, Sélection, Manipulation, Outils
- Dynamique : affiche les raccourcis du mode courant (via `interactionModeMachine`)

### Fichier unique : `components/ShortcutsOverlay.tsx`

### Prérequis : Phase B #7 Modes (pour le contexte par mode)

### Complexité : Faible (UI pure, pas de logique métier)

---

## Ordre d'implémentation Phase D

Les 3 chantiers sont indépendants. Ordre suggéré par impact visuel :

1. **D.1a** Grille infinie — amélioration visuelle immédiate
2. **D.2a** Barres d'interpolation — meilleure lisibilité timeline
3. **D.1b** Gizmo navigation — navigation plus intuitive
4. **D.2c** Only Show Selected avancé — UX timeline
5. **D.1c** Marqueur Eye origin — feedback 3D
6. **D.3** Shortcuts overlay — aide utilisateur
7. **D.2b** Formes KF — ne peut être fait qu'après Bézier handles
8. **D.2d** Summary channel — optionnel, nice-to-have
