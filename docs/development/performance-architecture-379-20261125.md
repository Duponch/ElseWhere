# Refontes architecturales de performance — 25 novembre 2026

Reprise demandée après [les optimisations à ×1, ×3 et ×6](performance-x1-x3-x6-20261125.md), dont les gains ne suffisent plus. Ce chantier doit déplacer les coûts dominants à leur source, au lieu de multiplier les caches de lecture sur des objets mutables. Le schéma 379, les règles du jeu, le déterminisme, les cadences demandées et la qualité visuelle ne sont pas des variables d'ajustement.

## Point de départ exact et budgets

- Référence locale gelée : `tmp/perf-20261125-next/candidate4-{worker,replay,sim}.mjs` (sources exactes du lot précédent), build navigateur `tmp/perf-20261125/client-final-next`. HEAD `1732354c` ne représente **pas** la totalité de cette référence locale.
- Les Forges : carte 250 × 250, 80 colons et 241 animaux au chargement. Trois nouveaux essais fermés de 240 macro-ticks après 20 de chauffe donnent suivant les séries environ 32–33 ms/tick pour le calcul seul. ×6 exige 36 ticks/s, donc 27,78 ms/tick **publication incluse**. Il n'est pas possible de tenir ce rythme en accélérant uniquement le dessin.
- Le budget nominal de 200 images/s est 5 ms/image (4,35 ms à 230). En Chrome WebGPU AMD RDNA-1, 1440 × 1000, le témoin contemporain fournit 128,6 / 110,4 / 118,6 RAF/s à ×1 / ×3 / ×6. Il faut à la fois réduire le coût récurrent des soumissions et déplacer les adoptions complètes qui bloquent ponctuellement le fil principal.
- Le profil de référence Worker à ×6 (18 s instrumentées, non utilisé pour comparer les débits) attribue environ 67,5 % à la simulation et 21,3 % à l'union des opérations de publication. Planification ~10 %, faune ~8,6 %, mouvement ~5,6 %, recherche de chemins ~4 %, flore/température ~4,7 %. Préparation des phases ~9,7 %. Les inclusions se recouvrent ; ne pas les additionner.
- Dans la référence navigateur, `renderScene` représente environ 37 % du profil à ×1 et 34 % à ×6 ; `renderObject` ~24 %, `updateMatrixWorld` ~6,3 % / 4,2 %, drain/adoption ~12,9 % / 10,1 %, présentation des phases ~2,3 % / 11,7 %. Les profils et les observations natives sont conservés sous `tmp/perf-20261125{,-next}/`.

## Essais d'architecture, sélection par mesures

### Tranches Worker successives

Répertoires d'identités et réservations à la source, colonnes de coûts de navigation, journal des ressources, colonnes de dépendances des acteurs. Les écritures réelles sont marquées à leurs producteurs ; les lectures publiques mutables conservent leur chemin strict. Aucun cache n'est un droit d'admission ni un raccourci de simulation.

| Candidat intermédiaire | Mesure sur Les Forges | Référence | Candidat |
|---|---|---:|---:|
| 5, simulation fermée | médiane de 3 paires (ms/macro-tick) | 33,098 | 32,603 |
| 5, publication à charge fixe | médiane CPU de 3 paires (ms) | 21 406 | 21 531 |
| 6, simulation fermée | médiane de 3 paires (ms/macro-tick) | 32,421 | 32,682 |
| 6, colonnes de phase isolées | médiane CPU de 2 paires (ms) | 21 695,5 sans colonnes | 21 585,5 avec colonnes |
| 7, Worker ×6 réel sous Node | médiane de 2 paires (ticks/s confirmés) | 21,3595 | 20,6055 |
| 7, grilles navigation isolées | médiane de 2 paires (ms/macro-tick) | 32,955 sans nouvelles grilles | 32,893 avec |

