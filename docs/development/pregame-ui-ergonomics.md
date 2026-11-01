# Avant-jeu : dossiers, listes et étapes lisibles dans la charte carton3D

Le lot porte sur tous les menus avant-partie : accueil, scénario, conteur/difficulté/sauvegarde, paramètres du monde, lieu de départ, personnages, chargement, catalogue de tests, options et confirmations. Il réorganise la présentation sans ajouter de scénario, réglage, candidat, contenu de colonie ou capacité moteur pour remplir les écrans.

## Problème et comparaison

Le témoin produit est **6628b137d346cdadac1059d5c7b320bebc1a31d3**, schéma301. Son avant-jeu Native utilise principalement des cartes empilées dans un flux commun ; les Options répartissent les lignes en deux colonnes selon leur nombre, et le dossier des personnages suit les huit candidats puis les détails et les douze lignes d'équipe dans le même défilement. Inspecter un profil, comparer l'équipe et retrouver une action demande donc des déplacements excessifs.

Le chemin HTML historique conservé fournit un contrepoint réel, pas un modèle à restaurer globalement : `front-starting-pawns.ts` et son CSS séparent déjà le rail des candidats, un dossier à trois colonnes et un aperçu d'équipe en bas. Histoire, traits, compétences et relations disposent d'aides au survol/focus. Les paramètres et le choix du lieu possèdent également des composants dédiés (`world-draft-controls` et `world-creation-site`). Ces faits n'établissent ni l'ergonomie de chaque ancien écran ni une identité graphique avec RimWorld. Le lot conserve le rendu carton3D, ses couleurs, matières, pictogrammes et composants de contrôle.

## Structures remises en place

| Écran | Organisation du lot | Comportement conservé |
| --- | --- | --- |
| Accueil | Panneau d'actions compact ancré à droite, titre distinct ; pas de fenêtre complexe occupant inutilement toute la largeur. | Nouvelle partie, Charger, Options, Reprendre seulement si une partie existe ; capacités absentes toujours indisponibles. |
| Scénario | Catalogue à gauche et description/provisions/connaissances à droite. | Seul scénario réellement livré jouable ; les entrées non implémentées restent désactivées. Un clic de sélection n'est pas un départ. |
| Conteur | Rail du conteur, dossier explicatif, choix de difficulté et mode de sauvegarde disposés en groupes distincts. | Le choix actuellement supporté et le mode rechargeable doivent être confirmés avant la suite. Aucune difficulté ni mécanique de sauvegarde absente n'est créée. |
| Paramètres du monde | Réglages regroupés d'un côté ; registre des factions et ajouts nommés de l'autre. Commandes de bas accessibles. | Graine, couverture, climat, population, factions, taille, saison et réinitialisations continuent d'utiliser leurs vrais handlers et invalidations. Contraintes de nombre/unicité relues sur les callbacks retenus. |
| Lieu de départ | Globe principal, information de case adjacente, navigation locale entre détails, liste des cases et factions ; sélection par globe, numéro ou liste. | Même surface, routes et marqueurs, mêmes cases admissibles et pagination. Aucun changement de sélection ne fabrique une carte ni ne remplace le ticket confirmé. |
| Personnages | Rail des trois sélectionnés et cinq autres candidats du scénario livré ; dossier choisi à trois colonnes (biographie/traits/incapacités, compétences, santé/relations), portrait et synthèse d'équipe en bas. | Même roster, même ordre et mêmes originaux. Inspection, renommage, renouvellement, promotion et flèches de réordonnancement utilisent leurs vrais handlers. L'affichage des vêtements reste visuel. |
| Charger | Liste compacte de métadonnées, recherche, choix explicite et dossier de la copie ; action Charger distincte de l'inspection. | Validation du vrai chargeur, refus des copies disparues/désactivées, imports et export existants. Aucun slot ou format de sauvegarde nouveau. |
| Catalogue de tests | Recherche, liste compacte, inspection et description/provenance à côté ; Charger et Télécharger conservent chacun leur action identifiable. | Rechercher ou inspecter n'ouvre aucune colonie. Le téléchargement garde le fichier original validé ; le chargement reçoit la fiche exacte et conserve son attente/refus. |
| Options | Catégories verticales et corps propre à la catégorie ; Retour stable. | Seuls les réglages existants sont affichés, avec leurs vrais callbacks, états pending et erreurs. Le retour ne reprend pas silencieusement une partie. |
| Confirmations | Message et commandes explicites dans la même charte. | Avertissement d'équipe, annulation, refus et état busy/pending restent du vrai flux ; aucune validation graphique ne remplace l'acceptation du backend. |

