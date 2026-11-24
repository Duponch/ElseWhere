# Accueil et création de partie — parcours V333 et repères historiques

V333 propose le parcours **Scénario → Narrateur → Monde → Lieu → Personnages**, puis **Démarrer**, avec la charte graphique actuelle d’Elsewhere. Les pages, choix du lieu et trois candidats retenus sont reliés à la création réelle. Il n’y a pas de page de récapitulatif supplémentaire après les personnages. La [recherche d’interface V333](../research/new-game-interface-v333.md) distingue les observations de RimWorld 1.6, les classes Core et les adaptations du projet ; cette correspondance de structure ne certifie pas une parité exhaustive des menus, du générateur ou des règles.

**État plus récent (24 novembre, schéma 377) :** le tutoriel est jouable, le globe et les paramètres du monde ont évolué depuis V333, et l'ensemble de ce parcours natif a reçu les géométries du jeu de base. Lire [le lot 12](fenetres-rimworld-accueil-creation.md) pour la présentation actuelle ; les tableaux ci-dessous restent des repères historiques de V333.

**Repères historiques conservés.** V98 a étendu **Charger** avec une [bibliothèque de six colonies de test](test-colonies.md), téléchargement et import JSON, sans modifier alors les menus de création. La conservation actuelle des campagnes est décrite dans [sauvegardes et reprise V332](../gameplay/save-library-v332.md). V91 avait étendu la configuration locale aux trois biomes terrestres encore proposés : Forêt tempérée, Forêt boréale et Broussailles arides. Le globe et les candidats personnalisables étaient alors absents ; cette limite historique est remplacée par le parcours V333. Les profils climatiques des anciennes campagnes restent conservés.

**V88 validée dans son périmètre historique.** Crashlanded révision 3 avait ajouté argent, fusil à verrou et couteau en plastacier. Les [preuves V88](../history/validation-trade-v88.md), [V83](../history/validation-site-v83.md) et [V82](../history/validation-new-game-v82.md) ne valent pas validation rétroactive de V333. Les anciennes sauvegardes gardent leur provenance et leurs possessions. Le scénario et Cassandra restent explicitement partiels. [ROADMAP](../ROADMAP.md) conserve seule le calendrier ; le [contrat du départ](scenario-start.md) et l'[inventaire fonctionnel](../gameplay/implementation-status.md) distinguent contenu présent et absent.

## Périmètre actuel

| Partie | Comportement et limite |
|---|---|
| Accueil | Nouvelle partie, Charger une partie et Options actifs ; Tutoriel, Mods et Crédits grisés. Reprendre la colonie apparaît quand une colonie existe. Aucune colonie générée au démarrage froid. |
| Scénario | Choisir un scénario : Atterrissage forcé seul choix actif, fiche « Adaptation partielle » et fournitures réellement présentes. Autres scénarios, Personnalisé et Steam Workshop indisponibles. |
| Narrateur | Choisir votre narrateur : Cassandra Classique présélectionnée, introduction partielle ; Récit d’aventure et Rechargeable à tout moment demandent un choix explicite. Autres possibilités grisées. |
| Monde | Créer un monde : graine textuelle éditable, Aléatoire, Générer et Réinitialiser tout actifs. Globe original de 162 cases ; couverture 100 %, climat global, population et catalogue de factions fixes. Modifier… présente les paramètres avancés effectivement limités à 250 × 250 et Saison de départ Automatique. |
| Lieu | Choisir un lieu de départ : globe manipulable et case sélectionnable, fiche issue de la tuile, Aléatoire parmi les lieux admissibles. Trois biomes terrestres, reliefs non montagneux et accès terrestre au comptoir civil ; océans, comptoir et lieux sans accès refusés. Suivant ouvre une confirmation avant les personnages. |
| Personnages | Créer les personnages : huit candidats ordonnés, trois Sélectionnés puis cinq Laissés sur place ; clic pour consulter, glisser pour réordonner et Aléatoire pour renouveler le candidat consulté. Douze compétences individuelles et huit compétences d’équipe issues des profils réels. Démarrer crée les trois premières personnes. |
| Création/chargement | Opération exclusive, publication après acceptation worker, colonie ouverte en pause ; sauvegarde manuelle et colonie précédente restent deux emplacements distincts. Une erreur de format ne remplace pas la colonie active. |
| Profil appliqué | Le départ préparé V333 reçoit `crashlanded` révision 9, `gameProfile` révision 1, le site, la planète et le climat local de la tuile choisie. Les parties antérieures conservent cartes, possessions, profils climatiques et provenances. Les règles de scénario et de difficulté restent partielles. |
| Alertes de calendrier | Les boutons d’activation accueil/raids/canicules historiques restent cachés avec `gameProfile`, comme les refus du moteur. Ils restent proposés sur une ancienne partie non profilée dépourvue du calendrier concerné. |
| Repère historique temps/événements | V88 documentait 6 ticks/s, un jour de 16 min 40 s, le départ à 06 h civiles, l’introduction hostile à J5,4 et les visites/passants conditionnels. Les anciennes preuves restent propres à ce lot ; elles ne prouvent pas une reproduction complète des incidents Core par le parcours V333. |

