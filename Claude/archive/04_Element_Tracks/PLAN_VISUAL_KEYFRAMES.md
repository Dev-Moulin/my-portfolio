# Phase — Visual Keyframes (ambiances scroll-driven)

## Concept

Ajouter une piste **"Visual"** sur la timeline qui fonctionne comme les pistes Title/Subtitle :
des **clips d'ambiance** qu'on place, redimensionne, et entre lesquels la timeline interpole automatiquement.

```
Frame:  0────────30──────60────────90──────120──────150
Visual: [  Ambiance A  ][  trans  ][  Ambiance B  ][ tr ][ Ambiance C ]
        ↑ scrollStart   ↑ exitStart                      ↑ scrollStart
                        ↑ enterEnd                        (du clip suivant)
```

Chaque ambiance capture un **snapshot** de l'etat visuel : bloom, neon, lighting, material, scene background.
Les zones de transition entre clips = interpolation lineaire (ou easing) des valeurs.

---

## Ce que chaque Visual Keyframe capture

```typescript
interface VisualKeyframe {
  // ── Identification ──
  at: number;                    // frame de debut du clip
  duration: number;              // duree du clip en frames
  enterDuration: number;         // frames de transition d'entree (fade-in depuis le precedent)
  exitDuration: number;          // frames de transition de sortie (fade-out vers le suivant)
  easing: EasingType;            // interpolation dans les transitions
  label?: string;                // nom de l'ambiance (ex: "Intro sombre", "Hero lumineux")

  // ── Bloom ──
  bloom: {
    enabled: boolean;
    color: string;
    strength: number;
    threshold: number;
    radius: number;
  };

  // ── Lighting ──
  lighting: {
    ambientIntensity: number;
    directionalIntensity: number;
    pointIntensity: number;
    exposure: number;
    hdrBoostEnabled: boolean;
    hdrBoostMultiplier: number;
  };

  // ── Material (emissive) ──
  material: {
    iris: { emissiveColor: string; emissiveIntensity: number };
    eyeRings: { emissiveColor: string; emissiveIntensity: number };
    revealRings: { emissiveColor: string; emissiveIntensity: number };
  };

  // ── Scene ──
  scene: {
    backgroundColor: string;
  };

  // ── Neon Bands (global seulement — pas par-band, trop complexe) ──
  neon: {
    flowSpeed: number;
    flowEnabled: boolean;
    globalIntensity: number;
  };
}
```

> **Note** : On ne capture pas les positions/tailles neon (positionX, scale, etc.) ni les configs par-band
> car c'est trop granulaire et rarement change au scroll.
> On se concentre sur les valeurs **visuellement impactantes** et **interpolables**.

---

## Architecture

### Etape 1 — Types + stockage dans timelineMachine

**Fichier** : `machines/timelineMachine.ts`

- Ajouter `VisualKeyframe` au contexte : `visualKeyframes: VisualKeyframe[]`
- Ajouter `visualEnabled: boolean` (toggle global, comme `cameraEnabled`)
- Events CRUD : `ADD_VISUAL_KF`, `UPDATE_VISUAL_KF`, `DELETE_VISUAL_KF`, `IMPORT_VISUAL_KFS`
- Ajouter dans `RESTORE_DEFAULTS` les valeurs par defaut

### Etape 2 — `computeVisualState()`

**Fichier** : `machines/timelineMachine.ts` (a cote de `computeCameraState`)

Meme pattern que `computeCameraState` mais adapte aux clips :

```typescript
function computeVisualState(
  keyframes: VisualKeyframe[],
  frame: number
): ComputedVisualState | null
```

Logique :
1. Trouver le clip actif (le clip dont `at <= frame < at + duration`)
2. Si on est dans la zone `enterDuration` → interpoler depuis le clip precedent
3. Si on est dans la zone `exitDuration` → interpoler vers le clip suivant
4. Si on est au milieu → retourner les valeurs du clip tel quel
5. Si entre deux clips (gap) → pas de visual override (les machines gardent leur etat)

Pour les couleurs (hex) : conversion hex→rgb, lerp, reconversion rgb→hex.
Pour les booleens (`enabled`, `flowEnabled`) : snap au milieu de la transition (50%).

### Etape 3 — Hook `useTimeline` expose les visual keyframes

**Fichier** : `hooks/useTimeline.ts`

Ajouter :
- `visualKeyframes`, `visualEnabled`
- `setVisualEnabled`, `addVisualKeyframe`, `updateVisualKeyframe`, `deleteVisualKeyframe`
- `importVisualKeyframes`

### Etape 4 — Application aux machines (SceneRenderer ou bridge)

**Fichier** : `components/SceneRenderer.tsx` ou nouveau `systems/visualBridge.ts`

