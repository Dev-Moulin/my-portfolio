# Carte 4 — CoinTribe

**Titre :** CoinTribe

**Tagline :** Plateforme communautaire crypto — votes de sentiment, graphiques temps réel et alertes de prix

**Image/GIF :** *(à capturer)*

---

## Description

Projet de fin de formation THP, réalisé en 11 jours avec une équipe de 5 que l'on a formée par choix. On a choisi le thème crypto et on a construit une plateforme où les utilisateurs peuvent voter Bullish/Bearish sur des cryptomonnaies, suivre les cours en temps réel via des graphiques candlestick (WebSocket Binance), discuter via posts et commentaires, et configurer des alertes email quand un prix atteint un seuil.

Ma contribution : j'ai mis en place l'authentification (Devise) dès les premières PRs du projet, géré le déploiement Heroku et la configuration SMTP Mailjet. J'ai construit le filtre anti-grossièretés multilingue (serveur + client), amélioré le système d'alertes de prix (passage à un seuil bidirectionnel price_up/price_down + fix du mailer), sécurisé l'inscription (validations strictes password/email), et rédigé toutes les pages légales (CGU, politique de confidentialité, FAQ — ~600 lignes de contenu).

---

## Mon rôle
Authentification, sécurité, pages légales, déploiement — 102 commits (dont ~56 de code, ~46 merges)

## Tech
Ruby on Rails 8 · PostgreSQL · Hotwire (Turbo + Stimulus) · Devise · LightweightCharts · Binance WebSocket · CoinMarketCap API · Mailjet · AWS S3 · Heroku · GitHub Actions

## Team
5 développeurs (projet final THP)

