# Les traits qui relient la vague 5 — V362

**Schéma 362.** La vague 5 a livré en parallèle, sans qu'aucun lot voie les autres, le besoin de plein air (V359), les inspirations (V360) et les traits du jeu de base (V361). Ce lot ajoute les traits qui dépendent de ces trois systèmes et les règles qui les relient : **Souterrain**, **Artiste torturé** et **Douillet** rejoignent le tirage des traits, le bagarreur et le lambin perdent chacun une inspiration, et une crise qui n'est pas causée par l'humeur ne donne plus de catharsis. Seul **Pyromane** reste de côté (voir plus bas).

Sources : RimWorld 1.6.4871, définitions `Defs/TraitDefs/Traits_Singular.xml` et `Traits_Spectrum.xml`, `Defs/NeedDefs/Needs.xml`, `Defs/ThoughtDefs/Thoughts_Situation_Needs.xml`, `Thoughts_Situation_Traits.xml`, `Thoughts_Situation_TraitsPerm.xml`, `Thoughts_Situation_General.xml`, `Defs/MentalStateDefs/MentalStates_Mood.xml`, `Defs/Misc/RoofDefs/Roofs.xml`, et classes décompilées `Need_Indoors`, `Need`, `Pawn_NeedsTracker`, `ThoughtWorker_NeedIndoors`, `ThoughtWorker_IsIndoorsForUndergrounder`, `ThoughtWorker_IsUndergroundForUndergrounder`, `ThoughtWorker_IsOutdoorsForUndergrounder`, `Trait` (`Notify_MentalStateEndedOn`), `TraitDegreeData`, `MentalState` (`RecoverFromState`), `MentalStateHandler`, `MentalBreaker`, `TraitMentalStateGiver`, `InspirationHandler`, `InspirationWorker`, `PawnGenerator` (`GenerateTraitsFor`, `GenerateSkills`). Aucun texte ni code du jeu n'est repris.

## Souterrain (`Undergrounder`)

Fréquence 0,2. Dans le jeu de base, plusieurs passés imposent ce trait ; ceux d'Elsewhere n'imposent aucun trait.

- **Pas de besoin de plein air** (`disablesNeeds Outdoors`) : la jauge Plein air disparaît, comme `Pawn_NeedsTracker.RemoveNeed`. Le crochet `outdoorsNeedApplies359` prévu par le lot 359 le dit faux pour un souterrain.
- **Besoin d'intérieur** (`enablesNeeds Indoors`, `Need_Indoors`), colons et prisonniers seulement, 100 % au départ, figé pendant le sommeil. À chaque passage des besoins (150 ticks du jeu de base), selon l'endroit où il se tient (même règle que le plein air : pièces qui gardent leur air, case d'origine pendant un pas) :

  | Endroit | Variation par jour |
  |---|---|
  | À l'intérieur, sous la roche épaisse | +2 |
  | À l'intérieur, sous un toit construit ou de roche mince | +1 |
  | À l'intérieur, case sans toit | 0 |
  | Dehors, sous la roche épaisse | 0 |
  | Dehors, sous un toit mince ou sans toit | −0,25 |
  | Porté, en caravane (pas sur la carte) | −0,25 |

  Pas de plancher, pas de facteur au lit (le jeu de base n'en a pas pour ce besoin).
- **Pensée du besoin** (`NeedIndoors`, pas pour les prisonniers) : à 80 % ou moins « Un peu trop dehors » −1 ; 60 % « Trop longtemps dehors » −3 ; 40 % « Dehors bien trop longtemps » −5 ; 20 % « Perdu dans les grands espaces » −7 ; 5 % ou moins « Écrasé par le ciel » −8 (seuils stricts du jeu de base).
- **Pensées du trait**, éveillé et sur la carte : à l'intérieur sous un toit construit « Souterrain à l'intérieur » +3 ; à l'intérieur sous la roche (mince ou épaisse, `isNatural`) « Souterrain sous la roche » +4 ; dehors ou sous une case sans toit « Souterrain dehors » −3.
- **Obscurité** : la pensée d'obscurité ne le touche pas (`nullifyingTraits` de `EnvironmentDark`, comme l'oiseau de nuit).

Interface : l'onglet **Besoins** montre la jauge **Intérieur** à la place de **Plein air**, avec son infobulle.

## Artiste torturé (`TorturedArtist`)

Fréquence 0,6.

- **Humeur −8** en permanence (`MoodOffsetTorturedArtist`, valable aussi hors carte).
- **Inspiration après une crise** : quand une crise **causée par l'humeur** prend fin d'elle-même (fin naturelle, à terre, au réveil ; jamais à la mort), le jeu de base tire `Rand.Value` et, à 0,5 ou moins, tente une **créativité inspirée** (`mentalBreakInspirationGainSet`, `mentalBreakInspirationGainChance 0,5`). La tentative échoue si le colon est déjà inspiré ou si la créativité ne l'admet pas (âge, compétences, travaux, manipulation). La lettre bleue donne la raison propre au trait.
- **Passion forcée pour l'art** (`forcedPassions Artistic`) : il a toujours au moins une passion mineure pour l'art, sauf si son passé lui interdit l'art ; dans ce cas le trait n'est jamais tiré (`GenerateTraitsFor`).

## Douillet (`Wimp`)

Fréquence 1 ; jamais pour un hostile (`allowOnHostileSpawn false`) ; incompatible avec Bagarreur et Masochiste.

- **Seuil de choc de douleur 30 %** au lieu de 80 % (`PainShockThreshold` −0,5 sur 0,8) : il s'effondre dès 30 % de douleur. L'onglet Santé affiche son seuil.

## Inspirations et traits

`InspirationWorker.InspirationCanOccur` refuse une inspiration qu'un trait interdit (`disallowedInspirations`). Dans le jeu de base, seuls deux degrés en ont : **Bagarreur** ne reçoit jamais de frénésie de tir, **Lambin** jamais de frénésie de mouvement. Aucune définition d'inspiration ne lit de trait. La règle vaut pour le tirage et pour toute autre tentative (artiste torturé compris).

## Crises qui ne viennent pas de l'humeur

Le jeu de base distingue une crise causée par l'humeur (`MentalBreaker`, `causedByMood` vrai) d'un état donné par un trait (`TraitMentalStateGiver`, la frénésie spontanée du gourmand) ou par une dépendance (la frénésie alcoolique du sevrage) : seule la première donne la **catharsis** à sa fin (`moodRecoveryThought`) et la chance d'inspiration de l'artiste torturé. Depuis 362, une crise de la seconde sorte porte une marque `notMood362` à son début ; à sa fin, ni catharsis ni tirage de l'artiste. En V361, la frénésie spontanée du gourmand donnait une catharsis : c'est corrigé à partir de 362 seulement.

## Tirage

À partir de 362, le tirage des traits (candidats d'une nouvelle partie, toute personne née dans un monde 362) inclut les trois nouvelles définitions, avec les fréquences du jeu de base ; les autres définitions perdent la part correspondante. En dessous, chaque tirage reste celui du code 361 au bit près (vérifié sur 240 candidats et 2 000 naissances). La règle du tutoriel est inchangée : ses candidats peuvent tous se battre (aucun des trois traits ne retire de travail).

## Adaptations

- **Passion forcée** : Elsewhere tire les passions avec sa propre répartition, avant les traits. La passion forcée est ajoutée ensuite (au moins mineure, sans tirage et sans prendre de place dans le budget) ; le jeu de base la crée en premier et lui donne une passion majeure s'il lui en reste. Le refus au tirage (passé qui interdit l'art) s'applique à toute naissance ; le jeu de base ne le fait que pour une personne qui a déjà des réglages de travail.
- **Seuil de douleur dans le dossier médical** : toutes les vérifications d'état lisent le seul dossier médical, y compris les validations de sauvegarde. Un douillet reçoit donc son dossier à la naissance, marqué `wimp362`, qui suit le dossier partout (copies, caravanes, archives). La sauvegarde vérifie que la marque et le trait vont ensemble.
- **Tirage de l'artiste** : sur un flux propre, fonction de la graine, de la personne et du tick (`trait-links-stream-362.ts`) ; aucun autre flux ne bouge.
- **Besoin d'intérieur des invités** : réservé aux colons et prisonniers, comme le plein air (V359) et l'espace (V345).
- **Jauge pleine** : un niveau de 100 % n'est pas enregistré (comme l'absence de champ).

