# Performance : transmission des acteurs et cadence des grandes colonies — 25 novembre

Demande humaine : terminer les deux chantiers restants après le lot [performance du 25 novembre](performance-20261125.md). Base de cette comparaison : `candidate3` (schéma 379, copie locale complète qualifiée), **pas le HEAD 377**. Le schéma, les règles, les tirages, les cadences d'observation, la fréquence des Full/phase et les graphismes sont inchangés. Le critère convenu du chantier 4 est 18 macro-ticks/s sur Les Forges à ×3 ; ×6 est également mesuré, sans en promettre la tenue sur toute colonie et tout matériel.

## Transmission des acteurs

La nouvelle section résidente optionnelle `auxiliary.actors` transmet les changements de fiches complètes des humains et des animaux. Au checkpoint ou changement de liste de champs, la fiche reste littérale. Sinon les nombres passent dans une colonne Float64 `(identité, ordinal du champ, valeur)` ; les autres changements transportent leur sous-arbre littéral, les chemins raccourcis un suffixe prouvé égal. L'ordre des fiches et des clés, les omissions et `undefined` propre, les nombres exacts dont `-0`, les ajouts et retraits restent identiques. Aucune quantification ni estimation physique. Le format public, les sauvegardes et les messages de phase sont inchangés.

- Capture SIM détachée, sans retenir un témoignage mutable. Changement de forme explicite, comparaison des vraies valeurs à chaque publication ; pas d'hypothèse sur une liste figée de champs métier. En cas de représentation non prise en charge, voie littérale.
- MAIN reconstruit avant toute admission de World ; gardes des champs, nombres, indices, IDs, ordre, marqueurs et prédécesseur. Valeurs acceptées profondément gelées. Les sous-arbres retenus portent leurs faits exacts de profondeur et de nombre de nœuds ; le budget complet de chaque liste continue à compter chaque occurrence. Les nouvelles lignes produites à partir d'un ancien enregistrement contrôlé n'ont besoin de vérifier que leurs changements, y compris les changements de profondeur. Un tableau simplement gelé par un appelant n'est pas un témoignage valide. L'enregistrement des acteurs et les autres sections sont validés et committés ensemble ; un refus, une exception, un paquet manquant ou une carte remplacée ne peuvent avancer le prédécesseur.
- `core-phase-owner-297` réutilise les listes validées et reconstruit uniquement les entrées de scène effectivement modifiées par les phases ; lignes physiques et poses se combinent en une passe. La copie rapide des champs d'acteurs ne valide plus deux fois le sac de descripteurs créé en interne. Les trois fichiers de référence figés par empreinte n'ont pas changé.
- L'encodeur complet réutilise les listes de clés de ses copies de structures, évite de reconstruire un objet pour comparer l'âge d'une plante ou l'horloge de pourriture, partage la capture privée de l'apparence végétale et simplifie la comparaison ordonnée des saletés.
- Le vrai client a révélé un coût beaucoup plus grand que le seul transport : les nouveaux contrôles construction (379) et ordres/identité (378) répétaient des dizaines de descripteurs absents sur chaque ressource, pile, bâtiment et autre feuille de la projection complète, y compris lors de sa reconstruction. `resident-owner-records-379` observe uniquement les clones natifs du Worker privé, avant son dispatch applicatif, et les vrais enregistrements créés localement par spread. Les deux validateurs ont une variante de parcours qui reconnaît seulement une **feuille ordinaire prouvée**, avec les clés propres et héritées pertinentes intégralement absentes et la chaîne de prototypes actuelle contrôlée. Un champ pertinent présent, un accesseur, un héritage différent, un Proxy ou une donnée sans preuve garde le parcours strict original. Aucune preuve d'admission native, de gameplay, de clé ou de valeur n'est conférée par ce témoin. Les validations métier, la fréquence du contrôle profond existant et les lecteurs publics/sauvegardes restent inchangés. Les reconstructions compactes de croissance/âge/pourriture créent leurs propres enregistrements ordinaires ; elles ne certifient pas des enfants arbitraires.