Les sections suivantes décrivent la navigation, les erreurs et les limites du parcours livré, puis conservent les repères historiques utiles. Le parcours natif V333 acquis par ROOT en 41,654 s couvre la création et la reprise de la colonie choisie ; les huit candidats et les compétences d’équipe sont visibles à 1440, avec repli à 960. Ce résultat ne certifie ni tous les gestes tactiles, ni tous les états de tous les écrans, ni la parité globale avec Core.

## Référence et choix retenus

Dix-sept captures utilisateur ont été effectivement examinées : les huit premières montrent accueil de RimWorld **1.6.4871**, choix du scénario, choix du narrateur, puis cinq infobulles de difficulté. Elles montrent le menu vertical à droite ; une liste de scénarios à gauche et leur description à droite ; les narrateurs à gauche, difficultés et mode de sauvegarde au centre, illustration à droite ; Retour et Suivant en bas. Les boutons radio de difficulté et de mode sont vides. Quatre captures supplémentaires montrent paramètres du monde, sélection du site, préparation des personnes et message d’arrivée. Enfin, cinq captures accompagnent le nouveau témoin sauvegardé : monde, site boréal/grandes collines, candidats, arrivée et vue dézoomée. Une capture établit une présentation, pas l’application des règles après lancement.

Lecture locale complémentaire de `Assembly-CSharp.dll`, version **1.6.4871 rev590**, sans modification du jeu :

| Classe/méthode | Fait vérifié utile au contrat |
|---|---|
| `MainMenuDrawer.DoMainMenuControls` | Nouvelle colonie ouvre le choix de scénario ; chargement et options ouvrent leurs dialogues. Le menu de partie distingue sauvegarde, chargement et retour à l'accueil. |
| `Page_SelectScenario.EnsureValidSelection` | Première entrée du catalogue retenue initialement ; sélection et description sont distinctes. |
| `Scenario.GetFirstConfigPage`, `PageUtility.StitchedPages` | Parcours Core : narrateur → paramètres du monde → site → personnes ; liens Retour/Suivant entre pages. |
| `Page_SelectStoryteller.PreOpen/CanDoNext` | Premier narrateur visible selon `listOrder`, ici Cassandra ; choix explicite de difficulté et de mode requis hors outils de développement. |
| `Page_CreateWorldParams.Reset/CanDoNext` | Graine de monde aléatoire, paramètres propres au monde ; génération lancée explicitement. Les valeurs Core sont détaillées dans la recherche. |
| `Page_SelectStartingSite.CanDoNext` | Site valide nécessaire ; choix aléatoire et validation de l'admissibilité distincts. |
| `Page_ConfigureStartingPawns` | Consultation/sélection des personnes, relance d'un candidat et contrôles avant départ. |
| `Dialog_SaveFileList_Load` | Liste destinée au chargement, avec vérification de version avant remplacement. |

Provenance de l'assembly, constat des valeurs et écarts : [base Core vérifiée](../research/core-reference-baseline.md). Les captures supplémentaires confirment les pages monde/site/personnes et l’arrivée : paramètres à gauche et factions à droite, globe avec fiche de site, trois personnes sélectionnées et cinq laissées en arrière, fiche individuelle et compétences d’équipe. La page de chargement reste établie par les classes et le contrat du projet, sans capture utilisateur de cette page. Dans le premier groupe de quatre vues, le site affiché est plat et tempéré, tandis que l’arrivée paraît aride : ces vues ne prouvent pas un même site. Le dernier groupe correspond au témoin `Reference-Core-4871`, vérifié en forêt boréale/grandes collines ; [observation séparée](../research/colony-observation-reference.md#nouveau-départ-contrôlé-par-sa-sauvegarde).

