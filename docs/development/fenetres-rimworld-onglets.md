# Fenêtres comme RimWorld, deuxième lot : l’intérieur des onglets du colon

Vague 4, lot 2 du [chantier des retours du 22 novembre](chantier-retours-20261122.md) (points 17 et 32), après le [premier lot](fenetres-rimworld-fiche-bio.md) (échelle de texte, fiche Bio, panneau d’inspection, fenêtres d’onglet à leur taille). Lot d’interface seulement : aucun changement de règle ni de schéma. Les chiffres viennent des classes de Ludeon relues pour ce lot (`NeedsCardUtility`, `Need.DrawOnGUI`, `Need_Mood`, `HealthCardUtility`, `ITab_Pawn_Gear`, `SocialCardUtility`, `InteractionCardUtility`, `ITab_Pawn_Log`, `ITab_Pawn_Log_Utility`, `ITab_Pawn_Visitor`, `Widgets.FillableBar`, `Widgets.ListSeparator`, `TabDrawer`), décompilées à part et réécrites : aucun texte ni image du jeu n’est copié.

## Ce qui change pour le joueur

Chaque onglet est désormais **une seule carte** aux dimensions de la fenêtre du jeu, sans marge autour (le contenu de `FillTab` part du coin de la fenêtre), avec les régions, les hauteurs de ligne, les couleurs par rôle, les zones qui défilent et les infobulles de RimWorld.

- **Besoins** (580 × 520). Colonne de besoins de 225, chaque besoin haut de `min(70, 520 / n)` ; un besoin mineur est 0,73 fois aussi large et 0,666 fois aussi haut (au moins 30), après un écart de 10. Ordre du jeu (`listPriority`) : Nourriture, Sommeil, Loisirs, puis Beauté, Confort, Plein air (et Intérieur pour un souterrain). Chaque besoin : étiquette dans la moitié haute (Petit sous 55 de haut), barre à 29 de chaque côté et 14 au-dessus du bas, cadre de 3 quand la barre dépasse 15 × 20, repères de seuil (2 de large, sur la moitié basse, noirs une fois dépassés, gris avant), flèches de variation (`GUIChangeArrow`, jusqu’à 3) et, pour l’humeur, le curseur d’instant sous la barre. Colonne de droite : barre d’humeur sur 80 % de la largeur (repères des trois seuils de crise), puis la liste des pensées dans une zone de 335 × 420 qui défile (lignes de 20 au pas de 24, intitulé à x = 10 sur 225, effet en colonne de 32 à x = 235, vert, rose ou gris ; plusieurs pensées de même nom se regroupent en « x 3 »). Le jeu ne montre pas l’espace de la pièce : sa valeur et sa règle sont dans l’infobulle de l’humeur, avec l’inspiration, la crise en cours et, pour les loisirs, le loisir engagé et la fête.
- **Santé** (630 × 430). Résumé à gauche de 37,5 % sous deux onglets de 32 (« Vue d’ensemble » et « Opérations (n) »), liste des lésions à droite. Résumé : lignes de 23 (« Aliments », « Médicaments » en liste déroulante sur la moitié droite, « Auto-soins » en case à cocher), un trait gris, puis « Douleur » et les capacités en lignes de 22 à x = 17 (étiquette à gauche, **pourcentage** à droite coloré par estimation : rouge à zéro, rose sous 40 %, gris, vert à 100 %, bleu au-delà). Liste : « Corps entier » en rouge d’abord, puis une entrée par partie du corps (nom sur 37,5 % de la largeur, ses lésions à côté), bandes alternées, bouton d’information de 20 × 20 (ouvre le dossier anatomique), goutte de saignement et croix verte des soins, ligne « Saignement : n %/jour » sous la zone qui défile. L’onglet Opérations montre la demande en cours avec son bouton « Annuler », ou le menu « Ajouter une opération… » qui liste les amputations, les poses et les retraits de prothèse, les impossibles avec leur raison.
- **Matériel** (460 × 450, plus haute si le contenu l’est). Zone contractée de 10 sous une marge haute de 20 ; lignes de 22 (« Masse portée », « Plage de température confortable »), séparateurs de 25 (« Armure globale » avec Tranchant, Contondant et Chaleur calculés sur la couverture du corps, « Équipement », « Vêtements », « Inventaire » toujours présents pour un humain), puis une rangée de 28 par objet : libellé à x = 36, masse dans une colonne de 60, bouton déposer ou retirer et bouton de consommation de 24, bouton d’information de 24 au bout. Le portrait de 92 × 128 et la case « Vêtements » (propres à Elsewhere) occupent le coin haut droit des premières lignes.
- **Social** (540 × 510). Liste des relations sur 63 % de la zone, une règle, puis le journal des interactions (au plus 12). Colonnes comme `CalculateColumnsWidths` : 23 % relations (gris), 41 % nom, 7,5 % opinion (rouge sous −10, vert au-dessus de 10), 8,5 % l’opinion de l’autre entre parenthèses (estompée), 20 % situation. Cliquer une ligne sélectionne la personne.
- **Journal** (630 × 510). Trois cases à cocher en haut (« Tout » x = 60, « Social » x = 330, « Combat » x = 445), bouton de copie de 18 × 24, entrées de 26 au moins avec bandes alternées à 3 %, titre en Titre et écart de 20 autour d’une série de combats.
- **Prisonnier** (280 de large, aussi haute que son contenu). Lignes de 22, ligne « Médicaments » avec sa liste, puis une section de menu aux modes de détention en boutons radio de 24 sur des rangées de 28.