Le banc `scripts/perf-actor-columns.ts` lit 41 véritables publications complètes des Forges, capturées par `ACTOR_FRAMES` dans `scripts/publication-replay-record.ts`. Il sépare la préparation SIM, le clonage (représentation Node, pas les délais natifs Chromium) et la reconstruction gelée MAIN. Il compare chaque valeur reconstruite au paquet littéral. Aucun FPS déduit de ce banc.

## Calculs de la simulation

- Les grilles de blocage et de coûts utilisent le journal borné des changements de cases dans une invocation fermée. Un nouveau propriétaire ou une lecture publique valide les références entières ; une rupture de journal ou invalidation globale déclenche la capture complète. Le vrai Worker, propriétaire exclusif de ses mondes désérialisés, peut retenir cette preuve entre deux tâches de l'horloge ; ce mode n'est pas activé dans les appels publics du runtime de tests. Le coût maximum, les retraits de marais, ponts, sols, neige, ordre de navigation et les anciens résultats restent conservés.
- Le cache thermique revalide seulement ses dépendances observées touchées par une arête du journal ; une modification de classification thermique recalcule la topologie, les anciennes dispositions restent intactes. Les écritures de cases, les propriétaires, le toit et les structures restent contrôlés. La vérification des index peut refaire la comparaison exhaustive.
- Le stockage spatial des plantes sauvages à l'intérieur des blocs de 12 × 12 devient numérique ; mêmes composantes, ordre de découverte, contacts et sommes flottantes. La demande/potentiel électrique est capturée une fois dans la passe, les commutations, EMP, batteries, délestages, combustibles et RNG restent lus dans leur ordre réel.
- Une passe de planification de construction capture au besoin les matières livrées et l'occupation des cellules, une passe de logistique réutilise l'ordre déjà calculé des mêmes ensembles de sources. Pas de cache global de ces faits mutables.
- Les portages et soins animaux consultent les candidats humains du début de leur passe, avec les phases/annulations/positions réelles et les groupes toujours lus en direct. Pour les humains, la liste de porteurs potentiels vit uniquement dans le scope de simulation ; les créateurs d'un vrai service marquent la liste, les changements de roster provoquent sa reconstruction. Les lecteurs publics restent exhaustifs. `VERIFY_HUMAN_CARRIERS=1` compare chacune de ces réponses à l'oracle complet.

## Mesures et qualification finales

Les mesures sont successives, machine partagée, comparaisons alternées. Les temps du Worker sous Node ne mesurent pas le GPU ni les FPS. Voir les résultats finaux ci-dessous.

### Représentation des fiches

Huit paires alternées sur les 41 mêmes Fulls (lecture et validation indépendantes, `candidate8-actors`) :

| Coût moyen par Full, fiches humaines/animales seules | Littéral | Colonnes |
|---|---:|---:|
| Octets, cumul 41 Fulls (sérialisation Node) | 15 395 135 | 4 488 799 |
| Préparation SIM | ≈ 0 ms | 4,569 ms |
| Clonage | 6,398 ms | 1,447 ms |
| Reconstruction/gel MAIN | 6,136 ms | 5,391 ms |
| Total mesuré | 12,638 ms | 11,426 ms |

Les octets de cette section baissent de 70,84 %, le clonage de 77,39 %, la reconstruction de 12,13 % et le temps cumulé de 9,59 %. Le calcul supplémentaire du producteur est compté : ne pas attribuer au Worker tout le gain de clonage. Les 41 Fulls reconstruits sont strictement égaux. `tmp/validation-runs/perf379-actor-columns-final-*` et `tmp/perf-20261125/candidate4-actor-frames.bin`.

### Grande colonie : mesures alternées

Sur Les Forges (250², 80 humains, 241 animaux), trois paires de 240 macro-ticks après 20 d'échauffement, SIM seule publique (`candidate3` → `candidate9`) : **37,377 → 35,925 ms**, −3,89 %. Trois paires favorables pour le coût moyen. La frontière p95 est légèrement défavorable, 64,660 → 67,020 ms (+3,65 %) ; une table thermique provisoire à entrées Map alourdissait davantage les recaptures, elle a été remplacée par un tableau de slots dense. État complet identique à chaque passage, SHA-256 `ab7d71dda56c448bf450b59267fa300e036fd0c59a0d0f0a40d5784ced49a2a4`. Ne pas additionner ces résultats à ceux du lot précédent mesuré à un autre moment. `finish-ab-sim-forges-candidate3-candidate9-3-3-30.json`.