Choix explicites de l'utilisateur : **Atterrissage forcé seul scénario actif**, **Récit d’aventure seule difficulté active**, Nouvelle partie et Charger. Options ouvre aujourd’hui les préférences existantes. Cassandra Classique reprend la présélection originale. Le **mode Rechargeable à tout moment** seul disponible reste notre limitation de périmètre, cohérente avec les sauvegardes prises en charge ; ce dernier choix n'avait pas été demandé explicitement par l'utilisateur. Récit d’aventure est une décision de périmètre, pas « la difficulté par défaut de RimWorld ». Les autres choix restent visibles et grisés.

## Accueil

Le démarrage normal ouvre l'accueil d’Elsewhere. Une ancienne sauvegarde n'est ni chargée automatiquement ni remplacée par une colonie nouvelle. Aucune simulation de colonie ne progresse derrière cet écran.

| Entrée | Action et état cible |
|---|---|
| Nouvelle partie | Active ; ouvre le choix de scénario, sans créer le monde jouable immédiatement. |
| Charger une partie | Active ; ouvre les sauvegardes réellement disponibles. Si aucune n'existe, état vide explicite avec Retour, sans faux fichier sélectionnable. |
| Options | Active ; ouvre les réglages locaux existants, dont sauvegarde automatique, présentation, rendu et audio. |
| Tutoriel, Mods, Crédits et autres entrées non réalisées | Visibles et grisées ; aucune action cachée. Ne pas prétendre que le camp historique est le tutoriel Core. |
| Retour au bureau, si repris dans la composition | Indisponible dans le navigateur tant qu'aucune action pertinente n'existe ; ne pas tenter de fermer arbitrairement un onglet. |

Conserver l'organisation générale de référence avec notre titre, notre fond et nos visuels. Aucun faux lien vers un Workshop, achat d'extension ou compte Steam. Les éléments de communication propres à RimWorld ne deviennent pas des fonctions fictives de Lisière.

Le menu reste utilisable si WebGPU est indisponible : expliquer la limite au lancement d'une colonie, permettre de consulter les possibilités de récupération réellement fournies. Ne pas installer un moteur de rendu complet par page de menu. Le compteur FPS reste lié à un rendu réel ; aucune valeur copiée d'une capture ou d'une ancienne partie.

## Nouvelle partie

### 1. Scénario

**Choisir un scénario** : liste à gauche, description et contenu à droite ; Retour vers l'accueil et Suivant vers le narrateur. Atterrissage forcé est sélectionné initialement. Tribu perdue, Le riche explorateur, Brutalité nue, Personnalisé et Steam Workshop sont visibles et indisponibles. Aucun éditeur ni contenu d’extension n’est ajouté au parcours.

La fiche décrit **ce que le lancement produit réellement** : personnes, matériel, connaissances, lieu et limites. La cible Core complète est conservée dans la recherche ; elle ne doit pas être affichée comme une liste de fournitures promises si certains objets n'existent pas.

La fiche actuelle annonce trois personnes choisies parmi huit, 300 bois, 450 acier, 30 composants, 800 argent, 50 Rations de survie, 30 Médicaments, un Fusil à verrou, un Revolver, un Couteau en plastacier, un Gilet pare-balles et une chemise en tissu par personne. Taille de pierre, Mobilier complexe, Vêtements complexes et Climatisation sont déjà connus. Le [contrat de départ](scenario-start.md) conserve les quantités, propriétés et révisions historiques. Casque, pantalon de protection, animal domestique, arrivée en capsules et provisions dispersées restent absents ; la fiche porte **Adaptation partielle**. Le chargement d'une révision précédente n'applique jamais cette dotation.

**Transition depuis V80 :** le libellé demandé n'autorise pas à transformer silencieusement `survivors` en Crashlanded complet. Si le nouveau menu précède l'achèvement de sa dotation, la fiche porte clairement « adaptation partielle » et indique les différences utiles au choix du joueur. La provenance des anciennes parties reste Trois survivants, avec sa révision et ses stocks inchangés. Un changement réel du profil initial exige un contrat de scénario et une révision explicite, pas seulement un nouveau texte.

