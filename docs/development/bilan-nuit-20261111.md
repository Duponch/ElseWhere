# Bilan de la nuit du 11 novembre 2026

Travail autonome demandé par l'utilisateur avant d'aller dormir : performances générales (chantier 4, simulation des grandes colonies) et correction au fur et à mesure des écarts de règles trouvés en lisant le code, à comparer au vrai RimWorld 1.6.

## Gains de performance

Banc de simulation seule (`scripts/perf-save-bench.ts`, Les Forges : 80 colons, 241 animaux, 120 ticks, `tmp/perf/c4-ab.sh`, 6 passages alternés, machine au calme, état simulé identique au bit près) :

| Comparaison | Avant | Après | Écart (médiane) | Écart (minimum) |
|---|---|---|---|---|
| Tout le chantier 4 (`a48f2767`, 10 novembre, contre `705d667b`) | 53,9 ms par tick | 39,3 ms | −27,2 % | −28,3 % |
| Cette session seule (`2e934e7d` contre `705d667b`) | 42,7 ms | 38,3 ms | −10,2 % | −11,5 % |

Les séries sont serrées (53,5 à 55,4 ms contre 38,4 à 41,2 ms). Trois optimisations exactes ont été faites après cette mesure (lumière par passe de mouvement, scories, table des cultures), puis une quatrième au matin (index des chantiers, −1,3 % en médiane sur 5 passages alternés, état identique).

**Ce que ces chiffres ne disent pas.** Ce banc mesure la simulation seule dans Node. La cible du chantier 4 (« ×3 demande une simulation vers 35 à 40 ms par tick ») y est atteinte, mais le jeu réel ajoute la publication vers l'affichage dans le Worker.

### Mesure du Worker réel (×3, Les Forges)

Worker de production (`scripts/perf-worker-run.ts` : simulation, encodeur, publications) piloté en temps réel dans Node, ×3 sur Les Forges, 30 s mesurées après 10 s de chauffe, 3 passages alternés, machine au calme. Avant : `a48f2767` (10 novembre, avant le chantier 4). Après : `ebfd54d7` (règles du schéma 303 incluses).

| | Avant | Après |
|---|---|---|
| Part du rythme ×3 tenue (médiane) | 70,0 % (63,2 à 71,3) | 81,6 % (81,1 à 92,1) |
| Retard des tâches du Worker, médiane | 327 à 367 ms | 151 à 261 ms |
| Retard p99 | 533 à 651 ms | 404 à 508 ms |

**×3 n'est pas encore tenu dans le Worker** : il manque environ 18 % de débit. Profil du Worker à ×3 (30 s) : ≈ 67 % du temps dans la simulation, ≈ 23 % dans la publication vers l'affichage (dont la copie structurée des messages, que le banc reproduit). Dans la simulation, la planification du travail pèse ≈ 10 %, la faune ≈ 7,5 %, le reste est plat (chaque poste entre 1 et 5 %). Ce n'est pas une mesure dans le navigateur : le vrai client ajoute le fil principal et le rendu.


### Optimisations de la nuit (toutes exactes : même état sur Les Forges et Les Éclaircies)

1. **Index des piles et journal de leurs écritures** (`src/sim/pile-index.ts`). Les questions « quelles piles sur cette case ? », « débris ou sol de matériaux ici ? », « malus de vitesse des vêtements portés ? », « arme équipée ? » et désormais « scories au sol ? » sont répondues par un index, pendant un pas de simulation seulement. Toute écriture de pile pendant un pas est signalée (96 changements de propriétaire réécrits dans 60 fichiers). Mode de contrôle `VERIFY_PILE_INDEX=1` : chaque réponse est recalculée par le parcours complet. Il a tourné sur toute la suite ordinaire (≈ 10 000 tests) sans une seule écriture non signalée. Lecteurs + index : 7,4 % → 4,7 % du temps.
2. **Faune** : la navigation animale lit la liste des seules portes ; l'air ressenti par les animaux est indexé dans des tableaux typés ; « porté ou pris en charge » se teste en un seul parcours des colons. 4,5 % → 3,0 %.
3. **Vues de température** sans disposition en tableaux typés ; **réseau électrique** : branchements lus dans une liste partagée, batteries sans copie de la liste des bâtiments ; **petites plantes sous les chantiers** : index dérivé de la liste précédente au lieu d'être reconstruit sur ≈ 21 000 ressources, et consulté avant de parcourir toutes les ressources lors du retrait des plantes d'un chantier.
4. **Lumière** : une seule lecture de l'environnement lumineux par passe de mouvement Core, gardée par des comparaisons en temps constant (bâtiments, cases, toits, ressources, heure).
5. **Propreté des pièces de recherche** : les scories au sol viennent de l'index des piles au lieu d'un parcours des 1 800 piles par pièce et par tick.
6. **Table des cultures** (case → ressource) dérivée de la liste précédente ; chaque dérivation a été comparée à une reconstruction complète (32 fois sur Les Forges, 66 sur Les Éclaircies).
7. **Chantiers** (matin) : l'index « plantes par case » des chantiers est dérivé de la liste précédente des ressources au lieu d'être reconstruit sur ≈ 21 000 ressources (19 dérivations sur Les Forges, toutes identiques à une reconstruction) ; les piles au sol d'un chantier sont lues dans l'index des piles, avec contrôle par parcours complet en mode vérification.