Charge fixe du vrai runtime Worker, 199 macro-ticks, mêmes 54 deltas, 715 frontières et 5 réponses mesurées, trois paires (`candidate3` → `candidate9`) : CPU **22 593 → 21 563 ms** (−4,56 %), temps écoulé 13 130 → 12 694 ms (−3,32 %), les trois paires favorables. `finish-ab-replay-forges-candidate3-candidate9-3-3-30.json`.

Vrai runtime Worker sous Node, ×3, 30 s après 5 s d'échauffement, trois paires alternées (`candidate3` → `candidate5`, avant les derniers allègements de la reconstruction et de la topologie) :

| Mesure | Avant | Après |
|---|---:|---:|
| Rythme demandé | 98,0 % | 99,9 % |
| Retard de tâche p50 | 34,6 ms | 26,8 ms |
| Retard de tâche p95 | 201,4 ms | 161,2 ms |
| Retard de tâche p99 | 276,4 ms | 218,9 ms |
| Clonage d'un Full | 11,94 ms | 8,13 ms |

Passages : 98,0 / 98,9 / 97,4 % avant, 99,6 / 100 / 99,9 % après. Les trois sont favorables en rythme, retards p50/p95/p99 et coût de clonage. La métrique historique utilise le tick des Fulls ; le banc final conserve aussi le vrai front physique confirmé des phases. Aucun retard mesuré ici n'est assimilé à la latence du clic ni à une image GPU. `finish-ab-worker-forges-candidate3-candidate5-3-3-30.json`.

### Mesure du vrai client

La boucle native HTTP a enfin fonctionné en lançant le preview isolé et le banc dans le même arbre de processus, sans utiliser le serveur 5173. Build témoin à partir des sources gelées `candidate3-worker.mjs.map` et des frontières MAIN exactes avant la tranche ; même distribution, même sauvegarde, même instrumentation minimaliste, même viewport 1440 × 1000. Chromium sans écran, 20 s après 5 s à ×3. Un passage par variante, preuve exploratoire (pas une promesse universelle de FPS). Aucun message d'erreur JS dans les trois passages. **Correction de la sonde de backend :** `SceneRenderCore.backend` étant désormais une chaîne descriptive, son ancienne lecture comme objet Three ajoutait à tort l'étiquette « webgl ». Ces premiers rapports ne certifient donc pas le backend GPU. Le banc a été corrigé pour lire le vrai backend et le Device ; une nouvelle paire Chrome le contrôle ci-après.

| Les Forges, vrai client Chromium (backend non certifié) | Témoin | Colonnes + SIM | + contrôles des feuilles ordinaires |
|---|---:|---:|---:|
| Full, message + admission + application | 200,1 ms | 187,5 ms | **117,7 ms** |
| Admission | 159,2 ms | 148,4 ms | **79,7 ms** |
| Adoption du lecteur | 157,9 ms | 147,0 ms | **78,4 ms** |
| Désérialisation de message | 4,9 ms | 3,2 ms | 1,6 ms |
| Images/s | 70,8 | 79,3 | **101,9** |
| p95 image | 60 ms | 54 ms | 24 ms |
| p99 image | 174 ms | 162 ms | 90 ms |
| Images > 100 ms | 40 | 39 | 8 |
| Tâches longues cumulées | 8,576 s | 7,773 s | 4,899 s |
| Ticks/s | 18,1 | 18,0 | 18,1 |

L'économie de traversées strictement inutiles explique le gain principal de fluidité sur ce cas (adoption −50,3 %, FPS du banc +43,9 %). L'application aux couches graphiques est stable (35,4 / 35,6 / 35,9 ms), la fréquence des Fulls est la même (1,9/s), les réglages graphiques et la vitesse ne sont pas diminués. Rapports `tmp/perf-20261125/client-{baseline1,final1,final2}.json`, script `scripts/perf-client-publication-summary.mjs`.

**Confirmation matérielle Chrome :** backend Three `WebGPU`, adaptateur AMD `rdna-1` réellement lu des deux côtés, 20 s ×3 après échauffement, version finale puis témoin dans l'ordre des passages. Aucun des deux clients ne rapporte d'erreur JS.

