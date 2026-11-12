# Soir du 12 novembre 2026 : chargement, joueur scripté, coût de la promenade

Les trois réponses de l'utilisateur au bilan de la nuit ([bilan-nuit-20261112.md](bilan-nuit-20261112.md)) : « 1 oui, 2 améliorer, 3 continuer ».

## 1. Chargement des sauvegardes anciennes : validation du schéma d'origine et du monde final

**Règle.** Une sauvegarde d'un schéma ancien est toujours validée strictement à son propre schéma avant toute migration, puis le monde final est validé. Les ≈ 40 validations complètes des schémas intermédiaires, produits par nos propres migrations, ne sont plus faites au chargement (`src/sim/serialization.ts`, `verifyMigrationSteps`). Une sauvegarde invalide à son propre schéma reste refusée au même endroit, avec le même message.

**Tests.** Toute la suite de tests revalide chaque schéma intermédiaire (`tests/setup-migration-steps.ts`, chargé par `vitest.config.ts`) : une erreur dans une de nos migrations y échoue à son étape. `tests/migration-final-validation.test.ts` charge cinq sauvegardes de schémas 101 à 250 des deux façons : même monde, mêmes étapes de progression du chargement, et une sauvegarde invalide à son schéma refusée avec le même message.

**Seconde validation finale.** Le monde final était validé deux fois (avant et après la fusion des cailloux isolés). La seconde n'est plus faite quand la fusion n'a rien changé (même tableau de ressources) : c'est le même monde, déjà validé. Ce gain vaut aussi pour les sauvegardes au schéma courant et pour le contrôle de chaque sauvegarde dans le Worker dédié (voir [save-off-thread-20261111.md](save-off-thread-20261111.md)).

**Vérification.** Les 71 sauvegardes de `public/test-saves` chargées avec et sans les validations intermédiaires donnent des mondes identiques à l'octet (`tmp/perf/steps/compare.ts`). Temps de chargement dans Node, machine chargée par d'autres contrôles, donc indicatifs :

| Sauvegarde | Schéma | Avant | Après |
|---|---|---|---|
| Les Forges (publiée) | 263 | 65,4 s | 6,1 s |
| Les Éclaircies (publiée) | 263 | 30,0 s | 4,1 s |
| Les Aulnes intégrées (v394) | 250 | 33,1 s | 1,6 s |
| Les Aulnes (v223, 250²) | 198 | 46,9 s | 1,0 s |

Ce n'est pas une mesure du chargement dans le navigateur, qui ajoute la lecture du fichier et la préparation de l'affichage.

## 2. Campagne « Atterrissage » graine 42 : joueur scripté

Pendant une alerte d'animal en rage, le joueur scripté du test (`tests/scenarios/crashlanded-player.ts`) :

- fait ramasser l'arme du défenseur à terre par le meilleur tireur restant, quand l'animal est à au moins 8 cases de l'arme (s'équiper est un ordre civil : démobiliser, ramasser, puis remobiliser) ;
- fait ramener un colon à terre sur un lit de l'abri quand l'animal est à au moins 10 cases de lui ;
- fait manger, toujours mobilisé, un colon à l'abri qui a faim quand l'animal est à au moins 10 cases de la nourriture (un colon mobilisé ne mange pas seul, comme dans RimWorld).

Le joueur réagit aussi à un raid dont le défenseur tombe : les autres s'abritent de la même façon, sans sortir manger (un pillard entre dans la pièce, contrairement à l'animal). Côté soins, il donne la priorité de médecin et l'ordre de soin dans la même décision (au lieu d'attendre 250 ticks entre les deux), redirige un médecin vers un blessé qui saigne plus que celui qu'il soigne, et accepte pour un blessé qui saigne un médecin qui a faim ou sommeil sans être affamé ni épuisé.

Aucune règle du jeu n'est modifiée.

**Résultat** (campagne complète depuis le jour 0, six essais successifs, chacun révélant la limite suivante du joueur) : l'animal en rage du jour 21 est abattu par Noé avec le revolver ramassé, Ada est secourue et soignée ; le raid du jour 22 met à terre Noé puis Mina, qui sont secourus et soignés par Ada. **Les trois colons sont vivants au jour 24**, mais Mina, gravement blessée deux jours plus tôt, est encore alitée en convalescence ; or le test exige que tous soient debout à la fin. Le test reste donc rouge sur cette seule vérification finale, qui n'est pas relâchée sans l'avis de l'utilisateur.

## 3. Coût de la promenade

Optimisations exactes gardées (même état bit à bit sur Les Forges et Les Éclaircies, y compris avec les contrôles des caches de terrain et de l'index des piles) :

- la grille d'obstacles des animaux (terrain et murs) est gardée d'un passage de la faune à l'autre tant que le masque de terrain ne change pas ; seules les portes et les chantiers sont relus ;
- les coûts de passage lus par les recherches de chemin de la promenade sont retenus case par case pour le reste du tick.

**Mesure au calme** (8 passages alternés, 120 ticks, simulation seule) : Les Forges 48,16 → 47,82 ms par tick en médiane (−0,7 %), Les Éclaircies 10,57 → 10,56 ms (pas d'écart mesurable). Le reste du coût de la promenade est fait des recherches de chemin elles-mêmes (vers la racine de promenade puis vers la destination), qu'une optimisation exacte ne peut pas raccourcir : une recherche guidée (A*) départagerait autrement les chemins de même coût, donc changerait l'état.

**Écarté.** Ne plus revérifier le masque de terrain case par case quand le compteur d'écritures du terrain n'a pas bougé : la suite de tests a montré que beaucoup de tests modifient les cases directement, sans le signaler, et un test exige que ces modifications soient vues tout de suite (`terrain-walkability-v433`). La variante limitée à un pas de simulation ne gagne presque rien, le jeu ouvrant un nouveau pas à chacune des 10 sous-étapes d'un tick. Les deux sont retirées.

## 4. Tests

Suite complète (lots de 30 fichiers, 3 processus, sans la campagne « Atterrissage » lancée à part) : par rapport à la nuit précédente, aucun échec nouveau une fois corrigés les deux problèmes qu'elle a révélés (le raccourci du masque de terrain, retiré ; un premier fichier de préparation des tests qui importait le module des sauvegardes et contournait ainsi les `vi.mock` de deux tests, remplacé par un simple drapeau global). Les 17 fichiers concernés ont été relancés avec le code final. Restent les échecs déjà connus et ceux liés à l'environnement : preuves locales absentes du dossier de travail, quatre démonstrations qui dépassent 30 s sous charge, empreinte figée de `main-terminal298`.
