# 07 — Modes (Edit / Object / User)

## Concept

Comme dans Blender, avoir des **modes d'interaction** qui changent le comportement de l'interface. Blender en a 8 modes, mais pour notre app on en garde 3 :

### 1. Object Mode (défaut)
- Sélection et manipulation d'objets entiers (texte, neon, card, eye, lights)
- G/R/S pour déplacer/tourner/redimensionner l'objet
- Shift+D pour dupliquer
- Delete pour supprimer
- Les objets sont manipulés comme des unités

### 2. Edit Mode (Tab sur un objet)
- On "entre" dans l'objet sélectionné pour éditer ses composants internes
- **Sur une courbe Bézier** : éditer les points de contrôle, les handles, ajouter/supprimer des points
- **Sur un texte** : éditer le contenu, la taille, les propriétés
- **Sur un neon** : éditer les bandes individuelles, les couleurs par bande
- G/R/S s'appliquent aux composants internes (points, handles) pas à l'objet entier
- Tab pour revenir en Object Mode

### 3. User Mode (test du portfolio)
- Simule l'expérience utilisateur finale
- Le scroll défile le portfolio comme un visiteur le verrait
- Pas de sélection, pas de gizmo, pas d'Outliner
- Permet de tester le rendu final sans interférences d'édition
- Touche pour entrer/sortir (ex: F5 ou un bouton "Preview")

---

## Recherches effectuées

### [x] Les modes de Blender — liste complète

| Mode | Types d'objets supportés | Usage |
|------|-------------------------|-------|
| **Object Mode** | Tous | Manipulation d'objets entiers |
| **Edit Mode** | Tous les objets rendables (mesh, curve, surface, text, armature) | Édition interne (vertices, points de contrôle) |
| Sculpt Mode | Mesh uniquement | Sculpture (pinceaux) |
| Vertex Paint | Mesh uniquement | Peindre les couleurs de vertices |
| Weight Paint | Mesh uniquement | Peindre les poids d'armature |
| Texture Paint | Mesh uniquement | Peindre les textures |
| Particle Edit | Mesh uniquement | Éditer les systèmes de particules |
| Pose Mode | Armature uniquement | Poser les os d'un squelette |

