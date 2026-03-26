# Analyse — Overmind Founders Collection

> Plateforme de vote communautaire Web3 sur le protocole INTUITION
> Repo : https://github.com/Dev-Moulin/Overmind_Founders_Collection
> Demo : https://dev-moulin.github.io/Overmind_Founders_Collection/

---

## A. Vue d'ensemble

**Description :**
Plateforme de vote collaborative Web3 construite sur le protocole INTUITION. La communauté vote pour attribuer des "totems" symboliques (animaux, objets, traits, énergies) aux 42 fondateurs du protocole. Les totems gagnants seront transformés en œuvres NFT 3D.

**Problème résolu :**
Créer un mécanisme de gouvernance communautaire décentralisée où chaque fondateur reçoit un symbole totemique choisi collectivement, en utilisant les tokens $TRUST via des bonding curves.

**Contexte :**
- Créé le 18 novembre 2025
- Dernière mise à jour : 17 février 2026
- Déployé et fonctionnel sur GitHub Pages
- Licence MIT

---

## B. Stack Technique Complète

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| React | 19.2 | Framework UI |
| TypeScript | 5.9 | Typage statique |
| Vite | 7.2 | Bundler |
| Tailwind CSS | v4 | Styling utilitaire |
| react-router-dom | v7.9 | Routing SPA |
| recharts | v3.5 | Graphiques de trading |
| reagraph | v4.30 | Visualisation de graphes |
| lucide-react | — | Icônes |
| sonner | — | Notifications toast |
| react-hook-form + zod | v7.66 / v4.1 | Formulaires + validation |
| fuse.js | v7 | Recherche fuzzy |
| react-i18next | v16 | Internationalisation EN/FR |
| DOMPurify | — | Sécurité XSS |

### Web3
| Technologie | Version | Rôle |
|---|---|---|
| wagmi | v2.19 | Interactions Ethereum |
| viem | v2.39 | Client blockchain |
| RainbowKit | v2.2 | Connexion wallet |
| @0xintuition/sdk | v2.0.0-alpha.4 | Création Atoms/Triples |
| @0xintuition/protocol | v2.0.0-alpha.4 | ABI MultiVault, chain config |
| Apollo Client | v3.11 | Requêtes GraphQL |
| graphql-ws | v6 | Subscriptions WebSocket temps réel |
| TanStack Query | v5.90 | Data fetching/caching |

**Blockchain cible :** INTUITION L3 (Layer 3 sur Base) + Base Mainnet (vérification NFT cross-chain)

### APIs Externes
- **Pinata** — Upload images IPFS
- **INTUITION GraphQL API** (Hasura) — HTTP + WebSocket
- **WalletConnect** — Via RainbowKit

### Outils & CI/CD
| Outil | Rôle |
|---|---|
| pnpm v10.5 | Monorepo workspace |
| Vitest v4 | Tests unitaires |
| Playwright v1.56 | Tests E2E |
| @testing-library/react v16 | Tests composants |
| GitHub Actions | CI/CD (tests + deploy) |
| Codecov | Couverture de code |

---

## C. Architecture du Code

### Structure monorepo
```
/
  apps/web/                    # Application principale
    src/
      components/              # Composants UI par domaine
        admin/                 # Panel d'administration (audit, CRUD atoms)
        common/                # Boutons, notifications, switch langue
        founder/               # Cards, panels, formulaire création totem
          AlphabetIndex/       # Dock A-Z style macOS
          FounderCenterPanel/  # Grille totems + "My Votes"
          VoteTotemPanel/      # 11 sous-composants vote
        graph/                 # TradingChart, RelationsRadar, TopTotemsRadar
        layout/                # Header, Footer, NetworkGuard, NetworkSwitch
        modal/                 # ClaimExistsModal, WithdrawModal
        vote/                  # VoteCartPanel, MultiFounderCartDropdown
      hooks/                   # ~50 hooks custom en 9 domaines
        admin/                 # CRUD atoms
        blockchain/            # Smart contracts (atoms, triples, batch, vault)
        cart/                  # Panier de votes (localStorage)
        config/                # Protocol config, network, whitelist NFT
        data/                  # Requêtes GraphQL (13+ hooks)
        search/                # Recherche fuzzy
        ui/                    # Effets visuels (text scramble, alphabet index)
        utils/                 # Focus window, resize
        vote/                  # 12 hooks vote
      lib/                     # Apollo client, GraphQL queries/subscriptions
      config/                  # wagmi, chains, constantes, couleurs
      contexts/                # FoundersDataContext, VoteCartContext
      i18n/                    # Traductions EN/FR
      types/                   # 10 fichiers de types TypeScript
      utils/                   # Vote aggregation, formatters, IPFS upload
      pages/                   # HomePage3DCarousel, AdminAudit, NotFound
    e2e/                       # 4 specs Playwright
    test/                      # Setup vitest + tests unitaires
  packages/shared/             # Données partagées (founders.json, predicates.json)
  scripts/                     # Script création atoms on-chain
  .github/workflows/           # CI/CD
```

