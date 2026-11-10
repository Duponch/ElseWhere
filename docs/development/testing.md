# Stratégie de validation

## Méthode du 10 novembre 2026

La suite complète prend plus de deux heures : elle ne bloque plus le travail.
- Avant un commit : `sh scripts/test-related.sh` (tests qui importent les fichiers modifiés).
- Avant de pousser un changement large : `sh scripts/test-fast.sh` (tout sauf les fichiers lents de `scripts/slow-tests.txt`).
- Une fois par nuit : `sh scripts/test-chunked.sh` (suite complète par lots), triée contre la liste des échecs connus, lue en UTF-8.
- Les fichiers dont tous les tests échouent depuis longtemps sont listés dans `tests/retired-tests.txt` et sortis du lancement par défaut, sans être supprimés ; `RETIRED_TESTS=1` les relance.

## Priorité humaine du 15 octobre 2026

Livrer des boucles cohérentes avec une passe ciblée regroupée et un court parcours UI couvrant les contrats touchés. Campagnes longues seulement périodiques ou motivées : ni une partie gagnée ni tous les événements possibles ne sont des conditions de livraison. Conserver les rouges et limites, clôturer honnêtement un objectif partiel, puis avancer les travaux indépendants. Réutiliser les preuves inchangées, éviter tableaux de preuves imbriqués et nouveau pilote par incident. Recherches RimWorld ciblées par domaine, avec règles primaires et références visuelles de l’UX ; réutiliser les conclusions vérifiées. Une note canonique par lot. Commits et pushes origin/main autorisés explicitement, publications produit regroupées. Ces consignes remplacent les anciennes mentions de push manuel ci-dessous.

Le contrôle de présentation accepte aussi `HARVEST_URL` pour un paquet local compilé : même scénario250², mêmes phases et assertions. `HARVEST_EMIT_PROBE` émet ses préfixe/suffixe dans un JSON temporaire ; ils sont injectés dans MAIN avant compilation, afin de conserver les vrais bindings. `HARVEST_PREINSTRUMENTED=1` exige cette sonde réelle et refuse la trace worker optionnelle non incluse. La réception observée est `receiveMainSnapshot`, avec compteur effectif et coût fini ; aucune propriété morte ajoutée à la façade client ne vaut mesure. Un paquet QA exposant les observations DEV n’est jamais publié.

Les outils Node qui chargent directement les modules SIM emploient des extensions `.ts` explicites et `--experimental-transform-types` (Node24.11.1 vérifié), car certains constructeurs contiennent des propriétés de paramètres. Aucun loader de résolution, dépendance supplémentaire ou changement de logique n’est nécessaire. Les vérifications V408 et leurs limites sont dans [le premier lot géographique](../gameplay/world-generation-v408.md).

## Consolidation V209 et contrôle proportionnel

La [consolidation](consolidation-v209.md) regroupe les tests `consolidation-*` des frontières corrigées : transitions/arêtes, réservations, standabilité, identités, mobilisation, worker, corrélation, dépôt de sauvegardes, clipping, limites et lifecycle graphique, recherche et archives. La régression répare les fixtures historiques sans détendre les schémas. Le [suivi](../history/validation-consolidation-v209.md) nomme exactement suites, campagnes, preuves natives et limites.

Utiliser `npm run validate:logged -- --label <phase> -- node <script> <arguments>` pour les nouvelles exécutions : durée murale et statut dans `tmp/validation-runs/ledger.jsonl`, sortie complète dans le journal du run, synthèse bornée. Sous Windows, invoquer les scripts npm via leur entrée Node si le lanceur sans shell ne résout pas les fichiers `.cmd`. Une sortie JSON est lue par synthèse ciblée, pas déversée intégralement dans la conversation. Ce chronométrage ne mesure pas les tokens/seconde de l’agent. Le contrôle de présentation utilise Chrome installé par défaut sous Windows et Chromium ailleurs ; `HARVEST_BROWSER` conserve le choix explicite. Ce choix évite le refus Tint IR connu du Chromium embarqué sur cette machine, sans masquer une erreur graphique ni changer les assertions.

