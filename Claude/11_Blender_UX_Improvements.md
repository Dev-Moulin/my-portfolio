# Améliorations UX — Comportements Blender

Discussion sur les lacunes UX découvertes pendant les tests manuels de copie + positionnement d'éléments.
Ce document sert de base pour de futures phases d'implémentation.

> Recherches détaillées dans [12_Blender_Research/](./12_Blender_Research/)

---

## 1. Shift+D — Comportement Blender complet

> Recherche complète : [01_ShiftD_Duplicate_Grab.md](./12_Blender_Research/01_ShiftD_Duplicate_Grab.md)

### Comportement actuel

Shift+D duplique l'objet sélectionné et le place à +2 unités en X. L'utilisateur doit ensuite le repositionner manuellement avec le gizmo.

### Comment Blender fait (résultat de la recherche)

Blender implémente Shift+D comme un **opérateur macro** qui chaîne 2 opérations :
1. `OBJECT_OT_duplicate` — crée la copie à la même position
2. `TRANSFORM_OT_translate` — entre immédiatement en mode Grab modal

**Flux détaillé :**

1. **Shift+D** → copie créée **à la même position** que l'original. La sélection bascule sur la copie.
2. **Mouvement souris** → l'objet suit le curseur en temps réel (delta depuis la position initiale de la souris)
3. **Enter / Clic gauche** → confirme la position
4. **Escape / Clic droit** → annule **uniquement le déplacement**, PAS la duplication. La copie reste superposée sur l'original.
5. **Ctrl+Z** → annule la duplication entière (supprime la copie) en un seul pas d'undo

**Pendant le grab, on peut :**
- `X` / `Y` / `Z` → contraindre le déplacement à un axe
- `Shift+X` / `Shift+Y` / `Shift+Z` → contraindre à un plan
- Taper un **nombre** → déplacement précis (ex: `X 2 Enter` = +2 sur X)
- `Shift` maintenu → mode précision (mouvement 1/10e)
- `Ctrl` maintenu → snap aux incréments

**Point critique :** Escape garde la copie (superposée). C'est un piège classique des débutants Blender.

### Comportement cible pour notre éditeur

1. Shift+D → duplication à la **même position** (plus +2 X)
2. Entrée automatique en **mode Grab modal** (caméra gelée, objet suit la souris)
3. Confirmation : Enter / Clic gauche
4. Annulation : Escape / Clic droit → copie reste à la position d'origine
5. Support contraintes d'axe X/Y/Z (voir §4)
6. Un seul Ctrl+Z annule tout (duplication + déplacement)

### Tâches

- [ ] Modifier Shift+D pour dupliquer à la même position (pas +2 X)
- [ ] Entrer automatiquement en mode Grab après duplication (macro duplicate + translate)
- [ ] Implémenter la confirmation/annulation (Enter/Escape/Clic)
- [ ] Geler la caméra pendant le grab modal
- [ ] L'objet suit le curseur via projection sur plan perpendiculaire à la vue
- [ ] Undo atomique : un seul `recordAction()` pour duplication + déplacement

---

## 2. Copie multi-objets (Shift+D avec multi-sélection)

> Recherche complète : [02_MultiObject_Duplicate.md](./12_Blender_Research/02_MultiObject_Duplicate.md)

### Problème actuel

Quand plusieurs objets sont sélectionnés (via Ctrl+Clic), Shift+D ne duplique que le dernier objet sélectionné. Impossible de copier 4 éléments en même temps.

### Comment Blender fait

- **Tous les objets sélectionnés** sont dupliqués simultanément (opération atomique)
- La sélection bascule sur les copies (les originaux sont désélectionnés)
- Les **positions relatives sont strictement préservées** : chaque objet reçoit le même vecteur delta
- Le grab s'applique au **groupe entier** (déplacement rigide)
- Le **pivot point** n'a pas d'effet sur le Grab (même delta pour tous)
- Les contraintes d'axe (X/Y/Z) s'appliquent **au groupe entier**
- Escape → tous les duplicats reviennent à leur position d'origine respective
- Ctrl+Z → tous les duplicats supprimés en un seul pas d'undo
- Nommage : `Cube` → `Cube.001` → `Cube.002` (suffixe auto-incrémenté)

### Comportement cible

