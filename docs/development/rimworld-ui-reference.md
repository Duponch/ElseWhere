# Référence des fenêtres de RimWorld, lue dans le code de Ludeon

Préparation du point 32 de la section H et du point 17 de [le chantier des retours du 22 novembre](chantier-retours-20261122.md) : fiches et fenêtres identiques à RimWorld en structure, organisation, mise en page, dimensions, densité, tailles de texte et espacements, sans changer la direction artistique (carton et peinture). Cette note ne change rien sous `src/` : elle donne les chiffres exacts que le lot d’implémentation appliquera.

## Méthode et limites

- Source de vérité : le code du jeu installé (1.6), décompilé classe par classe (`CharacterCardUtility`, `SkillUI`, `GenUI`, `Widgets`, `Text`, `Window`, `InspectPaneUtility`, `ITab_*`, `NeedsCardUtility`, `MainTabWindow_*`, `PawnTable`, `ColonistBar*`, `AlertsReadout`, `GlobalControls*`, `TimeControls`, `FloatMenu*`, `ActiveTip`, `Dialog_*`, `Page_*`, `MainMenuDrawer`) et les définitions de `Data/Core/Defs`. Les faits sont réécrits en nombres et en descriptions, jamais copiés ; aucun texte ni aucune image du jeu n’entre dans le dépôt.
- Toutes les dimensions de RimWorld sont en **points d’interface** (un point = un pixel à l’échelle d’interface 1 ; `Prefs.UIScale` applique une seule matrice à tout l’écran). C’est le modèle à reprendre : une seule échelle globale, jamais une taille par fenêtre.
- Mesures d’Elsewhere : lues dans `src/ui3d/native-layout.ts` et `native-inspector.ts`, puis contrôlées dans le vrai client (serveur de développement sur le port 5391, partie « Les Éclaircies – fondations », son non utilisé, serveur arrêté ensuite). La fenêtre du navigateur d’observation mesurait 1282 × 976 pixels CSS à DPR 1, mais les captures reçues sont réduites à 800 × 609 (facteur 0,624) : les dimensions « mesurées » ci-dessous sont donc des estimations à environ ±4 px, marquées « ≈ ».

### Ce que je n’ai pas pu lire

- **Hauteurs de ligne exactes des trois polices** (`Tiny`, `Small`, `Medium`) : elles viennent des fichiers de police du jeu (`Calibri_tiny`, `Arial_small`, `Arial_medium`), calculées au démarrage, pas des constantes du code. Seule constante : `Text.SmallFontHeight = 22`. Les autres valeurs ci-dessous sont **déduites** des rectangles que le code leur réserve (étiquette de nom en Medium dans 30 de haut, titre de page 45, titre de boîte de dialogue 42, ligne de liste Small 22) et à confirmer en mesurant une capture du vrai jeu.
- **Textures** (fond des boutons, icônes de passion, icône de faction, cadres) : seules leurs tailles et leur emplacement sont dans le code ; l’apparence reste à décider en carton/peinture.
- Les menus et pages de la création de partie (`Page_*`, `MainMenuDrawer`) et les dialogues ont été lus pour leurs rectangles principaux seulement ; le détail interne de chaque liste (scénarios, conteurs, difficultés, options) reste à lire au moment de leur lot.
- Les tableaux de colonnes d’extensions (Idéologie, Biotechnologie, Anomalie, Odyssée) sont ignorés : Elsewhere vise le jeu de base.

## 1. Système (à appliquer globalement)

### 1.1 Polices et lignes

| Rôle | Police RimWorld | Hauteur de ligne | Usage |
| --- | --- | --- | --- |
| Texte courant | Small | 22 (constante du jeu) | presque tout : étiquettes, listes, chips, boutons, info-bulles |
| Petit | Tiny | ≈ 18 (déduit) | étiquettes de besoins mineurs (si la zone fait moins de 55), indications de colonne du Travail, étiquettes des jauges de la barre d’inspection |
| Titre | Medium | ≈ 30 (déduit) | nom du colon dans la fiche (zone de 30 de haut), nom dans le panneau d’inspection (zone de 50), titre de page (zone de 45), titre de boîte de dialogue (zone de 42), numéro de priorité du Travail |

Règles du jeu à garder : aucune fenêtre ne choisit une taille de texte propre. Le texte est toujours Small, sauf titre (Medium) ou micro-texte (Tiny) comme ci-dessus. Les ancrages usuels : haut-gauche pour la lecture, milieu-gauche pour une ligne de 22 à 30, centre pour un bouton et un chip, milieu-droite pour les alertes. Le retour à la ligne est automatique dans la largeur du rectangle.

