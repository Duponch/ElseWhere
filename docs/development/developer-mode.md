# Mode développeur

Lot du soir du 22 novembre (point 31 de [la liste des retours](chantier-retours-20261122.md)) : agir « par magie » dans la partie pour tester les mécaniques (humeur à 100 %, repos à 0 % pour voir la cascade de conséquences…), avec une base facile à étendre. **Aucun changement de schéma** : le mode est une préférence du navigateur et un drapeau de session du Worker, jamais dans une sauvegarde.

## Ce que fait le jeu de base (lu dans le code, pas copié)

- `Verse.Prefs.DevMode` : préférence du joueur. Quand elle est active, `Verse.DebugWindowsOpener` dessine en haut à gauche de l’écran une rangée de boutons : journal, valeurs réglables, **menu des actions de débogage**, réglages d’affichage, inspecteur, palette de développement et **mode divin**.
- Le menu des actions est `LudeonTK.Dialog_Debug` (onglet « Actions ») : des actions rangées par catégorie (`DebugActionCategories` : général, pions, apparition, incidents…), avec une zone de recherche. Chaque action est un `[DebugAction(catégorie, nom, type)]` dont le type est `Action` (s’exécute tout de suite), `ToolMap` (s’exécute sur la case cliquée) ou `ToolMapForPawns` (s’exécute sur les pions de la case cliquée).
- `Verse.DebugSettings.godMode` n’est pas enregistré : c’est un état de la partie en cours, remis à faux quand le mode développeur est désactivé (`Prefs`). Raccourci `Dev_ToggleGodMode`. Il rend tous les bâtiments constructibles (`Designator_Build.Visible`), les pose **d’un coup et sans matériaux** (`Designator_Build.DesignateSingleCell`), et permet de vendre ce qui n’est pas à soi. La recherche a un bouton « Terminer maintenant » dans le mode développeur (`ResearchManager.FinishProject`).
- « Avancer le temps » (`DebugActionsMisc.IncrementTime`) saute l’horloge de jeu de base (`DebugSetTicksGame`).

## Ce que fait Elsewhere

### Activer

Options → **Développeur** → « Mode développeur ». Préférence du navigateur (`elsewhere.developer-mode.v1`), désactivée par défaut, jamais dans une sauvegarde. Le client la transmet au Worker (`dev-mode`) : tant qu’elle est inactive, le Worker refuse toute action de développeur. Un joueur qui ne l’active jamais ne voit rien de plus et ne peut rien de plus.

### Importer une carte de test RimWorld (schéma 381, 28 novembre 2026)

Mode activé, l'écran **Charger une partie** propose un deuxième bouton distinct : **Importer une sauvegarde de test RimWorld**. Le bouton d'import normal reste strict. La préférence développeur et le mode divin ne sont toujours pas enregistrés ; c'est **l'origine de cette campagne de test** qui est désormais enregistrée (`developerTest381: true`), et reste vraie même après avoir changé de carte. Le Worker de simulation refuse son chargement tant que la préférence développeur n'est pas activée. La désactivation après le chargement ne retire pas cette provenance et n'autorise pas un futur rechargement normal.

Sans modifier les recherches apprises, la conversion de test enregistre une preuve locale de chaque exception : cases de béton au-dessus de sable meuble, bâtiments placés avant leur recherche (identifiant, type, ancre, orientation, matière), support incompatible sur les cases exactes de l'emprise et zones de culture d'hypertissu préexistantes. Seuls ces propriétaires importés peuvent être admis malgré le verrou ordinaire. Une nouvelle construction, un chantier, une recette, un bâtiment déplacé ou un identifiant différent ne bénéficie pas de cette exception ; les validateurs de forme, de référence, d'emprise et de quantité restent actifs. Les placements incompatibles qui ne disposent pas encore d'un cas d'admission reconnu restent refusés. Cette étape n'ajoute pas au jeu le catalogue ou les mécaniques manquantes.

Le script local `import-rws.ts` possède l'équivalent explicite `--developer-test` pour les témoins de test. Avec la sauvegarde développeur Core témoin, le refus normal a révélé 206 couches de béton sur sable meuble, des bâtiments de recherche verrouillés et une tombe construite sur béton. Le mode spécial a admis ces placements sans changer leurs coordonnées, sans fractionner les trois piles de 150 pénoxycyclines (le plafond incohérent de 75 a été corrigé dans **les deux modes**) et sans compléter de recherche. Le monde obtenu a passé le rechargement à l'identique et 120 ticks, et ses vrais checkpoints et deltas ont été adoptés. Les campagnes ordinaires 380 migrent au schéma 381 par le seul numéro, sans nouveau champ.

