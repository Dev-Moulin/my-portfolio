# 04 — Outliner contextuel

## Problème actuel

Le Dev Panel a des onglets fixes pour chaque type d'objet (Neon, Card, Scroll Text, Visual KF, CamPath...). Chaque onglet a des réglages spécifiques à ce type + des checkboxes "enable" confuses. Les réglages ne changent pas selon la sélection dans la scène.

### Problèmes spécifiques

1. **Onglet "Visual Keyframes"** — Pas clair ce que ça fait. Checkbox "enable visual track" incompréhensible.
2. **Onglet "Card"** — Les cards se déplacent via gizmo maintenant, les réglages de position dans l'onglet sont redondants. Checkbox inutile.
3. **Onglet "CamPath"** — La timeline gère le temps, Save/Load gère l'export. La checkbox est confuse.
4. **Onglet "Scroll Text"** — Mêmes problèmes que Card.
5. **Onglet "Neon"** — Les paramètres s'appliquent à "le" neon, pas à un neon spécifique si on en a plusieurs.

### Checkboxes "enable"
Ces checkboxes activent/désactivent des systèmes entiers (debug/dev pattern). **Inutile pour l'utilisateur** : si un objet existe et a des réglages, il est actif. Point. On les supprime.

---

## Recherches effectuées

### [x] Properties Panel de Blender

#### Organisation — Deux familles d'onglets

**Onglets scène (toujours visibles, indépendants de la sélection) :**
- Render, Output, View Layer, Scene, World, Active Tool

