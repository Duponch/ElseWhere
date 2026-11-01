# Ergonomie des écrans Faune et Animaux

Les listes Faune et Animaux affichaient peu de faits comparables : beaucoup d’informations domestiques se trouvaient dans les infobulles ou les dossiers, la Faune utilisait de grandes lignes ordinaires et les quotas se situaient après toute la population. Ce lot rétablit des tableaux compacts, des réglages directs et une navigation adaptée à de longues listes, avec les objets, matériaux, couleurs et graphismes carton3D actuels.

Le produit de départ est le lot Zones `1fb9052ac882551bd0e5f971bea3d547a92c645f`. La référence avant remplacement des menus actifs reste `c7c61ebbf06a6bdfe42219b3c19989309e3a2cb1`, déjà comparée dans [le premier lot Zones](bottom-ui-ergonomics-zones.md). Ce changement est limité aux deux écrans et à leur mise en page native ; les autres tableaux conservent leur branche de disposition existante. Le schéma reste **301**, sans nouvelle règle de simulation ni migration.

## Présentation et parcours

| Sujet | Avant ce lot | Nouvelle présentation |
|---|---|---|
| Animaux domestiques | Cinq commandes principales ; sexe, maturité, soins, zone et produit regroupés surtout dans les détails | Dix colonnes : sexe, âge, maturité, soins, zone/enclos, produit, transport, abattage, repérage et dossier. Activité et gestation restent directement visibles. |
| Faune | Grandes lignes avec commandes dispersées | Sept colonnes alignées : sexe, position, chasse, apprivoisement, repérage, tir et mêlée ; activité visible. |
| Longues listes | Parcours manuel et perte des intitulés pendant le défilement | Recherche sans sensibilité aux accents, filtres locaux, tri stable et sens du tri ; compteur de résultats dans le titre. Barre de recherche et entêtes restent en haut. |
| Réglages fréquents | Plusieurs faits nécessitaient l’ouverture du dossier | Politique médicale sélectionnable dans la ligne, désignations et transport accessibles au même endroit ; options complètes conservées. |
| Abattage automatique | Section après tous les animaux | Bouton toujours accessible vers une synthèse par espèce et les éditeurs de quotas existants. |

Les lignes de données mesurent **34 px**, avec des contrôles de **28 px** et des cibles d’au moins 24 px. Les largeurs de colonnes sont pondérées : davantage de place pour les soins et la zone, moins pour le sexe ou une désignation. Les lettres F/M restent accompagnées de leur libellé complet en infobulle ; les soins et les statuts longs conservent leurs descriptions complètes et les choix détaillés dans leurs menus.

Le tableau utilise la hauteur disponible au-dessus de la barre basse. Sa largeur intrinsèque minimale est de 1140 px pour Animaux et de 1000 px pour Faune. Sur un écran étroit, le tableau défile horizontalement en conservant les noms dans une bande fixe de 104 px ; les entêtes restent alignées avec leurs cellules. Ces minima ne garantissent pas l’absence de tout défilement sur tous les écrans.

Les recherches et filtres sont des états d’interface distincts pour les deux onglets. Un changement de recherche ou de tri ramène en haut de la liste. Le tri départage les égalités par identifiant, sans réordonner le tableau World d’origine. Les recherches prennent en compte nom, espèce, sexe, activité et identifiant, ainsi que la zone/enclos pour les domestiques. La Faune reste limitée aux animaux sauvages connus par les lecteurs de connaissance existants.

## Commandes et propriétaires conservés

Les contrôles utilisent les commandes déjà présentes pour les soins, la chasse, l’apprivoisement, le combat, l’abattage, le dressage au transport, l’affectation de zone et les quotas. Leurs conditions de disponibilité et les propriétaires des règles restent les mêmes. Les filtres ne créent ni permission ni désignation ; les valeurs affichées viennent des helpers existants de vie animale, de produits, de soins, de zone et d’activité.

Un ancien contrôle ne peut pas commander depuis une autre carte : les callbacks relisent le contexte courant, notamment époque, identifiant de carte, graine, dimensions et état occupé. La cible est retrouvée par son identifiant au vrai clic, y compris après un tri. Les intentions déjà modifiées sont relues avant de les inverser. Le combat relit aussi les colons sélectionnés encore mobilisés. Les choix médicaux restent exactement ceux de `MEDICAL_CARE`.

L’interface réutilise un collateur français et un formateur d’âge avec les mêmes options de formatage. Les clés de texte et d’activité sont mémorisées seulement pendant la construction synchrone de la vue ; aucun cache persistant de World ou nouvel historique n’est ajouté. Les cibles d’abattage automatique sont capturées une fois pour la vue domestique et ne sont pas calculées pour la Faune sauvage.