### Patterns notables
- **~50 hooks custom** organisés en 9 domaines avec barrel exports documentés
- **Facade pattern** : `useIntuition()` combine atoms + triples + claims
- **Context Providers** : FoundersDataContext + VoteCartContext
- **Lazy loading** : pages admin et 404
- **ThrottleLink Apollo custom** : rate limiting avec retry exponentiel
- **localStorage persistence** : panier multi-fondateur entre sessions
- **Cross-chain verification** : NFT gate sur Base Mainnet, app sur INTUITION L3
- **Memoization systématique** : `useMemo` sur tous les returns de hooks

---

## D. Fonctionnalités Clés

### Interactions Web3
- Connexion wallet via RainbowKit (MetaMask, Coinbase, WalletConnect...)
- Vérification NFT cross-chain (balanceOf ERC-721 sur Base Mainnet)
- Création d'Atoms on-chain (identités fondateurs, totems, catégories)
- Création de Triples on-chain (relations sujet-prédicat-objet)
- Dépôt dans vaults via `depositBatch` sur MultiVault (votes FOR/AGAINST)
- Retrait de vaults via `redeemBatch` (récupération $TRUST)
- 2 types de bonding curves : Linear (1:1) et Progressive (récompense early adopters)
- Batch transactions : multiple votes en une seule transaction
- Preview deposit/redeem avec slippage protection (2%)
- Switch réseau automatique (Testnet/Mainnet)

### Système de Vote
- Support et Opposition (FOR/AGAINST)
- 2 courbes de bonding : Linear et Progressive
- Détection automatique de position existante
- Changement de direction avec retrait obligatoire préalable
- Cross-predicate blocking (règles métier complexes)
- Montant minimum requis calculé dynamiquement
- Preview du vote avant exécution
- Accumulation dans le panier (même totem = montants additionnés)

