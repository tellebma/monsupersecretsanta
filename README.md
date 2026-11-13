# Mon Super Secret Santa

Une application web française, utilisable sur mobile, pour organiser ses tirages et partager une liste de cadeaux entre plusieurs groupes.

## Suivi des tâches

**P0** prioritaire · **P1** important · **P2** amélioration ultérieure. Le [backlog complet](BACKLOG.md) détaille les règles du produit et les conditions de reprise.

### Fait

| Priorité | Tâche |
| --- | --- |
| P0 | Comptes par mail, invitations et tirages automatiques avec exceptions et historique |
| P0 | Liste de cadeaux commune et réservations entre groupes, avec rappels par mail |
| P0 | Retrait d’un participant par l’organisateur avant le tirage |
| P0 | Recherche de cadeaux, import par lien, compteur d’échecs et saisie avec le nom seul |
| P1 | Écran « Chercher un cadeau » avec suggestions dès l’ouverture et préremplissage après sélection |
| P1 | Parallaxe des cadeaux à la souris et au défilement sur l’accueil, avec prise en charge du mouvement réduit |
| P1 | Rapport SQL des imports incomplets par marchand |
| P1 | Recherche de produits sur Fnac et Boulanger avec plusieurs résultats et images |
| P1 | Navigation active, accès clavier au contenu et pages de chargement, d’erreur et introuvable en français |
| P1 | Ajout de fiches H&M, Kiabi, Uniqlo et Zara au catalogue intégré |
| P1 | Production publique, préprod Vercel protégée, données fictives en local et CI sur quatre profils navigateur |

### Reste à faire

| Priorité | Tâche | État |
| --- | --- | --- |
| P0 | Activer la connexion Google | Bloqué par l’accès à Google Cloud |
| P1 | Activer la connexion Apple | Bloqué par la configuration Apple Developer |
| P1 | Raccorder les données fictives à la préprod hébergée | En attente du projet Supabase dédié |
| P1 | Renforcer l’import chez les marchands les plus demandés | En attente de données dans le rapport |
| P1 | Étendre la recherche à plus de marchands | En attente d’un compte Brave autorisé |
| P2 | Raccorder `MonSuperSecretSanta.fr` | En attente de l’enregistrement du domaine |
| P2 | Détecter les arnaques et le dropshipping | À cadrer |

## Démarrer en local

