# Compléter les humeurs et les crises du jeu de base — schéma 350

Schéma 350. Une colonie ordinaire rencontre, dès ses premières saisons, des crises, des pensées et des événements d'humeur qu'Elsewhere n'avait pas encore : trois crises mineures, l'errance psychotique, le bourdonnement et l'apaisement psychiques que Cassandra tirait déjà sans effet, le confort d'une chaise à l'établi, quelques petites pensées, les câlins des animaux et le sommeil perturbé.

Les règles viennent des définitions et du code du jeu de base RimWorld 1.6 (ThoughtDefs, MentalStates_Mood.xml, Incidents_Map_Misc, GameConditions_Misc, ThinkTreeDefs ; MentalBreakWorker, MentalState_InsultingSpree et ses deux variantes, InsultingSpreeMentalStateUtility, JobGiver_InsultingSpree, JobDriver_Insult, MentalStateWorker_WanderOwnRoom, JobGiver_WanderOwnRoom, IncidentWorker_PsychicEmanation/Drone/Soothe, GameCondition_PsychicEmanation, ThoughtWorker_PsychicDrone, Toils_Recipe, PawnUtility.GainComfortFromCellIfPossible, ThoughtWorker_HospitalPatientRoomStats, Thought_OpinionOfMyLover, JobDriver_ReleasePrisoner, GenGuest, Pawn_RelationsTracker.Notify_RescuedBy, ThinkNode_ChancePerHour, JobGiver_Nuzzle, JobDriver_Nuzzle, InteractionWorker_Nuzzle, Pawn.CheckForDisturbedSleep, GenClamor, Pawn_PathFollower) ; aucun code ni texte n'en est repris.

Tout ne vaut qu'à partir du schéma 350 : avant, aucun tirage ni comportement ne change. La migration 349 → 350 ne change que le numéro ; rien n'est offert après coup.

## Crises mineures : la réserve complète

Le jeu de base tire une crise mineure parmi cinq, avec ces poids :

| Crise | Poids | Durée (ticks) | Condition |
|---|---|---|---|
| Frénésie alimentaire | 0,8 | 25 000 à 45 000 | — |
| Errance triste | 0,5 | 40 000 à 60 000 | — |
| **Retraite dans sa chambre** | 0,5 | 40 000 à 60 000 | un lit attribué dans une pièce qui n'est pas « à l'air libre » |
| **Série d'insultes** | 0,5 | 25 000 à 45 000 | pouvoir parler, au moins deux personnes à insulter |
| **Série d'insultes ciblée** | 0,5 | 25 000 à 45 000 | pouvoir parler, au moins une personne libre à insulter |

Le total vaut 2,8 : la frénésie alimentaire ne pèse plus que 29 % des crises mineures (contre 62 % auparavant). Les options sont lues dans l'ordre des définitions du jeu de base avant tout tirage ; une recherche différée reporte la décision sans rien tirer. Toutes guérissent avec un temps moyen de 0,166 jour après leur durée minimale et donnent la catharsis habituelle.

- **Retraite dans sa chambre** : le colon rejoint son lit et erre dans sa chambre, à moins de 7 cases du lit, en attendant 300 à 600 ticks entre deux pas. Il mange et dort encore en cas de besoin extrême.
- **Série d'insultes** : le colon choisit une cible, plus volontiers proche (poids 1 − distance/40 + 0,01), parmi les colons et prisonniers éveillés, debout, à moins de 40 cases et joignables. Il la rejoint, attend au moins 1 200 ticks depuis sa dernière insulte et 120 depuis sa dernière interaction, puis l'insulte (opinion et pensée « Insulté » habituelles). Tous les 250 ticks, une fois sa cible insultée, il en choisit une autre ; après 1 250 ticks sur la même, il en préfère une autre. Sans cible, il erre dans la colonie.
- **Série d'insultes ciblée** : le colon suit une seule personne libre et l'insulte encore et encore. Si elle s'endort, devient injoignable ou disparaît, il en choisit une autre, ou la crise cesse faute de victime. Elle ne peut finir avant son terme qu'après une première insulte.

## Crise majeure : l'errance psychotique

L'**errance psychotique** (poids 1, 70 000 à 90 000 ticks) rejoint la frénésie alcoolique et la crise de destruction, dans l'ordre du jeu de base. Sans bière ni bâtiment à briser, c'est désormais elle qui survient au lieu de retomber sur une crise mineure. Le colon erre comme dans l'errance triste ; à la différence de celle-ci, **dormir n'y met pas fin**. Les prisonniers peuvent aussi la subir.

## Bourdonnement et apaisement psychiques

Cassandra tirait ces deux incidents sans effet. Ils ont maintenant leur condition sur la carte :

- impossibles si l'un des deux est déjà actif, sans colon libre sur la carte, ou dans les 15 jours qui suivent le précédent du même type ;
- durée : 0,75 à 1,75 jour pour le bourdonnement, 1,5 à 3 jours pour l'apaisement ;
- genre : celui d'un colon libre tiré au hasard sur la carte ;
- niveau du bourdonnement selon les points de menace de la colonie : faible sous 800, modéré sous 2 000, fort au-delà.