| Les Forges, WebGPU AMD | Témoin | Final |
|---|---:|---:|
| Full, message + admission + application | 188,3 ms | **123,9 ms** |
| Adoption du lecteur | 146,7 ms | **81,0 ms** |
| Désérialisation | 4,7 ms | 1,6 ms |
| Images RAF/s | 77,4 | **100,6** |
| Appels de rendu au temps mesurable, par seconde | 76,7 | 99,9 |
| p95 image | 59,9 ms | 30,0 ms |
| p99 image | 161,9 ms | 95,9 ms |
| Images > 100 ms | 40 | 11 |
| Tâches longues cumulées | 8,439 s | 4,769 s |
| Ticks/s | 18,2 | 18,1 |

Gain final sur cette paire matérielle : **+30,0 % de RAF/s**, adoption −44,8 %, coût total du Full −34,2 %, p95 image −49,9 %. Le compte des RAF n'est pas une sonde de rafraîchissement physique de l'écran ; les appels de rendu dont le coût dépasse la résolution du chrono confirment presque le même rythme. Une autre paire Chrome (avant correction du libellé de backend) donne 79,3 → 101,4 RAF/s, 145,7 → 80,9 ms d'adoption. Rapports `client-{baseline,final}-native-confirmed.json` et `client-{baseline,final}-webgpu.json` ; conserver la distinction des deux mesures de backend.

### Cadence prolongée et stress

Dernier runtime complet `candidate11`, mesure non instrumentée, après 5 s d'échauffement :

| Partie et vitesse | Durée | Ticks/s confirmés | Rythme demandé tenu |
|---|---:|---:|---:|
| Les Forges ×3 | 60 s | **17,939 / 18** | **99,66 %** |
| Les Forges ×6 | 30,3 s | 20,178 / 36 | 56,05 % |
| Les Éclaircies ×6 | 25 s | **35,929 / 36** | **99,80 %** |

Les Forges ×3 : 10 770 Core-ticks confirmés, retard de tâche p50 27,5 ms, p95 166,7 ms, p99 233 ms, clonage moyen d'un Full 8,27 ms, d'une phase 0,99 ms. La cadence historique estimée par les seules publications complètes est 98,7 %, car celles-ci ne partent pas à chaque macro-tick ; le front confirmé tient la cible à moins de 0,34 %. Le critère de cadence du chantier 4 est atteint en pratique sur cette partie de référence, également mesurée à 18,1 ticks/s dans le vrai client WebGPU. Le test de stress à ×6 indique une limite réelle sur une carte exceptionnellement chargée : il ne faut ni réduire la précision des règles, ni promettre arbitrairement 36 ticks/s sur toute colonie. Rapports `tmp/validation-runs/perf379-closure-worker-x*`.

### Rejeu et validation des index

Sur le dernier runtime, les trois rejeux du vrai Worker (`VERIFY_TERRAIN_CACHES=1 VERIFY_PILE_INDEX=1 VERIFY_HUMAN_CARRIERS=1 VERIFY_NATURAL=1 VERIFY_ADOPTION=1`) réussissent. L'assembleur MAIN et le propriétaire de phases adoptent les Fulls et phases avec validation stricte, y compris la comparaison du contenu des fiches avec le reconstructeur indépendant.

| Partie et salves | Messages | Fulls adoptés | Phases adoptées |
|---|---:|---:|---:|
| Les Forges mixed | 688 | 41 | 518 |
| Les Forges slow | 886 | 66 | 691 |
| Les Éclaircies mixed | 676 | 41 | 506 |
| Total | **2 250** | **148** | **1 715** |

Même ordre, même contenu canonique (y compris les nombres, les champs propres et les liens de référence) et mêmes sauvegardes finales qu'avant la tranche. Empreintes complètes des sauvegardes : `1d50650eee80d54d149abee9898093f625e12f5356afcecde00ce45358d7636d`, `e4694d23e3be426d622be605d5c03e7577367ad8a24979fb81eb8a44988e8174`, `a50e3fc5d6e3989471cb1084ceae0a96adc77629014fc12d9326a0ee552eebd3`. Rapports `replay-{forges,forges-slow,eclaircies}-closure.json`, comparés à `replay-*-after.json` du lot précédent.