Les factures originales de test dont la recette existe peuvent également être conservées avant leur recherche. Leur autorité enregistre le couple identifiant de facture/recette et la pose exacte de la station d'origine. Aucun changement de recherche, aucune autorisation d'ajouter ou de copier une nouvelle facture de cette recette. Les ordres conservés restent en attente au planificateur, comme toute production verrouillée, puis empruntent les règles normales dès que leur recherche est acquise. Pour déplacer/minifier un atelier, retirer les factures encore verrouillées ou terminer leur recherche ; les autres ateliers ne changent pas de comportement. Les validations de la sauvegarde et des snapshots vérifient tous ces propriétaires, la recette admissible et l'absence de tâche en exécution tant que la recherche est verrouillée.

Qualification finale de cette tranche : 131 factures sur 215 dans GeneratedSave, dont 54 verrouillées conservées par leur preuve individuelle, 600 ticks et checkpoint + trois deltas valides, relecture stricte identique. Le parcours normal de ce même RWS refuse toujours `Invalid terrain grid.`. Voir [bilan de phase 1](rws-phase1-381-20261128.md).

### Barre et fenêtre

Mode actif, en jeu, deux boutons en carton apparaissent en haut au centre de la carte :

- **Actions** : ouvre la fenêtre des actions (non modale, la carte reste cliquable) : ligne « Cible » (le colon ou l’animal sélectionné), interrupteur « Mode divin », zone de recherche, puis les actions groupées par catégorie (repliables). Chaque action montre ses réglages (niveau, compétence, objet, quantité…) en listes et un bouton d’application.
- **Mode divin** : interrupteur de session (remis à faux à la désactivation du mode, non conservé entre deux visites, comme le jeu de base).

Les actions de type « case » (poser un objet, créer un animal, détruire des objets, terminer un chantier) **arment un outil** : le prochain clic sur la carte les applique avec cette case, jusqu’à Échap (équivalent de `ToolMap`). Les actions « sur la sélection » agissent sur le colon (ou l’animal) sélectionné ; sans sélection, l’action dit pourquoi elle ne peut pas s’appliquer.

### Une action = un ordre ordinaire

Chaque action est la commande `{type:'dev-action', action, targetId?, cell?, args?}`, appliquée par le Worker à une frontière de tick, acquittée, jamais écrite par l’interface. Elle appelle les fonctions de la simulation (besoins, santé, états mentaux, incidents, création d’animaux…) : la cascade est la vraie (un repos à 0 % envoie réellement au lit). La commande est validée strictement (identifiants du registre, paramètres déclarés avec l’une de leurs valeurs) et refusée avec sa raison : mode désactivé, aucune sélection, mauvais genre de cible, case hors carte, objet impossible…

### Actions disponibles

| Groupe | Action | Cible | Effet |
|---|---|---|---|
| Besoins | Faim, Repos, Loisirs, Confort, Beauté, Plein air, Espace, Tous les besoins | colon (faim et repos aussi animal) | fixe la jauge à 0, 25, 50, 75 ou 100 % |
| Besoins | Humeur | colon | fixe l’humeur actuelle ; elle redérive ensuite vers la valeur des pensées, comme dans le jeu de base |
| Santé | Tout soigner | colon / animal | efface blessures, saignement, maladies (ne ressuscite pas, ne repose pas les membres manquants) |
| Santé | Mettre à terre | colon / animal | jambes meurtries à 1 PV : choc, à terre par la voie ordinaire |
| Santé | Tuer | colon / animal | coup au cou d’une exécution puis mort ordinaire (cadavre, deuil) |
| Santé | Déclencher / retirer un état mental | colon | errance triste, frénésie alimentaire, colère, folie furieuse, rage meurtrière, excès d’alcool, frénésie incendiaire (pyromanes), par les fonctions de départ du jeu ; refus si le colon ne peut pas la subir |
| Compétences | Niveau de compétence, Passion | colon | fixe le niveau (0 à 20) ou la passion de l’une des 12 compétences (refus si le parcours l’interdit) |
| Carte | Poser un objet | case | quantité de 1 à une pile pleine d’un objet au sol (hors livres, cadavres, arbres emballés, cœurs d’IA, œufs, objets inachevés) |
| Carte | Créer un animal | case | animal adulte tiré comme à la génération de la carte, sauvage ou apprivoisé |
| Carte | Détruire les objets au sol | case | retire les piles ordinaires de la case |
| Carte | Terminer la construction | case | achève le chantier de la case (matériaux livrés) par la fin de travail du moteur |
| Carte | Terminer la recherche en cours | — | achève le projet choisi |
| Temps | Avancer le temps | — | une heure, six heures, un jour : la simulation les joue d’une traite après l’acquittement (voir limites) |
| Temps | Changer la météo | — | passe à l’une des 8 météos, fondu et durée comme une transition ordinaire |
| Incidents | Raid, Voyageur qui demande à rejoindre, Caravane marchande, Animaux de ferme, Animal sauvage qui s’attache, Aurore, Capsule de ressources | — | lance l’incident par sa fonction de résolution, sans attendre le calendrier ; dit pourquoi s’il ne peut pas (pas de calendrier, nuit requise, pas de place…) |