### Pistes écartées, avec la raison

- **Mémoire par pas de la grille des cases bloquées** : la grille n'est validée qu'environ 1,6 fois par pas qui s'en sert ; gain ≈ 0,6 point pour un contrat sensible (toute case remplacée doit être vue).
- **Lumière dans le calcul des coûts de chemin** (≈ 1,7 %) : hors passe de mouvement, l'activité des sources (une torche qui s'éteint) peut changer en cours de pas ; une garde exacte coûterait presque autant que ce qu'elle épargne.
- **Planification du travail** (≈ 12 %) et reste de la faune : ce sont de vraies recherches de chemin et des rôles de colons qui peuvent changer pendant la passe. Les réduire passe par une refonte des cadences, donc des règles, à mener comme un lot à part, vérifié contre RimWorld.

## Règles corrigées (schéma 303, migration 302 → 303 par le seul numéro)

1. **Passage d'une porte à une autre porte.** Dans RimWorld 1.6, le pas paie 45 ticks de plus quand aucune des deux portes n'est maintenue ouverte (`PathGrid.CalculatedCostAt`). Ce surcoût ne compte que pour la durée réelle du pas, pas pour la recherche de chemin. Ici, un sas à deux portes était donc plus rapide que dans le jeu. Corrigé pour les pas Core des humains : le surcoût est ajouté avant le plafond de 450 et doublé à la marche lente, comme dans RimWorld (`src/sim/door-to-door-303.ts`, test `tests/door-to-door-303.test.ts`). Adaptation : animaux et mécanoïdes gardent leurs coûts.
2. **Très grandes pièces.** Dans RimWorld 1.6, une pièce de plus de 60 régions (≈ 96 × 96 cases d'un seul tenant) n'a plus de statistiques de pièce ni de rôle (`Room.UpdateRoomStatsAndRole`). Corrigé : décompte des régions par blocs de 12 × 12 comme le jeu ; au-delà de 60, la propreté (recherche, chirurgie, infection, intoxication), la qualité de la pièce (souvenirs) et le rôle de travail prennent les valeurs « sans pièce » (`src/sim/room-region-limit-303.ts`, test `tests/room-region-limit-303.test.ts`).

3. **Vitesse d'ouverture des portails de clôture.** Dans RimWorld 1.6, un portail a une vitesse d'ouverture de base de 1,15 (`Buildings_Structure.xml`) : il s'ouvre en 33 ticks en bois, 39 en acier ou en jade, 87 en blocs de pierre. Ici il s'ouvrait comme une porte (38, 45, 100). Corrigé : un portail construit à partir du schéma 303 garde sa durée d'ouverture ; un portail d'une ancienne partie la prend à sa prochaine ouverture, sans saut d'animation.
4. **Les portails dans la recherche de chemin.** Dans RimWorld, la recherche de chemin compte un portail comme une porte : son temps d'ouverture s'ajoute au coût de la case (`PathUtility.GetDoorCost`). Ici un portail ne coûtait rien, et les colons coupaient par les enclos plus volontiers que dans le jeu. Corrigé pour les colons et autres humains ; les animaux gardent leurs règles de portails.

Les deux premières règles ne s'appliquent pas dans les fenêtres du banc des Forges et des Éclaircies : seules leurs empreintes changent, à cause du numéro de schéma.

## Règles vérifiées conformes (rien à corriger)

Comparées au code décompilé de RimWorld 1.6 et aux données du jeu installé (`Data/Core/Defs/Rooms/RoomStats.xml`), en lecture seule :

- les courbes de propreté pour la vitesse de recherche, la réussite chirurgicale, le risque d'infection et l'intoxication alimentaire, et leurs valeurs « sans pièce » ;
- la formule de l'« impressionnant » d'une pièce ;
- le démarrage et le délestage progressifs du réseau électrique ;
- les durées d'ouverture des portes selon leur matière (bois 38 ticks, acier et jade 45, blocs de pierre 100), le délai de fermeture (110 ticks) et le délai de contact amical (120 ticks) ; les portes automatiques alimentées rapides n'arrêtent pas les colons, comme dans le jeu.

## Défauts de tests trouvés et réparés

- Le test de la lumière du jour (`daylight-speed-engine-v492`) épingle l'empreinte exacte du fichier de mouvement Core. Une optimisation du 10 novembre l'avait changé sans changer le comportement, et le test ne se chargeait plus. Empreinte mise à jour : il retrouve ses deux échecs connus, antérieurs à ce travail (un champ de compte rendu ajouté le 6 novembre).
- Le test de l'air ressenti par les animaux exige un seul parcours des cases des pièces : mon premier index en faisait deux, corrigé.

## Limites et suites

- ×3 n'est pas tenu dans le Worker réel (81,6 %). Le reste de la simulation est plat : la suite passe par des refontes (cadence de la planification, faune) qui touchent les règles, et par le chantier 2 (publication, ≈ 23 % du Worker).
- Un test (`main-terminal298`) ne se charge plus depuis des changements de `src/main.ts` antérieurs à ce travail : son épinglage du texte de `main.ts` date du 31 octobre et ses trois cas décrivent une structure qui n'existe plus. Non modifié.
- Chantiers 3 et 2 inchangés cette nuit.