Le profil `setup` organise les régions indépendantes (navigation, catalogue, dossier, graphique/globe ou synthèse) et les commandes de bas. Les largeurs souhaitées locales et l'adaptation au viewport sont des choix de présentation, pas des dimensions vanilla promises. Les régions longues doivent rester atteignables sans réduire les commandes ou les textes à une échelle illisible. Les résultats visuels finaux et les dimensions réellement qualifiées sont à renseigner par Root ci-dessous.

## Sources et adaptations déclarées

La primaire exacte est **RimWorld Core1.6.4871rev590**, `Assembly-CSharp.dll` locale, SHA256 **5cf1b5be399d5b1c9c56ca72c9d35b4ecf307feacf5859d04ac5a1aa5926356a**, lue le1novembre2026. Les classes pertinentes sont `RimWorld.Page`, `MainMenuDrawer`, `Page_SelectScenario`, `Page_SelectStoryteller`, `Page_CreateWorldParams`, `Page_SelectStartingSite`, `Page_ConfigureStartingPawns`, `Scenario.GetFirstConfigPage`, `Dialog_FileList`, `Dialog_SaveFileList_Load`, `Dialog_Options` et `Verse.StartingPawnUtility`. Aucun code décompilé ni asset propriétaire n'est copié dans le produit.

Cette primaire établit notamment le standard logique1020×764, les boutons de bas150×38, la séparation catalogue/dossier, le site faisant de la planète la zone principale, le rail de candidats et le bandeau d'équipe, ainsi que les catégories verticales des Options1.6. Ces unités logiques dépendent de l'échelle UI ; elles ne constituent pas une prescription de pixels physiques pour notre rendu3D.

