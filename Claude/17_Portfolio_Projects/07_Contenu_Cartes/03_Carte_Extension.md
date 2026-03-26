# Carte 3 — Intuition Chrome Extension

**Titre :** Intuition Chrome Extension

**Tagline :** Extension Web3 de confiance décentralisée — détection de sites scam via attestations on-chain

**Image/GIF :** *(à capturer : popup extension + bouton flottant sur une page)*

---

## Description

Première participation à un projet professionnel en équipe. Pendant mon stage THP, notre équipe de 6 a développé une extension Chrome qui aide les utilisateurs à savoir si un site web est digne de confiance. En naviguant, un bouton flottant s'affiche sur chaque page — rouge si le site est signalé comme scam, vert s'il est approuvé par la communauté. Chaque signal est ancré on-chain via le protocole Intuition (Atoms, Triples, Vaults).

Ma contribution : j'ai créé les éléments visuels distinctifs de l'extension — l'œil 3D Overmind intégré dans la popup (Three.js, shaders GLSL custom, bloom sélectif), un système de particules dual interactif qui réagit à la souris, une navigation en arc animée, et le système de theming dark/light en OKLCH.

---

## Mon rôle
UI/UX et intégration 3D — 158 commits (94 de code, 64 merges), 33 PRs mergées

## Tech
TypeScript · React · Plasmo · Three.js · Shaders GLSL · GraphQL · WebSocket · wagmi · viem · INTUITION Protocol

## Team
6 développeurs (stage THP) · Mentor : Jérémie Olivier

