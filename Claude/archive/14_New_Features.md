# Nouvelles fonctionnalités — Idées et améliorations

Discussion du 27 février 2026. Ce document regroupe les idées issues de l'analyse comparative avec Blender et les besoins identifiés lors des tests manuels.

---

## 1. A / Alt+A — Select All / Deselect All

### Problème actuel

On a Ctrl+Clic pour ajouter/retirer un objet de la sélection, mais pas de raccourci pour tout sélectionner d'un coup ou tout désélectionner.

### Comportement Blender

- **A** → sélectionne tous les objets de la scène
- **Alt+A** → désélectionne tout
- Option "Select All Toggles" : A bascule entre tout sélectionner / tout désélectionner

### Comportement cible

- **A** → sélectionne toutes les instances visibles (neon, text, light, card + model + lights originaux)
- **Alt+A** → désélectionne tout
- Le selectionActor reçoit tous les IDs enregistrés
- L'OutlinePass s'applique à tous les objets sélectionnés

### Tâches

- [x] Handler keydown A → itérer sur tous les IDs enregistrés dans le selectionActor, tous les sélectionner
- [x] Handler keydown Alt+A → désélectionner tout (on a déjà un mécanisme de deselect)
- [x] Mettre à jour l'OutlinePass pour tous les objets
- [x] S'assurer que les gizmos se comportent correctement avec tout sélectionné (pivot commun)

### Complexité : Faible | Impact : Moyen

---

## 2. B — Box Select (sélection par rectangle)

### Problème actuel

La sélection ne se fait que par clic individuel (+ Ctrl+Clic pour la multi-sélection). Pour sélectionner 10 objets proches, il faut 10 Ctrl+Clics.

### Comportement Blender

- **B** → active le mode Box Select
- L'utilisateur dessine un rectangle en cliquant-glissant
- Tous les objets dont le centre (ou la bounding box) est dans le rectangle sont sélectionnés
- **Shift+B** → ajoute à la sélection existante
- Le rectangle est dessiné visuellement en overlay (bordure pointillée)

### Comportement cible

1. **B** → entre en mode Box Select (curseur change, caméra gelée)
2. **Clic gauche + drag** → dessine un rectangle en overlay sur le canvas
3. **Relâcher** → tous les objets dont la position 3D projetée en screen space est dans le rectangle sont sélectionnés
4. Les objets précédemment sélectionnés sont désélectionnés (sauf si Shift maintenu)
5. **Escape** → annule le mode Box Select

### Implémentation technique

- Projeter la position 3D de chaque objet enregistré en coordonnées écran via `camera.project()`
- Tester si le point 2D est dans le rectangle dessiné
- Dessiner le rectangle en overlay HTML (div avec border pointillée) ou via un canvas 2D superposé

### Tâches

- [x] Handler keydown B → entrer en mode Box Select
- [x] Dessiner un rectangle d'overlay pendant le drag (mousedown → mousemove → mouseup)
- [x] Projeter toutes les positions 3D des objets enregistrés en screen space
- [x] Tester l'inclusion dans le rectangle
- [x] Sélectionner/désélectionner les objets correspondants
- [x] Support Shift pour ajouter à la sélection existante
- [x] Escape pour annuler

### Complexité : Moyenne | Impact : Élevé

---

## 3. Lasso Select (sélection par dessin libre)

### Problème actuel

Même problème que pour Box Select — pas de sélection par zone.

### Comportement Blender

- **Ctrl+RMB** → active le mode Lasso
- L'utilisateur dessine une forme libre en maintenant le clic
- Tous les objets à l'intérieur du contour sont sélectionnés
- Le contour est dessiné visuellement en temps réel

### Comportement cible

1. **Ctrl+RMB (clic droit)** → entre en mode Lasso
2. **Maintenir + déplacer** → dessine un contour libre (polyline) en overlay
3. **Relâcher** → ferme le contour et sélectionne les objets inclus
4. Les objets précédemment sélectionnés sont désélectionnés (sauf si Shift maintenu)

### Implémentation technique

