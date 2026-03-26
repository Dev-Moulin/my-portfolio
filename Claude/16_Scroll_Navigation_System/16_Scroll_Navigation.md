# 16 — Scroll Navigation System

## Concept

Le portfolio est piloté par le scroll. Chaque scroll (wheel/swipe) déclenche un clip d'animation Blender. Entre chaque clip, un **Dwell** (pause) permet à l'utilisateur de lire le contenu, puis de scroller pour avancer ou reculer.

Le système supporte des **variantes** : pour un même acte (section), plusieurs angles/contenus possibles, tirés **aléatoirement à chaque visite**.

---

## Architecture

### Graphe de navigation (pas une timeline linéaire)

```
Visite 1 :  act_1.1 → act_2.3 → act_3.1 → act_4.2
Visite 2 :  act_1.1 → act_2.1 → act_3.2 → act_4.1
Visite 3 :  act_1.1 → act_2.2 → act_3.1 → act_4.3
```

Chaque `act_X` = une section du portfolio (intro, about, projet 1, etc.)
Chaque `act_X.Y` = une variante de présentation de cette section.

### Concepts clés

| Terme | Definition |
|-------|-----------|
| **Act** | Une section du portfolio (intro, about, projets, contact...) |
| **Variante** | Une version alternative d'un act (angle caméra, contenu, animation différents) |
| **Clip** | Animation Blender jouée pour transiter d'un act à un autre |
| **Dwell** | Pause entre deux clips — l'utilisateur lit le contenu et scroll pour continuer |
| **Parcours** | Séquence de variantes tirée aléatoirement au chargement |
| **Point de repos** | Position caméra fixe à la fin d'un clip (point d'arrivée commun à un act) |

---

## Flow utilisateur

```
1. Page load → tirage aléatoire du parcours
2. Scroll down → joue clip Blender (act_1 → act_2 repos)
                → interpolation runtime (repos → variante act_2.X)    [0.5-1s]
                → Dwell (contenu visible, scroll bloqué temporairement)

3. Pendant le Dwell :
   - Barre de progression apparaît
   - Scroll down = remplit la barre vers l'avant
   - Scroll up = remplit la barre vers l'arrière
   - Quand la barre atteint 100% → déclenche le prochain/précédent clip

4. Scroll down → interpolation runtime (variante act_2.X → repos)    [0.5-1s]
              → joue clip Blender (act_2 repos → act_3 repos)
              → interpolation runtime (repos → variante act_3.Y)
              → Dwell
              → ...
```

### Retour arrière

Le retour arrière ne rejoue PAS le clip à l'envers. Il peut :
- Jouer un clip Blender dédié (act_3 → act_2) si disponible
- Ou jouer le clip aller avec `timeScale = -1`
- Dans les deux cas, la variante d'arrivée peut être différente de l'aller

---

## Variantes — deux types possibles

### Type A — Même angle caméra, contenu différent
- La caméra reste au point de repos
- On swap les objets/textes visibles
- Zero interpolation nécessaire
- Ex : card de présentation avec texte différent

### Type B — Angle caméra différent
- Après le clip Blender, interpolation runtime vers la position de la variante
- Avant le prochain clip, interpolation runtime retour vers le point de repos
- Ex : présentation vue de face vs vue de côté

```
clip Blender (act_1 → act_2 repos)
  → interpolation runtime (repos → variante act_2.X)     ← Type B
  → Dwell
  → interpolation runtime (variante act_2.X → repos)     ← Type B
  → clip Blender (act_2 repos → act_3 repos)
```

---

## Côté Blender

### Ce qu'il faut préparer

1. **UNE timeline continue** avec tous les clips enchaînés
   - Intro [frame 0-90], transition 1→2 [90-150], transition 2→3 [150-240], etc.
   - Three.js découpera avec `AnimationUtils.subclip()` selon les timecodes

2. **Actions nommées** avec convention :
   - `clip_1_to_2` — transition principale act 1 → act 2
   - `clip_2_to_3` — transition principale act 2 → act 3
   - `clip_3_to_2` — (optionnel) transition retour act 3 → act 2

3. **Markers/metadata** pour les points de repos :
   - Position + rotation + FOV de la caméra à chaque point de repos
   - Exportés dans le GLB ou définis dans un fichier de config

4. **Variantes** (positions caméra alternatives) :
   - Soit des actions Blender séparées (`act_2_var1`, `act_2_var2`)
   - Soit des positions caméra stockées dans un fichier JSON côté Three.js
   - L'interpolation runtime se charge de la transition (pas besoin d'animer dans Blender)

### Convention de nommage suggérée

```
Clips :       clip_intro_to_about
              clip_about_to_project1
              clip_project1_to_project2
              clip_about_to_intro          (retour, optionnel)

Variantes :   var_about_face
              var_about_side
              var_about_top
```

