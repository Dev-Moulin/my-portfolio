# Plan Scroll-Driven 3D Experience

## Vision globale

L'ensemble du portfolio devient une **experience 3D scroll-driven**. Le scroll (0→1) pilote :
- Le mouvement de la camera
- L'apparition/disparition d'elements 3D (cards, textes, logos)
- Les animations de transition

Tous les contenus actuellement en HTML (skills, projects, hackathons, contact) seront
recrees en **elements 3D** dans le canvas Three.js (cards 3D, texte troika, logo wall 3D, etc.).

---

## Architecture : Option B — Camera et objets separes

Chaque element a sa propre timeline de keyframes independante :

### Camera keyframes
```
scrollCameraKeyframes: [
  { at: 0.00, pos: [0, 1.5, 12], lookAt: [0, 1, 0], fov: 45 }
  { at: 0.25, pos: [2, 2, 8],    lookAt: [0, 0, -2], fov: 40 }
  { at: 0.55, pos: [-3, 1, 6],   lookAt: [1, 0, 0],  fov: 50 }
]
```

### Objets 3D keyframes
Chaque systeme 3D (cards, logos, texte) a ses propres keyframes :
```
scrollObject: {
  scrollStart: 0.15
  scrollEnd: 0.35
  keyframes: [
    { at: 0.15, pos: [...], opacity: 0, scale: 0.5 }
    { at: 0.20, pos: [...], opacity: 1, scale: 1.0 }
    { at: 0.33, pos: [...], opacity: 1, scale: 1.0 }
    { at: 0.35, pos: [...], opacity: 0, scale: 0.5 }
  ]
}
```

Entre chaque keyframe, interpolation (lerp) avec easing configurable.

**Avantage** : on peut ajuster un element sans casser les autres.

---

## Stages (decoupage du scroll)

Les stages sont de **taille variable** — chaque partie de l'experience peut prendre
autant de scroll qu'elle en a besoin :

```
Stage 0  [0.00 → 0.25]  Hero — titre 3D arrive, camera position initiale
Stage 1  [0.25 → 0.32]  Transition rapide
Stage 2  [0.32 → 0.55]  Skills/Projects — beaucoup de contenu
Stage 3  [0.55 → 0.58]  Rotation camera
Stage 4  [0.58 → 0.80]  Hackathons + Contact
...
```

Les ranges `scrollStart` / `scrollEnd` sont librement configurables via le DevControlPanel.

---

## Interactivite des elements 3D

### 100% 3D (raycasting)
- **Click** : detecte via Three.js Raycaster → declencher action (ouvrir lien, naviguer)
- **Hover** : detection entree/sortie souris → effets visuels (glow, scale, rotation)
- **Cursor** : changement manuel `document.body.style.cursor = 'pointer'`

### Hybride 3D + HTML overlay (si besoin)
Pour les elements necessitant des interactions riches (liens, texte selectionnable) :
1. L'objet 3D gere le positionnement et l'animation
2. Ses coordonnees 3D sont projetees en 2D ecran
3. Un `<div>` HTML est positionne par-dessus avec les interactions natives

On commence en 100% 3D et on passe en hybride uniquement la ou c'est necessaire.

---

## Stack technique

- **Pas de librairie externe** (pas de GSAP) — on reste sur notre propre systeme
- `Three.js MathUtils.lerp` pour l'interpolation
- Smoothstep / easings custom pour les courbes
- **XState v5** pour la machine d'etat des keyframes
- **Custom events** pour la communication scroll (deja en place)
- **troika-three-text** pour tout le texte 3D (deja en place)

---

## Workflow DevControlPanel

1. Selectionner ou creer un keyframe
2. Positionner la camera avec les sliders Scene existants
3. Cliquer **"Add Keyframe"** → capture la position camera au scroll actuel
4. Scroller, repositionner, ajouter un autre keyframe
5. Visualiser la liste des keyframes (triee par scroll position)
6. Supprimer / reordonner les keyframes
7. Tester en scrollant
8. **Export JSON** pour sauvegarder toute la timeline

---

## Ordre d'implementation

### Phase 1 : Keyframes camera (actuel)
- `cameraKeyframeMachine.ts` — machine XState pour les keyframes camera
- `CameraKeyframeSystem` — interpole la camera entre keyframes en fonction du scroll
- Onglet DevControlPanel "CamPath" pour positionner interactivement
- Import/Export JSON des keyframes

### Phase 2 : Elements 3D (un par un)
- Cards 3D (projects, hackathons)
- Logo Wall 3D
- Texte 3D additionnel (titres de sections)
- Chaque element = son propre systeme + sa propre timeline de keyframes

### Phase 3 : Interactions
- Raycasting pour hover/click sur les cards 3D
- Effets visuels (glow, scale up)
- Overlay HTML si necessaire pour les liens

### Phase 4 : Polish
- Easings fins par segment
- Mobile adaptation
- Performance optimization

---

## Elements a recreer en 3D

Ref: `Claude/hidden-content.md`

| Element actuel | Futur 3D | Priorite |
|---------------|----------|----------|
| Titre "Paul Moulin" | Texte troika (FAIT) | ✓ |
| Sous-titre | Texte troika (FAIT) | ✓ |
| LogoWall (18 logos) | Logo Wall 3D | Haute |
| HomeWallSkill (5 categories) | Cards/texte 3D | Haute |
| Projects (2 projets) | Cards 3D interactives | Haute |
| Hackathons (3 events) | Cards 3D | Moyenne |
| Training (3 formations) | Cards 3D | Moyenne |
| Contact (email, social) | Texte 3D + liens | Basse |
| Footer | Supprime ou minimaliste | Basse |

---

## Ce qui ne change PAS

- **NavArc** : reste en HTML, toujours visible
- **OvermindOverlay** : canvas 3D + DevControlPanel, toujours actif
- **ScrollProgressEmitter** : dispatch du scroll progress, deja en place
- **Bloom / Neon Bands / Steering** : systemes 3D existants, inchanges
