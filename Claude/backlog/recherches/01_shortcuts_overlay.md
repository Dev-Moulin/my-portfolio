# 01 — Raccourcis clavier — Overlay

## Problème actuel

Les raccourcis clavier sont nombreux mais pas documentés dans l'interface. L'utilisateur doit les connaître par coeur ou consulter le code. Les tooltips des boutons de la Toolbar montrent les raccourcis mais uniquement au survol, et seulement pour les actions qui ont un bouton.

## Comportement souhaité

Un bouton `?` dans la barre de la timeline (ou la toolbar) qui affiche un **overlay/popup** avec la liste complète des raccourcis clavier, organisée par catégorie.

## Raccourcis existants à documenter

### Viewport 3D
| Touche | Action |
|--------|--------|
| F | Toggle Free Camera / Scroll Camera |
| T | Frame Selected (zoom sur l'objet sélectionné) — free camera uniquement |
| H | Home (vue initiale) — free camera uniquement |
| G | Move (Grab) |
| R | Rotate |
| S | Scale |
| Ctrl+M | Mirror |
| I | Capturer keyframe caméra |
| E | Eye Waypoint (hors mode courbe) / Extrude (en mode courbe) |
| V | Visual Keyframe |
| A | Select All |
| Alt+A | Deselect All |
| B | Box Select |
| Ctrl+RMB | Lasso Select |
| Shift+D | Duplicate |
| Delete | Supprimer |
| Shift+C | Toggle mode édition courbe |
| Alt+H | Toggle visibilité |
| Alt+L | Toggle verrouillage |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+S | Save scene |
| Escape | Annuler mode courant / Sortir du mode courbe |

### Timeline (quand souris dans la timeline)
| Touche | Action |
|--------|--------|
| G | Grab diamant sélectionné |
| X / Delete | Supprimer keyframe sélectionné |
| Shift+D | Dupliquer keyframe |
| Ctrl+C | Copier keyframe(s) |
| Ctrl+V | Coller keyframe(s) |
| T | Menu easing (si diamant sélectionné) |
| P | Ajouter point Eye Path |
| W | Ajouter dwell |
| Home | Reset zoom |
| Scroll | Zoom horizontal |
| MMB drag | Pan horizontal |

## Implémentation

- Bouton `?` dans la Toolbar ou la barre de la timeline
- Popup/overlay avec les catégories ci-dessus
- Style cohérent avec le reste de l'UI (dark theme, monospace)
- Fermeture : clic extérieur ou Escape

## Complexité : Faible
