# Sélection et ordres de tous les jours — schéma 346

Schéma 346. L'audit des bases (annexe 3, contrôles de tous les jours, lot 5) relevait cinq écarts avec RimWorld 1.6 dans la sélection et les ordres courants. Les règles viennent du code du jeu de base (Pawn_DraftController, GizmoGridDrawer, Command_Toggle, BuildCopyCommandUtility, les FloatMenuOptionProvider, ColonistBarColonistDrawer, MoodThresholdExtensions, MentalBreaker, PawnColumnWorker_ManhunterOn…Chance) ; aucun code ni texte n'en est repris.

Seul le changement de ce qu'un colon mobilisé peut recevoir comme ordre est une règle : il ne vaut qu'à partir du schéma 346. Le reste est de la présentation, sans portée sur la partie. Aucun champ n'est ajouté à la sauvegarde ; la migration 345 → 346 ne change que le numéro.

## Mobiliser, Stop et Tir à volonté sur toute la sélection

Avant, ces boutons de l'inspecteur n'agissaient que sur le premier colon sélectionné (la touche R agissait déjà sur tous). Dans le jeu de base, les boutons identiques des colons sélectionnés sont fusionnés en un seul :

- **Mobiliser / Démobiliser** : le bouton fusionné montre un colon non mobilisé s'il y en a un (activateIfAmbiguous) ; un clic mobilise alors tous les colons disponibles de la sélection. Il ne démobilise que si tous sont déjà mobilisés. Un colon à terre garde un bouton grisé et n'est pas concerné ; un colon en crise n'en a pas. La touche R suit la même règle.
- **Tir à volonté** : même fusion. Si un des colons mobilisés retient son tir, le clic rend le tir à volonté à tous ; sinon il le retire à tous.
- **Stop** : arrête le déplacement, l'attaque, le repas ou les soins mobilisés de tous les colons mobilisés de la sélection ; ils restent mobilisés.

Le dossier affiché reste celui du premier colon sélectionné ; les boutons tiennent compte de toute la sélection (un autre colon mobilisé suffit pour faire apparaître Stop et Tir à volonté).

## Copier un bâtiment

L'inspecteur d'un bâtiment propose **Copier** : l'Architecte se place sur la même construction avec le même matériau, prête à être posée. Comme dans le jeu de base :

- le bouton n'existe que si la construction est disponible dans l'Architecte (recherche faite) ;
- le matériau n'est repris que pour une construction qui se choisit dans plusieurs matériaux ; sinon seule la construction est choisie ;
- l'orientation n'est pas reprise : elle reste celle de l'outil de placement.

Copier ne donne aucun ordre ; la pose suit toutes les règles habituelles.

## Ordres d'un colon mobilisé (clic droit)

Dans le jeu de base, la plupart des options du menu contextuel restent offertes à un colon mobilisé (Drafted = vrai), pour un seul colon sélectionné (Multiselect = faux). L'ordre devient sa tâche ordonnée : il remplace le déplacement ou l'attaque en cours, et le colon reste mobilisé puis attend sur place une fois la tâche finie.

À partir du schéma 346, un seul colon mobilisé retrouve :

| Option | Jeu de base | Elsewhere |
|---|---|---|
| Équiper une arme au sol | FloatMenuOptionProvider_Equip | nouveau en 346 |
| Porter un vêtement au sol | FloatMenuOptionProvider_Wear | nouveau en 346 |
| Déposer son arme (clic droit sur lui-même ou sa case) | FloatMenuOptionProvider_DropEquipment | nouveau en 346 |
| Capturer une personne hors colonie à terre | FloatMenuOptionProvider_CapturePawn | nouveau en 346 |
| Manger ou boire une pile | FloatMenuOptionProvider_Ingest | déjà permis depuis le schéma 234 |
| Secourir une personne à terre vers un lit | FloatMenuOptionProvider_RescuePawn | déjà permis depuis le schéma 237 |

- Sur une case qui porte une arme, un vêtement ou un aliment, le menu propose ces options et **Aller ici**. Une case sans rien de tel garde le déplacement immédiat, sans menu.
- Sur une personne hors colonie à terre, **Capturer** s'ajoute aux attaques et aux soins mobilisés déjà offerts.
- La passe de déplacement physique ne traite plus ce colon comme un déplacement mobilisé pendant la tâche (elle effaçait son chemin à chaque pas, comme elle le fait déjà pour le secours et les soins mobilisés).
- Les tâches sont les mêmes que pour un colon démobilisé : trajet réel, réservation de l'objet, échange de l'arme au contact, durée d'habillage, lit de prison libre dans une pièce fermée. Pendant la tâche, le colon mobilisé ne tire pas de lui-même.
- Avec deux colons ou plus sélectionnés, le clic droit garde les seuls ordres tactiques (déplacement en formation, attaques), comme le jeu de base.
- **Avant le schéma 346**, ces ordres restent refusés à un colon mobilisé (« Démobilisez ce colon avant un ordre civil. ») et le clic droit sur une arme ou un vêtement le déplace.