### 2. Narrateur, difficulté et sauvegarde

**Choisir votre narrateur** conserve trois zones : narrateurs à gauche, Niveau d’aventure et Mode de sauvegarde au centre, illustration et description du narrateur à droite. Retour et Suivant restent en bas.

- **Cassandra Classique** présélectionnée, décrite comme une Introduction partielle. Phoebe Amicale et Randy Aléatoire sont grisés.
- Liste de difficultés dans l'ordre observé : Pacifique, Bâtisseur de communauté, Récit d'aventure, Lutte pour la survie, De sang et de poussière, Perdre est amusant, Personnalisation en détail. Seul Récit d'aventure est sélectionnable.
- Mode Rechargeable à tout moment sélectionnable ; mode Engagement grisé.
- Difficulté et mode commencent sans sélection, comme la création normale observée ; le joueur confirme les deux choix. Suivant explique précisément le choix manquant au lieu d'ignorer le clic.
- Les textes d’aide associés aux choix actifs expliquent leur portée ; ils ne certifient pas des systèmes encore absents.

Récit d’aventure applique le profil des mécaniques présentes ; la suite de Cassandra et la variété des événements restent incomplètes. **Repère historique V88 :** le profil s’était distingué des calendriers provisoires V81 avec l’introduction hostile à J5,4, les fenêtres majeures à partir de J11 et les [agendas de visites et de passants](visitors.md), dont une occasion introductive à J2,5. Ces preuves historiques ne certifient pas le narrateur Core entier ; accès et tirages ne promettent pas un marchand garanti. Les groupes historiques restent propres à leurs anciennes parties/scénarios de diagnostic.

Retour conserve les choix de cette création. Il ne remet pas secrètement les personnes ou l'aléatoire à zéro.

### 3. Monde

**Créer un monde** présente les paramètres à gauche et les Factions à droite. Graine accepte une saisie textuelle de 1 à 64 caractères sans caractère de contrôle ; Aléatoire propose une nouvelle graine. **Générer** construit le globe prospectif et ouvre le choix du lieu ; aucune carte de colonie n’est encore créée. La graine du monde, la graine locale dérivée du lieu et celle des candidats sont distinctes.

Couverture de la planète reste grisée à **100 %** ; Précipitations, Température et Population sont grisées à **Normales**. Le globe original de 162 cases ne reproduit pas le générateur Core ni son réglage de couverture 30 %. Factions présente un **Comptoir civil** réellement généré, avec son nombre 1 ; le catalogue et les réglages de factions restent absents. Réinitialiser les factions est grisé. **Réinitialiser tout** renouvelle le monde et efface le lieu choisi, tout en conservant les candidats déjà préparés.

**Modifier…** ouvre Paramètres avancés : Taille de la carte, Nombre de cases et Saison de départ. Seule **250 × 250** est disponible ; 200, 225, 275, 300 et 325 restent grisés. La saison est **Automatique**, sans réglage actif. Fermer ou Échap ferme ce dialogue et revient au déclencheur. Retour ramène au narrateur.

### 4. Lieu

**Choisir un lieu de départ** montre la fiche à gauche et le globe à droite. Glisser ou les flèches tournent le globe, la molette rapproche la vue et cliquer une case actualise la sélection. **Aléatoire** choisit uniquement parmi les lieux admissibles. Un lieu admissible est proposé après génération.

La fiche affiche Case, Coordonnées, Relief, Température moyenne, Plage saisonnière, Précipitations et, pour un terrain local pris en charge, Roches locales, Rivière, Taille et Saison de départ. Ces valeurs proviennent de la tuile et du même calcul que le départ réel. Rivière reste **Aucune** ; Taille reste **250 × 250**. La saison automatique dépend de la latitude et de la température du lieu.

Forêt tempérée, Forêt boréale et Broussailles arides sont disponibles avec Plat, Petites collines et Grandes collines selon la tuile. Océan, Montagnes, case du comptoir et terrains sans trajet terrestre vers le comptoir sont refusés avec une raison visible. Ce dernier filtre est une limite des caravanes actuelles d’Elsewhere. **Suivant** valide le lieu puis demande « Commencer la colonie sur ce lieu de départ ? » : Annuler reste sur le lieu, Confirmer ouvre les personnages. Retour ramène au monde.

