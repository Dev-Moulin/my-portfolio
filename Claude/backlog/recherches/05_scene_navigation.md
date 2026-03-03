# 05 — Navigation souris dans la scène

## Problème actuel

La navigation dans la scène 3D est différente de Blender. L'utilisateur s'attend aux contrôles standards de Blender mais notre app utilise CameraControls avec des contrôles personnalisés.

### Contrôles actuels (en Free Camera mode — touche F)
- Clic gauche = orbiter
- Clic droit = pan
- Scroll = zoom
- Le mode scroll (non Free Camera) utilise le scroll pour le défilement timeline

### Contrôles Blender (standard)
- MMB (clic molette) = orbiter autour du point focal
- Shift+MMB = pan (glisser la vue)
- Scroll = zoom avant/arrière
- Clic gauche = sélectionner
- Clic droit = menu contextuel

---

## Recherches effectuées

### [x] Contrôles souris Blender — viewport 3D

#### MMB (clic molette) — Orbit
- La vue tourne autour d'un **point focal** invisible (center of interest)
- Deux méthodes disponibles dans Preferences > Navigation :
  - **Turntable** (défaut) : l'axe Z reste toujours vers le haut. Impossible de se retrouver tête en bas. Gimbal lock possible au pôle.
  - **Trackball** : rotation libre dans toutes les directions, peut passer tête en bas
- Le drag vertical = angle polaire (altitude), horizontal = azimut

#### Shift+MMB — Pan
- Déplace la caméra + point focal dans un **plan parallèle à l'écran** (perpendiculaire à l'axe de vue)
- La scène "glisse" sans que l'angle change
- Vitesse dépendante de la distance au point focal (plus loin = plus rapide)

#### Scroll (molette) — Zoom
- **Dolly** : la caméra se rapproche/éloigne physiquement (pas un zoom de focale)
- Zoom **géométrique/logarithmique** : chaque cran multiplie/divise la distance par un facteur constant
- Centrage par défaut : centre du viewport. Avec **"Zoom to Mouse Position"** : converge vers le curseur
- **Limite de zoom** : bloque quand la caméra atteint le point focal. Solution : **Auto Depth** (met à jour le point focal sur la géométrie sous le curseur)
- **Combo recommandé** : Auto Depth + Zoom to Mouse Position

#### Ctrl+MMB — Zoom interactif
- Drag souris = zoom continu (3 modes : Continue, Dolly, Scale)

---

### [x] Point focal / Orbit center

- Par défaut : le dernier point d'intérêt (se met à jour avec pan/zoom)
- **"Orbit Around Selection"** (Preferences) : le centre de l'objet sélectionné devient le point focal automatiquement
  - Object Mode : centre de la bounding box de l'objet actif
  - Edit Mode : centre géométrique des éléments sélectionnés
- **Numpad .** = View Selected → recentre le point focal sur la sélection (ESSENTIEL pour débloquer le zoom)
- **Home** = View All → point focal = centre de toute la scène

---

### [x] Vues prédéfinies (Numpad)

| Raccourci | Vue | Projection |
|-----------|-----|-----------|
| Numpad 1 | Front (-Y) | Ortho |
| Ctrl+Numpad 1 | Back (+Y) | Ortho |
| Numpad 3 | Right (-X) | Ortho |
| Ctrl+Numpad 3 | Left (+X) | Ortho |
| Numpad 7 | Top (-Z) | Ortho |
| Ctrl+Numpad 7 | Bottom (+Z) | Ortho |
| Numpad 5 | Toggle Perspective/Ortho | — |
| Numpad 0 | Vue Caméra active | Perspective |
| Numpad 2/4/6/8 | Orbite par pas (15° par défaut) | — |
| Numpad . | View Selected | — |
| Numpad / | Local View (isoler sélection) | — |

#### Smooth View (transitions animées)
- Toutes les transitions sont animées (pas de téléportation)
- Durée configurable : défaut **200ms**, plage 0–1000ms
- Rotation + position + changement perspective/ortho interpolés avec easing in/out

#### Auto Perspective
- Actif par défaut : les vues Numpad passent automatiquement en ortho
- Retourner en vue libre repasse en perspective

---

### [x] Modes de caméra Blender

#### Perspective vs Orthographique
- **Numpad 5** toggle entre les deux
- Perspective : lignes convergent (vision naturelle)
- Orthographique : pas de convergence (modélisation précise)

#### Vue Caméra (Numpad 0)
- Montre exactement ce que voit la caméra active
- **"Lock Camera to View"** : les contrôles de navigation déplacent physiquement la caméra dans la scène
- **Ctrl+Alt+Numpad 0** : snap la caméra sur la vue courante

#### Walk/Fly Navigation (Shift+`)
- Mode marche : WASD pour se déplacer, souris pour regarder
- Shift = sprint, Alt = ralentir, Scroll = ajuster vitesse
- Tab = toggle gravité, V = téléporter vers surface
- Espace/Entrée = confirmer, Escape = annuler

---

### [x] Alternatives laptop

