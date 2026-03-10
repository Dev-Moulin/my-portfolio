# 08 — Nettoyage Dev Panel

## Problème actuel

Le Dev Control Panel a trop d'onglets dont la plupart ne servent plus à grand-chose ou sont redondants avec d'autres systèmes (gizmo, timeline, outliner).

## Onglets actuels et leur pertinence

| Onglet | Utilité actuelle | Verdict |
|--------|-----------------|---------|
| **Bloom** | Réglages bloom globaux (threshold, strength, radius) | Garder — paramètres globaux scène |
| **Lighting** | Réglages lumières (intensité, couleur, position) | → Outliner contextuel (#4) — réglages par lumière sélectionnée |
| **Material** | Réglages matériaux du modèle | → Outliner contextuel (#4) — réglages quand le modèle est sélectionné |
| **Neon** | Réglages neon (bandes, couleurs, glow) | → Outliner contextuel (#4) — réglages par neon sélectionné |
| **Scroll Text** | Réglages texte (contenu, font, couleur) | → Outliner contextuel (#4) — réglages par texte sélectionné |
| **Card** | Réglages card (position, scale) | → Outliner contextuel (#4) — réglages par card sélectionnée |
| **CamPath** | Export/import + enable toggle | → Timeline + Save/Load gèrent déjà ça |
| **Visual KF** | Enable toggle + infos | → Supprimable, c'est du debug |
| **Outliner** | Liste des objets + œil + verrou | Garder et **étendre** avec les réglages contextuels |
| **Steering** | Paramètres Yuka (wander, boundary) | → Outliner contextuel (#4) — réglages quand l'Eye est sélectionné |

## Checkboxes "enable" — à supprimer

Ces checkboxes sont des toggles de debug/dev :
- "Enable visual track" → si l'utilisateur a créé des visual keyframes, c'est actif. Pas besoin de toggle.
- "Enable card" → si une card existe dans la scène, c'est actif. Pas besoin de toggle.
- "Enable eye path" → idem.

**Règle simple** : Un élément existe dans la scène → il est actif. Il n'existe pas → pas de piste, pas de toggle.

---

## Recherches effectuées

### [x] Comment Blender organise ça (voir #4 pour le détail complet)

Blender a exactement 2 panneaux "de droite" :
1. **Properties Panel** — change dynamiquement selon l'objet sélectionné (onglets contextuels)
2. **Outliner** — vue arborescente de la scène

Il n'y a **PAS** d'onglets fixes par type d'objet. Tout est contextuel.

### [x] Mapping onglets actuels → nouveau système

| Onglet actuel | Destination | Déclencheur |
|--------------|-------------|-------------|
| Bloom | Onglet **Scene** (toujours visible) | Rien sélectionné, ou onglet dédié |
| Lighting | Panel contextuel Light | Clic sur une lumière |
| Material | Panel contextuel Model | Clic sur le modèle Eye |
| Neon | Panel contextuel Neon | Clic sur un neon spécifique |
| Scroll Text | Panel contextuel Text | Clic sur un texte |
| Card | Panel contextuel Card | Clic sur une card |
| CamPath | **Supprimé** | Timeline + Save/Load suffisent |
| Visual KF | **Supprimé** | Debug, pas utilisateur |
| Outliner | Mode "rien sélectionné" du Properties Panel | Aucune sélection active |
| Steering | Panel contextuel Eye | Clic sur l'Eye |

### [x] Fichiers actuels concernés

```
components/devPanel/
  DevControlPanel.tsx      ← composant principal avec les onglets
  tabs/
    BloomTab.tsx           ← GARDER (→ onglet Scene)
    LightingTab.tsx        ← MIGRER → panel contextuel Light
    MaterialTab.tsx        ← MIGRER → panel contextuel Model
    NeonTab.tsx            ← MIGRER → panel contextuel Neon
    ScrollTextTab.tsx      ← MIGRER → panel contextuel Text
    CardTab.tsx            ← MIGRER → panel contextuel Card
    CamPathTab.tsx         ← SUPPRIMER
    VisualKfTab.tsx        ← SUPPRIMER
    OutlinerTab.tsx        ← GARDER + étendre
    SteeringTab.tsx        ← MIGRER → panel contextuel Eye
```

### [x] Pattern de migration (voir #4)

Utiliser le **Registry UI séparé** documenté dans #4 :
1. Créer `components/propertiesPanel/panels/` avec un panel par type
2. Chaque panel reprend les sliders/inputs de l'onglet existant
3. Le `PropertiesPanel` principal resolve le bon panel via `uiRegistry`
4. Supprimer les anciens onglets un par un une fois migrés

Le code des sliders/inputs est **réutilisable** — ce n'est pas une réécriture, c'est un déplacement + adaptation au hook `useInstanceConfig`.

---

## Plan d'action

### Ordre de migration (du plus simple au plus complexe)

**Phase 1 — Suppressions directes (aucune migration nécessaire)**
1. Supprimer toutes les checkboxes "enable" (visual track, card, eye path)
2. Supprimer l'onglet CamPath
3. Supprimer l'onglet Visual KF

**Phase 2 — Mise en place du Properties Panel contextuel (dépend de #4)**
4. Créer la structure `propertiesPanel/` avec uiRegistry
5. Créer le panel contextuel Neon (migration de NeonTab)
6. Créer le panel contextuel Text (migration de ScrollTextTab)
7. Créer le panel contextuel Card (migration de CardTab)

**Phase 3 — Systèmes existants hors componentRegistry**
8. Migrer Lighting → panel contextuel (les lumières ne sont pas encore dans componentRegistry)
9. Migrer Material → panel contextuel (idem, le modèle n'est pas dans componentRegistry)
10. Migrer Steering → panel contextuel Eye

**Phase 4 — Finalisation**
11. Renommer l'onglet Bloom en "Scene" et y ajouter les paramètres globaux
12. L'Outliner devient le mode par défaut (rien sélectionné)
13. Supprimer `DevControlPanel.tsx` et son système d'onglets → remplacer par le Properties Panel unique

### Résultat final

Le panneau de droite aurait :
- **Properties Panel** — adaptatif selon la sélection (panels contextuels par type)
- **Onglet Scene** — bloom, paramètres globaux (visible en mode "rien sélectionné" ou toujours accessible)
- Plus de tabs fixes, plus de checkboxes, plus de CamPath/Visual KF

---

## Dépendances

- **Dépend de #4** (Outliner contextuel) — c'est le prérequis pour les panels par type
- Phase 1 (suppressions) peut être faite **indépendamment** de #4
- Phases 2-4 nécessitent le `uiRegistry` + `PropertiesPanel` de #4

## Complexité : Moyenne (Phase 1 = facile, Phases 2-4 = déplacement de code existant)
