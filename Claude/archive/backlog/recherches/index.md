# Backlog — Améliorations et Refonte UX

Index des sujets identifiés. Chaque fichier décrit un problème, le comportement souhaité, les recherches à faire, et les solutions possibles.

## Statut

| # | Sujet | Fichier | Statut |
|---|-------|---------|--------|
| 1 | Raccourcis clavier — overlay | [01_shortcuts_overlay.md](01_shortcuts_overlay.md) | À faire |
| 2 | Eye Path — refonte complète | [02_eye_path_rework.md](02_eye_path_rework.md) | Recherches faites + décisions prises |
| 3 | Timeline UX | [03_timeline_ux.md](03_timeline_ux.md) | Recherches faites |
| 4 | Outliner contextuel | [04_outliner_contextuel.md](04_outliner_contextuel.md) | Recherches faites |
| 5 | Navigation souris scène | [05_scene_navigation.md](05_scene_navigation.md) | Recherches faites |
| 6 | Feedback visuel et liens scène↔timeline | [06_visual_feedback.md](06_visual_feedback.md) | Recherches faites |
| 7 | Modes (Edit / Object / User) | [07_modes.md](07_modes.md) | Recherches faites |
| 8 | Nettoyage Dev Panel | [08_dev_panel_cleanup.md](08_dev_panel_cleanup.md) | Recherches faites (dépend de #4) |

## Méthode

1. **Noter** — Décrire le problème, le comportement actuel, le comportement souhaité
2. **Rechercher** — Analyser comment Blender (et autres) font, croiser les sources
3. **Discuter** — Choisir l'approche, identifier les dépendances entre sujets
4. **Planifier** — Découper en étapes implémentables
5. **Implémenter** — Coder par morceaux, tester, itérer

## Dépendances entre sujets

```
#2 Eye Path Rework ──────┐
                         ├──→ #7 Modes (Edit/Object/User)
#3 Timeline UX ──────────┤
                         ├──→ #6 Feedback visuel (sélection↔timeline)
#4 Outliner contextuel ──┘

#5 Navigation souris ──────── indépendant
#1 Shortcuts overlay ──────── indépendant
#8 Dev Panel cleanup ──────── dépend de #4 (Outliner contextuel le remplace)
```
