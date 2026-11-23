# Fenêtres identiques à RimWorld : l'affichage toujours visible (vague 4, lot 4)

Points 17 et 32 du [chantier des retours du 22 novembre](chantier-retours-20261122.md). Interface seule : pas de changement de schéma, aucune règle de simulation touchée. Les formules viennent des classes de Ludeon décompilées (`ColonistBar`, `ColonistBarDrawLocsFinder`, `AlertsReadout`, `LetterStack`, `GlobalControls`, `GlobalControlsUtility`), réécrites dans `src/ui3d/native-hud-rimworld.ts` (fonctions pures, testées dans `tests/native-hud-rimworld.test.ts`).

## Barre des colons (`ColonistBar`, `ColonistBarDrawLocsFinder`)

- Cellule de portrait **48 × 48**, pas horizontal (48 + 24) × échelle, pas vertical (48 + 32) × échelle, marge haute **21**, largeur maximale **écran − 520**, centrée.
- L'échelle part de 1 et se multiplie par **0,95** jusqu'à ce que chaque groupe tienne dans le nombre de rangées permis : 1 au-dessus de 0,58, 2 au-dessus de 0,42, 3 en dessous. Les places d'une rangée sont réparties entre groupes par la méthode **D'Hondt** (`GenMath.DHondtDistribution`) ; un groupe sans place en prend une au plus grand. Écart de **25 × échelle** entre groupes, dernière rangée **centrée**. Barre masquée sous 800 × 500.
- Elsewhere n'a qu'un groupe (la colonie de la carte) ; la fonction accepte plusieurs groupes (caravanes, autres cartes) pour plus tard.
- **Plus de pages** : tous les colons sont sur la barre, comme dans le jeu. Les flèches « précédent / suivant » ont disparu ; il reste le bouton de liste complète à droite de la barre. Sur Les Forges (80 colons, 1 920 de large) l'échelle tombe à ≈ 0,46 sur 2 rangées, cartes d'environ 26 × 36 px comme dans le vrai jeu.
- La carte peinte (portrait, nom, jauge d'humeur, icônes d'état) garde son dessin en carton ; elle suit l'échelle. Les clavettes et le fil du haut disparaissent sous 0,6 (trop petits).
- La largeur du coin gauche (ressources) se calcule sur le bord gauche réel de la barre.

## Alertes (`AlertsReadout`)

Colonne de **154** de large collée au bord droit, empilée **vers le haut** : la dernière carte se termine là où commencent les lettres (`LetterStack.LastTopY`), la plus critique en haut. Les cartes font toute la largeur (elles s'ajustaient avant au texte). Cartes toujours en carton (couleurs par gravité et clignotement inchangés), clics (aller au problème, clic droit : masquer), molette et bouton « N alertes · tout voir » inchangés (au sommet de la colonne quand ça déborde). Les flèches de défilement ne sont plus montrées (la colonne est trop étroite, la molette et la liste complète restent).

## Lettres (`LetterStack`)

Les lettres partent du bas, **10** au-dessus du bloc de commandes, **30** de haut, **12** d'écart, regroupées en une lettre « N de plus… » quand la colonne manque de place : ce comportement existait ; seule la base change (hauteur du nouveau bloc, 196 px au lieu de 264).

## Commandes globales (`GlobalControls`, `GlobalControlsUtility`)

De bas en haut, colonne collée à droite (origine = 35 du bas du jeu ; dans Elsewhere, au-dessus de la barre du bas) :

1. 4 d'écart, **réglages d'affichage** : boutons de **24 × 24**, 5 par rangée (largeur 141), la sixième passe à la rangée du dessus (murs, toits, feuillages, zones, maison, caméra : les six commandes d'Elsewhere) ;
2. 4, **vitesse** : 4 boutons de **32 × 24** (pause, ×1, ×3, ×6), décalés de 16 sur une bande de 150 ;
3. 4, **date** (200 × 48) : heure puis date ;
4. **météo** (ligne de 26, icône de 22 à gauche) ;
5. **température** de la case sous la souris (ligne de 26, alignée à droite) ;
6. 10, les lettres.

La date, la météo et la température sont du lettrage crème cerné de sombre sur la carte, comme le texte du jeu (ombre portée), au lieu d'une grande planche : les cartes de la colonne restent les boutons. Clic sur la date, la météo ou la température : la page des conditions, comme avant.

## Ce qui reste partiel

- Les conditions de partie (largeur 154) sont encore dans l'info-bulle de la météo et le texte de la ligne météo, pas dans leur propre rangée.
- Pas de fenêtre d'information de 330 de large à gauche de la colonne pour les alertes : l'info-bulle existante sert.
- La fiche de lettre et le compteur d'alertes ne sont pas retouchés ; les caravanes ne forment pas encore de groupe de la barre.

## Mesure et vérification

Voir le rapport de livraison : coût d'image sur Les Forges à ×1, avant et après, dans le vrai client.