**Elsewhere aujourd’hui** : `NATIVE_UI` = corps 14, petit 12, titre 18, interligne 20, marge 18, espacement 10, bouton 34, onglet 34, barre de défilement 10, barre du bas 82 ; cartes de liste en 15/13 ; chips et lignes de 28 ; détail à 12 avec 18 d’interligne. Les fenêtres ajoutent leurs propres valeurs (par exemple 42 ou 48 pour une ligne de matrice, 34 pour un titre de section). **À faire** : remplacer ces valeurs par une échelle unique en points RimWorld (Tiny/Small/Medium, ligne 22 pour Small) multipliée par l’échelle d’interface de l’utilisateur (`nativeUiScale`, déjà persistée), et interdire une taille de texte locale dans les constructeurs de pages.

### 1.2 Espacements (`GenUI`)

| Nom | Valeur |
| --- | --- |
| GapTiny | 4 |
| GapSmall | 10 |
| Gap | 17 |
| GapWide | 26 |
| Pad | 10 |
| GapLabel | 22 (étiquette) |
| ListSpacing | 28 |
| Marge standard d’une fenêtre | 18 (`Window.StandardMargin`) |
| Largeur de la barre de défilement | 16 |
| Taille d’icône usuelle | 24 (`SmallIconSize`), case à cocher 24, bouton de fermeture 18 avec marge 4, bouton d’info 24 |
| Pile d’éléments (chips) | hauteur de ligne passée par l’appelant (22 pour le texte), marge entre lignes 4, marge entre éléments 5 |

### 1.3 Couleurs par rôle

| Rôle | Valeur RimWorld |
| --- | --- |
| Fond d’une fenêtre | RVB 21, 25, 29 (très sombre) ; bord 97, 108, 122 |
| Fond d’une section de menu | 42, 43, 44 ; bord 135, 135, 135 |
| Fond d’un chip (trait, handicap, passé, faction) | blanc à 10 % d’opacité posé sur le fond de la fenêtre |
| Surbrillance au survol | blanc à 10 % |
| Surbrillance de la sélection | 1, 0,94, 0,5 à 18 % |
| Bande alternée d’une liste | blanc à 5 % |
| Titre de section dans une fiche et dans les info-bulles | jaune 0,9 ; 0,9 ; 0,3 |
| Texte atténué (aide, « ouvrir pour en savoir plus ») | gris 0,6 (`#999999`) |
| Texte « aucun » dans une fiche | gris 0,5 |
| Texte désactivé d’un bouton | 0,37 ; 0,37 ; 0,37 à 80 % |
| Libellé d’un bouton sans fond | 0,8 ; 0,85 ; 1 ; au survol, couleur de survol (plus claire) |
| Barre de jauge (remplissage par défaut) | cyan 0,2 ; 0,8 ; 0,85 sur fond 0,13 environ, cadre noir de 3 quand la jauge fait plus de 15 de haut et 20 de large |
| Barre de compétence | remplissage blanc à 10 %, sans fond, sans cadre, plancher à 1 % |
| Humeur positive / négative (pensées) | vert 0,1 ; 1 ; 0,1 / rose 0,8 ; 0,4 ; 0,4 ; sans effet : gris 0,5 à 75 % |
| Douleur moyenne / sévère | jaune 0,9 ; 0,9 ; 0 / orange 0,9 ; 0,5 ; 0 |
| Option de menu flottant | fond 21, 25, 29 ; au survol 29, 45, 50 ; désactivé 40, 40, 40 ; texte blanc, désactivé 0,9 |
| Fond de la barre d’inspection (bande des onglets) | 0,075 ; 0,086 ; 0,118 |
| Séparateur de liste | étiquette 0,8 gris, ligne 0,3 gris |
| Dates, argent, noms | date cyan 135, 246, 246 ; argent 219, 180, 12 ; nom 208, 155, 97 ; menace 212, 111, 104 ; alliés 0, 255, 0 ; neutres 0, 191, 255 ; hostiles rouge lisible |

**Elsewhere** : palette carton (sauge, ocre, terre cuite, crème) sans rôle sémantique unifié ; la fiche Bio n’utilise que le texte brun et un vert de jauge. **À faire** : définir les rôles ci-dessus (titre de section jaune, chip clair à 10 %, gris « aucun », vert/rose des pensées, douleur…) comme couleurs sémantiques du thème carton, et les réutiliser dans toutes les fenêtres.

### 1.3 bis Cadre des fenêtres

