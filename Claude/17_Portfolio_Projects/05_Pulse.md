# Analyse — Pulse

> Web3 Community Sentiment Tool — MiniApp Worldcoin
> Repo : https://github.com/intuition-box/Pulse
> Contexte : Hackathon ETH Global Cannes (juillet 2025) — Projet abandonné

---

## A. Vue d'ensemble

**Description :**
Application Web3 de sondage communautaire construite comme MiniApp pour le Worldcoin MiniApp Marketplace. Permet aux communautés Web3 de capturer le "pouls" de leur audience sur des sujets Ethereum (DeFi, GameFi, IA, DID...) via un système de cartes swipables à la Tinder, avec l'ambition d'ancrer les votes dans le protocole Intuition.

**Problème résolu :**
Les DAOs et protocoles ont besoin de mesurer le sentiment communautaire de manière fiable. Pulse propose un vote par swipe (rapide, mobile-first, fun) avec résistance Sybil via World ID et réputation décentralisée via Intuition.

**Contexte :**
- **Hackathon ETH Global Cannes** — juillet 2025
- Sprint de 48h (4-6 juillet 2025), dernier push le 10 juillet
- Équipe de 3 développeurs
- **Le projet n'a pas pu être livré** — incompatibilité fondamentale entre Worldcoin MiniKit et Intuition Protocol (voir section K)
- Projet abandonné depuis — aucune activité après le 10 juillet
- 1 star, 0 forks, 3 issues ouvertes

**Équipe (3 contributeurs) :**
| Contributeur | Commits | Rôle |
|---|---|---|
| **Dev-Moulin (Paul)** | **22 (58%)** | **Développeur principal — toutes les features front-end** |
| SamuelChauche | 13 | Setup initial, démo Vite, README, CI/CD |
| jeremie-olivier | 3 | Initial commit, CNAME, issues (chef de projet/product) |

---

## B. Stack Technique Complète

### Le projet contient 2 apps :

**1. Landing Page (racine)** — Vite + React 19 + Tailwind CSS 4 + Radix UI

**2. App Principale (`pulse-mini-app/`)** — Next.js 15

| Technologie | Version | Rôle |
|---|---|---|
| Next.js | 15.2.3 | Framework (App Router) |
| React | 19 | UI |
| TypeScript | 5 | Typage |
| Tailwind CSS | 4 | Styling |
| @worldcoin/minikit-js + react | — | SDK MiniApp complet |
| @worldcoin/mini-apps-ui-kit-react | — | Composants officiels World App |
| viem | 2.23.5 | Client Ethereum (World Chain) |
| next-auth | 5.0.0-beta.25 | Authentification |
| eruda | — | Console debug mobile in-browser |

**Smart Contract :** ABI ERC20 sur World Chain (`0xF088...2522`)

**Note importante :** Aucun SDK Intuition installé. L'intégration reste conceptuelle (les questions ont un `rdfTriple` dans le JSON, mais aucun code n'envoie ces triplets on-chain).

---

## C. Architecture du Code

```
Pulse/
├── .env                              # ⚠️ SECRETS EXPOSÉS (AUTH_SECRET, HMAC, APP_ID)
├── package.json                      # Landing page Vite
├── public/questions.json             # 58 questions (landing)
│
└── pulse-mini-app/                   # APP PRINCIPALE
    └── src/
        ├── app/
        │   ├── layout.tsx            # Root layout (auth + providers)
        │   ├── page.tsx              # Login (AuthButton)
        │   ├── api/
        │   │   ├── auth/[...nextauth]/   # NextAuth handler
        │   │   ├── verify-proof/         # World ID verification
        │   │   └── initiate-payment/     # Payment initiation
        │   └── (protected)/          # Route group with auth guard
        │       ├── home/             # Dashboard
        │       ├── theme-choice/     # Sélection thème (8 catégories)
        │       ├── welcome/          # Accueil personnalisé
        │       ├── questionnaire/    # Cœur : 5 questions swipables
        │       └── pulseCommunity/   # Vue communautaire par thème
        ├── auth/                     # SIWE nonce challenge-response
        ├── components/
        │   ├── AuthButton/           # Login via World App wallet
        │   ├── AnimatedText/         # Texte rotatif animé
        │   ├── ThemeCard/            # Carte sélection thème
        │   ├── Navigation/           # Bottom tabs
        │   ├── questionnaire/        # QuestionCard, ProgressBar, ResultsView
        │   ├── Pay/ Transaction/ Verify/  # Templates Worldcoin (non adaptés)
        │   └── RedirectHandler/      # First-time vs returning user
        ├── config/themes.ts          # 8 thèmes Web3
        ├── types/                    # Question, UserVote, Theme
        └── utils/                    # RedirectLogic, ThemeStorage
```