**Corrections de la fiche Bio vues dans le client.** Les titres ocre (« Traits », « Incapable de ») et tous les rôles de texte sont assombris : chaque encre de rôle garde 4,5 contre 1 au moins sur le papier crème (WCAG AA, un test les vérifie) ; le trait fin de la police rend les pixels plus clairs que l’encre, d’où la marge. La puce de faction manquait pour un colon d’une partie sans registre de factions (départ de diagnostic) : une colonie sans registre s’affiche « Colonie », et la fiche de la page des personnages de la nouvelle partie porte maintenant la puce de la colonie comme `Page_ConfigureStartingPawns` (Faction du joueur). Un clic sur un bouton de vitesse ne masque plus le panneau d’un colon sélectionné (le panneau reste ouvert, comme dans RimWorld ; le comportement V486, pensé pour l’ancien grand dossier, est retiré).

## Où est passée chaque ligne des anciens onglets

| Ancienne ligne | Nouvelle place |
| --- | --- |
| Besoins : « Espace », inspiration, crise mentale | Infobulle de la barre d’humeur |
| Besoins : « Loisir engagé », « Fête collective » | Infobulle de la barre des Loisirs |
| Besoins : pensées une par une | Liste des pensées (regroupées par nom, l’infobulle garde le détail et la durée) |
| Santé : onglets « Vue d’ensemble » et « Opérations » | Les deux onglets du résumé |
| Santé : douleur, sang perdu, saignement | Ligne « Douleur » (infobulle : niveau, état clinique, infection, risques opératoires) ; ligne de saignement sous la liste ; entrées « Corps entier » seulement quand non nuls |
| Santé : « Dossier anatomique » | Bouton d’information de chaque entrée |
| Santé : politique médicale, régime, auto-soins | Trois lignes du résumé |
| Santé : demandes d’opération | Menu « Ajouter une opération… » et ligne de demande |
| Santé : « Pièce et hygiène » (environnement) | Vignette de commande de 75 × 75 à côté du panneau |
| Matériel : portrait, vêtements visibles, arme, vêtements, retirer, informations | Coin du portrait, rangées de 28 avec leurs boutons |
| Matériel : « Arme perdue », « Tenue imposée » | Deux lignes à boutons à la fin de la liste |
| Social : liens familiaux, relations, avis réciproque | Table des relations (relations, nom, opinion, opinion de l’autre, situation, infobulle des motifs) |
| Social : dernier échange | Journal des interactions sous la règle |
| Journal : filtre « Événements » | Cases « Tout » (crises mentales et autres), « Social », « Combat » |
| Prisonnier : résistance, capture, évasions, modes, régime | Lignes et boutons radio ; le régime alimentaire est dans « Aliments » de la Santé (un prisonnier de la colonie y est patient) |

