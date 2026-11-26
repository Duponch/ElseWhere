# Performance à ×1, ×3 et ×6 — 25 novembre 2026

Nouvelle tranche demandée par l'utilisateur après [la tranche de clôture précédente](performance-closure-20261125.md). Le point de comparaison est **le code local exact au début de cette reprise**, et non l'ancien HEAD ni le début du chantier du matin. Schéma 379, règles, cadences de simulation/publication, ressources, modèles et qualité graphique conservés.

## Travail retenu

- **Planification des transports** : les destinations de stockage ne matérialisent plus une trentaine de champs d'acceptation inutilisés par la décision ; la capacité effective est toujours vérifiée avec les filtres, piles et réservations actuels. Priorités, ordre de recherche et quantités restent les mêmes.
- **Navigation** : overlays copy-on-write des coûts et occupations pour les seuls propriétaires fermés de simulation, avec captures antérieures intactes ; continuité du témoin privé de l'index des piles sous le propriétaire de journal de terrain, et révocation sur lecture publique. Les API de lecture mutables gardent leur décision à partir du monde actuel.
- **Flore et température** : échéanciers de plantes dérivés lors des petites mutations de membres plutôt que reconstruits ; repli complet aux changements ambigus et oracle exhaustif en vérification. Cases de la grille de régions en colonnes numériques, cellules spatiales paginées et voisinage sans tableaux temporaires ; ordre de découverte, candidats et RNG conservés. Propriétaires humains et travaux thermiques capturés seulement si nécessaires. Corps d'un animal sain et enclos lus uniquement après les gardes qui nécessitent ces données.
- **Admission des données MAIN** : lecture d'un seul descripteur des champs ordinaires réellement détenus, mémo de rôle compact et parcours par préfixes de feuilles ordinaires, en conservant le chemin strict dès qu'un objet, une propriété, un prototype ou une voie de propriétaire n'est pas prouvé. Aucun ACK ou droit supplémentaire n'est dérivé de la représentation ; les sauvegardes publiques continuent à être contrôlées strictement.
- **Rendu** : les matrices locales fixes des conteneurs de la scène restent composées, mais leur matrice monde suit toujours les déplacements des ancêtres et les changements de parent. Les phases vides court-circuitent un parcours sans travail. Dans les lots de piles, seules les instances effectivement modifiées réécrivent leurs matrices, couleurs, variantes de surface et données d'atlas ; tout changement d'ordre recalcule les ordinaux de forme, et les bornes/ranges actifs restent exacts. Le chemin intégral est conservé lors d'une allocation, d'une préparation d'ombre ou de la perte d'un témoin.
- **Guide de première journée** : le témoin du premier bénéficiaire d'une place de lit permet de répondre aux exceptions sans rescanner tous les colons par couple lit/personne ; la capture des propriétaires globaux est commune à la lecture. Le matching n'affiche toujours que son cardinal maximal. Il prend d'abord une place compatible libre, puis utilise les chemins alternants habituels. Les IDs de travaux de retrait, d'étagères disponibles et de porteurs d'armes sont réunis pendant une même lecture ; la croissance des cultures partage ses entrées exactes. Rien n'est mémorisé entre deux mondes ou deux appels du guide.

### Comparaisons de simulation et sélection

Banc Node empaqueté par esbuild, Les Forges 250 × 250, 80 colons, 240 macro-ticks mesurés après 20 de chauffe. Trois paires alternées au lieu d'un seul essai ; état intégral comparé à chaque paire. Pour le lot de simulation gelé avant le dernier ajustement de lecture des lits :

| Mesure | Témoin | Candidat | Écart |
|---|---:|---:|---:|
| Temps par macro-tick médian des passages | 35,476 ms | 34,287 ms | −3,35 % |
| Frontière p95 médiane | 63,435 ms | 58,485 ms | −7,81 % |
| Plafond de simulation seule (ticks/s) | 28,188 | 29,166 | +3,47 % |

Les six états complets ont le SHA-256 `ab7d71dda56c448bf450b59267fa300e036fd0c59a0d0f0a40d5784ced49a2a4`. Toutes les paires sont favorables sur la moyenne par tick. Ce plafond est celui de la **simulation seule**, avant les coûts Worker, transport et affichage ; il ne représente pas un ×6 tenu.

Rapport `tmp/perf-20261125-next/ab-sim-forges-base-candidate1-3-x6-25.json`.