**Onglets objet (contextuels selon le type d'objet actif) :**

| Onglet | Toujours visible ? | Types concernés |
|--------|-------------------|-----------------|
| Object Properties | Oui (si objet actif) | Tous |
| Modifiers | Contextuel | Mesh, Curve, Surface, Text |
| Particles | Contextuel | Mesh uniquement |
| Physics | Contextuel | Mesh, Empty |
| Object Constraints | Oui (si objet actif) | Tous |
| Object Data | Oui (icône change !) | Tous (contenu différent par type) |
| Material | Contextuel | Mesh, Curve, Surface |

> **Point clé** : l'onglet Object Data est TOUJOURS visible mais son icône et son contenu changent selon le type (triangle vert = mesh, ampoule = light, caméra = camera, courbe = curve).

#### Objet actif vs sélectionné

- **Objet actif** (contour jaune) = le DERNIER objet cliqué. **Un seul à la fois.**
- **Objets sélectionnés** (contour orange) = peuvent être nombreux.
- Le Properties Panel affiche **UNIQUEMENT les propriétés de l'objet actif** (pas les sélectionnés).
- Quand on change de sélection → mise à jour instantanée.
- Si le type change (mesh → light) → les onglets changent aussi instantanément.

#### Par type d'objet — ce qui apparaît

**Mesh sélectionné :** Tous les onglets. Object Data = Vertex Groups, Shape Keys, UV Maps, Normals. Material = slots de matériaux.

**Light sélectionnée :** Object Properties + Constraints + Object Data (ampoule). Disparaissent : Modifiers, Particles, Physics, Material. Object Data Light = Type (Point/Sun/Spot/Area), Color, Power, Size, Shadow settings.

**Camera sélectionnée :** Object Properties + Constraints + Object Data (caméra). Disparaissent : Modifiers, Particles, Physics, Material. Object Data Camera = Lens (focal mm), Clip Start/End, Sensor, DOF (focus, f-stop).

**Curve sélectionnée :** Object Properties + Modifiers + Constraints + Object Data (courbe) + Material. Object Data Curve = Resolution, Fill mode, Bevel, 2D/3D. En Edit Mode : panneau N avec coordonnées exactes des control points + handles.

#### Si rien n'est sélectionné
- Onglets scène restent visibles (Render, Output, Scene, World)
- Onglets objet affichés mais **contenu vide**

#### Fonctionnalité "Pin" (épingle)
- Icône épingle dans le header = verrouiller l'affichage sur l'objet courant
- Le Properties Panel ne se met plus à jour quand la sélection change
- Utile pour comparer/éditer un objet tout en sélectionnant d'autres

---

### [x] Multi-sélection dans Blender

- Le Properties Panel affiche **UNIQUEMENT l'objet actif** (le jaune). Les autres (orange) n'apparaissent pas.
- Pour propager une valeur à tous les sélectionnés : **Alt+clic** sur un champ, ou **clic droit → "Copy to Selected"**
- Valeurs "mixed" : Blender peut griser le champ ou le laisser vide. Ce n'est pas un système aussi propre que Figma ("Mixed" en gris). C'est une lacune reconnue de Blender.

> **Pour notre app** : on peut faire mieux que Blender en affichant explicitement "—" ou "mixed" quand les valeurs diffèrent entre objets sélectionnés du même type.

---

### [x] Outliner de Blender

#### Hiérarchie
```
Scene
├── Collection (principale)
│   ├── Camera
│   ├── Light
│   ├── Cube
│   └── SubCollection
│       └── Sphere
└── World
```

- Arbre extensible (triangle de disclosure)
- Chaque entrée peut être développée pour voir les données internes (mesh, materials, modifiers)

#### Icônes par type

| Type | Icône | Couleur |
|------|-------|---------|
| Mesh | Cube | Vert |
| Curve | Courbe | Vert |
| Light | Ampoule | Jaune |
| Camera | Caméra | Vert |
| Armature | Os | Bleu |
| Empty | Croix | Vert |

#### Colonnes de restriction (à droite des noms)

| Icône | Nom | Effet |
|-------|-----|-------|
| Œil | Visibility | Masque dans le viewport (l'objet existe toujours et sera rendu) |
| Caméra | Render Visibility | Exclut du rendu final |
| Curseur | Selectability | Rend l'objet non-sélectionnable |
| Cadenas | Lock | Empêche les modifications |

- **Shift+clic** = propage à tous les enfants
- **Ctrl+clic** = isole (tous les autres basculent en inverse)

#### Comportement de sélection
- **Clic** sur un nom = sélectionne l'objet dans le viewport + le rend actif + met à jour le Properties Panel
- **Ctrl+clic** = ajoute à la sélection
- **Double-clic** = renommer
- **F2** = renommer
- **Drag & drop** = réorganiser (dans une collection, parentage)

#### Filtres
- Par type d'objet (icônes cliquables)
- Par nom (recherche textuelle)
- "Only Show Selected" = ne montre que les objets sélectionnés dans le viewport
- "Sync Selection" = synchronise sélection Outliner ↔ viewport

---

### [x] Pattern React — Panneau contextuel

#### Pattern recommandé : Registry UI séparé

Créer une `Map<string, React.FC>` où chaque type d'objet enregistre son composant de propriétés.

```
uiRegistry.ts     → Map type → React.FC
registerAll.ts    → side-effect imports qui peuplent la Map
PropertiesPanel   → switch: rien sélectionné → SceneOverview
                            1 objet → SingleObjectView (via uiRegistry)
                            N objets même type → MultiSelectionView (merged configs + "mixed")
```

**Avantages par rapport au polymorphisme via ComponentDescriptor :**
- Les descripteurs Three.js restent purs (pas d'import React/JSX)
- L'ajout d'un type = un fichier panel + une ligne dans `registerAll.ts`
- Lazy-loading possible si les panels deviennent lourds

#### Multi-sélection : mergeConfigs()
- Pour chaque champ : si tous les objets sélectionnés ont la même valeur → affiche la valeur, sinon → `undefined` (affiché comme "—" ou "mixed")
- `updateAll(field, value)` → dispatch un CustomEvent pour CHAQUE id sélectionné

#### Flux bidirectionnel existant (déjà en place)
```
Three.js → CustomEvent 'overmind:instance-config' → useInstanceConfig() → React
React → inst.updateField() → CustomEvent 'overmind:instance-config-update' → configBridge → Three.js
```

#### Structure de fichiers cible
```
components/propertiesPanel/
  PropertiesPanel.tsx       ← composant principal (switch contextuel)
  uiRegistry.ts             ← Map type → React.FC
  registerAll.ts            ← side-effect imports
  types.ts                  ← InstanceHook, MixedValue, etc.
  panels/
    NeonPropertiesPanel.tsx
    TextPropertiesPanel.tsx
    LightPropertiesPanel.tsx
    CardPropertiesPanel.tsx
  shared/
    CollapsibleSection.tsx
    SliderRow.tsx
    MixedNumberField.tsx
    ColorRow.tsx
```

---

## Comportement souhaité — Outliner adaptatif

L'Outliner (panneau de droite) **s'adapte à la sélection** comme le Properties Panel de Blender :

### Clic sur un texte → l'Outliner affiche :
- Contenu du texte (éditable)
- Font family / typo
- Font size
- Color
- Emissive intensity / bloom / glow
- Position (lecture seule ou lien vers gizmo)

### Clic sur un neon → l'Outliner affiche :
- Band count, spacing, width
- Colors par bande
- Glow intensity
- Animation speed
- Paramètres spécifiques à CE neon (pas "le" neon global)

### Clic sur une card → l'Outliner affiche :
- Scale
- Contenu
- Timing d'apparition (scrollStart, scrollEnd)

### Clic sur l'Eye → l'Outliner affiche :
- Position de départ (éditable)
- Paramètres steering (wander, boundary, repulsion)
- Courbes assignées (eye paths)

### Multi-sélection (ex: 2 textes) → l'Outliner affiche :
- Réglages communs aux deux
- Modification appliquée aux deux simultanément
- Champs différents affichés comme "—" ou "mixed"

### Rien sélectionné → l'Outliner affiche :
- Vue d'ensemble de la scène (liste des objets groupés par type avec icônes couleur)
- Paramètres globaux (bloom, lighting, material)

---

## Conséquences

- **Suppression des onglets** : Neon, Card, Scroll Text, Visual KF, CamPath disparaissent
- **L'OutlinerTab actuel** (liste d'objets + œil + verrou) devient le mode "rien sélectionné"
- **Chaque type d'objet** a son propre composant de réglages contextuel
- **Le ComponentDescriptor existant** reste pur Three.js, le UI est géré par le registry séparé

---

## Dépendances

- Dépend de la suppression des onglets du Dev Panel (#8)
- Le système de ComponentDescriptor existant (componentDescriptor.ts) sert de base pour les types
- Le flux CustomEvent existant (instance-config / instance-config-update) est réutilisé

## Complexité : Élevée — c'est un refactoring UI majeur
