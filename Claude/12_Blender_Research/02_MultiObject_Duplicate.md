# Recherche : Copie multi-objets (Shift+D avec multi-sélection)

## Sources

- [Blender 5.0 Manual - Duplicate](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/duplicate.html)
- [Blender Manual - Pivot Point](https://docs.blender.org/manual/en/2.80/scene_layout/object/editing/transform/control/pivot_point/index.html)
- [Blender Manual - Parenting Objects](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/parent.html)
- [Blender Issue #110167](https://projects.blender.org/blender/blender/issues/110167)

---

## 1. Sélection avant Shift+D

### Méthodes de sélection multiple

- **Shift+Clic** : ajoute/retire un objet de la sélection
- **B (Box Select)** : sélection par rectangle
- **C (Circle Select)** : sélection par cercle
- **Ctrl+Clic** : sélection par lasso
- **A** : tout sélectionner / tout désélectionner

### Active Object vs Selection

- **Selected Objects** : nombre illimité, surlignage orange
- **Active Object** : toujours exactement UN, surlignage jaune (le dernier sélectionné)
- Pour Shift+D, l'Active Object n'a **pas de rôle spécial** — tous les sélectionnés sont dupliqués de manière égale

### Types mixtes

Shift+D fonctionne sur **tout type d'objet** sans distinction : mesh, light, camera, empty, curve, armature, etc.

---

## 2. Duplication simultanée

- N objets sélectionnés → N copies créées **en une seule opération atomique**
- Blender entre immédiatement en mode Grab pour l'ensemble du groupe

### Convention de nommage

- `Cube` → `Cube.001` → `Cube.002` → `Cube.003`
- Suffixe à 3 chiffres, Blender cherche le prochain suffixe disponible
- S'applique à l'objet ET aux data-blocks copiés

### Relations parent-enfant

| Scénario | Résultat |
|----------|----------|
| Parent + tous les enfants sélectionnés | Hiérarchie complète dupliquée, liens préservés dans les copies |
| Parent seul sélectionné | Seul le parent est dupliqué, sans enfants |
| Enfant seul sélectionné | Enfant dupliqué, **sans parent** (objet racine) |
| Parent + certains enfants | Parent dupliqué + enfants sélectionnés, les non-sélectionnés ignorés |

### Données copiées vs partagées

| Donnée | Shift+D | Alt+D (Linked) |
|--------|---------|-----------------|
| Mesh data | **Copiée** (indépendante) | **Partagée** |
| Matériaux | Partagés | Partagés |
| Textures | Partagées | Partagées |
| F-Curves | Partagées | Partagées |
| Modifiers | **Copiés** | **Copiés** |
| Constraints | **Copiées** (targets pointent vers originaux) | **Copiées** |
| Transform | **Copiée** (indépendante) | **Copiée** |

Configurable dans `Preferences > Editing > Duplicate Data`.

---

## 3. Pivot point et transformation de groupe

### Pendant le Grab (déplacement)

Le pivot point n'a **pas d'effet** sur le Grab — tous les objets reçoivent **exactement le même vecteur delta**. Les positions relatives sont strictement préservées.

### Pivot point — impact sur Rotate/Scale (hors grab)

| Pivot Point | Rotate/Scale |
|-------------|-------------|
| **Median Point** (défaut) | Autour du centre médian de la sélection |
| **Active Element** | Autour de l'origine de l'objet actif |
| **Individual Origins** | Chaque objet autour de son propre origin |
| **3D Cursor** | Autour du 3D Cursor |
| **Bounding Box Center** | Autour du centre de la bounding box |

### Contraintes d'axe

Les contraintes (X/Y/Z, Shift+axe) s'appliquent **au groupe entier** :
- Taper `X` → tous les objets se déplacent uniquement sur X
- Le même delta contraint est appliqué à chaque objet

---

## 4. Positions relatives

- Offsets entre objets : **strictement identiques** aux originaux
- Déplacement = même vecteur pour chaque objet → distances et angles invariants
- **Scale pendant le Grab : impossible** (ce sont des opérations modales distinctes)

Si on scale après confirmation :
- **Median Point** : objets se rapprochent/éloignent proportionnellement
- **Individual Origins** : positions relatives préservées

---

## 5. Annulation multi-objets

### Escape / Clic droit

- Annule **uniquement le déplacement**, les duplicats restent empilés sur les originaux
- Tous les duplicats sont repositionnés à leur position d'origine respective
- Les duplicats deviennent la sélection active

### Ctrl+Z

- **Supprime TOUS les duplicats en un seul pas d'undo**
- Opération entière = une seule entrée undo
- Sélection revient aux objets originaux

---

## 6. Implications pour notre implémentation

### Ce qu'on a déjà

- Multi-sélection via Ctrl+Clic (Phase 7 ✓)
- `selectionActor` gère un `Set<string>` de selectedIds
- Shift+D duplique un seul objet (le dernier sélectionné)

### Ce qu'il faut ajouter

| Aspect | Action |
|--------|--------|
| Itérer sur tous les `selectedIds` | Boucle de duplication pour N objets |
| Préserver les positions relatives | Calculer le delta par rapport au centroïde, appliquer le même offset sur chaque copie |
| Nommage | Déjà géré par `descriptor.nextId(sourceId)` → `neon_1`, `neon_2`... |
| Grab de groupe | Un seul delta de souris appliqué à tous les duplicats |
| Undo atomique | Un seul `recordAction()` avant la boucle de duplication |
| Escape multi | Tous les duplicats reviennent à leur position d'origine respective |
| Relations parent-enfant | Non applicable pour l'instant (pas de hiérarchie dans notre scène) |
