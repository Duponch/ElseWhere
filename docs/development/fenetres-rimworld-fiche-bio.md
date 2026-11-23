# Fenêtres comme RimWorld, premier lot : échelle unique, fiche Bio et barre d’inspection

Vague 4, lot 1 du [chantier des retours du 22 novembre](chantier-retours-20261122.md) (points 17 et 32). Lot d’interface seulement : aucun changement de règle ni de schéma. Les chiffres viennent de la [référence des fenêtres lue dans le code de Ludeon](rimworld-ui-reference.md), sections 1, 2, 3 et 7, et des classes relues pour ce lot (décompilées à part, réécrites, aucun texte ni image du jeu copiés).

## Ce qui change pour le joueur

- **Une seule échelle de texte pour toute l’interface native.** Trois tailles seulement, en points d’interface de RimWorld : Petit (`Tiny`), Courant (`Small`, lignes de 22) et Titre (`Medium`). L’échelle d’interface des Options (`nativeUiScale`) multiplie le tout, comme `Prefs.UIScale` dans le jeu. Aucune fenêtre ne choisit plus sa taille : les tailles locales (9, 10, 11, 12, 12,5, 13, 14, 15, 17, 25, 38 px…) des pages, de la mise en page, des cartes « Conseils » et « Tutoriel », du HUD et de la pile de lettres ont été remplacées par un rôle. Un test échoue si une taille littérale revient dans `src/ui3d/`.
- **Sélectionner un colon** n’ouvre plus le grand dossier : comme dans RimWorld, le **panneau d’inspection de 432 × 165** apparaît en bas à gauche avec le nom (Titre), quatre jauges de 93 × 16 (santé, humeur, planning de l’heure, zone autorisée cliquable pour la changer) et les lignes d’inspection (activité, inspiration, ordres en file, statut d’un non-colon). Les **onglets de 72 × 30** sont posés dessus, alignés à droite dans l’ordre du jeu (Journal, Matériel, Prisonnier, Social, Bio, Besoins, Santé). Aucun onglet n’est ouvert au départ ; cliquer un onglet l’ouvre, le recliquer le ferme, et l’onglet ouvert reste ouvert d’une sélection à l’autre (`MainTabWindow_Inspect.OpenTabType`).
- **Chaque onglet est une fenêtre à la taille du jeu**, posée sur les onglets depuis le bord gauche, avec sa croix de 18 en haut à droite : Bio 514 × 489, Besoins 580 × 520, Santé 630 × 430, Matériel 460 × 450, Social 540 × 510, Journal 630 × 510, Prisonnier 280 × 450. L’intérieur de Besoins, Santé, Matériel, Social et Journal reste celui d’avant (prochain lot), avec les nouvelles tailles de texte.
- **Les commandes** (Mobiliser, Effacer les ordres, Travail, Dépouiller, Stop, Feu à volonté, Réaction hostile) sont des vignettes de 75 × 75 à droite du panneau, comme les gizmos du jeu, libellées en Petit.
- **La fiche Bio** est celle de RimWorld, sans défilement : nom en Titre, « Homme, 37 ans (93) » avec l’âge détaillé au survol, la faction de la colonie en encadré cliquable (ouvre Factions), Enfance et Adulte avec leur histoire en encadré à x = 90, « Traits » et « Incapable de » en titres ocre avec un encadré par élément (ou « Aucun » grisé), et à droite les douze compétences en lignes de 230 × 24 au pas de 27 : nom, flamme de passion (une petite, deux grandes, peintes dans le style d’Elsewhere), barre sans fond ni cadre au dixième de remplissage par niveau et niveau en chiffre seul ; tiret grisé pour une compétence impossible. Survoler un encadré ou une compétence la surligne et donne son infobulle (histoire complète, effet du trait, cause d’une incapacité, expérience et apprentissage de la compétence).
- **La même fiche** sert à la page des personnages de la nouvelle partie, en mode création comme dans `Page_ConfigureStartingPawns` : le champ du nom et le bouton de renouvellement (« Aléatoire » du jeu) dans la zone du nom, l’âge dans la pile du haut, qui laisse la place du portrait ; les boutons de place (Laisser sur place, ↑, ↓) et « Masquer les vêtements » passent sous la liste des candidats. La fiche entière se lit sans défilement ; santé, relations et possessions restent en dessous.