## Laissés de côté

- **Pyromane** : sa crise extrême et sa crise spontanée (`FireStartingSpree`, 6 000 à 10 000 ticks) demandent un nouvel état mental avec sa propre tâche — chercher dans la région permise la plus proche un bâtiment, objet ou plante inflammable, s'y rendre et l'allumer (`JobGiver_FireStartingSpree`, 75 %, avec errance et attentes de 80 à 140 ticks) — alors que le feu d'Elsewhere ne naît que d'impacts, de foudre ou d'explosions ; le trait interdit aussi la lutte contre le feu, et les travaux d'Elsewhere ne sont retirés que par le passé (les traits n'en retirent aucun) ; enfin deux de ses trois pensées portent sur des armes incendiaires absentes. C'est un lot à part entière, pas un branchement.
- Les objets de départ des traits (`possessions` : champignons crus du souterrain, teinture de l'artiste), la méditation (Royalty), la certitude (Ideology), la valeur marchande du douillet.
- La flèche de tendance de la jauge Intérieur.

## Sauvegardes

Nouveaux champs, refusés en dessous de 362 et malformés : les trois identifiants de trait ; `indoors362` (niveau en simple précision entre 0 et 1, seulement sur un souterrain, et jamais avec le plein air) ; `wimp362: true` dans le dossier médical d'un humain douillet ; `notMood362: true` sur une crise. Une sauvegarde 361 passe à 362 par le seul numéro : aucun trait, besoin ou marque n'apparaît, et une crise en cours d'une partie 361 reste comptée comme causée par l'humeur.

## Vérifications

`tests/trait-links-362.test.ts` (9 cas, vrais ticks de `stepWorld`) : données du jeu de base, conflits et refus sous 362 ; fréquences du premier tirage à 362 autour de la fréquence du jeu de base, aucun douillet hostile, tirages 361 identiques au code d'origine (empreintes calculées sur origin/main), candidats 362 avec leurs effets de naissance, candidats du tutoriel capables de se battre ; trois souterrains (sous la montagne, sous un toit construit, dehors) : niveaux exacts après deux passages, aucun plein air, les pensées du jeu de base, remontée à 100 % et baisse dehors, seuils, obscurité, caravane, jauge de l'onglet Besoins, lecture stricte ; un artiste torturé se remet d'une errance triste et reçoit une créativité inspirée (tirage forcé à 0,5 par le module du flux ; à 0,5000001 rien), déjà inspiré il n'en reçoit pas d'autre ; une crise non causée par l'humeur sans catharsis ni tirage, la frénésie spontanée du gourmand marquée par de vrais ticks, et à 361 la catharsis inchangée ; un bagarreur sans frénésie de tir à 362 mais avec à 361 (mêmes tirages forcés), un lambin sans frénésie de mouvement ; un douillet à terre à 50 % de douleur quand un autre reste debout, et le lien trait-marque vérifié à la lecture ; sauvegarde, rechargement et même suite ; migration 361 → 362 par le seul numéro et refus de chaque champ 362 dans une sauvegarde 361.