## Référence visuelle et limite de version

La [capture Animals menu du wiki](https://rimworldwiki.com/wiki/File:Animals_menu.png), téléversée le **2 mai 2020 à 00:51**, a été réellement examinée : noms, sexe, âge, entraînements, maître, soins et zones colorées sont présentés en lignes parallèles. Le fichier mesure 1105 × 310 px ; l’édition de la page datée du 6 août 2022 ne constitue pas la date du jeu représenté.

Cette capture est antérieure au système d’enclos et ne prouve pas l’apparence exacte de vanilla 1.6. Elle étaye l’organisation en tableau, avec la comparaison de notre ancienne interface ; elle ne sert pas à inventer des contrôles ou des règles absents de notre moteur. Aucun contenu propriétaire du jeu n’est intégré au produit à partir de cette image. Ce lot ne prétend pas établir une identité exhaustive avec RimWorld.

## Qualification acquise à cette rédaction

**Six contrats ciblés distincts passent**, par les reprises conservées : quatre sur les producteurs et leurs commandes, deux sur la disposition. Ils couvrent les faits domestiques et choix médicaux, la recherche et le tri sans mutation ni révélation d’inconnus, les identifiants et intentions fraîches, les refus de contexte périmé, les entêtes fixes, les colonnes alignées et la conservation de la disposition des autres tableaux. Les reprises après finition des cellules ne sont pas comptées comme de nouveaux cas.

L’observation réelle **Native/WebGPU** utilise une fixture privée 16 × 16 contenant douze domestiques et douze sauvages, au Core zéro. Elle a acquis : soins par plantes pour l’animal 87, défilement avec entêtes fixes, recherche `etoile` retrouvant l’animal 76 sans accent et réinitialisant le défilement, repérage du même identifiant, filtre Produit prêt trouvant seulement Calypso, puis désignation de chasse de l’animal 97. Les deux commandes interactives passent par les vrais handlers locaux et sont acceptées ; neuf commandes de préparation sont distinguées des interactions. Le reçu conserve Core 0 et aucune erreur.

Ce contrôle ne charge aucune campagne, aucun Worker et aucune sauvegarde ; le repérage y enregistre l’identifiant sans renderer de carte. Il ne prouve ni le mouvement réel de la caméra ni une partie en ligne. La campagne humaine 325 reste intacte et en pause.

Le typage strict complet passe en **69,524 s**, puis la compilation Pages CODE en **4,248 s**. La première tentative avait refusé uniquement un booléen de mobilisation dans la fixture, incompatible avec `DraftState` : résultat conservé, objet de mobilisation corrigé puis quatre contrôles producteurs repassés. Les deux contrôles de disposition acquis restent valides. Commit, push et publication sont attestés séparément par le reçu de livraison du checkpoint, jamais déduits de la compilation.

## Coût borné du projecteur UI

Un protocole W/C/W mesure seulement la construction des données du tableau Animaux. Chargement, initialisation, warmup, hashes et assertions sont hors des fenêtres. Les identifiants et leur ordre sont exacts entre les bras, le World reste inchangé, aucune commande n’est émise et le Core reste zéro.

Une première comparaison acquise a conservé un écart adverse à 300 acteurs : candidat **16,085 ms** par construction, témoins **14,958 / 14,321 ms**. Le formateur d’âge créait encore son formatage local à chaque ligne. Après réutilisation du formateur avec les mêmes options, la comparaison finale est :

| Acteurs projetés | Témoin avant, moyenne | Candidat final, moyenne | Témoin après, moyenne |
|---|---:|---:|---:|
| 30 | 1,877 ms | 0,272 ms | 2,105 ms |
| 300 | 19,293 ms | 2,422 ms | 14,679 ms |

Le candidat final reste inférieur aux deux témoins dans ces fenêtres ; les variations des témoins, maxima, coûts CPU processus/fil et anciens résultats défavorables sont conservés. Le premier lancement du banc avait échoué avant collecte à cause d’un alias Vitest CommonJS ; sa reprise ESM est distinguée des mesures acquises.

**300 acteurs est une charge UI synthétique au-delà du cap de simulation actuel de 256**, jamais une campagne valide de 300 animaux. Ces valeurs ne mesurent ni Native/GPU/FPS, ni débit de simulation, ni coût global du jeu, ni non-régression universelle. Les sources et reçus bornés restent dans le checkpoint privé du lot.

Le contrôle bureau à 1280 × 720 montre les dix colonnes domestiques et l’activité sans défilement horizontal. Le contrôle étroit à 473 × 719 atteint les colonnes de droite par la barre horizontale tout en gardant les noms fixes (décalage 747 px). Le viewport temporaire a été réinitialisé après ces observations.
