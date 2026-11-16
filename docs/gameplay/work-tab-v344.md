# Tableau Travail comme dans RimWorld 1.6 — schéma 344

Le tableau **Travail** reprend le fonctionnement du jeu de base : un mode simple par cases à cocher, la case **Priorités manuelles** enregistrée avec la partie, le réglage d'une case par clic, la colonne entière par Maj + clic et le tri par compétence. Référence : RimWorld 1.6.4871 (classes `MainTabWindow_Work`, `WidgetsWork`, `PawnColumnWorker_WorkPriority`, `PawnColumnWorker`, `PawnTable`, `PawnColumnDefGenerator`, `PlaySettings`, `Pawn_WorkSettings`, `Pawn_SkillTracker`, définitions `WorkTypes.xml`). Seuls des faits ont été repris ; les textes sont écrits pour Elsewhere.

## Ce qui change pour le joueur

- **Deux modes.** Par défaut, chaque travail est une **case à cocher** : coché, le colon le fait ; tous les travaux cochés sont au même rang et suivent l'ordre naturel des travaux (Incendie, Patient, Médecin… Recherche). Le bouton **Priorités manuelles** en haut du tableau passe aux priorités **1 à 4** (1 est fait en premier, une case vide est désactivée) et revient aux cases.
- **Rien n'est perdu.** Passer d'un mode à l'autre ne réécrit aucune priorité. En mode simple, une priorité 1, 2 ou 4 réglée auparavant est simplement lue comme « coché » (rang 3) ; en revenant aux priorités manuelles, elle réapparaît. Une case cochée ou décochée en mode simple enregistre 3 ou désactivé.
- **Clic sur une case.** Priorités manuelles : clic gauche monte d'un cran (vide → 4 → 3 → 2 → 1 → vide), clic droit descend (vide → 1 → 2 → 3 → 4 → vide). Mode simple : un clic coche ou décoche.
- **Maj + clic sur un en-tête de colonne** règle toute la colonne pour les colons affichés. Priorités manuelles : Maj + clic gauche monte d'un cran chaque colon qui n'est pas déjà à 1 (vide devient 4) ; Maj + clic droit descend d'un cran chaque colon actif (4 devient vide). Mode simple : Maj + clic gauche coche, Maj + clic droit décoche. Les colons incapables de ce travail ne changent pas.
- **Clic sur un en-tête sans Maj** trie le tableau par la moyenne des compétences utiles au travail. Clic gauche : compétence croissante de haut en bas, puis décroissante, puis l'ordre normal ; clic droit : décroissante, puis croissante, puis l'ordre normal. Un autre en-tête recommence. Un colon incapable du travail compte comme le plus faible. Le tri n'est pas sauvegardé.
- **Lecture des cases.** Le fond va du rouge brique (compétence moyenne sous 4) au sable (4 à 14) puis au vert (14 à 20). Le niveau de la compétence principale et ses flammes de passion restent écrits sous la case ; « ! » signale un travail actif avec une compétence moyenne de 2 ou moins. Une case vide et grisée est un travail impossible à cause du passé du colon ; son infobulle en donne la raison et la priorité enregistrée.
- **Infobulle d'une case.** Le travail, son état (priorité, activé, désactivé ou impossible), les compétences utiles et leur moyenne sur 20, l'avertissement de compétence très faible, les effets de la compétence et le rappel des clics.

## Règles reprises du jeu de base

