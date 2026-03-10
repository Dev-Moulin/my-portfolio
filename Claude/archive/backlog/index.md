# Backlog — Planification générale

## Structure

```
backlog/
  index.md              ← CE FICHIER — vue d'ensemble et priorités
  recherches/           ← Analyses Blender, décisions prises, solutions identifiées
    index.md
    01_shortcuts_overlay.md
    02_eye_path_rework.md
    03_timeline_ux.md
    04_outliner_contextuel.md
    05_scene_navigation.md
    06_visual_feedback.md
    07_modes.md
    08_dev_panel_cleanup.md
  plans/                ← Plans d'implémentation détaillés (fichiers, lignes, code)
    (à créer au fur et à mesure)
```

---

## Vue d'ensemble des chantiers

| # | Chantier | Complexité | Recherche | Décisions | Plan |
|---|----------|-----------|-----------|-----------|------|
| 1 | Raccourcis — overlay | Faible | — | — | À faire |
| 2 | Eye Path Bézier | Très élevée | Faite | Prises | À faire |
| 3 | Timeline UX | Élevée | Faite | À prendre | À faire |
| 4 | Outliner contextuel | Élevée | Faite | À prendre | À faire |
| 5 | Navigation souris | Moyenne | Faite | — | À faire |
| 6 | Feedback visuel | Moyenne | Faite | — | À faire |
| 7 | Modes (Edit/Object/User) | Élevée | Faite | À prendre | À faire |
| 8 | Dev Panel cleanup | Moyenne | Faite | — | À faire |

---

## Dépendances entre chantiers

```
#7 Modes ← fondation (change le routing global des raccourcis)
  ↑
  #2 Eye Path Bézier (étape 4 = Edit Mode pour courbes)
  #4 Outliner contextuel (panneau change selon le mode)

#4 Outliner contextuel ← prérequis pour #8
  ↑
  #8 Dev Panel cleanup (migration des onglets)

#3 Timeline UX ← indépendant (bugs + UX)
#5 Navigation souris ← indépendant (config CameraControls)
#6 Feedback visuel ← indépendant (items visuels petits)
#1 Shortcuts overlay ← indépendant (UI pure)
```

---

## Ordre d'implémentation proposé

### Phase A — Quick wins (indépendants, peu de code)
1. **#5 Navigation souris** — config CameraControls (MMB orbit, Shift+MMB pan, dollyToCursor)
2. **#8 Phase 1** — supprimer checkboxes "enable" + onglets CamPath/Visual KF
3. **#6 items simples** — highlight pistes timeline, feedback couleur eyePath points

### Phase B — Fondations
4. **#7 Modes** — machine `interactionModeMachine` (objectMode/editMode/previewMode)
5. **#3 Timeline fixes** — bug 150 frames, scroll vertical, retirer fold/unfold, pistes dynamiques

### Phase C — Gros morceaux
6. **#2 Eye Path Bézier** — 6 étapes progressives (handles → math → types → workflow → follow path → blend)
7. **#4 Outliner contextuel** — uiRegistry + panels par type + vue d'ensemble
8. **#8 Phase 2-4** — migration onglets vers outliner contextuel

### Phase D — Polish
9. **#6 items restants** — grille infinie shader, gizmo navigation, marqueur Eye origin
10. **#3 Timeline polish** — rendu visuel (barres interpolation, formes KF), "Only Show Selected"
11. **#1 Shortcuts overlay** — overlay avec tous les raccourcis par mode

---

## Prochaine étape

Créer les plans détaillés dans `plans/` pour chaque chantier, en commençant par la Phase A.
