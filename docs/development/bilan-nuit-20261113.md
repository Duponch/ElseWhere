# Nuit du 12 au 13 novembre 2026 : maladies, vêtements et incidents

Consigne de l'utilisateur : avancer toute la nuit sans attendre de relance sur les performances, la fidélité aux règles de RimWorld et les manques du jeu (fonctionnalités, règles, catalogue, objets), sans proposer de choix. Les règles sont relevées dans les définitions installées de RimWorld 1.6 Core. Le code et les textes sont propres à Elsewhere.

## 1. Lots livrés

| Lot | Schéma | Contenu | Note |
|---|---|---|---|
| Incidents divers | 305 | Aurore, animal apprivoisé seul, animaux de ferme, capsules de ressources | [V305](../gameplay/misc-incidents-v305.md) |
| Vers intestinaux, parasites musculaires | 306 | Deux maladies tirées jusqu'ici sans effet | [V306](../gameplay/parasites-v306.md) |
| Mécanites fibreuses et sensorielles | 307 | Deux maladies tirées jusqu'ici sans effet ; vitesse de marche au-delà de 100 % | [V307](../gameplay/mechanites-v307.md) |
| Vêtements dans tous les cuirs et laines | 308 | 15 matières de couture, 78 vêtements, migration des politiques de tenue | [V308](../gameplay/textile-apparel-v308.md) |
| Maladie du sommeil | 309 | Maladie tropicale tirée sans effet ; durée de soin propre à chaque maladie | [V309](../gameplay/sleeping-sickness-v309.md) |
| Hiver volcanique | 310 | −7 °C, ciel plus sombre, faune réduite, pas de loisirs dehors | [V310](../gameplay/volcanic-winter-v310.md) |
| Corrections de fidélité | 311 | Points de vie de 8 bâtiments, construction des générateurs, beauté (valeurs et formule) | [V311](../gameplay/core-fidelity-v311.md) |
| T-shirt et blouson | 312 | Deux vêtements Core dans 22 matières | [V312](../gameplay/garments-v312.md) |
| Corrections de fidélité : humeur | 313 | Fatigue et attentes en voyage, prisonniers, plaie infectée, seuils de beauté | [V313](../gameplay/mood-fidelity-v313.md) |
| Vêtements vendus par les visiteurs | 314 | Tous les vêtements ordinaires représentés, matière selon les fréquences Core | [V314](../gameplay/visitor-clothing-v314.md) |
| Corrections de fidélité : récoltes, cuisine, animaux | 315 | Rendement de récolte, plantes abîmées, cuisiniers maladroits, apprivoisement et dressage, portées du lièvre | [V315](../gameplay/work-animal-fidelity-v315.md) |
| Arc court | 316 | Première arme à distance sans poudre : fabrication, flèches qui coupent, vente par les visiteurs | [V316](../gameplay/short-bow-v316.md) |
| Corrections de fidélité : soins | 317 | Soin en lit d'hôpital, durée du soin de la grippe, expérience pour un animal | [V317](../gameplay/health-fidelity-v317.md) |
| Corrections de fidélité : combat | 318 | Animaux de la colonie à terre, taille des animaux visés, recul par balle, étourdissement contondant | [V318](../gameplay/combat-fidelity-v318.md) |
| Corrections de fidélité : vie sociale | 319 | Souvenir « M'a recruté », bagarres (pacifiques, malnutrition), fer à cheval, visites aux malades | [V319](../gameplay/social-fidelity-v319.md) |

## 2. Fidélité : écarts trouvés et corrigés

- **Durée d'un soin.** Dans le jeu de base, un soin agit pendant sa durée de base plus 3 heures de chevauchement, et on peut le renouveler pendant ces 3 dernières heures. Les nouvelles maladies suivent cette règle.
- **Vitesse au-delà de 100 %.** Le jeu de base rend plus rapide une personne dont la capacité de déplacement dépasse 100 %. Nos sauvegardes refusaient toute vitesse au-dessus de 100 % ; elles l'acceptent désormais à partir du schéma 307.
- **Audit du catalogue.** Un audit en lecture seule a comparé les chiffres du catalogue au jeu de base (recettes, bâtiments, recherches, objets, armes). Il a trouvé 14 écarts et deux erreurs de formule de beauté, corrigés dans le lot 311.
- **Audit des règles d'humeur, de besoins et de compétences.** Presque tout concordait. Il a trouvé six écarts, corrigés dans le lot 313.
- **Audit des plantes, des animaux et des vitesses de travail.** Cultures, flore sauvage, statistiques des animaux, vitesses de travail et électricité concordaient. Il a trouvé six écarts, corrigés dans le lot 315 : rendement de récolte, plantes abîmées, cuisiniers maladroits, apprivoisement et dressage, portées du lièvre.
- **Audits du combat, de la santé et de la vie sociale.** Trois audits en parallèle ont relevé respectivement 9, 4 et 8 écarts. Les corrections figurent dans les lots 317 à 319, les écarts restants au point 7.
- **Chemise : fausse alerte vérifiée.** La « Chemise » d'Elsewhere est la chemise boutonnée du jeu de base, avec les mêmes valeurs. C'est le t-shirt qui manque.

## 3. Inventaire du catalogue

Un inventaire en lecture seule a comparé les 714 définitions d'objets du jeu de base au catalogue d'Elsewhere. Points principaux :

