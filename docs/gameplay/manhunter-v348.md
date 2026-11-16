# Vengeance des animaux blessés ou mal apprivoisés — schéma 348

Schéma 348. Dans RimWorld 1.6, un animal sauvage blessé ou dont l'apprivoisement échoue peut devenir fou furieux (« manhunter ») et attaquer les humains. Elsewhere connaissait déjà cet état par les incidents (animal fou, meutes, scaria), mais ne tirait jamais ces deux chances : un animal chassé fuyait ou ripostait, un apprivoisement raté ne provoquait rien. La chasse étant un travail courant dès le début d'une partie, la règle manquait dans presque toutes les parties.

Les règles viennent du code et des définitions du jeu de base (Pawn_MindState.Notify_DamageTaken, CheckStartMentalStateBecauseRecruitAttempted et StartManhunterBecauseOfPawnAction ; PawnUtility.GetManhunterOnDamageChance, GetManhunterOnTameFailChance et ManhunterStateFor ; InteractionWorker_RecruitAttempt ; MentalStateDef Manhunter et ManhunterPermanent ; DifficultyDef ; StatDef HuntingStealth ; PawnTableDef Wildlife) ; aucun code ni texte n'en est repris. Les chances par espèce sont celles des données déjà présentes (`animal-core-data-v256`).

La règle ne vaut qu'à partir du schéma 348 : avant, aucun tirage ni comportement ne change. Aucun champ n'est ajouté à la sauvegarde ; la migration 347 → 348 ne change que le numéro, et rien n'est offert après coup.

## Un animal blessé se venge

À chaque coup qui touche un animal sauvage (balle ou flèche, coup au contact même dévié par l'armure, explosion), s'il est toujours vivant et sur la carte, un tirage décide s'il entre en rage. Il n'y a pas de tirage :

- si l'animal est déjà dans un état mental (fou furieux, confus) ;
- s'il a une faction : animal de la colonie, insecte d'une ruche ;
- si l'agresseur n'est ni une personne, ni un animal de la colonie, ni un mécanoïde, ni une tourelle d'une faction humaine : un prédateur sauvage, un piège, le feu ou un effondrement ne déclenchent rien ;
- si l'animal chassait justement cet agresseur pour le manger.

La chance est :

**chance de l'espèce × facteur de difficulté (+ 50 % avec la scaria) × 3 × (1 − discrétion de chasse de l'agresseur)**, ramenée entre 0 et 100 %.

- Le facteur de difficulté vaut 1 sauf en difficulté Paisible (0,25) ; Elsewhere ne propose que l'aventure, donc 1.
- Le facteur 3 est celui de la distance : le jeu de base le prévoit de 3 au contact à 1 à 30 cases, mais l'appel lors d'une blessure ne transmet pas la distance, si bien que la valeur retenue est toujours 3. Elsewhere suit le code, pas la bulle d'aide du jeu.
- La **discrétion de chasse** d'une personne vaut 0,05 × Tir × 0,05 × Animaux × Déplacement, passée sur la courbe du jeu de base (0 → 0 %, 0,1 → 50 %, 0,2 → 75 %, 0,5 → 80 %, 1 → 90 %). Sans compétence Animaux elle est nulle ; Tir 10 et Animaux 10 donnent 75,8 % ; Tir 20 et Animaux 20 donnent 90 %. Un animal de la colonie, un mécanoïde ou une tourelle n'ont pas de compétences : leur discrétion est celle de la courbe à 1, soit 90 %.

Exemples avec un chasseur sans compétence Animaux : un mufalo, un bison, un caribou ou un boomalope (10 %) entrent en rage dans 30 % des tirs qui les touchent ; les ours, le cobra, le couguar, l'éléphant, le lynx, le mégaparesseux, la panthère, le rhinocéros et les insectes sans ruche (50 %), comme les loups, wargs, autruches, casoars et émeus (100 %), à chaque coup. Avec Tir 10 et Animaux 10, un loup n'entre en rage que dans 72,5 % des coups. Un cerf, un lièvre ou une gazelle (0 %) ne se vengent jamais.

Le tirage se fait sur le flux aléatoire de l'impact, juste après la blessure et avant la fuite, comme `Rand.Chance` : aucun tirage quand la chance vaut 0 ou atteint 100 %. Un animal à terre consomme le tirage mais ne peut pas entrer en rage ; un animal enragé ne fuit plus.

## Un apprivoisement raté

Quand la dernière tentative d'apprivoisement échoue, l'animal sauvage (sans faction, pas déjà en rage) entre en rage selon la seule chance de son espèce, sans facteur de difficulté : émeu 100 %, warg 40 %, loups, ours, couguar, panthère, mégaparesseux et rhinocéros 30 %, lynx 20 %, cobra, casoar, autruche et boomalope 10 %, tous les autres 0 %. Le soigneur, à côté, est souvent la première cible.

