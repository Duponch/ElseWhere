# Alertes de droite comme dans RimWorld 1.6 — lot A

Interface seulement : le schéma ne change pas (342), rien n'est sauvegardé et la simulation n'est pas touchée. Les alertes lisent la partie confirmée sans la modifier ni tirer de hasard. Référence : RimWorld 1.6.4871 (classes `AlertsReadout`, `Alert`, `Alert_Critical`, `AlertBounce`, `Pulser` et les classes `Alert_*` citées ci-dessous, définitions `HediffDefs`, `JoyKinds` et bâtiments du jeu de base). Seuls des faits ont été repris ; les textes sont écrits pour Elsewhere.

## Ce qui change pour le joueur

- **Toute la liste.** La colonne de droite montre toutes les alertes qui tiennent au-dessus de l'horloge, au lieu de quatre cartes. Le surplus défile à la molette sur les cartes ou avec les flèches ▲ ▼ ; « N alertes · tout voir » ouvre la liste complète.
- **Priorité explicite.** Chaque alerte a une priorité **Critique**, **Haute** ou **Moyenne** (`AlertPriority`). L'ordre est Critique, puis Haute, puis Moyenne ; à priorité égale, l'ordre d'apparition est conservé. Une alerte qui disparaît puis revient est une nouvelle apparition.
- **Couleur.** Critique : carton rouge qui pulse ; Haute : ocre ; Moyenne : carton clair. Les cartes qui annoncent un événement (raid, conditions météo, offres, quêtes) gardent la couleur de leur lettre (danger, avertissement, information).
- **Survol.** L'infobulle donne l'explication, les noms des personnes ou objets concernés et le rappel des clics.
- **Clic gauche** : la caméra va sur le cas suivant et le sélectionne ; **clic droit** : le cas précédent. Une offre, une quête ou un marchand ouvre son dossier. Sans cas à montrer, le clic ouvre le réglage utile (Travail, Architecte, Assignations…), la carte concernée ou le détail.
- **Apparition.** Une alerte Haute ou Critique glisse depuis la gauche et rebondit en place, avec une petite sonnerie (au plus une par demi-seconde). Une alerte Critique affiche aussi une fois « Alerte critique : … » avec le son de menace.
- **Début de partie.** Aucune alerte avant 600 ticks du jeu de base (60 ticks d'Elsewhere, 10 secondes à ×1). Les cartes d'arrivée et d'événements restent visibles dès le départ.

## Règles reprises du jeu de base

| Alerte (classe) | Priorité | Règle |
|---|---|---|
| Incendie dans la zone de foyer (`Alert_FireInHomeArea`) | Critique | Un feu connu sur une case de la zone de foyer ; un feu porté par une personne ou un animal pointe vers lui. |
| Colon à secourir (`Alert_ColonistNeedsRescuing`) | Critique | Colon libre à terre qui veut être secouru (règle `wantsRescue` existante : pas déjà couché dans un lit) et que personne ne porte. |
| Hypothermie grave (`Alert_Hypothermia`) | Critique | Stade « grave » (sévérité ≥ 0,35) **et** air hors de la plage sûre (confort, vêtements portés compris, ±10 °C). Avant : dès 0,04. |
| Risque de crise majeure ou extrême (`Alert_MajorOrExtremeBreakRisk`) | Critique | Inchangée, désormais en tête de liste. |
| Urgences médicales (infection, grippe, paludisme, peste, maladie du sommeil graves ; `Alert_LifeThreateningHediff`) | Critique | Inchangées. |
| Colon laissé sans sépulture (`Alert_ColonistLeftUnburied`) | Haute | Corps d'un colon resté au sol, sur une carte où un colon libre est présent. Un corps porté, enterré ou perdu ne compte plus. Remplace le compteur de décès qui ne disparaissait jamais. |
| Geôlier nécessaire (`Alert_NeedWarden`) | Haute | Des prisonniers sur la carte du foyer et aucun colon libre conscient avec le travail Geôlier activé ; montre le premier prisonnier. Remplace la ligne « N prisonnier(s) » toujours affichée. |
| Couchages manquants (`Alert_NeedColonistBeds`) | Haute | Seulement pendant les 30 premiers jours. Lits non médicaux et non carcéraux ; un couple (amant ou conjoint présent) partage un lit double, une personne seule prend un lit double avant un lit simple. |
| Réserves de nourriture faibles (`Alert_LowFood`) | Haute | Après 150 000 ticks du jeu de base (2,5 jours). Nutrition fraîche, mangeable par un humain (le foin exclu), rangée dans une réserve ou une étagère, sous 4 par colon libre présent. Avant : toute nourriture connue, sous 1,6 par colon, dès le départ. |
| Risque de crise mineure (`Alert_MinorBreakRisk`), malnutrition (`Alert_StarvationColonists`) | Haute | Inchangées. |
| **Colon à soigner** (`Alert_ColonistNeedsTend`) — nouvelle | Haute | Colon libre avec une blessure ou une maladie à traiter, pas couché dans un lit médical et pas en attente de secours. Les mécanites ne déclenchent pas l'alerte (`makesAlert` faux dans le jeu de base). |
| **Défenses nécessaires** (`Alert_NeedDefenses`) — nouvelle | Haute | Du 2ᵉ au 5ᵉ jour : aucune tourelle, aucun piège, aucun sac de sable sur la carte du foyer. |
| **Aucune source de repas** (`Alert_NeedMealSource`) — nouvelle | Moyenne | À partir du 2ᵉ jour : ni feu de camp, ni cuisinière (bois ou électrique), ni distributeur de pâte nutritive. |
| **Sources de loisirs insuffisantes** (`Alert_NeedJoySources`) — nouvelle | Moyenne | Moins de types de loisirs sur la carte que les attentes n'en demandent (2, 3, 3, 4, 5, 6 selon la richesse). L'infobulle liste les types présents et manquants. |
| Colons sans occupation (`Alert_ColonistsIdle`) | Moyenne | À partir du 1ᵉʳ jour seulement. |
| Choisir une recherche (`Alert_NeedResearchProject`) | Moyenne | Inchangée. |

Les jours sont des jours écoulés depuis le début de la partie (`GenDate.DaysPassed`), un tick d'Elsewhere valant dix ticks du jeu de base. « Carte du foyer » : la colonie installée, pas un camp ni un site visité.

## Corrections de la liste existante

- **Incendie** : l'alerte avait disparu de l'interface en carton (elle ne passait plus que par l'ancien bouton HTML). Elle revient dans la liste.
- **Fléau des cultures** : même perte ; il revient comme ligne Moyenne pointant les plants atteints (dans le jeu de base c'est une lettre).
- **Visiteurs** : la carte « Visiteurs : 0 · Commerce » n'apparaît plus dans chaque partie, seulement quand des visiteurs sont là (ou pour activer les visites d'une ancienne sauvegarde).
- **Assaut terminé** : le bilan reste 600 ticks après la fin, comme les fins de conditions, au lieu de rester jusqu'au raid suivant.
- **Deux règles de tri différentes** (rang et couleur, par expressions régulières sur les clés) remplacées par une seule table de priorité (`src/ui/alert-priority.ts`).

## Adaptations

- **Lignes propres à Elsewhere.** Les lignes sans équivalent dans le jeu de base gardent leur place avec une priorité choisie : Haute pour un danger présent (saignement, aucun colon libre, révolte de prison, machines hostiles, animaux en rage, crise violente, mèche engagée, menace sur une autre carte), Moyenne sinon (faim, maladies non graves, ordres en attente, réserves, fête…). Les cartes d'événements (raids, conditions, offres) sont Hautes si elles annoncent un danger, Moyennes sinon ; ce sont des lettres dans le jeu de base, elles ne sont pas retardées au début de partie et ne déclenchent pas l'avis critique (un raid a déjà sa propre fenêtre et son son).
- **Rythme.** Le jeu de base revérifie chaque alerte toutes les 24 images. Ici la liste est relue au plus toutes les 400 ms de temps réel, sur la dernière partie confirmée ; une relecture prévue entre deux est faite par l'image suivante.
- **Chargement.** Comme le délai d'une seconde après un chargement dans le jeu de base, une nouvelle partie, un chargement ou un changement de carte reprennent les alertes présentes sans sonnerie ni rebond.
- **Rebond.** Mêmes constantes (300 px, −200 px/s, −1 200 px/s², rebond −v/3 − 1, pas d'au plus 0,05 s). Le jeu de base continue des rebonds de moins d'un pixel ; ici la carte s'arrête dès qu'aucun rebond ne peut dépasser un pixel, pour ne pas redessiner sans fin.
- **Pulsation.** Même rythme (0,5 Hz, luminosité de 0,6 à 1), mais en quatre teintes de rouge vers crème : l'encre sombre reste lisible et la carte n'est repeinte que quelques fois par seconde.
- **Son.** La sonnerie réutilise le son de panneau existant ; l'avis critique, le son de menace. Une alerte critique ne joue que le son de menace (pas les deux).
- **Avis critique.** Il utilise l'avis existant en haut de l'écran, sans clic vers le cas : aller au cas se fait par la carte d'alerte.
- **Survol.** Les noms sont listés dans l'infobulle ; les cas ne sont pas surlignés sur la carte.
- **Premier clic droit** : il va au dernier cas (le jeu de base, par un détail d'indice, va à l'avant-dernier).
- **Hypothermie et voyages.** Seuls les colons présents sur la carte sont lus ; ceux d'une caravane ne sont pas comptés.
- **Loisirs.** Seuls les types qu'Elsewhere propose sont comptés : contemplation et vie sociale (toujours), fer à cheval, échecs, télévision, bière au sol, livre au sol. Les loisirs du jeu de base absents ici (gourmandise, culture, télescope) ne sont pas comptés. Une partie sans profil de richesse n'a pas cette alerte.
- **Soins.** Un colon dont les soins sont réglés sur « aucun » n'est pas signalé (le jeu de base l'inclut).
- **Défenses.** Elsewhere n'a pas de barricade ; tourelle, piège à pointes et sacs de sable comptent.
- **Couchages.** Les couples sont lus dans les relations d'amant et de conjoint (pas de fiançailles dans Elsewhere) ; pas de bébé ni de berceau.

## Contrôles

- `tests/alerts-core-a.test.ts`, 19 cas : chaque alerte corrigée ou nouvelle apparaît et disparaît sur de vraies parties (feu allumé puis éteint, secours mené jusqu'au lit médical par la simulation, patient qui rejoint son lit médical, corps porté puis enterré par la simulation, geôlier activé puis à terre, hypothermie dans un air glacé puis réchauffé, couchages avec un couple, nourriture rangée ou non, feu de camp, sacs de sable, fer à cheval, visiteurs, fin d'assaut) ; ordre des priorités ; début à 600 ticks ; cycle des cas dans les deux sens ; rebond et pulsation ; colonne réelle de l'interface (tri, sonnerie unique, avis critique, clics, rebond, rythme de 400 ms, chargement silencieux) ; lecture sans modification de la partie.
- Anciens tests mis à jour quand ils décrivaient une règle remplacée : seuil d'hypothermie, nourriture avant 2,5 jours, compteur de décès, quatre cartes au plus, couleurs par expressions régulières. Les tests d'identité des notifications utilisent la malnutrition au lieu de l'hypothermie, avec les mêmes assertions.
- Voisins lancés (alert*, status*, notification*, native-hud*, mood-risk*, urgent*, fire*, blight*, prisoner*, rescue*, et les tests qui lisent les alertes) : seuls des échecs déjà connus restent.
- Non vérifié dans un navigateur : rendu réel du rebond, de la pulsation, des flèches et du clic droit.

## Reste à faire

Lots suivants de l'audit : épuisement, médicaments, vêtements abîmés, ennui, batteries, menaces vitales élargies (perte de sang, prisonniers), vêtements chauds, enclos, alertes occasionnelles (médecin, mineur, distributeur sans trémie, caravane immobilisée), et un vrai canal de lettres pour les événements non menaçants.
