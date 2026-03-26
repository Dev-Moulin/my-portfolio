# Analyse — Intuition Chrome Extension

> Extension de navigateur Web3 pour la détection de confiance/scam décentralisée
> Repo : https://github.com/intuition-box/Extension
> Organisation : Intuition Box (stage THP Dev++)

---

## A. Vue d'ensemble

**Description :**
Extension Chrome/Firefox construite avec Plasmo qui permet aux utilisateurs d'interagir avec le **protocole Intuition** — un système d'attestation décentralisé on-chain. L'extension détecte si un site web est signalé comme scam ou approuvé par la communauté, via des claims ancrées sur la blockchain avec des bonding curves.

**Problème résolu :**
La confiance en ligne repose sur des bases de données centralisées (listes de phishing). Cette extension propose un **système de confiance décentralisé** où la communauté vote on-chain avec des incentives économiques ($TRUST tokens via bonding curves) pour signaler ou approuver des sites.

**Contexte :**
- **Stage THP Dev++** — projet d'équipe (6 développeurs)
- Créé le 19 mars 2025
- Dernière activité : 20 janvier 2026
- Version 0.1.51
- 9 étoiles, 38 issues ouvertes
- Migration mainnet en cours

**Équipe (6 contributeurs) :**
| Contributeur | Commits | Rôle |
|---|---|---|
| JamesDev292 | 315 | Lead dev, intégrations Web3, architecture |
| **Dev-Moulin (Paul)** | **158** | **UI/UX, 3D Overmind, navigation, particules, theming** |
| Warzieram | 97 | Package GraphQL, queries, migrations SDK |
| Alexe-M | 90 | Features UI (profil, identité, feed) |
| ZainebPadilla | 65 | Bouton flottant, notifications, atom display |
| jeremie-olivier | 64 | Contributions variées |

---

## B. Stack Technique Complète

### Extension
| Technologie | Version | Rôle |
|---|---|---|
| Plasmo | 0.90.3 | Framework extension (Manifest V3 Chrome / V2 Firefox) |
| Chrome APIs | — | scripting, tabs, activeTab, sidePanel, storage |

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| React | 18.2 | Framework UI |
| TypeScript | 5.4 | Typage |
| React Router DOM | 7.3 | Routing interne (popup + sidepanel) |
| Tailwind CSS | 3.3 | Styling + dark/light theme |
| Radix UI | — | Composants (dropdown, hover-card, collapsible, switch) |
| Lucide React | — | Icônes |
| class-variance-authority | — | Styling conditionnel |

### Web3
| Technologie | Version | Rôle |
|---|---|---|
| viem | 2.23 | Client blockchain TypeScript |
| @0xintuition/protocol | 2.0.0-alpha.4 | ABI MultiVault + helpers deposit |
| @0xintuition/sdk | 2.0.0-alpha.4 | Création Atoms/Triples haut niveau |
| @0xintuition/graphql | 2.0.0-alpha.4 | Queries GraphQL officielles |
| metamask-extension-provider | — | Connexion MetaMask depuis l'extension |
| Blockchain | — | Intuition L3 (testnet ID 13579, mainnet ID 1155) |

### GraphQL & Data
| Technologie | Version | Rôle |
|---|---|---|
| Apollo Client | 3.13 | Queries + cache + split link HTTP/WS |
| graphql-ws | — | Subscriptions temps réel |
| TanStack Query | 5.69 | State async non-GraphQL |
| @warzieram/graphql | workspace | Package custom avec codegen TypeScript |

### 3D (Intégration Overmind)
| Technologie | Rôle |
|---|---|
| Three.js 0.175 | Moteur WebGL |
| GLTFLoader + DRACOLoader | Chargement modèle compressé |
| RGBELoader | Éclairage HDR (Poly Haven) |
| UnrealBloomPass | Bloom sélectif post-processing |
| Shaders GLSL custom | IrisShader avec pulsation animée |

### Outils & CI/CD
| Outil | Rôle |
|---|---|
| pnpm 10.5 | Monorepo workspace |
| Prettier | Formatting |
| GitHub Actions | Build Chrome+Firefox sur PR, release, deploy web stores |
| Umami | Analytics self-hosted |