### Patterns
- Next.js App Router avec route groups `(protected)/`
- Auth check server-side via `await auth()` dans les layouts
- localStorage pour les préférences (pas de DB)
- Données questions en JSON statique

---

## D. Fonctionnalités

### Ce Qui a Été Construit (fonctionnel)
1. **Auth Worldcoin Wallet** — SIWE complet via NextAuth + nonce HMAC
2. **Questionnaire swipable** — Cartes draggables (touch + mouse), rotation visuelle, gradient dynamique
3. **5 questions aléatoires** par session, filtrables par thème
4. **8 thèmes Web3** avec cartes de sélection visuelles (GameFi, AI, DeFi, RWA, DID, DePIN, Prediction Markets, CEX)
5. **Vue résultats** — Comparaison réponse utilisateur vs "community stats"
6. **Page communauté** — Vue agrégée par thème
7. **Redirect flow** — First-time vs returning user via localStorage
8. **World ID Verification** — Device + Orb level
9. **Paiement ERC20** via MiniKit (WLD + USDC.e)
10. **Transaction** — Mint token + Permit2 sur World Chain
11. **Landing page** séparée (Vite) avec 58 questions

### Ce Qui N'a PAS Été Construit
- Intégration Intuition Protocol (triplets RDF décoratifs seulement)
- Backend / base de données (tout est localStorage + JSON statique)
- Navigation Wallet et Profile (TODO dans le code)
- "Community stats" réelles (Math.random() pour la page communauté)
- Notifications, export, profil personnalisé

---

## E. Points Forts Techniques

### 1. Intégration Worldcoin MiniKit Complète
Auth wallet SIWE, vérification World ID (Device + Orb), paiements ERC20, transactions on-chain, permissions — tout le SDK est utilisé. Rare pour un hackathon.

### 2. Architecture Next.js 15 Propre
Route groups, server components pour l'auth, API routes pour la vérification, séparation client/server correcte.

### 3. UX Swipe Mobile-First
Support touch et mouse, feedback visuel (rotation, teinte verte/rouge selon direction), seuil de 100px. C'est fun et rapide.

### 4. Auth SIWE Sécurisée
Challenge-response HMAC pour le nonce — bonne pratique. Vérification SIWE côté serveur.

### 5. Volume en 48h
12 PRs mergées en 2 jours avec progression logique (setup → pages → thèmes → questionnaire → communauté).

---

## F. Points d'Amélioration

| Sujet | Détail |
|---|---|
| **⚠️ .env commité** | Secrets en clair dans le repo (AUTH_SECRET, HMAC_SECRET_KEY, APP_ID) — problème sécurité majeur |
| **Pas de persistance** | Tout en localStorage + JSON statique. Stats communauté = Math.random() |
| **Intuition absent** | Malgré le README, aucun import SDK Intuition, aucun appel API. Triplets RDF décoratifs |
| **Templates non nettoyés** | Pay, Transaction, Verify = composants template Worldcoin non adaptés |
| **Navigation cassée** | Tabs Wallet et Profile ne mènent nulle part (TODO) |
| **Pas de tests** | Zéro test |
| **Code dupliqué** | RedirectLogic (utils) et RedirectHandler (component) font la même chose |

---

## G. "Wow Factors"

### 1. Le Concept
Un outil de sondage Web3 avec résistance Sybil (World ID) + réputation décentralisée. Le problème est réel — les DAOs ont besoin de mesurer le sentiment communautaire.

### 2. UX Tinder pour le Vote
Le swipe-to-vote est une idée UX forte. Fun, rapide, mobile-first. Ça manque dans la plupart des outils de gouvernance Web3 (austères).

