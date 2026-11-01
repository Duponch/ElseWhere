# Ergonomie de la barre basse : premier lot Zones


Le panneau de stockage précédent obligeait à parcourir une longue liste de catégories ou un dialogue large pour modifier une réserve. Ce lot rapproche les réglages de la zone sélectionnée : paramètres compacts, recherche, véritable arbre repliable et commandes d’autorisation distinctes des chevrons. Il conserve les matériaux, les objets et les graphismes carton3D actuels, ainsi que les règles et commandes de simulation existantes.

## Référence et périmètre

La référence précédant le remplacement des menus actifs est **c7c61ebbf06a6bdfe42219b3c19989309e3a2cb1**. Le produit de départ de ce lot est **1587b2ed2c5e225d5b07079fdffb2fa55d4bfc86**. La comparaison couvre les douze boutons de gestion et le dock Ordres/Zones ; seul le premier lot Zones est modifié ici. Les autres écrans restent des suites distinctes, pas des résultats livrés par ce changement.

| Entrée | Référence avant remplacement | Produit de départ et portée de ce lot |
|---|---|---|
| Architecte | Catégories, grille, options latérales | Trois régions déjà présentes ; conservées. |
| Travail | Matrice colons × métiers et activité | Table déjà présente ; conservée. |
| Planning | Matrice de 24 heures, pinceau et copie | Table déjà présente ; conservée. |
| Assignations | Politiques comparables par colon | Table déjà présente ; conservée, avec accès aux zones autorisées. |
| Animaux | Tableau des faits et commandes du troupeau | Table actuelle ; certains faits passent par dossier/infobulle ; hors lot. |
| Faune | Tableau chasse/animal/sexe/activité/position/apprivoisement | Lignes ordinaires actuelles, sans matrice dédiée ; hors lot. |
| Recherche | Graphe des prérequis et détail | Adaptateur/graphe dédié conservé. |
| Quêtes | Sections dossier courant, précédents, commerce | Liste native inversée et profil plus succinct ; hors lot. |
| Monde | Cartes/colonies, globe/caravanes, voyages individuels | Onglets et globe actuels conservés. |
| Historique | Économie structurée et 30 derniers événements | Économie condensée et tous les événements fournis ; hors lot. |
| Factions | Bouton désactivé, aucun panneau actif | Page actuelle avec relations, dirigeants et établissements ; conservée. |
| Menu | Partie, sauvegardes et préférences regroupées | Menu compact ; Options et gestion des copies ont leurs entrées globales ; hors lot. |
| Ordres | Dock déjà séparé d’Architecte | Dock courant conservé ; ce lot ne change pas ses commandes. |
| Zones | Dock séparé, réserves avec arbre compact | Édition du stockage et table des zones autorisées réorganisées ; gestion, dialogues et cultures inclus dans ce lot. |

Sources de comparaison : `src/ui/layout.ts`, `architect-workbench.ts`, `storage-item-controls.ts`, `storage-filter-tree.ts`, `visual-identity.css` à la référence historique ; `src/ui3d/native-panels.ts`, `native-inspector.ts`, `native-world.ts`, `native-layout.ts` et `NativeStage.ts` au produit de départ. Les relevés privés détaillés sont `history-comparison.md` et `four-panels-comparison.md`.

## Stockage : ce qui change

| Sujet | Avant ce lot | Nouvelle présentation |
|---|---|---|
| Réserve sélectionnée | Tous les nœuds déroulés avec préfixes de profondeur ; pas de recherche ni repli réel | Arbre hiérarchique, recherche et état d’expansion par cible. |
| Futures réserves | Arbre fonctionnel dans un dialogue générique de 780 px, deux gros boutons par nœud | Éditeur partagé de stockage, réglages compacts et lignes de 27 px avec retraits de 17 px. |
| Développer/autoriser | Gestes lourds ou hiérarchie seulement textuelle | Chevron et permission séparés ; état autorisé/interdit/mixte. |
| Organisation | Réglages puis longues catégories dans le même parcours | Format dédié demandé de 480 × 760 px ; paramètres et recherche/actions fixes, arbre défilant ; petit viewport avec accès séparé aux réglages. |
| Valeurs | Réglages dispersés sur plusieurs lignes | Priorité, frais/pourri, plages qualité et PV rapprochés ; bornes PV côte à côte. |
| Zones autorisées | Longues lignes d’actions | Table compacte demandée de 1280 px ; mêmes dix zones maximum et mêmes actions. |

Le gestionnaire retrouve son accès direct depuis Zones. Renommer, changer la couleur, saisir un rectangle et confirmer une suppression reviennent à la liste, puis au menu d’origine. Les huit couleurs nommées complètent un code hexadécimal précis et un aperçu ; aucune commande ne part avant Appliquer. Les cultures retrouvent un sélecteur localisé et leur surface, avec les options hydroponiques propres au bac. Les autres outils de toit, foyer et déneigement gardent leurs conditions de disponibilité et leurs commandes.