Un lot cohérent partage la migration et le parcours UI de ses règles/contenus. Après une correction, rejouer les garanties touchées ; réserver la régression aux frontières globales et les campagnes aux évolutions motivées ou périodiques. Le navigateur prépare des préconditions réelles puis exerce la transition ; aucun changement de règles/cadence du jeu pour faire passer un test plus vite. La CI exécute successivement régression, build et documentation ; elle ne prouve ni GPU matériel ni campagne naturelle.

## Contrôles ciblés V208 — télévision et places réelles

Les [loisirs télévisés](television-v208.md) exigent recherche au contact, verrou Mobilier complexe, acier/composants livrés, Construction 7, courant réel et sièges dans le rectangle orienté. Les sept suites `tests/television-*-v208.test.ts` distinguent géométrie, visibilité/pièce/vision, préférence de siège, réservation partagée et plafond huit, gain après arrivée, interruptions, dégâts/réparation, paquet/repose et migration stricte 189 vers 190. Les archives historiques gardent leurs familles ; les propriétaires actifs hors carte reçoivent uniquement la nouvelle lassitude neutre.

Le parcours `tests/integration/television-v208.spec.ts` charge la 54e scène publique préparée, puis utilise Recherche, Architecte, Horaires et l'interrupteur physique. Les lectures du World observent recherche, livraisons, construction, trajet, pose assise et sauvegardes ; elles ne produisent pas ces transitions. Le microbanc `scripts/benchmark-television-v208.ts` compare seulement capture et requêtes de sites historiques sur 250², puis une capture télévisée absolue avec topologie déjà acquise. Il exclut routage, reconstruction de pièce, tick, worker, rendu et GPU. Mesures, navigateur matériel et présentation successifs sur sources gelées ; résultats et limites dans la [preuve V208](../history/validation-television-v208.md).

## Contrôles ciblés V207 — couvert construit

Les [sacs de sable](sandbags-v207.md) demandent acquisition/livraison réelle du tissu, Construction sans seuil inventé, annulation portée, entrée 4,2 et répétition entre objets distincts, reprise des arêtes, ligne de vue/couvert/impact séparés, dégâts/réparation au contact, restitution quart/demi et refus atomiques. Les six fichiers `tests/sandbags-*-v207.test.ts` contrôlent aussi migration stricte 188→189, bilans textiles prospectifs, refus des propriétés/familles futures, adoption même tick et immuabilité des anciens Worlds. Ils ne remplacent pas les validateurs ordinaires de références et capacités.

Le parcours `tests/integration/sandbags-v207.spec.ts` importe la candidate préparée avant publication : menus, plan, Travail, livraisons, vraie balle, réparation et reprises exactes. Le pilote vérifie le corps projeté après ouverture d'un inspecteur, pas seulement la case au sol : le déplacement de caméra reste un geste utilisateur. La préparation et les tirs volontaires entre alliés ne prouvent pas une campagne de défense naturelle. Le microbanc `scripts/benchmark-sandbags-v207.ts` compare une capture tactique historique 250² et des requêtes exactes au commit V206 ; la garde courante est chronométrée séparément en absolu, sans nouvelle défense active. Contrôles lourds successifs et sources gelées ; résultats et limites dans la [preuve V207](../history/validation-sandbags-v207.md), pas dans les sorties historiques.

## Contrôles ciblés V206 — périmètre ciblé exécuté

La [production unitaire des repas de survie](packaged-survival-v206.md) demande les témoins de recherche physique, Cuisine 7/8, quotas 6+6, viande/lait et plusieurs piles, cuisinières/énergie, fraîcheur, interruptions, sortie saturée, contamination et refus du voyage. Les fichiers ciblés sont `tests/packaged-survival-research-v206.test.ts`, `tests/packaged-survival-production-v206.test.ts`, `tests/packaged-survival-persistence-v206.test.ts` et `tests/packaged-survival-world-v206.test.ts` ; ils doivent distinguer ancien schéma 187 strict, migration neutre vers 188 et refus des futurs projets/factures/tâches, y compris poste emballé et ordres en file.

