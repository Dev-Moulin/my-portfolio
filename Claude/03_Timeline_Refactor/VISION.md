# Vision : Refonte Timeline & Navigation Camera

## Le probleme

Le workflow actuel pour creer les animations scroll-driven est penible :

1. **14 onglets** dans le DevPanel — trop d'onglets, on se perd
2. **Pas de vue d'ensemble** — impossible de voir quand le titre entre, quand la camera bouge, quand la card apparait, tout en meme temps
3. **Navigation camera par sliders** — on modifie des chiffres (posX, posY, posZ...) au lieu de naviguer visuellement dans la scene
4. **Double-smoothing** — le scroll passe par `remapProgress()` puis chaque systeme fait son propre `lerp()`, ce qui rend les timings imprevisibles
5. **3 actors XState independants** — chacun recoit le meme progress et fait ses calculs dans son coin, pas de coordination
6. **Timings disperses** — les constantes sont reparties dans 5+ fichiers differents

## Ce qu'on veut

### 1. Navigation camera Blender-like

- Une touche (ex: `F` ou middle-click) active le mode **camera libre**
- On orbite/pan/zoom avec la souris comme dans Blender
- Ce qu'on voit = ce que la camera filmera
- Un bouton **"Save keyframe here"** capture la position actuelle au progress choisi
- Remplace le workflow slider → regarder → re-slider → re-regarder

### 2. Timeline visuelle unique

Une barre horizontale en haut ou en bas du viewport (toggleable) qui montre TOUT :

```
Progress  0 ─────────── 0.3 ──── 0.44 ──────── 0.685 ────── 1.0
          |              |         |              |
Camera    ◆──────────────◆────────◆──────────────◆
          kf0            kf1      kf2            kf3

Title     [░░░ enter ░░░][██ steady ██][▓▓ exit ▓▓]
Subtitle  [░░░ enter ░░░][██ steady ██][▓▓ exit ▓▓]

Card                                   [░░ enter ░░][████████████]

Dwells         ┃                            ┃
           pause 0.3                    pause 0.685
```

- **Curseur scrub** : on drag le curseur pour se deplacer sur la timeline
- **Barres de duree** : chaque element a ses phases visibles (entree/repos/sortie)
- **Losanges** : keyframes camera
- **Zones de dwell** : bandes montrant ou le scroll se bloque
- **Hover** : affiche les details (durees exactes, valeurs)
- **Drag** : on ajuste les timings en deplacant les bords des barres (futur)

### 3. Reduction des onglets DevPanel

| Avant (14 onglets) | Apres (6 onglets) |
|---|---|
| Presets | **Presets** (tel quel) |
| Bloom, Lighting, PBR, Materials | **Visual** (regroupe) |
| Scene, Model | **Scene** (regroupe) |
| Neon, Reveal, Steering | **Effects** (regroupe) |
| ScrollText, CamPath, Card | **Timeline** (remplace tout) |
| Perf | **Perf** (tel quel) |

### 4. Pipeline scroll simplifie

**Avant :**
```
scroll → remapProgress → 3 x actor.send() → 3 x syncFromState() → 3 x lerp interne
```

**Apres :**
```
scroll → timelineMachine (unique) → calcule tout → distribue les resultats
```

Un seul actor timeline connait toutes les pistes (camera, texte, card, dwells). Plus de double-lerp, plus de timings disperses.

## Documents lies

- [RECHERCHE.md](./RECHERCHE.md) — resultats de recherche (libs, patterns, best practices)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — architecture technique detaillee
- [PLAN_IMPLEMENTATION.md](./PLAN_IMPLEMENTATION.md) — plan par phases