## Liens
- [GitHub](https://github.com/intuition-box/Extension)

---

---

# Analyse détaillée des contributions de Paul sur l'Extension Chrome

*(Basée sur l'analyse exhaustive de toutes les PRs)*

## Classement des contributeurs

| Rang | Contributeur | Commits |
|------|-------------|---------|
| 1 | JamesDev292 | 315 |
| **2** | **Dev-Moulin** | **158** (94 code + 64 merges) |
| 3 | Warzieram | 97 |
| 4 | Alexe-M | 90 |
| 5 | ZainebPadilla | 65 |
| 6 | jeremie-olivier | 64 |

## PRs de Paul — 33 mergées sur 37 créées

### Scaffold & Setup (PRs #1, #2, #7)
- Structure initiale de fichiers et dossiers
- Setup Tailwind, ThemeProvider, config Plasmo

### Theming (PRs #15, #32, #77, #90, #92, #102)
- ThemeProvider dark/light mode
- Couleurs OKLCH pour le theming
- CSS global (26 commits sur global.css — contributeur dominant)

### Navigation (PRs #37, #197, #217)
- NavbarUp avec icônes
- Animations Navbar CSS
- **NavArc** — navigation circulaire en arc (100% Paul)
- NavigationProvider, IntuitionNavSwitch

### Icônes & Branding (PRs #15, #55, #59, #68, #73)
- Icônes Intuition custom (IntuitionIcon, IntuitionIconPlus, IntuitionPortalPanel)
- Favicon de l'extension

### Composants UI (PRs #85, #92, #97)
- **HoverCard** — popup au hover sur les atoms
- **PopupAtom** — affichage atom inline
- **ImageWithFallback** — composant image avec fallback
- useAtomInteraction hook, AtomSelectionContext

### Particules (PRs #101, #104, #116, #196)
- **ParticlesCanvas** — particules background avec connexions (100% Paul)
- **GroupParticlesCanvas** — groupes interactifs avec attraction souris (100% Paul)
- Optimisations performance, fix pointer events

### Œil 3D (PR #233)
- **EyeComponent** — composant React principal (100% Paul)
- **useEyeScene** — hook Three.js avec scène complète
- **IrisShader** — shader GLSL custom pour l'iris pulsante
- **useIrisMaterial / useAnneauxMaterial** — matériaux custom
- **AnneauxPresets / IrisPresets** — presets de couleur
- Bloom sélectif dans le contexte d'une extension Chrome
- 14 fichiers, création complète

### Formulaires & UX (PRs #40, #46, #49, #70, #108, #111)
- Ajustements visuels AtomForm, TripleForm
- Barre de recherche avec icône
- Routing boutons, backgrounds

### Fixes CSS divers (PRs #39, #43, #51)
- Corrections de background, couleurs, alignements

### Rôle de reviewer (11 PRs d'autres mergées)
- 10 PRs de JamesDev292
- 1 PR de ZainebPadilla

## 4 PRs NON mergées
- #6 : Brouillon explicite ("DONT MERGE!!!")
- #80 : Supersédée par #79
- #95 : Abandonnée
- #200 : Doublon de #217

## Propriété des features visuelles

| Feature | Créateur | Exclusif à Paul ? |
|---------|----------|-------------------|
| Œil 3D (components/3D/*) | **Paul** | **Oui — 100%** |
| ParticlesCanvas | **Paul** | **Oui — 100%** |
| GroupParticlesCanvas | **Paul** | **Oui — 100%** |
| NavArc | **Paul** | **Oui — 100%** |
| NavigationProvider | **Paul** | **Oui — 100%** |
| ThemeProvider | **Paul** | ~95% (1 commit mineur d'autre) |
| HoverCard | **Paul** (création) | Non — Alexe-M et JamesDev292 ont contribué ensuite |
| PopupAtom | **Paul** (création) | Non — 5 autres ont touché le fichier ensuite |
| global.css | **Paul** (26 commits) | Non — 4 autres ont contribué (6 commits) |
| Icônes | Paul (8 commits) | Non — JamesDev292 a 9 commits sur le même dossier |
| Navbar | Paul (12 commits) | Non — 4 autres ont contribué (17 commits) |

## Ce qui N'EST PAS de Paul

- **Navbar initiale** — créée par Alexe-M (PR #4), Paul l'a restylee
- **Floating button (bouton flottant)** — ZainebPadilla
- **Connexion wallet MetaMask** — Warzieram + JamesDev292
- **Formulaires fonctionnels** (AtomForm logic, TripleForm logic, vote) — JamesDev292
- **Requêtes GraphQL** — Alexe-M, Warzieram, JamesDev292
- **Feed / Live feed** — JamesDev292 + Warzieram
- **Router sidepanel** — Alexe-M (PR #3)
- **Système de tags** — Alexe-M / JamesDev292

## Contributions non mentionnées précédemment

- **PR #85** : Système HoverCard complet (15 fichiers) — interaction UI complexe
- **PR #97** : ImageWithFallback + useAtomInteraction — architecture UI propre
- **PR #96** : Fix GraphQL (ajout IDs aux queries) — contribution data, pas juste visuel
- **Rôle de reviewer** : 11 PRs d'autres mergées par Paul

## Vérification des affirmations

| Affirmation | Verdict | Réalité |
|---|---|---|
| "158 commits" | **VRAI** | 158 exact (94 code + 64 merges) |
| "37+ PRs mergées" | **INEXACT** | 33 mergées (sur 37 créées). 4 non mergées |
| "2ème contributeur" | **CONFIRMÉ** | 158 vs 315 (JamesDev292) |
| "Toute la partie visuelle" | **TROP ABSOLU** | Paul a créé les features visuelles *distinctives* (3D, particules, NavArc, theming). Mais d'autres ont aussi contribué à l'UI (Alexe-M, ZainebPadilla, JamesDev292) |
| "Œil 3D = Paul" | **CONFIRMÉ 100%** | PR #233, 14 fichiers, aucun autre contributeur |
| "Particules = Paul" | **CONFIRMÉ 100%** | PRs #101, #104, #116, #196 |
| "NavArc = Paul" | **CONFIRMÉ 100%** | PR #217 |
| "Theming = Paul" | **CONFIRMÉ ~95%** | Créé et maintenu par Paul, 1 commit mineur d'autre |
| "Identité visuelle complète" | **PARTIELLEMENT VRAI** | Paul a créé l'identité visuelle distinctive. Mais la Navbar initiale = Alexe-M, le floating button = ZainebPadilla, les icônes sont partagées |