Le parcours `tests/integration/packaged-survival-v206.spec.ts` utilise les menus, Travail, Recherche, réserve, facture et reconnaissance depuis la scène candidate avant sa publication, sans ration initiale. Il observe cuisson, dépôts, chargement et propriétaire hors carte, avec reprises exactes et présentation WebGPU native. Les besoins préparés à 100 ne prouvent aucune consommation pendant ce court circuit ; le témoin CPU de voyage prépare explicitement son besoin avant le départ pour exercer une ingestion réelle. CPU, navigateur, rendu et publication doivent rester successifs sur sources gelées. Le [suivi des contrôles V206](../history/validation-packaged-survival-v206.md) consigne les résultats et limites ; une fixture préparée ou un test écrit n’est pas un contrôle réussi ni une preuve de campagne naturelle.

## Commandes courantes et preuves

`npm run test:quick` couvre les frontières V139/V143/V144 et les correctifs V145
de déblaiement, de sauvegarde du feu et de repas des visiteurs, ainsi que la
protection des sorties de tests.
`npm run test:regression` exécute les tests Vitest hors des pilotes longs listés dans
`scripts/test-campaign-manifest.mjs` ; c'est une régression quotidienne bornée,
pas la suite complète. `npm run test:campaign:diagnostic` rejoue séparément les
cinq pilotes historiques Survivants, Atterrissage, Énergie, Simulation et Raid ;
`npm run test:campaign` parcourt tous les pilotes longs du manifeste. Le lanceur
termine en échec si une campagne échoue et garde un journal par fichier sous
`tmp/test-runs/<run>/`. `npm test` et `npm run check` conservent **toute** la suite
Vitest, y compris les campagnes ; `npm run check:docs` vérifie l'index, les liens,
les originaux et les en-têtes d'état courant. Les parcours Playwright restent
dans `npm run test:integration` et `npm run check`.

Les producteurs de tests et de parcours natifs dirigent leurs rapports et
captures courants de `artifacts/` vers `tmp/test-runs/<run>/artifacts/` avec le
helper explicite `tests/test-output.ts`, y compris sous `npx vitest` direct.
`LISIERE_TEST_RUN` nomme un run commun ; sans lui, chaque processus emploie un
nom horodaté avec son PID. Les lectures
de `artifacts/` sont des fixtures ou preuves historiques suivies et restent
inchangées. Une preuve historique n'est publiée qu'après revue, hors du chemin
normal des tests. Un test rouge ou une campagne interrompue reste rouge ; les
contrôles ciblés n'impliquent pas que la suite historique soit verte.


## Procédure courante de livraison



Adoptée après V76 pour réduire les reprises et les relances, sans réduire les contrats de qualité. L'unité de livraison est une **boucle jouable**, composée de plusieurs sous-étapes internes. Les contrôles suivent les risques et les dépendances ; un lot plus gros ne signifie pas un unique test à la toute fin.

1. **Cadrer une seule fois le lot.** Décision du joueur, critères de réussite, périmètre différé, fichiers/contrats concernés. Lire l'index et les documents de domaine ; réserver les historiques aux preuves utiles. Confronter les mécaniques aux sources fraîches par domaine, puis conserver règles, désaccords et liens dans leur document canonique. Rechercher de nouveau si une nouvelle question apparaît, pas à chaque retouche de la même règle.
2. **Développer la boucle et ses contrôles courts ensemble.** Faire tourner les scénarios ciblés aux changements de contrat et checkpoints internes ; ne pas attendre un gros lot entier pour détecter une migration ou une conservation cassée. Avant un parcours long, exercer chaque nouvelle commande de sa politique via le **même pilote UI**, depuis un état court pertinent. Le fonctionnement isolé du widget ne prouve pas la capacité du pilote à le manipuler.
3. **Regrouper la validation finale.** Choisir la matrice selon les contrats réellement touchés : scénarios métier profonds, sauvegarde/continuation, worker/présentation, parcours de colonie et audit lorsque requis. Jouer ensemble les scénarios concernés ; garder une passe élargie aux intégrations transversales. Un résultat reste réutilisable après une retouche sans rapport, en précisant sa portée. Un changement de contrat relance les contrôles qui en dépendent.
4. **Paralléliser uniquement ce qui est indépendant.** Recherches bornées et lectures peuvent être groupées ; revue et documentation peuvent avancer pendant un test si elles ne modifient pas ses entrées. Le serveur Vite actuel recharge les sources : geler tout code servi pendant l'UI native. Les mesures CPU/GPU et les longs pilotes restent successifs, avec environnement stable. Tester un futur build figé nécessitera un mode de diagnostic adapté : ce mécanisme n'est pas encore livré.
5. **Diagnostiquer avant de rejouer.** Checkpoint réel, état attendu/obtenu, graine et commande en échec. Reprendre la section concernée, puis élargir seulement si la correction affecte l'amont. Préserver toutes les assertions métier ; ne pas annoncer une reprise comme une nouvelle passe complète. Ne jamais faire varier les sources au milieu d'une mesure native. Borner séparément chaque geste UI et le parcours complet : un sélecteur périmé doit produire rapidement son contexte/trace, sans attendre tout le budget de la campagne. Le pilote Frontières utilise quinze secondes par action et cent vingt pour son ensemble de gestes ; ce délai ne change pas les règles du jeu.
6. **Publier une fois la boucle cohérente.** Mettre à jour contrats, guide, inventaire, catalogue si nécessaire et preuves ; les index/ROADMAP résument et renvoient aux contrats au lieu de recopier leurs détails. Commit explicatif et push origin/main autorisés, puis bilan utilisateur. Noter les durées approximatives recherche, implémentation et validation, ainsi que les reprises évitables ; réévaluer la méthode après deux lots. Aucune réduction chiffrée de temps ou de tokens promise sans mesure.

