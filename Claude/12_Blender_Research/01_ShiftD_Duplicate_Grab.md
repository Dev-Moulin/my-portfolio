# Recherche : Shift+D — Duplication + Grab modal (Blender)

## Sources

- [Duplicate - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/duplicate.html)
- [Axis Locking - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/axis_locking.html)
- [Transform Modal Map - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/modeling/transform/modal_map.html)
- [Transform - Blender Developer Docs](https://developer.blender.org/docs/features/objects/transform/)
- [Blender source - object_ops.c](https://github.com/blender/blender/blob/master/source/blender/editors/object/object_ops.c)

---

## 1. Flux exact de Shift+D

### Étape par étape

1. **Shift+D** → Blender crée immédiatement une copie de tous les objets sélectionnés. La copie est placée **exactement à la même position** que l'original. La sélection bascule automatiquement sur les nouveaux objets (les originaux sont désélectionnés).

2. **Mode Grab activé automatiquement** → L'utilisateur est placé en mode modal de déplacement sans avoir besoin d'appuyer G. Techniquement, c'est un **opérateur macro** qui chaîne `OBJECT_OT_duplicate` + `TRANSFORM_OT_translate`.

3. **Suivi du curseur** → L'objet suit la souris en temps réel. Le déplacement = delta entre la position initiale de la souris (au moment du Shift+D) et la position courante.

4. **Confirmation** :
   - **Clic gauche (LMB)** → confirme la position
   - **Enter** → confirme également

5. **Annulation du déplacement** :
   - **Escape** → annule **uniquement le déplacement**, PAS la duplication. L'objet dupliqué **reste dans la scène** mais est replacé à la position d'origine (superposé à l'original)
   - **Clic droit (RMB)** → même comportement qu'Escape

### Point critique

> **Escape/clic droit n'annule PAS la duplication.** L'objet dupliqué existe toujours, simplement repositionné sur l'original. C'est un piège classique des débutants Blender qui se retrouvent avec des objets empilés.

### Code source (pseudo-code)

```
OBJECT_OT_duplicate_move = macro(
    OBJECT_OT_duplicate,          // Étape 1 : dupliquer
    TRANSFORM_OT_translate        // Étape 2 : entrer en mode grab
)
```

---

## 2. Contraintes pendant le grab post-Shift+D

Le grab post-Shift+D supporte **exactement les mêmes contraintes** qu'un grab normal (G) :

### Contrainte axe unique

| Action | Résultat |
|--------|----------|
| `X` | Contraint à l'axe X global |
| `Y` | Contraint à l'axe Y global |
| `Z` | Contraint à l'axe Z global |
| `X X` (double tap) | Bascule vers l'axe X **local** |
| `X X X` (triple) | Supprime la contrainte |

### Contrainte plan (Shift+axe)

| Action | Résultat |
|--------|----------|
| `Shift+X` | Plan YZ (libre sauf X) |
| `Shift+Y` | Plan XZ |
| `Shift+Z` | Plan XY |

### Saisie numérique

- `X 2 Enter` → déplace de 2 unités sur X
- `Y -3.5 Enter` → déplace de -3.5 sur Y
- `Backspace` → supprime le dernier caractère
- `Delete` → efface toute la saisie de l'axe courant

### Middle Mouse Button (MMB)

- Maintenir **MMB** → pointeur visuel avec les 3 axes
- Relâcher au-dessus de l'axe désiré → verrouille la contrainte
- **Shift+MMB** → verrouillage par plan

### Modificateurs

| Touche | Effet |
|--------|-------|
| `Shift` (maintenu) | Mode précision (mouvement ralenti) |
| `Ctrl` (maintenu) | Snap aux incréments définis |
| `Ctrl+Shift` | Snap + précision |

---

## 3. Annulation complète

### Escape pendant le grab

- Annule uniquement le déplacement, **pas** la duplication
- L'objet dupliqué reste dans la scène, superposé sur l'original
- La sélection reste sur l'objet dupliqué

### Ctrl+Z après Shift+D

- **Un seul Ctrl+Z** annule la duplication entière (supprime l'objet)
- Comme c'est un opérateur macro, Ctrl+Z défait toute l'opération (duplication + déplacement) en un seul pas d'undo

### Scénarios

```
Shift+D → déplacer → Escape → objet reste à la position d'origine → Ctrl+Z → duplication annulée
Shift+D → X 5 Enter → Ctrl+Z → toute l'opération annulée (duplication + déplacement)
```

---

## 4. Multi-sélection

- **Tous les objets sélectionnés sont dupliqués** simultanément
- Les **positions relatives sont préservées** (configuration spatiale identique)
- Le grab s'applique au **groupe entier** (déplacement rigide)
- Le pivot = **median point** de la sélection (ou 3D cursor selon le paramètre)

### Données partagées

- **Copies indépendantes** : mesh (géométrie), objet
- **Données partagées** (liées) : matériaux, textures, F-Curves
- Configurable dans `Preferences > Editing`

---

## 5. Détails techniques d'implémentation

### Architecture Transform dans Blender

| Structure | Rôle |
|-----------|------|
| **TransInfo** | Moteur central : flags, contexte, paramètres |
| **TransData** | Unité de transformation par objet/vertex |
| **NumInput** | Saisie numérique clavier |
| **TransSnap** | Système d'accrochage |

### Flux d'un opérateur modal

1. **Init** : sauvegarde position souris + viewport, crée TransData, calcule centre de transformation
2. **Boucle modale** : détecte mouvement souris → applique transformation → route événements (numérique, snap, contraintes) → met à jour header text → rafraîchit viewport
3. **Fin** : confirmation (valide) ou annulation (rollback via TransData sauvées)

### Caméra pendant le grab modal

- **Navigation viewport désactivée** (orbit/pan/zoom)
- L'opérateur modal consomme tous les événements d'entrée
- Le MMB est redirigé vers la sélection d'axe

### Feedback visuel

| Élément | Description |
|---------|-------------|
| **Ligne de contrainte** | Pointillés le long de l'axe verrouillé |
| **Couleur d'axe** | Rouge = X, Vert = Y, Bleu = Z (RGB = XYZ) |
| **Texte header** | Mode actif + orientation + axe contraint + valeurs numériques |
| **Valeurs numériques** | Deltas Dx/Dy/Dz affichés en temps réel |

---

## 6. Résumé pour implémentation Three.js

| Fonctionnalité | Approche suggérée |
|----------------|-------------------|
| Shift+D = duplication + grab | Machine à états : `idle` → `duplicating` → transition auto vers `grabbing` |
| Objet suit la souris | Raycaster sur plan invisible perpendiculaire à la caméra, ou projection souris → plan de l'axe contraint |
| Contraintes X/Y/Z | Projeter le delta sur l'axe : `delta.dot(axis) * axis` |
| Contraintes plan Shift+X/Y/Z | Projeter sur le plan défini par les 2 axes restants |
| Saisie numérique | Buffer clavier, parser les chiffres, appliquer comme delta |
| Escape = annule grab, garde copie | Repositionner à la position d'origine (même position que la source) |
| Ctrl+Z = annule tout | Push duplication complète (clone + position) comme une seule entrée undo |
| Multi-sélection | Dupliquer tous les selectedIds, appliquer le même delta à chacun |
| Feedback visuel | Three.js Line (pointillés) + HTML overlay pour les valeurs |
| Caméra gelée | Désactiver camera-controls pendant le mode grab |

---

## 7. Différences avec notre implémentation actuelle

| Aspect | Actuel | Cible Blender |
|--------|--------|---------------|
| Position après Shift+D | +2 unités en X | Même position que l'original |
| Mode grab automatique | Non | Oui |
| Contraintes d'axe | Non | X/Y/Z + Shift+axe (plan) |
| Saisie numérique | Non | Oui |
| Escape | — | Annule le déplacement (garde la copie) |
| Feedback visuel | Aucun | Ligne d'axe + header text |