### 5. Personnages

**Créer les personnages** dispose à gauche huit cartes ordonnées sous **Sélectionnés** (trois) puis **Laissés sur place** (cinq). Cliquer une carte consulte son dossier ; le clic ne change pas l’équipe. Glisser une carte réordonne la liste : les trois premières partent. Le clavier propose **Alt + ↑ / ↓** ; une poignée dédiée propose le déplacement tactile. Ces alternatives restent distinctes du glisser HTML natif à la souris.

Le haut du dossier contient Nom, sexe, âge biologique et chronologique, affiliation, portrait central et **Aléatoire** à droite. Le nom est un champ unique éditable de 1 à 80 caractères sans caractère de contrôle : le modèle actuel ne fournit pas les trois champs de nom Core. Une saisie invalide, même dans la réserve, bloque Démarrer et ramène au champ concerné. Un nom valide est conservé dans le brouillon ; une saisie invalide non appliquée est abandonnée au retour vers une autre page.

Trois colonnes montrent **Histoire**, **Traits**, **Incapable de** ; les douze **Compétences** ; **Santé** et **Relations**. Les infobulles des biographies, traits, incapacités et compétences décrivent les données réelles et sont accessibles au survol et au focus. Le générateur des candidats reste original et limité aux biographies, traits, compétences et affections implémentés. Il ne reproduit pas toutes les distributions Core. Les relations portent uniquement sur les trois personnes choisies ; la réserve indique Aucun lien connu. Il n’y a pas d’éditeur de relations ni de personnes hors carte simulées par la fiche.

**Aléatoire** renouvelle seulement le candidat consulté, retire son nom personnalisé et conserve les autres candidats et leur ordre. Les tentatives de génération et de relance pour couvrir les travaux sont bornées ; cette couverture peut donc rester incomplète. **Afficher les vêtements** masque ou affiche la chemise en tissu réellement fournie dans les portraits, sans modifier l’équipement. Aucun contrôle de casque fictif n’est proposé.

Sous le dossier, **Compétences de l’équipe** présente Tir, Mêlée, Construction, Minage, Cuisine, Plantes, Médecine et Intellect en quatre colonnes de deux lignes. Chaque valeur est le meilleur niveau utilisable parmi les trois sélectionnés ; à niveau égal, la passion départage. L’infobulle identifie les titulaires et leurs capacités ; si toute l’équipe est incapable, la valeur est un tiret. Ce résumé n’est ni une somme ni le maximum brut d’une personne incapable.

Retour ramène au lieu. **Démarrer** lance directement la création, sans écran de récapitulatif supplémentaire. Si aucun sélectionné ne peut assurer un des neuf travaux requis pris en charge, une confirmation conditionnelle liste les manques et propose Annuler ou Confirmer ; elle n’impose pas un seuil de compétence. Le moteur reconstruit le lieu et les profils choisis, puis ouvre la colonie en pause après acceptation de l’opération.

### Configuration locale V83 — historique remplacé par les pages Monde et Lieu

Les paragraphes suivants décrivent la livraison V83 et ses preuves, pas un second parcours encore proposé par V333.

La page **Préparer le départ** garde deux colonnes : graine et choix du relief à gauche, renseignements du site et récapitulatif de la colonie à droite. Les trois reliefs sont des boutons radio réellement reliés à la génération. **Petites collines** est la proposition initiale de Lisière, annoncée comme telle, et non un site prétendument imposé par RimWorld. Le jeu original fait choisir une tuile de monde valide, avec un choix aléatoire distinct ; notre carte locale ne simule pas ce globe.

Le milieu reste **Forêt tempérée**, la carte **250×250** et l'hydrographie **Sans rivière**. Ce sont les limites visibles du départ pris en charge, pas des valeurs universelles de RimWorld. Il n'existe pas de contrôle actif pour changer de biome, inventer une rivière ou modifier une densité sans contrat de génération. Les massifs, filons et sols sont produits par le profil réellement sélectionné ; aucun quota de ressources n'est promis dans la fiche.