### 3. Ambition Multi-Protocole
Worldcoin (identité) + Intuition (réputation) + World Chain (transactions) — l'ambition architecturale est impressionnante pour 48h.

### 4. Exploration Technique Rapide
Malgré l'échec à livrer, le code produit montre une montée en compétence rapide sur Worldcoin SDK, Next.js 15 App Router, et l'auth SIWE.

---

## H. Contributions de Paul — 22 commits (58% du code)

**Paul est le développeur principal.** Il a construit :

- **Tout le système de questionnaire** (QuestionCard swipable, ProgressBar, ResultsView)
- **Flow de sélection de thème** (ThemeCard, ThemeIcon, AnimatedText)
- **Page communauté** (PulseCommunity)
- **Système de redirection** (first-time vs returning user)
- **Utilitaires** (ThemeStorage, FirstTimeChecker, RedirectLogic)
- **Composants UI custom** (Button, Card, Progress)
- **Architecture des pages protégées**

Samuel a fait le setup initial (template Worldcoin, démo Vite, README, CI/CD).
Jérémie a créé le repo, les issues, et configuré le domaine.

---

## I. Faut-il l'Inclure dans le Portfolio ?

### Verdict : OUI, avec un cadrage honnête

**Pourquoi ça vaut le coup :**
- Tu es clairement le dev principal (58% des commits)
- Le volume en 48h est impressionnant (12 PRs, système complet)
- Compétences React 19, Next.js 15, TypeScript, Worldcoin SDK, auth Web3
- Le concept est pertinent et l'UX swipe est différenciante

**Comment le présenter honnêtement :**
- **Cadrer comme "Concept hackathon bloqué par une incompatibilité cross-chain"** — pas un manque de compétence, un vrai mur technique
- **Expliquer le blocage** : MiniKit ne peut transacter que sur World Chain (ID 480), Intuition vit sur Base/L3 (ID 8453). Impossible de créer des attestations Intuition depuis une MiniApp World App
- **Mettre en avant** : la capacité à identifier un problème d'architecture blockchain, le concept UX swipe, les compétences Worldcoin SDK
- **Valoriser l'apprentissage** : contraintes cross-chain, limites des SDK fermés, importance du prototypage technique avant le design

**Quick wins pour le rendre plus présentable :**
1. Supprimer le `.env` du repo (retroactivement avec `git filter-branch`)
2. Ajouter un screenshot/GIF du swipe dans le README
3. Déployer une version statique sur Vercel pour avoir une URL demo

### Score portfolio : 5/10 en l'état → 7/10 avec nettoyage + cadrage honnête

> **Note :** C'est le projet le plus faible des 5. Si tu dois en retirer un du portfolio, c'est celui-ci. Mais bien cadré comme "concept hackathon + leçon apprise", il peut montrer ta capacité à explorer de nouveaux écosystèmes (Worldcoin) et ton honnêteté face à l'échec.

---

## J. Résumé pour le Portfolio

### Tagline suggérée
> "Pulse — Sondage Web3 par swipe avec résistance Sybil (World ID) — ETH Global Cannes 2025"

### Pitch en 3 phrases
Lors de l'ETH Global Cannes, notre équipe de 3 a tenté de construire une MiniApp Worldcoin permettant aux communautés Web3 de voter sur des sujets (DeFi, GameFi, IA...) via un système de cartes swipables à la Tinder, avec ancrage des votes dans le protocole Intuition. Le projet s'est heurté à un mur technique : MiniKit ne peut transacter que sur World Chain, tandis qu'Intuition vit sur Base/L3 — rendant l'intégration cross-chain impossible dans le cadre d'une MiniApp. En tant que développeur principal (58% du code), j'ai construit le frontend complet (questionnaire swipable, thèmes, communauté, auth SIWE) — une expérience qui m'a appris l'importance du prototypage d'architecture blockchain avant le développement.

### Métriques
- 48h de développement, 12 PRs mergées
- Développeur principal (58% des commits)
- Intégration complète Worldcoin MiniKit SDK
- 8 thèmes Web3, système de swipe touch + mouse
- Next.js 15 App Router + React 19 + TypeScript

### Stack badges
`Next.js 15` `React 19` `TypeScript` `Tailwind CSS 4` `Worldcoin MiniKit` `World ID` `SIWE` `viem` `NextAuth` `World Chain`

