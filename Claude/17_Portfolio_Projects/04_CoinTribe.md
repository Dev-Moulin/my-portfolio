# Analyse — CoinTribe

> Plateforme communautaire crypto — Votes, discussions & alertes de prix
> Repo : https://github.com/DevFullstackCo/CoinTribe
> Demo : https://cryptovotingproject-cc7f6a61a180.herokuapp.com/
> Contexte : Projet de fin de formation THP (Dev++)

---

## A. Vue d'ensemble

**Description :**
Plateforme communautaire dédiée aux cryptomonnaies. Permet de voter sur le sentiment de prix (Bullish/Bearish), discuter via posts et commentaires, suivre ses cryptos favorites en temps réel, et recevoir des alertes de prix.

**Contexte :**
- Projet final de formation THP (The Hacking Project)
- Réalisé en ~2 semaines (2-16 décembre 2024)
- Équipe de 5 développeurs
- Déployé et fonctionnel sur Heroku
- 12 issues ouvertes (toutes Dependabot)

**Équipe (5 contributeurs) :**
| Contributeur | Commits | Rôle |
|---|---|---|
| Florian Tribout | 175 | Lead technique, front-end, APIs, design |
| **Dev-Moulin (Paul)** | **102** | **Auth, légal, sécurité, alertes prix, déploiement** |
| Alexe Marichal | 74 | Models, controllers, votes, commentaires, mailers |
| Caroline Olivier | 46 | Profil, navbar, password reset, README, design |
| James Barthee | 38 | API, mailer, Active Storage, username generation |

---

## B. Stack Technique Complète