## Où sont passées les lignes de l’ancien dossier

Rien n’a été perdu ; chaque ligne est là où RimWorld la met :

| Ancienne ligne | Nouvelle place |
| --- | --- |
| Identité « Homme · Colon », âge | Fiche Bio (« Homme, 37 ans (93) », âges au survol) ; le statut d’un non-colon est une ligne du panneau |
| Activité | Ligne du panneau d’inspection |
| Réaction hostile | Vignette de commande à droite du panneau (liste Fuir, Ignorer, Attaquer) |
| Ordres en file | Ligne du panneau |
| Inspiration | Ligne du panneau (et sous l’humeur dans Besoins, comme avant) |
| Effets du profil (apprentissage, seuils de crise) | Infobulle du titre « Traits » ; seuils et liste des crises aussi dans l’infobulle de la jauge d’humeur ; apprentissage dans chaque compétence |
| Liens connus (famille, couple) | Onglet Social, en tête (« Liens familiaux ») |
| Bouton « Vêtements visibles » et portrait | Onglet Matériel (portrait de 92 × 128 en haut à droite) |
| Expérience de la compétence (seconde jauge) | Infobulle de la compétence |
| Fermer | Croix de 18 en haut à droite du panneau (désélectionne) ; la croix de la fenêtre d’onglet ferme l’onglet |

## Faits du jeu utilisés (classe, nombre)

- `Text` : `SmallFontHeight` = 22. Tailles mesurées sur une capture du vrai jeu (fiche Bio, échelle 0,82) : Courant ≈ Arial 14 px (hauteur de capitale ≈ 10 points), Titre ≈ Arial 21 px. Avec Comfortaa, police par défaut d’Elsewhere (plus large, plus haute en x), les mêmes hauteurs sont atteintes à 13 et 20 px ; Petit à 10.
- `GenUI` : écarts 4, 10, 17, 26, `Pad` 10, `DrawElementStack` (lignes de 22, 4 entre lignes, 5 entre éléments, retour quand l’élément suivant dépasse, optimisation d’ordre reproduite telle quelle), `DrawElementStackVertical` (colonnes, chaque élément après la largeur cumulée de son rang).
- `Window` : marge 18, croix 18 avec marge 4.
- `CharacterCardUtility` : fiche 480 × 455 (`BasePawnCardSize`), nom 30 de haut en Medium, boutons de 30 à x = 480 − 85 puis tous les 40 vers la gauche, pile du haut à y = nom + 10 sur 470 de large (358 en création : − 20 − 92), + 10 puis + 15 si elle a pris moins de 78 (colonnes à y = 87), colonne gauche 250 et droite 258, encadré d’histoire à x = 90 (largeur texte + 10), sections de hauteur minimale 2 × 22, 30 + pile et 30 + pile + 12, partagées à parts égales puis réduites d’un point à la fois (première section ramenée à son minimum + 12), défilement seulement si les minimums ne tiennent pas ; titres « Traits » (200 × 30) et « Incapable de » (200 × 24) puis 24 plus bas ; « Aucun » gris de 24 ; incapacités en une colonne quand elles y tiennent (`DrawElementStackVertical`), sinon en lignes avec optimisation d’ordre et 5 entre lignes, sur une hauteur de colonne / 4 ; puce de faction : largeur texte + 22 + 15, icône 20 × 20 à (1, 1), texte à x = 22 + 5.
- `SkillUI` : lignes 230 × 24, pas 27 ; étiquette à x = 6, largeur = la plus longue étiquette du jeu + 6 ; icône de passion 24 × 24 ; barre de l’icône au bord, remplissage max(0,01 ; niveau / 20), sans fond ni cadre ; niveau à 4 à droite de l’icône, abaissé de 3 ; « - » à 50 % pour une compétence impossible.
- `InspectPaneUtility` : panneau 72 × max(6, onglets) × 165, contenu contracté de 12 et remonté de 4, nom en Medium, onglets 72 × 30 de droite à gauche depuis le bord droit du panneau ; `InspectPaneFiller` : jauges 93 × 16 espacées de 6 à y = 26 + 3 (santé, humeur, planning, zone autorisée cliquable), texte d’inspection 18 plus bas ; `HealthUtility.GetGeneralConditionLabel` et `Need_Mood.MoodString` (au bord de la crise, sur les nerfs = extrême + 5 %, stressé, neutre < 65 %, content < 90 %, heureux).
- `GizmoGridDrawer` : vignettes 75 × 75, départ à largeur du panneau + 14, bas à 14 au-dessus, 5 entre elles.
- `Races_Humanlike.xml` : ordre des onglets du colon. Tailles d’onglet (`ITab.size`) : Personnage 514 × 489 (fiche + 17), Besoins 580 × 520, Santé 630 × 430, Matériel 460 × 450, Social 540 × 510, Journal 630 × 510, Prisonnier 280 (`ITab_Pawn_Visitor`).