---

## K. Analyse Technique de l'Incompatibilité

### Le Problème Fondamental : Cross-Chain Impossible dans MiniKit

Le projet Pulse tentait de combiner deux écosystèmes blockchain **qui ne peuvent pas communiquer** dans le contexte d'une MiniApp :

| Composant | Chain | Chain ID | Type |
|-----------|-------|----------|------|
| **Worldcoin MiniKit** | World Chain (OP Stack L2) | **480** | Seule chain supportée par `sendTransaction` |
| **Intuition Protocol (beta)** | Base mainnet | **8453** | Contrats EthMultiVault |
| **Intuition Network (actuel)** | L3 Arbitrum Orbit (settle sur Base) | dédié | Contrats Atoms/Triples/Vaults |

### Preuve 1 : MiniKit est verrouillé sur World Chain

La documentation officielle de World ([docs.world.org/mini-apps/commands/send-transaction](https://docs.world.org/mini-apps/commands/send-transaction)) stipule :

> "Send transaction allows you to read and write to any smart contract on **World Chain**."

`MiniKit.commandsAsync.sendTransaction()` ne prend **aucun paramètre de chain** — c'est World Chain exclusivement. La réponse de l'API renvoie toujours `"network": "worldchain"`.

Dans le code de Pulse, le composant `Transaction` utilise :
```typescript
import { worldchain } from 'viem/chains'
// RPC: https://worldchain-mainnet.g.alchemy.com/public
```

### Preuve 2 : Intuition est sur Base/L3, pas sur World Chain

Les contrats Intuition sont déployés sur :
- **Base Sepolia** (testnet) : `EthMultiVault` à `0x430BbF52503Bd4801E51182f4cB9f8F534225DE5`
- **Base Mainnet** : `EthMultiVault` à `0x1A6950807E33d5bC9975067e6D6b5Ea4cD661665`
- Depuis fin 2025 : **Intuition Network** (L3 Arbitrum Orbit, settle sur Base)

Le `TrustSwapAndBridgeRouter` est explicitement restreint : *"intended to only ever be deployed on the Base mainnet (chain id 8453)"* (source : audit Code4rena mars 2026).

### Preuve 3 : Le SDK Intuition n'est pas dans le projet

Le `package.json` de `pulse-mini-app` ne contient **aucune référence** à `@0xintuition/sdk`, `@0xintuition/protocol`, ou `@0xintuition/graphql`. L'équipe n'a jamais réussi à intégrer la partie Intuition.

Les triplets RDF dans `questions.json` sont purement décoratifs — aucun code ne les envoie on-chain.

### Preuve 4 : Aucun contournement viable en 48h

Le seul contournement aurait été une architecture backend (serveur off-chain qui reçoit les votes depuis World Chain et les soumet sur Base via un wallet serveur). Mais cela aurait :
- Complexifié énormément le projet pour un hackathon
- Perdu le caractère "trustless" des attestations (le serveur devient un point central de confiance)
- Nécessité un bridge World Chain → Base qui n'existait pas nativement

### Conclusion

> **L'échec de Pulse n'est pas un manque de compétence technique, mais une incompatibilité d'architecture blockchain découverte pendant le hackathon.** World Chain et Base/Intuition L3 sont deux écosystèmes cloisonnés, et MiniKit ne fournit aucun mécanisme cross-chain. C'est un cas classique où la vision produit (combiner identité Worldcoin + réputation Intuition) se heurte aux limitations techniques des SDK actuels.

### Sources
- [World Developer Docs — Send Transaction](https://docs.world.org/mini-apps/commands/send-transaction)
- [Intuition Smart Contracts Overview](https://www.docs.intuition.systems/docs/intuition-smart-contracts)
- [Intuition Contracts v0.1 — GitHub](https://github.com/0xIntuition/intuition-contracts-v0.1)
- [Intuition Code4rena Audit (mars 2026)](https://code4rena.com/audits/2026-03-intuition)
- [Intuition Network L3 Mainnet Launch](https://alexablockchain.com/intuition-launches-arbitrum-orbit-powered-l3-mainnet/)
- [MiniKit-JS SDK — GitHub](https://github.com/worldcoin/minikit-js)