Piste écartée : agenda privé de publication naturelle par ordinaux, échéances et différences de ressources. Première version exacte au rejeu mais reconstruction coûteuse lorsque les membres ou l'ordre changent : à charge fixe (199 ticks, 54 Fulls, 715 phases et 5 réponses), trois paires témoin/candidat1 montrent un coût CPU process 21 000 → 21 483 ms (+2,30 %) malgré un temps écoulé 12 642 → 12 534 ms. Deux paires isolant ensuite cette seule piste donnent 12 805 ms avec agenda contre 12 491,5 ms sans. Une version à reconstruction différée ne justifie pas la complexité : deux paires sans agenda/candidat3 donnent CPU 21 070,5 → 22 093 ms (+4,85 %) et wall 12 428 → 12 664,5 ms (+1,90 %). Les trois sources de cette piste et son test expérimental ont été retirés **exactement** au gel initial de ce tour, en conservant l'ensemble des optimisations de publication précédentes. La dérivation incrémentale supplémentaire de l'index de structures n'a pas été implémentée (coût inclusif profilé ~1,1 %, potentiel trop faible avant preuve).

Rapports `tmp/perf-20261125-next/ab-replay-forges-{base-candidate1-3,candidate1-candidate2-2,candidate2-candidate3-2}-x6-25.json`. Ne pas présenter le temps CPU relatif de l'agenda comme un gain.

## Premier passage dans le vrai client

Chrome, backend Three WebGPU vérifié et adaptateur AMD RDNA-1, 1440 × 1000, même sauvegarde Les Forges, vue fixe, 5 s de chauffe et 20 s d'observation à chaque vitesse, dans l'ordre ×1, ×3, ×6. Aucun changement de qualité, seuil ou cadence de publication.

| Vitesse | RAF/s témoin → final | p95 intervalle (ms) | p99 intervalle (ms) | Coût du Full (ms) | Adoption résidente (ms) | Images >100 ms | Ticks/s lus du Full |
|---|---:|---:|---:|---:|---:|---:|---:|
| ×1 | 117,8 → 128,6 (+9,2 %) | 12,1 → 12,1 | 78 → 60 | 98,9 → 81,8 | 70,8 → 54,2 | 5 → 3 | 5,9 → 5,8 |
| ×3 | 98,2 → 111,0 (+13,0 %) | 24 → 18 | 96 → 72,1 | 129 → 103,2 | 85,1 → 64,2 | 15 → 3 | 17,9 → 17,9 |
| ×6 | 110,6 → 118,7 (+7,3 %) | 17,9 → 12,1 | 102 → 84 | 138,1 → 117,5 | 92,5 → 74,8 | 23 → 7 | 26,4 → 25,2 |

Les appels de rendu dont le temps dépasse la résolution du chrono suivent presque le même débit (117,4 → 128,2 / 97,3 → 110,1 / 109,8 → 117,7 par seconde). Ce ne sont pas les rafraîchissements physiques de l'écran. Les tâches longues cumulées dans les fenêtres de 20 s baissent de 3 925 → 2 517, 5 282 → 3 603 et 3 618 → 2 640 ms. Le HUD réduit notamment son temps à ×1 de 44,8 → 23,8 ms/s. Les plus longs intervalles sont 156 → 132,1 / 306 → 318 / 168 → 132 ms : pas de disparition garantie des saccades, le maximum ×3 de ce premier passage augmente. Zéro erreur JS. Le débit observé à partir du dernier Full ne constitue pas le front physique confirmé d'un Worker saturé ; la baisse du compteur Full à ×6 dans ce passage est conservée et non assimilée à un gain de simulation.

Rapports `tmp/perf-20261125/client-start-next.json` et `client-final-next.json`.

### Confirmation inversée et bilan des deux paires

Second passage final puis témoin, mêmes conditions, backend et matériel vérifiés, zéro erreur JS dans les quatre passages. Pour les FPS et les percentiles par fenêtre, le tableau utilise la médiane des deux relevés de chaque version ; les images >100 ms sont additionnées sur les deux fenêtres de 20 s.

| Les Forges | ×1 témoin → final | ×3 témoin → final | ×6 témoin → final |
|---|---:|---:|---:|
| RAF/s | 119,1 → **128,2** (+7,6 %) | 98,8 → **110,1** (+11,4 %) | 107,8 → **118,2** (+9,6 %) |
| Appels de rendu/s | 118,80 → 127,83 | 97,97 → 109,25 | 106,99 → 117,17 |
| p95 intervalle, ms | 12,1 → 12,0 | 24,0 → 18,0 | 18,0 → 12,1 |
| p99 intervalle, ms | 75,0 → 60,0 | 96,0 → 72,0 | 102,0 → 84,0 |
| Coût moyen du Full, ms | 97,9 → 80,5 | 126,2 → 111,7 | 138,8 → 118,2 |
| Adoption résidente, ms | 69,7 → 53,4 (−23,4 %) | 83,1 → 64,5 (−22,4 %) | 92,9 → 74,9 (−19,4 %) |
| Fulls/s | 2,0 → 1,9 | 1,7 → 1,8 | 1,1 → 1,1 |
| Temps HUD, ms/s | 44,0 → 29,2 | 46,0 → 36,7 | 41,7 → 32,1 |
| Images >100 ms, sur 40 s | 9 → 6 | 31 → 7 | 50 → 14 |
| Tâches longues par fenêtre, ms | 3 817,5 → 2 540,5 | 5 428 → 3 731,5 | 3 793 → 2 611,5 |

