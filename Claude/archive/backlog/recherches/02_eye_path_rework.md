# 02 — Eye Path — Refonte complète

## Problèmes actuels

### 1. Workflow trop complexe
- Shift+C pour entrer en mode courbe, P pour ajouter un point, E pour extruder... c'est trop de raccourcis séparés
- L'utilisateur devrait pouvoir créer une courbe et l'éditer directement sans toggle de mode

### 2. Suivi trop rigide
- L'Eye suit la courbe à 100% (blend = 1.0) — trop "robot sur rail"
- On veut un suivi **approximatif** (~70-80%) qui garde un peu de mouvement naturel Yuka
- La transition d'entrée/sortie doit être plus douce

### 3. Eye Waypoints vs Eye Path — confusion
- Deux systèmes séparés (Eye WP = direction de regard, Eye Path = chemin physique)
- L'utilisateur ne comprend pas la différence
- Potentiellement redondant — Eye Path pourrait remplacer Eye WP

### 4. Pas de courbe Bézier
- CatmullRom = courbe auto-calculée, on ne contrôle pas la courbure
- On veut des handles Bézier draggables comme dans Blender

### 5. Courbe limitée à l'Eye
- Actuellement seul l'Eye peut suivre une courbe
- On devrait pouvoir assigner une courbe à N'IMPORTE QUEL objet (text, card, neon, eye, etc.)

---

## Recherches effectuées

### [x] Courbes Bézier dans Blender

#### Création (Shift+A → Curve → Bezier)
- Crée 2 points de contrôle par défaut, reliés par un segment courbe
- Chaque point a 2 handles (lignes + petits cercles aux extrémités)
- Handles de type **Auto** par défaut (jaune/doré)
- La courbe est créée au curseur 3D

#### Edit Mode (Tab)
- **Tab** = toggle Object Mode ↔ Edit Mode
- En Edit Mode, on manipule les points individuels et les handles
- **Sélection** : Clic = sélectionner point OU handle individuellement
- **E (Extrude)** : depuis un point d'extrémité uniquement, crée un nouveau point connecté
- **Ctrl+Clic droit** : ajoute un point à l'endroit du clic (raccourci rapide)
- **Clic droit > Subdivide** : insère un point au milieu d'un segment sélectionné
- **X/Delete** : menu avec Vertices / Segment / Dissolve Vertices
- **F** : connecte 2 extrémités (fermer une courbe ou joindre 2 splines)
- **Alt+C** : toggle cyclique (fermer/ouvrir la courbe)

#### 4 Types de handles

| Type | Couleur | Direction liée ? | Longueur liée ? | Auto-calculé ? | Si touché manuellement → |
|------|---------|------------------|-----------------|----------------|--------------------------|
| **Auto** | Jaune | Oui (colinéaires) | Oui | Oui | Devient **Aligned** |
| **Aligned** | Rose | Oui (colinéaires) | Non (indépendantes) | Non | Reste Aligned |
| **Free** | Noir | Non | Non | Non | Reste Free |
| **Vector** | Vert | N/A | N/A | Oui (→ voisin) | Devient **Free** |

- **V** = menu pour changer le type de handle
- **Auto** : Blender calcule position et longueur automatiquement. Dès qu'on touche un handle → il passe en Aligned. UX très intuitive.
- **Aligned** : les 2 handles restent colinéaires (même direction) mais longueurs indépendantes. Le type le plus courant pour un contrôle précis avec transitions lisses.
- **Free** : handles totalement indépendants. Permet des angles vifs (cassures).
- **Vector** : handle pointe vers le point voisin → segments droits. Si touché → devient Free.

#### Raccourcis Edit Mode courbe

| Touche | Action |
|--------|--------|
| Tab | Toggle Edit/Object Mode |
| G | Grab (déplacer point ou handle) |
| R | Rotation |
| S | Scale |
| E | Extrude (depuis extrémité) |
| X / Delete | Supprimer (menu) |
| Ctrl+X | Dissolve vertices |
| V | Menu type de handle (Auto/Aligned/Free/Vector) |
| F | Connecter 2 extrémités |
| Alt+C | Toggle cyclique |
| Shift+D | Dupliquer points |
| A | Select All |
| L | Select Linked |
| N | Toggle panneau propriétés (coordonnées exactes) |

---

### [x] Follow Path dans Blender

#### Assignation
- Via **Properties > Object Constraint > Follow Path**, champ Target = la courbe
- Ou via **Ctrl+P > Follow Path** (crée un parent + constraint)
- La courbe cible doit être de type Curve (Bezier, NURBS, Path)

#### Paramètres clés

| Paramètre | Rôle |
|-----------|------|
| **Offset** | Décale la position le long de la courbe (en frames ou 0-1) |
| **Forward Axis** | Quel axe de l'objet pointe "en avant" (défaut: Y) |
| **Up Axis** | Quel axe pointe vers le haut (défaut: Z) |
| **Follow Curve** | ON = l'objet s'oriente avec la tangente, OFF = garde son orientation |
| **Fixed Position** | ON = position contrôlée par Offset local (0-1), OFF = par Evaluation Time de la courbe |
| **Influence** | 0.0 à 1.0 — poids de la constraint. **C'est le mécanisme de transition !** |

