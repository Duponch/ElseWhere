# Besoin de plein air — V359

Schéma 359. L'audit des bases (besoins et pensées) classait le besoin de plein air parmi ceux que la plupart des parties du jeu de base rencontrent dès la première saison : un colon qui reste trop longtemps à l'intérieur, et surtout sous une montagne, finit par souffrir du « syndrome de la cabane ». Les règles viennent des définitions de RimWorld 1.6 (NeedDef Outdoors dans Needs.xml, ThoughtDef NeedOutdoors dans Thoughts_Situation_Needs.xml, TraitDef Undergrounder) et des classes qui les appliquent (Need_Outdoors, Need, Pawn_NeedsTracker, ThoughtWorker_NeedOutdoors, ThoughtUtility, GridsUtility.UsesOutdoorTemperature, Room.UsesOutdoorTemperature, RestUtility.Awake, Caravan_NeedsTracker, WorldPawns) ; aucun texte du jeu n'est repris.

## Le besoin

Les colons et les prisonniers ont un besoin **Plein air** (de 0 à 100 %), affiché dans l'onglet Besoins de l'inspecteur, après Confort. Un nouveau colon ou un nouveau prisonnier commence à 100 %.

Le niveau change à chaque passage des besoins du colon (150 ticks du jeu de base, soit 1/400 de journée), selon l'endroit où il se tient à ce moment. Les vitesses ci-dessous sont par jour de jeu ; chaque passage applique 1/400 de la valeur.

| Endroit | Variation par jour | Plancher |
|---|---|---|
| Dehors, à ciel ouvert | +8 (plein en trois heures) | — |
| Dehors, sous un toit construit ou de roche mince | +1 | — |
| Dehors, sous la roche épaisse d'une montagne | −0,40 | 20 % |
| À l'intérieur, sur une case sans toit | +5 | — |
| À l'intérieur, sous un toit construit ou de roche mince | −0,32 | 20 % |
| À l'intérieur, sous la roche épaisse d'une montagne | −0,45 | 0 % |