L’aperçu sur la carte est rétabli depuis le survol ou le focus clavier des commandes de chaque zone. Une sortie, fermeture ou suppression du contrôle nettoie l’aperçu ; le pinceau actif reste la destination de repli. Les callbacks d’une même zone sont partagés pour éviter de refaire l’aperçu lors du passage entre ses boutons. Il n’y a pas de nouveau scan World par frame.

La nouvelle présentation conserve le vrai catalogue imbriqué, sans dupliquer ses feuilles. Développer un groupe et chercher ne commandent aucune modification du World. Une permission de groupe agit sur ses descendants admissibles ; Tout interdire/Tout autoriser reste global au catalogue admissible, même pendant une recherche. L’état d’expansion et le défilement appartiennent à l’interface, pas à la sauvegarde de simulation.

Les deux modes d’édition restent distincts : une réserve/étagère existante envoie ses modifications immédiatement ; les futurs stockages utilisent un brouillon et une application explicite. Les contrôles conservent priorité, fraîcheur, qualité, PV, copie/collage, capacité du sol et limites physiques des étagères. Les bornes opposées et les permissions extérieures au groupe sont relues depuis la politique courante au moment de l’action.

Une garde corrige aussi un cas de sélection périmée : un ancien bouton pouvait encore viser la réserve précédente après une nouvelle sélection sur la même carte. Les actions du stockage vérifient désormais la sélection courante en plus du contexte carte/époque et de l’état occupé. Ce refus protège la destination de la commande ; il ne crée aucune nouvelle règle de stockage.

## Références visuelles et limites de version

L’organisation proposée s’appuie notamment sur la [capture wiki Important stockpile](https://rimworldwiki.com/wiki/File:Important_stockpile.jpg), téléversée le 2 février 2020 : priorité, paire Tout interdire/Tout autoriser, plages PV/qualité, hiérarchie et états mixtes. La [capture de stockage du guide BisectHosting du 10 juillet 2024](https://www.bisecthosting.com/blog/rimworld-beginners-guide-setup-first-steps-tips) montre également recherche, frais/pourri et onglet Stockage proche de l’inspecteur. Les pixels ont été examinés et conservés dans les preuves privées de `zones-visual-reference.md`.

Ces références sont antérieures à la version 1.6 ; leur version exacte, leurs mods et leurs DLC ne sont pas tous attestés. Elles étayent une architecture d’interface, pas une identité avec Core1.6.4871rev590 ni les règles de simulation. L’[annonce officielle 1.6](https://ludeon.com/blog/2025/06/announcing-odyssey-and-update-1-6/) et son changelog fournissent des faits textuels, notamment la couleur de zone modifiable par son carré dans Gérer les zones ; aucun gros plan vanilla 1.6 exact de cette fenêtre n’a été acquis. Aucun contrôle ou contenu de simulation absent du produit n’est ajouté à partir d’une capture.

## Implémentation et qualification actuelle

Les adaptations sont limitées à la présentation Native et au raccord de prévisualisation du renderer dans Main. Les autres sources, dont la simulation et la sauvegarde, sont vérifiées contre la carte du produit de départ. Le schéma reste 301.

Les **28 cas distincts ciblés** passent : 21 stockage/layout, 5 parcours Zones et 2 cycles de vie des aperçus. Les reprises de trois layouts puis de deux parcours ne sont pas comptées comme de nouveaux cas. Une attente de test supposait les outils neige visibles sur une fixture sans propriétaire neige : elle a été corrigée pour vérifier le refus réel existant ; le premier résultat est conservé.

Une observation réelle Native/WebGPU à 1280 × 720 a vérifié les dix racines visibles, le dépliage, la recherche au clavier avec ancêtres, une permission, le défilement de l’arbre avec réglages fixes et l’application exacte d’un brouillon local. Le contrôle est un composant privé, sans Worker ni campagne jouée. Il ne qualifie ni FPS globaux, ni toutes tailles d’écran ou charges. Les petits viewports sont vérifiés par les contrats de layout, qui conservent un accès indépendant aux réglages.

Le typage complet passe en 104,649 s et la première compilation Pages en 7,179 s. Une dernière finition limitée à deux libellés et aux largeurs de deux champs conserve ce typage ; les trois contrats de disposition sont rejoués et la compilation finale passe en 7,108 s. La carte finale couvre 2132 sources, empreinte 113f391fd238eb532620fbc14395699d3e35e202079b9bed46b1476de59072a3.

Le contrôle Native a également observé la réserve sélectionnée, le gestionnaire, une couleur annulée sans commande, la prévisualisation au focus clavier puis son nettoyage, et un choix Pommes de terre qui conserve les permissions semis/coupe. La fixture reste au Core zéro et distincte de la campagne humaine. Les screenshots et reçus restent dans le checkpoint privé du lot.

Les autres écrans de la barre restent à traiter selon le comparatif, à commencer par les tableaux Faune et Animaux. Leurs règles de jeu ne sont pas modifiées par ce lot.