> Les 2 seuls modes essentiels pour nous : **Object Mode** et **Edit Mode**. + notre **User Mode** (spécifique à l'app).

### [x] Comment on switch entre les modes

#### Tab = raccourci principal
- **Tab** = toggle Object Mode ↔ Edit Mode
- Sélectionner un objet → Tab → entrer en Edit Mode sur CET objet
- Tab à nouveau → revenir en Object Mode
- **Ctrl+Tab** = pie menu de tous les modes disponibles pour cet objet

#### Le mode est global, pas par objet
- Toute la scène est dans un mode à la fois
- Depuis Blender 2.8 : on peut être en Edit Mode sur **plusieurs objets simultanément** (les sélectionner tous avant Tab)
- Mais c'est un cas avancé — en pratique on édite un objet à la fois

#### Tab sur un objet sans Edit Mode
- Si l'objet n'a pas d'Edit Mode (ex: un Empty, un Speaker), Tab ne fait rien
- Blender grise le menu du mode → seul Object Mode est disponible

### [x] Comment Blender change l'interface selon le mode

#### Menus qui changent
- **Object Mode** : menus Object, Add, etc.
- **Edit Mode** : menus Mesh (si mesh), Curve (si courbe), Vertex, Edge, Face
- Les menus du header changent complètement

#### Toolbar (barre d'outils à gauche)
- Change complètement les outils disponibles
- Object Mode : Select, Cursor, Move, Rotate, Scale
- Edit Mode : tout ça + Extrude, Bevel, Loop Cut, Knife, etc.
- Chaque mode a sa propre palette d'outils

#### Overlays viewport
- **Object Mode** : objets affichés normalement
- **Edit Mode** : vertices/edges/faces visibles, wireframe superposé, sélection de composants

#### Couleur du header
- Blender n'a **pas** nativement de changement de couleur de header par mode
- C'est un addon communautaire populaire ("Mode Highlight")
- Mais c'est une bonne pratique UX qu'on devrait implémenter

#### Raccourcis clavier — le même bouton fait des choses DIFFÉRENTES

| Raccourci | Object Mode | Edit Mode (mesh) | Edit Mode (courbe) |
|-----------|------------|-------------------|---------------------|
| G | Move objet | Move vertex/edge/face | Move point/handle |
| R | Rotate objet | Rotate composants | Rotate composants |
| S | Scale objet | Scale composants | Scale composants |
| E | (rien par défaut) | Extrude face/edge | Extrude point (extrémité) |
| Delete | Supprimer objet | Menu Delete (vertices/edges/faces) | Supprimer point |
| Shift+D | Dupliquer objet | Dupliquer composants | Dupliquer points |
| A | Select All objets | Select All composants | Select All points |
| V | (rien) | (rien) | Menu Handle Type |
| F | (rien) | Create Face/Edge | Connect endpoints |
| Tab | → Edit Mode | → Object Mode | → Object Mode |

> **Point clé** : les raccourcis G/R/S/Delete/Shift+D/A font des choses **complètement différentes** selon le mode. Le même event clavier doit être routé différemment.

---

### [x] Pattern d'implémentation — State Machine XState v5

#### Machine `interactionModeMachine`

```typescript
const interactionModeMachine = createMachine({
  id: 'interactionMode',
  initial: 'objectMode',
  context: {
    editTargetId: null as string | null,    // ID de l'objet en cours d'édition
    editTargetType: null as string | null,  // type de l'objet ('curve', 'text', 'neon')
  },
  states: {
    objectMode: {
      on: {
        ENTER_EDIT: {
          target: 'editMode',
          guard: 'canEnterEdit',  // vérifie que l'objet supporte l'Edit Mode
          actions: assign({
            editTargetId: ({ event }) => event.objectId,
            editTargetType: ({ event }) => event.objectType,
          }),
        },
        ENTER_PREVIEW: 'previewMode',
      },
    },
    editMode: {
      on: {
        EXIT_EDIT: {
          target: 'objectMode',
          actions: assign({ editTargetId: null, editTargetType: null }),
        },
        // Tab = raccourci qui envoie EXIT_EDIT
      },
    },
    previewMode: {
      on: {
        EXIT_PREVIEW: 'objectMode',
      },
    },
  },
});
```

#### Migration de `curveEditMode`
- Le `curveEditMode` actuel dans `selectionMachine` deviendrait un cas spécifique de `editMode` avec `editTargetType: 'curve'`
- `Shift+C` → remplacé par `Tab` quand une courbe est sélectionnée
- La machine `interactionModeMachine` remplace et généralise `curveEditMode`

#### Routing des raccourcis par mode

```typescript
// Dans keyboardHandler.ts
function handleKeydown(e: KeyboardEvent) {
  const modeSnap = modeActor.getSnapshot();
  const mode = modeSnap.value; // 'objectMode' | 'editMode' | 'previewMode'

  switch (mode) {
    case 'objectMode':
      handleObjectModeKey(e);
      break;
    case 'editMode':
      const type = modeSnap.context.editTargetType;
      if (type === 'curve') handleCurveEditKey(e);
      else if (type === 'text') handleTextEditKey(e);
      else if (type === 'neon') handleNeonEditKey(e);
      break;
    case 'previewMode':
      handlePreviewModeKey(e); // très peu de raccourcis (Escape, F5)
      break;
  }
}
```

#### Types d'objets et leur Edit Mode

| Type | A un Edit Mode ? | Composants éditables |
|------|-----------------|---------------------|
| Courbe Bézier | Oui | Points de contrôle, handles |
| Texte (ScrollText) | Oui | Contenu, font, couleur |
| Neon | Oui | Bandes individuelles, couleurs |
| Card | Oui (simple) | Contenu, timing |
| Eye | Non | Manipulé en Object Mode |
| Light | Non | Propriétés dans l'Outliner |
| Camera | Non | Manipulée en Object Mode |

---

## Comportement souhaité

### Tab = toggle Object ↔ Edit Mode
1. Sélectionner un objet → **Tab** → entrer en Edit Mode sur cet objet
2. L'interface change : toolbar, raccourcis, overlays viewport
3. **Tab** à nouveau → revenir en Object Mode
4. Si l'objet n'a pas d'Edit Mode → Tab ne fait rien (ou notification)

### Indicateur de mode
1. Label dans la toolbar ou le header : "Object Mode" / "Edit Mode: Curve" / "Preview"
2. Couleur d'accent différente par mode (subtil, pas agressif)
3. Optionnel : bordure du viewport change de couleur

### User Mode (Preview)
1. **F5** (ou bouton "Preview") → entrer en User Mode
2. Scroll = défilement du portfolio
3. Pas de gizmo, pas d'Outliner, pas de toolbar d'édition
4. **Escape** ou **F5** → revenir en Object Mode
5. Le mode Scroll Camera actuel (touche F) pourrait devenir le User Mode

### Lien avec le code existant
- `curveEditMode` (selectionMachine) → migré dans `interactionModeMachine.editMode` avec `editTargetType: 'curve'`
- `Shift+C` → remplacé par **Tab** quand une courbe est sélectionnée
- Touche **F** (free camera toggle) → évaluer si ça reste séparé ou intégré aux modes

---

## Questions résolues

1. **User Mode remplace le Scroll Camera ?** → Oui, le User Mode EST le mode scroll/preview. La touche F toggle actuellement entre scroll et free camera — ça deviendrait F5 = User Mode (scroll) vs mode éditeur (free camera toujours).
2. **Tab toggle ou raccourci dédié ?** → Tab toggle (comme Blender). Ctrl+Tab pour un pie menu si on a plus de modes plus tard.
3. **Tab sur un objet sans Edit Mode ?** → Ne fait rien. L'objet reste en Object Mode.

---

## Dépendances

- #2 (Eye Path Rework) : les courbes Bézier s'éditent en Edit Mode
- #4 (Outliner contextuel) : le panneau change selon le mode
- `curveEditMode` existant dans selectionMachine → à migrer

## Complexité : Élevée — change le comportement global de l'app (raccourcis, toolbar, sélection, overlays)