## Principes

Maintenir peu de scénarios riches : effets de jeu, invariants, cas limites et diagnostics reproductibles. Un test qui relit simplement la valeur qu’il vient d’écrire apporte peu. Chaque bug important enrichit la famille correspondante ; ni une accumulation de petits tests ni une partie longue sans assertions ne garantissent l’absence d’anomalies.

La cohérence de notre simulation et la fidélité à RimWorld sont deux validations distinctes. Une règle de référence précise source, version, unité et contexte. La continuation de notre monde doit être exacte pour une même version de règles ; notre PRNG n’a pas à produire la séquence de RimWorld. Un oracle doit avoir une implémentation indépendante du chemin qu’il contrôle.

Pour une correction de continuité comme la [poursuite V197](melee-pursuit-v197.md), l'oracle observe les transitions et les intervalles entre segments, puis rapproche chaque immobilité d'une cause admissible : récupération après tentative, étourdissement, arête encore engagée, obstacle ou absence de route sous budget. Exercer aussi le délai de recherche et l'expiration de décision en cours de poursuite, en conservant une cible mobile et un accès physique réel. Une blessure finale, une distance parcourue ou une moyenne de FPS peut réussir malgré des pauses périodiques ; ces seuls résultats ne remplacent pas les assertions temporelles de simulation et les segments observés aux vraies frames. Garder le checkpoint et la séquence en échec, sans supprimer les contrôles de blocage et de récupération pour obtenir une continuité apparente.

Regrouper les changements cohérents avant de lancer leur lot de contrôles. Après un échec, corriger sa cause et rejouer les scénarios concernés. Ne pas desserrer un seuil uniquement pour obtenir un résultat vert. Un fichier de rapport ancien reste daté ; il n’est pas une preuve d’exécution sur le code présent.

## Pièges connus des témoins préparés

- Le transport d’une pile de matériau crée une nouvelle cargaison même quand il prend toute la source. Observer source, propriétaire et nouvel ID avant le dépôt ; ne pas exiger le retour de l’ancien ID supprimé.
- Le SnapshotEncoder conserve l’identité du World source : une autre instance demande un checkpoint. Pour exercer un delta, garder la source et cloner les paquets/témoins précédents avant mutation.
- Échap peut désélectionner le colon après mobilisation. Le clic tactique exige encore une vraie sélection ; le helper d’action ne doit pas la supprimer systématiquement.
- Une fixture créée avec les défauts courants puis abaissée à un ancien schéma doit omettre explicitement les seuls contenus futurs étrangers à son contrat. Ne jamais détendre le validateur pour la rendre historique.
- L’atomicité d’une commande refusée et les effets internes d’un sous-système sont distincts. La tentative de saleté peut initialiser son propre domaine et sonder les voisins ; tester l’absence de dépôt et les invariants réellement promis, sans inventer une invariance de son PRNG indépendant.

## Choisir les contrôles