Les références Internet bornées sont [Game Creation, wiki révision177394](https://rimworldwiki.com/index.php?title=Game_Creation&oldid=177394) et le [guide Steam de sono](https://steamcommunity.com/sharedfiles/filedetails/?id=2779784000), publié le18mars2022 et modifié le15septembre2025, dont le titre conserve «Up to date for1.4(2023)». Root a réellement observé [sa capture de sélection des personnages](https://images.steamusercontent.com/ugc/1845920165753917479/7D5853F297852C76EBE22E5092FE890D9E9547A7/) et conservé l'image privée. Elle étaye la structure3+5, dossier et synthèse ; **elle ne certifie pas les pixels de1.6.4871**. La date/version de chaque capture du guide et celles de la révision wiki ne sont pas établies. Les faits exacts de moteur viennent de la DLL, pas de la seule légende d'une image.

Adaptations locales explicites :

- La charte carton3D et les dimensions françaises restent les nôtres ; aucun thème vanilla n'est substitué.
- Le modèle local possède un **seul nom** : les trois champs prénom/surnom/nom de la capture historique ne justifient pas d'inventer trois champs persistés.
- Le roster de huit candidats et la sélection de trois sont ceux du scénario actuellement livré ; ils ne deviennent pas un plafond universel de RimWorld.
- Le dossier utilise les vraies projections locales de santé, relations, compétences et possessions disponibles, sans valeurs décoratives. Le meilleur niveau utilisable de l'équipe est un calcul de présentation depuis les mêmes candidats, pas une nouvelle compétence persistée ni une moyenne renommée.
- Le réordonnancement Native conserve les flèches explicites ; le drag du chemin HTML historique n'est pas revendiqué si le renderer ne le fournit pas.
- Les scénarios, DLC, narrateurs, difficultés ou autres capacités absents restent absents ou indisponibles. Le catalogue de tests et ses téléchargements sont une capacité locale, pas une prétendue copie d'un menu vanilla.

## Propriétaires, commandes et conservation

`createNativeFrontMenu` reste le producteur de toutes les pages ; ses callbacks gardés sont réutilisés. La couture de présentation répartit les lignes et conserve les IDs des commandes. Elle ne crée ni World, ni propriétaire de personne, ni acceptation de commande.

La génération réelle conserve la requête exacte et son annulation/progrès. Le lieu confirmé garde génération, clé, case, taille, saison, joueur et ticket. Démarrer utilise le vrai `startingOriginalRequestFromRoster256` et le vrai `flow.start` ; le menu ne conclut une réussite qu'après le backend prévu. Les états busy/pending, callbacks retenus, invalidations, refus de nom et avertissements d'incapacité ne sont pas remplacés par la navigation.

Charger revalide les métadonnées courantes avant le vrai chargeur. Les recherches et sélections ne changent pas les données sources. Importer conserve le sélecteur de fichier explicite ; Télécharger conserve le chemin de la fiche d'origine. Les préférences conservent leurs callbacks et, quand nécessaire, leur attente d'acquittement. Aucun changement de schéma ou de règle de simulation n'est prévu dans ce lot ; confirmé sur les sources finales.

## Qualification Root acquise

Six sources UI seulement, dont le nouveau module de présentation. Schéma301 et2136sources ; carteSHA256bf454438d77f9747b37cdd81c2e5f41803319038bb894c0b99e0373b67133525. Les sources simulation, Worker, sauvegarde et assets ne changent pas. Pins et reçus privés : C:\Users\ebsaf\.codex\visualizations\2026\10\25\01a17357-d7a6-7ee3-9e93-2d2419b318db\playthrough-325-20261031\bottom-ui-ergonomics-20261101\pregame-ui-20261101.

Vingt-cinq cas distincts acquis :21nouveaux (Options/Load4, Accueil/Story/catalogue4, Monde/Site3, colons3, géométrie4, libellésMonde3) et4anciens Import/Télécharger. Premier run24PASS/1FAIL : le test supposait à tort trouver une équipe incapable parmi ses huit profils fixes. Oracle corrigé sur ce seul cas, aucune source produit changée, même seed et mêmes candidats ; unique reprise1PASS. Le refus/avertissement naturel de manque d'aptitude n'est pas acquis dans ce protocole, pas fabriqué. Première source et échec conservés.

strict-types : PASS en74.878s. pages-code : PASS en5.417s. 

Un W/C/W de20productions du vrai dossier et du layout propre à chaque bras : moyennes1.159235/1.193560/1.091035ms ; maxima1.576100/1.782500/2.036500ms. Le candidat est plus lent en moyenne que les deux témoins : coût local accepté de la nouvelle organisation, aucun gain ni coût nul annoncé. Ordre des huit profils, portrait et géographie exacts, aucun Start/Engine/Worker/step/save. CPU/adverses et limites conservés dans cost-private/result.json.

NativeStage/WebGPU observé par gestes CUA ordinaires : dix pages,1280×720 et640×720. À1280, huit candidats, douze compétences et douze synthèses visibles. À640, défilements indépendants et dernières entrées accessibles, Retour/Démarrer fixes, portrait correctement rogné. Inspection, permutation, renommage et un reroll réellement exercés ; un Start enregistré puis volontairement refusé sans ACK. Options Audio+callback mémoire, recherche/aperçu de douze métadonnées de sauvegarde et copie indisponible contrôlés. Le catalogue Native est vide ; ses entrées non vides, recherche et téléchargements sont qualifiés par contrats, pas par cette capture. Viewport rétabli, onglet11 et serveur5205 privés fermés.

Ce composant utilise un aperçu déclaré de92cellules et un ticket UI opaque : aucune génération normale, campagne, vraie sauvegarde/recharge ou acceptation Engine n’est revendiquée. Aucun audit global lecteur d’écran/accessibilité, FPS, fluidité générale ou performance sur PC modeste. La vraie325 reste intacte et en pause.

Commit/push/publication : état réel dans le checkpoint UI et delivery/completion.json ; un commit n’est pas un déploiement.
