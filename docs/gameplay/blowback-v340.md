# Culasse non calée, pistolet automatique et pistolet-mitrailleur — V340

Schéma 340. La recherche du jeu de base BlowbackOperation, ses deux armes (Gun_Autopistol et Gun_MachinePistol) et le tir en rafale des colons.

## Recherche

| Recherche | Coût | Prérequis | Âge technologique |
|---|---|---|---|
| Culasse non calée | 500 points | Armurerie | industriel |
| Tourelles automatiques | 500 points | **Culasse non calée** (dès 340) | industriel |

- Culasse non calée se fait au bureau de recherche simple, sans bureau avancé ni multi-analyseur.
- Dès 340, les Tourelles automatiques demandent Culasse non calée, comme dans le jeu de base. Avant 340, l'adaptation livrée gardait Armurerie comme prérequis.
- Rien n'est retiré ni donné : une partie migrée garde des tourelles déjà recherchées sous l'ancien prérequis. Une recherche de tourelles commencée avant la migration reste choisie et garde ses points. Une nouvelle sélection des tourelles exige Culasse non calée.
- Les deux factures n'apparaissent qu'après la recherche. Une arme achetée ou ramassée s'utilise sans recherche.

## Fabrication

| | Pistolet automatique | Pistolet-mitrailleur |
|---|---|---|
| Coût | 30 acier, 2 composants | 45 acier, 3 composants |
| Artisanat | 4 | 4 |
| Travail (unités du jeu de base) | 5 000 | 11 000 |

- **Poste :** table d'usinage alimentée, par la chaîne des armes à feu existante : arme inachevée commune, auteur et progression conservés, qualité tirée par le fabricant, travail Artisanat.
- **Fonte :** 25 % de l'acier, soit 7–8 acier pour le pistolet automatique et 11–12 pour le pistolet-mitrailleur, aucun composant.

## Caractéristiques (qualité normale)

| Valeur | Pistolet automatique | Pistolet-mitrailleur |
|---|---|---|
| Portée | 25,9 cases | 19,9 cases |
| Visée | 0,3 s (18 ticks du jeu de base) | 0,5 s (30 ticks) |
| Tir | une balle | **rafale de 3 balles, 7 ticks d'écart** |
| Récupération | 1 s (60 ticks) | 0,9 s (54 ticks) |
| Précision (contact / courte / moyenne / longue) | 80 % / 70 % / 40 % / 30 % | 90 % / 65 % / 35 % / 15 % |
| Balle | 10 dégâts, pénétration 15 %, vitesse 55, pouvoir d'arrêt 0,5 | 6 dégâts, pénétration 9 %, vitesse 55, pouvoir d'arrêt 0,5 |
| Corps à corps | Crosse (contondant 9) et canon (contondant ou estoc 9), 2 s | idem |
| Points de vie, masse, valeur | 100, 1,2 kg, 139 | 100, 2,5 kg, 221,1 |

La qualité modifie les dégâts et la précision comme pour les autres armes à distance. La pénétration et le pouvoir d'arrêt sont les valeurs par défaut des balles du jeu de base (dégâts × 0,015 ; 0,5).

## Tir en rafale

Règle générique : chaque profil d'arme peut porter un nombre de tirs et un écart, repris du jeu de base (burstShotCount, ticksBetweenBurstShots). Le pistolet-mitrailleur est la première arme de colon qui s'en sert.

- **Une seule visée**, puis la première balle à la fin de la visée.
- **Écart :** la deuxième balle part 6 ticks après la première, la troisième 7 ticks après la deuxième. Chez un colon du jeu de base, la fin de visée a lieu avant le décompte de l'arme dans le même tick, ce qui raccourcit le premier écart d'un tick (Pawn.Tick puis Verb.VerbTick).
- **Entre deux balles**, le colon est occupé : il ne bouge pas et ne prend pas d'autre ordre, comme pendant une récupération.
- **Chaque balle** refait son propre calcul de visée et de couvert, comme chaque tir du jeu de base.
- **Après la dernière balle**, la récupération de l'arme (54 ticks) commence.
- **Une seule expérience de tir par rafale**, à la première balle, calculée sur tout le cycle (visée + récupération + 2 × 7 ticks).
- **Une riposte** (ordre automatique à deux attaques) compte une rafale pour une attaque.

Ce qui arrête une rafale, d'après Verb.TryCastNextBurstShot et Verb_LaunchProjectile :

| Cause | Effet |
|---|---|
| Cible morte, emportée ou hors de la carte | plus de balle ; la récupération commence à ce tick |
| Cible hors de portée ou sans ligne de tir | idem |
| Tireur étourdi | rafale annulée ; seule l'attente entre deux balles s'écoule, mise en pause pendant l'étourdissement |
| Arme perdue | rafale annulée ; seule l'attente entre deux balles s'écoule |
| Cible à terre, ordre annulé ou colon démobilisé | **la rafale continue** sur sa propre cible |

## Pillards et visiteurs

Dès 340, les sortes de personnages du jeu de base dont l'étiquette d'arme est exactement « Gun » tirent leur arme comme PawnWeaponGenerator : une somme tirée au hasard dans leur fourchette, puis toutes les armes à feu dont le prix ne la dépasse pas, pondérées par prix × fréquence.

