# Publication Netlify

**V114 en attente (26 septembre 2026) :** le lot visuel et son build sont validés localement ; la publication reste suspendue par le refus de crédits HTTP 403 constaté depuis V110. [Preuves V114](../history/validation-timber-v114.md). Le site public demeure en V109 tant qu'un nouveau déploiement `ready` et son contrôle public ne sont pas obtenus.

**V111 également en attente (26 septembre 2026) :** la correction des cheveux et son build local sont validés ; aucun nouveau déploiement n'est tenté tant que le blocage de crédits HTTP 403 constaté pour V110 demeure. [Preuves V111](../history/validation-appearance-v111.md). Le site public reste en V109 ; reprendre la publication seulement après rétablissement du compte, puis vérifier le bundle et le parcours public.

**V110 en attente (26 septembre 2026) :** build et contrôle local prêts, mais la création du déploiement est refusée par Netlify avec HTTP 403 : « Account credit usage exceeded - new deploys are blocked until credits are added ». [Preuve et limites](../history/validation-appearance-v110.md), [état](../../artifacts/netlify-v110-blocked.json). Le site public reste en V109. Ne pas annoncer une livraison publique V110 avant nouveau déploiement `ready` et parcours public réussi ; il faut que le compte Netlify dispose à nouveau de crédits.

V109 : apparences humaines et gilet fabriqué, production `6ab7a55fc13832e1b09b98d4`, 37 fichiers, état `ready`. [Contrôle public](../../artifacts/netlify-smoke-v109.json), [catalogue et douzième colonie identiques aux fichiers validés](../../artifacts/appearance-public-v109.json).

V108 : production 6ab796356ca4a20087eb0767, 26 septembre 2026, 36 fichiers. Déplacements plus réactifs, schéma 106 et logique conservés. [Preuves et contrôle public](../history/validation-latency-v108.md).

V107 : production 6ab78cd1cbfca039739970d1, 26 septembre 2026, 36 fichiers. Salissures transparentes avec schéma 106 et catalogue conservés. [Preuves et contrôle public](../history/validation-filth-v107.md).

V106 : production `6ab719c6cae56ea3797e9ca3`, 26 septembre 2026, 36 fichiers. [Lièvre domestique, soins et vérifications publiques](../history/validation-domestic-v106.md). Onze colonies accessibles depuis Charger ; migration stricte en schéma 106.

V104 : production `6ab6f10d39e44ca841f1266f`, 26 septembre 2026 (date locale), 34 fichiers. [Sculptures et bibliothèque intégrée](../history/validation-art-v104.md). Neuf colonies directement dans Charger → Colonies de test, dont Pièces vécues et Atelier de sculpture. [Contrôle général](../../artifacts/netlify-smoke-v104.json) et [chargement public exact](../../artifacts/art-public-v104.json) réussis ; schéma 104 par migration neutre, anciennes fixtures préservées.