Les deux ou trois **roches locales** sont calculées par le même `resolveSite(seed, options)` que l'usine de monde. Changer la graine actualise leur liste immédiatement, tout en conservant le relief choisi. Une graine invalide remplace ce renseignement par une invitation à corriger la saisie ; elle ne laisse pas croire que l'ancienne liste correspond à la valeur invalide. Retour conserve graine, relief, difficulté et mode. Recommencer explicitement une nouvelle création réinitialise ces choix et propose une nouvelle graine.

Le lancement transmet `{seed, size, site: {hilliness}}` ; la simulation résout et persiste la provenance du site. Ce contexte reste une propriété de la colonie créée : charger une carte V82 ne lui applique ni le relief du formulaire, ni les nouveaux sols, ni une nouvelle géologie. La validation native V83 reprend un véritable checkpoint V82 compressé, en plus du camp V81 déjà utilisé, pour contrôler cette frontière sans fabriquer une ancienne version par simple changement de numéro.

Référence : [enquête sur la génération](../research/map-calibration-reference.md), corpus HTML chapitres 5–7 et entrées `SYS-016` à `SYS-019`, `TEST-016` à `TEST-019`, `UI-005` via [reference-adoption](../research/reference-adoption.md). La cohérence monde/site et l'information utile au choix sont adoptées ; globe, rivières, grottes et ruines complètes restent différés selon ROADMAP. Les sources historiques de génération sont distinguées des classes locales 1.6.4871 et des observations individuelles.

## Retour, annulation et opérations asynchrones

Le parcours de création possède un **brouillon distinct de la partie active et des sauvegardes**. Retour préserve les valeurs de ce brouillon. Revenir à l'accueil puis abandonner la création ne modifie aucune colonie. Une nouvelle création recommencée explicitement reçoit un nouveau brouillon ; conserver un brouillon volontairement doit être visible, pas implicite.

Retour conserve les choix valides de monde, de lieu, de narrateur, de difficulté, de sauvegarde et de candidats. Générer de nouveau avec la même graine conserve le lieu admissible ; générer une autre graine renouvelle le globe et sa proposition de lieu. La graine des candidats reste indépendante : régénérer le monde ou revenir entre les pages ne relance pas les personnes. Nouvelle partie recommencée explicitement crée un nouveau brouillon, avec de nouveaux candidats. Dans l’ancien parcours local V83, changer la graine recalculait les roches sans remettre le relief à zéro.

La création de la carte ou le chargement expose un état occupé, désactive les commandes, rend le contenu inerte et empêche le double lancement. Retour et Échap ne changent pas de page pendant cette opération. Une erreur rend les choix éditables et conserve la partie précédente. Quitter une page ou masquer le menu ferme ses dialogues, libère ses interactions et annule le geste de réordonnancement en cours ; le glisser HTML natif et l’annulation d’une capture tactile ont des cycles distincts.

Depuis une partie en cours, ouvrir le menu suspend effectivement la simulation par une commande acquittée. Annuler/retourner à la colonie reprend son état et sa vitesse antérieure. Passer à une nouvelle partie ne détruit pas les progrès courants avant le succès de la transaction et leur préservation. Le menu conserve l'accès à sauvegarder puis quitter, et distingue clairement le retour sans sauvegarde si cette option existe.

Une erreur de préparation graphique après création ou chargement reste différente d'une sauvegarde invalide : la partie valide et sa copie de récupération restent conservées. L'interface expose une reprise/récupération possible sans redonner le matériel de départ ni relancer le scénario.

## Charger et préserver les sauvegardes

Le chargement s'effectue aussi depuis l'accueil, **sans générer d'abord un monde factice pour satisfaire le worker**. Le contrat actuel des douze copies nommées, trois copies automatiques et opérations d’import/export se trouve dans [sauvegardes et reprise V332](../gameplay/save-library-v332.md). La liste montre uniquement les données présentes, avec les métadonnées disponibles : provenance, version, jour et emplacement. Une donnée ancienne sans métadonnée ne reçoit pas une identité inventée. Un emplacement de récupération reste distingué d'une sauvegarde choisie par le joueur.

Repère historique de compatibilité : les emplacements `lisiere.save.v1` et `lisiere.previous.v1` ont précédé la bibliothèque V332. Les menus de nouvelle partie ne suppriment pas ces campagnes ; leur conservation et leur migration suivent le contrat de la bibliothèque.

