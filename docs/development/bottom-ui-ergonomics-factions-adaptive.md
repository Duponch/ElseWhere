# Factions, Menu et fenêtres ajustées au contenu

La barre basse conserve les graphismes, matériaux, polices et couleurs carton3D actuels. Ce lot améliore l’accès au Menu et aux faits des factions, puis répond à la nouvelle demande humaine : une fenêtre doit épouser son contenu courant. Trois colons ne doivent pas laisser un tableau vide occupant la hauteur d’une grande population ; une longue liste conserve une fenêtre bornée et ses défilements.

Le départ de ce lot est `fd66aa619a4655573684e305ebe0a1b746ab88c6`, après les [trois tableaux de colons](bottom-ui-ergonomics-colonist-tables.md), [Faune/Animaux](bottom-ui-ergonomics-animals.md), [Quêtes/Historique](bottom-ui-ergonomics-quests-history.md) et [Zones](bottom-ui-ergonomics-zones.md). Le périmètre produit reste limité à cinq sources d’interface : Main, native-contract, native-layout, native-panels et native-world. Le schéma reste **301** ; aucun champ World, migration, propriétaire de campagne, règle diplomatique, cadence physique, commande moteur ou historique persistant n’est ajouté.

## Menu : actions usuelles et vraies pages existantes

Partie, Sauvegardes, Préférences et carnet, Échanges et Autres actions sont regroupés dans le producteur du Menu. Reprendre reste une action fixe. Options, Aide et Gérer les sauvegardes utilisent les vrais flux déjà présents ; le gestionnaire conserve ses révisions opaques, confirmations et gardes. Les anciens ajouts tardifs de Main sont retirés pour éviter une duplication ou un accès après toutes les copies.

Le Menu présente le nombre de copies disponibles et leur répartition. Les métadonnées complètes restent accessibles derrière le dépliage de vue ; aucune sauvegarde n’est retirée du dépôt. Les activations des anciens formats sont repliées initialement. Déplier ne produit aucune commande, et les quatre activations existantes conservent leurs vrais prérequis prospectifs. Sauvegarder, Exporter et Reprendre restent refusés en présence d’un arrêt fatal selon leurs gardes existantes.

Les callbacks relisent le contexte actuel, l’époque/carte et l’état occupé avant navigation ou commande. Les états repliés/dépliés sont locaux à la présentation et remis à zéro au changement de contexte. La largeur demandée est de 450 px, bornée par le viewport ; elle n’ajoute aucun nouveau style graphique.

## Factions : faits comparables, dossier choisi

La liste de Factions expose les mêmes factions non cachées du registre. Nom, type, relations, dirigeant, nombre d’établissements et état sont directement comparables dans un tableau compact. Le choix d’une ligne ouvre uniquement le dossier de cette faction et ses établissements, au lieu de dérouler tous les établissements à la racine.

La recherche ignore les accents et couvre faction, dirigeant et établissements enregistrés. Le tri par nom, relation ou nombre d’établissements réordonne seulement la vue ; le registre, l’ordre des propriétaires et leurs identifiants sont conservés. Une relation absente reste « Relation inconnue » ; aucun goodwill ou statut neutre n’est inventé. Un dirigeant ou un état non enregistré est explicitement indiqué comme tel.

Inspecter un établissement réutilise la route existante vers le globe. Le vrai clic retrouve à nouveau la faction et la cible dans le registre courant, puis compare identifiant, propriétaire et case. Une cible disparue ou remplacée ne désigne pas une autre case. Les refus busy/contexte périmé et les propriétaires des règles commerciales restent en place. Le tableau Monde → Factions existant n’est pas remplacé par ce nouveau dossier.

Dans la référence pré-refonte `c7c61ebb`, le bouton Factions était désactivé. Ce lot n’est donc pas la restauration d’un ancien écran Factions actif. Il organise les faits déjà présents dans Elsewhere, sans ajouter de mécanique depuis une capture d’un autre jeu. **Aucune nouvelle référence visuelle Factions, ni preuve vanilla 1.6 exacte, n’est revendiquée.**

## Hauteur : petit contenu compact, longues listes accessibles

Les profils Travail, Planning, Assignations, Animaux, Faune et Factions mesurent leurs lignes avant de choisir leur hauteur. Le viewport demeure un plafond. Une petite population utilise sa hauteur utile ; une population longue garde le scroll, les noms, recherches et entêtes fixes et les actions hors du corps défilant. Les largeurs intrinsèques et le défilement horizontal des fenêtres étroites conservent les colonnes lisibles.

Menu, Quêtes et Historique avaient déjà une hauteur naturelle dans la branche générique ; cette propriété est conservée. Monde sans globe peut également se rétracter. Un véritable globe ou graphe est un contenu visuel réel et conserve l’encombrement nécessaire à sa lecture ; le nombre de colons n’en est pas la seule mesure.

Les réserves mesurent les réglages, la recherche et les lignes réelles de l’arbre avant de dimensionner le papier. Un arbre vide ne réserve plus une grande zone. Architecte mesure les catégories, les constructions et le dossier, en colonnes ou empilés selon la largeur ; la région réellement la plus longue fixe le besoin utile. Recherche mesure les nœuds, les trajets des liens et les onglets plutôt que le seul canevas déclaré. Les grandes régions restent défilantes ; les contrôles conservent leurs tailles. Les onglets débordants de Recherche gardent leur défilement indépendant, et un catalogue vide ne prive plus un long dossier étroit de sa hauteur disponible.

