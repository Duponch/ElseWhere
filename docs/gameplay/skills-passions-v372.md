# Compétences et passions à la naissance V372

Jusqu'ici, une personne née dans Elsewhere recevait des niveaux de départ propres au jeu (des tirages locaux pour les candidats, des niveaux fixes selon le profil pour les autres), auxquels s'ajoutaient simplement les gains de son histoire et de ses traits ; ses passions venaient d'une règle locale (candidats) ou du profil (autres personnes). Le lot remplace ce calcul, pour toute personne née avec des histoires du jeu de base dans un monde du schéma 372, par **le calcul de RimWorld 1.6** (`PawnGenerator.GenerateSkills` et `FinalLevelOfSkill`). Une partie 371 migre par le seul numéro : personne ne voit ses compétences recalculées.

## Ce que fait le jeu

- **Niveau de chaque compétence**, dans l'ordre du jeu de base (Tir, Mêlée, Construction, Minage, Cuisine, Culture, Animaux, Artisanat, Art, Médecine, Social, Intellectuel) :
  - une base de 0 à 4 (tirage uniforme), sauf pour Animaux qui suit une courbe : surtout entre 0,5 et 4, rarement jusqu'à 15 (moyenne 3,04) ;
  - pour chaque histoire (enfance puis vie adulte) qui donne un gain dans cette compétence, ce gain multiplié par un facteur tiré entre 1 et 1,4 ;
  - le gain de chaque trait (Bagarreur Mêlée +4 et Tir −10, Gourmand Cuisine +4, Maladif Médecine +4…), sans tirage ;
  - au-delà de 35 ans, un facteur tiré entre 1 et un maximum qui monte jusqu'à 1,6 à 60 ans (aucun tirage jusqu'à 35 ans) ;
  - une courbe finale qui garde les valeurs jusqu'à 10 puis les tasse (16 à 20 points, 20 à 27 points et plus) ;
  - pour un mercenaire tireur (Tir 4 à 14), un soldat ancien (Tir 4 à 18) et les autres types du jeu de base qui en ont, un nouveau tirage dans la plage du type si la valeur en sort ;
  - un arrondi au plus proche (une demi-valeur va au nombre pair, comme `Mathf.RoundToInt`), borné entre 0 et 20.
- **Compétence indisponible.** Elle garde le niveau calculé, comme dans le jeu de base, mais compte pour 0 et ne reçoit jamais de passion.
- **Passions.** Un budget de 5 points plus un écart gaussien borné à ±4 (donc entre 1 et 9) ; tant qu'il reste au moins un point, une passion majeure coûte 1,5 point (à pile ou face quand il en reste au moins 1,5), une passion mineure 1 point. Les passions imposées par un trait sont données d'abord : l'artiste torturé a toujours une passion pour l'Art (majeure s'il reste une majeure). Puis les compétences reçoivent les passions de la plus haute à la plus basse, les majeures d'abord ; le bagarreur n'a jamais de passion pour le tir. En moyenne, environ trois passions et demie, dont une et demie à deux majeures.
- **Qui en profite.** Les candidats au départ (et chaque candidat renouvelé, qui reçoit un nouveau tirage), les voyageurs qui demandent à rejoindre, les réfugiés d'une capsule ou d'une quête d'asile, les pillards (donc les prisonniers qu'on en fait), les visiteurs, marchands et gardes, les voyageurs des cartes temporaires, les habitants des sarcophages anciens. Un prisonnier recruté garde les compétences avec lesquelles il est né.

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun texte ni code recopié).

