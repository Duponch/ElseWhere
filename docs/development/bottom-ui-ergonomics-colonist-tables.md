# Ergonomie de Travail, Planning et Assignations

Travail, Planning et Assignations conservaient déjà leurs matrices, mais les entêtes et les contrôles de page défilaient avec la population. Le Planning éloignait ses pinceaux au fil de la liste ; les registres de politiques d’Assignations se trouvaient après tous les colons. Ce lot stabilise les repères, réduit la hauteur des lignes et donne accès directement aux réglages fréquents, avec les objets, matériaux, couleurs et graphismes carton3D actuels.

Le produit de départ est `0aeeafdc116a050f50204658292ebe24a5ffb81d`, après les lots Zones, Faune/Animaux et Quêtes/Historique. La référence avant refonte reste `c7c61ebbf06a6bdfe42219b3c19989309e3a2cb1` : matrice métiers/activité dans `layout.ts`, pinceaux et grille de 24 heures dans `schedule-controls.ts`, affectations et gestion de régimes distincte dans `food-policy-controls.ts`. Le [premier comparatif Zones](bottom-ui-ergonomics-zones.md) décrit la frontière de cette refonte et l’inventaire de la barre basse.

Ce changement est limité à quatre sources d’interface et aux contrôles associés. Le schéma reste **301** ; aucun champ World, migration, règle de simulation ou historique persistant n’est ajouté.

## Structure restaurée

| Écran | Juste avant ce lot | Nouvelle organisation |
|---|---|---|
| Travail | Matrice de dix-huit métiers et activité, mais entêtes défilants et lignes de 48 px avec compétences | Recherche fixe par nom/identifiant, entêtes fixes, dix-huit métiers et activité conservés ; compétences et passions restent visibles. Lignes de 44 px et contrôles de 38 px. |
| Planning | Pinceaux et entêtes dans le même contenu défilant que les personnes ; vingt-quatre heures et copier/coller déjà présents | Recherche et quatre pinceaux fixes ; heures alignées et noms fixes horizontalement ; lignes de 34 px et contrôles de 28 px. Copier/Coller disposent de cellules plus larges que les heures. L’aide existante est accessible par un bouton fixe. |
| Assignations | Valeurs déjà visibles en lignes, mais plusieurs réglages ouvrent un choix séparé ; longues listes de politiques après les colons | Régime, réaction hostile, zone, tenue, drogues et lecture sélectionnables directement dans leurs cellules. Automatisation et libération du port forcé conservées. Gestion Régimes/Tenues/Drogues/Zones accessible par boutons fixes, avec les éditeurs existants. Lignes de 34 px et contrôles de 28 px. |

La recherche ne réordonne pas les propriétaires : elle filtre par nom ou identifiant en ignorant les accents. Chaque écran conserve son propre texte de recherche, et le compteur correspondants/total reste dans son libellé. Le `contentKey` change avec cette recherche pour revenir au début de la liste. Aucune commande n’est produite par une recherche.

Un profil de table explicite, `NativePage.tableProfile: 'colonists'`, utilise les propriétaires de défilement déjà disponibles : recherche et pinceaux dans une région fixe, entêtes au-dessus du corps, noms dans une bande fixe de 104 px, lignes seules défilantes verticalement. La largeur demandée est de 1480 px, toujours limitée par la fenêtre ; la hauteur utilise l’espace disponible au-dessus de la barre basse.

La largeur intrinsèque minimale est de 1180 px pour Travail, 1136 px pour Planning et 1176 px pour Assignations. Sur une fenêtre étroite, le tableau conserve un accès horizontal et les noms restent en place. Les cellules de Travail demeurent égales ; Planning réserve davantage de place à Copier/Coller ; Assignations pondère les colonnes de politique plus longues. Les contrats vérifient des cibles d’au moins 24 px. **Ces dimensions proviennent de la disposition et de ses contrats ; leur rendu en pixels doit être distingué de l’observation Native ci-dessous.**

Les autres tableaux sans ce profil gardent leur branche de disposition. La seule modification de NativeStage ajoute le profil à sa signature de peinture ; elle n’ajoute aucun scanner World ni travail par image. Faune/Animaux et Quêtes/Historique ont été préservés hors des sept coutures, y compris leurs fins de lignes et octets extérieurs.