## Liens
- [GitHub](https://github.com/DevFullstackCo/CoinTribe)

---

---

# Analyse détaillée des contributions de Paul sur CoinTribe

*(Basée sur l'analyse exhaustive des 17 PRs mergées)*

## Liste des PRs

### PR #1 et #2 — "Devise" (02/12/2024)
**Le tout premier commit du projet.** Setup complet de l'authentification :
- 22 fichiers créés : toutes les vues Devise (login, register, reset password, unlock, confirmations, mailer templates), modèle User, migration `devise_create_users`, initializer `devise.rb` (313 lignes), locales, schema initial
- +741 lignes — C'est le scaffolding fondateur de l'application

### PR #19 — "004heroku" (03/12/2024)
- Configuration `database.yml` pour déploiement Heroku (DB_PASSWORD, DB_USERNAME, DATABASE_URL)

### PR #30 — "013 CGU politique confidentialité" (04/12/2024)
**Feature complète — pages légales + acceptation CGU à l'inscription :**
- 11 fichiers créés : StaticPagesController, 6 contrôleurs Devise custom, vues CGU et Privacy Policy, migration
- Migration : colonnes `accepted_cgu`, `accepted_privacy_policy`, `accepted_at` sur table users
- Validations modèle User (obligation d'accepter), `before_create :set_accepted_at`
- Checkboxes CGU/PP dans le formulaire d'inscription
- +280 lignes sur 16 fichiers

### PR #41 — "065 restrictions MP mail" v1 (05/12/2024)
- Validations strictes mot de passe : regex 8+ caractères, majuscule, minuscule, chiffre, caractère spécial
- Validation email par regex
- +21 lignes sur 2 fichiers

### PR #53 — "066 regex filters" v1 (05/12/2024)
**Système anti-grossièretés complet :**
- `profanity_filter.js` (filtre côté client avec alerte temps réel)
- `language_filter.rb` initializer (filtre serveur)
- Gem `language_filter` ajoutée
- Callbacks `before_save :filter_profanity` sur Post et Comment
- Liste de mots interdits : français (50+ mots) + anglais + québécois
- +58 lignes sur 8 fichiers

### PR #64 — "065 restrictions MP mail" v2 (06/12/2024)
- Refactoring modèle User, nettoyage validations et config

### PR #67 — "057 CGU PP" texte complet (06/12/2024)
**Rédaction complète du contenu légal :**
- CGU (~140 lignes) : 10 sections (objet, éditeur, accès, propriété intellectuelle, données personnelles, cookies, responsabilité, modification, droit applicable, litiges)
- Politique de Confidentialité (~150 lignes) : 10 sections (identité responsable, données collectées, finalités, base juridique, durée conservation, droits utilisateurs, transferts, sécurité, modifications, litiges)
- +286 lignes

### PR #94 — "fix config" (09/12/2024)
- Réactivation du `UserMailer.welcome_email`
- Fix config SMTP Mailjet en production
- Activation du mailer Devise

### PR #114 — "058cgu privacypolicy + CSS" (10/12/2024)
- Fichiers CSS créés : `cgu.css`, `privacy_policy.css`
- Refactoring HTML des pages CGU et PP
- +323 lignes sur 5 fichiers

### PR #117 — "058cgu privacypolicy + FAQ" (10/12/2024)
**Création de la page FAQ complète :**
- `faq.html.erb` (155 lignes) — 10 sections avec questions/réponses
- `faq.css`
- Controller : ajout `def faq` dans StaticPagesController
- Route : `get 'faq'`
- Fix navbar : remplacement `@user.avatar` par `current_user.avatar`
- +198 lignes sur 9 fichiers

### PR #121 — "066 regex filters" v2 (11/12/2024)
- Ajout de mots interdits japonais (kanji + romaji)

### PR #124 — "058cgu privacypolicy CSS polish" (11/12/2024)
- Refonte CSS complète des 3 pages (CGU, FAQ, Privacy Policy)
- Typographie Poppins, couleurs, bordures, responsive
- +275 lignes sur 6 fichiers

### PR #129 — "084 alert price" (11/12/2024)
**Feature backend — alertes prix bidirectionnelles :**
- Migration : remplacement `target_price` par `price_up` + `price_down`
- Nouvelles validations numériques sur le modèle
- Controller : mise à jour strong params
- Vue : deux champs de saisie (Price Up / Price Down)
- Rake task : logique dans `crypto_fetcher.rake` qui compare prix en temps réel et crée des Notifications automatiques quand un seuil est franchi
- +41 lignes sur 6 fichiers

### PR #141 — "Fix notification_mailer.rb" (12/12/2024)
- Création du `NotificationMailer` manquant

### PR #155 et #171 — Renommage CGU → Terms of Use (13/12/2024)
- Renommage routes, fichiers, références

---

## Fichiers créés de zéro par Paul (~30 fichiers)

- `app/models/user.rb`
- Toutes les vues Devise (14 fichiers)
- `config/initializers/devise.rb`
- `db/migrate/devise_create_users.rb`
- `app/controllers/static_pages_controller.rb`
- 6 contrôleurs Devise custom (`users/*.rb`)
- `app/views/static_pages/cgu.html.erb`
- `app/views/static_pages/privacy_policy.html.erb`
- `app/views/static_pages/faq.html.erb`
- `db/migrate/add_accepted_terms_users.rb`
- `app/javascript/profanity_filter.js`
- `config/initializers/language_filter.rb`
- `app/assets/stylesheets/cgu.css`
- `app/assets/stylesheets/privacy_policy.css`
- `app/assets/stylesheets/faq.css`
- `db/migrate/add_price_up_and_price_down_to_alert_prices.rb`
- `app/mailers/notification_mailer.rb`

---

## Résumé factuel (VÉRIFIÉ)

### Ce que Paul a fait concrètement

1. **Premières PRs du projet** — Setup Devise + User (PRs #1 et #2). Note : Florian a fait le tout premier commit 38 min avant
2. **Un des 3 principaux reviewers/mergers** — 43 PRs d'autres mergées (Florian: 34, James: 36). Rôle partagé, pas exclusif
3. **Features construites de A à Z** :
   - Pages légales complètes (CGU, Privacy Policy, FAQ) avec acceptation obligatoire à l'inscription — ~600 lignes de contenu
   - Filtre anti-grossièretés multilingue (FR/EN/JP/québécois) — serveur + client
4. **Contribution partielle** :
   - Alertes prix : amélioration (price_up/price_down) + fix mailer. Mais le cœur de la feature (modèle, controller, CRUD, mailer principal) est d'Alexe-M
5. **Sécurité** — validations strictes password et email
6. **Déploiement** — config Heroku, SMTP Mailjet, mailer Devise
7. **102 commits dont ~46 merge commits et ~56 commits de code, 17 PRs en 11 jours**

---

## Vérification des affirmations

| Affirmation initiale | Verdict | Réalité |
|---|---|---|
| "Paul a fondé le projet / premier commit" | **FAUX** | Florian-THP a le 1er commit (17:16). Paul arrive 38 min après (17:54). Premières PRs (Devise) = Paul |
| "3 semaines de dev" | **FAUX** | 11 jours (2 déc - 13 déc 2024) |
| "Mainteneur principal du repo (46 PRs)" | **EXAGÉRÉ** | 43 PRs d'autres mergées (pas 46). Mais James (36) et Florian (34) faisaient pareil. Rôle partagé à 3 |
| "102 commits" | **VRAI** | Mais ~46 sont des merge commits. ~56 commits de code propre |
| "Alertes prix bidirectionnelles" | **PARTIELLEMENT VRAI** | Paul a amélioré (price_up/down) + fix mailer. Alexe-M a créé la feature (modèle, controller, CRUD, mailer) |
| "Équipe de 5" | **CONFIRMÉ** | 5 contributeurs confirmés |
| "Équipe formée par choix" | **Non vérifiable** via API, affirmé par Paul |