- **Établis de production :** tous existent ; les manques sont dans leurs recettes.
- **Animaux de ferme :** vache, poule, mouton, chèvre et cochon manquent. Ils demandent de nouveaux modèles 3D dans le style d'Elsewhere.
- **Armes à distance :** seuls le revolver, le fusil à verrou et le lance-grenades IEM existent. Les arcs et les armes à feu courantes manquent.
- **Drogues :** seules la bière et les médicaments existent. La pénoxycyline est le prochain candidat utile : elle protège du paludisme, de la peste et de la maladie du sommeil.
- **Mobilier de loisir et de confort :** il manque notamment l'anneau de jeu de pierres, les tables de poker et de billard, et le canapé.

## 4. Performances (Les Forges, 80 colons)

Mesures prises sur la machine au calme, après le lot 311 :

| Mesure | Valeur |
|---|---|
| Simulation seule (Node, 120 ticks) | 44,0 ms par tick, soit au plus ×3,8 |
| Worker réel à ×3 (20 s) | 86,8 % du rythme tenu, contre 82,4 % au bilan du 12 au soir |
| Part du Worker : simulation / publication | 70,7 % / 17,6 % |

Ce sont des mesures uniques, sans alternance avec la version précédente ; l'écart avec hier n'est donc pas une mesure comparée.

Le profil de la simulation est désormais plat. Les plus gros postes sont la faune (9 % du profil, dont 3,5 % pour la promenade), le choix du travail (6,6 %) et la température des surfaces (3,7 %). Aucune ligne isolée ne dépasse 0,2 % : une optimisation exacte ne trouve plus de gros morceau.

Côté publication, les plus gros postes sont la publication complète (environ 100 ms par seconde, encodage et sections auxiliaires) et les paquets d'acteurs (5,8 %, dont 1,3 % pour la comparaison de toutes les piles). Cette comparaison ne peut pas se limiter aux piles modifiées : le journal des piles signale qu'une pile a changé, pas laquelle. Le prochain gain passe par la refonte de la publication déjà engagée (chantier 2).

## 5. Tests

Chaque lot a sa série de tests propres, plus ses tests voisins, choisis par nom de fichier : maladies, soins, besoins, vêtements, couture, factures, commerce, météo, plantes, faune, beauté, humeur, caravanes et migrations. Aucun lot n'a laissé d'échec nouveau. Les seuls ajustements portent sur des tests qui comptaient l'ancien catalogue (37 vêtements, 55 recettes, 5 familles) ou qui fabriquaient une sauvegarde ancienne en renumérotant un monde récent. Ceux-ci passent maintenant par `tests/scenarios/old-schema.ts`, qui retire d'abord le contenu que le schéma visé ne pouvait pas avoir.

**Campagne « Atterrissage » (graine 42).** Elle reste rouge au raid du jour 22. Hier soir, elle échouait sur « défense tombée » ; elle échoue maintenant un peu plus tôt dans ce même raid, quand un colon meurt ou s'épuise. La version d'avant le lot 313 donne exactement le même échec : ce lot n'en est pas la cause. Les incidents et les maladies ajoutés cette nuit modifient le déroulement de la partie, et la défense scriptée ne tient toujours pas ce raid. C'est un travail sur le joueur scripté du test, pas une règle à corriger.

Le test facultatif de retraite de caravane échouait déjà avant ces lots.

## 6. Publication

Construction prête depuis une copie exacte du commit `e5b994f5` (lot 313), par `git archive` : typage et construction Pages réussis, 1 142 fichiers, dans `tmp/publication-20261113/source/dist`. **Le déploiement en production a été refusé par le mode automatique.** Il attend votre accord. La commande, depuis ce dossier :

```
npx wrangler pages deploy dist --branch main
```

Ensuite, `node tmp/publication-20261113/verify-http.mjs` (avec `DEPLOY_URL` sur l'adresse de déploiement, depuis `E:/Code/RimWorld`) compare 36 fichiers octet par octet entre le site et la construction. La production publique reste celle du 12 au soir (`f693a6c7`, commit `65a9be6b`).

## 7. Suite prévue

Par ordre de priorité :

1. **Publication.** Déployer la construction prête après votre accord, puis la refaire pour inclure les lots suivants.
2. **Écarts d'audit restants.**
   - **Combat :** un pillard à terre peut mourir selon l'« intention de population » du conteur ; ce calcul et son historique ne sont pas encore modélisés. Restent aussi l'armure naturelle des animaux, le report des dégâts sur les petites créatures et l'efficacité des membres blessés pour les coups à mains nues.
   - **Santé :** il manque l'écart aléatoire du soin des personnes hors carte.
   - **Vie sociale :** interactions entre prisonniers, souvenir « m'a recruté », âge dans la compatibilité, règles des visites aux malades.
3. **Armes et objets.** Arc recourbé et grand arc, armes à feu courantes (pistolet automatique, fusil à pompe, fusil d'assaut, mitrailleuse, fusil de précision), puis pénoxycyline et politique générale des drogues.
4. **Contenu à modéliser en 3D.** Animaux de ferme (vache, poule, mouton, chèvre, cochon), tables de billard et de poker.
5. **Performances.** Refonte de la publication du Worker vers l'affichage (chantier 2) : publier seulement les colons et animaux modifiés, à mesurer d'abord dans le vrai client.
6. **Campagne « Atterrissage ».** Améliorer la défense du joueur scripté pour le raid du jour 22.
