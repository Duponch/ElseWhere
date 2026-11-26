# Performance : simulation et publication, schéma 379 — 25 novembre

Demande humaine après le lot de construction : carte blanche pour améliorer les performances. Ce lot est strictement une optimisation : pas de nouvelle règle, de cadence, de schéma, de migration, de raccourci dans le calcul des tâches ou de perte de qualité graphique. Les sources de référence sont la copie locale 379 qualifiée juste avant ce travail, et non le HEAD 377. Trois bundles complets ont été gelés avant la première modification dans `tmp/perf-20261125/baseline-{sim,worker,replay}.mjs`; les candidats intermédiaires et leurs résultats sont conservés. Candidat final `candidate3`.

## Cibles du profil

Les Forges (250 × 250, 80 colons, 241 animaux, 7 512 structures, 21 122 ressources, 1 778 piles, 4 173 saletés). Banc empaqueté esbuild sans `--keep-names`, 20 macro-ticks d'échauffement puis 240 macro-ticks, profil CPU. Départ 47,186 ms/macro-tick **avec profileur**. Faune 15,84 %, planification 14,02 %, déplacement Core 8,21 %, température de surface 5,26 %, `blockedCells` 3,52 %, `terrainBlockedEntry` 1,91 %, `navigationCosts` 2,35 %, `carrierOf` 1,94 %, cuisine 3,34 %. Les parts se recouvrent. Le vrai runtime du Worker simulé sous Node, profilé et avec mesure des tailles de message, tient 80 % de ×3 ; publication 18,50 %, Full 10,25 %, préparation de phases 5,94 %. Ce relevé instrumenté n'est pas le témoin de débit non instrumenté ci-dessous.

## Optimisations intégrées

- **Planification et biens physiques** (`work-planner`, `materials`, `gathering`) : captures des piles, réservations, capacités de stockage et quantités uniquement quand le fournisseur de travail en a besoin, dans la même décision synchrone. La requête d'une seule pile ne reconstruit plus toutes les cibles réservées par la file. Le dépôt de récolte fait un seul préflight de placement/identités suivi de son commit, au lieu de deux. Mêmes ordres, quantités, réservations, conservation et refus atomiques.
- **Navigation** (`pathfinding`, `weighted-search`, `furniture-travel`, `wildlife-navigation`, `ground-placement`) : premier contrôle complet des références des cases à chaque appel fermé de simulation, puis réutilisation tant que le journal des écritures n'a pas changé. Les lectures publiques hors scope voient toujours les remplacements directs non signalés ; le mode de vérification détecte un remplacement non marqué dans un scope. Les listes de travail antérieures au schéma 16 seules bloquent le transit à partir de leurs plans. Moins de constructions de tableaux, de copies de coûts et de structures de recherche ; choix du chemin par les mêmes coûts et le même ordre des candidats avant de matérialiser le chemin retenu. La recherche pondérée et ses coûts ne changent pas.
- **Porteurs** (`rescue-state`, `animal-rest-state`, `core-movement-297`, `wildlife`) : les passes physiques humaines et la passe autonome des animaux ne scannent que les porteurs potentiels capturés au début de leur passe, dans l'ordre des pions ; les tâches réelles, phases et annulations sont relues, les caravanes restent consultées en direct. Le lecteur public interroge toujours l'ensemble des pions. Ces captures ne survivent pas à une commande ni à une décision humaine qui pourrait créer un nouveau propriétaire.
- **Température** (`thermal-topology`) : un Tile remplacé uniquement pour une donnée sans effet thermique ne force pas la reconstruction de la topologie ; la classification roche/roche effondrée est comparée à sa valeur capturée. Les modifications thermiques réelles restent observées. Les bouches d'aération utilisent leur liste déjà indexée.
- **Ménage et neige** (`cleaning`, `snow-clearing`) : mêmes chemins de contact classés par coût, puis longueur, puis ordre initial ; résolution des frontières dans l'ordre précédent, reconstruction d'un seul résultat, élimination de scans et recherches d'une même cible en double, même limite de 14 saletés proches.
- **Publication** (`actor-phase-dependencies-297`, `core-frozen-copy-297`) : égalité des données gelées à clés retenues, les objets vivants toujours relus ; index des feux attachés en un parcours ordonné ; réutilisation du tableau de travail privé seulement après validation de tous ses descripteurs ; listes de champs requis/facultatifs disjointes, sans Set recréé par acteur. Aucune donnée de gameplay omise, aucun paquet de transport redéfini.

## Mesures non instrumentées, successives

Trois paires alternées par scène (A/B, B/A, A/B), machine partagée. Les valeurs sont les médianes des trois passages, pas celles d'une seule paire. Les temps sont CPU/simulation **hors renderer**, les retards du Worker au banc Node ; ni FPS du joueur, ni temps GPU.

| Simulation seule | Avant | Après | Écart médian |
|---|---:|---:|---:|
| Les Forges — ms/macro-tick | 39,929 | 38,767 | −2,91 % |
| Les Forges — p95 du tick frontière | 71,985 ms | 65,096 ms | −9,57 % |
| Les Éclaircies — ms/macro-tick | 6,910 | 6,739 | −2,47 % |
| Les Éclaircies — p95 du tick frontière | 14,281 ms | 13,924 ms | −2,50 % |