| Sorte du jeu de base | Somme | Arme possible |
|---|---|---|
| Récupérateur (pirates) | 200–300 | revolver, pistolet automatique, pistolet-mitrailleur, fusil à verrou, fusil à pompe |
| Pirate | 250–345 | les mêmes, et le lance-grenades incendiaires (non livré) |
| Garde (étrangers) | 250–400 | les mêmes, et des armes non livrées |
| Conseiller municipal, marchand | 200 | revolver ou pistolet automatique (environ une chance sur deux) |
| Mercenaire | 330–650 | les mêmes, le lanceur IEM et des armes non livrées |

- Les gardes, mercenaires et marchands des caravanes suivent la même règle que les pillards de même sorte.
- Le tirage vient de la graine de la partie et de l'identité du personnage : il ne fait avancer aucun flux aléatoire partagé. Un pillard arrivé en capsule reçoit la même arme qu'à pied.

## Commerce

Les visiteurs et les caravanes marchandes peuvent vendre un pistolet automatique ou un pistolet-mitrailleur. Le jeu de base les a toujours comptés parmi leurs armes à distance possibles (entrées 1 et 2 de la liste). Les tirages aléatoires sont inchangés : un marchand qui vendait déjà quelque chose le vend toujours.

## Adaptations

- **Arme des pillards :** si le tirage du jeu de base désigne une arme qu'Elsewhere n'a pas (lance-grenades, mitrailleuses, fusils d'assaut et de précision…), la sorte garde son arme fixe historique (revolver, fusil à verrou ou fusil à pompe). Les chances des armes livrées sont celles du jeu de base.
- **Tirage par identité :** le jeu de base tire l'arme dans son flux aléatoire commun ; ici, deux tirages propres à chaque personnage.
- **Villageois :** non concerné. Ses armes de mêlée de base (couteaux de toutes matières) ne sont pas représentées ; il garde son revolver.
- **Rencontres des cartes temporaires :** leurs pillards gardent leur arme fixe.
- **Menace de mêlée :** chez les pillards du jeu de base, une rafale s'arrête si un adversaire au contact les menace en mêlée ; ce cas n'est pas modélisé.
- **Origine des balles suivantes :** chaque balle part de la nouvelle ligne de tir, penchée comprise ; la première garde le penché de la visée.

## Rendu

- Modèles originaux : le pistolet automatique a une culasse carrée sur sa carcasse et une crosse inclinée ; le pistolet-mitrailleur une carcasse plus longue, un manchon de canon et un long chargeur devant la poignée.
- Les deux se portent à la ceinture et se tiennent comme le revolver.
- Pictogrammes propres aux deux armes, produits par `scripts/rebuild-pictograms.mts` ; la recherche reprend celui du pistolet-mitrailleur.
- Le son de tir suit chaque début de récupération observé ; une rafale arrêtée faute de cible n'en joue aucun.

## Limites

- **Fusil-mitrailleur, mitraillette lourde, fusil d'assaut :** pas encore faits (recherche GasOperation non livrée).
- **Planification du rendu des acteurs cuits :** comme pour les arcs et le fusil à pompe, la table de l'atlas des acteurs ne connaît pas encore ces armes ; le rendu ordinaire les affiche.

## Sauvegardes

Une sauvegarde 339 passe à 340 en changeant seulement son numéro. Avant 340, les éléments suivants sont refusés :
- les deux armes et leurs recettes, factures et ouvrages ;
- leurs balles en vol et les visées ou récupérations à ces armes ;
- la rafale en cours ;
- la recherche Culasse non calée, en cours, choisie ou terminée.

Dès 340 :
- une facture, un ouvrage ou une tâche d'une de ces armes exige la recherche terminée ;
- Culasse non calée exige Armurerie, terminée avant elle ;
- la rafale en cours est enregistrée strictement : sa cible, le nombre de balles restantes (au plus deux) et une attente qui dure 8 ticks. Une rafale active n'a jamais été étourdie et sa prochaine balle est encore à venir. La reprise d'une sauvegarde au milieu d'une rafale tire les balles restantes aux mêmes ticks.

## Vérifications

`tests/blowback-340.test.ts` couvre :
- recettes, valeurs, masses, profils de tir par qualité, outils de corps à corps et cycle d'apprentissage ;
- chaîne de recherche au vrai bureau : Armurerie avant Culasse non calée, refus atomique des tourelles sans elle, reprise exacte, factures débloquées, ancienne règle avant 340 ;
- partie migrée avec des tourelles finies ou commencées sous Armurerie seule ;
- fabrication réelle des deux armes à la table d'usinage alimentée, acier et composants exacts consommés, reprise exacte, puis équipement ;
- pistolet automatique : une balle après 18 ticks, récupération de 60 ticks ;
- pistolet-mitrailleur : trois balles à 0, +6 et +13 ticks après une visée de 30, une seule expérience, récupération de 54 ticks, rafale suivante, reprise exacte d'une sauvegarde au milieu de la rafale ;
- arrêt de la rafale quand la cible sort de portée, puis étourdissement en pleine rafale ;
- vente par les visiteurs et les caravanes avec les mêmes tirages ;
- armes des pillards selon la règle du jeu de base dès 340, inchangées avant ;
- refus avant 340 par les validateurs directs et par le chargement d'une sauvegarde complète ;
- migration.