Chaque personne de ce genre sur la carte a la pensée correspondante : apaisement psychique +16, bourdonnement faible −12, modéré −22, fort −30. La condition s'affiche avec les autres conditions de la carte (titre, durée restante, conseils) et sa fin est annoncée.

## Chaise à l'établi

Un colon qui travaille une facture debout sur la case de travail d'un établi gagne du confort si un siège (tabouret, chaise, fauteuil) s'y trouve, comme à table ou au bureau de recherche.

## Petites pensées

| Pensée | Effet | Quand |
|---|---|---|
| Hôpital (affreux à merveilleux) | −4, −2, puis +1 à +6 | allongé dans un lit médical d'une pièce qui est un hôpital (un lit médical, aucun lit de prison), selon l'impression que donne la pièce |
| Prisonnier libéré | +2, 6 jours, un par prisonnier, cinq au plus | chaque colon et prisonnier, quand un prisonnier en bonne santé (debout, saignant peu) est libéré |
| M'a secouru | opinion +15, 30 jours, trois par secouriste | le colon porté jusqu'à un lit par un autre, envers son secouriste |
| Sentiment envers son partenaire | un dixième de l'opinion, au moins ±1 | envers le partenaire ou le conjoint le plus apprécié, s'il est un colon |
| Compagnon lié mort | −8, 20 jours | le colon lié à un animal qui meurt |
| Compagnon lié perdu | −8, 20 jours | le colon lié à un animal laissé sur une carte abandonnée |

## Câlins des animaux

Un animal de la colonie dont l'espèce câline (chat, terriers, labradors, huskies toutes les 12 heures en moyenne ; cochons d'Inde et singes toutes les 24 heures) vérifie au plus une fois par heure s'il en a envie. Si oui, il choisit au hasard un colon éveillé, non mobilisé et pas en crise violente, à moins de 40 cases, dans la même pièce et dans sa zone autorisée, va le toucher et se frotte contre lui : **« Câlin d'un animal » +4** pour un jour ; trois câlins au plus, chacun suivant comptant à moitié (+4, +6, +7). Le trajet expire après 3 000 ticks.

## Sommeil perturbé

Une personne qui marche fait du bruit en moyenne une case sur douze. Un colon endormi à moins de 7 cases (selon son ouïe), dans la même pièce, gagne **« Sommeil perturbé » −1** pour un jour, trois au plus, et pas plus d'une fois par 300 ticks ; son partenaire ou son conjoint ne le dérange pas. Une chambre individuelle évite cette pensée.

## Adaptations

- Le genre d'un humain est celui de son apparence dessinée : c'est le seul qu'Elsewhere connaisse.
- Le bruit de pas n'a pas de compteur sauvegardé : la douzième case est tirée de l'identité du marcheur et du tick ; une porte, ouverte ou fermée, arrête le bruit.
- La vérification horaire des câlins se fait quand l'animal est libre et disponible ; son dernier essai et sa cible sont gardés dans l'état d'esprit de l'animal (`nuzzle350`).
- Les personnes à insulter sont toutes celles qui sont à moins de 40 cases, sans recherche de chemin à chaque décision (le jeu de base parcourt les régions sans test de chemin) ; une cible injoignable est remplacée quand le colon ne trouve pas de chemin jusqu'à elle.
- Pendant une série d'insultes, aucune bagarre ne part : Elsewhere ne lance pas de bagarre avec une personne en crise. La retraite dans sa chambre se fait au pas (le jeu de base flâne).
- « M'a secouru » est donné à chaque sauvetage d'un colon ; le jeu de base ne le redonne qu'après une nouvelle blessure infligée par un ennemi.
- « Prisonnier libéré » ne lit ni la température de la région ni les maladies mortelles, et touche les personnes de la carte ; il n'est pas retiré si le prisonnier est repris.
- « Sentiment envers son partenaire » ne lit qu'un partenaire présent sur la même carte.
- « Compagnon lié perdu » n'est donné qu'à l'abandon d'une carte, la seule perte d'animal qu'Elsewhere connaisse.
- Aucun trait d'Elsewhere ne change la sensibilité psychique, et aucun ne retire ces pensées (le psychopathe n'existe pas encore).

## Sauvegarde

Les nouveaux souvenirs (sommeil perturbé, câlin, prisonnier libéré, compagnon lié mort ou perdu) rejoignent la liste des souvenirs de pièce de la personne, avec l'identifiant de l'autre pour les trois derniers ; « M'a secouru » rejoint les souvenirs sociaux ; la condition psychique, ses compteurs et ses dernières dates rejoignent le calendrier des incidents divers ; les crises gardent leur cible et leurs horloges. Tout est validé strictement et refusé avant le schéma 350.

## Vérification

`tests/mood-pool-350.test.ts` (8 cas, ticks réels de `stepWorld` pour les comportements) : la répartition des crises mineures sur 1 000 décisions (frénésie alimentaire ≈ 29 %), l'errance psychotique (marche, sommeil, fin à 90 000 ticks), la retraite dans sa chambre et les deux séries d'insultes, un bourdonnement qui ne touche que le genre tiré et son apaisement, la chaise à l'établi, les petites pensées, un câlin, la mort d'un compagnon lié, le sommeil perturbé, la sauvegarde stricte, l'absence de tout changement sous 350 et la migration 349 → 350.
