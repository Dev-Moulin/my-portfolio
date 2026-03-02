# Plan d'Implementation par Phases

## Vue d'ensemble

4 phases, chacune livrable et testable independamment.
Chaque phase construit sur la precedente.

---

## Phase 1 : Camera libre + capture keyframe

**Objectif :** Remplacer le workflow slider par la navigation visuelle

### Etapes

1. **Installer `camera-controls`**
   - `pnpm add camera-controls -F @portfolio/overmind-3d`

2. **Integrer dans SceneRenderer.tsx**
   - Creer l'instance CameraControls dans le setup
   - Appeler `controls.update(delta)` dans la boucle RAF
   - Demarrer avec `controls.enabled = false` (mode scroll-driven par defaut)

3. **Toggle mode camera** (touche `F`)
   - Event listener clavier dans SceneRenderer
   - Mode free : `controls.enabled = true`, `camKeyframes.setEnabled(false)`
   - Mode scroll : `controls.enabled = false`, `camKeyframes.setEnabled(true)`
   - Indicateur visuel dans le DevPanel ("Mode: Free / Scroll-driven")

4. **Bouton "Capture Keyframe"**
   - Lire `controls.getPosition()` + `controls.getTarget()` + `camera.fov`
   - Envoyer `ADD_KEYFRAME` au cameraKeyframeActor (machine existante)
   - Input pour choisir le progress (pre-rempli avec le progress courant)

5. **Tester**
   - Naviguer librement avec la souris
   - Capturer des keyframes
   - Revenir en mode scroll-driven et verifier que les keyframes fonctionnent

### Fichiers touches
- `SceneRenderer.tsx` (integration camera-controls)
- `DevControlPanel.tsx` (indicateur mode + bouton capture)
- `package.json` (ajout dep camera-controls)

### Ce qui ne change PAS encore
- Les 3 machines XState restent separees
- Le DevPanel garde ses onglets
- Le pipeline scroll ne change pas

---

## Phase 2 : Timeline visuelle (lecture seule)

**Objectif :** Voir d'un coup d'oeil toute la choreographie

### Etapes

1. **Creer `TimelinePanel.tsx`**
   - Composant fixe en bas du viewport (position: fixed, bottom: 0)
   - Bouton toggle pour monter/descendre ou reduire
   - Hauteur : ~120px deplie, icone seule quand replie

2. **Pistes de lecture (read-only)**
   - Track "Camera" : losanges aux positions `keyframe.at`
   - Track "Title" : barre coloree de scrollStart → exitEnd
   - Track "Subtitle" : barre coloree decalee
   - Track "Card" : barre coloree de CARD_SCROLL_START → CARD_SCROLL_END

3. **Curseur scrub**
   - Ligne verticale rouge a la position progress actuelle
   - Draggable : quand on drag, ca scroll la page (ou envoie UPDATE_SCROLL directement)

4. **Marqueurs de dwell**
   - Bandes verticales semi-transparentes aux positions de dwell
   - Tooltip au hover avec la duree

5. **Lire les donnees depuis les machines existantes**
   - Pas besoin de timelineMachine encore — on lit les 3 actors existants
   - `useCameraKeyframes()` → positions des losanges
   - `useScrollText()` → positions des barres
   - `useScrollCard()` → position de la barre card

### Fichiers crees
- `components/TimelinePanel.tsx`
- `components/TimelineTrack.tsx`
- `components/TimelineCursor.tsx`

### Fichiers modifies
- `OvermindOverlay.tsx` (rendre TimelinePanel)

### Ce qui ne change PAS encore
- Les machines XState restent separees
- Le DevPanel garde ses onglets (mais ScrollText/CamPath/Card deviennent moins utiles)

---

## Phase 3 : Unification timelineMachine + unites absolues

**Objectif :** Un seul actor, progress en unites absolues (0→N), dwells editables

### 3A. Unites absolues (frames) au lieu de ratio 0→1

Le scroll progress passe d'un ratio 0→1 a des **unites absolues** (0→N).
Chaque "frame" correspond a un step de scroll. La page s'allonge proportionnellement.
Plus intuitif pour editer (comme les frames dans Blender).

1. **Definir la frame max** dans `timelineMachine.context.totalFrames` (ex: 150)
2. **Convertir le scroll ratio** (0→1 du browser) en frame (0→totalFrames)
   - `frame = scrollRatio * totalFrames`
3. **Tous les keyframes/clips** utilisent des frames au lieu de ratios
   - `keyframe.at: 45` au lieu de `0.300`
   - `titleLayout.scrollStart: 0, scrollEnd: 22` au lieu de `0.0, 0.15`
4. **La page s'allonge** : hauteur du body = `totalFrames * scrollStep` px
5. **Migration des valeurs** : multiplier toutes les valeurs existantes par totalFrames

### 3B. Creer `timelineMachine.ts`

- Contexte : `tracks[]`, `dwells[]`, `totalFrames`, `currentFrame`, `computed`
- Action `UPDATE_FRAME` : calcule TOUS les etats en une passe
  - Compute camera (interpolation keyframes)
  - Compute texte (5 phases par element)
  - Compute card (opacity + translateX)

