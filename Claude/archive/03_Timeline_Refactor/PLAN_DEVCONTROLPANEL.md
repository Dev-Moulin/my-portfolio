# Plan 1 — Refactoring DevControlPanel (1808 → ~150 lignes)

## Objectif

Extraire les 14 onglets dans des fichiers séparés + centraliser styles et types.

## Principes

- **Aucun changement fonctionnel** — rendu et comportement identiques
- **Pragmatique** — chaque tab est un composant pur, le container garde toute la logique

---

## Structure cible

```
components/
  devPanel/
    DevControlPanel.tsx     (~150 lignes)  ← container : hooks, drag, tab nav, switch
    styles.ts               (~170 lignes)  ← objet `s`, tabBtnSt(), presetBtnSt()
    types.ts                (~20 lignes)   ← ContentProps, TabId, TABS, SITUATION_LABELS
    tabs/
      PresetsTab.tsx
      BloomTab.tsx
      NeonTab.tsx
      LightingTab.tsx
      PBRTab.tsx
      MaterialsTab.tsx
      SceneTab.tsx
      PerfTab.tsx
      RevealTab.tsx
      ModelTab.tsx
      SteeringTab.tsx
      ScrollTextTab.tsx
      CamPathTab.tsx
      CardTab.tsx
```

---

## Détails

### `styles.ts`

Contient :
- L'objet `s` (lignes 58-225 actuelles) — tous les styles inline
- `tabBtnSt(active: boolean)` (lignes 227-234)
- `presetBtnSt(active: boolean)` (lignes 236-241)

### `types.ts`

Contient :
- `interface ContentProps` (lignes 41-54) — les actor refs
- `const TABS` et `type TabId` (lignes 245-246)
- `SITUATION_LABELS` (lignes 248-255) — utilisé par PresetsTab

### Chaque tab

Chaque tab reçoit en props uniquement ce dont il a besoin :

| Tab | Props reçues |
|-----|--------------|
| PresetsTab | `bloom, lighting, material, pbr, vPreset, fileInputRef` |
| BloomTab | `bloom` |
| NeonTab | `neon` |
| LightingTab | `lighting` |
| PBRTab | `pbr` |
| MaterialsTab | `material` |
| SceneTab | `scene` |
| PerfTab | `perf` |
| RevealTab | `revelation` |
| ModelTab | `model` |
| SteeringTab | `steering` |
| ScrollTextTab | `scrollText, scrollTextFileInputRef` |
| CamPathTab | `camKf, scene, cameraMode, capturedAt, camKfFileInputRef` |
| CardTab | `card` |

### Container `DevControlPanel.tsx`

Garde :
- Tous les appels hooks (`useBloom`, `useLighting`, etc.)
- Le drag panel (state + useEffect)
- Les alias objects (`scrollText`, `camKf`, `card`)
- Les refs (`fileInputRef`, `camKfFileInputRef`, `scrollTextFileInputRef`)
- Les states locaux (`cameraMode`, `capturedAt`, `htmlHidden`, `activeTab`)
- Les useEffects (camera-mode, keyframe-captured)
- Le header avec boutons (HTML, Ring, Reveal)
- Le tab nav
- Le switch `activeTab === 'X' && <XTab ... />`
- Le composant public `DevControlPanel` avec le guard `useOvermind()`

---

## Imports à mettre à jour

- `OvermindOverlay.tsx` ou `index.ts` : adapter le chemin d'import de `DevControlPanel`

---

## Étapes d'exécution

1. Créer le dossier `components/devPanel/tabs/`
2. Extraire `styles.ts`
3. Extraire `types.ts`
4. Extraire les 14 tabs un par un
5. Réécrire le container `DevControlPanel.tsx`
6. Mettre à jour les imports externes
7. `pnpm type-check` → 0 erreurs
8. `pnpm build` → succès
