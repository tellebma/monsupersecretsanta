# Backlog Mon Super Secret Santa

Les sujets sont classés dans l’ordre de traitement. Un sujet bloqué porte sa condition de reprise. Les changements passent par une branche de travail, des tests et la CI avant publication.

| Priorité | Sujet | État | Résultat attendu ou condition de reprise |
| --- | --- | --- | --- |
| P0 | Retirer un participant avant le tirage | En cours | L’organisateur peut retirer un membre en brouillon ou avant l’attribution. Un tirage programmé reste cohérent. |
| P0 | Recherche, import des cadeaux et parallaxe | En cours | Publier et vérifier les parcours de la [pull request](https://github.com/tellebma/monsupersecretsanta/pull/2). |
| P0 | Connexion Google en production | Bloqué | Accéder à une session Google Cloud autorisée, puis configurer le client OAuth Web dans Supabase et vérifier la redirection. |
| P1 | Connexion Apple en production | Bloqué | Configurer le client Web du compte Apple Developer dans Supabase, puis tester le parcours avec l’adresse Apple masquée. |
| P1 | Préproduction hébergée peuplée | Bloqué | Raccorder la branche Vercel protégée au projet Supabase séparé `monsupersecretsanta-preprod` quand il est disponible. |
| P1 | Élargir la recherche à davantage de marchands | À faire | Le catalogue intégré fonctionne sans clé. Activer la recherche Brave après configuration d’un compte autorisé et vérifier les résultats français. |
| P1 | Prioriser les intégrations marchandes | À faire | Examiner les compteurs des imports incomplets et renforcer les marchands les plus demandés quand des données sont disponibles. |
| P2 | Domaine MonSuperSecretSanta.fr | Bloqué | Raccorder le domaine à Vercel après son enregistrement. |
| P2 | Détection des arnaques et du dropshipping | À cadrer | Définir les signaux et le comportement souhaité avant d’ajouter une règle de blocage. |

## Périmètre fonctionnel à préserver

- Site en français et adapté au mobile. Accueil public en production, préproduction derrière une connexion Vercel.
- Un compte par personne. Inscription par code mail puis mot de passe. Google et Apple passent par leurs comptes. Les invitations individuelles sont envoyées par mail aux adresses choisies par l’organisateur. Un code envoyé à l’adresse invitée permet de rejoindre avec un compte dont l’adresse diffère.
- L’organisateur valide les participants, fixe la date du tirage automatique et indique la date de l’échange. Il peut exclure des paires dans les deux sens. Dans le même groupe, chaque attribution exclut le même destinataire pour les trois années suivantes. En cas d’impasse, l’organisateur ajuste les contraintes.
- Après le tirage définitif, chaque participant révèle son destinataire avec « Tirer au sort ». L’organisateur voit son propre résultat s’il participe. Les autres attributions et réservations restent privées. Les membres peuvent compléter leur liste après le tirage.
- Une seule liste de cadeaux par personne. Elle est consultable par les personnes qui ont tiré ce destinataire. Le budget indicatif s’applique au total des cadeaux de l’échange. Chaque cadeau peut avoir plusieurs liens marchands.
- La recherche de cadeaux affiche un recours au lien lorsqu’aucun résultat ne correspond. Coller un lien tente d’importer l’image, le nom et la description, ainsi que le prix et la disponibilité quand la page les fournit. Le nom suffit pour la saisie manuelle. Les importations incomplètes alimentent un compteur par URL. Les marchands initialement ciblés sont Amazon France, Boulanger, Fnac, Decathlon, IKEA, Zara, Kiabi et H&M. SHEIN est exclu de la recherche et de l’import automatique.
- Une réservation bloque immédiatement le cadeau dans tous les groupes. Le donneur peut réserver plusieurs cadeaux, libérer une réservation ou confirmer l’achat. Une réservation expire après 14 jours et déclenche un rappel au bout de 5 jours. Un achat confirmé reste indisponible pour les groupes futurs.
- Les autres donneurs voient uniquement « Indisponible » ou « Déjà acheté », sans date ni identité. Les statuts restent masqués au destinataire jusqu’à l’échange. Les personnes qui ont réservé conservent les détails du cadeau tels qu’ils étaient au moment de leur réservation, même si la liste change.
- Notifications par mail uniquement. Invitation, tirage disponible, liste toujours vide 7 jours après le tirage, rappel de réservation et rappel 3 jours avant l’échange.
- Préproduction avec 16 comptes, 8 éditions et 61 idées fictives. CI GitHub sur Chromium, Firefox, WebKit et mobile, tests unitaires, SQL et d’acceptation. Vercel déploie après validation et `main` est protégée.