- **Dehors ou à l'intérieur** : c'est la règle de la température du jeu de base (Room.UsesOutdoorTemperature), pas celle de l'espace. Une pièce qui touche le bord de la carte, ou dont au moins un quart du sol est sans toit, prend l'air du dehors et compte comme l'extérieur ; une porte sous un toit est une pièce d'une seule case, donc l'intérieur. Elsewhere lit les pièces qu'il garde déjà pour la température (même règle : pièces fermées par des murs, de la roche ou des portes, moins d'un quart du sol sans toit).
- **Plancher** : une baisse ne descend pas sous le plancher, et un niveau déjà plus bas ne remonte pas pour autant. Sous un toit ordinaire, le colon reste donc à 20 % (syndrome de la cabane) ; seule la montagne mène à 0.
- **Au lit, éveillé** (un patient alité, un couple dans son lit), une baisse est cinq fois plus lente. Une hausse ne change pas.
- **Figé** pendant le sommeil, l'inconscience, dans un caisson de cryptosommeil, et à la mort ; une crise mentale ne le fige pas.
- **Porté** par un autre colon (sauvetage), le colon n'est plus sur la carte : le jeu de base le compte comme dehors à ciel ouvert.
- **Pendant un déplacement**, le jeu de base lit la case que le colon occupe encore, celle d'où il part, jusqu'à ce qu'il entre dans la suivante ; Elsewhere fait de même.

## Les pensées

| Niveau | Pensée | Humeur |
|---|---|---|
| au-dessus de 80 % | aucune | — |
| 80 % ou moins | Envie de prendre l'air | −1 |
| 60 % ou moins | Enfermé à l'intérieur | −3 |
| 40 % ou moins (jusqu'à 20 % compris) | Syndrome de la cabane | −5 |
| sous 20 % | Prisonnier sous terre | −7 |
| 5 % ou moins | Enseveli sous terre | −9 |

- Les **prisonniers** ont le besoin (il baisse et remonte comme celui des colons) mais pas la pensée : le jeu de base l'écarte pour toute personne gardée par une faction.
- La pensée n'existe que sur une carte : elle n'est pas valable pour une personne absente de la carte (portée, dans un caisson, en caravane).
- Les visiteurs, les pillards et les animaux n'ont pas ce besoin.

## En caravane et sur une autre carte

Dans le jeu de base, une personne en caravane n'est sur aucune carte : Need_Outdoors la compte comme dehors à ciel ouvert, et elle n'a pas de tâche, donc elle est éveillée sauf inconsciente. Le besoin **remonte de 8 par jour**, au même rythme de passage, de jour comme de nuit, et la pensée n'apparaît pas (elle n'est pas valable hors carte). Elsewhere fait de même : le pas est fait au passage des besoins propre à chaque membre de la caravane (après la nourriture, le repos et les loisirs, dans l'ordre des besoins du jeu de base).

Sur une carte temporaire (camp, site), les colons sont sur cette carte : les toits et pièces de cette carte s'appliquent, comme chez soi.

## Adaptations et limites

- **Trait Souterrain** (fait en [V362](trait-links-v362.md)) : le jeu de base désactive ce besoin pour un colon Souterrain (Undergrounder). Ce trait n'existe pas encore dans Elsewhere. Une seule fonction, `outdoorsNeedApplies359` dans `src/sim/outdoors-need-359.ts`, dit si une personne a le besoin : le futur trait devra la rendre fausse, et le besoin sera alors retiré au passage suivant, comme Pawn_NeedsTracker.RemoveNeed.
- **Invités** : le jeu de base donne aussi le besoin aux invités hébergés par la colonie ; Elsewhere le réserve aux colons et aux prisonniers, comme le besoin d'espace (V345).
- **Caravanes historiques** : une caravane sans état de voyage moderne (sauvegardes antérieures au schéma 256) garde le besoin figé jusqu'au retour.
- **Pièces** : Elsewhere lit les pièces de la température, recalculées au début de chaque tick et après chaque ordre ; une pièce dont les murs changent au milieu d'un tick est lue au tick suivant.
- **Flèche de tendance** : le jeu de base montre une flèche de hausse ou de baisse à côté de la jauge ; Elsewhere ne l'affiche pas.

## Sauvegardes

Le niveau est enregistré par personne à partir de 359 (nombre en simple précision entre 0 et 1), seulement lorsqu'il diffère de 100 % : un colon resté sous le ciel n'enregistre rien. Il est refusé dans une sauvegarde plus ancienne et s'il est malformé.

Une sauvegarde 358 passe à 359 en changeant seulement son numéro : chaque colon et prisonnier commence à 100 %. C'est ce que fait le jeu de base quand un besoin apparaît sur une personne qui existe déjà (Pawn_NeedsTracker.AddNeed appelle SetInitialLevel, qui vaut 1 pour ce besoin) ; rien n'est rétroactif, aucune pensée n'apparaît au chargement.

## Vérifications

`tests/outdoors-need-359.test.ts` (9 cas, vrais ticks de `stepWorld`) couvre :

- les catégories et leurs bornes, chaque vitesse, les planchers et le facteur au lit, en simple précision ;
- trois adultes, un sous une montagne, un sous un toit construit, un dehors : après deux passages, les niveaux exacts ; sur deux jours et demi, les cinq pensées dans l'ordre sous la montagne jusqu'à 0, l'arrêt à 20 % sous le toit, et rien pour celui qui est dehors ; la pensée pèse sur la cible d'humeur ;
- la sortie par une porte et la remontée jusqu'à 100 % ; une pièce avec un quart du sol sans toit (dehors), une case sans toit d'une pièce fermée (+5), un surplomb de montagne ouvert (−0,40) ; une porte sous un toit ;
- le gel pendant le sommeil, la baisse cinq fois plus lente au lit, le prisonnier sans pensée, la personne portée, le retrait du besoin chez un pillard ;
- une vraie caravane : la hausse de +8 au passage de chaque membre, sans pensée ;
- la jauge Plein air, son infobulle et la pensée dans l'onglet Besoins ;
- l'égalité au rechargement en pleine baisse, puis la même suite de la partie ; le refus des niveaux malformés ;
- sous 359 : ni besoin ni pensée, et sous le ciel la même partie, tick pour tick, qu'au schéma 358 (mêmes tirages) ;
- la migration 358 → 359 par le seul numéro et le refus du besoin dans une sauvegarde 358.

Tests voisins (besoins, humeur, toits, environnement, pensées de mort, caravanes, sommeil, départs, premiers jours, migrations ; 41 fichiers, 328 tests) : aucun échec nouveau. Un ancien échec, sans rapport avec ce lot, est corrigé au passage : la migration « par le seul numéro » de `tests/sleeping-sickness-309.test.ts` comparait encore avec la sauvegarde courante au lieu de la sauvegarde du schéma suivant (`asNumberOnly`). Les campagnes « Atterrissage » (24 jours, 28 min) et « prison » (après J42, 51 min) restent vertes au schéma 359.

Coût : un passage du besoin lit un toit (trois recherches dichotomiques dans les listes de toits), cherche la case dans les pièces fermées (un test d'intervalle et une recherche dichotomique par pièce) et vérifie qu'aucun colon ne porte la personne, une fois par colon ou prisonnier toutes les 150 ticks du jeu de base ; le lit n'est cherché que si le niveau baisse. Aucun parcours de la carte n'est ajouté. Mesure sur Les Forges (80 colons, 133 pièces fermées, banc empaqueté par esbuild, Node, machine partagée) : environ 5 µs par passage et par colon, soit 0,03 ms par macro-tick (moins de 0,1 % des 55 ms du tick) ; la pensée, lue quand le niveau est à 80 % ou moins, environ 3,5 µs. Sur le banc complet de 60 macro-ticks en alternance, 57,7 / 59,9 / 54,5 ms par macro-tick avant le lot contre 56,7 / 52,5 / 56,5 ms après : la différence reste dans le bruit.