- Collecter les points de la polyline pendant le drag
- Utiliser un algorithme "point-in-polygon" (ray casting) pour tester l'inclusion
- Projeter les positions 3D en screen space comme pour Box Select

### Tâches

- [x] Handler Ctrl+RMB → entrer en mode Lasso (LassoSelectOverlay.ts)
- [x] Collecter les points de la polyline pendant le drag
- [x] Dessiner le contour en overlay (canvas 2D, polyline fermée, pointillé orange)
- [x] Fermer le contour au relâchement
- [x] Algorithme point-in-polygon (ray casting) pour tester l'inclusion des objets projetés
- [x] Support Shift pour ajouter à la sélection existante

### Complexité : Moyenne | Impact : Moyen

---

## 4. Outliner — Toggles de visibilité et sélectabilité

### Problème actuel

L'Outliner tab liste les objets et permet de les sélectionner, mais il n'y a pas d'icônes pour :
- Masquer/afficher un objet individuellement (on doit sélectionner + H)
- Verrouiller la sélection d'un objet (empêcher les clics accidentels)
- Désactiver un objet (le retirer temporairement de la scène sans le supprimer)

### Comportement Blender

Chaque ligne de l'Outliner a des **restriction toggles** :

| Icône | Fonction | Effet |
|-------|----------|-------|
| 👁 Œil | Hide in Viewport | Masque l'objet dans le viewport (pas supprimé) |
| 🖱 Curseur | Disable Selection | L'objet est visible mais non cliquable/sélectionnable |
| 📷 Caméra | Disable in Renders | L'objet n'apparaît pas au rendu final |

### Comportement cible

Ajouter 2 icônes cliquables par ligne dans l'Outliner tab :

1. **Œil (👁)** → toggle visibilité de l'objet
   - Clic → masque/affiche l'objet (équivalent de H/Alt+H mais depuis l'Outliner)
   - L'objet masqué reste dans la scène mais invisible
   - Icône grisée quand masqué

2. **Verrou (🔒)** → toggle sélectabilité
   - Clic → verrouille/déverrouille l'objet
   - Un objet verrouillé est visible mais ne peut pas être sélectionné par clic dans le viewport
   - Utile pour éviter de sélectionner accidentellement le modèle principal ou les lights pendant qu'on positionne des neons
   - Icône colorée quand verrouillé

### Tâches

- [x] Ajouter un état `locked: Record<string, boolean>` dans le selectionActor (IDs non sélectionnables)
- [x] Ajouter un état `hidden: Record<string, boolean>` (IDs masqués) — déjà géré par visibility
- [x] Modifier le raycaster dans SelectionSystem pour ignorer les objets locked
- [x] Ajouter les icônes œil et verrou dans chaque ligne de l'OutlinerTab
- [x] Handlers de clic pour toggle visibilité et sélectabilité
- [x] Feedback visuel : icônes grisées/colorées selon l'état

### Complexité : Moyenne | Impact : Élevé

---

## 5. T — Menu d'interpolation des keyframes (courbes d'easing)

### Problème actuel

Toutes les interpolations entre keyframes utilisent `smoothstep` de manière globale. Il n'y a aucun contrôle sur la courbe d'easing par segment individuel. On ne peut pas avoir un ease-in lent sur une transition et un ease-out rapide sur la suivante.

### Comportement Blender

- **T** (avec des keyframes sélectionnés dans la timeline/Dope Sheet) → ouvre un menu de choix d'interpolation
- Types disponibles : Constant, Linear, Bézier, Bounce, Elastic, Back, Sine, Quad, Cubic, Quart, Quint, Expo, Circ
- Chaque keyframe stocke son type d'interpolation individuellement
- Le Graph Editor affiche la courbe résultante visuellement

### Comportement cible

#### Phase 1 : Menu d'interpolation par keyframe