- Une fenêtre : marge intérieure 18 (la barre d’inspection et les onglets en ont 0 et se débrouillent eux-mêmes), bouton de fermeture 18 en haut à droite, titre facultatif en haut à gauche dans 25 de haut, bouton « Fermer » centré à 55 du bas pour les fenêtres qui en ont un.
- Fenêtre modale type : 500 × 500 par défaut, centrée.
- Fenêtre d’onglet principal : 1010 × 684 par défaut, réduite si l’écran est plus petit (hauteur maximale = écran − 35, largeur maximale = écran), collée en bas à gauche ou en bas à droite selon le côté du bouton qui l’ouvre, et posée juste au-dessus de la barre de 35.
- **Barre des onglets principaux** : 35 de haut collée au bas de l’écran ; les boutons se partagent la largeur de l’écran à parts égales, sauf les boutons « réduits » (Historique, Factions, Menu) qui ont une demi-part ; le dernier prend le reste. Ordre : Inspecter (invisible), Architecte, Travail, Planning, Assignations, Animaux, Faune, Recherche, Quêtes, Monde, Historique, Factions, Menu. Raccourcis : Tab pour l’Architecte, F1 à F9 dans cet ordre (F7 Quêtes, F8 Monde, F9 Historique), aucun pour Factions et Menu. Texte en Small, icône de 32.
- **Info-bulle** : largeur maximale 260, marge 4 autour du texte, texte Small ; une info-bulle reste tant que la souris est sur sa zone.
- **Menu flottant** : colonnes de 70 au minimum, largeur maximale d’une option 300, marge horizontale 6 (3 en version minuscule), marge verticale 4, recouvrement de -1 entre options, hauteur d’une option = 2 × 4 + hauteur du texte (Small) donc ≈ 30, au plus 90 % de la hauteur de l’écran avec défilement, icône d’option 27 (16 en minuscule) avec marge 4, légère zone de 5 pixels autour de la fenêtre avant que le menu pâlisse et se ferme à 100 pixels de la souris.

## 2. Fiche Bio (`CharacterCardUtility`) : référence complète

C’est l’onglet « Personnage » de l’inspecteur d’un colon, et c’est la même fiche que dans la création de partie.

### 2.1 Taille et cadre

- Contenu de la fiche : **480 × 455**. Si le colon a au moins deux lignes de quête affichées, la hauteur grandit de 20 par ligne au-delà de la première (jamais dans le jeu de base sans quête).
- L’onglet l’entoure de 17 de chaque côté : fenêtre **514 × 489**, posée au bord gauche de l’écran, juste au-dessus de la bande des onglets (qui est elle-même au-dessus de la barre d’inspection de 165). Bouton de fermeture 18 en haut à droite de la fenêtre.
- Il n’y a **aucun défilement** dans la fiche à son état normal : les trois sections de gauche se partagent la hauteur, la liste des compétences (324) tient dans la colonne de droite.

### 2.2 Régions, dans l’ordre (coordonnées dans la fiche de 480 × 455)

1. **Nom** (y 0) : zone de 30 de haut, police Medium, nom complet avec surnom, première lettre majuscule, largeur de dessin libre (999). Si le colon est coupable (cas rare), icône de 32 après le nom. En création de partie, le nom devient trois champs de saisie (prénom, surnom, nom) de 100 de large chacun (un tiers de 300), limités à 12, 16 et 12 caractères.
2. **Boutons d’action en haut à droite**, de 30 × 30, de droite à gauche à partir de x = 480 − 85 = **395**, pas de 40 : bannir (colon libre sur la carte) ; renommer (colon) ; renoncer au titre (hors jeu de base) ; exécuter (colon coupable). Chaque bouton a son info-bulle.
3. **Pile du haut** (y = 30 + 10 = **40**) : une seule rangée de chips de **22** de haut, largeur de pile 470, marge entre éléments 5, entre lignes 4. Contenu de base : le texte principal (genre et âge biologique, par exemple « Homme, 37 ans », infobulle = l’âge chronologique) en simple étiquette de largeur texte + 5 ; la **faction** en chip (fond blanc 10 %, icône de faction de 20 × 20 à (1, 1), nom à droite à partir de x = hauteur + 5, largeur = texte + 22 + 15) quand le colon appartient à une faction visible ; d’autres chips selon les extensions. Après la pile, 10 de marge si elle contient quelque chose ; si la pile a consommé moins de 78 de hauteur, on ajoute 15 de plus. Dans le cas courant du jeu de base, le début des deux colonnes est donc à y = 40 + 22 + 10 + 15 = **87**.
4. **Colonne de gauche** : rectangle (0, 87) de **250 × (455 − 87 = 368)**.
5. **Colonne de droite** : rectangle (250, 87) de **258 × 368** (dépasse de 28 le bord de la fiche, volontairement ; les compétences n’en occupent que 230).

### 2.3 Colonne de gauche : trois sections de même hauteur

Chaque section a au départ une hauteur minimale ; la hauteur disponible (368) est divisée en parts égales (≈ 122,7 pour trois sections). Si une section est plus haute que sa part, les autres se réduisent d’un pixel à la fois jusqu’au minimum ; si rien ne suffit, la première section est comprimée à son minimum + 12 et toute la colonne défile (barre de 16 de large). Un cas rare : quatre sections avec les capacités psychiques (hors jeu de base).

**Section 1 : Passé** (pas de titre).
- Une ligne de 22 par histoire, pas de 22 + 4 = 26 : « Enfance » puis « Adulte » (le jeu de base a deux emplacements) ; une troisième ligne « Titre » avec la fonction (22 de haut) si le colon en a un.
- Étiquette (Small, milieu-gauche, x 0, largeur 250) puis **chip** à x = **90** : fond blanc à 10 %, largeur = texte + 10, texte centré, tronqué si trop long ; survol = surbrillance et infobulle avec la description complète de l’histoire.

