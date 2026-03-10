# Phase Element Tracks — Keyframes de Transform Per-Element

## Objectif

Permettre de positionner chaque objet sélectionnable (texte, neon, card, futurs composants) **à des positions différentes selon le frame de la timeline**, avec interpolation automatique entre les keyframes. L'eye a un traitement spécial via des waypoints Yuka.

## Décisions prises

- **Opacity** : fade in/out automatique via TextElementLayout — pas de keyframes d'opacity
- **Card** : test CSS3DRenderer pour intégrer la card dans l'espace 3D (boutons HTML cliquables)
- **Gizmo vs interpolation** : pause automatique de l'interpolation quand le gizmo est attaché (même pattern que Yuka)
- **Maintien de position** : deux méthodes — (1) avancer le scrubber + I pour re-capturer, (2) Ctrl+D sur un losange pour dupliquer le keyframe puis le slider
- **Éléments concernés** : textes, neon(s), card, futurs composants (wallSkill...). Eye = waypoints Yuka.

## Workflow utilisateur visé

### Exemple : texte qui entre par la droite, reste, sort par le haut

```
Frame:  0 ─── 30 ─────── 60 ── 110 ─────── 140
              KF-A        KF-B   KF-B'       KF-C
              (droite,    (centre) (centre,    (haut,
               hors écran)         copie)      hors écran)

              entrée →    reste en place →    sortie ↑
```

