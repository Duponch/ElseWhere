# Aide en partie (interface) — carte de conseils, bouton Aide et astuces de chargement

Lot d’interface, sans changement de schéma. Rien n’est écrit dans le monde, la sauvegarde ou la simulation : la carte lit l’état confirmé de la colonie et la mémoire des premiers gestes déjà conservée par le navigateur.

Avant ce lot, l’interface native publiée ne montrait aucune aide pendant la partie : le panneau de conseils n’existait que dans l’ancienne interface de développement, et le carnet de survie n’était accessible que par **Menu → Aide**. Ce lot rend visibles, pendant le jeu, les aides qui existaient déjà (huit préparations des premiers jours, parcours des quatre premiers gestes, carnet de survie) et ajoute des astuces aux écrans de chargement.

## Ce qui change pour le joueur

### Carte de conseils

- **Quand elle apparaît.** Dans une nouvelle colonie, la carte s’ouvre dès que les capsules de départ se sont ouvertes ; elle reste cachée pendant leur descente. Une colonie sans arrivée en capsules l’ouvre aussitôt. Une partie chargée affiche seulement l’onglet replié **Conseils**.
- **Où.** En bas de la colonne de gauche, au-dessus des boutons Ordres et Zones. La liste des stocks garde l’espace au-dessus et passe en pages si besoin. Les panneaux (inspection, tableaux) la recouvrent comme le reste du HUD.
- **Ce qu’elle montre.**
  - Le parcours **Premiers gestes** : nombre de gestes repérés, le geste en cours avec sa consigne, un bouton qui choisit le bon outil (Ouvrir Travail, Choisir Réserve, Choisir Couchage au sol, Choisir Zone de culture) et **Déjà connu** pour déclarer un geste connu. Hors parcours, **Commencer** ou **Reprendre**.
  - Les huit **préparations** des premiers jours (travail, réserves, couchages, provisions, cultures, repas, équipements, recherche), avec une pastille d’état : vert disponible, ocre à compléter, terre cuite à préparer, beige à examiner. Le survol donne les faits actuels ; un clic ouvre l’outil ou le panneau concerné, exactement comme **Aide → Conseils actuels**.
  - **Carnet de survie (H)** ouvre l’aide complète.
- **Replier, fermer, rouvrir.** **–** replie la carte en onglet (**Conseils · n/4 gestes ›**), un clic sur l’onglet la déplie. **×** la ferme. **Aide → Carte de conseils → Afficher la carte** la rouvre ; **Masquer la carte** la ferme depuis l’aide. Une carte fermée reste fermée sur les parties chargées pendant la même visite ; une nouvelle colonie la rouvre après ses capsules.
- **Mémoire.** Replier, fermer ou rouvrir la carte n’écrit rien : les repères des premiers gestes restent ceux du navigateur (clé `elsewhere.learning.first-gestures.v1`, partagée par toutes vos parties). Seuls **Commencer**, **Reprendre** et **Déjà connu** modifient ce parcours, comme dans l’aide.
- **Petits écrans.** Si la colonne est trop courte, la carte ne garde que les quatre premières préparations inachevées (« Et n autre(s) dans le carnet »), puis seulement l’onglet.

### Bouton Aide et touche H

- Un bouton **Aide** en carton, en haut à droite à côté du compteur d’images, ouvre le carnet de survie pendant la partie.
- La touche **H** fait de même (sans Ctrl, Alt ou ⌘). Elle est listée dans **Aide → Commandes et raccourcis**.
- L’aide reste celle qui existait : Votre première journée, Commandes et raccourcis, Premiers gestes, Conseils actuels, plus la ligne **Carte de conseils**.

### Astuces de chargement

- Une **astuce** apparaît sous la progression de l’écran de chargement d’une colonie (création comme chargement d’une sauvegarde) et sous l’état d’avancement pendant la création du monde (génération de la planète, confirmation du lieu, préparation de la carte).
- 47 astuces en français, écrites pour les commandes et règles actuelles d’Elsewhere (aucun texte repris du jeu de base) : touches, caméra, tracés, premiers jours, réserves, détérioration, pourriture, zone de foyer, portes, mobilisation, couvert, soins, sauvegardes.
- Elles passent dans un ordre aléatoire tiré une fois par visite, changent toutes les 17,5 secondes de temps réel, et chaque nouvel écran de chargement commence par l’astuce suivante.

## Référence RimWorld 1.6 (Core)