### Mode divin

Tant qu’il est actif : le travail de construction est instantané (le taux de travail devient énorme), et **choisir un projet de recherche l’achève aussitôt**. C’est le drapeau de session du Worker (`src/sim/dev-session.ts`), jamais enregistré, remis à faux avec le mode. Désactivé, le Worker se comporte à l’identique.

## Ajouter une action

Un seul module : `src/sim/dev-actions.ts`. Ajouter une entrée à `DEV_ACTIONS` :

```ts
{id:'need-food',group:'Besoins',label:'Faim (nourriture)',hint:'…',target:'creature',params:[levelParam()],
 apply:c=>setNeed(c, …)}
```

- `target` : `'none'` (s’exécute tout de suite), `'cell'` (outil de carte : le clic suivant envoie la case), `'pawn'`, `'animal'` ou `'creature'` (la sélection).
- `params` : listes de valeurs (`key`, `label`, `options`, `default`) ; la commande est refusée si une valeur n’est pas dans la liste.
- `apply` reçoit `{world, args, pawn?, animal?, cell?}` et renvoie `ok(message)` ou `no(raison)` : appeler les **fonctions de la simulation**, jamais écrire un état à la main quand une fonction du jeu existe (la cascade doit être la vraie).

La fenêtre, la recherche, les groupes, la cible et le refus avec raison viennent seuls du registre ; aucun fichier d’interface à toucher. Un test par action dans `tests/dev-actions.test.ts` (effet vérifié sur un petit monde, sauvegarde valide ensuite).

## Limites et ce qui n’est pas fait

- **Détruire** : seulement les piles d’objets ordinaires. Les bâtiments (déconstruction, réseaux électriques, enclos, lits…), les plantes et les arbres emballés ont des propriétaires qui exigent leur propre voie de retrait ; pas de « détruire » générique pour ne rien casser.
- **Mode divin** : construction instantanée (mais les matériaux restent à livrer) et recherche immédiate ; pas encore la pose directe sans bâtisseur ni matériaux, ni l’accès à tous les bâtiments sans recherche, ni la vente de ce qui n’est pas à soi.
- **Avancer le temps** : le jeu de base saute l’horloge ; ici l’état est daté (échéances absolues) donc la simulation est jouée pour de vrai, par tranches de 250 ticks, d’une traite : une heure est quasi immédiate, un jour peut figer l’écran plusieurs secondes sur une grande colonie. Une nouvelle menace arrête l’avance.
- **Fenêtre et sélection** : la fenêtre est une page native unique ; sélectionner un autre colon la remplace par sa fiche (le bouton « Actions » la rouvre, la sélection est conservée). Pas de fenêtre flottante en parallèle de la fiche.
- **Raid** : seulement avec le calendrier du narrateur (Cassandra) ; les calendriers historiques ont leurs groupes fixes.
- Pas encore (le jeu de base a) : le journal de débogage, les valeurs réglables, l’inspecteur de variables, la palette de développement (actions favorites), faire apparaître n’importe quel pion ou personne (un colon, un prisonnier, un visiteur), ressusciter, ajouter/retirer des traits, des blessures choisies, des relations, déclencher un incident chiffré par catégorie (feu, éruption, épidémie, retombées…), régler la date ou le conteur, révéler la carte, remplir ou vider une zone, outils de survol (afficher la valeur d’une case).
- Le Worker n’exécute les actions que pendant une partie en cours sur la carte active ; une action sur une carte de voyage reste valable (elle agit sur la carte courante).

## Vérification

- `tests/dev-actions.test.ts` (22 cas) : refus sans mode, refus sans cible / mauvaise cible / identité inconnue / paramètre hors liste, chaque besoin et l’humeur, repos 0 % qui envoie au lit, animal (nourriture, repos, à terre, mort), soins / à terre / mort, état mental, compétence et passion, objet et animal posés à une case, destruction, météo, avance du temps (demande sans saut d’horloge), raid sous calendrier, incidents, recherche, mode divin (recherche instantanée, taux de travail).
- `tests/dev-mode-ui.test.ts` : préférence éteinte par défaut, jamais écrite avant activation, mode divin non conservé, navigateur sans stockage, fenêtre (groupes, recherche, réglages, cible).