---

## C. Architecture du Code

### Structure
```
src/
  background.ts                  # Service worker (message routing, sidepanel)
  popup/index.tsx                # Point d'entrée popup (600x600px)
  sidepanel/index.tsx            # Point d'entrée side panel
  contents/
    plasmo-inline.tsx            # Content script : bouton flottant sur chaque page
  components/
    3D/                          # Œil Overmind (EyeComponent, useEyeScene, IrisShader, presets)
    icons/                       # 11 composants SVG custom
    layout/                      # NavArc, Navbar, NavigationProvider
    profile/                     # 11 composants profil (tabs, sections)
    ui/                          # AtomDisplay, ClaimRowLite, PopupAtom, HoverCard, ParticlesCanvas
    AtomForm.tsx                 # Formulaire création atom on-chain
    TripleForm.tsx               # Formulaire création triple(s) batch
    VoteButtons.tsx              # Boutons for/against avec deposit
    SignUpForm.tsx               # Inscription identité on-chain
    WalletConnectionButton.tsx   # Connexion MetaMask
    WarningPopup.tsx             # Popup scam/trustworthy overlay
    ReportDropdown.tsx           # Signal dropdown
    TagCreator.tsx               # Création de tags sur atoms
    ThemeProvider.tsx             # Dark/light theme
  hooks/                         # 14 hooks custom
  lib/                           # Config, Apollo, MetaMask, viem, URL utils, Umami
  pages/                         # 9 pages (Home, Feed, Profile, Search, PageForm, AtomDetail, Tags...)
  types/                         # Types atoms, images
packages/graphql/                # Workspace: @warzieram/graphql (codegen, queries custom)
.github/workflows/               # CI/CD (build-zip, release, submit)
```

### Flux de Communication
```
Content Script (plasmo-inline.tsx)
  → Query GraphQL : claims existantes sur l'URL courante
  → Affiche bouton flottant avec indicateur couleur (rouge/vert)
  → Stocke dans chrome.storage.local
       ↕ chrome.runtime.sendMessage / ports
Background Service Worker (background.ts)
  → Route messages entre composants
  → Gère ouverture sidepanel avec navigation par route
  → Relay messages de refresh vers tous les tabs
       ↕
Popup / Sidepanel (React SPA)
  → Interface complète : profil, feed, recherche, votes, création atoms/triples
  → Apollo Client + WebSocket subscriptions
  → Connexion wallet MetaMask
```

---

## D. Fonctionnalités Clés

### Cœur — Détection Scam/Trust
- Pour chaque page visitée, query les triples `[URL] IS [SCAM]` ou `[URL] IS [TRUSTWORTHY]`
- **Bouton flottant** injecté sur toutes les pages HTTPS — draggable, indicateur couleur
- **Warning Popup** animée avec vote for/against quand un site est signalé
- **Signal dropdown** pour signaler un site (crée atom URL + triple + dépôt)

### Interactions Web3
- Connexion MetaMask depuis le contexte d'extension
- Création d'Atoms on-chain (identités, URLs, tags)
- Création batch de Triples (claims relationnelles : Sujet - Prédicat - Objet)
- Dépôt dans vaults via MultiVault (votes FOR/AGAINST avec bonding curves)
- Switch de chain automatique (testnet/mainnet)
- Simulation pré-transaction, gestion slippage (1%), vérification balance
- Inscription on-chain (atom identité personnelle avec pin IPFS)

### Social & Feed
- **Feed d'activité** des utilisateurs suivis (triple `[I] FOLLOWS [user]`)
- **Live Feed temps réel** via WebSocket subscriptions GraphQL
- **Profil utilisateur** multi-onglets (Claims, Positions, Identities, Followers, Following)
- **Recherche full-text** sur les triples avec filtres et scroll infini
- **Tags** sur les atoms avec autocomplete

### 3D — Œil Overmind
- Modèle GLB chargé avec Three.js dans l'extension
- **Bloom sélectif** post-processing
- **Shaders GLSL custom** pour l'iris avec pulsation animée
- **Anneaux rotatifs** avec presets matériaux
- **Suivi du curseur** (lookAt via raycaster)
- **Presets de couleur par état** : bleu (normal), rouge (alerte/scam), vert (calme/trustworthy)

