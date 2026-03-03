# Plan Phase B — Fondations

## Vue d'ensemble

Phase B pose les bases architecturales nécessaires aux gros chantiers de Phase C. Deux chantiers :

1. **#7 Modes** — Machine `interactionModeMachine` (Object / Edit / Preview)
2. **#3 Timeline fixes** — Bug 150 frames, pistes dynamiques, "Only Show Selected"

---

## B.1 — #7 Modes (interactionModeMachine)

### Objectif

Remplacer le `curveEditMode` (booléen dans selectionMachine) par un vrai système de modes global qui détermine le comportement des raccourcis, de la toolbar et des overlays.

### Architecture

Nouvelle machine XState v5 `interactionModeMachine` avec 3 états :
- **objectMode** (défaut) — manipulation d'objets entiers
- **editMode** — édition interne (points, handles, bandes, contenu)
- **previewMode** — simulation visiteur (scroll-driven)

Context : `{ editTargetId: string | null, editTargetType: 'curve' | 'text' | 'neon' | 'card' | null }`

### Fichiers impactés

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `machines/interactionModeMachine.ts` | **Nouveau** — machine XState |
| 2 | `hooks/useInteractionMode.ts` | **Nouveau** — hook React |
| 3 | `scene/keyboardHandler.ts` | Refactoring majeur — routage par mode |
| 4 | `machines/selectionMachine.ts` | Supprimer `curveEditMode` |
| 5 | `scene/selectionSystem.ts` | Supprimer `setCurveEditMode()` |
| 6 | `components/Toolbar.tsx` | Indicateur de mode + boutons contextuels |
| 7 | `scene/SceneRenderer.tsx` | Créer + passer la machine mode |
| 8 | `hooks/useOvermind.ts` | Exposer `modeActor` |

### Étapes

1. Créer la machine + le hook
2. Intégrer dans SceneRenderer (créer l'acteur, le passer aux deps)
3. Refactorer keyboardHandler : `switch (mode)` → `handleObjectModeKey()` / `handleCurveEditKey()` / etc.
4. Migrer `curveEditMode` → `editMode + editTargetType='curve'`
5. Tab = toggle Object ↔ Edit (si l'objet supporte Edit)
6. Toolbar : afficher le mode courant, icône/couleur par mode
7. Preview mode : F5 ou bouton → disable gizmos, enable scroll, hide dev panel

### Complexité : Élevée

Le keyboardHandler actuel (~525 lignes) doit être découpé en handlers par mode. C'est le plus gros refactoring de cette phase.

### Prérequis : Aucun (Phase A terminée)

### Bloque : #2 Eye Path (E = extrude en Edit Mode courbe), #4 Outliner contextuel (panels par mode)

---

## B.2 — #3 Timeline fixes

### Objectif

Corriger les bugs et limitations UX de la timeline avant d'ajouter des features visuelles en Phase D.

### Items à implémenter

#### a. Bug 150 frames
- Investiguer pourquoi la timeline ne lit pas au-delà de ~150 frames
- Probablement lié à `totalFrames` dans la machine timeline ou au scroll mapping

#### b. Pistes dynamiques
- Les pistes Title, Subtitle, Card, Neon apparaissent au démarrage même sans contenu
- Solution : pistes créées automatiquement quand l'objet existe + a des keyframes
- Supprimer un objet → supprimer sa piste
- **Déjà partiellement implémenté** (useEffect dans TimelinePanel, ligne 56-81) — à vérifier et compléter

#### c. "Only Show Selected"
- Bouton toggle dans la toolbar de la timeline
- Quand activé : seules les pistes des objets sélectionnés dans le viewport sont visibles
- Lire `selectionActor.context.selectedIds` → filtrer `trackOrder`
- Le bouton est sticky (toggle on/off)

#### d. Scroll vertical
- Ajouter `overflowY: auto` sur le container de pistes quand il y a plus de pistes que d'espace visible
- Molette dans le panneau des noms = scroll vertical

### Fichiers impactés

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `machines/timelineMachine.ts` | Investigation bug totalFrames |
| 2 | `components/timeline/TimelinePanel.tsx` | Only Show Selected + scroll vertical |
| 3 | `components/timeline/types.ts` | DEFAULT_TRACK_ORDER : peut-être vide par défaut |

### Complexité : Moyenne

Le bug 150 frames est le seul vrai inconnu. Le reste est du filtrage React standard.

### Prérequis : Aucun (indépendant)

### Bloque : Phase D (Timeline polish)

---

## Ordre d'implémentation Phase B

1. **#7 Modes** en premier (fondation pour Phase C)
2. **#3 Timeline fixes** en parallèle si possible (indépendant)

Les deux peuvent être développés en parallèle puisqu'ils ne se touchent pas.