## Propriétaires, règles et commandes

Les recherches sont des états de vue locaux. Leur portée utilise époque, identifiant de carte, graine et dimensions ; un changement de portée réinitialise les trois recherches et le presse-papiers d’horaires. Le pinceau global conserve son comportement existant.

Les callbacks conservés relisent l’état confirmé disponible, refusent un contexte périmé ou une opération occupée, puis retrouvent le colon par son identifiant. Le verrou de commande en attente reste dans `send`. Aucun réglage n’est traité comme confirmé avant son résultat ; aucune autorité de Worker n’est remplacée par le tableau.

- **Travail** : mêmes priorités entières de 0 à 4 et mêmes commandes `priority`. Niveaux, passions, incapacités de passé et disponibilités existantes restent lisibles. Le moteur conserve ses refus au vrai propriétaire.
- **Planning** : mêmes commandes `schedule-paint` et `schedule-replace`. Les heures sont dédupliquées et bornées à 0–23 ; le collage copie les vingt-quatre valeurs du presse-papiers sans partager l’array du propriétaire source. Une plage reste une priorité, pas une téléportation ni un ordre instantané.
- **Assignations** : mêmes payloads pour régime, réaction hostile, zone, tenue, port forcé, drogues et lecture. Une option est retrouvée dans le registre courant avant envoi. L’affectation de tenue conserve le booléen d’automatisation du vrai colon au clic. Les variantes historiques indisponibles restent désactivées.
- **Gestion des politiques** : les éditeurs existants restent responsables des filtres, créations, copies, renommages et règles. Les boutons fixes changent leur accès, sans créer de nouvelle politique mécanique ni de permission.

Les filtres de population restent ceux de chaque écran : aucune personne supplémentaire n’est révélée ou rendue commandable par la recherche. Les commandes, incapacités, états mort/visiteur/prisonnier et gardes mécaniques continuent d’appartenir à leurs propriétaires existants. Le lot ne change ni horloge, vitesse physique, calendrier de travail, consommation, réservation ou sauvegarde.

## Qualification fonctionnelle acquise

**Onze contrats passent** : quatre nouveaux cas d’ergonomie et les sept interactions existantes de `native-work-interactions.test.ts`. Les reprises ou fichiers ne sont pas comptés comme des cas supplémentaires.

Les nouveaux cas couvrent recherche accentuée et remise à zéro de portée, conservation de World et de l’ordre initial, commandes par identifiant, refus busy/contexte ancien, peinture dédupliquée, copie sans alias, affectations directes, options inconnues sans commande, gestion de politiques hors de la population et géométrie fixe des trois profils. Les sept cas existants conservent notamment les dix-huit métiers, les niveaux/passions, les incapacités, le verrou en attente de confirmation, la peinture et le collage ; leur vérification des accès Architecte/Ordres/Zones reste également intacte.

Les populations de 45 ou 55 lignes ajoutées dans les nouveaux cas sont des **charges synthétiques de projection d’interface**, pas des campagnes valides jouées ou sauvegardées. Les commandes locales testées ne constituent pas une qualification Whole/save, de mouvement ou de débit du jeu.

Le typage strict complet passe en **71,386 s** et la compilation Pages CODE en **4,099 s**. Le reçu épingle 2132 sources, carte `05c4e3f598b3592968e5e9de750b60f151af4ce881d35a8d116838471cf72f56`. Commit, push et publication restent des attestations distinctes dans le checkpoint de livraison.

## Observation Native acquise

Le dessin Native/WebGPU a été réellement observé à 1280 × 720, puis dans la fenêtre étroite de 473 × 719. Les dix-huit métiers, niveaux et passions restent visibles. Le défilement vertical de 720 px garde recherche et entêtes en place. La recherche sans accent « etoile » retrouve Étoile#48 et remet la liste en haut, sans intention supplémentaire.

Dans Planning, les vingt-quatre heures sont visibles. Le tracé Loisir de 6 à 8 h produit une seule intention pour les heures 6,7,8 du colon45. Copier n’envoie rien ; Coller produit une intention de remplacement des vingt-quatre heures pour46. Dans Assignations, le choix Ignorer vise45, et Régimes ouvre le registre existant depuis le bouton fixe. Le changement de priorité réellement cliqué est Construction2 pour45 ; l’intention initiale Root était1 mais le clic a choisi2 : cette conséquence est conservée, sans attribuer l’erreur au produit.