### UI/UX
- **Navigation en arc** (NavArc) — icônes sur un demi-cercle responsive
- **Système de particules dual** — background statique + groupes interactifs avec attraction souris
- **Theme dark/light** avec variables CSS
- **Auto-fill formulaires** — extraction automatique titre/description/favicon de la page active
- Popup 600x600px + sidepanel étendu
- Analytics Umami

---

## E. Points Forts Techniques

### 1. Three.js dans une Extension Chrome
Intégrer un moteur 3D avec bloom sélectif et shaders GLSL custom dans le contexte contraint d'une extension Chrome est un défi technique rarement vu. L'œil qui change de couleur selon l'état de confiance du site donne une "personnalité" à l'extension.

### 2. Architecture Plasmo Bien Structurée
Séparation claire content script / background / popup / sidepanel avec communication par messages et ports Chrome. Shadow DOM pour l'isolation CSS du content script.

### 3. Intégration Web3 Sophistiquée
viem (moderne, type-safe) avec simulation pré-transaction, gestion slippage, détection automatique curve ID, switch chain automatique, vérification balance avant soumission.

### 4. Hook `useDepositTerm`
20 tentatives de résolution du minimum deposit, preview de shares, simulation avant envoi, messages d'erreur décodés depuis l'ABI. Code robuste.

### 5. GraphQL Subscriptions Temps Réel
Live Feed via WebSocket dans une extension Chrome — updates en temps réel des événements blockchain.

### 6. Batch Operations On-Chain
`batchCreateTripleStatements` permet de créer plusieurs triples en une seule transaction avec feedback progressif.

### 7. Package GraphQL Custom
Workspace monorepo avec codegen TypeScript, queries fortement typées — approche professionnelle.

---

## F. Points d'Amélioration Potentiels

| Sujet | Détail |
|---|---|
| **README** | Template Plasmo par défaut — aucune doc sur le projet, l'archi, ou comment contribuer |
| **Console.log** | Énormément de logs debug en production avec émojis |
| **Tests** | Malgré vitest dans les deps, quasi aucun test visible |
| **Gestion d'erreur** | Incohérente — certains try/catch, d'autres `.catch(() => {})` silencieux |
| **Typage** | Utilisation fréquente de `any` (claims, events, atoms) |
| **Dépendance inutile** | ethers 6.15 dans les deps mais code utilise exclusivement viem |
| **Magic numbers** | IDs d'atoms hardcodés, coûts fixes, timeouts arbitraires |
| **Pas de gestion offline** | Aucun fallback si RPC ou GraphQL indisponible |
| **Performance 3D** | HDR chargé depuis Poly Haven + Draco depuis gstatic.com à chaque montage |
| **Licence** | Absente du repository |

---

## G. "Wow Factors"

### 1. L'Œil 3D Qui Suit la Souris
Three.js dans une extension Chrome avec bloom sélectif, shaders GLSL custom, et presets de couleur par état (bleu/rouge/vert = normal/scam/trust). L'extension a littéralement une "personnalité visuelle" — c'est unique.

### 2. Trust Décentralisé On-Chain
Le concept est puissant : remplacer les listes de phishing centralisées par un consensus communautaire on-chain avec incentives économiques. C'est une vraie innovation Web3.

### 3. Navigation en Arc
UI originale — les icônes positionnées sur un demi-cercle responsive avec switch arc/classique. Design UX créatif rarement vu.

### 4. Système de Particules Interactif
Particules background + groupes avec attraction gravitationnelle vers la souris, connexions dynamiques, adaptation responsive.

### 5. Live Feed Blockchain Temps Réel
WebSocket subscriptions dans une extension Chrome affichant les transactions en direct.

### 6. Batch Triple Creation avec Vote Intégré
Créer plusieurs claims relationnelles, voter sur chacune, tout soumettre en une seule opération multi-transaction séquencée.

---

## H. Contributions de Paul (Dev-Moulin) — 158 commits, 37+ PRs

### Contribution majeure : toute la couche visuelle et créative