**Section 2 : Traits** (hauteur minimale 30 + pile).
- Titre « Traits » en jaune titre (0,9 ; 0,9 ; 0,3), zone de 200 × 30, pas de 24 avant la pile.
- Pile de chips : lignes de 22, marge de ligne 4, marge d’élément 5, largeur de pile 245 (colonne − 5), **un chip par trait** : largeur = texte + 10, fond blanc 10 %, texte à x + 5 (largeur − 10), surbrillance au survol, infobulle de trait. Un trait supprimé est grisé, un trait de gène bleu clair ; sinon blanc : le jeu **ne colore pas** les traits selon leur effet bon ou mauvais.
- Sans trait : la ligne « Aucun » en gris 0,5 de 24 de haut, surbrillance au survol.

**Section 3 : Incapable de** (hauteur minimale 30 + pile).
- Titre « Incapable de » (même jaune, zone de 200 × 24), pas de 24.
- Un chip par catégorie de travail interdite (même gabarit que les traits, texte capitalisé) ; la couleur du texte est le blanc, sauf bleu clair 0,67 ; 0,84 ; 0,9 si la cause est un titre royal. L’infobulle du chip dit pourquoi (histoire, trait, état de santé) et liste les travaux concernés. Si toutes les catégories tiennent sur une seule colonne verticale (largeur ≤ 250), elles sont empilées en colonne plutôt qu’en lignes. Sans interdit : « Aucun » en gris.

### 2.4 Colonne de droite : compétences

- Pour chacune des **12 compétences** dans l’ordre du jeu, du haut vers le bas : Tir, Mêlée, Construction, Minage, Cuisine, Plantes, Animaux, Artisanat, Artistique, Médecine, Social, Intellect (ordre décroissant de `listOrder` 120 à 10).
- Une ligne = rectangle de **230 × 24** (la colonne en laisse 258), pas vertical **27** (3 d’écart), 12 lignes = 324. Survol : surbrillance blanche à 10 % sur toute la ligne.
- Dans la ligne, de gauche à droite : étiquette Small, milieu-gauche, à x **6**, de largeur = (plus long nom de compétence, mesuré une fois pour tout le jeu) + 6 ; **icône de passion de 24 × 24** juste après l’étiquette (une flamme pour la passion simple, deux pour la brûlante, rien sans passion) ; **barre de remplissage** de l’icône jusqu’au bord droit de la ligne, sans fond ni cadre, couleur blanche à 10 %, remplissage = niveau / 20 avec plancher de 1 % ; **niveau** en nombre seul (« 7 », pas « 7/20 ») à 4 à droite de l’icône, Small, milieu-gauche, décalé de 3 vers le bas. Compétence totalement interdite : pas de barre ni de passion, tiret « - » grisé à 50 %.
- Infobulle de compétence : titre jaune, description grise, niveau et sa description, expérience du niveau (« x / y », seulement en jeu), plafond de gain quotidien, vitesse d’apprentissage (base 100 %, facteur de passion), 4000 par jour avant saturation à 20 %.

### 2.5 Ce qui est un survol et non du texte visible

Âge chronologique, histoire complète, effet de chaque trait, cause et liste des travaux interdits, description de chaque compétence et détail d’expérience, faction, titre royal. **Rien d’autre que ces éléments ne se trouve dans la fiche** : pas de liens familiaux (ils sont dans l’onglet Social), pas de ligne d’activité, de réaction hostile, d’ordres ou de besoins (ils sont dans la barre d’inspection et les autres onglets), pas de bouton « vêtements visibles » (le portrait est dans la barre d’inspection et dans la création de partie).

### 2.6 État d’Elsewhere (Bio)

Mesuré dans le client, onglet Bio d’Eden à DPR 1, fenêtre de 1282 × 976 : fiche ≈ **753 × 502**, plus bande d’onglets (34 + 4) et bande de résumé (≈ 118 + 4 + marges) en dessous, soit un dossier d’environ 753 × 660 (valeurs du code : largeur 760, hauteur maximale 660, en-tête 48 ou 76, `columnRatio` .48). Elle contient :

- colonne de gauche : ligne d’identité « Homme · Colon » avec âge sur deux lignes, activité, **menu « Réaction hostile »** (déroulant de 34), « Ordres », puis les titres « Passé », « Traits » et « Liens connus » en gras, deux lignes d’histoire sans chip, un trait par ligne **sans chip**, « Effets du profil » (valeur « Apprentissage 175 % »), liens familiaux, bouton « Vêtements visibles » ; en dessous, hors de l’écran, « Incapable de » (la fiche défile : barre verticale à droite) ;
- colonne de droite : titre « Compétences » puis 12 jauges pleine largeur à fond clair et cadre dessiné, avec le texte « n/20 » (et « · Indisponible ») **dans** la jauge, les passions comme des points orange dessinés à gauche (un ou deux) sans icône, plus une seconde jauge d’expérience quand la hauteur le permet.