## Adaptations déclarées

- **Couleurs** : RimWorld dessine sur un fond presque noir ; Elsewhere garde son papier crème et son encre brune. Chaque rôle garde son sens et son contraste, pas sa valeur RVB (titre de section jaune → encre ocre, encadré blanc 10 % → lavis d’encre 10 % bordé d’un trait à la main, « Aucun » gris 0,5 → encre pâlie, barre de compétence blanche 10 % → encre 16 %). Rôles dans `src/ui3d/native-ui-scale.ts`.
- **Encadré d’histoire** : un titre français plus long que la colonne (police plus large que celle du jeu) est coupé avec « … » (comme `Truncate`) au lieu de déborder sur les compétences ; le texte entier reste dans l’infobulle.
- **Panneau** : collé au-dessus de la barre de cartes du bas d’Elsewhere (82 de haut au lieu de la barre de 35 du jeu) et à 12 du bord gauche, comme les autres fenêtres d’Elsewhere. Pas de bouton d’angle « suivant sur la case » ni d’info (les gestes existent ailleurs) ; une croix de fermeture garde la désélection à la souris.
- **Portrait** : le jeu n’en montre pas dans la fiche ni dans le panneau ; celui d’Elsewhere et son bouton « Vêtements visibles » sont dans l’onglet Matériel.
- **Bannir et renommer** : les emplacements des boutons de 30 × 30 sont prévus par la mise en page de la fiche, mais ces deux gestes n’existent pas encore dans la simulation d’Elsewhere : rien n’est affiché.
- La surbrillance au survol d’un encadré ou d’une compétence est un plan partagé déplacé sur le rectangle survolé (pas de nouveau dessin de la fiche).

## Fenêtres qui diffèrent encore de RimWorld (prochains lots)

