# Traits du jeu de base — V361

**Schéma 361.** Elsewhere ne connaissait que 9 des 43 traits de RimWorld 1.6. Ce lot ajoute tous ceux dont un effet trouve un système existant, les tire comme le jeu de base pour chaque nouvel humain, et branche leurs pensées et opinions. Les références sont les définitions `Defs/TraitDefs/Traits_Singular.xml` et `Traits_Spectrum.xml`, `Defs/ThoughtDefs/*` et les classes décompilées `PawnGenerator`, `TraitDef`, `MentalBreaker`, `MentalBreakWorker`, `TraitMentalStateGiver`, `ThoughtUtility` et les `ThoughtWorker_*` cités plus bas.

## Tirage des traits

Comme `PawnGenerator.GenerateTraits` (jeu de base sans Biotech) :

- **nombre** : 1, 2 ou 3 traits à chances égales (`TraitsCountRange` 1–3), plafonné par les anniversaires de croissance atteints (7, 10 et 13 ans) ; un tirage par anniversaire ;
- **choix** : chaque essai tire une définition de trait selon sa fréquence (`commonality`, et `commonalityFemale` pour misandre et misogyne), puis un degré au hasard ; jusqu'à 501 essais ;
- **refus** : une définition déjà tenue, un conflit (listes `conflictingTraits` dans les deux sens et étiquettes d'exclusion : orientation, apprentissage lent/rapide), un travail requis que le passé interdit (Violent pour Sanguinaire, Bagarreur et les deux traits de tir ; Social pour Incisif ; Intellectuel pour Trop intelligent), un trait interdit aux hostiles (aucun parmi ceux livrés) ;
- **seuil de crise** : le jeu de base refuse un trait qui porterait le seuil de crise mineure au-delà de 50 %, mais il lit ce seuil dans un cache de 5 ticks, donc avant le tirage (35 %) : aucun trait du jeu de base n'est jamais refusé ainsi, Elsewhere fait de même ;
- **orientation** : sans trait d'orientation tiré, un dernier tirage oppose « rien » (somme des fréquences de toutes les autres définitions non tenues, y compris celles non livrées) à Homosexuel 0,3, Bisexuel 0,2 et Asexuel 0,2 ;
- **compétences** : Bagarreur Mêlée +4 et Tir −10, Gourmand Cuisine +4, Maladif Médecine +4, ajoutés au niveau de naissance ; un bagarreur n'a jamais de passion pour le tir (`conflictingPassions`).

Les quatre définitions non livrées (voir plus bas) ne sont jamais tirées : leur part se répartit sur les autres, comme si le jeu de base les avait refusées.

**Qui reçoit ces traits.** Les huit candidats d'une nouvelle partie (tirés avant tout monde) et, dans un monde du schéma 361, tout humain qui y naît : visiteurs, marchands, pillards, voyageurs des cartes temporaires, caravanes rencontrées ou ennemies, réfugié d'une capsule, recrue d'une quête, demande d'accueil, dormeurs anciens, chefs de faction. Chaque tirage est un hachage privé de la graine et de l'identité de la personne : aucun flux de hasard existant ne bouge. Une demande d'accueil montre ses traits avant que la personne existe : son sexe n'étant pas encore tiré, misandre et misogyne y prennent la moyenne de leurs deux fréquences (adaptation).

**Le tutoriel** ne tire que des candidats capables de se battre ; c'est toujours le cas (les traits ne retirent aucun travail).

**Couples de départ.** Comme `LovePartnerRelationGenerationChance`, un couple de même sexe n'est tiré que si le premier des deux est homosexuel, et jamais un couple de sexes différents dont le premier l'est.

**Ce qui ne change pas.** Les personnes existantes gardent leurs traits. Le camp écrit à la main d'une partie sans choix des colons (Ada, Noé, Mina) et les scènes préparées gardent leurs traits d'auteur. En dessous du schéma 361, chaque tirage reste identique au bit près (vérifié sur 160 candidats et 48 groupes de départ contre le code du schéma 358). Migration 360 → 361 par le seul numéro : aucun trait n'est donné après coup. Conséquence voulue : dans une colonie migrée, une personne sans trait d'orientation suit la règle du jeu de base (attirée par l'autre sexe) ; un couple de même sexe déjà formé reste uni, et ses moments intimes gardent le plancher de 0,1 de `GetLovinMtbHours`.

## Effets livrés

| Trait (degré) | Effets dans Elsewhere |
|---|---|
| Jovial / Optimiste / Pessimiste / Dépressif | humeur +12 / +6 / −6 / −12 en permanence |
| Volonté de fer / Résolu / Nerveux / Instable | seuil de crise mineure −18 / −9 / +8 / +15 points (majeur et extrême proportionnels, seuil borné à 1–50 comme le jeu de base) |
| Névrosé / Très névrosé | vitesse de travail générale +20 % / +40 %, seuil de crise +8 / +14 |
| Bourreau de travail / Travailleur / Paresseux / Indolent | vitesse de travail générale +35 % / +20 % / −20 % / −35 % ; les deux premiers ont une opinion −5 des colons sans ce trait, −20 des paresseux, −30 des indolents |
| Coureur / Marcheur rapide / Lambin | vitesse de marche de base 5 / 4,8 / 4,4 cases par seconde au lieu de 4,6 |
| Trop intelligent | apprentissage +75 %, seuil de crise +12 |
| Apprentissage rapide / lent | apprentissage +75 % / −75 % (inchangé) |
| Tireur prudent / Gâchette facile | visée ×1,25 / ×0,5 (arrondie au tick comme `SecondsToTicks`), précision comme ±5 niveaux de Tir |
| Bagarreur | toucher en mêlée comme +4 niveaux, humeur −10 en portant une arme à distance, compétences de naissance |
| Agile | esquive en mêlée comme +15 niveaux, déclenche les pièges ×0,1 |
| Coriace | dégâts subis ×0,5 après l'armure : balles, coups, pièges à pointes, explosions, flammes, éboulements de toit |
| Super-immunisé | gain d'immunité ×1,3 |
| Maladif | contracte seul une maladie tous les 30 jours en moyenne (test tous les 60 ticks du jeu de base), tirée selon les maladies de la région ; les maladies absentes du jeu gardent leur part et ne donnent rien ; Médecine +4 |
| Petit dormeur | repos regagné ×1,5 en dormant (lit, sol, repos médical, caravane) |
| Gourmand | faim ×1,5 ; à l'intensité mineure, la frénésie alimentaire est la seule crise possible ; frénésie spontanée tous les 50 jours en moyenne, à toute humeur (`randomMentalState`) ; Cuisine +4 |
| Psychiquement hypersensible / sensible / terne / sourd | l'onde psychique et l'apaisement pèsent ×1,8 / ×1,4 / ×0,5 / ×0 sur l'humeur |
| Magnifique / Joli / Laid / Horriblement laid | opinion +40 / +20 / −20 / −40 des autres (sauf aimables, ascètes, aveugles) ; en amour, beauté positive ×2,3, négative ×0,3 |
| Homosexuel / Bisexuel / Asexuel | en amour (tentatives de séduction, réponse et moments intimes), attiré seulement par le même sexe / par les deux / par personne ; sans ce trait, seulement par l'autre sexe |
| Voix agaçante / Respiration inquiétante | opinion −25 des autres qui entendent, sauf les aimables |
| Misandre / Misogyne | opinion −25 de chaque homme / femme |
| Transhumaniste | humeur −4 sans partie artificielle, puis +4, +7, +9, +11, +12, +13 ; opinion +8 par partie artificielle d'autrui (au plus +40) |
| Puriste du corps | humeur −10 à −35 selon ses parties artificielles ; opinion −8 par partie artificielle d'autrui (au plus −40) |
| Nudiste | humeur +20 sans vêtement couvrant torse ou jambes, −3 sinon |
| Oiseau de nuit | éveillé, +16 de 23 h à 5 h, −10 de 11 h à 17 h ; pas de pensée d'obscurité |
| Avide | −8 sans chambre à lui, −8 / −8 / −6 / −4 dans une chambre affreuse / terne / médiocre / convenable |
| Jaloux | −8 si un autre colon a une chambre plus impressionnante d'au moins 10 % |
| Ascète | +5 / +4 / +3 dans une chambre affreuse / terne / médiocre, −5 dès « légèrement impressionnante » ; pas de pensée « mangé sans table » ; ne juge pas l'apparence |
| Masochiste | la douleur donne +5 / +10 / +15 / +20 au lieu de −5 à −20 |
| Psychopathe | aucune pensée de mort ou de perte d'un colon ou d'un ami, de mort vue, de cadavre frais aperçu, de colon sans sépulture, d'animal lié (mort, perdu, maître ou non), de câlin, de prisonnier libéré, d'accueil refusé ; les discussions ne changent pas son opinion |
| Cannibale | pas de pensée de cadavre frais aperçu |
| Sanguinaire, Aimable, Incisif | inchangés ; Aimable ignore maintenant aussi beauté, voix et respiration |
| Abstinent | ne boit jamais de bière par politique, pour le plaisir ou pour en porter, et ne fait jamais de frénésie alcoolique ; opinion −20 / −30 des colons attirés / fascinés par les drogues, et réciproquement |
| Attiré / Fasciné par les drogues | frénésie alcoolique choisie ×2,5 / ×5 lors d'une crise majeure |
| Grande mémoire | perte d'expérience au-delà du niveau 10 divisée par deux |

La vitesse de travail générale (`WorkSpeedGlobal`) multiplie les mêmes travaux que dans le jeu de base : construction, réparation, minage et forage profond, travaux des plantes, lissage, soins et opérations, cuisine et toutes les factures sauf la boucherie, fonte, déneigement, récolte des produits animaux. La recherche et le scanner profond n'en dépendent pas (`ResearchSpeed` n'a pas ce facteur).

Les pensées liées à la carte (oiseau de nuit, chambres) disparaissent en caravane comme dans le jeu de base ; nudiste, masochiste, bagarreur et parties artificielles restent valables hors carte.

## Laissés de côté

Souterrain, Artiste torturé et Douillet ont été ajoutés au schéma 362, avec les règles d'inspiration des traits : voir [V362](trait-links-v362.md). Pyromane reste de côté.

- **Pyromane** : sa seule crise extrême et sa crise spontanée (`FireStartingSpree`) n'existent pas ; le donner avec son seul refus de lutter contre le feu en ferait un trait presque inoffensif.
- **Douillet** (`Wimp`, seuil de choc de douleur 0,3) : le seuil est lu partout depuis le seul dossier médical, y compris dans une dizaine de validations de sauvegarde ; il faudrait d'abord porter ce seuil dans le dossier.
- **Souterrain** : le besoin d'extérieur est construit en parallèle par le lot 359 et n'existe pas ici.
- **Artiste torturé** : les inspirations sont construites en parallèle par le lot 360.
- Effets absents de traits livrés : le besoin de drogue (`Need_Chemical_Any`) et ses pensées ; la viande humaine (cannibale) ; les armes incendiaires ; la valeur marchande des humains (`marketValueFactorOffset`), absente du jeu ; les objets de départ propres à chaque trait (`possessions`) ; la méditation (Royalty) et la certitude (Ideology) ; l'inspiration Frenzy des lambins et bagarreurs (lot 360) ; la dépendance d'un abstinent (laissée telle quelle).

## Interface

L'onglet **Bio** de l'inspecteur, la fiche des candidats et la demande d'accueil montrent le nom français de chaque trait ; le survol donne une description écrite pour Elsewhere, qui énonce ses effets réels ici. Les pensées et opinions apparaissent dans **Besoins** et **Social** avec leur cause.

## Vérifications

`tests/traits-361.test.ts` (18 cas) : nombre de traits, fréquences du premier tirage dans l'écart attendu autour de la fréquence du jeu de base, misogynie selon le sexe, absence de conflit, travaux requis, anniversaires de croissance, candidats du tutoriel capables de se battre, tirages historiques identiques sous 361, couples de départ, naissances dans un monde 361 ; à travers de vrais ticks : vitesse de travail, vitesse de marche, seuil de crise, pensées d'humeur (jovial, oiseau de nuit, psychopathe), opinions (joli, misandre), discussion sans souvenir pour un psychopathe ; frénésie spontanée d'un gourmand et maladie d'un maladif à leur cadence du jeu de base ; sauvegarde et reprise ; refus sous 361 et migration par le seul numéro.

Campagne « Atterrissage » (24 jours, `tests/crashlanded-colony.test.ts`) verte au schéma 361 : ses trois colons gardent leurs traits d'auteur, les visiteurs et pillards reçoivent désormais leurs traits du jeu de base.

**Coût.** Les effets sont lus là où le jeu calcule déjà la valeur concernée (vitesse de travail et de marche, dégâts, repos, faim, opinions, pensées), sans parcours de carte. La frénésie du gourmand et la maladie du maladif suivent les intervalles du jeu de base (150 et 60 ticks par personne) et un tirage privé sans état. Sur Les Forges (80 colons aux traits de scénario, banc empaqueté par esbuild, 60 macro-ticks, cinq passages alternés) : état final identique au bit près avec et sans ce lot, 56,7 contre 56,0 ms par macro-tick en médiane, écart dans le bruit de la mesure (+1 à +3 %).
