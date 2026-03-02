# Recherche : Library / Asset Browser — Améliorations futures

## Sources

- [Asset Browser - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/editors/asset_browser.html)
- [Mesh Primitives - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/modeling/meshes/primitives.html)
- [Editing Text Objects - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/modeling/texts/editing.html)
- [Light Objects - Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/render/lights/light_object.html)

---

## 1. Pattern Blender : "Create-then-Configure"

### Principe fondamental

Blender **ne propose PAS de configurateur avant la création**. Le workflow est :

1. `Shift+A` → menu hiérarchique → clic sur le type voulu
2. L'objet est créé **immédiatement** avec des valeurs par défaut
3. Panneau **"Adjust Last Operation" (F9)** apparaît en bas à gauche du viewport
4. On ajuste les paramètres → l'opération est **ré-exécutée** avec les nouveaux params
5. Dès qu'on fait une autre action → le panneau disparaît, les paramètres sont figés

### Implication pour nous

Notre configurateur Neon (slider + thèmes) est une **exception** au pattern Blender. C'est un choix de design valide pour notre cas (générer 50 bandes nécessite des choix avant création), mais les autres types (Text, Light, Card) peuvent suivre le pattern Blender standard : créer d'abord, configurer après via le DevPanel.

---

## 2. Shift+A — Menu hiérarchique

### Structure dans Blender

```
Shift+A
├── Mesh (Cube, Sphere, Cylinder, Cone, Torus, Grid, Monkey...)
├── Curve (Bezier, Circle, Nurbs...)
├── Text
├── Light (Point, Sun, Spot, Area)
├── Camera
├── Empty (Axes, Arrows, Circle...)
└── ...
```

### Notre équivalent

Notre Library tab avec grille 2×2 : Neon, Text, Light, Card. C'est plus simple mais adapté à nos 4 types.

---

## 3. Panneau "Adjust Last Operation" (F9)

### Fonctionnement

- **Éphémère** : seule la dernière opération est ajustable
- **Ré-exécution** : modifier un param = undo + redo avec nouveau param
- **Pas toutes les ops** : certaines opérations n'ont pas ce panneau

### Paramètres par type primitif

| Primitive | Paramètres |
|-----------|-----------|
| Cube | Size |
| UV Sphere | Segments, Rings, Radius |
| Cylinder | Vertices, Radius, Depth, Cap Fill |
| Cone | Vertices, Radius 1/2, Depth |
| Torus | Major/Minor Segments, Major/Minor Radius |
| Tous | Align (World/View/Cursor), Location X/Y/Z, Rotation X/Y/Z |

---

## 4. Text 3D dans Blender

### Création

`Shift+A → Text` → objet texte créé avec contenu `"Text"` au curseur 3D.

### Édition

`Tab` → Edit Mode spécial texte (saisie directe au clavier, copier/coller).

### Paramètres disponibles

| Catégorie | Paramètres |
|-----------|-----------|
| Font | Famille (Regular, Bold, Italic), OTF/TTF |
| Geometry > Extrude | Profondeur 3D |
| Geometry > Bevel | Chanfrein (depth + resolution) |
| Paragraph > Alignment | Left, Center, Right, Justify |
| Paragraph > Spacing | Character, Word, Line |
| Size | Taille globale |
| Shear | Italique artificiel |
| Text on Curve | Suivre une courbe |

### Pour notre éditeur

Un configurateur Text pourrait proposer : contenu, font, taille, couleur. Mais vu le pattern Blender, on peut aussi créer avec des défauts et configurer via l'Outliner/DevPanel existant.

---

## 5. Lights dans Blender

### Types via Shift+A → Light

| Type | Description | Paramètres clés |
|------|-------------|-----------------|
| **Point** | Omnidirectionnel | Power, Color, Radius |
| **Sun** | Rayons parallèles (position sans importance, rotation seule) | Power, Color, Angle |
| **Spot** | Cône directionnel | Power, Color, Spot Size, Blend |
| **Area** | Surface émettrice | Power, Color, Shape (Square/Rect/Disk/Ellipse), Size |

### Paramètres communs

- Color (RGB), Power (Watts)
- Specular/Diffuse multiplicateurs
- Shadow (on/off, soft shadows, resolution)

### Pour notre éditeur

On a déjà un type `light` avec `lightType: 'point'`. Un configurateur Light pourrait proposer : type (point/directional), couleur, intensité. Mais comme pour Text, le DevPanel existant peut suffire.

---

## 6. Drag & Drop — Asset Browser → Viewport

### Mécanisme Blender

1. **Clic gauche maintenu** sur un asset dans l'Asset Browser
2. **Pendant le drag** : bounding box ghost + raycasting vers surfaces
3. **Snap automatique** : sur surfaces existantes ou grille du sol
4. **Relâcher** : place l'objet

### Détails techniques

- Le snapping utilise la bounding box (pas l'origin) par défaut
- Si aucune surface → snap sur la grille
- Pas de transformation post-drop automatique (l'objet est placé, point final)

### Pour notre éditeur

Un drag & drop depuis la Library vers le viewport nécessiterait :
1. `onDragStart` → créer un ghost/preview
2. `onDrag` → Raycaster Three.js vers un plan au sol (y=0) ou surfaces
3. `onDrop` → créer l'instance à la position du raycast

C'est faisable mais plus complexe que le clic actuel. Priorité basse.

---

## 7. Templates et Presets

### Blender n'a PAS de templates d'objets natifs

Le workflow est :
1. Créer avec défauts → configurer → marquer comme asset → réutiliser via drag & drop

### Presets natifs

- Scripts Python qui définissent des valeurs de paramètres
- Stockés dans `scripts/presets/`
- Certains opérateurs incluent un sélecteur de presets

### Pour notre éditeur

Un système de templates pourrait être :
- Sauvegarder une configuration complète (ex: "Neon Cascade 20 bandes Sunset") comme preset JSON
- Proposer ces presets dans la Library
- C'est essentiellement un `NeonInstanceConfig` sérialisé avec un nom

---

## 8. Résumé — Priorités pour nos améliorations Library

| Amélioration | Pattern Blender | Complexité | Priorité |
|-------------|-----------------|-----------|----------|
| Configurateur Neon (bands + thèmes) | **Exception** : créer avec config (justifié par la complexité) | Faible | ✓ **Fait** |
| Configurateur Text | Pattern Blender : créer avec défauts, configurer après | Faible | Basse (le DevPanel suffit) |
| Configurateur Light | Pattern Blender : choix du type dans le menu, params après | Faible | Basse |
| Templates/Presets | Sérialisation JSON de configs nommées | Moyenne | Moyenne |
| Drag & Drop vers viewport | Raycaster + ghost preview | Élevée | Basse |

### Conclusion

Pour Text et Light, le pattern Blender (créer puis configurer) fonctionne bien avec notre DevPanel existant. Un configurateur pré-création n'est justifié que quand les défauts sont insuffisants (comme pour le Neon avec 3 bandes hardcodées). Le drag & drop est un nice-to-have pour plus tard.
