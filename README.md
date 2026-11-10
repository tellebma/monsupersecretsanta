# Mon Super Secret Santa

Une application web française, utilisable sur mobile, pour organiser ses tirages et partager une liste de cadeaux entre plusieurs groupes.

## Démarrer en local

Lancez `npm ci`, puis `npm run dev`. L’accueil est disponible sur [localhost:3000](http://localhost:3000). Copiez `.env.example` vers `.env.local` et renseignez les variables pour activer les comptes et les groupes. Les fichiers d’environnement locaux sont ignorés par Git.

## Mettre en ligne

1. Appliquez [la migration initiale](supabase/migrations/202611090001_initial.sql) au projet Supabase. Le schéma `santa` reste privé. Les appels de l’application passent par les fonctions `public.santa_*`.
2. Dans Supabase Auth, activez Email, Google et Apple. Ajoutez l’adresse `https://votre-site/auth/callback` aux URL autorisées et renseignez l’URL du site. Pour l’inscription et la réinitialisation par mail, configurez un modèle **Magic Link** contenant `{{ .Token }}` et branchez un SMTP personnalisé. Configurez les identifiants OAuth dans les tableaux de bord des fournisseurs.
3. Importez le dépôt dans Vercel et renseignez les variables de `.env.example`. `APP_ORIGIN` doit être l’origine publique du site, sans chemin. Ajoutez une clé Resend et une adresse d’expédition sur un domaine validé. Générez un secret aléatoire distinct pour `SCHEDULE_SECRET`. Le mot de passe PostgreSQL sert uniquement à administrer la base.
4. Dans Supabase Vault, créez `santa_app_origin` et `santa_schedule_secret` avec les mêmes valeurs qu’en production, puis exécutez [le script de planification](supabase/schedule.sql). Le planificateur appelle le site toutes les minutes. Après avoir raccordé le domaine final, mettez à jour l’origine dans Vercel, Supabase Auth et Vault.

## Vérifier et importer

`npm test` couvre le tirage, les invitations, la confidentialité, les règles de réservation et l’import des produits. `npm run build` vérifie le typage et la compilation de production.

L’import lit les informations publiées par les pages marchandes accessibles en HTTPS. Le lien peut toujours être enregistré manuellement avec un nom, même si le marchand refuse l’accès ou si sa fiche est incomplète. L’import reflète les informations présentes au moment de l’ajout.

La table privée `santa.gift_import_failures` comptabilise les tentatives où le nom, l’image ou la description n’a pas pu être récupéré. Pour prioriser les marchands, agrégez `sum(attempt_count)` par `merchant`. La table conserve l’URL normalisée et écarte les fragments et les paramètres sans rapport avec l’identification du produit.

La recherche fonctionne sans clé grâce à une sélection de produits sur des pages marchandes vérifiées et aux liens déjà enregistrés par la personne connectée. Les fiches de cette sélection renvoient aux marchands pour le prix et le stock.

La [Web Search API de Brave](https://api-dashboard.search.brave.com/documentation/services/web-search) peut étendre la recherche à plusieurs marchands. Les fiches affichées proviennent des pages marchandes. L’API reste désactivée par défaut. Pour l’activer, renseignez `BRAVE_SEARCH_ENABLED=true` et `BRAVE_SEARCH_API_KEY` côté serveur, après avoir adapté les conditions d’utilisation aux [exigences de Brave](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) et informé les utilisateurs de la transmission de leurs recherches. Le plan Search facture 5 dollars par millier de requêtes avec 5 dollars de crédit mensuel et une carte requise à l’activation. L’application limite la recherche externe à 25 requêtes par compte et par jour et à 1 000 requêtes par mois. Configurez également un plafond dans [le tableau de bord Brave](https://api-dashboard.search.brave.com/documentation/resources/help-feedback).

Les [API partenaires d’idealo](https://partner.idealo.com/partner-idealo-com/uk/learning-center/faq-technical-integration) documentent l’envoi des offres des marchands vers idealo. Pour élargir l’index à partir de catalogues autorisés, il est aussi possible d’intégrer des [flux produits d’annonceurs](https://help.awin.com/developers/docs/downloading-a-list-of-your-product-feeds).

## Préproduction et tests d’acceptation

Avec Docker en fonctionnement, lancez `npm run preprod:local`, puis `npm run build:preprod` et `npm run start:preprod`. La préprod locale tourne sur [127.0.0.1:3100](http://127.0.0.1:3100) avec sa propre base Supabase. [Mailpit](http://127.0.0.1:54324) capture les messages d’authentification locaux. Pour repartir de zéro, lancez `npx supabase db reset --local` puis `npm run preprod:local`. Cette commande efface les données du projet local.

Les 16 comptes ont des adresses fictives. Pour la préprod **locale**, leur mot de passe est `DemoNoel-2026!`. Commencez avec `camille@secret-santa.example.com`, `lea@secret-santa.example.com` et `nora@secret-santa.example.com`. Camille et Nora ont tiré Léa dans deux groupes différents. Le casque est réservé et la tasse déjà achetée. Zoé a une liste vide. Les éditions couvrent aussi la préparation, la planification, les contraintes insolubles, l’historique et un échange terminé.

Installez les navigateurs avec `npx playwright install`. Après le build de préprod, arrêtez le serveur manuel et lancez `npm run test:e2e`. Playwright démarre son propre serveur et utilise la vraie pile Supabase locale. Il vérifie Chromium, Firefox, WebKit et un écran mobile, avec des contrôles d’accessibilité, une course de réservation et un transport mail de test. Les comptes, codes et notifications des tests sont fictifs.

GitHub Actions exécute ces contrôles sur les pull requests, `main` et `preprod`. Le contrôle **Validation CI** agrège tous les résultats. Vercel déploie les branches via son intégration Git. La production publique suit `main` et la branche `preprod` utilise la protection Vercel des previews.

Pour peupler la préprod en ligne, utilisez un projet Supabase séparé nommé `monsupersecretsanta-preprod`. Appliquez la migration et renseignez `STAGING_PROJECT_REF`, `PRODUCTION_SUPABASE_REF`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` et `STAGING_DEMO_PASSWORD` dans l’environnement local, puis lancez `npm run preprod:seed` avec le CLI Supabase connecté. Le mot de passe de la préprod hébergée se transmet aux testeurs via un canal privé. Dans Vercel, limitez les variables Supabase de ce projet à la branche `preprod`.
