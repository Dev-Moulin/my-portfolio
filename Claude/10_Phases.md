# Phases — Portfolio Overmind 3D

Récapitulatif de toutes les tâches identifiées, classées par priorité.

---

## Phase 1 — Refactor Custom Scale → vrai comportement Blender ✓

**Statut : TERMINÉ**

### Problème actuel

L'implémentation actuelle (S maintenu + distance souris) ne fonctionne pas :
- La caméra continue de bouger au lieu de scaler l'objet
- **Cause confirmée** : `camera-controls` v3.1.2 avec `enabled = false` + `update(delta)`
  continue d'appliquer le damping/inertie ([three.js #19917](https://github.com/mrdoob/three.js/issues/19917),
  [camera-controls docs](https://yomotsu.github.io/camera-controls/classes/CameraControls))
- Le mode "S maintenu" pose aussi des problèmes de key repeat navigateur
- Les variables `lastMouseClientX/Y` peuvent être à (0,0) si la souris n'a pas bougé

### Solution : passer au vrai mode Blender (modal)

Ref : [Blender Scale Manual](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/scale.html)

Dans Blender, S est un **appui unique** (pas maintenu) qui entre dans un **mode modal** :
1. **S appui unique** → entre en mode scale
2. **Mouvement souris** (libre, sans clic ni touche) → éloigner du pivot = agrandir, rapprocher = rétrécir
3. **Clic gauche** ou **Enter** → confirme le scale
4. **Clic droit** ou **Escape** → annule et restaure le scale initial

Avantages vs l'implémentation actuelle :
- Pas de problème de key repeat (appui unique)
- Pas de conflit camera-controls (mode modal clair, caméra gelée)
- Pas besoin de `lastMouseClientX/Y` (le 1er mousemove après S initialise)
- Standard connu de tous les utilisateurs 3D
- Plus confortable (main libre pendant le scale)

### Étape 0 — Diagnostics console (temporaire)

Avant de refactorer, ajouter des `console.warn` pour confirmer le diagnostic :
- [ ] Log dans le handler S : `selectedId`, `lastMouseClient`, `enterCustomScale result`
- [ ] Log dans `enterCustomScale()` : paramètres d'entrée, `initialDistance`, `centerScreen`
- [ ] Log dans `onCustomScaleMouseMove()` : `ratio`, `newScale`
- [ ] Log dans `confirmCustomScale()` / `cancelCustomScale()`
- [ ] Tester et observer la console → confirmer où le flux se casse

### Étape 1 — Refactor `selectionSystem.ts`

Transformer le custom scale en **mode modal** :
- [ ] `enterCustomScale()` → ne prend plus de `clientX/clientY` en paramètre
- [ ] Au lieu de calculer `initialDistance` immédiatement, attendre le **1er mousemove**
  pour capturer `centerScreen` et `initialDistance` (lazy init)
- [ ] `confirmCustomScale()` → appelé par clic gauche / Enter (pas keyup S)
- [ ] `cancelCustomScale()` → appelé par clic droit / Escape
- [ ] Supprimer le listener keyup S
- [ ] Ajouter listener `mousedown` (clic gauche = confirme, clic droit = annule)
- [ ] Ajouter listener `keydown` interne (Enter = confirme, Escape = annule)

### Étape 2 — Refactor `SceneRenderer.tsx`

- [ ] Handler S keydown : appui unique → `enterCustomScale()` (sans coordonnées)
- [ ] Supprimer le listener `keyup` pour S
- [ ] Supprimer le tracker `lastMouseClientX/Y` (plus nécessaire)
- [ ] Guard `cameraControls.update(delta)` : skip pendant `isCustomScaling()` (déjà fait)
- [ ] Guard `draggingChanged` : désactiver caméra inconditionnellement (déjà fait)

### Étape 3 — Vérification

- [ ] Type-check OK
- [ ] Test : sélectionner model → S → éloigner souris → agrandir → clic gauche → scale persiste
- [ ] Test : sélectionner neon → S → rapprocher souris → rétrécir → clic gauche → scale persiste
- [ ] Test : S → Escape → scale revient à la valeur initiale
- [ ] Test : S → clic droit → scale annulé
- [ ] Test : Ctrl+Z après scale → undo fonctionne
- [ ] Test : guide line jaune visible pendant le scale
- [ ] Test : tab switch → annulation automatique (blur handler)
- [ ] Retirer les console.warn temporaires

---

## Phase 2 — Card : mêmes caractéristiques que Title/Subtitle ✓

**Statut : TERMINÉ**

La card a maintenant le même cycle de vie que title/subtitle :

- [x] Phases enter/steady/exit avec CardLayout 5 phases
- [x] Clip bar avec 3 phases + edge handles + resize dans la timeline
- [x] Diamants de keyframes visuels sur la piste card
- [x] Opacité 0→100% avec transition d'entrée/sortie
- [x] Shift+D duplique la card → instance indépendante avec sa propre piste timeline
- [x] Portails React multiples (`Map<string, HTMLDivElement>`)
- [x] Undo/redo complet pour les instances card
- [x] Scene save/load pour les instances card

---

## Phase 3 — Fix sélection Card par clic ✓

**Statut : TERMINÉ**

- [x] Sélection de la card par clic dans le viewport
- [x] Le proxy mesh invisible reçoit les clics malgré l'overlay CSS3D

---

## Phase 4 — Fix boutons Card en mode F (sélection) ✓

**Statut : TERMINÉ**

- [x] `pointerEvents` désactivés sur la card quand sélectionnée avec gizmo actif
- [x] `pointerEvents` restaurés quand la card est désélectionnée

---

## Phase 5 — Alt+H sans sélection = Afficher tous les objets cachés ✓

**Statut : TERMINÉ**

- [x] Alt+H sans sélection → rend visibles tous les objets cachés (show all)
- [x] Alt+H avec sélection → toggle visibilité (comportement existant)

---

## Phase 6 — HUD rotation (degrés) ✓

**Statut : TERMINÉ**

- [x] Overlay HUD montrant les degrés X/Y/Z en temps réel pendant le drag du gizmo rotate
- [x] Disparaît quand le drag se termine

---

## Phase 7 — Multi-sélection (Ctrl+Clic) ✓

**Statut : TERMINÉ**

- [x] Ctrl+Clic pour ajouter/retirer un objet de la sélection
- [x] Outline sur tous les objets sélectionnés
- [x] Les gizmos s'appliquent à tous les objets sélectionnés (pivot commun)
- [x] SelectionSystem gère un Set<string> avec multi-sélection
- [x] Multi-translate/rotate/scale propagé à toutes les instances

---

## Phase 8 — Cascade Neon : Array Circulaire + Shrinkwrap Cylindre ✓

**Statut : TERMINÉ**

- [x] `createCylindricalBandGeometry()` — section verticale courbée sur cylindre, arc→depth orientés radialement
- [x] `NeonSyncConfig` — refactoring signature (12+ params → objet config unique)
- [x] `buildArray()` — N copies via sous-Groups THREE.js, matériaux partagés
- [x] Auto-fill : `floor(2π × rayon / largeurTotale)`
- [x] Direction outward/inward pour arc→depth
- [x] 5 champs context + events dans neonBandsMachine
- [x] UI "Cylinder Array" dans NeonTab
- [x] Rétrocompat sceneSaveFile pour vieux saves
- [x] Undo/redo + instances + scene save/load

---

## Phase 9 — Architecture Composants ✓

**Statut : TERMINÉ**

Tous les éléments (title, subtitle, card, neon, lights) sont des composants d'une bibliothèque avec cycle de vie uniforme.

- [x] ComponentDescriptor<TConfig, TExtra> + ComponentRegistry (type-erased)
- [x] 4 descriptors : neon, text, light, card
- [x] DESCRIPTOR_META centralisé (displayName, trackColor)
- [x] Cycle de vie uniforme : enter → steady → exit (via lifecycle timeline)
- [x] Copier un composant = instance indépendante avec sa propre piste timeline
- [x] Chaque instance a ses propres keyframes et transformations
- [x] Library panel (Phase 9.7) — ajout de composants en un clic
- [x] Configurateur Neon (slider 1→50 bandes + thèmes couleur)
- [x] setOpacity générique par descriptor
- [x] Scene save/load pour toutes les instances

> Note : drag & drop depuis la Library vers le viewport reste un item futur (voir [11_Blender_UX_Improvements.md](./11_Blender_UX_Improvements.md) §7).

---

## Ordre de priorité suggéré

| # | Phase | Statut |
|---|-------|--------|
| 1 | Fix Custom Scale (modal Blender) | ✓ Terminé |
| 2 | Card = Title/Subtitle (duplicable) | ✓ Terminé |
| 3 | Fix sélection Card par clic | ✓ Terminé |
| 4 | Fix boutons Card en mode F | ✓ Terminé |
| 5 | Alt+H show all | ✓ Terminé |
| 6 | HUD rotation (degrés) | ✓ Terminé |
| 7 | Multi-sélection (Ctrl+Clic) | ✓ Terminé |
| 8 | Array Circulaire + Shrinkwrap Cylindre | ✓ Terminé |
| 9 | Architecture Composants | ✓ Terminé |

> Voir aussi [11_Blender_UX_Improvements.md](./11_Blender_UX_Improvements.md) pour les améliorations UX Blender (copie multi-objets, miroir, G/R/S modal).