### 2.7 Écarts et changements à faire (Bio), du plus visible au moins visible

1. **Taille et défilement** : viser 514 × 489 (contenu 480 × 455) avec trois sections égales à gauche et les compétences à droite, sans aucun défilement dans le cas normal. Retirer de la fiche les lignes d’identité, d’activité, de réaction hostile, d’ordres, de liens et d’effets de profil (leurs usages vivent déjà dans la barre d’inspection, Social et les infobulles).
2. **Chips** : trait, handicap de travail, histoire (à x = 90) et faction en chips de 22 de haut, largeur texte + 10, fond clair à 10 % (en carton : un papier légèrement plus clair), texte centré ou décalé de 5, survol en surbrillance claire, infobulle riche. Pile avec marge de ligne 4 et marge d’élément 5, retour à la ligne automatique à 245 de large.
3. **Titres de section** : « Traits », « Incapable de » en jaune titre (rôle `TipSectionTitle`), pas de titre pour le passé, et un « Aucun » grisé 0,5 quand une section est vide.
4. **Compétences** : lignes de 230 × 24 au pas de 27, étiquette à x = 6, icône de passion de 24 × 24 (flamme simple ou double, **pas de points**), barre blanche 10 % sans fond ni cadre, niveau en nombre seul à droite de l’icône, tiret grisé pour une compétence interdite ; surbrillance de la ligne au survol ; l’expérience va dans l’infobulle (pas de seconde jauge).
5. **Nom et boutons d’action** : nom complet en Medium en haut ; boutons de 30 × 30 de bannissement et de renommage à x = 395 puis 355 (confirmation par fenêtre dédiée). Elsewhere a déjà ces gestes ailleurs : les déplacer dans la fiche.
6. **Pile du haut** : « genre, âge » en étiquette avec l’âge chronologique en infobulle ; chip de la faction du colon (icône 20 × 20 + nom) cliquable vers l’onglet Factions.
7. **Couleurs sémantiques** : jaune titre, gris 0,5 des vides, blanc des traits, bleu clair des causes royales (inutile dans le jeu de base).
8. Texte du survol de trait : un seul bloc riche avec titre jaune ; ce contenu existe déjà dans Elsewhere (`traitTooltip`), il suffit de le présenter comme RimWorld.

## 3. Barre d’inspection et onglets de l’inspecteur

### 3.1 Barre d’inspection (`InspectPaneUtility`, `MainTabWindow_Inspect`)

- **Panneau** : largeur = 72 × max(6, nombre d’onglets visibles) (432 au minimum), hauteur **165**, collé au bas-gauche de l’écran **au-dessus de la barre des onglets principaux** (haut du panneau = hauteur d’écran − 165 − 35). Marge intérieure 0 pour la fenêtre, 12 pour le contenu (le contenu est remonté de 4 et descendu de 6).
- **Bande d’onglets** : au-dessus du panneau, hauteur 30, onglets de **72 × 30** alignés de la droite vers la gauche, police Small ; fond de la bande 0,075 ; 0,086 ; 0,118 sous l’onglet ouvert. L’onglet ouvert ouvre une fenêtre posée juste au-dessus de la bande (voir 3.2) ; cliquer à nouveau l’onglet la ferme (fermer, onglet de nouveau actif).
- **Contenu** : nom en Medium (zone de 50 de haut, largeur du panneau − boutons) ; les boutons d’angle de 24 × 24 (sélection suivante dans la case, info, renommage…) à droite ; puis à y = 26 : une rangée de jauges (`WidgetRow`, hauteur de jauge 16, largeur 93, espacement 6) avec la **santé**, l’**humeur**, le **planning**, la **zone autorisée** (colon), l’énergie (mécanoïde) ; ensuite le texte d’inspection (Small, défile si long).
- Couleurs de jauge : humeur 26, 52, 52 ; fond 10, 10, 10 ; santé 35, 35, 35 ; énergie 0, 52, 75 ; faim 184, 156, 90.
- L’ensemble tient dans le panneau sans défilement pour un colon.

### 3.2 Onglets (`ITab_*`)

Une fenêtre sans marge propre, au bord gauche de l’écran, **sa base posée sur le haut de la bande d’onglets**, avec le fond de fenêtre (21, 25, 29) et le bouton de fermeture de 18.

| Onglet | Taille | Remarques |
| --- | --- | --- |
| Personnage (Bio) | 514 × 489 | voir section 2 |
| Besoins | 580 × 520 (avec humeur), 225 × (n × min(70, 520/n)) sans humeur | colonne de besoins de 225 ; jauges ≤ 70 de haut ; voir 3.3 |
| Santé | **630 × 430** | colonne gauche 37,5 % (jauges de capacités), droite 62,5 % (lésions) ; voir 3.4 |
| Équipement | **460 × 450** | décalage haut 20 ; lignes de 28 avec icône de 28 à x = 4, libellé à x = 36, bouton de 24 à droite ; sous-titres de 22 ; défile si plus long |
| Social | **540 × 510** | liste des relations et de la dernière interaction, défile |
| Journal | **630 × 510** | 300 lignes au plus, défile |
| Stockage (bâtiment) | 300 × 480 | |
| Factures (établi) | 420 × 480 | |