## Faits du jeu utilisés (classe, nombre)

- `NeedsCardUtility` : 580 × 520, colonne de 225, `min(70, 520 / n)`, mineurs 0,73 et 0,666 (≥ 30), écart de 10 ; humeur sur 0,8 × (largeur − 225) × 70 ; liste des pensées en (0, 80, w, h − 80) contracté de 10, lignes de 20 au pas de 24, intitulé à x + 10 sur 225 (haut − 3, bas + 3), effet à x + 235 sur 32 (`##0`).
- `Need.DrawOnGUI` : marge 14 + 15, bas 14 (réduit sous 50 de haut), étiquette en bas-gauche de la moitié haute à partir de `0,1 × largeur`, repères 2 (1 sous 60 de large), curseur d’instant 12 (6 sous 150). `Widgets.FillableBar` : cadre de 3 si hauteur > 15 et largeur > 20. Seuils : nourriture 0,24 et 0,12 (`FoodLevelPercentageWantEat` × 0,8 et × 0,4), sommeil 0,28 et 0,14, loisirs 0,15 / 0,3 / 0,7 / 0,85, beauté 0,15 / 0,35 / 0,65 / 0,85, confort 0,1 / 0,6 / 0,7 / 0,8 / 0,9, plein air 0,8 / 0,6 / 0,4 / 0,2 / 0,05. Flèches : `Need_Rest` (sommeil +1 sinon −1), `Need_Joy` (gain +1 sinon −1, 0 si figé), `Need_Food` (−1), `Need_Seeker` (humeur : cible plus haute ou plus basse de 5 %).
- `HealthCardUtility` : carte à 20, résumé 0,375 dont le haut descend de 11, contenu contracté de 9, `DrawLeftRow` (x = 17, largeur − 34 − 10, hauteur 22), lignes de réglage de 23, liste contractée de 10 avec 22 de moins, noms de partie sur 37,5 %, bandes alternées, icônes de 20 espacées de 5 depuis la droite, `GetPainLabel` (0 / 0,15 / 0,4 / 0,8), `EfficiencyValueToEstimate` (0 / 0,4 / 0,7 / 1), `TabDrawer` (onglets de 32, au plus 200, recouvrement 10).
- `ITab_Pawn_Gear` : 460 × 450, haut 20, zone contractée de 10, barre de défilement 16, lignes de 22 et de 28 (icône 28 à x = 4, libellé à x = 36), boutons de 24, masse sur 60 ; `ListSeparator` (3 + 20 + 2) ; armure globale `clamp(Σ couverture × (1 − Π(1 − min(1, note / 2))) × 2, 0, 2)`.
- `SocialCardUtility` : 540 × 510, haut 15, contracté de 10, liste sur 0,63, écart 17 ; `InteractionCardUtility` : entrées de 26 au moins, texte à x = 29, au plus 12 ; `ITab_Pawn_Log` : 630 × 510, cases à y = 2 (x 60 / 330 / 445), copie 18 × 24 à largeur − 60, `ITab_Pawn_Log_Utility` : écart de 20, bandes à 0,03.
- `ITab_Pawn_Visitor` : 280, contracté de 10, lignes à 2 d’écart, ligne de 24 moitié-moitié (4 de chaque côté), section de menu de 28 par mode + 20, boutons radio de 24.

## Adaptations déclarées