Les états complets des paires de simulation sont identiques (`ab7d71dda56c448bf450b59267fa300e036fd0c59a0d0f0a40d5784ced49a2a4`). Le rejeu Forges/mixed du candidat 5 est également exact sur les 688 messages du témoin. Les premiers gains de simulation sont trop faibles et non robustes ; le candidat 7 entier est refusé en l'état. La variante numérique du journal supprime les objets `Event` alloués pour chaque écriture, sans réduire son contrôle indépendant.

Isolations à charge fixe du candidat 7 (199 macro-ticks, 54 Fulls, 715 phases, 5 réponses ; on retire uniquement la brique mesurée, les compteurs de travail doivent rester identiques) :

| Brique en place / retirée | Paires | CPU avec / sans (ms) | Temps écoulé avec / sans (ms) | Décision |
|---|---:|---:|---:|---|
| Journal des ressources et adhérence du planning de vie | 2 | 22 093,5 / 21 906,5 | 12 524,5 / 13 111,5 | −4,5 % wall avec ; CPU +0,85 %. Retenu pour la publication sparse à la source. |
| Index de réservations par décision | 1 | 21 547 / 20 796 | 12 554 / 12 370 | Retiré : construction encore répétée par décision, CPU +3,6 % avec sur cette paire. |
| Répertoire des identités de piles | 1 | 21 063 / 21 938 | 12 490 / 12 613 | Retenu : −4,0 % CPU sur cette paire ; ne pas en déduire un gain global de 4 %. |

Les grilles navigation passent en outre de tableaux entiers à des pages de 256 cases allouées à la demande (245 entrées de répertoire sur 62 500 cases ; une page de coûts/flags pleine représente 2 304 octets). Les coûts, fractions, cas historiques, chemins de lecture publics et positions hors carte restent représentés exactement. Les mesures d'isolation de la variante dense étaient neutres, le bénéfice spécifique des pages est la réduction de la couverture d'allocation pour des objets épars.

Le candidat 8 (grilles paginées, retrait des trois expériences perdantes) revient à 32,6875 ms/tick contre 33,0115 ms (−0,98 %, deux paires simulation fermée, même SHA), et 21 031 ms CPU contre 21 219 à charge de publication fixe (−0,89 %, deux paires). Le Worker réel ×6 demeure légèrement en retrait : 20,739 contre 21,086 ticks/s (−1,65 %, deux paires, la seconde pratiquement à égalité). Ce constat interdit de transposer directement le gain à charge fixe en gain de cadence réelle. Deux isolations supplémentaires sous le **vrai Worker** (une paire chacune) : sans le journal ressources, 20,863 → 20,801 ticks/s (neutre) ; sans les nouvelles colonnes d'acteurs, 20,460 → 21,210 (+3,67 % au retrait). Les trois sources du prototype de colonnes d'acteurs sont donc restaurées exactement à c4. Une dérivation qui continue à relire tous les champs et crée des scratch rows à chaque observation n'est pas encore un journal de leurs changements réels ; son coût soutenu annule l'économie de copies.

### Quantification du travail effectivement supprimé

