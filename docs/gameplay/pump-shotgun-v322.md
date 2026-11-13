# Fusil à pompe — V322

Schéma 322. Le fusil à pompe du jeu de base (Gun_PumpShotgun) : une arme courte portée, puissante, qui fait reculer.

## Fabrication

- **Coût :** 60 acier et 3 composants.
- **Exigences :** Artisanat 5, recherche Armurerie.
- **Poste :** atelier d'usinage.
- **Travail :** 12 000 unités du jeu de base.
- **Qualité et ouvrage :** comme le revolver et le fusil à verrou (ouvrage inachevé, auteur et progression conservés).

## Caractéristiques (qualité normale)

| Valeur | Fusil à pompe |
|---|---|
| Portée | 15,9 cases |
| Visée | 0,9 s (54 ticks du jeu de base) |
| Récupération | 1,25 s (75 ticks) |
| Précision (contact / courte / moyenne / longue) | 80 % / 87 % / 77 % / 64 % |
| Projectile | 18 dégâts, pénétration 14 %, vitesse 55, pouvoir d'arrêt 3 |
| Corps à corps | Crosse et canon, 9 dégâts |
| Points de vie, masse, valeur | 100, 3,4 kg, 253,2 |

Avec un pouvoir d'arrêt de 3, une décharge fait reculer même un ours ou un muffalo (lot 318). Le fusil à pompe se fond à la fonderie électrique pour 15 acier.

## Commerce

Les marchands visiteurs peuvent désormais vendre :
- un fusil à pompe ;
- un lanceur IEM, déjà présent dans le jeu mais jamais proposé jusqu'ici.

Le jeu de base les comptait déjà parmi leurs armes possibles. Les tirages aléatoires sont inchangés.

## Rendu

Modèle original : canon large au-dessus d'un tube magasin, garde coulissante en bois, carcasse et crosse en bois. Il se porte en bandoulière comme le fusil à verrou.

## Limites

Le pistolet automatique et la mitraillette demandent des recherches absentes (culasse non verrouillée). Les armes à rafales (fusil d'assaut, mitrailleuse) demandent le tir en rafale, pas encore modélisé.

## Sauvegardes

Une sauvegarde 321 passe à 322 en changeant seulement son numéro. Avant 322, le fusil, sa recette et ses projectiles sont refusés.

## Vérifications

`tests/pump-shotgun-322.test.ts` couvre :
- recette, valeur et profil de tir par qualité ;
- visée de 54 ticks, vrais tirs et reprise exacte de la sauvegarde ;
- vente par les visiteurs avec les mêmes tirages ;
- refus avant 322 ;
- migration.