Choisir une entrée ne la charge pas encore. Charger valide et migre strictement les données avant leur publication ; annuler ne remplace rien. Le monde, ses identités, ses ressources, ses recherches, ses calendriers et ses aléas proviennent de la sauvegarde. La configuration du formulaire de nouvelle partie n'est jamais appliquée rétroactivement.

En cas de format corrompu, version future inconnue, stockage refusé ou quota dépassé : message intelligible, sauvegarde originale conservée, partie active conservée, possibilité de revenir ou choisir une autre entrée. Ne pas afficher une réussite avant la fin réelle de l'écriture. Les clics concurrents sauvegarder/charger/créer sont sérialisés ; un retour tardif ne doit pas écraser le monde choisi ensuite.

Au chargement réussi, afficher la colonie en pause afin que le joueur puisse s'orienter avant reprise ; adaptation navigateur explicite. Sauvegardes et sauvegarde de récupération restent indépendantes. Import/export et gestion des copies suivent les opérations réellement livrées par V332 ; la liste ne promet ni cloud ni synchronisation multi-appareils.

## Accessibilité et présentation

- Ordre de tabulation conforme à l'ordre visuel, focus visible, noms accessibles des boutons et groupes radio, état sélectionné lisible sans dépendre de la seule couleur.
- Éléments indisponibles effectivement non activables au clic comme au clavier, avec motif visible ou description accessible ; un survol ne les sélectionne pas.
- Échap ferme d'abord la sous-fenêtre active, annule un geste de réordonnancement capturé ou revient d'une étape ; il ne traverse pas une opération occupée et n'efface pas le brouillon par une succession de gestionnaires concurrents.
- Retour du focus au bouton déclencheur après fermeture ; aucune commande de carte ne traverse une fenêtre de menu.
- Mise en page adaptée aux petites fenêtres et au zoom ; Retour, Suivant, Générer et Démarrer demeurent atteignables. Les huit candidats et compétences d’équipe sont visibles dans la présentation 1440 acquise ; le repli 960 conserve un défilement global quand nécessaire. Une grande illustration ne masque ni la description ni les choix. Les noms abrégés sur une carte conservent leur libellé accessible complet.
- Texte de sauvegarde et noms issus des données affichés comme texte. Messages de chargement/échec annoncés sans avalanche de notifications par image.

## Critères d'acceptation de la tranche en cours

1. Démarrage froid : accueil utilisable, sans colonie qui avance ou remplace une sauvegarde ; Nouvelle partie et Charger ont de vraies destinations ; états vides et options grisées sont cohérents.
2. Parcours réel : Scénario → Narrateur → Monde → Lieu → Personnages → Démarrer ; choix obligatoires, validation de la graine et du lieu, confirmations, consultation distincte de la sélection, noms valides, réordonnancement et relance. Retour conserve les choix valides ; le profil du lieu et les trois personnes affichés correspondent aux données adoptées par la simulation. Aucun écran de récapitulatif général n’est ajouté.
3. Création réussie et opération refusée : ressources exactes du profil, provenance conservée, sauvegarde antérieure récupérable ; état occupé exclusif et page éditable après erreur. Aucun monde créé deux fois.
4. Chargement depuis accueil et depuis une partie : données actuelles et anciennes prises en charge, exactitude de la continuation, refus d'une donnée invalide/future, sauvegarde et récupération toujours distinctes. Pas de seconde dotation.
5. Contrôle natif proportionné de la présentation 1440/960, du glisser à la souris, des états occupés, du focus et des erreurs. L’existence d’un parcours réussi ne vaut pas contrôle exhaustif du clavier, du tactile, de tous les candidats ou de toutes les tailles de fenêtre ; les limites restent explicites.
6. Recherche, contrat de scénario/profil réellement appliqué, guide, inventaire et preuves mis à jour ensemble. Les pages et mécanismes restant partiels sont nommés dans le bilan, sans déclarer le scénario Core ou le narrateur entier terminés.

Ces contrôles se regroupent selon les contrats touchés dans [testing](testing.md). Ce document n'ajoute ni calendrier parallèle, ni promesse de couverture exhaustive, ni statut de livraison à la seule présence d'un écran.
