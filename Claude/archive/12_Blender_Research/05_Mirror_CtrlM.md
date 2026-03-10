# Recherche : Miroir (Ctrl+M) dans Blender

## Sources

- [Mirror - Blender Manual (Object Mode)](https://docs.blender.org/manual/en/2.81/scene_layout/object/editing/transform/mirror.html)
- [Mirror - Blender Manual (Edit Mode)](https://docs.blender.org/manual/en/5.2/modeling/meshes/editing/mesh/mirror.html)
- [Transform Operators - Blender Python API](https://docs.blender.org/api/current/bpy.ops.transform.html)

---

## 1. Flux exact de Ctrl+M

### Activation

`Ctrl+M` → entre en **mode modal** (`TFM_MIRROR`). L'objet n'est pas encore transformé — Blender attend le choix d'un axe.

### Choix de l'axe (3 méthodes)

1. **Clavier** : `X`, `Y` ou `Z` → axe global
2. **Double tap** : `X X` → axe local (selon la Transform Orientation active)
3. **MMB** : maintenir + déplacer → axe le plus proche du mouvement

### Confirmation / Annulation

- **Confirmer** : `Enter` ou `LMB`
- **Annuler** : `Escape` ou `RMB`

### Preview temps réel

Dès le choix de l'axe, l'objet est mirroré **visuellement en preview**. On peut annuler si le résultat ne convient pas.

---

## 2. Calcul du miroir

### Ctrl+M = Scale de -1

Le miroir est **mathématiquement équivalent** à un scale de -1 sur l'axe choisi.

> *"The Mirror tool is exactly equivalent to scaling by -1 [...] only it is faster/handier."* — Documentation Blender

### Point de référence = Pivot Point actif

| Pivot Point | Comportement |
|-------------|-------------|
| **Median Point** (défaut) | Miroir autour du barycentre de la sélection |
| **Individual Origins** | Chaque objet mirroré autour de son propre origin |
| **3D Cursor** | Miroir autour du 3D Cursor |
| **Active Element** | Miroir autour de l'origin de l'objet actif |
| **Bounding Box Center** | Miroir autour du centre de la bounding box |

### Global vs Local

- 1x appui (`X`) → axe **global**
- 2x appui (`X X`) → axe **local** (orientation active)

### Propriétés modifiées (Object Mode)

- **Scale** : l'axe mirroré passe à -1 (ex: Scale X = 1.0 → -1.0)
- **Position** : change si le pivot ≠ origin de l'objet (l'objet "saute" de l'autre côté)
- **Rotation** : PAS modifiée directement

---

## 3. Miroir avec multi-sélection

Le comportement dépend du **pivot point** :

### Median Point (défaut)

- Le barycentre de TOUS les objets sélectionnés est calculé
- Le **groupe entier est mirroré** par rapport à ce point commun
- Les positions changent + scale à -1

### Individual Origins

- Chaque objet mirroré **individuellement** autour de son propre origin
- Les positions **ne changent PAS** (chaque objet reste en place)
- Seul le scale passe à -1 (l'objet est "retourné sur lui-même")

### 3D Cursor

- Tous mirrorés par rapport à la position du 3D Cursor
- Utile pour un point de référence précis

---

## 4. Ctrl+M vs S → axe → -1

### Résultat : identique

Les deux produisent le même résultat mathématique.

### Différences pratiques

| Aspect | Ctrl+M | S → axe → -1 |
|--------|--------|---------------|
| Touches | 3 (Ctrl+M, axe, Enter) | 4+ (S, axe, "-1", Enter) |
| MMB sélection d'axe | Oui | Non (souris contrôle la valeur) |
| Valeur libre | Non, toujours -1 | Oui, n'importe quelle valeur |
| Opérateur Python | `transform.mirror()` | `transform.resize()` |

---

## 5. Feedback visuel

- **Header text** : affiche l'axe choisi (ex: `Mirror along X axis`)
- **Preview** : transformation visible en temps réel avant confirmation
- **Pas de ligne de symétrie** visible dans le viewport (le feedback est la transformation elle-même)

---

## 6. Implications pour notre implémentation

### Approche simple

Ctrl+M dans notre éditeur = **scale de -1** sur l'axe choisi, autour du pivot.

### Séquence d'implémentation

1. `Ctrl+M` → entrer en mode modal "mirror"
2. Attendre `X`, `Y` ou `Z`
3. Appliquer `object.scale[axis] *= -1` + repositionner si pivot ≠ origin
4. `Enter`/`LMB` confirme, `Escape`/`RMB` annule

### Cas multi-sélection

- **Pivot = centroïde** : calculer le centroïde, mirorer positions + scale
- **Pivot = individual** : uniquement inverser le scale de chaque objet

### Ce qu'on peut simplifier

- Pas besoin du double-tap (axe local) — nos objets utilisent les axes globaux
- Pas besoin du MMB pour la sélection d'axe — X/Y/Z clavier suffit
- Pas de problème de normales — Three.js gère ça automatiquement
