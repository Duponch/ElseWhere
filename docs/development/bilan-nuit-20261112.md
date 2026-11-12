# Bilan de la nuit du 12 novembre 2026

Travail autonome demandé par l'utilisateur avant d'aller dormir : finir la promenade des animaux à la RimWorld (choix de la veille : « les deux, comme RimWorld »), puis travailler toute la nuit sur les performances, quelles qu'elles soient. En cours de nuit : libérer plusieurs Go sur le disque E:.

## 1. Promenade des animaux comme dans RimWorld 1.6 (schéma 304)

Règle et sources : [note canonique](../gameplay/animal-idle-wander-v304.md). Un animal oisif alterne désormais une attente de 120 à 480 ticks et une promenade vers une case tirée autour d'un point de départ propre à sa nature (troupeau sauvage, sauvage, domestique vagabond avec 10 % de promenades d'enclos, autre domestique près de la colonie), au lieu de faire un pas au hasard toutes les 12 à 24 décisions. Migration 303 → 304 par le seul numéro.

**Coût.** La première version coûtait ≈ +15 ms par tick sur Les Forges (241 animaux). Réduit, à résultat inchangé pour une même règle, par :

- une réserve de tableaux de recherche de chemin réutilisée (≈ 1 Mo alloué et rempli à chaque promenade auparavant ; seules les cases touchées sont remises à zéro) ;
- des régions gardées d'un tick à l'autre tant que la grille d'obstacles est inchangée hors des portes (cases rangées par indice : une partie rechargée continue exactement comme la partie ininterrompue, vérifié par un test) ;
- le troupeau cherché par régions dans un rayon de 35 cases, comme `GenClosest.ClosestThingReachable`, au lieu d'une recherche de chemin vers chaque congénère ;
- le coût de passage perçu lu dans les coûts de navigation du tick ;
- les coûts de navigation calculés une seule fois par tick, la couche additive des pièges connus étant ajoutée par-dessus pour les animaux qui les connaissent (mêmes valeurs) ;
- les couches de coût de terrain des canards gardées comme les autres.