## La meute

Quand la rage commence et que la difficulté permet les grosses menaces (toutes sauf Paisible), un second tirage à une chance sur deux étend la rage aux congénères : même espèce, sauvages, éveillés, à 24 cases au plus et dans la même pièce ou le même espace extérieur. Un animal endormi, à terre ou déjà en rage n'est pas entraîné.

Un message du journal annonce la vengeance et le nombre de congénères qui s'y joignent.

## Ensuite

L'animal reçoit le même état que les animaux fous des incidents : il cherche les humains, bloque devant les portes fermées puis les frappe, se fatigue, et retrouve son calme au bout du temps du jeu de base (au moins 10 000 ticks, puis en moyenne 0,3 jour). Un animal atteint de scaria entre en rage permanente.

La désignation de chasse reste. La désignation d'apprivoisement reste aussi, comme dans le jeu de base : le soigneur ne s'approche pas d'un animal en rage, puis reprend après le délai habituel entre deux tentatives une fois l'animal calmé (avant 348, la rage effaçait cette désignation ; un animal en rage portant une désignation d'apprivoisement n'est valide dans une sauvegarde qu'à partir de 348).

## Onglet Faune

Le tableau Faune affiche, comme le jeu de base, deux colonnes de plus à côté de Chasse et Apprivoiser : **Rage si blessé** (chance de l'espèce × difficulté, + 50 % avec la scaria) et **Rage si raté** (chance en cas d'apprivoisement raté), « — » pour une chance nulle. La bulle de chaque case rappelle la règle. Le tableau peut être trié sur ces deux valeurs.

## Adaptations et limites

- Le « district » du jeu de base est représentée par les pièces d'Elsewhere ; un enclos fermé seulement par des clôtures peut différer.
- Les facteurs d'Ideology (rôles de chasse) et d'Anomaly n'existent pas dans le jeu de base seul et ne sont pas repris ; il n'y a pas d'homme sauvage dans Elsewhere.
- Le jeu de base envoie une lettre de menace ; Elsewhere écrit un message dans le journal. Les avertissements affichés au moment de désigner une chasse ou un apprivoisement dangereux ne sont pas repris.
- Un congénère déjà en rage garde son état (le jeu de base pourrait remplacer une rage permanente par une rage ordinaire).
- Un animal sans attaque utilisable ou sans déplacement n'entre pas en rage, comme pour les incidents, et fuit alors normalement.

## Vérification

`tests/manhunter-on-damage-348.test.ts` (11 cas) : données des espèces et valeurs du tableau, la scaria ajoutée avant l'unique plafonnement final ; un mufalo chassé entre en rage dans 30 % des tirs mesurés sur 400 impacts réels, un cerf jamais, sans tirage ; la discrétion d'un chasseur Tir 10 / Animaux 10 ramène un loup à 72,5 % ; avant 348 aucune rage, et à 348 un tir sans rage ne diffère que par le seul tirage ; agresseurs exclus (animal sauvage, prédateur sur sa proie) et discrétion des animaux de la colonie et des tourelles ; coups au contact ; meute (congénère éveillé proche oui, endormi, lointain ou d'une autre espèce non) ; apprivoisement raté au taux de l'espèce (loup 30 %) ; un émeu dont l'apprivoisement échoue dans le moteur entre en rage, garde sa désignation, survit à la sauvegarde et au rechargement puis frappe une personne ; une chasse dans le moteur où le loup touché entre en rage puis mord le chasseur, après sauvegarde et rechargement ; migration 347 → 348 par le seul numéro et refus d'une sauvegarde 347 portant une désignation d'apprivoisement sur un animal en rage.

Voisins relancés (animaux, faune, chasse, rage, combat, mêlée, panneaux natifs) : seuls les échecs déjà connus restent. Campagne « Atterrissage » 24 jours, graine 42 : verte au schéma 348 (1 819 s). Le joueur scripté n'y a désigné aucune chasse : sa première boucherie (jour 3,5) vient de la dépouille d'un animal fou d'un incident abattu par Ada, ce qui ferme sa branche de chasse. Les deux épisodes de rage de la partie (jours 3,4 et 22) sont les deux incidents « animal fou » du conteur ; ces animaux étaient déjà en rage quand on les a touchés, donc aucun tirage de vengeance. La règle n'a donc pas été exercée par cette campagne, seulement par les tests dédiés.

Le coût est nul hors des impacts : un tirage par coup reçu, et la recherche des congénères seulement quand la meute est tirée.
