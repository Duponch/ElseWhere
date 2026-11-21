# Feuille de route du 15 novembre 2026 : les bases d'abord

**Consigne de l'utilisateur.** Continuer d'avancer, en donnant la priorité à ce qui est le plus basique et le plus fréquent dans le vrai RimWorld et qui manque à Elsewhere. En parallèle : optimiser les performances, et vérifier que les règles déjà présentes suivent le code du jeu de base. L'utilisateur a demandé en particulier comment RimWorld guide un joueur qui lance sa première partie, pour faire de même.

**Méthode.** Trois audits en lecture seule, menés le 15 novembre sur les définitions installées de RimWorld 1.6 Core et sur son code décompilé :
- l'aide aux nouveaux joueurs ;
- les alertes et les lettres ;
- la couverture des fonctions de base.

Chaque manque reçoit une note :
- **A** : toutes les parties, dès les premiers jours ;
- **B** : la plupart des parties, dès la première saison ;
- **C** : occasionnel ou tardif.

Les lots sont rangés par note, puis par coût.

## 1. Accueil du nouveau joueur

**Ce que fait le jeu de base.**
- **Le tutoriel « Apprendre à jouer ».** C'est le premier bouton du menu principal. Il lance une partie dédiée (scénario Tutoriel, conteur « Tuteur » sans incident, difficulté facile) et enchaîne 37 étapes. Le joueur choisit le lieu et les colons, déplace la caméra, met en pause et en vitesse, trace une réserve et autorise les ressources de départ. Il construit ensuite une pièce, des lits, une torche et une zone de riz, équipe les armes et commande un repas. Il mine et coupe du bois, règle l'onglet Travail, lance une recherche, définit la zone domestique et le toit, pose des sacs de sable, puis abat un pillard. Chaque étape vérifie le geste réel et refuse les autres actions. Pendant le tutoriel, les crises mentales, les bagarres, les échecs de construction et la prédation sur les colons sont coupés.
- **L'assistant d'apprentissage.** Il compte 63 notions. Le jeu en propose une quand l'occasion se présente : un raid, un colon à terre, de la nourriture qui pourrit… Il choisit selon une « envie » qui combine la priorité de la notion, l'occasion et le savoir déjà acquis, et laisse un délai entre deux notions. Le joueur valide une notion en faisant le geste. Ce savoir est retenu d'une partie à l'autre, et les options permettent de couper l'assistant ou de le remettre à zéro.
- **Les conseils.** 90 conseils, tirés au hasard sur les écrans de chargement, changent toutes les 17,5 secondes.
- **Le reste.** Une fiche d'information pour tout objet, des lettres qui expliquent chaque événement, et les alertes (section 2).

**Ce qu'a Elsewhere.**
- Un parcours facultatif de 4 gestes (V470), un carnet d'aide de 11 rubriques et 8 contrôles du premier jour.
- Dans l'interface native publiée, rien de cela ne s'affiche en cours de partie : tout passe par Menu → Aide.
- Pas d'assistant, pas de conseils ; le bouton « Tutoriel » est désactivé.

**Lots, dans l'ordre :**
1. **(A)** Fiche de conseils visible en partie après l'ouverture des capsules, bouton et touche d'aide sur l'écran de jeu, guide du joueur corrigé. *Fait le 16 novembre.*
2. **(A)** Conseils de chargement en français, écrits pour les vraies commandes d'Elsewhere. *Fait le 16 novembre.*
3. **(A)** Moteur de l'assistant d'apprentissage avec les règles du jeu de base, option et remise à zéro, reprise des 4 gestes.
4. **(A puis B)** Environ 45 notions françaises pour les fonctions qui existent, déclenchées par les vrais événements de la partie.
5. **(A)** Surbrillance des vraies commandes de l'interface native, pour que notions et tutoriel montrent où cliquer.
6. **(B)** Prérequis du tutoriel : profil de partie « tutoriel » et ses règles, raid d'un seul pillard, passage au conteur choisi à la fin.
7. **(B)** Le tutoriel en 37 étapes adaptées à Elsewhere, et le bouton « Tutoriel » activé. *Fait : profil et contenu au schéma 347, leçons au schéma 349.*
8. **(B/C)** Avertissements ponctuels et fiche d'information des bâtiments, des personnes et des plantes.

