# Recherche : G/R/S — Opérateurs modaux complets (Blender)

## Sources

- [Blender 5.0 Manual - Move](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/move.html)
- [Blender 5.0 Manual - Rotate](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/rotate.html)
- [Blender 5.0 Manual - Scale](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/scale.html)
- [Blender Developer Docs - Transform](https://developer.blender.org/docs/features/objects/transform/)
- [Blender Source - transform.h](https://github.com/blender/blender/blob/main/source/blender/editors/transform/transform.h)

---

## 1. Pattern modal commun

Les 3 opérateurs partagent le même cycle :

1. **Appui unique** (G, R ou S) → entre en mode modal (`RUNNING_MODAL`)
2. **Mouvement souris** → transformation en temps réel
3. **Enter / Clic gauche** → confirme
4. **Escape / Clic droit** → annule (rollback complet aux valeurs initiales)

La fonction `modal()` est appelée à chaque événement (event-driven).

### Affichage

Valeurs en temps réel dans le footer du viewport : delta position, angle en degrés, facteur de scale.

---

## 2. G (Grab/Move) — Spécificités

### Conversion souris 2D → mouvement 3D

- Le mouvement souris est projeté sur un **plan perpendiculaire à la direction de vue**, passant par le centre de l'objet
- On déplace donc dans le **plan de l'écran**
- Le déplacement est en **unités Blender** (pas en pixels). La correspondance dépend du zoom

### Modificateurs

| Touche | Effet |
|--------|-------|
| `Shift` maintenu | Précision 1/10e (grands mouvements souris = petits déplacements) |
| `Ctrl` maintenu | Snap à 1 BU (au zoom par défaut), l'incrément diminue avec le zoom |
| `Ctrl+Shift` | Snap à 0.1 BU |

---

## 3. R (Rotate) — Spécificités

### Calcul de l'angle

- Le pivot 3D est projeté en **coordonnées écran** (pivot_2D)
- Angle = angle entre les vecteurs `pivot_2D → souris_initiale` et `pivot_2D → souris_courante`
- L'axe de rotation par défaut est **perpendiculaire à la vue** (rotation "dans le plan de l'écran")

### Double tap : Trackball (R R)

- **R R** → mode Trackball = rotation libre (pas contraint à un seul axe)
- Calcule axe + angle depuis positions initiale/finale
- Hardcodé, pas configurable
- Limite : erratique au-delà de 180°

### Modificateurs

| Touche | Effet |
|--------|-------|
| `Ctrl` | Snap à **5°** |
| `Ctrl+Shift` | Snap à **1°** |
| `Shift` seul | Précision (rotation lente) |

### Affichage

Angle en degrés affiché en temps réel dans le viewport.

---

## 4. S (Scale) — Spécificités

### Calcul du ratio

```
ratio = distance(pivot_2D, souris_courante) / distance(pivot_2D, souris_initiale)
```

- Éloigner du pivot = agrandir
- Rapprocher du pivot = rétrécir

### Pivot point

Le pivot influence le **centre du scale** :
- **Median Point** : centre médian de la sélection
- **3D Cursor** : position du curseur 3D
- **Individual Origins** : chaque objet scale autour de son propre origin
- **Active Element** : autour de l'objet actif

### Scale négatif (miroir)

- Si la souris **traverse le pivot**, le scale devient négatif → **miroir/flip**
- Attention aux objets déjà pivotés

### Uniforme vs non-uniforme

- **Par défaut** : scale uniforme sur les 3 axes
- **Avec contrainte d'axe** (X/Y/Z) : scale non-uniforme (un seul axe)

### Modificateurs

| Touche | Effet |
|--------|-------|
| `Ctrl` | Incréments de 0.1 |
| `Ctrl+Shift` | Incréments de 0.01 |
| `Shift` seul | Précision (scale lent) |

---

## 5. Caméra pendant les modes modaux

### Blender 4.0+

- Navigation possible avec **Alt+MMB** (orbite), **Alt+Scroll** (zoom), **Alt+Shift+MMB** (pan)
- **MMB sans Alt** → redirigé vers la détection d'axe (pas orbite)

### Avant Blender 4.0

- Navigation **complètement désactivée** pendant les modaux
- L'opérateur modal consomme tous les événements

---

## 6. Interactions entre G/R/S

**On NE PEUT PAS passer d'un mode à un autre** pendant une transformation active.

- Il faut **confirmer ou annuler** avant de changer
- Les modes sont **mutuellement exclusifs**
- Exception : après Shift+D → G, on ne peut PAS non plus switcher vers R ou S (contrairement à ce qu'on pourrait croire)

---

## 7. Implémentation technique

### Moteur partagé

Les 3 modes utilisent le **même moteur** de transformation :
- `TransInfo` : structure centrale (flags, contexte, paramètres)
- `TransData` : données par objet sélectionné (position/rotation/scale initiales sauvegardées)
- `TransDataExtension` : données supplémentaires (rotation, scale)

La seule différence est le **pointeur de fonction** :
- `applyTranslation` pour G
- `applyRotation` pour R
- `applyResize` pour S

### Cycle complet

```
initTransform()
  → sauvegarde valeurs initiales dans TransData
  → calcule centre de transformation
  → initialise moteur

Boucle modale (à chaque événement) :
  → detecte mouvement souris
  → appelle mode_function (translate/rotate/resize)
  → recalcData (met à jour les données Blender)
  → headerPrint (texte feedback)
  → viewRedrawForce (rafraîchit le viewport)

Finalisation :
  → Confirm : valide les nouvelles valeurs
  → Cancel : rollback via TransData sauvegardées
```

### Rollback garanti

Les valeurs initiales (position, rotation, scale) sont sauvegardées dans les `TransData` lors de l'initialisation. L'annulation restaure simplement ces valeurs.

---

## 8. Résumé pour notre implémentation

### Déjà implémenté

- **S modal** : Phase 1 ✓ (mais sans contrainte d'axe)

### À implémenter

| Mode | Calcul principal | Implémentation Three.js |
|------|-----------------|------------------------|
| **G** | Projeter mouvement souris sur plan perpendiculaire à la caméra | `Raycaster` sur plan invisible passant par l'objet, normal = `camera.getWorldDirection()` |
| **R** | Angle entre pivot_2D→souris_init et pivot_2D→souris_current | `Math.atan2` des vecteurs 2D en screen space |
| **S** | Ratio distances au pivot en screen space | `distance_current / distance_initial` |

### Architecture suggérée

Factoriser le pattern modal dans un système partagé :

```
ModalTransformState {
  mode: 'grab' | 'rotate' | 'scale'
  initialValues: Map<id, { position, rotation, scale }>
  pivotScreen: Vector2
  mouseStart: Vector2
  constraint: null | 'x' | 'y' | 'z'
  numericBuffer: string
}
```

Handlers communs : `onMouseMove`, `onConfirm`, `onCancel`, `onAxisKey`, `onNumericKey`.
