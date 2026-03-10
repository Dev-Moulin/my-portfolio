# Plan Phase A — #8a Suppressions Dev Panel

## Objectif

Nettoyer le Dev Panel en supprimant les onglets devenus redondants depuis l'intégration dans la timeline unifiée :
- **CamPath** — les keyframes caméra se gèrent dans la timeline (touche I)
- **Card** — le layout card se gère dans la timeline (clip drag)
- **VisualKf** — les visual keyframes se gèrent dans la timeline (touche V)

## Fichiers (5 fichiers dont 3 à supprimer)

| # | Fichier | Action |
|---|---------|--------|
| 1 | `components/devPanel/types.ts` | Retirer 'CamPath', 'Card', 'VisualKf' du TABS array |
| 2 | `components/devPanel/DevControlPanel.tsx` | Retirer imports, props, et rendus conditionnels |
| 3 | `components/devPanel/tabs/CamPathTab.tsx` | **Supprimer le fichier** |
| 4 | `components/devPanel/tabs/CardTab.tsx` | **Supprimer le fichier** |
| 5 | `components/devPanel/tabs/VisualKfTab.tsx` | **Supprimer le fichier** |

Chemins relatifs à `packages/overmind-3d/src/`.

---

## 1. types.ts — Retirer les tabs (ligne 32)

```typescript
// AVANT
export const TABS = ['Presets', 'Bloom', 'Neon', 'Lighting', 'PBR', 'Materials', 'Scene', 'Perf', 'Reveal', 'Model', 'Steering', 'ScrollText', 'CamPath', 'Card', 'VisualKf', 'Outliner', 'Library'] as const;

// APRÈS
export const TABS = ['Presets', 'Bloom', 'Neon', 'Lighting', 'PBR', 'Materials', 'Scene', 'Perf', 'Reveal', 'Model', 'Steering', 'ScrollText', 'Outliner', 'Library'] as const;
```

Le type `TabId` se dérive automatiquement de TABS — pas de changement supplémentaire.

---

## 2. DevControlPanel.tsx — Nettoyage

### 2a. Retirer les imports (lignes 30-32)

Supprimer :
```typescript
import { CamPathTab } from './tabs/CamPathTab.tsx';
import { CardTab } from './tabs/CardTab.tsx';
import { VisualKfTab } from './tabs/VisualKfTab.tsx';
```

### 2b. Retirer l'objet `camKf` (lignes 129-138)

Supprimer le bloc entier :
```typescript
const camKf = {
  scrollProgress: timeline.currentFrame,
  enabled: timeline.cameraEnabled,
  setEnabled: timeline.setCameraEnabled,
  keyframes: timeline.cameraKeyframes,
  updateKeyframe: timeline.updateKeyframe,
  deleteKeyframe: timeline.deleteKeyframe,
  importKeyframes: timeline.importKeyframes,
  restoreDefaults: timeline.restoreDefaults,
};
```

### 2c. Retirer l'objet `card` (lignes 139-147)

Supprimer le bloc entier :
```typescript
const card = {
  enabled: timeline.cardEnabled,
  setEnabled: timeline.setCardEnabled,
  posTop: timeline.cardPosTop,
  setPosTop: timeline.setCardPosTop,
  posLeft: timeline.cardPosLeft,
  setPosLeft: timeline.setCardPosLeft,
  restoreDefaults: timeline.restoreDefaults,
};
```

### 2d. Retirer le `camKfFileInputRef` (ligne 151)

Supprimer :
```typescript
const camKfFileInputRef = useRef<HTMLInputElement>(null);
```

### 2e. Retirer les rendus conditionnels (lignes 294-296)

Supprimer :
```typescript
{activeTab === 'CamPath' && <CamPathTab camKf={camKf} scene={scene} cameraMode={cameraMode} capturedAt={capturedAt} camKfFileInputRef={camKfFileInputRef} />}
{activeTab === 'Card' && <CardTab card={card} />}
{activeTab === 'VisualKf' && <VisualKfTab bloom={bloom} lighting={lighting} material={material} scene={scene} neon={neon} timeline={timeline} />}
```

### 2f. Vérifier les variables orphelines

Après suppression, vérifier que `cameraMode`, `capturedAt`, `camKfFileInputRef` ne sont plus utilisés nulle part :
- `cameraMode` — toujours utilisé dans le JSX (affichage mode caméra dans le header) ? **Non**, il n'est utilisé QUE dans CamPathTab → **supprimer le useState + useEffect** (lignes 156-161)
- `capturedAt` — utilisé QUE dans CamPathTab → **supprimer le useState + useEffect** (lignes 164-172)

~30 lignes supprimées.

---

## 3-5. Supprimer les fichiers tab

```bash
rm packages/overmind-3d/src/components/devPanel/tabs/CamPathTab.tsx
rm packages/overmind-3d/src/components/devPanel/tabs/CardTab.tsx
rm packages/overmind-3d/src/components/devPanel/tabs/VisualKfTab.tsx
```

---

## Ordre d'exécution

1. Modifier `types.ts` (TabId change → TypeScript signalera les erreurs dans DevControlPanel)
2. Modifier `DevControlPanel.tsx` (retirer tout ce qui référence les 3 tabs)
3. Supprimer les 3 fichiers .tsx
4. Type-check

---

## Vérification

1. `source ~/.nvm/nvm.sh && nvm use 22 && cd packages/overmind-3d && pnpm tsc --noEmit`
2. Tests manuels :
   - Ouvrir le Dev Panel → les onglets CamPath, Card, VisualKf n'existent plus
   - Les autres onglets fonctionnent normalement
   - Touche I → capture keyframe caméra (fonctionne sans CamPathTab)
   - Touche V → capture visual keyframe (fonctionne sans VisualKfTab)
   - Timeline clip drag → gestion card layout (fonctionne sans CardTab)