1. **Sélectionner un diamant** dans la timeline (clic sur un keyframe d'élément, de caméra, ou visuel)
2. **T** → ouvre un menu/popup avec les types d'easing disponibles
3. L'easing sélectionné s'applique à la **transition SORTANTE** de ce keyframe (vers le keyframe suivant)
4. Le diamant change visuellement pour indiquer le type d'easing (couleur ou icône)

#### Types d'easing à supporter

| Type | Description | Cas d'usage |
|------|-------------|-------------|
| **Linear** | Vitesse constante | Mouvements mécaniques, rotations constantes |
| **Smoothstep** | Ease-in + ease-out doux (actuel par défaut) | Usage général |
| **Ease In** | Départ lent, arrivée rapide | Accélération (objet qui tombe) |
| **Ease Out** | Départ rapide, arrivée lente | Décélération (freinage) |
| **Ease In-Out** | Lent → rapide → lent | Mouvement naturel |
| **Bounce** | Rebond à l'arrivée | Effet ludique |
| **Elastic** | Oscillation élastique | Effet cartoon |
| **Cubic Bezier** | Courbe personnalisable (4 control points) | Contrôle total |
| **Constant/Step** | Pas d'interpolation, saut instantané | Changements brusques |

#### Phase 2 : Visualisation des courbes (optionnel, plus tard)

- Un mini Graph Editor dans la timeline qui montre la courbe d'easing entre deux keyframes sélectionnés
- Handles Bézier draggables pour le type "Cubic Bezier"

### Données

Chaque keyframe stocke déjà un champ `easing: string`. Il suffit d'étendre les valeurs possibles et d'utiliser les fonctions d'easing correspondantes dans l'interpolation.

### Condition d'activation

- **T ne fonctionne que quand la souris est dans la zone de la timeline** (pas dans le viewport 3D)
- Si aucun diamant n'est sélectionné → T ne fait rien

### Tâches

- [x] Définir les fonctions d'easing dans `utils/easing.ts` (14 types : linear, smoothstep, ease-in/out, cubic, back, bounce, elastic, step)
- [x] Sélection de diamants dans la timeline (§7a — prérequis)
- [x] Handler T → ouvre un menu popup d'easing (uniquement si diamant sélectionné)
- [x] Appliquer l'easing choisi aux keyframes sélectionnés (camera, element, eye)
- [x] Systèmes d'interpolation utilisent déjà l'easing par keyframe (via `EASING_MAP[to.easing]`)
- [x] Feedback visuel : point vert sous les diamants avec easing non-standard + tooltip avec nom
- [x] Menu avec mini-courbes SVG pour chaque option d'easing

### Complexité : Élevée | Impact : Élevé

---

## 6. Courbe Bézier + Eye — Follow Path avec timeline

### Concept

C'est la feature la plus ambitieuse. L'idée est de dessiner une **courbe Bézier 3D** dans la scène que l'Eye (le modèle) peut suivre à certains moments de la timeline, puis reprendre son mouvement autonome (steering/Yuka) à d'autres moments.

### Workflow utilisateur envisagé

#### Création de la courbe

1. Entrer en **mode courbe** (nouveau mode, raccourci à définir — peut-être `Shift+C` ou un bouton dans la Library)
2. **Clic** dans le viewport pour placer le premier point
3. **E (Extrude)** → ajoute un nouveau point de contrôle relié au précédent
4. Répéter E pour étendre la courbe point par point
5. Chaque point a des **handles Bézier** (comme dans Blender) qu'on peut ajuster pour créer des courbes fluides
6. **Enter** pour confirmer la courbe, **Escape** pour annuler

#### Édition de la courbe

- **Clic sur un point** → le sélectionne (diamant visible)
- **G** → déplacer le point sélectionné (mode grab standard)
- **E** sur un point d'extrémité → étendre la courbe avec un nouveau point
- **X/Delete** → supprimer un point (la courbe se reconnecte)
- Les handles Bézier sont draggables pour ajuster la courbure

#### Lien avec la timeline

La courbe apparaît comme une **piste dédiée** dans la timeline ("Eye Path" ou "Steering Path") :

1. Chaque **point de la courbe** a un **diamant correspondant** dans la timeline
2. La **distance entre les diamants** contrôle le temps que l'Eye met à parcourir chaque segment :
   - Diamants rapprochés → l'Eye passe vite (mouvement rapide)
   - Diamants éloignés → l'Eye ralentit (mouvement lent, pause)
3. Un **dwell** (pause) sur un point = l'Eye s'arrête à cet endroit pendant X frames
4. L'easing entre les diamants (réglable avec T) contrôle l'accélération/décélération

#### Handoff Courbe ↔ Steering autonome

Le système doit gérer le **passage** entre deux modes de déplacement de l'Eye :

| Phase | Comportement de l'Eye |
|-------|----------------------|
| **Avant la courbe** | Steering autonome (Yuka) — l'Eye se déplace librement |
| **Entrée sur la courbe** | Transition fluide depuis la position actuelle vers le premier point de la courbe |
| **Sur la courbe** | L'Eye suit la courbe Bézier, position déterminée par le mapping timeline |
| **Sortie de la courbe** | Transition fluide du dernier point de la courbe vers le steering autonome |
| **Après la courbe** | Steering autonome reprend |

La **force de transition** (entrée/sortie) devrait être réglable :
- Transition douce → l'Eye glisse progressivement vers/depuis la courbe
- Transition brusque → l'Eye "saute" sur la courbe instantanément

### Données

```typescript
interface BezierPoint {
  position: { x: number; y: number; z: number };
  handleIn: { x: number; y: number; z: number };   // handle d'entrée
  handleOut: { x: number; y: number; z: number };  // handle de sortie
  frame: number;           // position dans la timeline
  dwellFrames: number;     // durée de pause à ce point (0 = pas de pause)
  easing: string;          // type d'easing vers le point suivant
}

interface EyePath {
  id: string;
  points: BezierPoint[];
  transitionIn: number;    // frames de transition entrée (steering → courbe)
  transitionOut: number;   // frames de transition sortie (courbe → steering)
  enabled: boolean;
}
```

### Rendu 3D

- La courbe est affichée comme une **ligne 3D** dans la scène (Three.js `CubicBezierCurve3` ou `CatmullRomCurve3`)
- Les points de contrôle sont des **sphères** petites et cliquables
- Les handles Bézier sont des **lignes** avec des petits cercles aux extrémités
- La courbe peut être masquée/affichée (toggle dans l'Outliner)
- Couleur distinctive (ex: jaune/orange) pour se distinguer des neons

### Tâches (haut niveau)

#### Phase 9A — Data + Timeline + 3D Viz + Gizmo (DONE)
- [x] Data model : EyePathPoint + EyePath types, 6 events CRUD dans timelineMachine
- [x] Defaults + hook useTimeline (eyePath state + actions + export)
- [x] Piste timeline "Eye Path" avec diamants par point (couleur #FFEB3B)
- [x] Drag, snap, copy/paste, easing (T), delete (X), duplicate (Shift+D), grab (G) pour eye-path
- [x] Raccourci P pour ajouter un point au frame courant
- [x] EyePathSystem 3D : sphères de contrôle + courbe CatmullRom
- [x] Sphères sélectionnables + déplaçables via gizmo (G)
- [x] Bridge timeline → 3D (timelineBridge) + gizmo → timeline (gizmoBridge)

#### Phase 9B — Édition 3D avancée (futur)
- [ ] Mode édition courbe (Shift+C ou bouton Library)
- [ ] Click viewport pour placer des points dans l'espace
- [ ] E pour extruder depuis l'extrémité
- [ ] Handles Bézier draggables (passage CatmullRom → CubicBezier)
- [ ] X/Delete points dans le viewport

#### Phase 9C — Path Following + Steering Handoff (futur)
- [ ] Mapping temps ↔ distance : position de l'Eye calculée depuis les frames des diamants
- [ ] Système de handoff steering ↔ courbe avec transition réglable
- [ ] Easing par segment (réutilise le système T de la section §5)
- [ ] Dwells (pauses) sur les points
- [ ] Intégration avec le système Yuka existant (reprendre le steering après la courbe)
- [ ] Undo/redo pour toutes les opérations sur la courbe
- [ ] Scene save/load de la courbe

### Complexité : Très élevée | Impact : Très élevé

---

## 7. Améliorations de la Timeline

### Problèmes actuels

La timeline est fonctionnelle mais présente plusieurs lacunes par rapport à un workflow de production :

#### 7a. Sélection et édition des diamants

**Problème** : On ne peut pas facilement manipuler les keyframes individuellement dans la timeline.

**Améliorations** :
- [x] Clic sur un diamant → le sélectionne (highlight)
- [x] **G** avec un diamant sélectionné → drag pour changer sa frame (déplacer dans le temps)
- [x] Multi-sélection de diamants (Shift+Clic ou Box Select dans la timeline)
- [x] **G** avec multi-sélection → déplacer le groupe de diamants ensemble
- [x] **X/Delete** → supprimer le keyframe sélectionné
- [x] **Shift+D** → dupliquer le keyframe sélectionné

#### 7b. Zoom et pan dans la timeline

**Problème** : La vue de la timeline est fixe. Avec 150+ frames, les détails sont difficiles à voir.

**Améliorations** :
- [x] **Scroll** dans la timeline → zoom horizontal centré sur la souris (Shift+scroll = pan)
- [x] **MMB drag** dans la timeline → pan horizontal (se déplacer dans le temps)
- [x] Double-clic sur label de piste → zoom pour afficher toute la durée de cette piste
- [x] Bouton ⟲ reset zoom + touche Home + inputs viewStart/viewEnd dans toolbar

#### 7c. Pistes — réorganisation et gestion

**Problème** : Les pistes sont dans un ordre fixe et ne peuvent pas être repliées ou groupées.

**Améliorations** :
- [x] Drag & drop pour réordonner les pistes
- [x] Icône de repli (▶/▼) pour masquer/afficher le contenu d'une piste
- [ ] Groupement de pistes par type (ex: toutes les pistes neon ensemble)
- [ ] Hauteur de piste ajustable (drag du bord inférieur)

#### 7d. Snapping dans la timeline

**Problème** : Quand on déplace un diamant, il n'y a pas de snap aux frames ou aux autres diamants.

**Améliorations** :
- [x] Snap aux frames entières par défaut (pas de keyframe entre deux frames)
- [x] Ctrl maintenu → snap aux positions d'autres diamants (alignement vertical)
- [x] Ligne guide verticale affichée pendant le drag pour montrer l'alignement

#### 7e. Copier/coller de keyframes

- [x] **Ctrl+C** avec diamant(s) sélectionné(s) → copie les keyframes
- [x] **Ctrl+V** → colle les keyframes à la position du curseur de la timeline
- [x] Utile pour reproduire une animation sur un autre segment

### Complexité globale : Élevée | Impact : Élevé

---

## Priorité suggérée

| # | Feature | Complexité | Impact | Dépendances |
|---|---------|-----------|--------|-------------|
| 1 | A / Alt+A Select All | Faible | Moyen | Aucune |
| 2 | Outliner toggles (œil + verrou) | Moyenne | Élevé | Aucune |
| 3 | B — Box Select | Moyenne | Élevé | Aucune |
| 4 | Timeline — sélection/édition diamants (§7a) | Moyenne | Élevé | Aucune |
| 5 | T — Menu d'interpolation easing | Élevée | Élevé | §7a (sélection de diamants requise) |
| 6 | Timeline — zoom/pan (§7b) | Moyenne | Élevé | Aucune |
| 7 | Lasso Select | Moyenne | Moyen | Similaire à §3 |
| 8 | Timeline — pistes, snapping, copier/coller (§7c/d/e) | Élevée | Moyen | §7a, §7b |
| 9 | Courbe Bézier + Eye Follow Path | Très élevée | Très élevé | §5 (easing), §7a (diamants timeline) |

> La courbe Bézier + Eye est la feature "killer" mais dépend d'une timeline mature (§7a + §5 minimum). L'ordre suggéré commence par les quick wins (A, Outliner, Box Select) puis renforce la timeline avant d'attaquer la courbe.
