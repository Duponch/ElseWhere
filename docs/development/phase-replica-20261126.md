# Publication physique : réplication ou journal des écritures

26 novembre 2026 — expérience isolée, non intégrée. Témoin exact : archive C61, Les Forges (`les-forges-crash-test.json`), rejeu mixte de 45 macro-ticks demandés (57 réellement joués). Aucun changement de cadence, de champs, de protocole public ou de règle de simulation.

## Producteur déporté sur un deuxième Worker : résultat négatif

Un observateur inséré uniquement dans une compilation séparée du C61 prélève les **vrais candidats dirty** du `CorePhasePublisher297`, avant sa comparaison et sa copie. Les champs sont écrits directement dans des colonnes transférables. Les objets de mouvement/chemin déjà attestés par leur writer sont transmis par définition/référence, et les identités des cellules de chemin permettent au réplicateur de calculer lui-même le préfixe conservé. Celui-ci possède sa propre table des dernières lignes émises, retrouve exactement les suppressions de lignes égales et les `paths297`, puis encode le graphe stateless du C620.

Le réplicateur n'a ni `World` ni simulation. Les autres sections physiques sont conservées telles que préparées par C61. Le transport de ces colonnes dans une vraie `worker_threads.Worker` transfère les quatre buffers sans cloner la grappe d'acteurs. Les Full et ACK ne sont que des marqueurs dans cet essai de FIFO : leur payload réel n'a pas été déporté ni mesuré. Un décodeur indépendant compare les graphes bruts (références partagées, ordre des clés, nombres et propriété présente à `undefined`).

- 203/203 phases identiques au bit près, 351/351 messages/marqueurs dans l'ordre ; 26 700 candidats, 17 240 lignes réellement émises, 8 937 définitions et 21 526 réutilisations de composants.
- Colonnes en entrée : 16,66 Mo (dont 15,48 Mo transférés), contre 5,75 Mo de wire C620 sortant. L'encodage intermédiaire de candidats est sensiblement plus volumineux que le résultat final.

| Coût moyen par phase | C61 / observateur | Réplicateur envisagé |
| --- | ---: | ---: |
| Capture/comparaison acteurs historique | 1,243 ms | — |
| Encodage historique C620 | 1,114 ms | déporté |
| Extraction directe | — | 2,975 ms |
| Détermination du slot + transfert source | — | 0,073 ms |
| Total estimé sur fil SIM (autres sections conservées) | 2,697 ms | 3,299 ms |
| Service réplicateur (reconstruction + encodage) | — | 2,797 ms |

Le clone C620 est pris à 0,09 ms dans le total historique (mesure Worker antérieure). Les temps sont des diagnostics instrumentés sous Node, pas un A/B natif de débit. L'extraction seule coûte déjà davantage que le travail supprimé : **+2,14 ms/macro-tick** estimés, **+22,3 %** du temps de phase SIM. Une extraction à 2,373 ms serait nécessaire pour seulement égaler C61 ; à 1,812 ms pour économiser 2 ms/macro. Aucun raccordement de ce réplicateur en production. Le vrai gain exige de supprimer des lectures grâce aux écritures réelles, non d'encoder une seconde fois le graphe.

Témoins et scripts d'expérience : `tmp/perf-20261125-next/phase-replica-c61.json`, `replica-c61-source-replay.json`, `c61-replica-source-corpus.v8`, `build-phase-replica-prototype.mjs`, `phase-replica-source-prototype.ts`, `phase-replica-worker-prototype.mjs`, `phase-replica-bench-prototype.mjs`.

## Candidats à une vraie représentation par writers

