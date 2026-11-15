# Emprunt de gaz, rayures de précision et cinq armes à feu industrielles — V342

Schéma 342. Les recherches du jeu de base GasOperation et PrecisionRifling, et leurs cinq armes (Gun_ChainShotgun, Gun_HeavySMG, Gun_LMG, Gun_AssaultRifle, Gun_SniperRifle). Le tir en rafale générique du [lot 340](blowback-v340.md) sert tel quel : chaque arme apporte seulement son nombre de tirs et son écart.

## Recherche

| Recherche | Coût | Prérequis | Bureau | Âge technologique |
|---|---|---|---|---|
| Emprunt de gaz | 1 000 points | Culasse non calée | bureau simple | industriel |
| Rayures de précision | 1 400 points | Emprunt de gaz **et** Microélectronique | **bureau avancé alimenté** | industriel |

- Emprunt de gaz débloque le fusil à chaîne, la mitraillette lourde et le fusil-mitrailleur ; Rayures de précision le fusil d'assaut et le fusil de précision.
- Rayures de précision se choisit dès que ses deux prérequis sont acquis, mais seul un bureau de recherche avancé alimenté la fait avancer, comme dans le jeu de base (requiredResearchBuilding HiTechResearchBench). Aucun multi-analyseur n'est demandé.
- Les factures n'apparaissent qu'après la recherche. Une arme achetée, ramassée ou prise à un pillard s'utilise sans recherche.
- Rien n'est donné à une partie migrée : aucune des deux recherches n'est commencée.

## Fabrication

Toutes à la table d'usinage alimentée, par la chaîne des armes à feu existante : arme inachevée commune, auteur et progression conservés, qualité tirée par le fabricant, travail Artisanat.

| | Fusil à chaîne | Mitraillette lourde | Fusil-mitrailleur | Fusil d'assaut | Fusil de précision |
|---|---|---|---|---|---|
| Coût | 70 acier, 5 composants | 75 acier, 4 composants | 75 acier, 5 composants | 60 acier, 7 composants | 60 acier, 8 composants |
| Artisanat | 6 | 5 | 6 | 6 | 7 |
| Travail (unités du jeu de base) | 31 000 | 24 000 | 34 000 | 40 000 | 45 000 |
| Recherche | Emprunt de gaz | Emprunt de gaz | Emprunt de gaz | Rayures de précision | Rayures de précision |

- **Fonte :** 25 % de l'acier, aucun composant : 17–18 acier pour le fusil à chaîne, 18–19 pour la mitraillette lourde et le fusil-mitrailleur, 15 pour les fusils d'assaut et de précision.

## Caractéristiques (qualité normale)

| Valeur | Fusil à chaîne | Mitraillette lourde | Fusil-mitrailleur | Fusil d'assaut | Fusil de précision |
|---|---|---|---|---|---|
| Portée | 12,9 cases | 22,9 cases | 25,9 cases | 30,9 cases | 44,9 cases |
| Visée | 1,2 s (72 ticks) | 0,9 s (54 ticks) | 1,8 s (108 ticks) | 1 s (60 ticks) | **3,5 s (210 ticks)** |
| Tir | rafale de 3, 10 ticks d'écart | rafale de 3, 11 ticks | **rafale de 6, 7 ticks** | rafale de 3, 10 ticks | une balle |
| Récupération | 1,35 s (81 ticks) | 1,65 s (99 ticks) | 1,6 s (96 ticks) | 1,7 s (102 ticks) | 1,5 s (90 ticks) |
| Précision (contact / courte / moyenne / longue) | 57 / 64 / 55 / 45 % | 85 / 65 / 35 / 20 % | 40 / 48 / 35 / 26 % | 60 / 70 / 65 / 55 % | 50 / 70 / 88 / 90 % |
| Projectile | décharge de fusil : 18 dégâts, pénétration 14 %, vitesse 55, arrêt 3 | 12 dégâts, pénétration 18 %, vitesse 48, arrêt 0,5 | 12 dégâts, pénétration 18 %, vitesse 46, arrêt 1 | 11 dégâts, pénétration 16,5 %, vitesse 70, arrêt 0,5 | 25 dégâts, pénétration 37,5 %, vitesse 100, arrêt 1,5 |
| Masse, valeur | 4,5 kg, 404,6 | 3,5 kg, 356,9 | 8,5 kg, 424,9 | 3,5 kg, 482 | 4 kg, 532 |

