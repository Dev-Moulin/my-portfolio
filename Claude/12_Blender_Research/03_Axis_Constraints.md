# Recherche : Contraintes d'axe X/Y/Z pendant G/R/S (Blender)

## Sources

- [Axis Locking - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/axis_locking.html)
- [Numeric Input - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/numeric_input.html)
- [Transform Orientations - Blender 2.80 Manual](https://docs.blender.org/manual/en/2.80/scene_layout/object/editing/transform/control/orientations.html)
- [Blender Source - transform_constraints.cc](https://github.com/blender/blender/blob/main/source/blender/editors/transform/transform_constraints.cc)

---

## 1. Principe fondamental

Pendant G, R ou S, appuyer X/Y/Z **filtre** le vecteur de déplacement pour ne garder que la composante le long de l'axe/plan choisi. C'est une matrice de projection appliquée au mouvement.

### Différence axe vs plan

| Type | Touches | Effet | Opérations |
|------|---------|-------|------------|
| **Axe unique** | X, Y, Z | Mouvement sur 1 seul axe | G, R, S |
| **Plan** | Shift+X, Shift+Y, Shift+Z | Mouvement libre sauf 1 axe | G et S uniquement (pas R) |

Pour la rotation, axe et plan ont le même effet (rotation toujours autour d'un axe).

### Priorité

Si on tape X puis Y : **Y remplace X**. Pas de cumul — la dernière touche prend le dessus.

---

## 2. Mécanisme multi-tap (X, XX, XXX)

Cycle à 3 états par pression répétée :

| Pression | Effet |
|----------|-------|
| **1er appui** (X) | Axe X **Global** |
| **2ème appui** (X X) | Axe X de **l'orientation active** (Local, Normal, View, Custom). Si orientation = Global → bascule vers Local |
| **3ème appui** (X X X) | **Supprime la contrainte** → retour mode libre |

### Les 5 espaces de référence

| Orientation | Définition |
|------------|------------|
| **Global** | Axes du monde (fixes) |
| **Local** | Axes de l'objet (suivent sa rotation) |
| **Normal** | Z = normale de la sélection (en Object Mode = Local) |
| **View** | Y = haut écran, X = gauche/droite, Z = vers/depuis caméra |
| **Custom** | Orientation personnalisée |

---

## 3. Plan (Shift+X/Y/Z)

| Raccourci | Plan autorisé | Axe exclu |
|-----------|---------------|-----------|
| Shift+Z | Plan XY | Z exclu |
| Shift+X | Plan YZ | X exclu |
| Shift+Y | Plan XZ | Y exclu |

Multi-tap identique :
- Shift+Z → plan XY global
- Shift+Z Shift+Z → plan XY local
- Shift+Z Shift+Z Shift+Z → libre

Combinable avec saisie numérique : `G Shift+Z 1 Tab 2 Enter` = déplace de (1, 2, 0).

---

## 4. Feedback visuel

### Ligne de contrainte

- **Ligne infinie** passant par le pivot de la sélection, le long de l'axe contraint
- Traverse tout le viewport

### Couleurs

| Axe | Couleur |
|-----|---------|
| X | **Rouge** |
| Y | **Vert** |
| Z | **Bleu** |

L'axe actif = couleur vive. Axes inactifs = estompés.

### Texte header

Affiché dans le coin supérieur gauche du viewport :
- Type d'opération + valeur + axe + espace
- Ex : `Move: D: 2.3456 (0.0000) along global X`

---

## 5. Saisie numérique

### Séquence standard

**Opération → Axe → Nombre → Confirm**

Ex : `G → X → 2.5 → Enter` = déplace de 2.5 sur X

### Cas particuliers

| Question | Réponse |
|----------|---------|
| Nombres négatifs ? | Oui, touche `-` inverse le signe |
| Nombre AVANT l'axe ? | Non, ne fonctionne pas. L'axe doit être spécifié en premier |
| Nombre sans axe ? | G : appliqué en X par défaut. R : angle en degrés. S : uniforme sur 3 axes |
| Point décimal ? | `.` (point) uniquement. Pas de virgule |
| Slash `/` ? | Inverse la valeur (reciprocal) : `2 /` = 0.5 |

### Multi-axes avec Tab

- `Tab` → passe à l'axe suivant (X → Y → Z)
- `Ctrl+Tab` → axe précédent
- Ex : `G → 1 → Tab → 2 → Tab → 3 → Enter` = déplace de (1, 2, 3)

### Touches spéciales

| Touche | Effet |
|--------|-------|
| `Backspace` | Efface dernier caractère. 2ème appui = reset. 3ème = annule saisie |
| `=` | Active mode avancé (expressions Python, unités) |

---

## 6. Middle Mouse Button (MMB)

### Sélection interactive d'axe

1. Démarrer G/R/S
2. **Maintenir MMB**
3. Déplacer la souris → les 3 axes apparaissent, pointillé blanc comme guide
4. L'axe le plus proche du mouvement est mis en surbrillance
5. **Relâcher MMB** → confirme l'axe

Fonctionne pour **G, R et S**.

### Algorithme interne (`setNearestAxis3d`)

1. Projette les extrémités de chaque axe 3D en screen space
2. Mesure la distance perpendiculaire entre le mouvement souris et chaque axe projeté
3. L'axe avec la distance minimale est sélectionné

### Shift+MMB pour plan ?

**Non supporté nativement.** Pour les plans → Shift+X/Y/Z uniquement.

### Snap (Ctrl) + contrainte

Indépendants et cumulatifs :
- Contrainte d'abord → valeur projetée sur l'axe
- Snap ensuite → valeur arrondie à l'incrément

---

## 7. Implémentation technique

### Projection souris → axe 3D (`axisProjection`)

1. L'axe 3D est projeté en **screen space**
2. Le mouvement souris est projeté sur cette direction écran
3. Le résultat est la composante du mouvement le long de l'axe

```
// Pseudo-code
projected = dot(mouse_delta, axis_screen_direction) * axis_3d_direction
```

### Projection sur plan (`planeProjection`)

1. Calcule la **normale du plan** = cross product des 2 axes actifs
2. **Intersection rayon-plan** : un rayon depuis la caméra passant par la position souris intersecte le plan
3. Le point d'intersection = nouvelle position

### Matrice de projection de contrainte

```
r_pmtx = spacemtx * filtered_identity * spacemtx_inv
```

- `filtered_identity` = matrice identité avec les lignes des axes exclus mises à zéro

### Correction vue parallèle

Quand l'axe de contrainte est quasi-parallèle à la direction de vue (dot ≈ 0) → plan de projection alternatif pour éviter les instabilités numériques.

### Pas de dead zone documentée

Pas de seuil minimum de mouvement pour les contraintes. La correction vue-parallèle protège contre les mouvements parasites.

---

## 8. Résumé des raccourcis

| Raccourci (pendant G/R/S) | Effet |
|---------------------------|-------|
| `X` | Axe X global |
| `X X` | Axe X local |
| `X X X` | Libre |
| `Shift+X` | Plan YZ (exclut X) |
| `Shift+X Shift+X` | Plan YZ local |
| `Y` après X | Y remplace X |
| `MMB maintenu` | Sélection interactive |
| `Ctrl` maintenu | Snap (cumulable) |
| `0-9 . -` | Saisie numérique |
| `Tab` | Axe suivant |
| `/` | Reciprocal |

---

## 9. Implications pour notre implémentation Three.js

### Ce qu'il faut implémenter en priorité

1. **X/Y/Z simple** (1er appui → axe global) — le plus utile
2. **Shift+X/Y/Z** (plan) — utile pour G et S
3. **Saisie numérique** : buffer clavier + parser
4. **Feedback visuel** : ligne colorée + texte overlay

### Ce qu'on peut différer

- Multi-tap (XX = local, XXX = libre) — nos objets n'ont pas d'orientation locale complexe
- MMB sélection interactive — le clavier suffit
- Mode avancé / expressions Python
- Snap (Ctrl)