Sonde de compteurs sur le runtime du candidat 8, Les Forges à ×6, 20,2 s mesurées après chauffe (`perf-arch-v8-count-work`, **build instrumenté, débit exclu des comparaisons**). 409 macro-ticks sur les Fulls, 22 deltas, 85 564 écritures de champs ressources et 221 événements de membership. Sur 463 734 lignes potentiellement soumises aux comparaisons de base, 443 108 lignes sont encore visitées (21 deltas avec changements de membres ; un seul parcours sparse d'ordinaux), mais seules 81 274 entrent dans la comparaison de valeurs : **82,47 % de comparaisons candidates évitées**. Aucun repli pour rupture de journal. Le poste suivant est donc l'ordre/appartenance des ressources, encore reconstruit ou parcouru trop largement, et non l'optimisation des comparaisons de champs inchangés déjà évitées.

Dans cette même sonde, le répertoire des piles répond à **9 274 lookups fermés**, 330 append et 135 splice résidents. Il effectue encore 79 reconstructions (151 313 éléments copiés/indexés) lors de changements de source ; les affectations `piles = piles.filter(...)` des vrais producteurs ont alors été migrées. La même sonde instrumentée sur le **candidat 9 final** (20,1 s, 412 macro-ticks contre 409, comparable mais pas un rejeu à état final imposé) donne 9 626 lookups, 74 migrations de filtre, 346 append et 136 splice ; **8 reconstructions, 15 562 éléments**. C'est environ 90 % de reconstructions et de lignes réindexées en moins, alors même que les lookups sont plus nombreux. Côté ressources : 22 deltas, 463 731 lignes potentielles, 423 013 visites, 81 805 comparaisons réelles candidates (82,36 % évitées), deux deltas strictement sparse, zéro repli. Les chiffres de ces deux sondes décrivent les opérations, pas un débit FPS extrapolé (`perf-arch-final-count-work`).

### Deux expériences MAIN et rendu non retenues

1. Répertoire de matrices à mise à jour structurelle, observation des nœuds de scène pour éviter les parcours des sous-arbres fixes. Les contrats unitaires sont verts, mais les lectures/observations supplémentaires des nœuds actifs coûtent plus cher au navigateur. Une variante limitée à `LandscapeBatch.refresh` ne serait pas correcte : les arrivées/remplacements de chunks différés ont aussi lieu hors de ce point. Retour exact au passage natif précédent (une passe monde avant le dessin et ses ombres), pas de skip fondé sur une hypothèse de stabilité.
2. Copies privées de feuilles ressources natives pour mémoriser la preuve négative de forme propre, tout en relisant le prototype et les champs hérités. Une expérience isolée avec de vrais événements Worker Chrome est correcte ; dans le jeu, le prix des nouvelles copies et des contrôles d'array dépasse l'économie. Retour octet par octet aux deux sources MAIN antérieures, certifié contre `candidate4-replay.mjs.map`.

Une paire native contemporaine du candidat 7 (20 s mesurées après 5 s de chauffe à chaque vitesse, même sauvegarde, commandes et instrumentation) a donné :

| Indicateur | ×1 témoin → essai | ×3 témoin → essai | ×6 témoin → essai |
|---|---:|---:|---:|
| RAF/s | 128,6 → 118,0 | 110,4 → 98,3 | 118,6 → 111,9 |
| Adoption résidentielle moyenne/Full (ms) | 52,4 → 59,8 | 64,3 → 81,1 | 74,7 → 88,3 |
| CPU dessin médian/image (ms, deux anciens passages comparables) | 2,7–2,8 → 3,1 | 2,9 → 3,3 | 3,1 → 3,5 |
| Intervalles >100 ms | 2 → 3 | 6 → 7 | 5 → 18 |

La régression est constatée sur les trois vitesses : ne pas conserver ces deux expériences en production. Rapports `tmp/perf-20261125/client-arch-{start,v7}.json`, expériences archivées sous `tmp/main-projection-379/` et `tmp/perf-20261125-next/rejected-*`. Les mesures sont celles de vrais appels Chrome WebGPU (`amd`, `rdna-1`), jamais une estimation GPU à partir du seul nombre d'instances. Aucun réglage visuel n'a été abaissé.

## Base architecturale retenue après élimination

- **Écritures des ressources** (`src/sim/resource-mutation-journal.ts`, `src/bridge/terrain-journal-encoder.ts`). Anneau borné par versions, IDs et flags en colonnes numériques, descripteurs seulement pour les changements structurels. Chaque lecteur possède son propre curseur opaque. Marquage au moment où la croissance, l'âge, le blight, la température, la récolte, les dégâts, les déplacements de plantes ou les créations/suppressions sont effectivement écrits. Le vrai encodeur Worker compare les seuls ordinaux/IDs affectés quand les preuves sont complètes ; le codec public et le repli restent exhaustifs. Un changement d'appartenance certifié est utilisé aussi par le planning de vie des plantes. Les commandes/transitions spéculatives invalident explicitement les témoins. `VERIFY_RESOURCE_JOURNAL` vérifie les paquets contre un encodeur indépendant complet ; une écriture non marquée est une faute, pas une tolérance.
- **Piles physiques** (`src/sim/pile-identity-directory.ts`). Répertoire d'identités sous propriétaire de simulation fermé ; les appels de lookup stricts ciblés n'ont plus à rechercher une pile dans toute la collection. Append/splice natifs alimentent le répertoire pour les seuls IDs touchés et gardent les retours, l'ordre et les règles de doublons. Dans le candidat 9, les filtres natifs des producteurs audités transmettent également le répertoire à la nouvelle identité d'array, en collectant les seuls retraits lors de l'unique passe du prédicat. Un ancien alias perd son témoin et doit reconstruire ; révision, propriétaire, espèces/méthodes ambiguës ou transaction inconnue imposent le repli. En mode de contrôle, références, IDs et ordre sont relus. Hors propriétaire fermé, la recherche reste ordinaire. Les indexes spatiaux/quantités précédents restent distincts : une identité valide ne certifie ni accès, ni propriété, ni quantité.
- **Navigation paginée** : géométrie et ancres demeurent dans l'ordre source. Coûts de déplacement et flags animaux partagent les pages attachées à la géométrie résidente, et ne réallouent pas une grille complète à chaque capture. Les structures et obstacles réels restent consultés pour les états mutables. Aucun raccourci de recherche ni budget de calcul modifié.
- **Piles graphiques résidentes** (`src/render/BoxBatches.ts`, `BoxMesh.ts`). Transmission des plages de composants modifiées (matrices, couleurs, atlas, contours, variantes), fusionnée avec toutes les écritures en attente d'upload, y compris lors d'un culling. Le résultat exact du fold ordonné des sphères est gardé par préfixe : déplacer le slot 90 d'un lot de 100 relit les 10 dernières matrices, pas les 100 ; 16 composantes de matrice demandées à l'upload pour ce slot. Le test reproduit un upload différé, les aperçus, l'agrandissement et la préparation des ombres, et compare le contenu des buffers octet par octet au writer historique. Repli intégral si le producteur/propriété/capacité n'est plus certifié ; aucun changement du nombre d'objets ou de la qualité graphique.

Les prototypes d'index de réservations par décision, de colonnes dérivées d'acteurs et les deux prototypes MAIN/matrices sont archivés hors production. Le prochain registre de réservations doit évoluer aux commits et transitions de tâches/files, et non être reconstruit à chaque planification d'un colon. Le prochain journal d'acteurs doit relever les changements à leurs véritables producteurs, et non revalider puis réconcilier tous les champs.

## Validation de conservation (candidat 9)

Le runtime final est gelé dans `tmp/perf-20261125-next/candidate9-{worker,replay,sim}.mjs` : 1 703 sources Worker correspondent au code de travail, 126 sources modifiées dans ce lot (dont les deux nouveaux modules de journal/répertoire, de nombreuses migrations mécaniques des vrais producteurs). Les trois sources Core/natives de référence épinglées ne sont pas modifiées.

Les trois rejeux comparent **chaque message** et chaque sauvegarde au gel initial c4. Tous exécutés avec `VERIFY_TERRAIN_CACHES=1 VERIFY_RESOURCE_JOURNAL=1 VERIFY_PILE_INDEX=1 VERIFY_HUMAN_CARRIERS=1 VERIFY_NATURAL=1 VERIFY_ADOPTION=1`.

| Rejeu final | Messages | Fulls réels adoptés | Phases réelles adoptées | SHA-256 sauvegarde (préfixe) |
|---|---:|---:|---:|---|
| Forges mixed | 688 | 41 | 518 | `1d50650eee80d54d` |
| Forges slow | 886 | 66 | 691 | `e4694d23e3be426d` |
| Éclaircies mixed | 676 | 41 | 506 | `a50e3fc5d6e39894` |
| Total | **2 250** | **148** | **1 715** | **Identiques** |

Les trois comparaisons `publication-replay-compare.mjs` sortent 0 ; rapports `tmp/perf-20261125-next/arch-final-{forges,forges-slow,eclaircies}.json`. Le lot ciblé préliminaire de 29 fichiers avait 155 réussites / 15 échecs déjà recensés par nom. Le contrôle du **code final**, après retrait des expériences et migration des filtres, a 77 réussites sur 80 cas dans 14 fichiers ; les trois échecs de `food-crops.test.ts` (registres de carte historiques) sont connus, et tous les nouveaux contrats gardés sont verts, notamment les 13 contrats du répertoire, les 7 du journal, les 3 de navigation et les 4 de piles graphiques. Rapports `arch-targeted.json` et `arch-final-contracts.json` ; le registre `tmp/perf/known-failures.json` n'a pas été modifié pour les masquer. Les deux longues campagnes schéma 379 déjà acquises n'ont pas été relancées ; pas de changement de règles ni de données de sauvegarde dans ce lot.

Le typage et build Pages complet final passent en 28,944 s (`perf-arch-final-build-pages`).

## Mesures du candidat final

Runtime Worker réel sous Node, clone structuré des messages, deux paires alternées sur Les Forges à ×6, fenêtres de 25 s après 5 s de chauffe, mêmes données et même cadence demandée :

| Mesure médiane | Gel initial c4 | Final c9 | Écart |
|---|---:|---:|---:|
| Ticks/s confirmés (phases comprises) | 21,4685 | 21,7085 | +1,12 % |
| Rythme de 36/s tenu | 59,635 % | 60,30 % | +0,665 point |
| Retard p50 (ms) | 394,65 | 397,05 | +0,61 % |
| Retard p95 (ms) | 572,15 | 558,90 | −2,32 % |
| Retard p99 (ms) | 668,45 | 606,95 | −9,20 % |
| Clonage d'un Full (ms) | 9,50 | 9,64 | +1,47 % |

Les deux paires sont favorables pour la cadence confirmée (21,419 → 21,762 et 21,518 → 21,655). Le gain effectif à ×6 sur cette charge est modeste, mais le candidat régressif de départ a été écarté. Rapport `tmp/perf-20261125-next/ab-worker-forges-candidate4-candidate9-2-x6-25.json`. **×6 sur Les Forges n'est toujours pas tenu** ; ni le résultat de récupération du répertoire, ni la diminution du nombre de comparaisons ne peuvent être convertis directement en ticks/s.

Les Éclaircies à ×6, fenêtre de 20 s après 5 s de chauffe : 35,784 ticks/s confirmés (99,4 % de 36), CPU process 65,7 %, retard p95 37,3 ms. Maintien pratiquement complet du rythme sur cette charge, pas de dépassement durable revendiqué (`perf-arch-final-eclaircies-x6`).

### Client complet, caméra fixe

Deux passages du candidat final, même build de référence déjà mesuré à trois reprises, même Les Forges sous Chrome WebGPU AMD RDNA-1, viewport 1440 × 1000, fenêtres de 20 s après 5 s de chauffe à chaque vitesse. Référence contemporaine `client-arch-start.json` (les deux autres passages c4 donnent 128,6/127,8, 111,0/109,3 et 118,7/117,6 RAF/s, dans un intervalle similaire). **Aucune hausse franche des FPS n'est démontrée par ce lot.**

| Mesure | ×1 témoin → final 1 / final 2 | ×3 témoin → final 1 / final 2 | ×6 témoin → final 1 / final 2 |
|---|---:|---:|---:|
| RAF/s | 128,6 → 124,6 / 124,3 | 110,4 → 111,8 / 107,7 | 118,6 → 112,9 / 117,7 |
| Adoption moyenne/Full (ms) | 52,4 → 52,5 / 53,1 | 64,3 → 62,2 / 65,8 | 74,7 → 95,2 / 75,9 |
| Application graphique/Full (ms) | 23,4 → 23,1 / 23,3 | 34,2 → 34,2 / 34,6 | 38,8 → 38,7 / 39,8 |
| p99 intervalle de RAF (ms) | 60 → 60 / 60 | 78 → 72 / 72,1 | 84 → 90 / 84,1 |
| Maximum intervalle (ms) | 132 → 114 / 132,1 | 330 → 156 / 198 | 144 → 600 / 138 |
| Fulls/s effectivement admis | 2,0 → 2,3 / 2,3 | 1,8 → 2,0 / 1,9 | 1,2 → 1,2 / 1,2 |
| Ticks/s publiés | 6,0 → 6,0 / 6,0 | 18,0 → 18,0 / 18,0 | 27,0 → 26,7 / 27,5 |

Le temps CPU médian de dessin de la première paire reste 2,7 / 2,9 / 3,0 ms aux trois vitesses, comme le témoin. L'adoption médiane de la première paire à ×6 est 74,4 ms contre 75,8 ms ; un seul appel d'adoption de 580,6 ms gonfle la moyenne (et le maximum RAF de 600 ms), non reproduit dans le second passage. Les deux mesures et le pic restent comptabilisés sans écrêtage. À ×1, davantage de Fulls sont effectivement publiés alors que leur coût unitaire reste similaire : cela augmente le coût Main par seconde même avec le rythme de simulation nominal inchangé. Cette tranche **ne résout pas** ce mécanisme. Au § précédent le gain Worker isolé est établi, mais il n'est pas convertible en gain de fluidité native. Zéro erreur JS sur les deux essais. Rapports `tmp/perf-20261125/client-arch-{final,final-repeat}.json`.

### Caméra réellement en rotation

`scripts/perf-client-publication.mjs` possède désormais le mode facultatif `PERF_ORBIT=1` : véritables mouvements de souris et glissement bouton droit, position d'entrée déterminée par le temps écoulé, 12 s de fenêtre sur une seule vitesse après 5 s de chauffe. Le banc vérifie que la caméra tourne effectivement, via les azimuts du vrai `captureGraphicsView`. Les deux essais à ×1 sur Les Forges ont une amplitude réelle équivalente (2,6024 rad témoin, 2,5964 rad final), Chrome WebGPU AMD RDNA-1, sans erreur JS.

| Mesure en rotation | Témoin c4 | Final c9 |
|---|---:|---:|
| RAF/s | 125,9 | 120,0 |
| p95 / p99 intervalle (ms) | 12 / 60 | 23,9 / 60 |
| Adoption moyenne par Full (ms) | 54,2 | 51,0 |
| Application graphique par Full (ms) | 26,7 | 23,8 |
| Fulls/s | 1,9 | 2,5 |
| Ticks/s publiés | 6,0 | 6,0 |

Cette paire ne démontre **aucun gain de fluidité en rotation** : le coût unitaire de la publication/application diminue, mais le nombre de Fulls effectivement reçus augmente sur cette fenêtre. L'objectif 200–230 FPS en rotation reste ouvert ; ne pas réduire artificiellement les publications/phasages ou le visuel pour l'atteindre. Rapports `tmp/perf-20261125/client-arch-orbit-{start,final}.json`.

### Qualification intégrale de présentation

Le contrôle de présentation complet passe en **165,026 s**, Chrome WebGPU AMD RDNA-1 ; même oracle, deux actions réelles de 45 s, 44 changements de vitesse. Le premier build de la sonde a échoué parce que le chemin de sortie de l'instrumentation avait été redirigé vers un dossier de tests ; seule cette configuration de pilote a été corrigée, pas le code ni les assertions du jeu.

| Critère | Minage | Coupe d'arbres |
|---|---:|---:|
| Soumissions appariées | 7 377 | 7 419 |
| RAF sans nouvelle soumission | 22 | 0 |
| Travaux initiaux → restants | 186 → 162 | 262 → 238 |
| Changements de vitesse | 22 | 22 |
| Délai maximal sur image réellement soumise | 24,9 ms | 34,9 ms |
| Alarmes sur RAF brut / soumissions réelles | 7 / 3 | 2 / 2 |
| Départs de contact continus prouvés | 3 | 2 |
| Sauts inexpliqués | 0 | 0 |
| Occupation de roche / roche active | 0 / 0 | 0 / 0 |
| Starvation, stall de soumission, erreur JS | 0 / 0 / 0 | 0 / 0 / 0 |
| `submittedQualification.qualified` | **true** | **true** |

Total 14 796 soumissions appariées, aucune non appariée. Rapport `tmp/test-runs/perf-arch-final-presentation-2026-11-25T16-12-23.096Z-23232/artifacts/harvest-sync-verification.json`.

**Bilan de la première tranche :** base des répertoires et journaux réellement raccordée, travail de comparaison et de reconstruction massivement réduit, petit gain de débit Worker et meilleur tail p99 à ×6, aucun nouvel échec de conservation ou de présentation. En revanche, le FPS moyen du client fixe/rotation n'est pas amélioré globalement ; cette tranche ne constitue pas une qualification de performance supérieure à toutes les vitesses. Les coûts de reconstruction des sections MAIN et des couplages entre les Fulls et la boucle d'image justifient maintenant une refonte de leur propriété et de leur préparation, pas une nouvelle série de petits caches. Les quatre architectures expérimentales qui pénalisaient la charge réelle ont été retirées et archivées, pas comptées comme des gains. Le schéma 379 et le jeu restent inchangés.

La sauvegarde utilisateur `bugs/Elsewhere-2026-11-24T22-53-35-925Z.json` conserve le SHA-256 `fb3291817cf6f5361eba2916cbd85c3e289365e565b2626f20eed3e09c9278bb`. Sources épinglées intactes, `git diff --check` sans erreur. Fichiers locaux : `.git` est toujours protégé en lecture seule par le profil géré, HEAD `1732354c` inchangé. Aucun commit, push ou déploiement revendiqué.

## Prochaine transformation à fort levier

À poursuivre par étapes dont chacune doit être rejouable et comparée à son prédécesseur exact :

- **Simulation** : propriétaires stables pour les composants chauds (déplacement, contacts, besoins et réservations). Colonnes numériques par slot/identité avec captures de transition aux vrais points d'écriture, au lieu de reconstruire une Vue Monde pour chaque décision. Transférer progressivement les lectures les plus coûteuses ; les mutations et commits réels restent dans l'ordre actuel. Les édges/memberships publiques et historiques gardent un oracle exhaustif ; une conversion entière du `World` ou des calculs à précision réduite n'est pas validée simplement par les FPS.
- **Publication / fil principal** : représentation privée versionnée, indépendante des anciens `World` exposés et mutables. Il faut produire les preuves de sections au moment de leur construction, et éviter de copier/rescanner les dizaines de milliers de feuilles au moment de chaque Full. Prototypage des sections déjà isolé ; la tentative de gel de feuilles après assemblage a montré que ce n'est pas le bon point d'intégration. L'adoption doit rester atomique et refuser un prédécesseur incorrect, y compris après pause/reprise, changement d'époque et commandes.
- **Rendu** : préparer les descriptions de patches lourds (piles/ressources/géométrie) hors du chemin image, conserver les buffers et les plages modifiées, puis appliquer sur les vrais producteurs graphiques à partir d'un prédécesseur prouvé. Pour réduire fortement `renderObject`, travailler sur les groupes/commandes de rendu résidents avec leurs invalidations réelles, et sur les instances/poses GPU, sans désactiver le culling ou changer le visuel. La seule résidence d'un buffer ne prouve pas la réduction des soumissions. Une extension de l'actuel compilateur statique doit être mesurée aussi caméra en rotation et avec ombres.
- **Parallélisme / WASM** : confier uniquement des opérations pures indépendantes (préparation de champs, calculs de chemin avec captures d'entrées immuables et commit déterministe, prédictions graphiques) à des workers complémentaires ou à un noyau numérique si les mesures le justifient. Pas de déplacement arbitraire des décisions de travail, de recherche ou de RNG entre ticks pour gagner du débit.

Ne pas déclarer achevée cette refonte sur la base des premières briques : la représentation MAIN privée, la suppression des lourdes tâches sur la boucle d'image et le débit ×6 des Forges restent des cibles distinctes.