- Points de vie 100 ; corps à corps comme les autres armes à feu : crosse ou poignée (contondant 9) et canon (contondant ou estoc 9), 2 s.
- La qualité modifie les dégâts, la pénétration et la précision comme pour les autres armes à distance. La décharge du fusil à chaîne est celle du fusil à pompe (pénétration explicite 0,14) ; les autres balles prennent les valeurs par défaut du jeu de base (dégâts × 0,015, arrêt 0,5) sauf indication contraire.
- Valeur = acier × 1,9 + composants × 32 + travail × 0,0036.

## Tir en rafale

Les règles du [lot 340](blowback-v340.md#tir-en-rafale) s'appliquent sans changement :

| Arme | Balles après la visée (ticks du jeu de base) | Attente entre deux balles |
|---|---|---|
| Fusil à chaîne, fusil d'assaut | 0, +9, +19 | 11 ticks |
| Mitraillette lourde | 0, +10, +21 | 12 ticks |
| Fusil-mitrailleur | 0, +6, +13, +20, +27, +34 | 8 ticks |

- Une seule expérience de tir par rafale, calculée sur tout le cycle ; une riposte compte une rafale pour une attaque.
- Le fusil-mitrailleur peut garder jusqu'à cinq balles en attente : la sauvegarde l'enregistre strictement et la reprise tire les balles restantes aux mêmes ticks.
- **Propriétés de verbe :** aucune de ces cinq armes n'a de portée minimale ni de rayon de tir forcé dans le jeu de base ; l'arrêt d'une rafale sans ligne de tir (stopBurstWithoutLos, vrai par défaut) est déjà respecté. Le code de rafale n'a donc rien à ajouter pour elles.

## Pillards et visiteurs

Dès 342, les sortes « Gun » tirent ces armes comme PawnWeaponGenerator, avec les mêmes deux tirages propres au personnage que le lot 340 :

| Sorte du jeu de base | Somme | Nouvelles armes possibles |
|---|---|---|
| Récupérateur, pirate, conseiller municipal, marchand | 200–345 | aucune (la moins chère, la mitraillette lourde, vaut 356,9) |
| Garde (étrangers) | 250–400 | mitraillette lourde |
| Mercenaire | 330–650 | fusil à chaîne, mitraillette lourde, fusil-mitrailleur, fusil d'assaut |

- **Correction du tableau du lot 340 :** le fusil de précision ne porte que l'étiquette SniperRifle (weaponTags Inherit="False") ; aucune sorte « Gun » ne le tire. Dès 342 il sort du tableau, ce qui change seulement la répartition des mercenaires dont la somme dépasse 532. En 340 et 341, le tirage reste exactement celui du lot 340.
- Gardes, mercenaires et marchands des caravanes, venues ou rencontrées sur la carte du monde, suivent la même règle. Les rencontres des cartes temporaires gardent leur arme fixe, comme au lot 340.

## Commerce

Les visiteurs et les caravanes marchandes (fournisseur militaire) peuvent vendre les cinq armes : entrées 8 à 12 de la liste des armes à distance du jeu de base, déjà tirées auparavant. Les tirages aléatoires sont inchangés : un marchand qui vendait déjà quelque chose le vend toujours.

## Non livré

- Tourelle à canon automatique (HeavyTurrets) et minigun (MultibarrelWeapons), dont Emprunt de gaz est un prérequis caché ; munitions à charge pulsée (ChargedShot) et tourelle à obus d'uranium (SniperTurret), dont Rayures de précision est un prérequis caché.
- Sortes Mercenary_Sniper, Mercenary_Elite et Mercenary_Heavy, absentes d'Elsewhere.
- Récompenses de quête de qualité supérieure (RewardStandardQualitySuper) et demandes commerciales : ces armes n'y figurent pas encore.
- Classes d'armes (ShortShots, LongShots, RangedHeavy), utilisées seulement par les idéologies.

## Adaptations

- **Choix de Rayures de précision :** dans le jeu de base (ResearchProjectDef.CanStartNow), le projet ne peut être lancé qu'une fois un bureau avancé construit, même éteint. Comme pour les autres recherches avancées d'Elsewhere, il se choisit sans bureau et le panneau signale le bureau avancé manquant ; aucun point n'avance tant qu'un bureau avancé alimenté n'est pas utilisé.
- **Corps à corps :** le jeu de base nomme « crosse » ou « poignée » le premier outil selon l'arme ; ici, comme pour toutes les armes à feu, les mêmes valeurs (contondant 9, canon contondant ou estoc 9, 2 s) sous les outils communs.
- **Tirage par identité et menace de mêlée :** inchangés depuis le [lot 340](blowback-v340.md#adaptations).

## Rendu

- Modèles originaux portés en bandoulière et tenus comme le fusil à pompe : fusil à chaîne à tambour sous un canon court et épais, mitraillette lourde à manchon ajouré, crosse métallique et chargeur droit, fusil-mitrailleur à long canon, chargeur et bipied replié, fusil d'assaut à chargeur courbe et rail, fusil de précision à long canon fin, lunette et crosse en bois.
- Pictogrammes propres aux cinq armes, produits par `scripts/rebuild-pictograms.mts` ; Emprunt de gaz reprend celui du fusil-mitrailleur, Rayures de précision celui du fusil de précision.
- Comme pour les lots précédents, la table de l'atlas des acteurs cuits ne connaît pas encore ces armes ; le rendu ordinaire les affiche.

## Sauvegardes

Une sauvegarde 341 passe à 342 en changeant seulement son numéro. Avant 342, les éléments suivants sont refusés :
- les cinq armes, leurs recettes, factures et ouvrages ;
- leurs balles en vol et les visées, attentes ou récupérations à ces armes ;
- les recherches Emprunt de gaz et Rayures de précision, en cours, choisies ou terminées.

Dès 342 :
- une facture, un ouvrage ou une tâche d'une de ces armes exige sa recherche terminée ;
- Emprunt de gaz exige Culasse non calée, Rayures de précision Emprunt de gaz et Microélectronique, terminées avant elles ;
- une tâche de Rayures de précision exige un bureau avancé ;
- la rafale en cours garde sa cible et au plus le nombre de balles de l'arme moins une.

## Vérifications

`tests/guns-342.test.ts` couvre :
- recettes, valeurs, masses, profils de tir par qualité, rafales, cycle d'apprentissage, fonte et outils de corps à corps des cinq armes ;
- chaîne de recherche au vrai bureau : Culasse non calée avant Emprunt de gaz, refus atomique de Rayures de précision sans ses prérequis, aucun progrès au bureau simple, progrès et fin au bureau avancé alimenté, reprises exactes ;
- fabrication réelle des cinq armes à la table d'usinage alimentée, acier et composants exacts consommés (raccourci déclaré vers la fin du travail de chaque ouvrage), reprise exacte, puis équipement ;
- rafales du fusil à chaîne, de la mitraillette lourde, du fusil-mitrailleur et du fusil d'assaut : nombre de balles, écarts, attente, une seule expérience, récupération puis rafale suivante ;
- fusil de précision : une balle après 210 ticks, récupération de 90 ticks ;
- sauvegarde au milieu d'une rafale de fusil-mitrailleur, reprise exacte et forme stricte de la rafale ;
- armes des pillards dès 342, inchangées en 341, jamais de fusil de précision pour une sorte « Gun » ;
- vente par les visiteurs et les caravanes avec les mêmes tirages ;
- refus avant 342 par les validateurs directs et par le chargement d'une sauvegarde complète ;
- migration.