### 3.3 Besoins (`NeedsCardUtility`)

- Fenêtre 580 × 520 : **colonne de besoins 225**, puis colonne d’humeur de 355.
- Besoin majeur : hauteur min(70, 520 / nombre de besoins) ; besoin mineur : largeur × 0,73, hauteur × 0,666 (min 30), précédé de 10 d’écart après les majeurs. Étiquette en Small (Tiny si le rectangle fait 55 ou moins), au quart gauche +29 de marge, jauge à 29 de marge gauche et droite, 14 de bas, flèches de variation, repères de seuil (pointes de 1 sur la moitié de la barre), curseur d’instant.
- Humeur : jauge sur 80 % de la colonne × 70 ; à y = 80, liste des pensées avec marge 10, **ligne de 20 avec pas de 24**, défile (barre de 16), niveau d’humeur en colonne de 32 à x = 235, étiquette sur 225.
- Couleurs : pensée positive vert, négative rose, nulle grise.

### 3.4 Santé (`HealthCardUtility`)

- 630 × 430 ; colonne gauche 37,5 % : titre en Medium, nom, capacités sous forme de jauges de 25 de haut avec espacement de 4 ; droite : lésions par partie du corps, lignes de 23 avec icônes de 20 ; boutons d’opération au bas, soins (priorité), interdiction de traitement, médicaments.
- Aucune ligne de santé n’est cachée derrière un défilement dans les cas courants.

### 3.5 État d’Elsewhere (barre d’inspection et onglets)

- Elsewhere place **le dossier entier au-dessus** du résumé, avec la bande d’onglets (Journal, Matériel, Social, Bio, Besoins, Santé) **entre la fiche et le résumé** ; le résumé (portrait, nom, âge, activité, boutons Mobiliser, Effacer les ordres, Travail, Fermer) est une bande de ≈ 724 × 115, plus large et moins haute que celle de RimWorld (432 × 165, avec jauges). Les jauges de santé, humeur, planning et zone sont dans RimWorld, pas dans le résumé d’Elsewhere.
- Besoins : le dossier répète identité, activité, réaction hostile et ordres au-dessus des besoins (absents de l’onglet RimWorld), puis la jauge d’humeur en haut de la colonne de droite ; les barres sont plus basses et leurs pourcentages se chevauchent. Taille ≈ 750 × 510 contre 580 × 520.
- À faire, par ordre de fréquence : (1) panneau d’inspection à la place et à la taille de RimWorld (bas-gauche, 432 × 165, jauges santé/humeur/planning/zone, nom en titre, boutons d’angle de 24) ; (2) bande d’onglets de 72 × 30 posée **au-dessus** du panneau, onglets du jeu de droite à gauche : Santé, Besoins, Personnage (Bio), Social, Prisonnier (si captif), Équipement, Journal ; les onglets d’animal (Dressage) n’existent que pour les animaux de la colonie ; (3) chaque onglet dans sa taille du tableau ci-dessus, collé à la bande ; (4) retirer des onglets les lignes qui ne sont pas dans le jeu (identité, activité, ordres, réaction hostile : déplacer la réaction dans l’onglet Assignations comme le jeu) ; (5) boutons « Mobiliser/Effacer/Travail » : ils sont dans la barre de commandes à gauche (Mobiliser) et dans les menus d’ordres du jeu, pas dans la barre d’inspection.

## 4. Barre des colons, alertes, lettres, temps

### 4.1 Barre des colons (`ColonistBar`)

- Cadre de portrait de base **48 × 48** ; texture du personnage 46 × 75 avec zoom 1,282 ; échelle `s` ∈ ]0,x ; 1], recalculée en commençant à 1 et multipliant par 0,95 jusqu’à ce que tout tienne. Pas entre portraits : (48 + 24) × s horizontalement ; écart entre groupes 25 × s ; pas vertical (48 + 32) × s. Position : marge haute **21**, centrée sur la largeur ; largeur maximale **écran − 520**.
- Nombre de rangées autorisé selon l’échelle : 1 rangée au-dessus de 0,58, 2 au-dessus de 0,42, 3 en dessous. Les entrées d’un groupe se répartissent par la méthode D’Hondt. Barre masquée si l’écran fait moins de 800 × 500.
- Sous le portrait : **surnom seulement**, Small ; humeur en dégradé de 35 de haut (0,4 ; 0,47 ; 0,53 à 44 %) ; arme en icône de 0,75 de la taille, à 1,05 de hauteur sous le cadre ; icônes d’état (mobilisé, malade, inactif…) en bas à gauche ; surbrillance de sélection 20 de saut à 0,4 d’échelle ; entrée dans une autre carte à 40 % d’opacité ; double clic (0,5 s) = centrer.
- **Elsewhere** : 3 portraits en haut-centre, cadre ≈ 46 × 62, surnom sous le portrait (fait le 22 novembre) ; échelle et rangées multiples absentes.