Les deux paires sont favorables en FPS à chacune des trois vitesses. Total des intervalles >100 ms : **90 → 27** (−70 %) sur 120 s de test de chaque version. Tous les chiffres sont conservés : l'application graphique entière à ×3 du deuxième passage demeure ponctuellement très chère (un appel `applyWorld` de 596,5 ms, intervalle de 599,9 ms ; premier passage final 318 ms au maximum). La médiane du coût d'application des couches à ×3 augmente de 38,9 → 43,1 ms, même si l'adoption et le Full entier diminuent. Le maximum ×3 reste donc une limite, et non un gain uniforme sur tous les intervalles.

La sonde de la seconde paire enregistre aussi le dernier Core publié effectivement lu lors de la réception des messages du Worker (Fulls **et** phases), à la manière du banc Node. Elle ne confond pas le front reçu avec une image effectivement dessinée ni avec le dernier Full. **×1 6,0 → 6,0 ; ×3 18,0 → 17,9 ; ×6 25,0 → 26,9 ticks/s** (+7,6 % à ×6 sur cette paire). Le débit ×6 à partir des seuls Fulls reste semblable en médiane des deux essais (26,0 → 25,9).

Rapports `client-{start,final}-next-repeat.json` dans `tmp/perf-20261125/` ; `scripts/perf-client-publication.mjs` et son résumé supportent désormais ce compteur additionnel sans modifier le jeu. Pas de promesse de 200 FPS stables, de ×6 complet sur une colonie de stress ou d'absence de tout pic.

## Débit du runtime Worker

Runtime de production empaqueté, sous Node, avec clone structuré de chaque message pendant l'observation. Front physique confirmé (phases comprises), pas seulement le dernier Full. 25 s observées après 5 s de chauffe, mêmes saves, passages séquentiels. Deux paires alternées sur la vitesse saturée des Forges :

| ×6 Les Forges | Témoin | Final | Écart |
|---|---:|---:|---:|
| Ticks/s confirmés | 20,278 | 21,367 | **+5,37 %** |
| Cadence cible 36/s tenue | 56,325 % | 59,350 % | +3,025 points |
| Retard de tâche p50 | 437,05 ms | 405,80 ms | −7,15 % |
| Retard de tâche p95 | 597,15 ms | 562,40 ms | −5,82 % |
| Retard de tâche p99 | 637,15 ms | 657,50 ms | +3,19 % |
| Clonage moyen d'un Full | 9,575 ms | 9,975 ms | +4,18 % |

Les deux paires favorisent les ticks/s (20,293 → 21,324 puis 20,262 → 21,410). Le pire tail p99 de ce relevé et le petit surcoût de clonage sont conservés, pas annoncés comme des gains. Rapport `tmp/perf-20261125-next/ab-worker-forges-base-candidate4-2-x6-25.json`.

À ×1, même cadence pratiquement complète (5,986 → 5,980 ticks/s, 99,76 → 99,67 % du rythme nominal) et coût CPU du processus 63,8 → 60,6 % d'un cœur logique équivalent. Retard p95 45 → 43,4 ms ; p99 79,8 → 86,5 ms. Puisque le moteur est déjà plafonné au rythme demandé, un gain CPU ne doit pas se traduire par un jeu plus rapide que ×1. Rapport `ab-worker-forges-base-candidate4-1-x1-25.json`.

À ×3, cadence demandée également tenue (18,010 → 18,061 ticks/s, 100,06 → 100,34 % sur la courte fenêtre), avec une meilleure réactivité : retard p50 34,2 → 24,7 ms (−27,8 %), p95 169,1 → 137,4 ms (−18,7 %), p99 214,7 → 197,5 ms (−8,0 %). CPU process 147,7 → 144,1 %. Rapport `ab-worker-forges-base-candidate4-1-x3-25.json`.

**Les Éclaircies ×6** : 36,041 ticks/s confirmés (9 014 Core-ticks, 25 s, 100,11 % du rythme nominal), CPU process 69,1 %, retard p50 6 ms et p95 46 ms. Le rythme était déjà tenu au gel précédent (35,929/36) : maintien confirmé, pas de dépassement durable revendiqué. Rapport `tmp/validation-runs/perf-next-final-worker-eclaircies-x6-2026-11-25T13-59-26.391Z-17704/output.log`.

## Rejeux et contrats