**Mesure au calme** (fin de nuit, machine sans autre charge ; `scripts/perf-save-bench.ts`, simulation seule, 120 ticks, 5 passages alternés, sauvegardes au schéma courant tirées des sauvegardes publiées ; empreinte d'état identique à chaque passage) :

| ms par tick (médiane) | Référence publiée `8c9c40d7` | Optimisations exactes `fba51516` | + promenade 304 |
|---|---|---|---|
| Les Forges (80 colons, 241 animaux) | 43,3 | 42,0 (−3,0 %) | 46,7 (+7,9 % sur la référence) |
| Les Éclaircies | 8,99 | 8,77 (−2,4 %) | 10,42 (+16 %) |

La promenade coûte donc encore ≈ 4,7 ms par tick sur Les Forges et ≈ 1,65 ms sur Les Éclaircies, où il y a peu de décisions par tick (≈ 1) mais un coût fixe par tick : coûts de navigation de la carte (dont les milliers de morceaux de roche), grilles d'obstacles des lecteurs de la faune, comparaison des régions gardées. Piste suivante, non faite cette nuit (gain estimé ≈ 0,3 ms sur Les Éclaircies) : lire les morceaux de roche dans les faits de l'index des piles au lieu de les recopier dans les tables de coûts.

**Worker réel à ×3 sur Les Forges** (`scripts/perf-worker-run.ts` : simulation, encodeur et publications dans le vrai Worker, piloté en temps réel dans Node, 30 s mesurées après 10 s de chauffe, 3 passages alternés, machine au calme) : la version publiée hier soir (`8c9c40d7`) tient **90,8 %** du rythme ×3 en médiane (87,2 à 91,3), la version de cette nuit **82,4 %** (79,4 à 82,9). Le profil du Worker garde la même part pour la publication ; la faune passe de 8,2 % à 10,8 % du temps du Worker, dont 3,9 % pour la promenade elle-même. Retouches exactes faites ensuite (même état, mesures au calme, 4 passages alternés) : un seul balayage des cases par passe de la faune et seaux de la file de recherche réutilisés (−0,9 % par tick sur Les Forges) ; coûts de navigation calculés **à la demande**, case par case, pour la promenade puis pour toutes les recherches des animaux (`lazyAnimalNavigationCosts`, `animalNavigationCosts` : comparés à la capture complète sur toutes les cases des deux colonies à 5 instants, 5,6 millions de comparaisons sans écart, un test garde cette parité ; −2 % sur Les Éclaircies, −1,2 % sur Les Forges). Pas étendu aux colons : leurs longues recherches de travail liraient plus de cases qu'une capture n'en coûte (l'essai des tables en couches l'a montré).

**Animal enragé devant une porte fermée** (même schéma, écart trouvé en vérifiant une campagne longue) : il vient désormais rôder près de la porte qui le sépare de ses cibles, comme `JobGiver_Manhunter`, au lieu de rester immobile au loin ; voir la note canonique.

## 2. Chargement des sauvegardes

**Constat.** Charger Les Forges publiée (sauvegarde au schéma 263) prenait ≈ 80 s dans Node (Les Éclaircies ≈ 31 s) : chacune des ≈ 40 étapes de migration revalide entièrement le monde (≈ 1,9 s par validation sur Les Forges), avec une quarantaine de validateurs qui parcourent chacun tout l'arbre de la sauvegarde. Une sauvegarde Les Forges au schéma courant se charge en ≈ 5 s.

**Fait (exact : monde chargé identique à l'octet sur Les Forges et Les Éclaircies).**

- Les validateurs de la sylviculture, de la mousse anti-incendie (deux), des fêtes et des livres ne testent plus leurs 40 à 90 « voies » une à une sur chaque objet : ils lisent les noms des propriétés présentes et traitent les voies trouvées dans leur ordre (`src/sim/save-lanes.ts`), plus de 10 fois plus rapide pour ce motif. Une voie héritée de `Object.prototype` est toujours refusée (vérifiée une fois par parcours ; dans ce cas la lecture voie par voie reprend).
- La liste des genres de bâtiments admis à une version est construite une fois par version au lieu d'une fois par bâtiment.

Mesures (Node, machine chargée par la suite de tests, donc indicatives) : Les Forges publiée 80 → 63 s (−21 %), Les Éclaircies 31,5 → 26,1 s (−17 %), Les Forges au schéma courant ≈ 5,4 → 4,5 s.

**Proposition, non appliquée (règle du projet).** Ne valider que le schéma d'origine de la sauvegarde et le schéma final, pas chaque étape intermédiaire produite par nos propres migrations : prototype de mesure, Les Forges publiée 81,9 → 8,3 s, monde chargé identique à l'octet. La règle « valider strictement l'ancien schéma avant migration » resterait respectée pour le schéma de la sauvegarde ; on perdrait la détection, à chaque étape, d'une erreur dans nos propres migrations (la validation finale reste). À décider par l'utilisateur.

## 3. Simulation : optimisations exactes

Même état (empreinte identique au schéma 303 sur Les Forges et Les Éclaircies, et en mode de contrôle des caches de terrain et des piles) :

- `captureStandability` lit les morceaux de roche dans une copie des faits de l'index des piles au lieu de construire un ensemble de milliers de cases à chaque lecteur, et ne crée plus de tableau à chaque appel.
- Les couches de coût de terrain des canards sont gardées comme les autres (elles étaient recalculées sur toute la carte à chaque recherche).

**Écarté.** Des tables de coûts de navigation « en couches » (sans copie des tables de structures) pour toutes les recherches : plus lent sur Les Forges (médiane 46,4 contre 45,1 ms par tick), la lecture devenant plus chère que la copie ; l'option reste réservée à la promenade.

## 4. Disque E:

E: n'avait plus que 37 Mo libres. Supprimés (tous recréables) : anciens bundles, cartes de sources et profils de mesure de `tmp/perf` (≈ 1,4 Go), six copies de builds Vite (≈ 1 Go), quatre anciens dossiers de travail Git sans travail en cours (le seul qui avait des modifications est conservé en patch dans `tmp/perf/needs-wt-attempt/`, un brouillon de bilan dans `tmp/perf/next-wt-attempt/`), 320 Mo de profils de navigateur Playwright de plus d'un jour, le cache npm (600 Mo). Aucune sauvegarde, preuve ni historique touché. Résultat : 5,7 Go libres.

## 5. Tests

- **Suite complète** (lots de 30 fichiers, 3 processus, ≈ 2 h 10, pendant que d'autres mesures tournaient) : 10 608 tests, 1 844 échecs dont 1 794 déjà connus (`tmp/perf/known-failures.json`). Les 52 autres : 43 lisent des preuves locales absentes du dossier de travail utilisé (`tmp/test-runs/...`, sources de `three`) ; 4 tests de démonstration dépassent 30 s sous charge (≈ 29 s chacun seul, avec ou sans la règle 304) ; 2 fichiers figent l'empreinte d'un source modifié le 11 novembre (`daylight-speed-engine-v492`, `main-terminal298`), et ré-épingler montre d'autres échecs plus anciens (fixtures au schéma 298) : laissés tels quels ; 1 campagne diverge (ci-dessous).
- **Ciblés avec le code final** : promenade (5 tests, dont la partie rechargée identique à la partie continue et la migration), animal enragé (2), portes et portails du schéma 303 (7), 111 fichiers de tests d'animaux, de faune et de caravanes : aucun nouvel échec. Optimisations exactes : 948 tests des modules touchés et 91 des retombées toxiques, aucun nouvel échec réel.
- **Campagne « Atterrissage » graine 42** : passe sans la règle 304 ; avec elle, le déroulement diverge : un muffalo devient enragé (vengeance après une chasse), vient rôder près de l'abri comme dans RimWorld, met à terre le seul colon armé posté dehors, et le joueur scripté du test garde les deux autres colons mobilisés à l'abri tant que l'animal vit ; ils finissent affamés (un colon mobilisé ne mange pas seul, comme dans RimWorld). Limite du joueur scripté (il ne secourt pas le défenseur et ne fait pas manger des colons mobilisés), pas un écart de règle : non modifiée sans l'avis de l'utilisateur.
- Le commit de la règle (`4899edfa`) laissait deux erreurs de typage dans le nouveau test de l'animal enragé (la construction Pages les a révélées) ; corrigé par `8b608307`, mêmes assertions, avant la publication.

## 6. Publication

Commits poussés sur `origin/main` : `fba51516` (optimisations exactes), `4899edfa` (règle 304), `8b608307` (typage du test), `be324859` (deux retouches exactes de la promenade), `d98adeb5` et `939ba74e` (coûts de navigation à la demande pour les animaux), plus la documentation. Republié depuis `c732e51a` (Production `63058abf`) puis depuis le dernier commit de la nuit (voir plus bas). Publié sur Cloudflare Pages depuis une copie exacte de `8b608307` (`git archive`) : typage et construction Pages réussis (1 142 fichiers, 8 nouveaux envoyés), déploiement Production `d91f31e8` sur la branche main ; 36 réponses HTTPS identiques octet pour octet sur le site public et l'adresse fixe du déploiement. Ce contrôle ne remplace ni un parcours dans le navigateur ni une mesure d'images par seconde.

## 7. Décisions pour l'utilisateur

1. **Chargement des anciennes sauvegardes** : ne valider que le schéma d'origine de la sauvegarde et le schéma final (prototype : Les Forges publiée 82 → 8 s, monde identique). Chaque nouveau schéma ajoute sinon une validation complète au chargement de toutes les sauvegardes plus anciennes.
2. **Campagne « Atterrissage » graine 42** : rendre le joueur scripté plus réaliste (secourir le défenseur, laisser manger les colons mobilisés), ou accepter cette divergence.
3. **Coût de la promenade** : ≈ +4,7 ms par tick sur Les Forges en simulation seule, et dans le vrai Worker à ×3 le rythme tenu passe de 90,8 % à 82,4 %. Poursuivre (coûts de navigation calculés à la demande) ou accepter ce coût d'une règle plus fidèle.