| Règle | Source | Détail |
|---|---|---|
| Mode simple par défaut, enregistré | `PlaySettings.useWorkPriorities` (faux à la création, `Scribe_Values` avec la partie) | Une nouvelle partie commence en mode simple ; le réglage vaut pour toute la campagne. |
| Le mode ne réécrit rien | `MainTabWindow_Work.DoManualPrioritiesCheckbox`, `Pawn_WorkSettings.Notify_UseWorkPrioritiesChanged` | Basculer marque seulement l'ordre des donneurs de travail à recalculer. |
| Lecture en mode simple | `Pawn_WorkSettings.GetPriority` | Une priorité enregistrée au-dessus de 0 vaut 3 pour un humain tant que le mode est simple : l'ordre des travaux ne dépend alors que de leur priorité naturelle. |
| Case cochée = 3 | `WidgetsWork.DrawWorkBoxFor` | Cocher enregistre 3, décocher 0. |
| Clic manuel | `WidgetsWork.DrawWorkBoxFor` | Gauche : priorité − 1, sous 0 on revient à 4 ; droit : priorité + 1, au-dessus de 4 on revient à 0. |
| Maj + clic sur la colonne | `PawnColumnWorker_WorkPriority.HeaderClicked` | Manuel gauche : tous sauf ceux à 1, un cran plus haut ; droit : tous sauf les désactivés, un cran plus bas. Simple gauche : coche les désactivés ; droit : décoche les actifs. Ignore les colons incapables. |
| Tri | `PawnColumnWorker.HeaderClicked`, `PawnTable.RecachePawns`, `PawnColumnDefGenerator` (colonnes de travail triables) | Gauche : aucun → « décroissant » → « croissant » → aucun ; droit : aucun → « croissant » → « décroissant » → aucun. L'état que le jeu nomme « décroissant » applique le comparateur de la colonne tel quel (valeur la plus faible en haut), l'autre l'inverse ; tri stable sur l'ordre du tableau. Maj + clic ne trie pas. |
| Valeur de tri | `PawnColumnWorker_WorkPriority.GetValueToCompare` | −1 pour un travail impossible, sinon la moyenne des compétences utiles. |
| Moyenne et passion | `Pawn_SkillTracker.AverageOfRelevantSkillsFor`, `MaxPassionOfRelevantSkillsFor`, `WorkTypes.xml` | Moyenne des compétences utiles, 3 si le travail n'en a aucune ; Chasse moyenne Tir et Animaux. |
| Couleur et avertissement | `WidgetsWork.DrawWorkBoxBackground` | Mélange Awful → Bad sous 4, Bad → Mid jusqu'à 14, Mid → Excellent jusqu'à 20 ; cadre d'avertissement pour un travail actif à moyenne ≤ 2. |

## Adaptations

- Le réglage est enregistré à l'envers, sous le nom `simpleWorkTab344` : présent (`true`) pour le mode simple, absent pour les priorités manuelles. Il appartient à la campagne (une seule valeur pour toutes les cartes, comme les politiques) et voyage avec elle, y compris quand aucune carte n'est chargée. Une **Nouvelle partie** (planète générée, case choisie, atterrissage forcé, `createGeographicNewGame256`) commence en mode simple ; une sauvegarde antérieure migrée garde les priorités manuelles, pour que ses priorités gardent leur sens. Les scénarios de diagnostic et les colonies préparées (`createScenarioWorld` : Les Aulnes, colonie établie, scénarios d'essai), qui écrivent des priorités manuelles, restent en priorités manuelles.
- La lecture « 3 en mode simple » passe par le seul lecteur `workPriority` : le moteur fixe le mode de la campagne autour de chaque pas de simulation et de chaque commande (`withWorkTabMode344`). Hors de ces appels (lectures de l'interface, validation), la priorité enregistrée est lue comme avant ; ces lectures ne testent que « actif ou non », identique dans les deux modes.
- Les commandes passent par le chemin habituel, ordonnées et acquittées : `work-tab-mode` pour la case **Priorités manuelles**, `priority` pour une case, `priority-column` pour Maj + clic. Ce dernier reçoit la liste des colons affichés (la recherche du tableau filtre donc la colonne réglée, comme le tableau du jeu ne règle que ses lignes) ; il est refusé en bloc si la liste est malformée ou désigne une personne absente, un prisonnier ou un doublon. Chaque colon passe par les mêmes libérations de travail qu'une priorité mise à 0.
- Le mode simple répond aux deux boutons de la souris, comme le bouton invisible du jeu (déduit de son fonctionnement IMGUI, sans test en jeu).
- Le tableau garde l'ordre des colons d'Elsewhere (ordre de la carte) au lieu de l'ordre de la barre des colons du jeu ; le tri s'applique dessus.
- La légende sous la case reste le niveau de la compétence principale d'Elsewhere (Tir pour la Chasse), alors que la couleur et le tri utilisent la moyenne du jeu.

## Limites

- Pas de copier-coller d'une ligne de priorités (`PawnColumnWorker_CopyPasteWorkPriorities`) ni de teinte rouge pour une incapacité due aux capacités physiques (`IsIncapableOfWholeWorkType`).
- Pas de son de clic ni d'avertissement d'idéologie (extension Ideology).
- Le comportement des colons en mode simple est vérifié sur un cas (abattage à priorité 1 contre minage à 4 : en manuel l'abattage passe d'abord ; en simple, le minage, de priorité naturelle 600, passe avant l'abattage, 500) ; pas de campagne longue.

## Contrôles

`tests/work-tab-344.test.ts` : commande et sauvegarde stricte du réglage, nouvelle partie en mode simple, cycles des cases dans les deux modes, Maj + clic sur une colonne (dont recherche et refus en bloc), tri, conversion sans réécriture et lecture 3 en mode simple, ordre réel des travaux selon le mode, migration 343 → 344 par le seul numéro, rien de lu sous 344. Les tests d'interface du tableau Travail qui utilisaient l'ancien sélecteur 0–4 cliquent désormais les cases.