1. **F** (free camera) → scrub à **frame 30**
2. Sélectionner le titre → **G** → le placer à droite hors écran
3. **I** → keyframe A inséré (position de départ)
4. Scrub à **frame 60** → sélectionner le titre → **G** → le placer au centre
5. **I** → keyframe B inséré (position d'arrivée)
6. **Pour maintenir la position** :
   - Méthode 1 : scrub à frame 110 → **I** (re-capture la même position)
   - Méthode 2 : **Ctrl+D** sur le losange B dans la timeline → slider le doublon à frame 110
7. Scrub à **frame 140** → sélectionner le titre → **G** → le placer en haut hors écran
8. **I** → keyframe C inséré (position de sortie)
9. Scrub entre 30–140 → le titre suit le chemin A→B→B'→C avec interpolation
10. Changer d'avis ? Scrub au keyframe voulu → sélectionner → repositionner → **I** → remplace

---

## Architecture actuelle (ce qui existe)

### Positionnement des textes

Les textes utilisent `TextElementLayout` — un système de **3 positions figées** :
- `startX/Y/Z` → position d'entrée (hors écran)
- `endX/Y/Z` → position stable
- `exitX/Y/Z` → position de sortie

Avec 5 phases d'animation : `avant → entrée → stable → sortie → après`

La fonction pure `computeElementState(layout, frame)` retourne `{ x, y, z, opacity }`.

**Problème** : on ne peut pas ajouter de positions intermédiaires. C'est un système "2 keyframes + exit".

### Positionnement du neon

Position fixe via `neonBandsMachine.context.positionX/Y/Z`. Pas de changement dans le temps.

### Positionnement de la card

Position en % (`cardPosTop/Left`). Opacity via `computeCardState(frame, start, end)`. Pas de keyframes de position.

### TimelinePanel (UI)

5 tracks : `camera`, `title`, `subtitle`, `card`, `visual`
- Title/Subtitle → clips avec edges draggables (scrollStart/End, exitStart/End)
- Camera → diamants keyframes draggables
- Card → clip simple (pas draggable)
- Visual → clips avec edges + slide

### Touche I (actuelle)

Insère un **camera keyframe** interpolé au frame actuel. N'interagit pas avec la sélection d'objets.

---

## Nouveau système : Element Transform Tracks

### Structure de données

```typescript
// Un keyframe de transform pour un élément
interface ElementTransformKf {
  frame: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number; // uniforme
  easing: EasingType; // interpolation VERS le prochain keyframe
}

// Stockage dans timelineMachine.context
elementTracks: Record<string, ElementTransformKf[]>
// Exemple : { title: [...], subtitle: [...], neon: [...] }
```

### Interaction avec les systèmes existants

**Principe de superposition** : les element tracks sont **optionnels** et **override** la position quand ils existent.

| Élément | Sans element track | Avec element track |
|---------|-------------------|-------------------|
| **Title** | computeElementState(layout, frame) → position + opacity | Position/rotation/scale des keyframes interpolés. Opacity toujours de computeElementState |
| **Subtitle** | Pareil | Pareil |
| **Neon** | Position fixe de neonBandsMachine | Position/rotation/scale des keyframes interpolés |
| **Card** | cardPosTop/Left fixe + opacity de computeCardState | Position des keyframes. Opacity toujours de computeCardState |
| **Eye** | Yuka steering autonome | **Waypoints** — change le seek target de Yuka (pas de contrôle direct) |

**L'opacity/visibilité reste gérée par le système existant.** Les element tracks ne contrôlent que les transforms (position, rotation, scale).

### Fonction d'interpolation

```typescript
function computeElementTrackTransform(
  keyframes: ElementTransformKf[],
  frame: number,
): { position: {x,y,z}; rotation: {x,y,z}; scale: number } | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0]; // position fixe

  // Avant le premier KF → maintenir la position du premier
  if (frame <= keyframes[0].frame) return keyframes[0];

  // Après le dernier KF → maintenir la position du dernier
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) return last;

  // Trouver les deux KF encadrant
  // Lerp position + scale, lerp rotation (euler)
  // Appliquer easing du KF source
}
```

### Computed dans timelineMachine

Ajouter au `recompute()` :

```typescript
computed: {
  ...existant,
  elementTransforms: Record<string, ComputedElementTransform | null>
  // Ex: { title: { position: {x,y,z}, rotation: {x,y,z}, scale: 1.0 }, ... }
}
```

Calculé à chaque changement de frame ou de keyframes.

---

## Touche I — Nouveau comportement

Aujourd'hui : I insère un camera keyframe (toujours).

**Nouveau** : I a un comportement contextuel :

| Contexte | Comportement de I |
|----------|------------------|
| Aucun objet sélectionné | Insère un camera keyframe (comportement actuel) |
| Un objet 3D sélectionné | Insère un element transform keyframe pour cet objet |

**Quand un objet est sélectionné et I est pressé** :
1. Lire `selectedId` du SelectionSystem
2. Lire la position/rotation/scale **actuelle** de l'Object3D dans la scène
3. Chercher si un keyframe existe déjà au frame actuel pour cet élément
   - Oui → le **remplacer**
   - Non → en **ajouter** un nouveau
4. Envoyer à timelineActor : `ADD_ELEMENT_KF { elementId, keyframe }`
5. Feedback visuel (notification "KF inserted at frame X for title")

**Où intercepter I ?**

Actuellement I est géré à **deux endroits** :
- `TimelinePanel.tsx` (lignes 319-338) — insère camera KF interpolé
- `SceneRenderer.tsx` — insère camera KF en free mode

On doit modifier ces handlers pour vérifier d'abord si un objet est sélectionné.

---

## Eye Waypoints (Cas spécial)

L'eye ne peut pas être positionné directement (Yuka contrôle sa position). On utilise des **waypoints** :

```typescript
interface EyeWaypoint {
  frame: number;
  target: { x: number; y: number; z: number }; // position cible
  // Yuka navigue vers ce point puis orbite autour
}
```

Quand le frame change et qu'on passe un waypoint :
1. Calculer le seek target interpolé entre waypoints
2. Modifier les boundaries de SoftBoundaryBehavior pour centrer la zone sur le target
3. Yuka navigue naturellement vers la nouvelle zone

**Implémentation** : ajouter un `WanderTarget` behavior ou simplement déplacer le centre des boundaries en fonction du waypoint actif.

---

## Sous-phases d'implémentation

### Sous-phase 1 : Data Model dans timelineMachine

**Fichiers impactés :**
- `machines/timelineMachine.ts`

**Changements :**
- Ajouter `ElementTransformKf` interface
- Ajouter `elementTracks: Record<string, ElementTransformKf[]>` au context (défaut `{}`)
- Ajouter `computeElementTrackTransform()` fonction pure
- Ajouter au `recompute()` : calcul de `computed.elementTransforms`
- Ajouter events :
  - `ADD_ELEMENT_KF { elementId: string, keyframe: ElementTransformKf }`
  - `UPDATE_ELEMENT_KF { elementId: string, index: number, keyframe: ElementTransformKf }`
  - `DELETE_ELEMENT_KF { elementId: string, index: number }`
  - `IMPORT_ELEMENT_TRACKS { tracks: Record<string, ElementTransformKf[]> }`

### Sous-phase 2 : useTimeline + hook

**Fichiers impactés :**
- `hooks/useTimeline.ts`

**Changements :**
- Exposer `elementTracks`, `computed.elementTransforms`
- Exposer actions : `addElementKf()`, `updateElementKf()`, `deleteElementKf()`, `importElementTracks()`

### Sous-phase 3 : Touche I — Insertion contextuelle

**Fichiers impactés :**
- `scene/SceneRenderer.tsx` (handler keydown I)
- `components/timeline/TimelinePanel.tsx` (handler keydown I)

**Changements :**
- Dans SceneRenderer (mode free camera) :
  - Si un objet est sélectionné → lire position/rotation/scale de l'Object3D → envoyer `ADD_ELEMENT_KF`
  - Sinon → comportement actuel (camera keyframe)
- Dans TimelinePanel :
  - Pareil — vérifier `selectionActor` pour `selectedId`
  - Si sélectionné → `ADD_ELEMENT_KF`, sinon → camera KF

### Sous-phase 4 : Appliquer l'interpolation en runtime

**Fichiers impactés :**
- `scene/SceneRenderer.tsx` (subscription timelineActor + animation loop)
- `scene/scrollText.ts` (optionnel — expose des setters pour override de position)

**Changements :**

Dans la subscription au timelineActor, après le sync des systèmes existants :
```typescript
const et = c.computed.elementTransforms;

// Override positions des textes si element tracks existent
if (et.title) {
  // Setter pour override la position du titre dans ScrollTextSystem
  scrollText?.overridePosition('title', et.title.position, et.title.rotation, et.title.scale);
}
if (et.subtitle) {
  scrollText?.overridePosition('subtitle', et.subtitle.position, et.subtitle.rotation, et.subtitle.scale);
}

// Override position du neon
if (et.neon) {
  neonBands?.getGroup().position.set(et.neon.position.x, et.neon.position.y, et.neon.position.z);
  neonBands?.getGroup().rotation.set(et.neon.rotation.x, et.neon.rotation.y, et.neon.rotation.z);
  neonBands?.getGroup().scale.setScalar(et.neon.scale);
}
```

**Point critique** : il faut que l'override de position se fasse **après** le `scrollText.update()` et le `syncFromState()` pour ne pas être écrasé par computeElementState. Deux options :
- **Option A** : Ajouter une méthode `overridePosition()` à ScrollTextSystem qui est appliquée dans `update()` après computeElementState
- **Option B** : Appliquer l'override dans la boucle d'animation de SceneRenderer, après `scrollText.update()`

→ **Option B est plus simple** — on applique directement sur les meshes dans la boucle d'animation.

### Sous-phase 5 : Eye Waypoints

**Fichiers impactés :**
- `machines/timelineMachine.ts` (ajouter `eyeWaypoints`)
- `scene/SceneRenderer.tsx` (appliquer les waypoints sur Yuka boundaries)
- `systems/SoftBoundaryBehavior.ts` (setCenter method)

**Changements :**
- Ajouter `eyeWaypoints: EyeWaypoint[]` au context
- Ajouter `computeEyeWaypointTarget(waypoints, frame)` — interpole le target
- Dans SceneRenderer, quand le frame change : si un waypoint target change, déplacer le centre des boundaries de SoftBoundaryBehavior
- L'eye navigue naturellement vers la nouvelle zone grâce au steering

### Sous-phase 6 : Ctrl+D — Dupliquer un keyframe

**Fichiers impactés :**
- `components/timeline/TimelinePanel.tsx`

**Changements :**
- Quand un diamant de transform est survolé et qu'on appuie sur **Ctrl+D** :
  - Lire le keyframe à cet index
  - Créer une copie avec `frame + 10` (décalé de 10 frames)
  - Envoyer `ADD_ELEMENT_KF`
  - Le nouveau diamant apparaît et peut être drag-slidé sur la piste

### Sous-phase 7 : Timeline UI — Tracks per-element + diamants

**Fichiers impactés :**
- `components/timeline/types.ts`
- `components/timeline/constants.ts`
- `components/timeline/TimelinePanel.tsx`

**Changements :**
- Ajouter des TrackId pour les nouvelles tracks (ex: `'neon'`, `'eye'`)
- Afficher les keyframes comme des diamants sur les tracks existantes (title, subtitle) et les nouvelles (neon, eye)
- Permettre le drag des diamants pour changer le frame d'un keyframe
- Touche D sur un diamant survolé → supprimer le keyframe
- Touche Ctrl+D sur un diamant survolé → dupliquer le keyframe (sous-phase 6)

Pour title et subtitle, les diamants de transform s'affichent **sur la même track** que les clips existants. Pour neon et eye, on ajoute de nouvelles tracks.

### Sous-phase 8 : CSS3DRenderer — Card dans l'espace 3D (test)

**Fichiers impactés :**
- `scene/SceneRenderer.tsx` (ajout CSS3DRenderer)
- `components/ScrollCard.tsx` (conversion en CSS3DObject)

**Changements :**
- Ajouter un `CSS3DRenderer` en overlay synchronisé avec le WebGLRenderer
- Convertir la ScrollCard en `CSS3DObject` positionnée dans l'espace 3D
- Les boutons HTML (View CV, GitHub, etc.) restent cliquables
- La card peut être sélectionnée/déplacée avec le gizmo
- Ses keyframes de transform sont en coordonnées 3D (comme les textes/neon)

**Note** : c'est un test exploratoire. Si le CSS3DRenderer pose trop de problèmes (z-fighting, perf), on revient à l'approche HTML overlay avec keyframes en % viewport.

### Sous-phase 9 : Import/Export

**Fichiers impactés :**
- `machines/timelineMachine.ts` (IMPORT/EXPORT events)
- DevPanel ou TimelinePanel (boutons)

**Changements :**
- `IMPORT_ELEMENT_TRACKS` + `EXPORT` inclut les element tracks
- Les element tracks sont inclus dans le `IMPORT_TIMELINE` / export timeline existant

---

## Résumé des fichiers impactés

| Fichier | Sous-phase | Action |
|---------|-----------|--------|
| `machines/timelineMachine.ts` | 1, 5, 7 | Data model + compute + events |
| `hooks/useTimeline.ts` | 2 | Exposer actions + state |
| `scene/SceneRenderer.tsx` | 3, 4, 5 | Touche I contextuelle + runtime application + waypoints |
| `components/timeline/TimelinePanel.tsx` | 3, 6 | Touche I + diamants sur tracks |
| `components/timeline/types.ts` | 6 | Nouveaux TrackId |
| `components/timeline/constants.ts` | 6 | Couleurs + labels |
| `scene/scrollText.ts` | 4 | (optionnel) expose mesh refs pour override |
| `systems/SoftBoundaryBehavior.ts` | 5 | setCenter pour waypoints eye |

---

## Vérifications

1. **F → scrub à frame 30 → clic titre → G → déplacer à droite → I** → keyframe A inséré
2. **Scrub à frame 60 → clic même titre → G → placer au centre → I** → keyframe B
3. **Scrub entre 30-60** → le titre glisse de la droite vers le centre (interpolation)
4. **Ctrl+D sur le losange B** → un doublon B' apparaît → le slider à frame 110
5. **Scrub à frame 140 → clic titre → G → placer en haut → I** → keyframe C
6. **Scrub 30→140** → le titre fait le chemin complet A→B→B'→C
7. **Scrub à frame 30 → clic titre → re-déplacer → I** → le keyframe A est mis à jour
8. **D sur un diamant survolé** → supprime le keyframe
9. **Neon** : pareil avec le neon (G/R/S + I)
10. **Eye** : waypoint déplace la zone de navigation Yuka
11. **CSS3DRenderer** : la card est dans l'espace 3D, boutons cliquables, gizmo fonctionne
12. **Gizmo** : l'interpolation est pausée pendant la manipulation gizmo
13. **Export/Import** → les element tracks sont sauvegardés et restaurés
14. `pnpm type-check` : 0 erreurs