### Part du Worker et limite de la refonte

Les profils du runtime réel à ×3 (20 s, après 5 s de chauffe, un passage de chaque version, profileur à 250 μs) montrent 19,63 % → 20,92 % du temps échantillonné hors attente dans la publication (union des piles `publishDuePhysical297`, `publishCapturedTick`, `observeMacroActors297`). Il joue 326 → 350 macro-ticks dans cette fenêtre instrumentée. En rapportant le temps échantillonné au nombre de macro-ticks observés, publication 12,17 → 11,96 ms par macro-tick ; le clonage d'un Full baisse de 12,83 → 9,42 ms. Il ne faut pas présenter cette hausse du débit comme une baisse de la **part relative** de la publication.

Pour isoler le travail et ne pas comparer deux nombres de messages différents, `REPLAY_CPU_PROFILE` dans le banc de rejeu échantillonne exactement les 199 macro-ticks et les mêmes 54 deltas, 715 phases et 5 réponses après le chargement. Trois versions gelées, un profil chacune, même scénario, horloge virtuelle, même compteur non récursif des fonctions superposées :

| Charge fixe, profillée | Départ du chantier performance | Avant cette tranche | Final |
|---|---:|---:|---:|
| Temps CPU process | 24 749 ms | 24 265 ms | **23 188 ms** |
| Temps écoulé du banc | 15 244 ms | 14 753 ms | **13 951 ms** |
| Échantillons publication | 5 708,6 ms | 5 724,0 ms | **5 552,4 ms** |
| Part publication | 36,26 % | 37,86 % | 38,48 % |
| Échantillons clonage | 1 109,3 ms | 1 065,9 ms | **787,5 ms** |

Le coût absolu de l'union publication recule de 2,74 % depuis le départ ; le clonage recule de 29,01 %. La simulation elle-même recule davantage, et la publication représente donc une plus grande fraction du temps restant. Le critère historique du chantier 2 « part Worker nettement baissée » n'est **pas confirmé par ce lot seul** ; le bénéfice principal de la refonte est la latence d'admission MAIN (-44,8 %) et la cadence des grandes colonies, sans retirer de paquets. Le journal exhaustif des écritures de toutes les ressources/structures et une nouvelle refonte du protocole de phases sont des changements structurels beaucoup plus invasifs ; ne pas les présenter comme déjà faits. Profils `closure-worker-{baseline,final}-x3.cpuprofile`, `fixed-publication-{baseline,candidate3,candidate11}.cpuprofile`.

Dernier essai écarté (`candidate12`) : éviter quelques comparaisons/copies de feuilles de phase déjà capturées, mémoriser les clés de copies profondes des piles, voie immédiate pour les primitives et slots inchangés des acteurs. Tous les tests ciblés de ce candidat passent ; trois paires alternées à charge identique donnent CPU médian 21 906 → 21 921 ms et temps écoulé 12 783 → 13 002 ms. Aucun gain établi. Les trois micro-modifications et leurs contrats expérimentaux ont été retirés ; les quatre sources Worker concernées sont revenues exactement au témoin `candidate11`.

### Contrats ciblés et défaut temporel de présentation

Sur les 31 fichiers de qualification centrale, 191 cas verts et 17 échecs dont les noms sont **tous présents dans** `tmp/perf/known-failures.json` (frontières historiques, contrôles de pause Worker, anciens lecteurs de coût/ordres). Aucun nouveau nom d'échec. Neuf fichiers complémentaires : 31 cas verts sur 31. Rapports `closure-targeted.json`, `closure-independent-extra.json`. Le contrat historique des saletés avait une fixture manuellement avancée sans son budget Core ; seul le montage de cette fixture a été corrigé, pas sa vérification.