#### Emulate 3 Button Mouse (Alt+LMB = MMB)

| Combinaison | Équivalent |
|-------------|-----------|
| Alt+LMB | MMB (orbit) |
| Alt+Shift+LMB | Shift+MMB (pan) |
| Alt+Ctrl+LMB | Ctrl+MMB (zoom interactif) |

**Conflits connus** : Alt+LMB est aussi utilisé pour sélectionner des edge loops en Edit Mode. Quand l'émulation est active, ces fonctions ne marchent plus.

**Alternative** : utiliser la touche OS (Win/Cmd) au lieu d'Alt pour éviter les conflits.

#### Trackpad
- Pinch = zoom
- 2 doigts glisser = pan/orbit (selon config OS)
- Tap 2 doigts = clic MMB (certains trackpads)

---

### [x] Gizmo de navigation (ViewCube)

#### Apparence et position
- Coin supérieur droit du viewport
- 3 axes colorés (X=rouge, Y=vert, Z=bleu) avec sphères aux extrémités
- Extrémités négatives : sphères plus petites, couleur plus terne

#### Interactions
- **Clic sur une sphère d'axe** = snap vers la vue orthographique correspondante (avec animation Smooth View)
- **Clic sur le centre** = toggle perspective/ortho (Numpad 5)
- **Drag sur le gizmo** = orbiter librement (comme MMB)

#### Boutons additionnels (Navigate Gizmo)
- Icône caméra = vue caméra (Numpad 0)
- Icône grille = toggle perspective/ortho
- Optionnels, désactivables séparément

#### Taille
- Configurable : Preferences > Viewport > Display > Gizmo Size (défaut 75px)

---

### [x] Configuration CameraControls (Three.js) pour Blender

Notre app utilise déjà la lib `camera-controls` (yomotsu). Voici le mapping Blender :

```typescript
// Boutons souris Blender
cameraControls.mouseButtons.left   = CameraControls.ACTION.NONE;    // LMB = sélection (géré séparément)
cameraControls.mouseButtons.right  = CameraControls.ACTION.NONE;    // RMB = menu contextuel
cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE;  // MMB = orbit
cameraControls.mouseButtons.wheel  = CameraControls.ACTION.DOLLY;   // Scroll = zoom

// Zoom vers le curseur (équivalent "Zoom to Mouse Position")
cameraControls.dollyToCursor = true;

// Zoom continu au-delà de la limite (équivalent "Auto Depth")
cameraControls.infinityDolly = true;

// Smooth View 200ms
cameraControls.smoothTime = 0.2;

// Turntable (Z up fixe)
cameraControls.minPolarAngle = 0.05;
cameraControls.maxPolarAngle = Math.PI - 0.05;
```

#### Shift+MMB pour pan (gestion manuelle)

camera-controls ne gère pas nativement Shift+MMB. Solution :

```typescript
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    cameraControls.mouseButtons.middle = CameraControls.ACTION.TRUCK;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE;
  }
});
```

#### Mapping complet

| Blender | camera-controls |
|---------|----------------|
| MMB = Orbit | `mouseButtons.middle = ACTION.ROTATE` |
| Shift+MMB = Pan | Gestion Shift manuelle → `ACTION.TRUCK` |
| Scroll = Zoom | `mouseButtons.wheel = ACTION.DOLLY` |
| Zoom to Mouse Position | `dollyToCursor = true` |
| Auto Depth | `infinityDolly = true` |
| Smooth View 200ms | `smoothTime = 0.2` |
| Numpad . (View Selected) | `fitToBox(mesh, true)` |
| Home (View All) | `fitToSphere(scene, true)` |
| Numpad 1/3/7 (vues prédéfinies) | `rotateTo(azimuth, polar, true)` |

---

## Comportement souhaité

### Contrôles souris en Free Camera mode
1. **MMB** = orbiter (turntable, axe Z fixe)
2. **Shift+MMB** = pan
3. **Scroll** = zoom (dolly vers curseur)
4. **Clic gauche** = sélectionner (déjà implémenté)

### Zoom intelligent
1. **dollyToCursor = true** — zoom vers le curseur, pas le centre
2. **infinityDolly = true** — pas de blocage du zoom

### Vues prédéfinies
1. Numpad 1/3/7 pour front/right/top (avec Smooth View)
2. Numpad 5 pour toggle perspective/ortho
3. Numpad . pour View Selected (fitToBox)
4. Home pour View All
5. Alternatives laptop : chiffres du clavier principal si "Emulate Numpad"

### Gizmo de navigation
1. Petit indicateur d'axes X/Y/Z en haut à droite
2. Cliquable pour snap vers les vues prédéfinies
3. Draggable pour orbiter

### Double usage du scroll
- **Free Camera mode** : scroll = zoom (Blender standard)
- **Scroll Camera mode** : scroll = avancer dans la timeline (concept portfolio)
- Ce double usage est spécifique à notre app, pas Blender

---

## Complexité : Moyenne (contrôles = config CameraControls + gestion Shift + gizmo navigation)