- **Couleurs** par rôle, sur le papier (voir le premier lot) ; fond de la barre en encre pâle, remplissage sarcelle, repères en encre.
- **Flèches** de besoin : seuls sommeil, loisirs, nourriture et humeur en ont ; beauté, confort et plein air n’ont pas de valeur d’instant dans la simulation d’Elsewhere, leur flèche (`Need_Seeker`) manque. Pas de curseur d’instant hors de l’humeur.
- **Journal** : les entrées d’Elsewhere ne sont pas rangées par bataille ; une série de combats consécutifs reçoit un titre « Combat · il y a n h » (le jeu nomme la bataille). « Tout » affiche aussi les crises mentales (le jeu y met les entrées de combat peu importantes).
- **Social** : pas de pictogramme d’interaction (les 26 de gauche restent vides pour garder le retrait de 29), pas de certitude d’idéologie ni de rôle (extensions).
- **Santé** : les entrées viennent des lésions et affections d’Elsewhere ; le jeu groupe par partie du corps dans l’ordre `GetListPriority`, Elsewhere garde l’ordre de son dossier avec « Corps entier » en tête.
- **Matériel** : une masse et une icône d’objet par rangée quand la simulation les connaît (pas d’icône d’objet).
- **Animaux** : leurs onglets (Dressage, Nourrissage…) ne sont pas encore au gabarit du jeu : leur page n’est pas celle du colon, lot suivant.

## Performance

Chaque onglet se compose une fois par changement de la page (sélection, pensée, blessure, bascule) dans la mise en page, puis s’imprime sur le papier de la fenêtre ; les rangées et boutons n’ont que des plans d’infobulle sans texture, la surbrillance est un seul plan déplacé et le défilement d’une zone repeint la carte une fois par cran de molette, sans recomposition de la page. Aucune recherche ni allocation par image.

Mesure dans le vrai client, en alternance avant/après (Chromium sans affichage, rendu WebGL, 1440 × 900, « Les Forges » chargée, Eden sélectionné, onglet ouvert, partie en pause, souris qui se déplace sur la fenêtre ; temps des rappels d’animation par image, 8 à 10 s ; « avant » = `src` d’origin/main servi à côté) :

| Onglet (pause) | Avant : moyenne par image | Après : moyenne par image |
| --- | --- | --- |
| Besoins | 2,39 / 2,37 ms (1,68 / 1,71 en début de séance) | 2,28 / 2,27 ms (1,65) |
| Santé | 2,36 / 2,44 ms (1,73 / 1,82) | 2,25 / 2,30 ms (1,67) |
| Matériel | 2,36 / 2,29 ms (1,68 / 1,83) | 2,22 / 2,25 ms (1,73) |

Deux séances alternées (la machine était plus chargée à la seconde) : l’image coûte 3 à 5 % de moins avec les cartes qu’avec les anciens onglets, dans le bruit de la mesure ; aucun surcoût. (Deux passages perturbés par des tests lancés en même temps ont été écartés.)

## Tests

- `tests/native-tab-cards.test.ts` (nouveau, 25 cas) : contraste de chaque rôle de couleur sur les deux papiers et sur une puce ; rectangles de chaque onglet contre les nombres décompilés (besoins : hauteurs, bornes de la barre, repères, zone des pensées, défilement et découpage des cibles ; santé : résumé, onglets, lignes de 23 et 22, liste, icônes ; matériel : rangées de 28, boutons de 24, séparateurs de 25, hauteur variable, portrait ; social : colonnes, 63 %, règle, interactions ; journal : cases, copie, zone ; prisonnier) ; l’inspecteur construit chaque onglet comme une seule carte à sa taille, sans marge, sans défilement de page ; rien de perdu : les contrôles de chaque ancien onglet restent atteignables.
- Tests adaptés sans affaiblir le comportement (seul l’endroit change) : `native-ui-scale-system` (liens familiaux et case du portrait dans les cartes), `mood-basics-345`, `outdoors-need-359`, `trait-links-362` (les besoins se lisent dans la carte), `native-hud-speed-selection-v486` (la vitesse laisse le panneau ouvert).
- Échecs déjà connus (liste `known-failures.json`) inchangés : `native-layout-density` (3) et `native-inspector-close-material-group325` (2).