Forges : passages 41,326 / 39,929 / 39,660 → 38,767 / 38,862 / 37,557 ms ; trois paires favorables. Éclaircies : 6,798 / 7,615 / 6,910 → 6,733 / 6,739 / 7,296 ms ; deux paires favorables, une défavorable. Un candidat intermédiaire a donné 41,477 → 39,264 ms en médiane ; la variation du témoin interdit d'additionner les gains de ces deux comparaisons.

Chaque exécution a le **même état de simulation complet** que son témoin : SHA-256 Forges `ab7d71dda56c448bf450b59267fa300e036fd0c59a0d0f0a40d5784ced49a2a4`, Éclaircies `0967927622cc8e8f8c2204c060a48a137c81c96a9c84b09803872d61229614bc`. Résultats `tmp/perf-20261125/ab-sim-{forges,eclaircies}-candidate3.json`.

| Runtime Worker, Les Forges, ×3 | Avant | Après |
|---|---:|---:|
| Part du rythme demandé (18 ticks/s) | 96,5 % | 95,8 % |
| Retard de tâche p50 | 73,0 ms | 47,5 ms |
| Retard de tâche p95 | 261,7 ms | 235,6 ms |
| Retard de tâche p99 | 326,8 ms | 283,4 ms |

20 secondes mesurées après 5 s d'échauffement, sans profil ni mesure de taille. Débit comparable, pas de gain de TPS établi (passages 97 / 91,9 / 96,5 % avant, 95,8 / 100,1 / 94,4 % après). Les trois paires améliorent les retards p50/p95/p99 ; ce sont les retards du banc, pas des mesures de latence du clic ou d'image dans le vrai client. Rapport `tmp/perf-20261125/ab-worker-forges-candidate3.json`.

Le même runtime, à charge fixe (199 macro-ticks des Forges, horloge virtuelle, 54 deltas, 715 frontières d'acteurs, 5 réponses) : coût CPU médian de 22 468 à 22 141 ms (−1,46 %), temps écoulé de 13 590 à 13 186 ms (−2,97 %). Trois paires alternées ; deux CPU favorables, une légèrement défavorable, trois temps écoulés favorables. Le débit dépend toujours du coût de publication et de sa réception. Rapport `tmp/perf-20261125/ab-replay-forges-candidate3.json`.

## Validation

- Qualification ciblée finale : 30 fichiers actifs, 191 cas, 180 verts puis le cas de budget logistique révisé et réussi (7,557 s). Une attente de l'ancien quota de 10 unités a été remplacée par le lot physique de 20 existant depuis le schéma 379, en conservant le budget et les contrôles d'accès. Les 10 autres échecs sont déjà recensés dans `tmp/perf/known-failures.json`, sans nouveau nom d'échec. Le long contrat de promenade/faune et rechargement des Éclaircies est vert (544,338 s), et tous les nouveaux contrats ciblés passent. Rapport `tmp/perf-20261125/targeted-final.json`.
- Le candidat final a parcouru, échauffement compris, 260 macro-ticks des Forges (25,453 s) et 200 des Éclaircies (8,313 s) avec `VERIFY_TERRAIN_CACHES=1` et `VERIFY_PILE_INDEX=1`. Les deux contrôles réussissent, empreintes intégrales identiques aux témoins ci-dessus. Rapports `tmp/validation-runs/perf379-final-index-*`.
- Rejeu du vrai Worker, horloge virtuelle et salves mixed/slow des Forges, 688 et 886 messages respectivement, puis mixed des Éclaircies, 676 messages : **2 250 messages** de contenu canonique et d'ordre strictement identiques, sauvegardes finales identiques. Rapports `tmp/perf-20261125/replay-{forges,forges-slow,eclaircies}-{before,after}.json`.
- Typage et compilation de la distribution Pages : `npm run build:pages`, PASS en 30,499 s (`tmp/validation-runs/perf379-build-final-*`). Le contrôle de présentation reste non qualifié : serveur Vite isolé prêt sur 5301, une réponse HTTP 200, puis les requêtes suivantes expirent avant l'ouverture du navigateur. Les deux appels du vrai contrôle échouent sur `Configured presentation URL is not ready`, avant mesure des images. Serveur de test arrêté ; aucun service existant touché. Rapports `tmp/validation-runs/perf379-presentation-{final,retry}-*`.
- Contrôle équivalent de documentation sous Node (Python indisponible) : 1 333 documents, 11 579 liens, six en-têtes au schéma 379, 25 domaines et cinq familles, trois originaux intacts. `git diff --check` vert ; HEAD toujours `1732354c`, répertoire `.git` en lecture seule. L'empreinte de la partie personnelle `bugs/Elsewhere-2026-11-24T22-53-35-925Z.json` est toujours `fb3291817cf6f5361eba2916cbd85c3e289365e565b2626f20eed3e09c9278bb`.

Les chantiers obligatoires 2 et 4 restent ouverts : le mouvement ×3 n'est pas toujours tenu, et la réduction par champs des grandes fiches de colons/animaux n'est pas réalisée dans ce lot. Le chantier 3 reste en pause comme décidé. Ne pas prétendre que la colonie est désormais à 200 FPS ou que le ×6 tient. Les preuves de gameplay du schéma 379 précédentes restent valables ; ce lot n'ajoute pas de règle nécessitant de rejouer les campagnes entières. Les parties personnelles sont intactes.