### 4.2 Alertes (`AlertsReadout`)

- Colonne de **154** de large collée au **bord droit de l’écran**, empilée **vers le haut au-dessus des lettres** (au-dessus de `LastTopY`), du plus critique au moins critique ; texte Small, ancré milieu-droite sur **148** de large (6 de marge), hauteur = hauteur du texte ; fond coloré par gravité (critique rouge clignotant) avec ombre portée pour la lisibilité ; survol = surbrillance et fenêtre d’information de **330** de large à gauche de la colonne (8 d’écart), qui suit la souris en hauteur ; clic = aller au problème ; clic droit = masquer.
- **Elsewhere** : colonne de notifications à droite (largeur 264 réservée), cartes de hauteur mesurée ; l’alerte et la lettre partagent une pile ; couleurs et clignotement à vérifier.

### 4.3 Lettres (`LetterStack`)

- Pile à droite, juste au-dessus des commandes globales (le haut du bloc d’alertes) ; hauteur de base 350 du bas ; espacement 12 ; une lettre est une icône de **38 × 30**, à 12 du bord droit ; survol = aperçu du titre ; clic = ouvrir ; clic droit = ignorer ; lettres épinglées ou à choix dans la pile.
- **Elsewhere** : pile de lettres native (voir `native-letter-stack.ts`), à comparer au 12 d’espacement et à la place au-dessus des alertes.

### 4.4 Temps et commandes globales (`GlobalControls`)

- Colonne de **200** de large (270 pour l’ombre) en **bas à droite**, de bas en haut, en partant de 35 au-dessus du bas : 4 d’écart ; **réglages d’affichage** (une rangée de boutons de 24 × 24, jusqu’à 5 par rangée, largeur de 141) ; 4 ; **vitesse** : 4 boutons de **32 × 24** (pause, ×1, ×2, ×3), décalés de 16, surbrillance du bouton actif ; 4 ; **date** (48 de haut, 74 avec la ligne de saison) ; **météo** (230 × 26) ; **température** sous le curseur (293 × 26, alignée à droite) ; **conditions de partie** (154 de large) ; compteurs facultatifs ; 10 d’écart puis les lettres.
- **Elsewhere** : bloc météo/heure/vitesse en bas à droite avec ses quatre commandes de vitesse (pause, ×1, ×3, ×6), plus les commandes de vue sur une rangée dessous ; les dimensions sont plus grandes (≈ 250 × 190 pour le bloc heure, vitesse et commandes de vue) et l’ordre est différent (heure au-dessus, commandes en dessous). **À faire** : reprendre l’empilement ci-dessus et les 32 × 24.

## 5. Onglets principaux (barre du bas) : tableaux

### 5.1 Tableaux de colons (`PawnTable`, Travail, Planning, Assignations, Animaux, Faune)

- Fenêtre : **pleine largeur de l’écran**, hauteur = contenu au maximum (écran − 35), **marge 6**, haut libre de 40 pour le Travail (case « priorités manuelles » à (5, 5) de 140 × 30, indications « priorité supérieure » et « priorité inférieure » en Tiny, gris 50 %, aux x = 370 et 630), bas libre de 53.
- **Ligne** : hauteur **30** (cellule par défaut), colonnes à largeur optimale bornée par un min et un max ; **en-tête** de 50 pour le Travail (étiquette courte en Small centrée au-dessus d’un trait vertical à 30 % de blanc de 2 de large qui descend vers la colonne), sinon hauteur du texte. Défilement vertical avec barre de 16 ; l’en-tête reste fixe.
- **Cellule de priorité du Travail** : case de **25 × 25** centrée, décalée de 2,5 vers le bas, chiffre en police Medium ; fond et couleur selon la priorité et la compétence ; infobulle riche. Colonnes du Travail : nom (avec icône), faction, copier/coller les priorités, puis un type de travail par colonne (étiquettes courtes) ; Planning : nom, copier/coller, 24 cases horaires, zone autorisée ; Assignations : nom, réaction hostile, soins médicaux, tenue, nourriture, drogues, lecture, charge ; Animaux : nom, genre, âge, stade de vie, gestation, suivi, maître, état mental, lien, stérile, abattre, soins, relâcher, zone ; Faune : nom, genre, stade, chasser, apprivoiser, prédateur, état mental, info.
- **Elsewhere** (Travail, mesuré) : ≈ **1253 × 385**, pleine largeur et pas hors de l’écran, avec une recherche locale « Nom ou identifiant » (absente du jeu), un bouton « Priorités manuelles » au lieu de la case à cocher, des cellules empilant priorité et compétence (≈ 36 de haut, deux nombres dans la cellule), des en-têtes qui **coupent les mots** (« Repo s », « Géôl e ») au lieu de les écrire en entier au-dessus d’un trait, et deux colonnes « Copier/Coller » en fin de rangée. **À faire** : cellule 25 × 25 avec un seul chiffre (la compétence reste dans l’infobulle), en-tête de 50 avec étiquettes complètes et trait vertical, ligne de 30, case « priorités manuelles » en haut à gauche, retirer la recherche (garder le tri par clic d’en-tête).