| Changement | Contrôles nécessaires selon son contrat |
|---|---|
| Texte, couleur, détail procédural sans logique | Inspection visuelle ciblée ; pas de partie de trois jours. |
| Documentation | Liens, fragments, intégrité des sources et relecture du sens ; pas de suites gameplay. |
| Recette, besoin, réservations, transport ou planner | Scénarios du domaine avec bilans/interruptions/continuation ; pilote cœur si ses boucles changent. |
| Commande, persistance ou protocole worker | Refus atomiques, migrations et reconstruction ; parcours de la vraie UI/du worker. |
| Plusieurs boucles livrées ensemble ou régression de partie longue | Pilote cœur multi-graines, puis parcours UI de trois jours. |
| Navigation | Oracle, cibles inaccessibles, coins, trafic, obstacle ajouté et reprise ; audit à forte population si le coût change. |
| Rendu, caméra, interpolation | Contrôles purs des contrats et parcours graphique natif ; inspecter les captures, pas seulement la console. |
| Algorithme ou cycle de vie GPU | Oracle indépendant, exécution GPU réelle, révisions/bornes et audit avec rendu concurrent. Un backend absent ne vaut pas réussite. |

Compiler à l’intégration du lot. Les suites longues, compilations et benchmarks lourds ne tournent pas en concurrence. Vitest borne le parallélisme à deux workers ; les parcours navigateur utilisent un worker. Une optimisation interne conservant exactement les états n’exige pas de rejouer une longue UI déjà verte si ses contrôles n’ont pas changé.

## Familles en place

La [matrice](../gameplay/systems-matrix.md) conserve cinq familles : F1 conservation/identité, F2 continuation/rejeu, F3 espace/topologie, F4 commandes/UI réelle, F5 performance. Une entrée de catalogue ou une famille présente ne vaut pas couverture exhaustive. Choisir les contrôles selon le contrat touché plutôt qu’un nombre arbitraire de tests.

## Pilote de colonie

Les scénarios de `tests/scenarios` ne modifient pas directement le monde pour réussir : ils envoient des commandes, observent accès, matières, repas, sommeil et construction, puis gardent des checkpoints. La préparation explicite d’une fixture reste distincte d’une partie naturelle. Un obstacle réel se dégage par une commande physique ; une date d’incident rare ne se force pas pour satisfaire un horizon.

Conserver les bilans de matière, combustible et alimentation (dix ingrédients deviennent un repas) et distinguer pertes réellement prévues, consommations et destruction. Ne pas rebaptiser toute différence inexpliquée « perte » : une transformation doit être identifiée et contrôlée. Au chargement, attendre l’acquittement du nouveau monde plutôt que lire l’ancien snapshot. Une reprise depuis checkpoint valide sa continuation, pas toute la préparation antérieure.

### Reprise bornée d’une campagne

Le diagnostic Énergie peut partir d’un vrai fichier de checkpoint avec `ENERGY_CHECKPOINT` et un tick final `ENERGY_COMBAT_UNTIL`, strictement après son départ et au plus deux jours plus tard. Le test séparé « diagnostic de défense » observe conservation, survie et continuation ; le parcours complet garde son horizon et ses objectifs. Le mode Environnement existant utilise `ENVIRONMENT_JOURNEY=1` et `ENVIRONMENT_UNTIL`. Choisir le tick final à partir du checkpoint, pas d’une date approximative.

Ces modes servent à reproduire et vérifier une transition en échec avant un replay long. Ils ne remplacent pas la campagne complète et n’accélèrent pas le temps du produit. Conserver le checkpoint antérieur et le rapport rouge, puis indiquer explicitement la borne atteinte dans la preuve.

## Diagnostics et mesures

Suivre le [protocole reproductible](performance-measurement.md), les [critères de présentation](playability-validation.md) et la [référence V145](../history/validation-performance-reference-v145.md). Maintenir les sources servies gelées et exécuter campagnes CPU, compilation et bancs natifs successivement. Relever programmes concurrents et conditions sans arrêter les applications de l’utilisateur. Une absence de backend GPU ne compte pas comme réussite.

Séparer coûts de simulation, publication/adoption, CPU image, RAF et GPU. Les rapports courants restent sous `tmp/` ; seules des preuves relues sont publiées dans `artifacts/` avec leur contexte. Les mesures historiques, outils spécialisés et cas de livraison antérieurs se trouvent dans [l’archive de stratégie](testing-pre-v145.md) ; ne pas les annoncer comme résultats actuels.


