# V371 — Semis retiré sous une nouvelle plante (schéma 371)

**Défaut corrigé.** Sur une carte géographique (celle de toute nouvelle partie), le générateur de plantes sauvages pouvait faire pousser une herbe sur une case de culture où un semis attendait encore son cultivateur. Le semis, gardé par Elsewhere comme une intention en attente, ne peut pas coexister avec une plante sur sa case : le monde devenait invalide et le restait (sur la sauvegarde RimWorld importée « Canard », dès le 157e tick et pendant les 1 344 ticks contrôlés ensuite), si bien qu'une sauvegarde faite à ce moment était refusée. L'ancien générateur des cartes non géographiques, celui des campagnes de test, évitait déjà toute case portant une tâche, ce qui explique que les campagnes ne l'aient pas vu. Le défaut a été trouvé par l'agent de l'import des sauvegardes RimWorld.

**Règle du jeu de base.** `WildPlantSpawner` ne regarde pas les semis (ce ne sont pas des objets dans RimWorld) : la plante pousse, puis `WorkGiver_GrowerSow` demande de couper la plante gênante avant de semer.

**Ce qui change.** À partir du schéma 371, juste après l'étape qui fait pousser les plantes, un semis en attente sur la case d'une plante nouvellement apparue est retiré ; si un cultivateur était en route pour lui, il est libéré, comme le moteur le faisait déjà quand un semis devenait invalide pendant le travail. La découverte ordinaire de la culture retrouve ensuite l'intention « couper puis semer ». Les tirages du générateur ne changent pas (la plante pousse exactement comme avant) ; aucun tirage n'est ajouté. Seules les ressources créées pendant l'étape sont lues.

**Sauvegardes.** Le schéma 370 migre par son seul numéro ; rien n'est offert. En dessous de 371, rien ne change.

**Tests.** `tests/wild-plant-sow-371.test.ts` (semis retiré et cultivateur libéré, plante déjà présente ignorée, aucun tirage, rien en dessous de 371, migration par le numéro). Vérification hors dépôt : la sauvegarde « Canard » convertie reste valide sur 1 500 ticks.