Le test WebGPU a révélé le véritable cas résiduel du chantier 3. Le scénario de minage seed 42 est rejoué dans la simulation des deux versions avec contrôle exhaustif des caches de terrain ; les traces sont identiques : la roche (151,160) devient `rough-stone` au Core 21550, le colon 12410 entame l'arête à 2156 et atteint le centre à 2158,0446. Le défaut n'était donc ni un chemin invalide ni la compression de fiches. Dans le vrai client, le Full21550 (terrain ouvert) était reçu à play2153,073 et le Full21570 à play2154,066, mais la scène restait sur le Full21543 jusqu'à play2167 : 40 images réellement soumises avec le colon sur cette roche et 42 indices de triangles actifs du mesh compilé. Les publications futures déjà reçues avaient été effacées par `finishSurfacePreparation` (le `clear()` intégral), pendant qu'un Full plus ancien préparait ses surfaces.

Correction : la préparation graphique n'écarte que le préfixe situé à ou avant le Core exact du World qu'elle applique (`PresentationQueue.discardThrough`). Les Fulls futurs restent dans leur ordre originel, avec leurs gates et métadonnées ; reset/carte remplacée gardent les vrais resets. Ce changement ne modifie ni le Worker, ni les règles, ni le protocole. Tests déterministes avec la vraie transaction de surfaces et les Core 21543/21550/21570, y compris une admission durant le hold.

Le banc historique comparait aussi des appels RAF qui ne présentaient aucune nouvelle image, donc parfois une ancienne pose avec une nouvelle horloge. Le nouveau contrôle exige toute soumission effective appariée et aucune absence de soumission prolongée, mesure le délai de vitesse sur les soumissions elles-mêmes (toujours 100 ms), garde tous les comptes RAF et vérifie le déplacement entre soumissions. Une approche de contact .24 s ou un départ stationnaire n'est requalifié que si les positions, la jonction, le temps confirmé, les deux arêtes et l'arc exact observés respectent les bornes existantes, puis si le PawnTweener confirme le déplacement dessiné. Les géométries source **et compilées** sont vérifiées par leurs indices actifs ; un témoin manquant, une alarme sans preuve, un chevauchement réel échouent. L'ancien rapport de 40 chevauchements échoue encore exactement sur ces 40 chevauchements, et sur rien d'autre, après réévaluation du départ stationnaire prouvé. Préparation et seuils du contrôle ne sont pas assouplis.

Tests additionnels après correction : neuf fichiers de la préparation et des oracles de présentation, 37 cas verts, trois échecs historiques de `fixed-tree-world-admission` tous recensés ; les trois nouveaux contrats de conservation des Fulls futurs passent. Rapport `closure-surface-tests.json`. Le build Pages complet avec typage passe en 27,384 s (`perf379-closure-build-pages-final-2026-11-25T11-19-55.118Z-24552`). Les 1 701 sources `src/` du Worker gelé `candidate11-worker.mjs.map` sont textuellement identiques aux fichiers finaux (hors fins de ligne) : le nouveau correctif est strictement côté rendu. Les trois fichiers de référence Core aux empreintes figées n'ont pas été modifiés.

**Contrôle de présentation complet, enfin réussi** : le vrai `scripts/check-presentation.mjs`, Chrome WebGPU matériel AMD, deux phases de 45 s, vitesses ×1/×6/×1/×3 toutes les deux secondes, serveur de test isolé, 163,459 s, sortie 0. Les deux phases ont la qualification intégrale `qualified:true`. Aucun écran arrêtant de présenter et aucun retard de vitesse au-delà du seuil de 100 ms.

| Critère | Minage | Coupe d'arbres |
|---|---:|---:|
| Soumissions réelles appariées | 7 089 | 7 280 |
| RAF sans nouvelle soumission | 21 | 0 |
| Jobs initialement / restants | 186 / 162 | 262 / 238 |
| Changements de vitesse contrôlés | 22 | 22 |
| Délai maximal sur image soumise | 36,9 ms | 32,2 ms |
| Alarmes de saut entre images soumises | 4 | 4 |
| Départs continus intégralement prouvés | 4 | 4 |
| Sauts inexpliqués | **0** | **0** |
| Occupations de roche (raw / indices actifs) | **0 / 0** | **0 / 0** |
| Starvation / absence de soumission / erreurs JS | 0 / 0 / 0 | 0 / 0 / 0 |

Les 7 et 4 alarmes des RAF bruts restent dans le rapport, avec leurs témoins. Rapport `tmp/test-runs/perf379-closure-qualified-presentation-2026-11-25T11-20-30.768Z-18156/artifacts/harvest-sync-verification.json`. Le problème de roche n'est plus observé après réparation, contrairement aux 40 images confirmées du relevé antérieur. Le contrôle mesure la présentation réelle, pas uniquement la logique simulation.

