# Les inspirations — V360

**Schéma 360.** Un colon de bonne humeur peut maintenant être **inspiré**, comme dans RimWorld 1.6 : pendant huit jours il travaille plus vite, se déplace plus vite ou tire mieux, ou bien sa prochaine négociation, son prochain recrutement, son prochain apprivoisement, sa prochaine opération ou sa prochaine création réussit au-delà de l'ordinaire. Une lettre bleue l'annonce, l'inspection l'affiche avec le temps restant, et une petite marque apparaît sur sa vignette de la barre des colons.

## Ce que dit le jeu de base (faits vérifiés)

Sources : RimWorld 1.6.4871, définitions `Defs/InspirationDefs/Inspirations.xml`, `Defs/Stats/Stats_Pawns_*.xml`, `Defs/RecipeDefs/SurgeryOutcomeEffectDefs.xml`, `Defs/TraitDefs/*`, et classes décompilées `InspirationHandler`, `Inspiration`, `InspirationWorker`, `InspirationDef`, `Pawn_MindState`, `Pawn` (`Inspired`, `Destroy`, `GetInspectString`), `Rand` (`MTBEventOccurs`, `Chance`, `Range`), `GenCollection.RandomElementByWeightWithFallback`, `StatWorker`, `QualityUtility`, `TradeDeal`, `InteractionWorker_RecruitAttempt`, `SurgeryOutcomeEffectDef`, `SurgeryOutcomeComp_Inspired`, `Frame`, `GenRecipe`, `ColonistBarColonistDrawer`. Aucun texte ni code du jeu n'est repris.