Non repris : ramasser un objet dans l'inventaire et déshabiller (absents d'Elsewhere), arrêter (Elsewhere réserve l'arrestation à un colon démobilisé), porter une personne à terre sans destination, ouvrir une capsule, ranger dans un caisson, éteindre ou réparer depuis le menu mobilisé.

## Barre des colons : risque de crise et icônes d'activité

Chaque portrait de la barre du haut suit maintenant le dessin du jeu de base :

- **Teinte de risque de crise** : quand l'humeur passe sous un seuil personnel de crise, le portrait se teinte (or pour mineure, orange pour majeure, rouge pour extrême), avec un dégradé en bas du portrait et, pour majeure et extrême, un liseré. Les seuils sont ceux du colon : le seuil mineur, ses 4/7 et son 1/7. Pas de teinte pendant une crise, ni pour un colon à terre.
- **Icônes d'activité**, en bas à gauche du portrait, dans l'ordre du jeu de base : prépare une caravane ; puis crise mentale (« ! » rouge si elle est agressive, bleu sinon), ou repos dans un lit médical, ou sinon : dort, fuit, attaque (tir ou mêlée en cours), inoccupé ; puis en feu. Leur nom s'ajoute à l'info-bulle du portrait.
- **Inoccupé** n'apparaît qu'à partir du premier jour entier de la partie, comme dans le jeu de base.

Le jeu de base n'a pas d'icône « à terre » : un colon à terre perd seulement la teinte ; dans un lit médical, il porte l'icône du repos médical.

## Faune : chances de rage — non ajoutées

Le tableau Faune du jeu de base montre la chance qu'un animal devienne fou furieux quand on le blesse (manhunterOnDamageChance, multipliée par la difficulté) et quand son apprivoisement échoue (manhunterOnTameFailChance). Les colonnes tiendraient dans le tableau d'Elsewhere, mais la simulation ne tire aujourd'hui **aucune** de ces deux chances : un animal blessé fuit ou riposte, un apprivoisement raté ne le met pas en rage. Afficher ces chances annoncerait une règle absente ; elles ne sont pas ajoutées. Les données sont présentes (animal-core-data-v256) ; la règle de vengeance des animaux chassés ou mal apprivoisés reste à faire dans un lot à part.

## Adaptations

- **Bouton Tir à volonté** : le jeu de base ne le montre qu'à un colon mobilisé qui tient une arme à distance ; Elsewhere le montrait déjà à tout colon mobilisé et garde ce choix.
- **Stop** n'existe pas dans le jeu de base ; le bouton existant d'Elsewhere agit simplement sur toute la sélection.
- **Barre des colons** : la teinte extrême ne pulse pas (le portrait est une texture redessinée seulement quand l'état change) ; les couleurs sont proches de celles du jeu de base ; les icônes reprennent les pictogrammes existants (« ! » pour les crises). « Prépare une caravane » couvre le colon membre d'un groupe en préparation sur la carte. « Inoccupé » suit l'errance oisive d'Elsewhere (schéma 300 et suivants), équivalent de la tâche marquée Idle du jeu de base. L'inspiration, l'esclave, le rôle d'idéologie et la faction d'origine n'ont pas d'équivalent.
- **Copier** n'a pas de raccourci clavier (Misc11 dans le jeu de base).

## Contrôles

- `tests/everyday-orders-346.test.ts` (10 cas) : fusion des boutons sur la sélection (commandes et inspecteur) ; Copier (même construction et matériau, absent avant la recherche) ; Équiper, Porter, Déposer, Capturer, Manger d'un colon mobilisé depuis le vrai menu contextuel, tâche jouée par `stepWorld` (trajet aussi rapide qu'un colon démobilisé), sauvegarde rechargée et instantané adopté en cours de tâche, colon toujours mobilisé ; refus au schéma 345 ; teinte et icônes sur de vrais états (crise réelle, tir ordonné, capture en lit médical, errance oisive avant et après le premier jour, fuite réelle) ; migration 345 → 346 et refus d'une sauvegarde 345 portant une tâche mobilisée.
- Voisins relancés : mobilisation, sélection, ordres, équipement, secours, capture, prisonniers, consommation, soins mobilisés, barre et inspecteur natifs, faune ; seuls les échecs déjà connus restent.