**Deuxième passage complet consécutif, sans aucune modification du code ou du banc : PASS en 163,483 s.** Minage : 7 065 soumissions (23 RAF sans soumission), un départ continu prouvé ; coupe d'arbres : 7 293 soumissions, trois départs continus prouvés. Les deux qualifications sont vraies. Pire délai de vitesse 41,6 ms et 33,9 ms respectivement, chacune 22 transitions ; aucun saut inexpliqué, aucune occupation de roche, aucun manque prolongé de soumission, aucune erreur JS. Total sur les deux passages : **28 727 soumissions, 88 changements de vitesse, maximum 41,6 ms, douze départs continus prouvés**. Le critère des passages consécutifs du chantier 3 est satisfait. Rapport `tmp/test-runs/perf379-closure-qualified-presentation-repeat-2026-11-25T11-25-39.703Z-10864/artifacts/harvest-sync-verification.json`.

### Dernière comparaison native, correctif de file inclus

Pour vérifier que la conservation des Fulls futurs ne fait pas disparaître les gains en réduisant simplement le nombre d'applications, nouvelle paire dans le vrai client (final puis **build témoin exact préservé**, même Chrome, WebGPU, AMD RDNA-1, même vue 1440 × 1000, mêmes 20 s à ×3 après 5 s de chauffe). Aucun message d'erreur JS.

| Les Forges, WebGPU AMD | Avant cette tranche | Fichiers finaux |
|---|---:|---:|
| Coût par Full (message + admission + application) | 191,9 ms | **119,6 ms** |
| Adoption résident | 149,1 ms | **80,1 ms** |
| RAF/s | 74,7 | **100,5** |
| Appels de rendu au temps mesurable, par seconde | 74,03 | 99,80 |
| p95 image | 60,0 ms | **30,0 ms** |
| p99 image | 162,0 ms | 90,1 ms |
| Images > 100 ms | 40 | **10** |
| Tâches longues cumulées | 8,334 s | 4,847 s |
| Fulls/s | 1,9 | 1,8 |
| Ticks/s (Fulls du client) | 18,23 | 17,74 |

Sur cette dernière paire : +34,5 % de RAF/s, -37,7 % sur le Full, -46,3 % sur l'adoption, -50 % au p95. Le coût d'application des couches reste 36,3 → 36,1 ms, et les Fulls/s restent voisins. La petite baisse de ticks mesurés par les Fulls sur cette fenêtre (17,74 contre 18,23) ne doit pas être maquillée en gain de TPS côté navigateur ; la mesure de 60 s du front physique et la paire précédente attestent la tenue pratique de ×3. Rapports `client-{baseline,final}-closure.json`. Les deux paires matérielles et le premier relevé Chromium témoignent de la réduction de latence, sans changement de qualité graphique.

### État de remise

Union dédupliquée des trois lots de tests ciblés conservés : **264 cas**, 244 réussites, 20 échecs connus, aucun nom d'échec inédit. Les tests du candidat expérimental retiré ne sont pas inclus. Les trois sources de référence Core sont intactes ; `git diff --check` réussit (avertissements de fins de ligne de fichiers déjà modifiés uniquement). Les liens du présent bilan et des notes de reprise existent. Le fichier personnel `bugs/Elsewhere-2026-11-24T22-53-35-925Z.json` conserve son SHA-256 `fb3291817cf6f5361eba2916cbd85c3e289365e565b2626f20eed3e09c9278bb`.

Le travail reste dans `E:/Code/RimWorld` (HEAD `1732354c`) ; le profil de permissions maintient `.git` en lecture seule. Aucun commit, push ni déploiement n'est revendiqué. Le chantier 4 atteint son critère mesuré. Le chantier 2 a traité les postes retenus et le client gagne effectivement en fluidité, mais le rapport relatif de publication dans le Worker n'établit pas le dernier critère historique de la note : ne pas affirmer qu'il a diminué de 29 % (ce chiffre concerne le clonage seul). Les mesures de stress et cette limite font partie du résultat.
