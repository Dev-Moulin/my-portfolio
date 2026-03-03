# 06 — Feedback visuel et liens scène ↔ timeline

## Problèmes identifiés

### 1. Sélection scène → timeline
Quand on sélectionne un objet dans la scène 3D, on devrait voir clairement dans la timeline quelles pistes concernent cet objet. Actuellement il n'y a pas de lien visuel.

### 2. Eye — point de départ visible
L'Eye (modèle 3D) a un point de départ dans la scène (sa position initiale au frame 0). Ce point devrait être visible et déplaçable.

### 3. Points Eye Path sélectionnés — feedback
Quand on sélectionne un point de contrôle du Eye Path (sphère jaune), le gizmo s'attache mais ce n'est pas assez visible.

### 4. Gizmo d'orientation caméra
Blender a un petit cube en haut à droite du viewport qui montre l'orientation de la caméra.

### 5. Grille d'orientation
Blender affiche une grille au sol qui aide à orienter les objets.

---

## Recherches effectuées

### [x] Lien sélection viewport ↔ timeline (voir aussi #3)

- Blender ne trace **pas de ligne** entre viewport et timeline
- Le lien se fait par **surbrillance de la piste** + filtre **"Only Show Selected"**
- Blender ne fait pas d'auto-scroll vers la piste (limitation connue)
- Cliquer un KF dans le Dope Sheet ne sélectionne PAS l'objet dans le viewport

**Approche recommandée pour notre app :**
- Sélectionner un objet → sa piste est highlight (fond légèrement plus clair)
- Auto-scroll vers la piste si pas visible (`scrollIntoView({ behavior: 'smooth' })`)
- Optionnel : "Only Show Selected" comme filtre

---

### [x] Grille au sol — Three.js

#### `THREE.GridHelper` (basique)
```typescript
const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
```
- Limitation : ne permet pas de colorer X et Z séparément
- Solution : ajouter deux `THREE.Line` séparés (X=rouge, Z=bleu)

#### Grille infinie avec shader (recommandé)
- Un seul quad + shader GLSL avec `fwidth()` pour l'anti-aliasing
- Deux niveaux de grille : fine (1 unité) + grossière (10 unités)
- Axes colorés dans le shader (X=rouge au passage Z=0, Z=bleu au passage X=0)
- Fade-out avec la distance (pas de bord visible)
- Subdivision dynamique selon le zoom (camera.position.y)
- **Performance** : 1 seul draw call, impact négligeable
- `frustumCulled = false`, `depthWrite = false`, `renderOrder = -1`

#### Toggle on/off
- Simple : `grid.visible = false`

---

### [x] Gizmo d'orientation — Three.js

#### Option 1 : `THREE.ViewHelper` (officiel)
```typescript
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
const viewHelper = new ViewHelper(camera, renderer.domElement);
```
- Gère le rendu dans un sous-viewport automatiquement
- Cliquable pour snapper vers les vues prédéfinies (avec animation)
- Appeler `viewHelper.render(renderer)` APRÈS `composer.render()`
- Pas besoin de canvas séparé

#### Option 2 : `three-viewport-gizmo` (lib externe, plus customisable)
```typescript
import { ViewportGizmo } from 'three-viewport-gizmo';
const gizmo = new ViewportGizmo(camera, renderer, {
  placement: 'bottom-right',
  size: 128,
  x: { color: '#ff4444', label: 'X' },
  y: { color: '#44ff44', label: 'Y' },
  z: { color: '#4488ff', label: 'Z' },
});
gizmo.attachControls(cameraControls); // Compatible camera-controls !
```
- Draggable pour orbiter
- Compatible avec `camera-controls` (notre lib)

#### Option 3 : ViewCube DIY
- Scène séparée + caméra orthographique
- Synchroniser `cube.quaternion.copy(mainCamera.quaternion).invert()`
- Raycasting pour détecter les clics sur les faces

**Recommandation** : `three-viewport-gizmo` car compatible `camera-controls`.

---

### [x] Highlight des points de contrôle sélectionnés

#### Changement de couleur material (léger, recommandé)
```typescript
const STATE_COLORS = {
  default:  0xFFD700, // jaune
  selected: 0xFF6600, // orange
  hover:    0xFFFFFF, // blanc lumineux
};
// Changer color + emissive + emissiveIntensity
```

#### Halo/glow sans OutlinePass (léger)
- Seconde sphère légèrement plus grande (×1.6), `side: BackSide`, `AdditiveBlending`, `opacity: 0.15`
- Pas de post-processing, juste un mesh additionnel

#### Trois OutlinePass séparés (si on veut outline + couleurs d'état)
- Pass 1 : actif (jaune, `edgeStrength: 4`)
- Pass 2 : sélectionné (orange, `edgeStrength: 3`)
- Pass 3 : hover (bleu, `edgeStrength: 2`)
- **Performance** : 3x le coût d'un seul OutlinePass. Acceptable si on désactive le hover quand la souris bouge pas.

---

### [x] Marqueur de position initiale (Eye)

#### Style : croix + cercle pointillé
- `THREE.Group` avec 2 `THREE.Line` (croix) + `THREE.Points` (cercle pointillé)
- `depthTest: false` → toujours visible même derrière un objet
- Couleur jaune/or, opacité 0.6
- Indépendant de l'Eye dans la scène (pas enfant de l'Eye mesh)

#### Interactivité
- Enregistré dans `SelectionSystem` comme sélectionnable (`selection.register('eyeOrigin', marker)`)
- Déplaçable via le gizmo TransformControls existant
- `onObjectChange` → met à jour la position de départ dans eyePathSystem

---

## Comportement souhaité

### 1. Sélection scène → timeline
- Sélectionner un objet → sa piste est **highlight** (fond plus clair)
- Auto-scroll vers la piste si pas visible
- KFs au frame courant → diamant mis en évidence

### 2. Eye — point de départ
- Marqueur croix+cercle à la position initiale (frame 0)
- Sélectionnable et déplaçable
- Couleur jaune/or, semi-transparent

### 3. Points Eye Path — feedback
- Jaune = non-sélectionné, Orange = sélectionné, Blanc = hover
- Halo glow additif sur le point sélectionné

### 4. Gizmo d'orientation
- `three-viewport-gizmo` en haut à droite (compatible camera-controls)
- Cliquable pour snapper les vues
- Draggable pour orbiter

### 5. Grille
- Grille infinie avec shader (2 niveaux, axes colorés)
- Toggle on/off (raccourci ou bouton)
- Subdivision dynamique selon le zoom

---

## Effort estimé par item

| Item | Effort | Dépendances |
|------|--------|-------------|
| Highlight piste timeline | Faible | #3 (CSS + useEffect) |
| Marqueur Eye origin | Faible | Indépendant |
| Feedback points eyePath | Faible | Indépendant |
| Gizmo navigation | Faible | npm install + config |
| Grille infinie | Moyen | Shader GLSL custom |

## Complexité : Moyenne (chaque item est petit mais il y en a plusieurs)