V103 : production `6ab6e70384f6d62f0f619a5d`, 25 septembre 2026, 32 fichiers. [Pièces vécues, migration et contrôles](../history/validation-rooms-v103.md). Le [parcours général](../../artifacts/netlify-smoke-v103.json) et la [démonstration publique](../../artifacts/room-public-v103.json) passent ; bundle identique au build validé, import exact, repas réel et souvenir sauvegardé. Schéma 103, anciennes fixtures conservées. [Télécharger la salle préparée](https://lisiere-duponch.netlify.app/test-saves/v103/salles.json).

V101 : déploiement de production `6ab5b90aeb6ac4082e8bde84`, 25 septembre 2026 (date locale), 31 fichiers. [Atelier, équipement, rangement et contrôles publics](../history/validation-machining-v101.md). Schéma métier 101 par migration neutre, enveloppe de stockage inchangée. La [démonstration atelier](../../public/test-saves/v101/atelier.json) s'importe depuis Charger une partie ; les six anciennes colonies de test restent immuables. Le contrôle courant compte 61 outils illustrés et conserve les vérifications de curseurs, gestion et sauvegarde.

V100 : déploiement de production `6ab5a9a7e4d26356179e4f23`, 25 septembre 2026 (date locale). [Refonte visuelle et contrôle du bundle public](../history/validation-interface-v100.md).

V99 : déploiement de production `6ab5a08e252bef16783b20b9`, 25 septembre 2026 (date locale). [Validation des interactions et contrôle public](../history/validation-interaction-v99.md).

Le site du jeu est **https://lisiere-duponch.netlify.app**, projet Netlify `lisiere-duponch`, identifiant `9c1b98b5-68a5-4242-b1ec-3bc193b93445`, compte `duponch`. Aucun autre site du compte n'est modifié.

La recherche des connecteurs disponibles n'a trouvé aucun outil Netlify callable. L'API officielle a permis de publier avec la connexion Netlify locale existante ; aucune intervention ni transmission de secret par l'utilisateur n'a été nécessaire. Sources : [API de déploiement](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/) et [spécification officielle](https://open-api.netlify.com/), consultées le 21 septembre 2026.

## Publication reproductible

1. Valider puis lancer `npm run build`.
2. Lancer `node scripts/deploy-netlify.mjs --prod`. Sans `--prod`, la publication reste un aperçu.
3. Vérifier la réponse HTTPS, les fichiers et le parcours de création/chargement sur le site réellement publié.

Le script lit `NETLIFY_AUTH_TOKEN` ou la connexion CLI existante dans la configuration locale Netlify. Il ne copie ni ne journalise le jeton. `.netlify/state.json` est local et ignoré par Git. Le projet et le compte sont contrôlés avant publication. `--create-site` n'est prévu que pour la première création ; aucun remplacement implicite d'un site existant.

Seul `dist` est inventorié : empreintes SHA-1, envoi des fichiers demandés, puis attente de l'état `ready`. Les liens symboliques sont refusés. `artifacts/netlify-latest.json` contient un résultat sans secret ; une copie datée conserve la preuve de livraison. `netlify.toml` déclare le build Vite, le répertoire public et Node 22. Les illustrations à noms stables sont revalidées à chaque nouvelle navigation ; le reste des assets a un cache d'une heure.

Cette configuration publie à la demande. Elle ne prétend pas avoir connecté un déploiement Git automatique. Le bundle de production n'expose pas le diagnostic `window.__lisiere` des tests.

## Badge et contrôle réel

Le premier contrôle public a révélé un iframe `nl-badge-frame` injecté par Netlify au-dessus du bouton Menu. Le réglage de ce seul projet `built_with_badge_enabled` est désactivé par l'API ; aucune modification de forfait ni contournement CSS. Ce réglage est prévu par la [documentation officielle du badge](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/), consultée le 22 septembre 2026, et prend effet à la requête suivante sans redéploiement.

`node scripts/smoke-netlify.mjs` contrôle la version publique dans Chromium natif : accueil, vraie création de partie, cinq dossiers, registre Ressources à 216 px, portrait sélectionné lisible, sauvegarde/rechargement, trois panneaux sans débordement, six colonnes Faune, 60 pictogrammes, neuf curseurs, deux fontes, sept illustrations HTTP 200 et absence d'erreurs JS/GPU. Le suffixe `VALIDATION_VERSION` conserve les preuves historiques (défaut `v94`). Rapport courant : `artifacts/netlify-smoke-v94.json` ; les vérifications ne forcent pas les clics à travers un élément masquant.

## Sauvegardes et compatibilité

HTTPS permet WebGPU dans un navigateur compatible avec le GPU de la machine. Ce déploiement est statique : aucune sauvegarde sur serveur, compte joueur ou synchronisation cloud n'est ajouté. Les sauvegardes restent dans le stockage du navigateur, propre à cette origine ; une sauvegarde de localhost n'apparaît donc pas automatiquement sur Netlify. Changer de navigateur/profil crée également un autre stockage.

Depuis V93, les grandes sauvegardes sont compressées sans perte pour réduire leur consommation de quota. Les JSON historiques restent lisibles ; le schéma du monde reste 91. [Format, bornes et récupération](save-storage.md).

V98 publie aussi six [colonies de test](test-colonies.md), téléchargées à la demande, avec manifeste et fichiers revalidés par HTTP. Elles sont transportables par téléchargement/import ; aucune synchronisation cloud n'est ajoutée. Déploiement `6ab593dc07b647ac555993f8`, 30 fichiers prêts ; [parcours public des six configurations](../../artifacts/test-colonies-native-v98-public.json).

## Reprise V95 après limitation API

Le premier envoi V95 a reçu HTTP 429 (« API Request rate limit surpassed for application »), après création du déploiement. Le script sait reprendre cet identifiant avec `NETLIFY_RESUME_DEPLOY`, contrôle son site et son mode de publication, puis envoie les empreintes encore demandées. Un GET peut renvoyer `required: []` alors que l’état est encore `uploading` : la reprise passe donc par le PUT officiel `updateSiteDeploy` du même manifeste au même identifiant. Ne pas relancer une création pour réparer un envoi incomplet.

Les requêtes GET/PUT attendent l’échéance `X-RateLimit-Reset`/`Retry-After`, avec au plus trois reprises ; un POST de création n’est jamais répété automatiquement. Ces limites sont décrites dans la [documentation Netlify](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/#rate-limiting), consultée le 24 septembre 2026. Aucune clé n’est copiée dans le dépôt ou la sortie.

La réponse de limite observée utilise parfois un epoch et parfois une date UTC ; les deux formes sont reconnues. Le contrôle public ne recopie pas le résultat d’une version précédente quand `EXPECTED_DEPLOY_ID` diffère, afin de ne pas fabriquer une fausse preuve de publication.

V95 : déploiement `6ab57508f64713831acd4aec`, 23 fichiers, état API `ready`. [Résultat](../../artifacts/netlify-v95.json), [contrôle public](../../artifacts/netlify-smoke-v95.json).

V96 : correctif du contexte de caméra/ombres, déploiement `6ab5816e3f833a295c8b395e` prêt, [contrôle public réussi](../../artifacts/netlify-smoke-v96.json) et [bundle identique au build validé](../../artifacts/netlify-v96-bundle.json).

V97 : paysage visible et deltas de flore, déploiement `6ab58e97dabdfb48f402dd22` prêt ; [parcours public dans Chromium visible](../../artifacts/netlify-smoke-v97.json), [empreinte du bundle validé](../../artifacts/netlify-v97-bundle.json).