## 2. Alertes et lettres

**Le jeu de base.**
- Les alertes apparaissent après 600 ticks. Chacune est revérifiée environ toutes les 24 images.
- Elles sont triées par gravité : critique, haute, moyenne. Les hautes et les critiques sonnent et rebondissent à leur apparition ; une critique pulse en rouge.
- Le survol explique l'alerte et met ses causes en évidence ; un clic va à la cause suivante.
- Les lettres ont cinq classes (grosse menace, petite menace, négative, neutre, positive), une pile, des archives de 200 éléments et une pause automatique réglable.

**Ce qu'a Elsewhere.**
- **Une régression :** l'alerte critique « incendie dans la zone domestique » et celle de la maladie des cultures n'atteignent jamais la liste de l'interface native.
- **Des lignes faussées :**
  - des visiteurs « 0 » dans chaque partie ;
  - des morts comptés pour toujours ;
  - un « dernier raid » qui ne s'efface pas ;
  - des prisonniers signalés même avec un geôlier ;
  - des blessés signalés alors qu'ils sont déjà au lit.
- **Un affichage limité :** seulement 4 cartes, et un ordre qui ne suit pas la gravité.
- **Des alertes manquantes pour des fonctions présentes :**
  - **(A)** pas de source de repas, pas de défenses, manque de loisirs, soins à donner ;
  - **(B)** épuisement, médicaments, vêtements usés, ennui, batteries, enclos, vêtements chauds.

**Lots :**
1. **(A)** Lignes corrigées, incendie rétabli, alertes précoces manquantes, gravités et présentation du jeu de base. *Fait le 16 novembre.*
2. **(B)** Alertes des besoins et de la santé. *Fait le 17 novembre (interface).*
3. **(B)** Alertes des enclos et des vêtements chauds. *Fait le 17 novembre (interface).*
4. **(B)** Lettres : classes, sons, pause, pile et archives de 200. *Fait, schéma 352 ; restent un son propre à chaque classe, les messages en haut à gauche et les lettres à choix.*
5. **(C)** Alertes occasionnelles : trémie, opération en attente, médecin ou mineur manquant, caravane immobile, fin de quête.

## 3. Fonctions de base

**Déjà complet :**
- les 12 onglets principaux et les 20 types de travail, dans l'ordre du jeu de base ;
- les 25 bâtiments de production, avec tout le chauffage et la climatisation ;
- toutes les recettes d'une colonie des premiers jours ;
- les factures, le copier-coller des réserves, l'emploi du temps au pinceau, la double sélection et la file d'ordres.

Les 51 recherches d'Elsewhere ont les coûts et les bureaux du jeu de base.

**Manques A (toutes les parties, premiers jours) :**
- l'optimisme et l'espoir d'une nouvelle colonie au départ, l'opinion « écrasés ensemble » entre colons, la pensée du maître pour l'animal lié ;
- les pensées de sommeil (par terre, dehors, au froid, à la chaleur), trempé, dans le noir ;
- l'onglet Travail sans mode simple à cases, clic pour changer, Maj+clic sur une colonne et tri ;
- la pensée du travail passionné et le besoin d'espace ;
- les câlins des animaux de compagnie, le sommeil dérangé.

**Manques B principaux :**
- **Au démarrage et en cuisine :** la pâte nutritive n'est pas connue au départ ; les œufs et la gelée d'insecte sont refusés dans les repas.
- **Commandes du quotidien :**
  - la mobilisation n'agit que sur le premier colon sélectionné ;
  - pas de bouton « Copier » sur un bâtiment ;
  - un colon mobilisé perd plusieurs actions du clic droit ;
  - la barre des colons n'a ni teinte d'humeur ni icônes.
- **Dépouiller** n'existe pas, ni la pensée liée aux vêtements d'un mort.
- **Humeur :**
  - quatre crises mineures manquent, si bien que la crise de boulimie pèse trop lourd parmi les crises mineures ;
  - pas de confort assis à un établi ;
  - l'onde psychique et l'apaisement sont tirés par le conteur mais sans effet ;
  - pas d'inspirations, pas de besoin d'extérieur ;
  - 9 traits seulement sur 43.