---

## Côté Three.js — composants à développer

### 1. NavigationGraph
- Définit les acts, leurs variantes, et les clips entre eux
- Format JSON/config

```typescript
interface NavigationGraph {
  acts: {
    id: string;                    // "about", "project1", etc.
    restPoint: CameraState;        // position + rotation + fov au repos
    variants: {
      id: string;                  // "face", "side", "top"
      type: 'A' | 'B';            // A = même caméra, B = caméra différente
      cameraState?: CameraState;   // uniquement pour type B
      content?: string;            // ref au contenu à afficher
    }[];
  }[];
  clips: {
    from: string;                  // act id
    to: string;                    // act id
    clipName: string;              // nom dans le GLB
    startFrame: number;
    endFrame: number;
    reverse?: boolean;             // true si c'est un clip retour dédié
  }[];
}
```

### 2. ClipPlayer
- Import du GLB Blender avec `AnimationMixer`
- Découpe en subclips via `AnimationUtils.subclip()`
- Play / reverse (`timeScale = -1`) d'un clip
- Callback `onComplete` pour enchaîner

### 3. ScrollSegmentController
- Scroll natif bloqué (`overflow: hidden`)
- Chaque `wheel`/`touchmove` alimente une jauge (barre de progression)
- Quand jauge = 100% → déclenche clip suivant
- Quand jauge = -100% → déclenche clip précédent
- Pendant un clip en cours → scroll ignoré

### 4. ProgressBar
- Barre verticale fixe (côté droit)
- Visible pendant les Dwells
- Se remplit en fonction du scroll accumulé
- Indique la direction (haut/bas)

### 5. RuntimeInterpolator
- Interpole la caméra entre deux `CameraState` (position, rotation, fov)
- Durée configurable (défaut 0.5-1s)
- Easing smooth (ease-in-out)
- Utilisé pour les transitions vers/depuis les variantes (Type B)

### 6. PathRandomizer
- Au chargement, tire une variante aléatoire pour chaque act
- Stocke le parcours de la session courante
- Possibilité de seed pour debug/reproductibilité

---

## Barre de progression — détail du comportement

```
         ┌─────────┐
 100%    │ ████████ │  → déclenche clip suivant (forward)
         │ ██████   │
         │ ████     │  ← scroll down accumule
  0%     │ ──────── │  ← position neutre (Dwell)
         │ ████     │  ← scroll up accumule
         │ ██████   │
-100%    │ ████████ │  → déclenche clip précédent (backward)
         └─────────┘
```

- La barre se remplit progressivement avec le scroll
- Si l'utilisateur arrête de scroller, la barre peut revenir lentement vers 0 (decay)
- Seuil de déclenchement configurable (ex: 80% au lieu de 100%)
- Feedback visuel : couleur/glow change quand on approche du seuil

---

## Intégration avec l'existant

### Timeline editor (mode dev)
- L'éditeur reste pour positionner les Dwells, ajuster les timecodes
- Les clips importés de Blender apparaissent dans la timeline
- On peut visualiser les points de repos et les variantes

### CameraKeyframeSystem
- Reste actif pour l'interpolation runtime (variantes Type B)
- Les clips Blender prennent le contrôle de la caméra pendant leur lecture
- Transition fluide entre les deux systèmes

### AnimationMixer existant
- Les animations permanentes (bras, yeux de l'Overmind) continuent en parallèle
- Les clips de navigation utilisent le même mixer ou un mixer dédié

---

## Phases d'implémentation

### Phase A — Foundation
- [ ] Import GLB avec animations caméra depuis Blender
- [ ] `AnimationUtils.subclip()` — découpage par timecodes
- [ ] `ClipPlayer` — lecture d'un clip avec callback onComplete

### Phase B — Scroll Controller
- [ ] `ScrollSegmentController` — wheel/touch → jauge
- [ ] `ProgressBar` — composant visuel
- [ ] Blocage du scroll pendant les clips
- [ ] Déclenchement forward/backward

### Phase C — Navigation Graph
- [ ] Format de config `NavigationGraph`
- [ ] Chargement et validation du graphe
- [ ] `PathRandomizer` — tirage aléatoire des variantes
- [ ] Enchaînement automatique : clip → dwell → scroll → clip

### Phase D — Variantes & Interpolation
- [ ] `RuntimeInterpolator` — transition caméra smooth
- [ ] Support Type A (swap contenu)
- [ ] Support Type B (interpolation caméra)
- [ ] Transition fluide clip Blender ↔ interpolation runtime

### Phase E — Polish
- [ ] Retour arrière (timeScale = -1 ou clips retour dédiés)
- [ ] Decay de la barre de progression
- [ ] Support mobile (touch/swipe)
- [ ] Feedback visuel (glow barre, indicateurs directionnels)
- [ ] Seed debug pour le randomizer