### 5.2 Architecte (`MainTabWindow_Architect`)

- Fenêtre **200** de large, marge 0, **deux colonnes** de boutons de **32** de haut ; la catégorie ouverte affiche sa grille d’icônes dans une seconde fenêtre à droite, plus la zone d’information de **270** de haut (nom, coût, description, matériaux) ; les palettes ordres/zones suivent le même gabarit.
- **Elsewhere** : palette repliée d’Ordres/Zones et vue Architecte ; mesure à faire.

### 5.3 Recherche, Quêtes, Historique, Factions, Menu

- Fenêtre standard 1010 × 684 sauf : Quêtes et Historique **1010 × 640** ; Menu **450 × 390** ; Recherche : colonne de gauche **22 % de la largeur (270 au minimum)**, arbre de projets de **140 × 50** avec 50 d’écart, onglets de 100 à 200, recherche de 200 × 24, rangées de 24 ; Quêtes : liste de gauche à 36 %, rangées de 32 ; Historique : lignes de 30, colonnes pin/icône de 30, date de 90, recherche à (720, 8), graphiques de 450 de haut avec boutons de 110 × 40 ; Factions : lignes de **80**, icône de 42 à x = 24, colonne de base 300, info 40, relations 70, bonne volonté naturelle 54, titre de 50.
- **Elsewhere** : Recherche en catalogue de 4 projets par rangée (pas l’arbre de 140 × 50) ; Quêtes/Historique/Factions en dossiers adaptatifs. Les tailles réelles sont à mesurer au lot dédié ; l’arbre de recherche est un écart de structure connu (voir V477).

## 6. Dialogues, menu principal, création de partie

- **Boîte de message** : 640 × 460, titre de 42 en haut, texte défilant, **boutons de 35 de haut** (largeur partagée) en bas, A et B à gauche et à droite.
- **Options** : 650 × 600, liste de catégories de **160** (lignes de 48, écart 2, icône 20) à gauche, options à x = 177, bouton OK de 160 × 40 en bas centré, ligne basse de 50, recherche de 30 ; interligne de liste 5.
- **Menu principal** : panneau de **450 × 550** centré (décalé de 50 vers le bas), boutons de jeu sur 170 de large, liens web sur 145 à 17 de distance, titre de 1032 × 146 au-dessus.
- **Pages de création** : page standard **1020 × 764**, titre en Medium dans 45, bas de page avec boutons de **150 × 38** (Retour à gauche, Suivant à droite, 17 de marge) ; zone utile = hauteur − 38 − 17 − titre. Scénarios : liste à 35 % de la largeur, lignes de 68 ; Monde : étiquettes de 200 et champs de 30 de haut ; Départ : page sans fenêtre, boutons en bas centrés ; Colons : onglets de 140, entrée de colon de 60 de haut, portrait de 92 × 128 (70 × 110 dans la liste), résumé de compétences de 127 de haut, avec la fiche Bio de la section 2 dans la partie droite.
- **Elsewhere** : accueil et chargement en dossier carton, sans le gabarit de page standard (titre, zone, boutons de 150 × 38) ; création en plusieurs fenêtres plus petites. **À faire** : gabarit de page unique (1020 × 764, titre, zone utile, pied de page) pour toutes les étapes.

## 7. Ordre de réalisation proposé (fréquence de vue, impact)

1. **Système** (section 1) : échelle unique, lignes et espacements, couleurs sémantiques, chip, jauge, cadre de fenêtre ; condition de toutes les suites.
2. **Barre d’inspection et onglets** (section 3) : vus à chaque sélection. Commencer par la fiche **Bio** (section 2), puis Besoins, Santé, Équipement.
3. **Barre des colons, alertes, lettres, temps** (section 4) : toujours visibles.
4. **Tableaux du Travail et de l’Assignation** (section 5.1) : vus à chaque partie.
5. Architecte, Recherche, Quêtes, Historique, Factions, Menu (5.2, 5.3).
6. Pages de création, accueil, dialogues, Options (section 6).

Contrôle de coût pour l’implémentation : une fiche de 480 × 455 contient peu d’éléments (3 sections, 12 compétences, quelques chips) ; elle doit se composer **une seule fois par changement** (sélection, trait, compétence) et se redessiner sans recherche par image, comme les pages natives actuelles. Les chips sont des plans d’encre partagés, pas des objets propres.