A chaque frame, si `visualEnabled` :
1. Appeler `computeVisualState(visualKeyframes, currentFrame)`
2. Si resultat non-null → envoyer les valeurs aux machines :
   - `bloomActor.send({ type: 'UPDATE_STRENGTH', value: ... })` etc.
   - `lightingActor.send({ type: 'UPDATE_AMBIENT_INTENSITY', value: ... })` etc.
   - `materialActor.send({ type: 'UPDATE_GROUP_EMISSIVE_COLOR', group: 'iris', color: ... })` etc.
   - `sceneActor.send({ type: 'SET_BACKGROUND_COLOR', color: ... })`
   - `neonBandsActor.send(...)` etc.

> **Important** : Quand `visualEnabled` est actif, les visual keyframes "overrident" les machines.
> Le DevPanel continue de fonctionner (pour ajuster manuellement), mais au prochain scroll-frame
> les valeurs sont recrasees par le visual state. C'est le meme pattern que camera keyframes.

### Etape 5 — Piste "Visual" sur la TimelinePanel

**Fichier** : `components/timeline/TimelinePanel.tsx` + `sub-components.tsx`

- Ajouter `'visual'` a `TrackId`
- Rendre les visual keyframes comme des `ClipBar` (meme pattern que title/subtitle)
  - Phases `enterEnd` / `exitStart` redimensionnables
  - Slide pour deplacer le clip
  - Couleur : ex. `#E040FB` (violet/magenta pour distinguer)
- Track label : "Visual"
- Ajouter au `DEFAULT_TRACK_ORDER`

### Etape 6 — Capture + onglet DevPanel

**Fichier** : `components/devPanel/tabs/VisualKfTab.tsx` (nouveau)

Onglet "Visual" dans le DevPanel :
- Toggle `visualEnabled`
- Bouton "Capture Visual State" → prend un snapshot de tous les actors actuels et cree un `VisualKeyframe` a la frame courante
- Liste des visual keyframes avec edit inline (comme CamPathTab)
- Import/Export JSON

**Raccourci clavier** : `V` = capturer le visual state a la frame courante (comme `I` pour camera)

### Etape 7 — Export/Import JSON unifie

L'export JSON des visual keyframes inclut tout :
```json
{
  "visualKeyframes": [
    {
      "at": 0, "duration": 50, "enterDuration": 0, "exitDuration": 10,
      "easing": "smoothstep", "label": "Intro",
      "bloom": { "enabled": true, "color": "#00d0fa", ... },
      "lighting": { ... },
      "material": { ... },
      "scene": { "backgroundColor": "#000000" },
      "neon": { ... }
    },
    ...
  ]
}
```

---

## Ordre d'execution (sous-phases)

| # | Sous-phase | Fichiers | Complexite |
|---|-----------|----------|------------|
| 1 | Types + CRUD dans timelineMachine | `timelineMachine.ts` | Moyenne |
| 2 | `computeVisualState()` + interpolation couleurs | `timelineMachine.ts` | Elevee |
| 3 | Hook useTimeline expose visual KFs | `useTimeline.ts` | Faible |
| 4 | Bridge : appliquer le visual state aux machines | `SceneRenderer.tsx` ou nouveau bridge | Moyenne |
| 5 | Piste "Visual" sur la timeline | `TimelinePanel.tsx`, `sub-components.tsx`, `types.ts`, `constants.ts` | Moyenne |
| 6 | Onglet VisualKfTab + raccourci V + capture | nouveau `VisualKfTab.tsx`, `DevControlPanel.tsx` | Moyenne |
| 7 | Export/Import JSON | `VisualKfTab.tsx`, `useTimeline.ts` | Faible |

**Estimation** : ~5-7 sous-phases distinctes, chacune testable independamment.

---

## Risques et decisions a prendre

1. **Interpolation de couleurs** : hex → rgb → lerp → hex. Simple mais faut le coder proprement.
2. **Neon par-band** : volontairement exclu (trop complexe). On ne gere que `flowSpeed`, `globalIntensity`, `flowEnabled`.
3. **Conflit presets/situations vs visual keyframes** : Quand les deux sont actifs, les visual keyframes ont priorite (ils ecrasent). Le systeme de situations reste pour les evenements dynamiques (erreur, achat, etc.).
4. **Performance** : `computeVisualState` est appele a chaque frame. Doit rester leger (pas d'allocation, lookup rapide).
5. **Le DevPanel fonctionne toujours** : on peut ajuster manuellement, mais le scroll re-override au prochain tick.

---

## Ce qui ne change PAS

- Camera keyframes (inchanges, track separee)
- Title/Subtitle clips (inchanges)
- Card clip (inchange)
- Dwell markers (inchanges)
- Systeme de presets/situations (reste pour evenements dynamiques, independant du scroll)