### 3C. Creer `useTimeline.ts`

- Hook avec selecteurs pour chaque type de computed
- `useTimelineCamera()`, `useTimelineText()`, `useTimelineCard()`

### 3D. Dwells editables

Les dwells passent de constantes hardcodees vers `timelineMachine.context.dwells[]`.

1. **Stockage** : `dwells: { at: number, duration: number }[]` dans le contexte
2. **Events machine** :
   - `ADD_DWELL` : ajoute un dwell a la frame donnee
   - `DELETE_DWELL` : supprime un dwell par index
   - `UPDATE_DWELL` : modifie position/duree d'un dwell
3. **Timeline UI** :
   - Les dwell markers deviennent interactifs (hover, drag horizontal)
   - Raccourci **W** = ajouter un dwell a la position du curseur
   - **Shift+D** sur un dwell survole = supprimer
4. **remapProgress()** lit les dwells depuis l'actor au lieu de constantes

### 3E. Unification du raccourci I (insert keyframe)

Un seul raccourci **I** avec comportement contextuel :
- **Mode free camera** : capture les valeurs REELLES de la camera (comme K actuel)
- **Mode scroll** : insere une keyframe INTERPOLEE a la position du curseur
- Supprimer le raccourci K (remplace par I)

### 3F. Migration progressive

1. timelineMachine coexiste avec les 3 anciens actors
2. SceneRenderer lit depuis timelineMachine au lieu des anciens
3. ScrollCard lit depuis timelineMachine
4. App.tsx : scrollRatio → frame conversion, dwells depuis actor
5. Supprimer les 3 anciens actors et leurs machines/hooks

### 3G. Supprimer le double-lerp

- Les systemes Three.js utilisent directement `computed` (plus de lerp interne)
- Le seul smoothing est au niveau du scroll (browser natif ou Lenis si ajoute)

### Fichiers crees
- `machines/timelineMachine.ts`
- `hooks/useTimeline.ts`

### Fichiers modifies
- `applicationMachine.ts` (remplacer 3 spawns par 1)
- `useOvermind.ts` (exposer timelineActor)
- `OvermindOverlay.tsx` (ScrollBridge → 1 seul send)
- `SceneRenderer.tsx` (lire computed, unifier I/K en I)
- `ScrollCard.tsx` (lire computed)
- `App.tsx` (scrollRatio → frame, dwells depuis actor, hauteur page dynamique)
- `TimelinePanel.tsx` (dwells interactifs, raccourcis W/Shift+D)

### Fichiers supprimes
- `machines/scrollTextMachine.ts`
- `machines/cameraKeyframeMachine.ts`
- `machines/scrollCardMachine.ts`
- `hooks/useScrollText.ts`
- `hooks/useCameraKeyframes.ts`
- `hooks/useScrollCard.ts`

---

## Phase 4 : Regroupement onglets + Timeline interactive

**Objectif :** UX finale — moins d'onglets, timeline editable

### Etapes

1. **Regrouper les onglets DevPanel**
   - Visual = Bloom + Lighting + PBR + Materials (sous-sections depliables)
   - Scene = Model + position manuelle
   - Effects = Neon + Reveal + Steering
   - Supprimer ScrollText, CamPath, Card (absorbes par Timeline)
   - 14 → 6 onglets (Presets, Visual, Scene, Effects, Perf + Timeline en panneau separe)

2. **Timeline interactive**
   - Drag les bords des clips pour ajuster timings
   - Drag les losanges camera pour repositionner les keyframes
   - Click droit → menu contextuel (delete keyframe, edit easing, etc.)
   - Double-click sur une piste → ajouter un clip/keyframe

3. **Import/Export JSON de la timeline complete**
   - Un seul JSON contenant tracks + dwells + tous les keyframes
   - Remplace les 3 imports/exports separes actuels

4. **Hover details**
   - Hover sur un clip → tooltip avec les timings exacts et les valeurs
   - Hover sur un losange camera → tooltip avec pos/lookAt/fov

---

## Ordre de priorite

```
Phase 1 (camera libre)     ←── le plus gros gain de productivite immediat
Phase 2 (timeline lecture)  ←── visibilite d'ensemble
Phase 3 (unification)      ←── nettoyage technique, performance
Phase 4 (onglets + edit)   ←── polish UX
```

La Phase 1 est la plus impactante car elle elimine le workflow slider qui est le point de friction principal. On peut commencer par la sans toucher au reste.

---

## Risques et points d'attention

| Risque | Mitigation |
|--------|-----------|
| camera-controls conflit avec la boucle RAF existante | Tester l'integration incrementalement |
| timelineMachine trop lourde (calcul a chaque scroll) | Profiler, memo/cache si besoin |
| Perte des presets/configs actuels pendant la migration | Garder un export JSON avant migration |
| Timeline UI complexe a implementer | Commencer read-only (Phase 2) avant interactif (Phase 4) |
| Mobile : camera libre inutile | Detecter mobile, ne pas exposer le mode free |