Le build Pages complet avec typage a réussi en 27,787 s. Les deux lots ciblés donnent, après la correction de la chronologie d'une fixture hostile, 167 cas distincts : 159 verts, huit échecs historiques déjà nommés dans `tmp/perf/known-failures.json`, aucun nouvel échec. Les rouges historiques sont ceux de navigation (3) et des assertions de rechargement des lits doubles (5), pas de nouveaux défauts du lot. Les deux nouveaux tests du guide comparent notamment chaque exception de réservation au lecteur historique et vérifient le chemin alternant lorsque deux colons se disputent une place libre.

Les trois rejeux du **runtime final** (candidat4, dix sources Worker modifiées par rapport au départ de ce tour) sont acquis avec `VERIFY_TERRAIN_CACHES=1 VERIFY_PILE_INDEX=1 VERIFY_HUMAN_CARRIERS=1 VERIFY_NATURAL=1 VERIFY_ADOPTION=1`.

| Partie / salves | Messages comparés | Fulls adoptés | Phases adoptées | Sauvegarde SHA-256 (préfixe) |
|---|---:|---:|---:|---|
| Les Forges / mixed | 688 | 41 | 518 | `1d50650eee80d54d` |
| Les Forges / slow | 886 | 66 | 691 | `e4694d23e3be426d` |
| Les Éclaircies / mixed | 676 | 41 | 506 | `a50e3fc5d6e39894` |
| Total | **2 250** | **148** | **1 715** | **Identiques** |

Chaque paquet a le même encodage canonique (types, champs, ordre, valeurs numériques exactes, alias), les trois sauvegardes finales ont la même empreinte complète que les références de la tranche précédente. Comparaisons `scripts/publication-replay-compare.mjs` : toutes exit 0. Rapports `tmp/perf-20261125-next/{targeted,final-contracts,final-forges,final-forges-slow,final-eclaircies}.json`. Aucune nouvelle longue campagne rejouée ; les deux campagnes acquises au schéma 379 dans le lot fonctionnel ne sont pas réinventées comme des preuves de cette tranche.

## Présentation et remise

Le contrôle intégral de présentation de la tranche finale passe en **162,239 s** (sortie 0), Chrome WebGPU AMD RDNA-1, les deux actions réelles de 45 s, transitions ×1/×6/×1/×3. Même oracle et mêmes seuils que lors des deux passages de la tranche précédente.

| Critère | Minage | Coupe d'arbres |
|---|---:|---:|
| Soumissions réelles | 7 397 | 7 384 |
| RAF sans nouvelle soumission | 24 | 0 |
| Jobs initiaux → restants | 186 → 160 | 262 → 238 |
| Changements de vitesse | 22 | 22 |
| Délai maximum sur image soumise | 33,9 ms | 32,0 ms |
| Alarmes brutes RAF | 7 | 1 |
| Alarmes sur soumissions réelles | 1 | 1 |
| Départs continus intégralement prouvés | 1 | 1 |
| Sauts inexpliqués | **0** | **0** |
| Occupations de roche / indices actifs | **0 / 0** | **0 / 0** |
| Starvation, absence prolongée de soumission, erreurs JS | 0 / 0 / 0 | 0 / 0 / 0 |
| Qualification | **PASS** | **PASS** |

Total 14 781 soumissions, 44 changements de vitesse ; les deux `submittedQualification.qualified` sont vrais. Les alarmes brutes et leurs témoins restent enregistrés. Rapport `tmp/test-runs/perf-next-presentation-2026-11-25T14-03-46.927Z-24368/artifacts/harvest-sync-verification.json`.

**Résultat** : gains natifs confirmés à chacune des trois vitesses, moteur plus rapide sur la charge saturée et moins coûteux aux vitesses déjà plafonnées. Le critère de cadence à ×3 demeure acquis et Les Éclaircies tiennent ×6. Le ×6 complet sur Les Forges, les 200 FPS stables (notamment en rotation), la rare application graphique entière très longue et le critère historique de baisse de part relative de publication du Worker ne sont pas déclarés acquis. Ne pas confondre une baisse du coût d'une couche ou du Full avec celle de la part relative de la publication Worker. Pas de dégradation des règles, de la qualité graphique ou des cadences demandées pour obtenir ces chiffres.

La sauvegarde utilisateur `bugs/Elsewhere-2026-11-24T22-53-35-925Z.json` conserve le SHA-256 `fb3291817cf6f5361eba2916cbd85c3e289365e565b2626f20eed3e09c9278bb`. Les sources Core de référence épinglées sont intactes. Fichiers locaux dans `E:/Code/RimWorld`, HEAD `1732354c` inchangé : le profil géré interdit l'écriture de `.git`. Aucun commit, push ou déploiement revendiqué.