## Exploiter les scénarios du référentiel

Le [corpus utilisateur](../research/reference-adoption.md) fournit 196 propositions TEST, pas des tests directement exécutables. TEST-001..181 reformulent les contrats SYS ; ils enrichissent nos familles sans créer une suite par ligne. Les quinze autres entrées peuvent être plus précises, synthétiques ou propres à une version/extension. Le statut d’une cellule du classeur ne vaut pas validation locale.

Le chapitre 32 (PDF pages 39–40) propose les interactions suivantes. Leur calendrier appartient uniquement à ROADMAP.

| Scène | Adoption et familles |
|---|---|
| A — Cuisine interrompue | G0 : pile partagée, destination filtrée, annulation/reprise ; G1 : ingrédients/recette ; G2 : panne électrique. F1 conservation et F2 continuation à chaque transition. |
| B — Combat et cible mobile | G3 : mobilisation, porte, couvert, allié/cible déplacés ; séparer émission et impact. F3 topologie, F2 séquence. |
| C — Maladie et transfert du patient | G3 : soins, médecine, interruption/durée ; G5 : départ en caravane. F1 transferts, F2 durée/reprise. |
| D — Caravane aller-retour | G5 : propriétaires avant/après chaque transfert, individus/piles/consommation. F1 identité, F2 voyage/sauvegarde. |
| E — Pièces, énergie et incendie | G2 : portes/toits/réseaux et feu injecté sans exiger déjà le narrateur ; dégâts aux personnes en G3. F3 topologie, F2 échanges. |

F4 exerce les commandes dans le navigateur quand elles existent ; F5 mesure leur charge représentative. La profondeur combine cas imposés, interactions avec invariants et distributions seulement pour les systèmes probabilistes concernés. Fixer tailles d’échantillon et seuils avant observation ; TEST-182..194 nécessitent l’adoption de leur modèle, TEST-195/196 leur contexte DLC/correctif.

## Documentation

`npm run check:docs` contrôle liens, fragments, 25 domaines/cinq familles, les trois originaux et l’accord des six en-têtes courants avec le schéma du code. Il ne prouve pas la vérité d’une affirmation de gameplay. Tenir [la validation courante](validation.md) à jour avec les résultats réellement exécutés, les échecs ouverts, les skips et les reprises ; garder leurs diagnostics dans la preuve datée.


## Contrats natifs de clone V474

La suite dédiée couvre sept contrats du vrai Worker de présentation : checkpoint
et delta authentiques face à une copie stricte, getter world refusé sans appel,
mutation réentrante du prototype, Proxy inséré après capture ou dans le
prédécesseur conservé, Event synthétique et Event enveloppé par un Proxy. Les
mondes sont comparés intégralement au lecteur strict, avec own undefined,
trous de tableaux et -0 conservés. Aucun skip interne ni voie rapide inactive ne
compte comme réussite. Aucun renderer, sauvegarde jouée ou gain CPU/FPS n'est
certifié par cette suite.

ROOT fournit un serveur Vite distinct aux sources gelées et un nouveau dossier
absolu de rapports ; la configuration ne démarre aucun serveur et utilise le
Chromium déjà installé, muet avant la page. Exemple PowerShell depuis la racine :

```powershell
$env:NATIVE_CLONE474_NATIVE='1'
$env:NATIVE_CLONE474_BASE_URL='http://127.0.0.1:5175'
$env:NATIVE_CLONE474_OUTPUT='E:\Code\RimWorld\tmp\native-clone-v474\run-unique'
node node_modules/@playwright/test/cli.js test --config playwright.native-clone-v474-native.config.ts
```

Le rapport contracts.json conserve les assertions et erreurs, y compris un échec
de chargement. Le cas réentrant cible la pile firefoam-save-290.ts : utiliser la
route de sources Vite, pas un bundle de production sans ces noms. Le cas de
prédécesseur exige une vraie pile de fournitures initiale. Le spec reste opt-in
avant la fixture page ; les fichiers .spec.ts et -browser.ts ne rejoignent pas
la sélection Node Vitest .test.ts. Aucun provider navigateur ni dépendance
supplémentaire n'est nécessaire. Exécuter cette suite successivement avec les
contrôles CPU, présentation et mesures natives existants.
