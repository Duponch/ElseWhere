# Raids de toutes les factions hostiles — V331

Schéma 331. Jusqu'ici, tous les raids humains de Cassandra venaient des pirates. Dans le jeu de base, chaque faction hostile peut attaquer la colonie. Elsewhere tire désormais la faction comme le jeu de base : tribus et étrangers attaquent aussi.

## Choix de la faction

Le jeu de base retient chaque faction :
- hostile au joueur, ni vaincue ni temporaire ;
- capable de lever un groupe de combat avec les points de menace du moment : 35 points pour les pirates, 40 pour les tribus, 60 pour les étrangers (le combattant le moins cher de la faction).

Chaque faction humaine pèse 1. Les mécanoïdes pèsent leur courbe du jeu de base (0 jusqu'à 300 points, 1 à 700, 1,8 à 1 400…), seulement après 45 jours et si la colonie a admis les raids mécaniques. La faction du raid précédent pèse 0,4 fois son poids.

Dans un monde par défaut, quatre factions humaines sont hostiles au départ : les pirates, la tribu farouche, la tribu sauvage et l'union rude des étrangers. Les factions civiles ne le sont pas, mais une faction qui devient hostile entre dans le tirage, et une faction pacifiée en sort.

| Points | Avant | Maintenant |
|---|---|---|
| 1 000 (après 45 jours) | mécanoïdes 57 %, pirates 43 % | mécanoïdes 25 %, chaque faction humaine 19 % |
| 500 (avant 45 jours) | pirates 100 % | chaque faction humaine 25 % |
| 40 (raid d'introduction) | pirates 100 % | pirates, tribu farouche, tribu sauvage : un tiers chacun |

Si aucune faction ne convient, le jeu de base refait le tirage en mode « désespéré », sans le délai de 45 jours : Elsewhere fait de même.

Le raid d'introduction (jour 5,4, 40 points) tire aussi sa faction. Il garde un seul pillard, sans arme, comme avant.

Le journal nomme la faction : « Raid (nom de la faction) : 4 assaillant(s)… ».

## Les assaillants

Les pillards restent des ennemis pour la simulation, et appartiennent à leur vraie faction du monde.

Le groupe suit le jeu de base : tirage d'un modèle de groupe de combat selon sa fréquence, puis dépense des points, chaque type de combattant coûtant sa puissance de combat, sans dépasser le coût maximal par combattant de la faction. Un seul chef par raid.

Tribus (trois modèles : mixte 100, archers 60, mêlée 60) :

| Type du jeu de base | Coût | Arme dans Elsewhere |
|---|---|---|
| Pénitent | 40 | masse en bois (adaptation : gourdin absent) |
| Guerrier | 50 | masse en acier (adaptation : ikwa absent, même catégorie « correcte ») |
| Archer | 45 | arc court |
| Chasseur | 60 | arc recourbé |
| Archer lourd | 75 | grand arc |
| Berserker | 65 | lance en acier |
| Chef à distance | 85 | grand arc |
| Chef de mêlée | 85 | épée longue en acier |

Les tribaux portent une tenue tribale en tissu, les autres une chemise en tissu.

Étrangers (un modèle) :

| Type du jeu de base | Coût | Arme dans Elsewhere |
|---|---|---|
| Villageois | 45 | revolver |
| Garde | 60 | fusil à verrou |
| Mercenaire tireur | 85 | fusil à pompe |
| Conseiller (chef) | 40 | revolver |

Les pirates gardent leur groupe actuel (vagabond, cogneur, pillard armé, pirate).

## Adaptations

- **Armes.** Le jeu de base choisit une arme selon des étiquettes et un budget ; Elsewhere donne une arme fixe par type, en qualité normale.
- **Types absents.** Le modèle tribal de brèche (hache de brèche), et chez les étrangers les grenadiers, les mercenaires d'élite (armes avancées) et les mercenaires à lame (bouclier) sortent du tirage ; les poids des autres types sont conservés.
- **Poids selon le coût.** Le jeu de base réduit un peu le poids des types bon marché quand un type cher est disponible. Pour les types gardés (coûts 40 à 85), ce facteur reste au moins 0,91 : il n'est pas appliqué.
- **Température.** Le jeu de base écarte les factions humaines quand il fait moins de −40 °C ou plus de 45 °C à l'arrivée. Ce filtre n'est pas encore appliqué.
- **Stratégie.** Tribus, étrangers et pirates peuvent tous se regrouper avant l'assaut (V330) ; le tirage de stratégie est le même. Les sièges, que les tribus ne pratiquent pas, n'existent pas encore.
- **Prisonniers.** La résistance initiale d'un captif reste celle du vagabond (7 à 12), quelle que soit sa faction. Le jeu de base la tire selon le type du pillard ; la conserver demande de porter le type sur la personne capturée, y compris en caravane et hors carte, ce qui dépasse ce lot.

Les raids des cartes temporaires, des caravanes et du réacteur du vaisseau gardent leur comportement. Les mondes sans registre de factions gardent les pirates.

## Sauvegardes

Une sauvegarde 330 passe à 331 en changeant seulement son numéro. Deux champs nouveaux, refusés avant 331 :
- le modèle de groupe d'un raid tribal ou étranger, avec un groupe vérifié (types du modèle, coût maximal, un chef au plus, dépense complète) ;
- la faction du raid précédent, qui doit être une faction du monde capable d'attaquer.

Les pillards présents d'un raid doivent appartenir à une faction de la famille de leur groupe.

## Vérifications

`tests/raid-factions-331.test.ts` couvre :
- les poids des factions, mécanoïdes compris, et le facteur 0,4 ;
- le délai de 45 jours, le tirage désespéré et les factions pacifiées ;
- les groupes tribaux et étrangers dans leur budget, et les groupes falsifiés refusés ;
- l'équipement, la tenue et la faction des pillards ;
- le raid d'introduction et le premier raid de cycle tirés par Cassandra ;
- l'aller-retour d'une sauvegarde de Les Éclaircies et le refus des nouveaux champs avant 331 ;
- la migration.