- Shift+D avec N objets sélectionnés → N copies créées (itérer sur `selectedIds`)
- Toutes les copies en mode Grab ensemble
- Même delta de souris appliqué à chaque copie
- Positions relatives préservées
- Un seul `recordAction()` pour tout le groupe

### Tâches

- [ ] Shift+D itère sur tous les `selectedIds` et duplique chacun
- [ ] Les copies préservent les offsets relatifs
- [ ] Le mode Grab post-duplication s'applique au groupe entier
- [ ] Undo atomique pour tout le groupe

---

## 3. Miroir (Mirror — Ctrl+M)

> Recherche complète : [05_Mirror_CtrlM.md](./12_Blender_Research/05_Mirror_CtrlM.md)

### Problème actuel

Aucune fonction miroir n'existe. Pour obtenir une disposition symétrique, il faut manuellement dupliquer puis repositionner/pivoter chaque objet.

### Comment Blender fait

**Le miroir est simplement un scale de -1 sur un axe.** C'est beaucoup plus simple qu'on pourrait le croire.

**Flux :**
1. `Ctrl+M` → entre en mode modal mirror (objet pas encore transformé)
2. `X` / `Y` / `Z` → choisir l'axe de miroir
3. Preview en temps réel (l'objet est mirroré visuellement avant confirmation)
4. `Enter` / `LMB` → confirme
5. `Escape` / `RMB` → annule

**Détails :**
- Le miroir s'effectue par rapport au **pivot point actif** :
  - Median Point (défaut) → miroir autour du barycentre de la sélection
  - Individual Origins → chaque objet mirroré autour de son propre origin (positions inchangées)
- En Object Mode : la propriété **Scale** passe à -1 sur l'axe mirroré
- Fonctionne avec multi-sélection (groupe entier mirroré par rapport au pivot)

### Comportement cible

1. `Ctrl+M` → entre en mode modal mirror
2. Attendre `X`, `Y` ou `Z`
3. Appliquer `object.scale[axis] *= -1` + repositionner si pivot ≠ origin
4. Preview en temps réel
5. Confirmation / annulation standard

### Tâches

- [ ] Handler Ctrl+M → mode modal mirror (attente d'axe)
- [ ] Appliquer scale -1 sur l'axe choisi
- [ ] Repositionner l'objet par rapport au pivot (centroïde de la sélection)
- [ ] Support multi-sélection
- [ ] Undo/redo

### Complexité : Faible (c'est juste un scale -1) | Impact : Moyen

---

## 4. G/R/S — Modes modaux Blender + Contraintes d'axe

> Recherches complètes : [04_Modal_GRS.md](./12_Blender_Research/04_Modal_GRS.md) + [03_Axis_Constraints.md](./12_Blender_Research/03_Axis_Constraints.md)

### État actuel

- **G (Grab)** : non implémenté en mode modal (le gizmo translate existe)
- **R (Rotate)** : non implémenté en mode modal (le gizmo rotate existe)
- **S (Scale)** : implémenté en mode modal (Phase 1 ✓) mais sans contrainte d'axe

### Comment Blender fait — Moteur de transformation partagé

Les 3 modes utilisent le **même moteur** (`TransInfo` / `TransData`). La seule différence est le pointeur de fonction (`applyTranslation`, `applyRotation`, `applyResize`).

**Pattern modal commun :**
1. Appui unique (G/R/S) → entre en mode modal
2. Mouvement souris → transformation en temps réel
3. Enter / Clic gauche → confirme
4. Escape / Clic droit → annule (rollback via valeurs sauvegardées)

**Les modes sont mutuellement exclusifs** — on NE PEUT PAS passer de G à R pendant un modal. Il faut confirmer ou annuler d'abord.

**Spécificités par mode :**

| Mode | Calcul | Axe par défaut |
|------|--------|---------------|
| **G (Grab)** | Mouvement souris projeté sur plan perpendiculaire à la vue | Libre (plan de la vue) |
| **R (Rotate)** | Angle entre pivot→souris_initiale et pivot→souris_courante (en 2D screen space) | Perpendiculaire à la vue |
| **S (Scale)** | Ratio distance(pivot, souris_courante) / distance(pivot, souris_initiale) | Uniforme sur 3 axes |

**Modificateurs communs :**

| Touche | G | R | S |
|--------|---|---|---|
| `Shift` maintenu | Précision 1/10e | Rotation lente | Scale lent |
| `Ctrl` maintenu | Snap à 1 BU | Snap à 5° | Snap à 0.1 |
| `Ctrl+Shift` | Snap à 0.1 BU | Snap à 1° | Snap à 0.01 |

**R spécial :** `R R` (double tap) → mode Trackball (rotation libre, pas contraint à un axe).

**S spécial :** Si la souris traverse le pivot, le scale devient négatif → **miroir/flip**.

**Caméra :** Navigation viewport désactivée pendant les modaux. Depuis Blender 4.0+ : Alt+MMB pour orbiter quand même.

### Contraintes d'axe (applicables à G, R, S)

**Multi-tap :**

| Pression | Effet |
|----------|-------|
| `X` (1er) | Axe X **global** |
| `X X` (2ème) | Axe X **local** |
| `X X X` (3ème) | Supprime la contrainte → libre |

**Si on tape X puis Y : Y remplace X** (pas de cumul).

**Contrainte plan :**

| Raccourci | Plan autorisé | Axe exclu |
|-----------|---------------|-----------|
| `Shift+Z` | Plan XY | Z exclu |
| `Shift+X` | Plan YZ | X exclu |
| `Shift+Y` | Plan XZ | Y exclu |

**Saisie numérique :**
- Séquence : Opération → Axe → Nombre → Confirm (ex: `G X 2.5 Enter`)
- `.` pour le décimal, `-` pour inverser le signe
- `Tab` pour passer à l'axe suivant (saisie multi-axes)
- `/` pour l'inverse (reciprocal) : `2 /` = 0.5

**Feedback visuel :**
- Ligne infinie colorée le long de l'axe contraint (Rouge=X, Vert=Y, Bleu=Z)
- Texte dans le viewport : `Move: D: 2.3456 along global X`

**Implémentation technique dans Blender :**
- Projection axe : `projected = dot(mouse_delta, axis_screen_direction) * axis_3d_direction`
- Projection plan : intersection rayon-plan (rayon caméra→souris ∩ plan des 2 axes)
- Correction quand l'axe est quasi-parallèle à la vue (évite les instabilités)

### Comportement cible — Ce qu'il faut implémenter

**Priorité 1 (minimum viable) :**
- G modal (translation via projection sur plan perpendiculaire à la caméra)
- R modal (rotation via angle 2D en screen space)
- X/Y/Z simple (1er appui = axe global) pour G, R, S
- Confirmation / annulation standard
- Feedback visuel : ligne colorée + texte

**Priorité 2 (améliorations) :**
- Shift+X/Y/Z (contrainte plan) pour G et S
- Saisie numérique (buffer clavier + parser)
- Modificateurs Shift (précision) et Ctrl (snap)

**Priorité 3 (peut différer) :**
- Multi-tap (XX = local, XXX = libre) — pas essentiel sans orientations locales complexes
- R R trackball
- MMB sélection interactive d'axe

### Architecture suggérée

Factoriser le pattern modal dans un système partagé :

```typescript
ModalTransformState {
  mode: 'grab' | 'rotate' | 'scale'
  initialValues: Map<id, { position, rotation, scale }>
  pivotScreen: Vector2
  mouseStart: Vector2
  constraint: null | 'x' | 'y' | 'z' | 'shift-x' | 'shift-y' | 'shift-z'
  numericBuffer: string
}
```

### Tâches

- [ ] Factoriser le pattern modal (shared entre G, R, S) dans le keyboardHandler / SelectionSystem
- [ ] Implémenter G modal (projection sur plan perpendiculaire à la caméra)
- [ ] Implémenter R modal (angle entre vecteurs 2D en screen space)
- [ ] Ajouter contrainte d'axe X/Y/Z à G, R, S
- [ ] Ajouter Shift+axe (contrainte plan) pour G et S
- [ ] Ajouter saisie numérique pour G/R/S
- [ ] Ligne-guide colorée selon l'axe contraint (rouge=X, vert=Y, bleu=Z)
- [ ] Texte overlay avec valeurs en temps réel
- [ ] Geler la caméra pendant les modes modaux

### Complexité : Élevée | Impact : Élevé

---

## ~~5. Chaînage de transformations après Shift+D~~ — ABANDONNÉ

> Recherche complète : [07_Transform_Chaining.md](./12_Blender_Research/07_Transform_Chaining.md)

### Résultat de la recherche : Blender NE FAIT PAS ça

Le code source de Blender contient les événements modaux pour le changement de type (G→R→S) mais les **bindings clavier sont commentés/désactivés**. Pendant un Grab modal, la touche R est simplement **ignorée**.

Le chaînage n'existe pas non plus dans Maya ou 3ds Max. Aucun DCC majeur ne propose cette feature.

**Décision : retirer du backlog.** Le workflow standard (confirmer G → lancer R séparément) est suffisant et plus intuitif.

---

## 6. Library — Configurateur Neon ✅ FAIT

### Statut : IMPLÉMENTÉ

- Slider 1→50 bandes dans la Library tab
- 7 thèmes couleur (Sunset, Golden Hour, Synthwave, Inferno, Forest, Midnight, Rainbow)
- Preview bande colorée en temps réel
- Interpolation HSL via `generateBandColors()` dans `utils/neonThemes.ts`
- configBridge accepte les bands override dans l'event `overmind:create-instance`

---

## 7. Library — Améliorations futures

> Recherche complète : [06_Library_Asset_Browser.md](./12_Blender_Research/06_Library_Asset_Browser.md)

### Résultat de la recherche : pattern Blender = "Create-then-Configure"

Blender **ne propose PAS de configurateur avant la création** (sauf le choix du type). Le workflow est :
1. Créer avec des valeurs par défaut
2. Ajuster après via le panneau "Adjust Last Operation" (F9) — éphémère, disparaît à la prochaine action

**Implication pour nous :** Le configurateur Neon est une exception justifiée (50 bandes nécessitent un choix pré-création). Pour Text et Light, le DevPanel existant suffit.

### Idées restantes

| Idée | Pattern Blender | Priorité |
|------|----------------|----------|
| Configurateur Text (font, taille, couleur) | Blender = créer puis configurer | Basse (le DevPanel suffit) |
| Configurateur Light (type, couleur, intensité) | Blender = choix du type dans le menu | Basse |
| Templates/Presets (configs nommées réutilisables) | JSON sérialisé | Moyenne |
| Drag & Drop Library → viewport | Raycaster + ghost preview | Basse |

---

## Ordre d'implémentation (dépendances)

Les features ne sont pas toutes indépendantes. Voici l'ordre logique basé sur les dépendances :

```
Étape 1 : G modal (§4)
   └── La brique de base — translation modale (appui G, souris, confirm/cancel)
       Nécessaire pour : Shift+D, contraintes d'axe, saisie numérique

Étape 2 : Shift+D = duplicate + G modal (§1)
   └── Chaîne automatiquement : dupliquer → entrer en G modal
       Dépend de : G modal (étape 1)

Étape 3 : Contraintes d'axe X/Y/Z (§4)
   └── S'applique à G, R, S et au grab post-Shift+D
       Dépend de : G modal (étape 1)

Étape 4 : R modal (§4)
   └── Rotation modale (même pattern que G)
       Dépend de : pattern modal factorisé (étape 1)

Étape 5 : Copie multi-objets (§2)
   └── Shift+D itère sur tous les selectedIds
       Dépend de : Shift+D basique (étape 2)

Étape 6 : Miroir Ctrl+M (§3)
   └── Scale -1 sur un axe — le plus simple, pas de dépendance forte
       Indépendant (mais bénéficie des contraintes d'axe)
```

---

## Priorité mise à jour

| Étape | Amélioration | Complexité | Impact | Statut |
|-------|-------------|-----------|--------|--------|
| 1 | G modal (brique de base) | Moyenne | Élevé | À faire |
| 2 | Shift+D = duplicate + G modal | Moyenne | Élevé | À faire |
| 3 | Contraintes d'axe X/Y/Z | Moyenne | Élevé | À faire |
| 4 | R modal | Moyenne | Moyen | À faire |
| 5 | Copie multi-objets | Moyenne | Élevé | À faire |
| 6 | Miroir (Ctrl+M = scale -1) | Faible | Moyen | À faire |
| — | ~~Chaînage transformations~~ | — | — | Abandonné |
| — | Configurateur Neon | — | — | ✅ Fait |
| — | Library améliorations futures | Variable | Moyen | À faire |

> Voir aussi [14_New_Features.md](./14_New_Features.md) pour les nouvelles features (Select All, Box Select, Outliner toggles, Timeline améliorations, Courbe Bézier + Eye).