- **Contenu précoce :** chapeau de cow-boy, billard, poker, armoire à outils, tapis, pièges improvisés, devilstrand.

**Lots, dans l'ordre :**
1. **(A)** Début d'une partie « Atterrissage » (pensées, opinions, animal, recherche de départ, objets de départ interdits si le jeu de base le fait), pensées de sommeil et de temps. *Fait le 16 novembre, schéma 343.*
2. **(A)** Onglet Travail comme le jeu de base. *Fait, schéma 344.*
3. **(A)** Travail passionné et besoin d'espace. *Fait, schéma 345.*
4. **(B)** Sélection et ordres du quotidien : mobiliser la sélection, bouton « Copier », clic droit d'un colon mobilisé, barre des colons. *Fait, schéma 346.*
5. **(B)** Réserve d'humeur complète : crises manquantes, confort aux établis, onde psychique et apaisement, petites pensées. *Fait, schéma 350.*
6. **(B)** Dépouiller. *Fait, schéma 351 ; restent le filtre « vêtements de mort » des tenues et l'option « compter les vêtements souillés » des factures.*
7. **(B)** Contenu précoce : œufs et gelée en cuisine, chapeau, jeux, armoire à outils, tapis, pièges. *En cours : cuisine et chapeaux (353), tables de jeu (354), armoire et tapis (355) faits le 21 novembre ; restent les pièges explosifs et le tissu diabolique.*

## 4. En parallèle

- **Performances.**
  - Mesurer avec le banc empaqueté par esbuild (voir le [bilan du 15](bilan-20261115.md)) : le banc lancé par `tsx` surestime le temps d'environ un tiers.
  - Le profil de la simulation est plat. Le prochain gain notable reste la refonte de la publication du Worker (chantier 2), à mesurer dans le vrai client.
  - Chaque lot mesure le chemin qu'il touche.
- **Conformité.** Les audits ont aussi relevé des écarts sur des règles déjà présentes, à vérifier puis corriger au fil des lots :
  - les objets de départ ne sont pas interdits ;
  - les liens de l'arbre de recherche sont une copie manuelle des prérequis de la simulation, qui peut dériver ;
  - le pantalon pare-éclats ne se fabrique pas ;
  - des raccourcis diffèrent du jeu de base (C, X) ;
  - les seuils d'hypothermie et de nourriture faible de l'alerte ne sont pas ceux du jeu de base.
- **Campagnes.** « Atterrissage » et « prison » sont relancées après chaque série de lots qui touche leurs systèmes.

## 5. Ordre retenu

1. **Vague 1, faite le 16 novembre :** alertes A ; aide visible en partie et conseils de chargement ; premiers jours et pensées du quotidien (schéma 343).
2. **Vague 2, faite le 16 novembre :** moteur et notions de l'assistant d'apprentissage ; onglet Travail (344) ; travail passionné et besoin d'espace (345) ; sélection et ordres du quotidien (346) ; la surbrillance des commandes, prévue en vague 3, est faite aussi.
3. **Vague 3, faite :** prérequis du tutoriel (fait le 16 novembre, schéma 347) puis tutoriel en 37 étapes (fait le 17 novembre, schéma 349) ; lettres (faites le 17 novembre, schéma 352) ; réserve d'humeur (faite le 17 novembre, schéma 350) ; dépouiller (fait le 17 novembre, schéma 351) ; alertes B (faites le 17 novembre, interface) ; animal qui devient enragé quand on le blesse ou qu'un apprivoisement échoue (fait le 16 novembre, schéma 348).
4. **Vague 4, en cours :** contenu précoce (cuisine et chapeaux, tables de jeu, armoire et tapis faits le 21 novembre, schémas 353 à 355 ; restent les pièges explosifs et le tissu diabolique), puis les manques C.

Les lots déjà engagés plus tôt (conteur, commerce, armes) ne sont pas repris pour l'instant ; leurs restes figurent dans le [bilan du 15](bilan-20261115.md).