- **Intérieurs des onglets** (faits au [deuxième lot](fenetres-rimworld-onglets.md), sauf les onglets d’animaux) : Besoins (`NeedsCardUtility` : colonne de 225, jauges ≤ 70, pensées au pas de 24), Santé (`HealthCardUtility` : capacités en texte, lésions en lignes de 23), Matériel (lignes de 28 avec icônes), Social (relations et dernière interaction), Journal, Prisonnier.
- **Inspection des objets, animaux, mécanoïdes et cases** : encore l’ancien dossier ; ils doivent passer au même panneau de 432 × 165 avec leurs onglets (Factures 420 × 480, Stockage 300 × 480, Dressage…).
- **Tableaux** (Travail, Planning, Assignations, Animaux, Faune) : cellules de priorité 25 × 25, en-têtes de 50 aux étiquettes entières (les mots sont encore coupés, « Repo s »), lignes de 30, case « priorités manuelles », recherche locale à retirer.
- **Barre des colons, alertes, lettres, heure et vitesse** (section 4 de la référence), **Architecte** (200 de large, deux colonnes de 32), **Recherche** (arbre de 140 × 50), **Quêtes et Historique** (1010 × 640), **Factions** (lignes de 80), **Menu** (450 × 390), dialogues, Options et pages de création (page de 1020 × 764).
- **Barres de défilement** : 8 de large au lieu de 16 (les mises en page réservent 12).
- **Clic sur une vitesse** : corrigé au [deuxième lot](fenetres-rimworld-onglets.md) (le panneau reste ouvert, comme dans RimWorld).
- **Résumé des compétences de l’équipe** (page des personnages) : encore en jauges avec cœurs de passion, pas encore celui du jeu.
- **Interlignes** : les textes sur plusieurs lignes (infobulles, cartes, panneau) gardent un interligne de 17 à 18 ; RimWorld n’en fixe pas dans le code (police), à confirmer sur capture.

## Performance

La fiche se compose une fois par changement (sélection, trait, compétence) dans la mise en page de la page, puis s’imprime sur le papier de la fenêtre ; les encadrés et compétences n’ont que des plans d’infobulle sans texture, le surlignage est un seul plan déplacé. Aucune recherche ni allocation par image.

Mesure dans le vrai client, en alternance avant/après (Chromium sans affichage, rendu WebGL, 1440 × 900, partie « Les Forges » chargée, Eden sélectionné, onglet Bio ouvert ; temps des rappels d’animation par image sur 10 s ; « avant » = `src` d’origin/main servi par le même serveur) :

| Passage | Pause : moyenne / médiane / p95 | ×1 : moyenne / médiane / p95 |
| --- | --- | --- |
| Avant 1 (dossier) | 8,24 / 8,1 / 10,5 ms | 16,37 / 11,7 / 38,7 ms |
| Après 1 (fiche et panneau) | 7,18 / 7,1 / 8,9 ms | 15,62 / 11,9 / 37,1 ms |
| Avant 2 | 8,03 / 7,8 / 10,8 ms | 15,03 / 11,2 / 36,9 ms |
| Après 2 | 7,33 / 7,1 / 10,2 ms | 14,27 / 10,1 / 29,7 ms |

En pause, l’image coûte environ 0,9 ms de moins (−11 %) avec la fiche et le panneau qu’avec l’ancien dossier ; à ×1 l’écart (−5 % en moyenne) reste dans le bruit de la simulation. Le compteur de pages reconstruites ne bouge pas pendant les mesures : la fiche n’est pas recomposée par image.

## Tests

- `tests/native-ui-scale-system.test.ts` (nouveau) : valeurs de l’échelle ; aucune taille de texte littérale dans `src/ui3d/` ; rectangles de la fiche contre les nombres de la référence (nom, pile, colonnes à 87, encadrés à x = 90, sections égales, compétences 230 × 24 au pas de 27, barre jusqu’au bord, niveau à + 28) ; partage et débordement des sections comme Core ; piles d’éléments (optimisation d’ordre, variante verticale) ; panneau 432 × 165, onglets 72 × 30 alignés à droite, jauges 93 × 16 à 26 + 3, vignettes 75 × 75 ; fenêtre Bio 514 × 489 posée sur les onglets, fiche à (17, 17), aucun défilement ; tailles des autres onglets ; ouverture et fermeture d’un onglet comme Core ; chaque ligne déplacée retrouvée à sa nouvelle place.
- Tests adaptés sans affaiblir le comportement (seul l’endroit change) : la réaction hostile se cherche dans les commandes, les histoires, traits et compétences dans la fiche (`native-inspector-actions-v476`, `lore-text-ui`, `native-pregame-starting-pawns`).