- **Déclenchement.** Toutes les 100 ticks du jeu, au tick propre à chaque personnage (`IsHashIntervalTick(100)`), un personnage qui n'est pas déjà inspiré et qui **peut être éveillé** tente sa chance. Sous **50 %** d'humeur, rien. De 50 % à 100 %, le temps moyen entre deux inspirations va **linéairement de 210 jours à 10 jours** (`GenMath.LerpDouble(0,5 ; 1 ; 210 ; 10)`), tiré par `Rand.MTBEventOccurs(mtb, 60000, 100)`. Aucun test d'état mental n'existe à cet endroit : c'est l'humeur qui écarte un colon en crise.
- **Choix du type.** Parmi les huit définitions dont l'ouvrier admet le personnage, un tirage pondéré : poids de base **1** multiplié par la meilleure passion des compétences associées (aucune ×1, mineure ×**2,5**, ardente ×**5**). La liste filtrée n'étant pas une liste indexée, le premier type admis est pris sans tirage, puis chaque type suivant tire `Range(0, total + poids) ≥ total`.
- **Admission (`InspirationCanOccur`).** Un colon libre (ni prisonnier, ni invité), jamais un animal ; pas à terre pour la frénésie de mouvement (les sept autres restent possibles à terre) ; âge minimal ; compétences requises ; types de travail non désactivés ; capacités ; statistiques non désactivées (la compétence de la statistique n'est pas totalement interdite) ; traits qui interdisent un type.

  | Type (définition) | Âge min. | Conditions | Compétence associée | Effet |
  |---|---|---|---|---|
  | Frénésie de travail (`Frenzy_Work`) | 10 | capable de travailler | — | vitesse de travail globale ×1,8 |
  | Frénésie de mouvement (`Frenzy_Go`) | — | pas à terre, capable de marcher (> 15 %) | — | vitesse de déplacement ×1,4 |
  | Frénésie de tir (`Frenzy_Shoot`) | 8 | tir non interdit | Tir | précision de tir +8 avant la courbe |
  | Commerce inspiré (`Inspired_Trade`) | 6 | Social ≥ 3, social non interdit | Social | avantage commercial +0,18 avant le plafond 0,395 ; prend fin à l'échange conclu |
  | Recrutement inspiré (`Inspired_Recruitment`) | 10 | Social ≥ 3, Geôlier, parler | Social | recrute le prochain prisonnier « à recruter » quelle que soit sa résistance ; prend fin au recrutement |
  | Apprivoisement inspiré (`Inspired_Taming`) | — | Animaux ≥ 3, Dressage, parler | Animaux | réussite certaine (chance 1, aucun tirage) ; prend fin à la tentative |
  | Chirurgie inspirée (`Inspired_Surgery`) | 13 | Médecine ≥ 3, Médecin, manipulation | Médecine | réussite ×2 avant la borne 0,98 ; prend fin à l'opération |
  | Créativité inspirée (`Inspired_Creativity`) | 13 | Construction, Art ou Artisanat ≥ 3 ; Art, Forge, Construction ou Couture ; manipulation | Art | +2 niveaux de qualité jusqu'à légendaire ; prend fin à la création |

- **Durée et fin.** Les huit durent **8 jours** de ticks du personnage (un personnage en cryptosommeil n'est pas mis à jour, son inspiration ne vieillit pas). La fin par usage arrive dans le consommateur : l'échange conclu (`TradeDeal.TryExecute`, pas les dons), le recrutement (seulement si le prisonnier n'est pas en mode « réduire la résistance »), la tentative d'apprivoisement, l'opération (avant le tirage du résultat, réussie ou non), l'objet créé avec qualité (recette, meuble, œuvre). La mort efface l'inspiration sans message ; être à terre ou en crise mentale ne l'interrompt pas.
- **Lettre et message.** Le début envoie une lettre **PositiveEvent** (raison d'abord : l'humeur élevée, puis l'effet) ; la fin, un message neutre « n'est plus inspiré ».
- **Affichage.** Le texte d'inspection du personnage montre « Inspiré : … (expire dans …) » ; la barre des colons ajoute l'icône d'inspiration après celle de l'incendie.

## Ce qui est livré

- **État de la partie (schéma 360).** Chaque personnage peut porter `inspiration360` : le type, le tick de début et le tick de fin par expiration. Validation stricte dès 360 (type connu, ticks entiers, début pas dans le futur, fin au moins huit jours après le début), aussi pour les colons en caravane, dans les archives de carte perdue et en caisson.
- **Déclenchement.** Sur chaque carte, au tick propre de chaque colon (le même intervalle haché que les besoins, ici de 100 ticks), selon l'humeur, la loi de Core et ses deux tirages, puis le tirage pondéré dans l'ordre des définitions. Un colon qui ne peut pas être éveillé ou sous 50 % d'humeur ne tire rien.
- **Effets.** Frénésie de travail : construction, déconstruction, réparation, minage, forage, culture et coupe, soins, opérations, recherche, lissage des sols, récolte des produits animaux et tout le travail aux établis (cuisine, couture, forge, art, raffinage…). Frénésie de mouvement : la vitesse des colons sur la carte. Frénésie de tir : la précision des colons. Commerce inspiré : le marchand visiteur et le vaisseau en orbite, prix affichés compris. Recrutement, apprivoisement, chirurgie (amputations, retraits et poses de prothèse) et créativité (œuvres, vêtements, armes, meubles et tables de jeu avec qualité) comme dans le jeu de base, puis fin par usage.
- **Lettre et fin.** Lettre « Bonne nouvelle » dans la pile du schéma 352, texte français ; la fin écrit une ligne dans le journal de la colonie (l'équivalent du message temporaire du jeu de base, encore absent).
- **Interface.** Inspection : ligne « Inspiration : … · expire dans … » sous l'activité, et dans l'onglet Besoins sous la jauge d'humeur. Barre des colons : petite marque soleil après l'icône d'incendie, libellé au survol.
- **Cryptosommeil.** À la sortie d'un caisson, la fin de l'inspiration est reculée du temps passé dedans, comme les autres horloges suspendues.
- **Sauvegardes.** Une sauvegarde 359 migre par le seul numéro : aucune inspiration n'est offerte à une colonie existante (le jeu de base ne la donne qu'au tirage, qui reprend dès le chargement). Une 359 qui contiendrait une inspiration est refusée. Avant 360, rien ne change : aucun tirage, aucune écriture, mêmes facteurs (exactement 1).

## Adaptations

- **Flux de tirage propre.** Le jeu de base tire dans son générateur global ; ici, chaque vérification a ses tirages propres, fonction pure de la graine du monde, du colon et du tick (`inspiration-stream-360.ts`). Aucun autre flux ne bouge, l'ordre des colons ne compte pas, rien n'est sauvegardé ; les probabilités et l'ordre des tirages sont ceux du jeu de base.
- **Fin par expiration.** Le tick de fin est enregistré au lieu de l'âge ; il est reculé pendant le cryptosommeil, ce qui revient à l'âge du jeu de base.
- **Message de fin.** Ligne de journal, faute de messages temporaires (voir les lettres V352).
- **Travail « capable de tout ».** Aucun passé d'Elsewhere n'interdit tout travail : la condition de la frénésie de travail est toujours remplie.
- **Icône.** L'icône d'inspiration du jeu de base n'existant pas ici, la marque réutilise le pictogramme soleil existant.

## Ce qui reste

- **Traits.** Les traits du jeu de base qui interdisent un type (bagarreur : frénésie de tir ; lambin : frénésie de mouvement) ou qui en donnent un après une crise (artiste torturé : créativité, 50 %) arrivent avec le lot des traits (361) ; leur branchement se fait dans `inspirationCanOccur360` et à la fin d'une crise.
- **Caravanes.** Un colon en caravane garde son inspiration et sa date de fin, mais n'en reçoit pas de nouvelle tant qu'il voyage, et le commerce avec une caravane rencontrée ou un comptoir de colonie n'utilise ni ne consomme le commerce inspiré ; la vitesse de la caravane ignore la frénésie de mouvement.
- **Autres sources.** Les inspirations données par un discours, un rituel, le psilocap ou une capacité psychique viennent des extensions, hors du périmètre du jeu de base.
- **Messages temporaires** du jeu de base pour la fin d'une inspiration.