### UI/UX
- **Carrousel 3D CSS** avec 42 cartes (rotation molette + swipe tactile)
- **Flip progressif** des cartes (5 niveaux d'angle selon la distance au centre)
- **Auto-snap** sur la carte la plus proche après rotation
- **Dock alphabétique A-Z** style macOS avec magnification au hover
- **Layout 3 panneaux** (Info | Totems | Vote) pour vue détaillée
- **Graphiques de trading temps réel** (FOR/AGAINST par courbe)
- **Radar radial** fondateur-totems
- **Effet "text scramble" glitch** sur les statistiques
- **Titre avec effet glitch CSS** (scanlines overlay)
- **Formulaire création totem** avec upload image IPFS (drag & drop)
- **Recherche fuzzy** pour catégories + détection de doublons
- **Panier multi-fondateur** avec persistence localStorage
- **Internationalisation complète** EN/FR
- **Glass morphism design** (blur, transparences, mode sombre)
- **Notifications toast** (sonner)
- **WebSocket subscriptions** avec auto-pause quand onglet caché

---

## E. Points Forts Techniques

### 1. ThrottleLink Apollo Custom
Rate limiter sophistiqué pour Apollo Client avec queue, max concurrent, retry exponentiel sur 429. Gère même les erreurs CORS qui masquent les 429. Code production-grade.

### 2. Architecture Hooks Exhaustive
~50 hooks custom organisés en 9 domaines. Barrel export massif (200+ lignes) avec documentation JSDoc complète. Memoization systématique.

### 3. Batch Vote Orchestration
Pipeline multi-étapes (création atoms → création triples → redeems → deposits) en une seule transaction utilisateur. Gère les cas limites (totem existant, counter-stake, vault non initialisé).

### 4. Cross-Chain NFT Gating
Vérification d'éligibilité sur Base Mainnet (balanceOf ERC-721) pendant que l'app fonctionne sur INTUITION L3. Pattern élégant pour le multi-chain.

### 5. WebSocket Subscriptions Intelligentes
Temps réel via GraphQL subscriptions (Hasura). Auto-pause quand l'onglet est caché, auto-resume au retour.

### 6. Carrousel 3D Pur CSS/JS
42 cartes en cercle avec rotation fluide, flip progressif, auto-snap, support molette + touch. Workaround documenté pour bug Chromium backdrop-filter + preserve-3d.

### 7. Typage TypeScript Rigoureux
10 fichiers de types dédiés, generics, discriminated unions, type guards. Export massif avec `type` keyword.

### 8. CI/CD Complète
Tests unitaires (Vitest) + E2E (Playwright) + type-check + couverture Codecov + deploy automatique GitHub Pages.

### 9. Script de Seeding On-Chain
Script standalone pour créer les 42 atoms fondateurs sur la blockchain avec gestion intelligente des images (cascade Twitter > GitHub > DiceBear), détection des atoms existants, et retry.

---

## F. Points d'Amélioration Potentiels

| Sujet | Détail |
|---|---|
| **Tests** | Couverture probablement faible (~2-3 fichiers tests unitaires, 4 specs E2E) pour ~50 hooks et ~30 composants |
| **Linter** | Pas d'ESLint, Prettier ou Biome visible. Le CI fait `tsc --noEmit` mais pas de lint |
| **Console.log** | Beaucoup de `console.log('[useVoteCart]')` en production — besoin d'un logger conditionnel |
| **Fichier backup** | `VoteTotemPanel.original.tsx` conservé dans le repo (devrait être dans l'historique Git) |
| **Error Boundaries** | Pas de composant ErrorBoundary React visible — un crash enfant fait tomber toute l'app |
| **GraphQL errors** | `errorPolicy: 'all'` partout peut masquer des erreurs partielles silencieusement |
| **SEO** | SPA sans SSR, un seul `index.html`, pas de meta tags dynamiques |
| **Accessibilité** | Manque d'`aria-label` sur le carrousel 3D et le dock alphabétique |
| **Storybook** | Absent — serait précieux pour documenter les composants UI sophistiqués |
| **SDK alpha** | Dépendance à `@0xintuition/sdk` en `2.0.0-alpha.4` — API potentiellement instable |

---

## G. "Wow Factors" — Ce Qui Rend Ce Projet Unique

### 1. dApp Réelle et Déployée
Ce n'est pas un prototype. C'est une application fonctionnelle déployée sur une vraie L3 avec de vrais smart contracts, des bonding curves, et des transactions on-chain. La démo live est accessible.

### 2. Carrousel 3D Immersif
L'UI est spectaculaire — carrousel CSS 3D avec 42 cartes, flip progressif, dock A-Z style macOS, effets glitch/scanlines. Visuellement impressionnant et techniquement non trivial.

### 3. Complexité Métier Maîtrisée
Le système de vote gère les courbes Linear/Progressive, positions FOR/AGAINST, changements de direction avec retrait, cross-predicate blocking, batch multi-fondateur — avec une UX fluide.

### 4. Architecture Production-Grade
Monorepo pnpm, ~50 hooks custom organisés, rate limiting Apollo, WebSocket subscriptions avec auto-pause, persistence localStorage, CI/CD complète. Le code est structuré comme un vrai produit.

### 5. Intégration Protocole INTUITION
Utilisation avancée du Knowledge Graph d'INTUITION (Atoms, Triples, Vaults, Bonding Curves). Montre une compréhension profonde d'un protocole Web3 complexe.

### 6. Le Concept Artistique
L'idée de voter pour attribuer des totems symboliques aux fondateurs, avec la promesse de NFT 3D, est originale et différenciante. Ça raconte une histoire.

### 7. Temps Réel
WebSocket subscriptions pour mises à jour en direct des votes, combinées aux graphiques de trading. Application vivante et réactive.

---

## H. Résumé pour le Portfolio

### Tagline suggérée
> "Overmind Founders Collection — Plateforme de gouvernance communautaire Web3 où 42 fondateurs reçoivent leur totem symbolique par vote décentralisé sur bonding curves"

### Pitch en 3 phrases
J'ai conçu et développé une dApp complète permettant à la communauté INTUITION de voter collectivement pour attribuer des totems symboliques à ses 42 fondateurs. Le système utilise des bonding curves ($TRUST tokens) pour pondérer les votes, avec support/opposition, batch transactions, et graphiques temps réel via WebSocket. L'interface propose un carrousel 3D immersif de 42 cartes avec flip progressif, dock alphabétique et effets visuels glassmorphism.

### Métriques à mettre en avant
- 42 fondateurs avec profils on-chain
- ~50 hooks custom organisés en 9 domaines
- 2 types de bonding curves (Linear + Progressive)
- Internationalisation EN/FR
- CI/CD complète (Vitest + Playwright + Codecov + GitHub Pages)
- Cross-chain : app sur L3, vérification NFT sur Base Mainnet

### Stack badges
`React 19` `TypeScript` `Vite` `Tailwind v4` `wagmi` `viem` `RainbowKit` `Apollo GraphQL` `WebSocket` `INTUITION Protocol` `Three.js (prévu)` `Vitest` `Playwright` `GitHub Actions`