Lancez `npm ci`, puis `npm run dev`. L’accueil est disponible sur [localhost:3000](http://localhost:3000). Copiez `.env.example` vers `.env.local` et renseignez les variables pour activer les comptes et les groupes. Les fichiers d’environnement locaux sont ignorés par Git.

## Mettre en ligne

1. Appliquez [la migration initiale](supabase/migrations/202611090001_initial.sql) au projet Supabase. Le schéma `santa` reste privé. Les appels de l’application passent par les fonctions `public.santa_*`.
2. Dans Supabase Auth, activez Email, Google et Apple. Ajoutez l’adresse `https://votre-site/auth/callback` aux URL autorisées et renseignez l’URL du site. Pour l’inscription et la réinitialisation par mail, copiez le contenu de [supabase/templates/code.html](supabase/templates/code.html) dans les modèles **Magic Link** et **Confirm signup**, en conservant `{{ .Token }}`, puis branchez un SMTP personnalisé. Les modèles sont déjà raccordés dans la configuration Supabase locale. Configurez les identifiants OAuth dans les tableaux de bord des fournisseurs.
3. Importez le dépôt dans Vercel et renseignez les variables de `.env.example`. `APP_ORIGIN` doit être l’origine publique du site, sans chemin. Ajoutez une clé Resend et une adresse d’expédition sur un domaine validé. Générez un secret aléatoire distinct pour `SCHEDULE_SECRET`. Le mot de passe PostgreSQL sert uniquement à administrer la base.
4. Dans Supabase Vault, créez `santa_app_origin` et `santa_schedule_secret` avec les mêmes valeurs qu’en production, puis exécutez [le script de planification](supabase/schedule.sql). Le planificateur appelle le site toutes les minutes. Après avoir raccordé le domaine final, mettez à jour l’origine dans Vercel, Supabase Auth et Vault.

## Statistiques de fréquentation

Vercel Web Analytics est intégré au layout et chargé uniquement sur les déploiements de production (`VERCEL_ENV=production`). Le tableau Analytics du projet Vercel affiche les visiteurs, les pages vues et les sources de trafic. Activez Web Analytics dans Vercel avant de déployer cette intégration. Les données commencent à être collectées après ce déploiement et ne sont pas rétroactives.

Le filtre `lib/analytics.ts` supprime tous les paramètres et fragments des URL, remplace les jetons d’invitation et les identifiants de groupes et de cadeaux par des catégories de pages, et ignore les routes inconnues et les callbacks d’authentification. Aucun événement personnalisé contenant les noms, les adresses mail, les recherches ou les cadeaux n’est envoyé. La préproduction et le développement local ne chargent pas le composant de collecte.

## Vérifier et importer

`npm test` couvre le tirage, les invitations, la confidentialité, les règles de réservation et l’import des produits. `npm run build` vérifie le typage et la compilation de production.

L’import lit les informations publiées par les pages marchandes accessibles en HTTPS. Le lien peut toujours être enregistré manuellement avec un nom, même si le marchand refuse l’accès ou si sa fiche est incomplète. L’import reflète les informations présentes au moment de l’ajout.

La table privée `santa.gift_import_failures` comptabilise les tentatives où le nom, l’image ou la description n’a pas pu être récupéré. Exécutez le [rapport des imports incomplets](supabase/reports/gift-import-failures.sql) dans l’éditeur SQL de Supabase avec un accès administrateur. Cette requête en lecture seule classe les marchands par nombre de tentatives incomplètes et indique le nombre d’URL distinctes ainsi que la date de la dernière tentative incomplète. Elle affiche uniquement les résultats agrégés.

La recherche interroge les pages publiques de résultats de Fnac et Boulanger et complète les réponses avec une sélection vérifiée et les liens de la personne connectée. Elle affiche jusqu’à 24 produits, avec les images publiées par les boutiques. Les recherches marchandes sont mises en cache pendant 15 minutes. Le prix et le stock se vérifient chez le marchand. Une boutique qui refuse l’accès peut fournir moins de résultats ou empêcher un import.

Le catalogue propose aussi 18 thématiques et quatre pistes de recherche par thématique, définies dans `lib/gift-themes.ts`. Les catégories jeux de société et livres lisent en priorité les pages de meilleures ventes Fnac, avec un cache de 15 minutes et un lien vers la source. Si ces pages sont inaccessibles ou ne contiennent aucun produit exploitable, le catalogue revient à la recherche ordinaire et aux idées locales de la catégorie, sans les présenter comme des meilleures ventes. Les autres thématiques utilisent la recherche marchande et les idées locales correspondantes.

La [Web Search API de Brave](https://api-dashboard.search.brave.com/documentation/services/web-search) peut étendre la recherche à plusieurs marchands. Les fiches affichées proviennent des pages marchandes. L’API reste désactivée par défaut. Pour l’activer, renseignez `BRAVE_SEARCH_ENABLED=true` et `BRAVE_SEARCH_API_KEY` côté serveur, après avoir adapté les conditions d’utilisation aux [exigences de Brave](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) et informé les utilisateurs de la transmission de leurs recherches. Le plan Search facture 5 dollars par millier de requêtes avec 5 dollars de crédit mensuel et une carte requise à l’activation. L’application limite la recherche externe à 25 requêtes par compte et par jour et à 1 000 requêtes par mois. Configurez également un plafond dans [le tableau de bord Brave](https://api-dashboard.search.brave.com/documentation/resources/help-feedback).

Les [API partenaires d’idealo](https://partner.idealo.com/partner-idealo-com/uk/learning-center/faq-technical-integration) documentent l’envoi des offres des marchands vers idealo. Pour élargir l’index à partir de catalogues autorisés, il est aussi possible d’intégrer des [flux produits d’annonceurs](https://help.awin.com/developers/docs/downloading-a-list-of-your-product-feeds).

## Préproduction et tests d’acceptation

Avec Docker en fonctionnement, lancez `npm run preprod:local`, puis `npm run build:preprod` et `npm run start:preprod`. La préprod locale tourne sur [127.0.0.1:3100](http://127.0.0.1:3100) avec sa propre base Supabase. [Mailpit](http://127.0.0.1:54324) capture les messages d’authentification locaux. Pour repartir de zéro, lancez `npx supabase db reset --local` puis `npm run preprod:local`. Cette commande efface les données du projet local.

Les 16 comptes ont des adresses fictives. Pour la préprod **locale**, leur mot de passe est `DemoNoel-2026!`. Commencez avec `camille@secret-santa.example.com`, `lea@secret-santa.example.com` et `nora@secret-santa.example.com`. Camille et Nora ont tiré Léa dans deux groupes différents. Le casque est réservé et la tasse déjà achetée. Zoé a une liste vide. Les éditions couvrent aussi la préparation, la planification, les contraintes insolubles, l’historique et un échange terminé.

Installez les navigateurs avec `npx playwright install`. Après le build de préprod, arrêtez le serveur manuel et lancez `npm run test:e2e`. Playwright démarre son propre serveur et utilise la vraie pile Supabase locale. Il vérifie Chromium, Firefox, WebKit et un écran mobile, avec des contrôles d’accessibilité, une course de réservation et un transport mail de test. Les comptes, codes et notifications des tests sont fictifs.

GitHub Actions exécute ces contrôles sur les pull requests, `main` et `preprod`. Le contrôle **Validation CI** agrège tous les résultats. Vercel déploie les branches via son intégration Git. La production publique suit `main` et la branche `preprod` utilise la protection Vercel des previews.

Pour peupler la préprod en ligne, utilisez un projet Supabase séparé nommé `monsupersecretsanta-preprod`. Appliquez la migration et renseignez `STAGING_PROJECT_REF`, `PRODUCTION_SUPABASE_REF`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` et `STAGING_DEMO_PASSWORD` dans l’environnement local, puis lancez `npm run preprod:seed` avec le CLI Supabase connecté. Le mot de passe de la préprod hébergée se transmet aux testeurs via un canal privé. Dans Vercel, limitez les variables Supabase de ce projet à la branche `preprod`.