- `PawnGenerator.GenerateSkills` : ordre `GiveAppropriateBioAndNameTo`, `GenerateTraits`, `GenerateBodyType`, `GenerateGenes`, `GenerateSkills` ; niveaux dans l'ordre de `DefDatabase<SkillDef>` ; budget de passions `5 + Clamp(Rand.Gaussian(), -4, 4)`, majeure à 1,5 point si `Rand.Bool`, mineure à 1 point ; passions imposées (`TraitDef.RequiresPassion`, `CreatePassion(force)`) sur chaque compétence non désactivée, puis toutes les compétences par niveau décroissant (`OrderByDescending`, tri stable sur `GetLevel(includeAptitudes: false)`), sauf désactivées et passions en conflit (`TraitDef.ConflictsWithPassion`). Sous 13 ans, des passions de moments de croissance remplacent ce dernier passage.
- `PawnGenerator.FinalLevelOfSkill` : base `Rand.RangeInclusive(0, 4)` si `SkillDef.usuallyDefinedInBackstories`, sinon `Rand.ByCurve(LevelRandomCurve)` ; `amount × Rand.Range(1, 1.4)` par gain d'histoire (`Pawn_StoryTracker.AllBackstories`, enfance puis vie adulte) ; gains des degrés de trait ; `× Rand.Range(1, AgeSkillMaxFactorCurve(âge))` (`Rand.Range` ne tire pas quand le maximum vaut au plus 1) ; `× AgeSkillFactor(âge)` ; `LevelFinalAdjustmentCurve` ; `PawnKindDef.extraSkillLevels` si positif ; plage `PawnKindDef.skills` (nouveau `RandomInRange` hors plage) ; `Mathf.Clamp(Mathf.RoundToInt(x), 0, 20)`. L'âge est `AgeBiologicalYears`, en années entières.
- Courbes : `AgeSkillMaxFactorCurve` (0 ; 0) (10 ; 0,7) (35 ; 1) (60 ; 1,6) ; `AgeSkillFactor` (3 ; 0,2) (18 ; 1) ; `LevelFinalAdjustmentCurve` (0 ; 0) (10 ; 10) (20 ; 16) (27 ; 20) ; `LevelRandomCurve` (0 ; 0) (0,5 ; 150) (4 ; 150) (5 ; 25) (10 ; 5) (15 ; 0). `SimpleCurve.Evaluate` (bornée aux extrémités, `Mathf.Lerp`), `Rand.ByCurve` (segment tiré selon son aire, point uniforme, puis réflexion selon la pente), `Rand.Gaussian` (Box-Muller sur deux valeurs), `Rand.Bool` (valeur < 0,5).
- `Skills.xml` : ordre des douze compétences ; `usuallyDefinedInBackstories` faux pour Animaux seulement ; `disablingWorkTags` Violent pour Tir et Mêlée. `SkillRecord` : le niveau est fixé même pour une compétence désactivée (`levelInt`), `GetLevel` rend 0 quand elle est totalement désactivée ; aucune expérience à la naissance.
- `Traits_Singular.xml` : `forcedPassions` Art pour l'artiste torturé, `conflictingPassions` Tir pour le bagarreur (aucun autre trait du jeu de base n'en a).
- `PawnKindDefs_Humanlikes` : `skills` Tir 4~14 (mercenaire tireur et sa variante acide), 8~16 (tireur d'élite et variante, inconnu en noir), 10~15 (mercenaire d'élite et variante), 4~18 (soldat ancien) ; aucun type n'a `extraSkillLevels`.

## Adaptations

- **Tirages.** Ils suivent l'ordre du jeu de base sur un flux privé de la naissance (graine et identité de la personne), séparé de celui des histoires et des traits, pas sur `Verse.Rand` : les niveaux ne sont pas identiques bit à bit à ceux du jeu de base pour une même graine. Les calculs reproduisent la précision simple des nombres du jeu.
- **Demande d'accueil.** Les compétences d'un voyageur sont tirées sur l'identité de sa demande, si bien que la demande peut montrer exactement la personne qui arrivera (`arrivalOfferSkills372`). L'asile d'une quête tire ses traits à l'arrivée, comme avant : sa lettre ne peut pas montrer les niveaux définitifs.
- **Hors périmètre.** Les chefs de faction naissent toujours sans histoire et gardent leurs niveaux d'Elsewhere. Les personnes au passé d'Elsewhere (avant le schéma 370, scénarios préparés) gardent l'ancien calcul. Les passions des moments de croissance ne sont pas reprises : Elsewhere ne fait naître que des adultes de 18 ans et plus. Les gènes et aptitudes (Biotech) et les compétences imposées par une extension n'existent pas.

## Ce qui reste

- La lettre de demande d'accueil et le dossier de l'asile affichent encore l'aperçu historique (gains ajoutés aux niveaux du profil) : l'interface doit lire `arrivalOfferSkills372` pour un voyageur ; pour l'asile, l'aperçu reste indicatif.
- Le tirage identique bit à bit à `Verse.Rand` reste un projet séparé.

## Sauvegarde

Aucun champ nouveau : les niveaux (0 à 20), passions (0 à 2) et expériences gardent leur forme, et une personne née au schéma 372 a les douze compétences. Une partie 371 migre par le seul numéro ; toute naissance d'un monde plus ancien garde exactement son ancien calcul.

## Contrôles

`tests/skills-passions-372.test.ts` : courbes, moyenne de `Rand.ByCurve` (3,0424) et arrondi au pair ; flux scripté aux niveaux et passions calculés à la main ; facteur d'âge et plage du type ; moyenne et bornes des niveaux contre la formule par âge et par gain d'histoire ; nombre de passions et de majeures contre le budget gaussien ; passions aux plus hauts niveaux, majeures d'abord, jamais sur une compétence indisponible ; bagarreur et artiste torturé ; compétence indisponible à son niveau calculé ; candidat de bout en bout (même histoire et mêmes traits qu'au schéma 371) ; règle du tutoriel ; pillard (plage du mercenaire), voyageur accepté identique à sa demande ; sauvegarde et reprise ; migration 371 par le seul numéro ; naissances inchangées sous 372 (valeurs du schéma 371).