Faits relevés (code décompilé `Verse.GameplayTipWindow`, `Verse.LongEventHandler` ; définition `Data/Core/Defs/Misc/TipSetDefs/Tips.xml` ; audit de l’aide Core en lecture seule) :

- **Astuces.** Un seul `TipSetDef` (`GameplayTips`) de 90 astuces en groupes (interface, combat, chasse, caravanes…). `GameplayTipWindow` met toutes les astuces de tous les ensembles dans un ordre aléatoire une fois pour la session (`InRandomOrder`, en cache statique), passe à la suivante quand plus de **17,5 s** de temps réel se sont écoulées, et `LongEventHandler` remet ce minuteur à zéro dès qu’aucun long événement n’est en cours : le prochain écran commence donc par l’astuce suivante. La fenêtre de 776 × 60 se place sous la boîte d’état, uniquement pour les longs événements plein écran (asynchrones ou par étapes, avec `showExtraUIInfo`) : génération du monde, génération de carte, chargement. Les 11 astuces d’interface sont omises sur Steam Deck.
- **Aide d’apprentissage.** Le panneau `LearningReadout` (200 px, en haut à droite) affiche les concepts actifs ; la connaissance est propre au joueur et partagée par toutes ses parties (`Config/Knowledge.xml`) ; l’affichage du panneau vide est un réglage de partie, vrai sur une nouvelle partie. Le moteur d’apprentissage (désir, occasions, oubli) n’est **pas** repris ici.

## Adaptations

- **Place de la carte.** En bas à gauche plutôt qu’en haut à droite : dans Elsewhere, la colonne de droite porte les alertes. La carte prend l’espace du bas de la liste des stocks.
- **Contenu.** Ce ne sont pas les concepts Core mais les aides déjà propres à Elsewhere : les huit préparations des premiers jours et les quatre premiers gestes. Les concepts, leurs occasions et leurs seuils viendront avec le moteur d’apprentissage ; la fonction `readGuidanceCard` (`src/ui/guidance-card.ts`) est l’unique endroit qui décide de ce que montre la carte et les accueillera.
- **Ouverture.** Comme le panneau Core affiché par défaut sur une nouvelle partie, et comme l’ancien panneau d’Elsewhere : ouverte après les capsules d’une nouvelle colonie. L’état replié ou fermé n’est pas sauvegardé (ni dans la partie ni dans le navigateur) : il vaut pour la visite en cours.
- **Touche H et bouton Aide.** Core n’a pas de touche d’aide ; Elsewhere en garde une pour son carnet de survie.
- **Astuces.** Mêmes règles d’ordre, d’intervalle et de remise à zéro que Core, avec des textes propres à Elsewhere. Pendant la création du monde, Elsewhere garde son écran de paramètres avec la ligne d’état ; l’astuce s’affiche sous cette ligne au lieu d’un écran plein.

## Coûts

- Carte dépliée : une lecture des préparations au plus une fois par seconde de temps réel pour un nouvel instantané, ou aussitôt après un geste ou un dépliage ; la vue n’est repeinte que si son contenu change. Repliée ou fermée : aucune lecture de la colonie, seulement la mémoire des gestes.
- Astuces : l’écran de création ne se repeint, en dehors des progrès déjà signalés, que lorsque l’astuce change (contrôle chaque seconde) ; l’écran de chargement reprend la cadence existante d’une demi-seconde.
- Aucune mesure d’images par seconde n’a été faite pour ce lot.

## Contrôles

- `tests/guidance-native-1.test.ts` : 8 cas (carte après l’ouverture des capsules, jamais pendant la descente ; mêmes faits que l’aide et lecture bornée ; replier, fermer et rouvrir sans écrire la mémoire des gestes ; bouton Aide, carte et touche H ; rotation des astuces ; nombre et forme des astuces ; astuce de l’écran de chargement ; rotation pendant la génération de la planète).
- Voisins : premiers gestes, premiers jours, HUD natif, écrans d’accueil et de création, aide et menu natifs, progression du chargement. Typage complet.

## Limites

- Ni le moteur d’apprentissage (concepts, occasions, seuils, oubli), ni le tutoriel, ni la mise en évidence des commandes ne sont commencés : ce sont des lots suivants.
- Aucune vérification visuelle dans le navigateur n’a été faite pour ce lot ; les parcours natifs Playwright existants n’ont pas été rejoués.
- Les astuces décrivent le jeu actuel : une règle qui change doit être reportée dans `src/ui3d/native-tips.ts`.