**1. Œil 3D Overmind Complet** (PR #233)
- `EyeComponent.tsx` — Composant React principal
- `useEyeScene.ts` — Hook Three.js avec scène complète (caméra, renderer, bloom, animations)
- `IrisShader.ts` — Shader GLSL custom pour iris pulsante
- `useIrisMaterial.ts` / `useAnneauxMaterial.ts` — Application matériaux avec presets
- `AnneauxPresets.ts` + `IrisPresets.ts` — Presets couleur/émission
- Optimisation taille GLB

**2. Système de Particules** (PRs #101, #104, #116, #196)
- `ParticlesCanvas.tsx` — Particules background avec connexions
- `GroupParticlesCanvas.tsx` — Groupes interactifs avec attraction souris
- Optimisation performances + correction pointer events

**3. Navigation** (PRs #37, #197, #217)
- `NavArc.tsx` — Navigation circulaire en arc
- `Navbar.tsx` / `NavbarUp.tsx` — Barres de navigation
- `NavigationProvider.tsx` — Provider avec switch arc/classic
- Animations navbar

**4. Theming & CSS** (PRs #32, #77, #90, #92)
- Système dark/light mode
- Variables OKLCH pour le theming
- CSS global, intégration popup + sidepanel

**5. Composants UI** (PRs #73, #85, #97, #102)
- `PopupAtom` + `HoverCard` — Popups au hover
- `IntuitionButtonIcon.tsx` — Icône animée SVG avec anneaux rotatifs
- Icônes SVG custom multiples
- Favicon integration

**6. Formulaires & UX** (PRs #40, #46, #49, #70, #108, #111)
- Améliorations visuelles AtomForm / TripleForm
- Barre de recherche, routing boutons, auto-resize textarea

**7. Infrastructure initiale** (PRs #1, #2, #7, #15)
- Structure initiale de fichiers
- Setup initial du theming
- Première navbar

### Synthèse
> Paul a apporté toute la **couche visuelle et créative** de l'extension. Le système 3D (œil Overmind), les particules, la navigation arc, le theming, et les icônes custom sont tous de lui. Il a transformé une extension Web3 fonctionnelle mais basique en un produit **visuellement distinctif avec une identité forte**.

---

## I. Résumé pour le Portfolio

### Tagline suggérée
> "Intuition Extension — Extension Chrome Web3 qui détecte les sites scam via consensus communautaire décentralisé, avec un œil 3D animé comme indicateur visuel"

### Pitch en 3 phrases
Pendant mon stage THP chez Intuition Box, j'ai co-développé une extension Chrome/Firefox qui détecte en temps réel si un site web est signalé comme scam ou approuvé par la communauté, via des attestations ancrées on-chain sur le protocole Intuition. Ma contribution principale a été l'intégration d'un œil 3D Overmind (Three.js + shaders GLSL custom) dont la couleur change selon l'état de confiance du site — rouge pour scam, vert pour approuvé — ainsi que le système de particules interactif, la navigation en arc, et le theming complet. L'extension utilise Apollo GraphQL avec subscriptions WebSocket pour un feed temps réel des votes de la communauté.

### Métriques à mettre en avant
- 6 développeurs, 158 commits personnels, 37+ PRs mergées
- 2ème contributeur de l'équipe
- Œil 3D avec bloom sélectif + shaders GLSL dans une extension Chrome
- Feed temps réel via WebSocket subscriptions
- Support Chrome (Manifest V3) + Firefox (V2)
- CI/CD complète (build, release, deploy web stores)

### Stack badges
`React 18` `TypeScript` `Plasmo` `Three.js` `GLSL Shaders` `viem` `Apollo GraphQL` `WebSocket` `Tailwind CSS` `Radix UI` `Intuition Protocol` `Chrome Extension` `GitHub Actions`

---

## J. Lien avec les Autres Projets

> **Overmind 3D Controller → Extension → Portfolio :** Le projet Overmind (œil 3D standalone) a été adapté pour l'extension Chrome (version allégée avec presets par état), puis l'architecture XState + Three.js a évolué vers le portfolio actuel. C'est une **progression technique** claire à raconter : prototype 3D → intégration produit → outil créatif complet.