La fixture contient **45 lignes synthétiques non admises comme Whole** : elle capture les intentions avec un spy UI et reflète les réglages dans son modèle. Ces gestes ne constituent aucune confirmation Engine. Le Core reste zéro, aucune erreur ; aucune campagne, boucle de simulation, Worker ou sauvegarde. Les contrôles fonctionnels locaux sont distingués de cette observation. Les rechargements HMR de la fixture après finition n’ont concerné aucune partie jouée ; les quatre intentions acquises avant la dernière largeur sont conservées.

Les derniers changements de présentation sont les intitulés français courts, noms complets conservés en infobulles et dans les cellules au clavier, et le ratio de largeur de Port forcé passé de0,65 à0,9 pour montrer Libérer en entier. Le cas de vraie priorité concerné et le cas de géométrie repassent ; l’union reste **onze cas distincts**. La compilation finale passe en6,156s avec vérifications, carte2132 efbb26f5cc71f2d815990cceb2f2e88212237ad26eb55b6af4d3be991b22b85f. Le typage complet acquis précède seulement ces finitions de texte/largeur, sans changement de callback ou de type persistant. Les Workers compilés sont comparés au paquet précédent à l’assemblage.

En fenêtre étroite, le décalage horizontal783px donne accès à Lecture/Activité et les noms restent fixes. Les boutons de gestion demeurent hors de la liste, dans le pied fixe. Le viewport temporaire est réinitialisé ; la vraie325 reste intacte et en pause.

## Coût limité de la construction des tables

Un seul W/C/W, trois pages ×45 lignes ×20 constructions par bras, initialisation et assertions hors fenêtres. Entrées, identifiants, ordre World, Core zéro et absence de commandes restent exacts.

| Page | Témoin avant, moyenne | Candidat, moyenne | Témoin après, moyenne |
|---|---:|---:|---:|
| Travail |2,758ms|1,941ms|0,773ms|
| Planning |0,661ms|1,338ms|0,466ms|
| Assignations |1,281ms|0,585ms|0,601ms|

Le candidat Travail se situe entre les témoins ; Planning présente un surcoût local d’environ0,68–0,87ms ; Assignations une moyenne moindre dans ces fenêtres. Tous maxima et coûts CPU, dont la forte dérive des témoins, restent conservés. La source mesurée4b5253 précède les seules finitions d’intitulés et de largeur : ce n’est pas une mesure de ces derniers pixels. Aucun gain global, coût nul, FPS, débit de simulation ou non-régression universelle n’en est déduit. Il s’agit du modèle UI, pas du coût Native/GPU.

## Références visuelles et adaptations

Les trois fichiers wiki ont été réellement affichés par Root depuis la page [Menus](https://rimworldwiki.com/wiki/Menus) : [Travail](https://rimworldwiki.com/wiki/File:Work_priorities.jpg), téléversé le25juin2019 à16:30,1001×303 ; [Planning](https://rimworldwiki.com/wiki/File:Restrict_menu.png),2mai2020 à00:41,1010×280, légende sansRoyalty ; [Assignations](https://rimworldwiki.com/wiki/File:Mainmenu_assign.png),2mars2025 à03:24,1428×182, commentaire explicite de mise à jour pour1.5. Dates de fichiers et révision exacte du jeu représenté sont distinctes ; aucune preuve vanilla1.6 n’est revendiquée.

Ces pixels étayent matrices comparables, priorités numériques, heures/pinceaux et politiques directes. Les métiers anglais du premier fichier utilisent deux niveaux alternés ; nos abréviations françaises avec intitulés complets accessibles sont une adaptation aux cellules carton3D. Les boutons de gestion du fichier Assignations sont en haut ; nos boutons sont fixes hors du défilement en bas. Les contrôles absents du moteur ne sont pas fabriqués depuis une image. La charte, les fontes et les graphismes actuels restent conservés, sans copie de contenu propriétaire dans le produit.

Commit, push et publication sont attestés séparément par le reçu de livraison du checkpoint. Les autres campagnes, sauvegardes, RAW et références n’ont pas servi de fixture. Aucune identité exhaustive avec RimWorld n’est déclarée.
