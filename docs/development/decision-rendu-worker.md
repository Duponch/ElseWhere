# Décision en attente — rendu WebGPU dans un Worker

**26 novembre 2026 — mis en pause à la demande de l'utilisateur.** Saf a essayé la vue en local et n'a pas pu départager les sensations de jeu. Il souhaite poursuivre d'abord le chantier visuel Gouache/Pastel.

- La piste reste disponible à `/worker-colony.html?hud=speed` (Options → Développeur), derrière sa propre entrée. Le jeu normal reste l'entrée de production.
- Le travail est enregistré dans les commits `a3582751` et `ae403266`. Point d'entrée `src/worker-colony.ts`, moteur et protocole `src/render/worker-scene/`. Les optimisations déjà intégrées à la partie normale restent utiles indépendamment du choix d'architecture.
- Le [bilan mesuré](performance-colonie-worker-20261126.md) contient les preuves natives : pixels identiques entre les deux voies de rendu, sélection en fonction de l'image présentée et commandes de vitesse natives. Le test ×6 de la vue expérimentale donne 112,1 dessins/s, 25,73 ticks/s, intervalle maximal du fil d'interface 33,2 ms et pause effective 446 ms. La vue expérimentale a un viewport et un périmètre d'interface différents du jeu complet.

## Décision à reprendre explicitement

Lorsque l'utilisateur reprendra le chantier de performances, ou avant de préparer une migration du rendu, présenter une comparaison à charge véritablement équivalente entre la partie actuelle et le Worker. Utiliser les mêmes sauvegardes, caméra, effets, résolution, HUD, vitesses ×1/×3/×6 et interactions. Mesurer plusieurs passages alternés, les ticks confirmés, les images rendues, les intervalles p95/p99/max, le délai des entrées et de la pause, la mémoire et le démarrage. Les fenêtres, ordres, sauvegardes et le reste du HUD doivent être raccordés ou représentés à charge équivalente pour conclure sur une migration complète.

Faire alors décider explicitement avec l'utilisateur s'il faut adopter ce mode comme architecture de production, continuer à le développer ou conserver uniquement le rendu actuel. Jusqu'à cette décision, conserver le prototype utilisable et différer son intégration générale. Les objectifs de performance restent ouverts (200 FPS stables et cadence ×6 sur Les Forges).