Parmi les 9 460 candidats non émis, 8 696 sont des animaux, 604 humains et 160 mécanoïdes. Après chaque macro, `observeMacroActors297` contrôle toujours tous les identifiants, dépendances et acteurs. Les champs physiques animaux sont écrits bien avant et après le passage de la faune : santé, portage, secours, repos, apprivoisement, remorquage/enclos, fuite, combat, soins, reproduction, travaux des humains, convoi, transactions d'aire et transitions de présence. Un relevé syntaxique large a trouvé 578 écritures/suppressions potentielles dans 76 modules ; ce n'est pas un inventaire exhaustif typé. Une absence de changement dans le seul passage `advanceWildlife` n'est pas une preuve de l'absence d'écriture de toute la macro. La suppression des visites animales exige donc un vrai journal complet des writers (y compris mutations imbriquées, distinction champ absent/`undefined`, remplacements, commandes et retour au chemin exhaustif en cas d'inconnu).

En revanche, **9 420 des 12 749 lignes humaines émises** du corpus ne diffèrent de leur dernière ligne que par un `moveCooldown` positif : leur chemin est gardé intégralement, et leurs autres champs sont scalaires, sauf l'objet `motion`. Sur 9 123 de ces lignes, ce mouvement est littéralement le même objet dans les graphes de publication successifs. Le receipt de mouvement C622 a déjà un vrai writer de cette dette de mouvement, avec réinscription de tout acteur touché par un producteur ultérieur.

### C650 — construction directe d'une ligne humaine de cooldown, non retenue

Six sources modifiées dans une archive séparée du C63, aucun fichier actif remplacé. Le vrai writer Core de C622 transmet un second receipt privé, à usage unique : seules les dettes de mouvement positives, hors arrivée, miroirs, libération, combat, macro et tout autre producteur. À la publication, la preuve reste valable seulement si chaque observation non émise de cet acteur a la même classification ; toute observation ordinaire rétablit le chemin exhaustif. La ligne précédente doit être celle effectivement émise et certifiée par le copieur, la forme du vrai acteur doit rester attestée, le chemin conservé doit être intégral, et le mouvement toujours le même objet détenu par le copieur. Tous les scalaires et la présence des champs optionnels sont comparés exactement (y compris `undefined` propre) ; les options imbriquées hors mouvement entraînent le repli. Seule la nouvelle valeur `moveCooldown` est construite dans les champs historiques et le `path` vide est envoyé selon le même `paths297`. Aucun acteur publié n'est supprimé. En vérification, l'ancien copieur est exécuté indépendamment pour contrôler ordre, champs, identité du mouvement et gel.

- Neuf cas du probe isolé verts : vrais receipts indépendants, refus d'une copie ou réutilisation du receipt, retour ordinaire après observation non qualifiée, changement de chemin, perte de la forme, nouveau stamp de mouvement, apparition d'un champ propre `undefined`.
- Rejeu Forges mixte 120 avec les six modes VERIFY : **688/688 messages exacts**, 41 Fulls et 518 phases réellement adoptés, sauvegarde identique. **18 933/43 045 lignes émises** (44,0 %) ont réellement suivi la voie de construction directe.
- Deux paires Worker à ×6 (20 s et 5 s d'échauffement, ordre alterné) : 28,995 → 28,404 puis 28,396 → 28,593 ticks/s. Médiane **28,6955 → 28,4985 (−0,69 %)**, retard p50 263,1 → 273,0 ms (+3,76 %), p95 449,5 → 446,0 ms (−0,79 %), p99 526,15 → 503,2 ms (−4,36 %). Pas de gain de débit reproductible. C650 archivé, non intégré ; aucun gain de temps macro ne peut être revendiqué.

Témoins : `tmp/perf-20261125-next/freeze-cooldown650.mjs`, `cooldown650-probe.ts`, `candidate650-sources.json.gz`, `replay-c650-forges.json`, `ab-worker-forges-candidate63-candidate650-2-x6-20.json`. Le prochain chantier véritablement différent exige le journal d'écriture complet des champs projetés depuis leurs nombreux producteurs de macro et une représentation dense de ces écritures ; les seuls gains de construction du graphe et les déports après extraction n'ont pas suffi.
