# Plan Phase A — #5 Navigation souris

## Objectif

Remapper les contrôles de caméra en Free Camera mode pour correspondre à Blender :
- **MMB** = orbiter (actuellement LMB)
- **Shift+MMB** = pan (actuellement RMB)
- **Scroll** = dolly vers curseur (pas le centre)
- Zoom infini (plus de blocage au point focal)

## Fichiers (2 fichiers)

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `scene/cameraHelpers.ts` | Config mouseButtons + dolly |
| 2 | `scene/keyboardHandler.ts` | Shift key listener pour Shift+MMB pan |

Chemins relatifs à `packages/overmind-3d/src/`.

---

## 1. cameraHelpers.ts — Config CameraControls

### 1a. Import CameraControls (déjà fait, ligne 2)

Le type `CameraControls` est déjà importé. Pas besoin d'import supplémentaire.

### 1b. Config mouseButtons (après ligne 34)

Ajouter APRÈS `cameraControls.enabled = false;` (ligne 34) :

```typescript
// Blender-style mouse buttons
cameraControls.mouseButtons.left = CameraControls.ACTION.NONE;     // LMB = sélection (géré par SelectionSystem)
cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;    // RMB = menu contextuel (futur)
cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE; // MMB = orbit

// Zoom intelligent
cameraControls.dollyToCursor = true;   // Zoom vers le curseur
cameraControls.infinityDolly = true;   // Pas de blocage au point focal

// Turntable — axe Z fixe (pas de tête en bas)
cameraControls.minPolarAngle = 0.05;
cameraControls.maxPolarAngle = Math.PI - 0.05;
```

**Note** : `mouseButtons.wheel` est déjà `ACTION.DOLLY` par défaut dans camera-controls, pas besoin de le définir explicitement.

~10 lignes ajoutées.

---

## 2. keyboardHandler.ts — Shift+MMB pan

### Problème

camera-controls ne supporte pas nativement "Shift+MMB = pan". Il faut détecter Shift keydown/keyup et basculer dynamiquement `mouseButtons.middle` entre `ROTATE` et `TRUCK`.

### 2a. Import CameraControls class (ligne 2)

Changer l'import de `type CameraControls` vers `CameraControls` (on a besoin de `CameraControls.ACTION`) :

```typescript
// AVANT
import type CameraControls from 'camera-controls';

// APRÈS
import CameraControls from 'camera-controls';
```

### 2b. Modifier onKeyDown — Shift détecté (dans la fonction `onKeyDown`)

Ajouter AU DÉBUT de `onKeyDown`, APRÈS le early return pour input/textarea (ligne 45) :

```typescript
// Shift+MMB pan: switch middle button to TRUCK while Shift is held
if (e.key === 'Shift' && !selection.isDragging()) {
  cameraControls.mouseButtons.middle = CameraControls.ACTION.TRUCK;
}
```

**Attention** : On ne fait PAS le switch si un gizmo drag est en cours (Shift pendant drag = rotation snap à 5°, cf ligne 48). Le check `!selection.isDragging()` protège ce cas.

### 2c. Modifier onKeyUp (ligne 510)

Modifier le handler `onKeyUp` existant :

```typescript
// AVANT (ligne 510-513)
function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Shift') {
    selection.setRotationSnap(null);
  }
}

// APRÈS
function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Control' || e.key === 'Shift') {
    selection.setRotationSnap(null);
  }
  // Restore MMB = orbit when Shift released
  if (e.key === 'Shift') {
    cameraControls.mouseButtons.middle = CameraControls.ACTION.ROTATE;
  }
}
```

~6 lignes ajoutées.

---

## Flux complet

```
1. Free Camera mode (F) activé
   → cameraControls.enabled = true

2. MMB drag
   → mouseButtons.middle = ROTATE → orbit turntable

3. Shift appuyé + MMB drag
   → keydown Shift → mouseButtons.middle = TRUCK
   → pan parallèle à l'écran

4. Shift relâché
   → keyup Shift → mouseButtons.middle = ROTATE

5. Scroll
   → dollyToCursor: zoom vers le curseur, pas le centre
   → infinityDolly: pas de blocage
```

---

## Cas limites

1. **Shift pendant rotation gizmo** : Protégé par `!selection.isDragging()` — Shift reste snap modifier
2. **Scroll en mode scroll-driven** : `cameraControls.enabled = false` → le scroll est ignoré par camera-controls, géré par la timeline
3. **Tab perd le focus pendant Shift held** : keyup Shift ne fire pas → le MMB reste en TRUCK. Solution : pas critique car l'utilisateur relâchera Shift et keyup finira par fire
4. **minPolarAngle/maxPolarAngle** : 0.05 rad ≈ 3° — empêche le gimbal lock aux pôles tout en permettant des vues quasi-verticales

---

## Vérification

1. `source ~/.nvm/nvm.sh && nvm use 22 && cd packages/overmind-3d && pnpm tsc --noEmit`
2. Tests manuels :
   - F pour activer free camera
   - MMB drag → orbite (pas le LMB)
   - Shift+MMB drag → pan
   - Scroll → zoom vers curseur, pas vers centre viewport
   - Zoom très loin → pas de blocage (infinityDolly)
   - Shift pendant G drag → toujours snap 5° (pas de switch en TRUCK)
   - Mode scroll (pas free) → scroll avance la timeline (pas zoom)