### Backend
| Technologie | Version | Rôle |
|---|---|---|
| Ruby | 3.2.2 | Langage |
| Rails | 8.0.0 | Framework (version très récente à l'époque) |
| PostgreSQL | — | Base de données |
| Devise | — | Authentification complète (confirmable, lockable, recoverable) |
| PgSearch | — | Recherche full-text |
| language_filter | — | Filtre de grossièretés serveur |
| Mailjet | — | Emails transactionnels |
| AWS S3 + Active Storage | — | Upload avatars |
| Solid Cache/Queue/Cable | — | Nouveautés Rails 8 |
| Propshaft | — | Asset pipeline moderne |

### Frontend
| Technologie | Rôle |
|---|---|
| ERB | Templates Rails |
| Hotwire (Turbo + Stimulus) | SPA-like avec rendu serveur |
| Vanilla JavaScript (14 fichiers) | Charts, posts, commentaires, notifications, alertes |
| CSS vanilla (13 fichiers) | Design dark theme |
| LightweightCharts (TradingView) | Graphiques candlestick |
| Importmap-rails | Gestion JS sans bundler |

### APIs Externes
| API | Rôle |
|---|---|
| CoinMarketCap (Pro) | Prix, volumes, variations 24h |
| Binance REST + WebSocket | Données historiques + temps réel chandelles |
| TradingView Widget | News + fallback graphique |
| Mailjet | Envoi emails |

### CI/CD & Outils
| Outil | Rôle |
|---|---|
| GitHub Actions | 4 jobs : Brakeman (sécu), importmap audit, RuboCop (lint), tests |
| Dependabot | Mises à jour automatiques |
| Heroku | Déploiement production |
| Docker | Support (Dockerfile présent) |
| Brakeman | Analyse sécurité statique |
| RuboCop | Linting Ruby |

---

## C. Architecture du Code

### Structure (Rails standard)
```
CoinTribe/
  app/
    controllers/          # 11 controllers + 6 Devise controllers
    models/               # 9 models + concerns
    views/                # 12 dossiers (cryptos, profiles, devise, static_pages...)
    mailers/              # 3 mailers (application, user, contact)
    javascript/           # 14 fichiers JS + Stimulus controllers
    assets/stylesheets/   # 13 fichiers CSS
  config/
    routes.rb
    initializers/         # language_filter, mailjet, devise...
    importmap.rb
  db/
    migrate/              # 17 migrations
    schema.rb
  lib/tasks/              # 2 rake tasks (clear_votes, crypto_fetcher)
  .github/workflows/      # CI (ci.yml)
  test/                   # Structure tests Rails
```

### Modèles et Relations
```
User
  ├── has_many :posts
  ├── has_many :votes → Crypto (through)
  ├── has_many :votes_histories
  ├── has_many :comments
  ├── has_many :favorites → Crypto (through :favorite_cryptos)
  ├── has_many :notifications
  ├── has_many :alert_prices
  └── has_one_attached :avatar (Active Storage / S3)

Crypto
  ├── has_many :votes → User
  ├── has_many :posts
  ├── has_many :favorites → User
  └── has_many :alert_prices

Post ←→ Comments (belongs_to :user, :crypto)
Vote (1 par user/crypto, reset quotidien)
VotesHistory (historique permanent)
Favorite (is_favorite + quantity pour portfolio)
Notification (title, content, is_read)
AlertPrice (price_up, price_down par user/crypto)
```

---

## D. Fonctionnalités Clés

### Graphique Trading Temps Réel
- **Candlestick interactif** (LightweightCharts) avec WebSocket Binance
- Timeframes : 1m, 15m, 1h, 4h, 6h, 12h, 1d
- Fallback automatique vers TradingView si Binance échoue
- Affichage prix, volume 24h, variation 24h

### Système de Vote Sentiment
- 1 vote par utilisateur par crypto par jour (Bullish/Bearish)
- Reset automatique quotidien via rake task
- Historique permanent des votes
- Pourcentages bullish/bearish affichés

### Discussions
- Posts par crypto (CRUD avec Turbo Stream)
- Commentaires imbriqués (toggle collapse/expand)
- Filtre de grossièretés double couche (serveur + client)
- Temps relatif ("2 hours ago")

### Portfolio & Favoris
- Ajouter/retirer cryptos des favoris
- Saisir quantité de tokens détenus
- Calcul automatique valeur du portefeuille
- Total Balance dans la navbar

### Alertes de Prix End-to-End
- Définir seuil haut (price_up) et bas (price_down)
- Rake task vérifie les prix → crée notification → envoie email → supprime l'alerte
- Cycle complet automatisé

### Authentification Complète (Devise)
- Inscription avec acceptation CGU obligatoire
- Génération automatique pseudonyme (@trader_XXXXXX)
- Confirmation email, mot de passe oublié, verrouillage compte

### Notifications
- Notifications in-app avec badge
- Popup dans la navbar
- Marquer toutes comme lues (Turbo Stream)

### Recherche
- Full-text PgSearch sur nom/symbole des cryptos
- Recherche dynamique via Stimulus

### Pages Légales & Statiques
- CGU détaillées et professionnelles
- Politique de confidentialité (RGPD)
- FAQ complète (5 sections, ~20 questions)
- Contact, À propos, Crédits

### Emails Transactionnels (Mailjet)
- Bienvenue, suppression compte, alerte prix, contact

### Panel Admin
- Recherche utilisateurs (Turbo Frame)
- Suppression utilisateurs (protection admin)

---

## E. Points Forts Techniques

### 1. Graphique Candlestick Temps Réel
WebSocket Binance qui met à jour des chandeliers en direct, avec changement de timeframe dynamique et fallback TradingView. Impressionnant pour un projet de fin de formation.

### 2. Rails 8 Dès Sa Sortie
Le projet utilise Rails 8.0.0 (sorti juste avant), avec Solid Cache/Queue/Cable et Propshaft. Choix moderne et audacieux.

### 3. Intégration Multi-API
CoinMarketCap (données de référence) + Binance (graphiques temps réel WebSocket) + TradingView (news + fallback). Pattern de fallback élégant.

### 4. CI/CD Professionnel
GitHub Actions avec 4 jobs (sécurité Brakeman, audit JS, lint RuboCop, tests), Dependabot, Docker, Heroku.

### 5. Alertes de Prix End-to-End
Pipeline complet : seuil → vérification → notification → email → suppression. Vraie logique métier.

### 6. Sécurité
Brakeman intégré, filtre de grossièretés, acceptation CGU obligatoire, validations Devise, protection admin.

### 7. Active Storage + S3
Upload avatar avec stockage cloud — pattern production-ready.

### 8. Documentation Légale Professionnelle
CGU, politique de confidentialité, FAQ détaillées — maturité au-delà du code.

---

## F. Points d'Amélioration Potentiels

| Sujet | Détail |
|---|---|
| **Tests** | Structure existe et CI les exécute, mais probablement tests Rails par défaut (pas de tests custom) |
| **Pagination** | Posts et commentaires non paginés — problème de perf avec beaucoup de contenu |
| **N+1 queries** | `@favorites_for_menu.sum{ |f| f.total_price }` fait un query par favori |
| **JS dupliqué** | `search_controller.js` duplique le même code entre `connect()` et `search()` |
| **Hack Turbo** | `load.js` force un rechargement de page via localStorage — contournement |
| **Schedule vide** | Gem `whenever` installée mais `schedule.rb` non configuré |
| **Seeds minimaliste** | Ne fait que supprimer des données, pas de données de démo |
| **Stripe absent** | Mentionné dans le README mais aucune trace dans le code |
| **Gamification** | Mentionnée dans les objectifs mais pas implémentée |

---

## G. "Wow Factors"

### 1. Graphique Candlestick Temps Réel
Le vrai bijou technique — WebSocket Binance + LightweightCharts + changement de timeframe + fallback. C'est un vrai graphique financier fonctionnel.

### 2. Alertes de Prix End-to-End
Pipeline complet de bout en bout : seuil → rake task → notification in-app + email → suppression auto.

### 3. Application Déployée et Accessible
Sur Heroku, fonctionnelle — démontre la capacité à aller jusqu'au bout.

### 4. Documentation Légale
CGU, PP, FAQ d'une qualité professionnelle avec sections RGPD. Montre une maturité au-delà du dev.

### 5. Rails 8 au Moment de Sa Sortie
Choix audacieux de travailler avec la dernière version.

---

## H. Contributions de Paul (Dev-Moulin) — 102 commits (~23%)

### Profil : "Gardien de la qualité et de la conformité"

**1. Infrastructure & Déploiement**
- PRs #1, #2 : Mise en place de **Devise** (le tout premier code fonctionnel du projet)
- PRs #18, #19 : Configuration **déploiement Heroku** (database URL, credentials)
- PR #94 : Fix config production (user.rb, production.rb, devise.rb)

**2. Système Légal Complet**
- PRs #30, #67, #114, #117, #124, #155, #169, #171 : CGU + Politique de Confidentialité (controllers, views, routes, CSS, textes)
- Rédaction de la **FAQ complète** (5 sections, ~20 questions)

**3. Sécurité & Validation**
- PRs #41, #64 : Restrictions mot de passe et email (validations Devise)
- PRs #53, #121 : **Filtre de grossièretés** (gem language_filter + mots additionnels japonais/québécois + intégration JS)
- Acceptation obligatoire CGU/PP à l'inscription

**4. Feature Business**
- PR #129 : **Alertes de prix** (modèle AlertPrice, controller, popup UI, intégration notifications)
- PR #141 : Fix notification mailer pour alertes de prix

**5. Coordination**
- Nombreux merges de branches, rôle de coordination dans l'équipe

### Synthèse
> Paul a joué un rôle de **fondation et fiabilité** : il a posé les bases du projet (Devise, Heroku), construit toute la couche légale, renforcé la sécurité, et développé le système d'alertes de prix. C'est un profil équilibré back-end + DevOps + rigueur fonctionnelle.

---

## I. Résumé pour le Portfolio

### Tagline suggérée
> "CoinTribe — Plateforme communautaire crypto avec graphiques candlestick temps réel, votes sentiment et alertes de prix"

### Pitch en 3 phrases
Projet de fin de formation THP réalisé en équipe de 5 en deux semaines. J'ai posé les fondations du projet (authentification Devise, déploiement Heroku), construit tout le système légal (CGU, politique de confidentialité, FAQ), renforcé la sécurité (filtre de grossièretés, validations), et développé le système d'alertes de prix end-to-end (seuils → notifications → emails automatiques). L'application intègre des graphiques candlestick temps réel via WebSocket Binance et un système de vote Bullish/Bearish sur les cryptomonnaies.

### Métriques à mettre en avant
- 5 développeurs, 102 commits personnels, 2ème contributeur
- Rails 8.0.0 (adopté dès sa sortie)
- Graphiques candlestick temps réel (WebSocket Binance)
- 3 APIs intégrées (CoinMarketCap, Binance, TradingView)
- CI/CD complète (4 jobs GitHub Actions + Heroku)
- Déployé et fonctionnel en production

### Stack badges
`Ruby 3.2` `Rails 8` `PostgreSQL` `Devise` `Hotwire` `Turbo Streams` `Stimulus` `LightweightCharts` `WebSocket` `CoinMarketCap API` `Binance API` `AWS S3` `Mailjet` `Heroku` `GitHub Actions`