Les palettes Ordres/Zones restent des rubans compacts. Les autres inspecteurs ne sont pas inclus dans cette nouvelle correction. Aucun délai, ACK, vitesse physique, donnée de campagne ou règle n’est modifié pour obtenir une petite fenêtre.

## Qualification et limites

Les quatre contrats Factions/Menu passent : accès au vrai gestionnaire nommé, Options/Aide, dépliage sans commande, gardes busy/contexte/fault, visibilité du registre, recherche/tri sans mutation et dossier/cible courants. La première qualification de ces cinq sources a acquis le typage strict en80,447s et Pages CODE en5,810s ; **elle précède les hauteurs adaptatives et ne vaut pas qualification finale de ces dernières**.

Les quatre nouveaux contrats de taille ont d’abord reproduit deux échecs et deux réussites sur le témoin, puis quatre réussites après la correction Root des tableaux. Ils couvrent0/3/45lignes, petit tableau stable sur écran plus haut, conservation des lignes sur fenêtre étroite, entêtes fixes, fin de liste atteignable, hauteur générique et textes enveloppés. Aucun nombre de pixels final n’est copié comme oracle de réussite.

L’intégration avec les trois nouveaux cas Architecte/Recherche/Stockage et les trois cas de stockage existants a d’abord conservé neuf réussites et un ancien oracle refusé : ce dernier attendait une hauteur identique de616px alors que le contenu naturel donnait614px. L’oracle est remplacé par une croissance selon le contenu et un pied fixe absolu, puis les trois cas de stockage passent. L’union reste **dix cas adaptatifs distincts**, auxquels s’ajoutent les quatre cas Factions/Menu ; les reprises ne sont pas de nouveaux contrats. Le premier refus et sa correction sont conservés.

Qualification finale des sources intégrées : typage strict 98.176 s, puis Pages CODE 7.594 s. Carte complète de 2 132 sources, SHA256 `3097afb78e58dec3afbc4e62cbb7520a04281feb2be0656ed0f2a07e23d5a1a8`. Les quatre autres sources de ce lot conservent leurs pins après les seules coutures de hauteur NativeLayout. Aucun Worker de simulation ou de présentation n’est modifié.

Observation réelle Native/WebGPU dans un composant privé à 1 280 × 720 : Travail à trois personnes tient dans 330 px et Planning dans 362 px, sans scroll vertical. Avec 45 lignes synthétiques, Travail occupe son plafond de 616 px ; le défilement atteint 1 730 px et la dernière personne Margot est visible, tandis que recherche, noms et entêtes restent en place. Factions affiche le registre de 13 factions visibles, un dossier choisi a été ouvert, puis le Menu a routé le clic Options vers un spy explicite. Aucun réglage ni gestionnaire de sauvegarde réel n’est exécuté dans ce composant. Les deux Worlds de présentation restent byte-identiques par leur sérialisation avant/après, à Core0, sans commande et sans erreur observée. Les captures et diagnostics sont conservés. Viewport rétabli et serveur/onglet privés fermés. Pas de nouvelle observation visuelle de stockage, Architecte ou Recherche revendiquée ; leur nouvelle géométrie est couverte par les contrats ciblés.

Les fixtures de pages et les charges de registre sont privées, à Core0, distinctes de la vraie colonie325. Elles ne constituent pas une campagne admise/jouée, une progression de simulation ou une sauvegarde/recharge Whole. La campagne réelle, ses conséquences, les autres sauvegardes et les références restent intactes et en pause. Aucune identité exhaustive avec RimWorld ni accessibilité universelle n’est affirmée.

## Coût local acquis, écarts adverses conservés

Un seul W/C/W a mesuré deux scènes et vingt constructions par scène : Menu avec douze métadonnées synthétiques seulement, et Factions depuis les vrais générateurs purs de registre sur un World16². Les imports, initialisations, cinq échauffements et assertions sont hors chronométrage. Aucune commande, navigation, sauvegarde réelle, Worker ou progression n’est exécutée.

| Projection UI | Témoin avant, moyenne | Candidat, moyenne | Témoin après, moyenne |
|---|---:|---:|---:|
| Menu |0,025315ms|0,095745ms|0,025035ms|
| Factions |0,036020ms|0,292945ms|0,035910ms|

Les maxima candidat sont0,6987ms pour Menu et1,1318ms pour Factions. Les deux moyennes candidat sont plus élevées que leurs témoins : ces écarts adverses sont conservés. La vue Factions est plus riche et munie de nouvelles gardes de navigation ; cela ne transforme pas cette observation en gain ou coût nul. Le Menu candidat commence avec les copies repliées, et Factions trie/condense volontairement ses établissements. L’ensemble des identifiants de factions visibles reste exact, de même que le SHA et l’ordre du World ; l’ancien ordre projeté et ses sous-lignes ne sont pas exigés artificiellement.

Les sources mesurées sont NativePanels296e40cc et NativeWorld8812fa58. Ce coût porte sur les producteurs de pages Factions/Menu, **pas sur la disposition adaptative, le dessin Native/GPU, les FPS, la fluidité générale, le débit moteur ou une non-régression globale**. La présentation ne change ni la vitesse physique ni la qualité pour masquer une charge de simulation.

Commit, push, paquet et publication restent quatre attestations distinctes dans les reçus de livraison. La présente note ne permet de présumer aucune publication avant sa vérification réelle.