#### Timing
- Contrôlé par **Evaluation Time** de la courbe (Path Animation)
- Par défaut : 2 keyframes auto-générés (frame 1 → 0%, frame 100 → 100%)
- Interpolation linéaire par défaut → vitesse constante en paramètre (PAS en distance spatiale)
- On ajuste la vitesse via le **Graph Editor** sur la F-Curve de l'Evaluation Time
- Paliers = pauses, courbe descendante = marche arrière

#### Plusieurs objets sur une même courbe
- **Méthode recommandée** : Fixed Position ON + Offset keyframé indépendamment par objet
- Chaque objet a sa propre vitesse, ses propres pauses, son propre timing
- L'Evaluation Time de la courbe est ignoré

#### Transition entrée/sortie
- **Blender ne le fait PAS automatiquement**
- Il faut **animer l'Influence** de la constraint :
  - Frame 50 : Influence = 0 (l'objet est libre)
  - Frame 60 : Influence = 1 (l'objet suit la courbe)
  - Frame 150 : Influence = 1
  - Frame 160 : Influence = 0 (l'objet redevient libre)
- **Problème du "saut"** : si position libre ≠ position courbe → transition visible. Solution : transition longue (20-30 frames) ou aligner manuellement la position avant la transition

---

### [x] Math Bézier + Three.js

#### Formule Bézier cubique
```
B(t) = (1-t)³·P0 + 3(1-t)²·t·P1 + 3(1-t)·t²·P2 + t³·P3
```

- **P0** = point de départ, **P3** = point d'arrivée
- **P1** = handle out de P0 (tangente de sortie)
- **P2** = handle in de P3 (tangente d'entrée)
- Tangente en P0 : `B'(0) = 3·(P1 - P0)` → longueur du handle = force de la tangente
- Tangente en P3 : `B'(1) = 3·(P3 - P2)`

#### Conversion CatmullRom → Bézier : **EXACTE !**

La conversion est une **transformation de base polynomiale**, sans perte. La formule :

```
Pour un segment entre points[i] et points[i+1] :

  T_i     = 0.5 × (points[i+1] - points[i-1])     ← tangente au point i
  T_{i+1} = 0.5 × (points[i+2] - points[i])       ← tangente au point i+1

  B0 = points[i]                    ← point de départ
  B1 = points[i] + T_i / 3         ← handle out (= handleOut du point i)
  B2 = points[i+1] - T_{i+1} / 3   ← handle in (= handleIn du point i+1)
  B3 = points[i+1]                  ← point d'arrivée
```

**Pourquoi `/3` ?** Parce que `B'(0) = 3·(B1 - B0)`, donc pour que la tangente soit T_i, il faut `B1 = B0 + T_i/3`.

Pour la variante **centripetale** (notre code actuel, alpha=0.5) : les tangentes sont calculées différemment (distances pondérées), mais la conversion reste la même une fois les tangentes obtenues.

**Continuité C1 automatiquement préservée** : les handles in/out de chaque nœud sont colinéaires après conversion.

#### Three.js API

- **`CubicBezierCurve3(v0, v1, v2, v3)`** — un segment Bézier
- **`CurvePath`** — enchaîne plusieurs segments via `.add(segment)`
- **`getPoint(t)`** — position à t (paramétrique, non-uniforme)
- **`getPointAt(u)`** — position à u avec **arc-length** (vitesse uniforme) → utilise lookup table 200 points + recherche binaire
- **`getSpacedPoints(n)`** — n points équidistants
- **`getTangentAt(u)`** — tangent unitaire avec arc-length
- **`CurvePath.getPoint(t)`** — utilise déjà l'arc-length par sous-segment, donc t uniforme ≈ vitesse uniforme

#### Continuité entre segments

Pour 2 segments consécutifs partageant un nœud :
- **C0** (position) : `v3_segment_N = v0_segment_N+1` (le même point)
- **C1** (tangente) : le handle_in et handle_out du nœud sont **colinéaires** (aligned)
- Si les handles sont de type Free → pas de continuité C1 → angle vif possible (voulu pour des cassures)

---

## État actuel du code

### Ce qui existe déjà
- `EyePathPoint` : `{ position, frame, dwellFrames, easing }` — pas de handles
- `EyePathSystem` : sphères jaunes + courbe CatmullRom 3D (`'catmullrom'`, tension 0.5)
- `compute.ts` : CatmullRom centripetal (Barry-Goldman), arc-length 64 samples, dwells, blend
- `animationLoop.ts` : blend position Yuka ↔ courbe, weight save/restore
- Phase 9B : mode édition courbe (Shift+C), click to place, E extrude, Delete

### Ce qui doit changer
1. **Data model** : ajouter `handleIn`, `handleOut` à `EyePathPoint`
2. **Math** : remplacer la math CatmullRom pure dans compute.ts par CubicBezier (~120 lignes)
3. **Rendu 3D** : `CurvePath` + `CubicBezierCurve3` au lieu de `CatmullRomCurve3`, afficher handles
4. **Interaction** : handles draggables via gizmo, type de handle (V menu)
5. **Workflow** : Tab = Edit Mode au lieu de Shift+C
6. **Assignation** : Follow Path générique (tout objet peut suivre une courbe)
7. **Blend** : paramètre max réglable (~0.8 pour l'Eye, 1.0 pour les autres objets)
8. **Eye WP** : évaluer suppression ou fusion avec Eye Path

---

## Comportement souhaité — à la Blender

### Création de courbe
1. **Shift+A** (ou bouton) → menu → Curve → Bezier
2. 2 points apparaissent avec handles Auto (jaunes)
3. La courbe est un objet sélectionnable comme les autres

### Édition (Tab = Edit Mode)
1. Sélectionner la courbe → **Tab** → Edit Mode
2. Clic sur un point → le sélectionner (couleur change)
3. **E** depuis extrémité → nouveau point + grab immédiat
4. **Ctrl+Clic** → ajouter point à l'endroit du clic
5. **Clic droit > Subdivide** → insérer un point au milieu d'un segment
6. **G/R/S** = grab/rotate/scale les points et handles
7. **V** = changer le type de handle (Auto/Aligned/Free/Vector)
8. **X/Delete** = supprimer
9. **Tab** = revenir en Object Mode

### Follow Path
1. Sélectionner un objet + la courbe (Ctrl+Clic)
2. Action "Follow Path" (menu ou raccourci)
3. L'objet est lié à la courbe avec un paramètre position 0-1
4. Timeline : piste dédiée par objet-sur-courbe
5. Influence keyframable (0 = libre, 1 = sur courbe, entre = blend)

### Suivi semi-autonome (Eye)
- L'Eye suit la courbe à ~70-80% (Influence max = 0.8)
- Yuka reste actif avec poids réduit → mouvement naturel
- Scroll = progression le long de la courbe
- Scroll inverse = retour en arrière (avec transition pour éviter demi-tour brusque)

---

## Approche progressive

### Étape 1 — Handles Bézier (data + conversion + rendu)
- Ajouter `handleIn: {x,y,z}`, `handleOut: {x,y,z}` à `EyePathPoint`
- Auto-calculer les handles depuis CatmullRom (formule : `handleOut = P + T/3`, `handleIn = P - T/3`)
- Afficher en 3D : sphères pour handles (plus petites que les points) + lignes point↔handle
- Les handles sont sélectionnables et draggables
- La courbe est rendue avec `CurvePath` + `CubicBezierCurve3` au lieu de `CatmullRomCurve3`
- **La courbe garde exactement la même forme** (conversion exacte)

### Étape 2 — Math CubicBezier dans compute.ts
- Remplacer `catmullRomPoint()` par évaluation Bézier cubique directe
- Remplacer `buildSegmentArcTable()` par arc-length sur segments Bézier
- Garder le système de dwells, blend, smoothstep
- Alternative : utiliser Three.js `CurvePath.getPointAt(u)` qui fait l'arc-length nativement

### Étape 3 — Types de handles + menu V
- Implémenter **Auto, Aligned, Free** (les 3 dès le début, Vector optionnel/futur)
- Auto → Aligned automatiquement quand on touche un handle
- Menu V pour changer le type
- Couleurs distinctes par type (jaune=Auto, rose=Aligned, noir=Free)

### Étape 4 — Workflow simplifié (modes)
- Tab = toggle Edit Mode (remplace Shift+C)
- Shift+A = créer une nouvelle courbe
- Intégrer avec le système de modes (#7)

### Étape 5 — Follow Path générique
- Tout objet peut suivre une courbe
- Constraint "Follow Path" par objet
- Position (0-1) + Influence (0-1) keyframables dans la timeline
- Piste timeline dédiée par assignation

### Étape 6 — Blend semi-autonome (Eye)
- Paramètre Influence max réglable (0.8 par défaut pour Eye)
- Meilleure gestion du scroll inverse
- **Supprimer Eye WP** — l'Eye regarde dans la direction de la tangente (automatique)
- Nettoyer le code Eye WP (events, machine, bridge, rendu)

---

## Décisions prises

1. **E + Subdivide** — Les deux. E = prolonger depuis une extrémité. Subdivide (clic droit) = insérer un point au milieu d'un segment existant.
2. **Handles en absolu** — Comme Blender. Quand on déplace le point principal, les handles suivent (on code le déplacement conjoint).
3. **3 types de handles dès le début** — Auto + Aligned + Free. Aligned est le plus utilisé dans Blender, il est indispensable. Vector = optionnel/futur.
4. **Eye WP → supprimé** — L'Eye regarde automatiquement dans la direction où il avance (tangente de la courbe). Pas besoin de waypoints séparés. Suppression quand Eye Path Bézier sera complet.
5. **Courbe fermée (cyclique)** — Non. Pas de besoin identifié. Optionnel/futur si nécessaire un jour.

---

## Complexité : Très élevée — 6 étapes progressives, chacune testable indépendamment
