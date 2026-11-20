# Les lettres du jeu de base — V352

**Schéma 352.** Les incidents et événements que le jeu possède déjà envoient maintenant une **lettre** comme dans RimWorld 1.6 : une enveloppe colorée qui s'empile en bas à droite, au-dessus de l'horloge, avec son son d'arrivée, sa pause automatique et sa place dans l'Historique. La page modale « Nouvelle(s) menace(s) » disparaît : les menaces arrivent elles aussi par lettre.

## Ce que dit le jeu de base (faits vérifiés)

Sources : RimWorld 1.6.4871, définitions `Misc/LetterDefs`, `Misc/MessageTypeDefs`, `SoundDefs/UI_Oneshots_Misc`, `Storyteller/Incidents_*`, `MentalStateDefs`, `GameConditionDefs`, et classes décompilées `LetterStack`, `Letter`, `ChoiceLetter`, `StandardLetter`, `BundleLetter`, `LetterDef`, `Archive`, `MainTabWindow_History`, `Messages`, `Message`, `PrefsData`, `AutomaticPauseMode`, `MentalStateHandler`, `Pawn_MindState`, `Pawn_HealthTracker`, `ShortCircuitUtility`, `TimedDetectionRaids`, `SymbolResolver_AncientTemple` et les `IncidentWorker` cités plus bas. Aucun texte ni code du jeu n'est repris.

- **Classes.** Cinq classes de base, chacune avec une couleur, une couleur de clignotement et sa période, un rebond éventuel, un son d'arrivée et un mode de pause :

  | Classe | Couleur | Clignote toutes les | Rebond | Son | Pause dès |
  |---|---|---|---|---|---|
  | Menace majeure (ThreatBig) | rouge (204, 115, 115) | 6 s | oui | LetterArrive_BadUrgentBig | « Menaces majeures » |
  | Menace (ThreatSmall) | orangé (204, 155, 125) | 16 s | oui | LetterArrive_BadUrgent | « Toutes menaces » |
  | Mauvaise nouvelle (NegativeEvent) | jaune (204, 196, 135) | 40 s | non | LetterArrive_BadUrgentSmall | « Toutes lettres » |
  | Événement (NeutralEvent) | gris (175, 176, 185) | 90 s | non | LetterArrive | « Toutes lettres » |
  | Bonne nouvelle (PositiveEvent) | bleu (120, 176, 216) | 90 s | non | LetterArrive_Good | « Toutes lettres » |

  Le **décès** (Death) hérite de la mauvaise nouvelle, la **nouvelle quête** (NewQuest) de la bonne nouvelle. Le mode de pause par défaut d'une lettre est « toute lettre ».
- **Pause.** `LetterStack.ReceiveLetter` met en pause quand la préférence `Prefs.AutomaticPauseMode` est au moins égale au mode de la lettre (Jamais < Menaces majeures < Toutes menaces < Toutes lettres). La préférence vaut « Menaces majeures » par défaut ; c'est un réglage du joueur, pas de la partie.
- **Pile.** Lettres de 30 px espacées de 12 px, la plus récente en bas ; s'il n'y a pas la place, les plus anciennes sont repliées dans une seule lettre « N de plus… » (BundleLetter) qui en donne la liste au clic et ne se retire pas au clic droit. Une nouvelle lettre tombe en une seconde ; une menace rebondit toutes les 5 s après 15 s si on ne la survole pas ; une lettre clignote selon sa période. Survol : texte de la lettre et surbrillance de ses cibles. Clic gauche : la lettre s'ouvre ; **Fermer** et **Aller à l'endroit** la retirent de la pile. Clic droit : elle est retirée.
- **Archive.** Chaque lettre reçue est archivée (Historique, onglet Messages). L'archive garde les **200** entrées non épinglées les plus récentes (`Archive.MaxNonPinnedArchivables`) ; une entrée épinglée ou une lettre encore dans la pile n'est jamais retirée.
- **Classe envoyée par chaque événement présent dans le jeu.**
  - Raid ennemi (humains, largage, mécanoïdes) : menace majeure (`IncidentWorker_RaidEnemy.GetLetterDef`).
  - Meute enragée : menace majeure (`IncidentWorker_AggressiveAnimals`). Animal qui se venge d'une blessure ou d'un apprivoisement raté : menace seul, menace majeure s'il entraîne sa meute (`Pawn_MindState.StartManhunterBecauseOfPawnAction`). Folie animale isolée : menace.
  - Crises : la Fureur violente et la Colère meurtrière sont des menaces ; l'errance triste, la frénésie alimentaire, la crise de destruction, l'errance psychotique, la retraite dans sa chambre et les séries d'insultes sont des mauvaises nouvelles ; les frénésies de drogue n'ont pas de lettre. Seulement pour les gens du joueur (colons, prisonniers).
  - Maladies (grippe, peste, paludisme, maladie du sommeil, vers, parasites, mécanites) : mauvaise nouvelle. Fléau des cultures : mauvaise nouvelle. Court-circuit : mauvaise nouvelle.
  - Vague de froid, canicule, orage de foudre, retombées toxiques, hiver volcanique : menace (la définition de l'incident l'emporte sur celle de la condition). Éclipse, éruption solaire, bourdonnement psychique : mauvaise nouvelle. Aurore, apaisement psychique : bonne nouvelle.
  - Visiteurs, voyageurs : événement. Caravane marchande, vaisseau marchand en orbite, capsules de fret, animaux de ferme, animal qui s'apprivoise seul, recrutement d'un prisonnier : bonne nouvelle.
  - Décès d'un colon ou d'un animal de la colonie : lettre de décès (la mort d'un prisonnier n'est qu'un message).
  - Danger ancien (bâtiment ancien approché) et camp repéré par l'ennemi : menace majeure.
  - Offre de quête : nouvelle quête.

## Ce qui est livré

- **État de la partie (schéma 352).** La campagne garde `letters352` : la pile (identifiants des lettres affichées), l'archive (lettres et lignes du journal épinglées, dans l'ordre de leur tick), les épingles et le prochain identifiant. Chaque lettre a sa classe, un titre et un texte en français, ses cibles (cases, personnes, animaux ou mécanoïdes), sa carte quand la partie en a plusieurs, son tick d'arrivée et l'indication « lue ». Un seul propriétaire pour toute la campagne : les cartes secondaires écrivent dans la même pile.
- **Producteurs.** Chaque événement ci-dessus écrit sa lettre à l'endroit où il est validé, juste après sa ligne de journal (dont il reprend souvent le texte). Rien ne parcourt la carte à chaque tick.
- **Pile en bas à droite.** Cartes en carton de la couleur de leur classe, la plus récente en bas, au-dessus de l'horloge et sous la colonne des alertes ; repli des plus anciennes dans une carte « N de plus… ». Chute à l'arrivée, rebond des menaces non lues, clignotement des lettres non lues. Survol : texte complet et cadre autour de la première cible sur la carte affichée. Clic gauche : page de la lettre avec **Voir** (va à la cible puis retire la lettre) et **Fermer** (retire la lettre ; elle reste dans l'Historique) ; fermer la page autrement la laisse dans la pile. Clic droit : retirée. La pile ne se redessine que quand elle change.
- **Commandes.** Ouvrir (marque la lettre lue), retirer, épingler et désépingler passent par le pont comme toute commande : ils sont déterministes, ne touchent ni la simulation, ni ses tirages, ni ses horloges, et sont refusés avant le schéma 352.
- **Pause automatique.** Le réglage des Options gagne **Toutes lettres** : Jamais, Menaces majeures (défaut), Toutes menaces, Toutes lettres. Chaque classe met en pause selon son mode Core. Le réglage reste une préférence du navigateur. Au chargement, les lettres déjà reçues ne mettent pas en pause.
- **Son.** Un son par arrivée, celui de la classe la plus urgente.
- **Historique.** L'onglet Historique liste d'abord les lettres archivées (plus récentes en premier) avec **Ouvrir** et **Épingler / Désépingler**, puis le journal, dont chaque ligne peut être épinglée : elle est alors copiée dans l'archive et y reste. Un bouton n'affiche que les entrées épinglées.
- **Sauvegardes.** Validation stricte dès 352 (classes, cibles, ordre, identifiants, lettres de la pile et épingles présentes dans l'archive, au plus 200 entrées non épinglées hors pile). Une sauvegarde 351 migre par le seul numéro : pile vide, aucune lettre offerte rétroactivement ; une 351 qui contiendrait des lettres est refusée. Avant 352, rien ne change : même journal, mêmes tirages, même état.

## Adaptations

- **Sons.** Le jeu n'a pas encore les cinq sons d'arrivée du jeu de base : les menaces utilisent le son de menace existant (plus aigu pour la menace simple), les autres classes le son de panneau à trois hauteurs différentes ; la lettre de décès n'ajoute rien au son de décès déjà joué.
- **Place de la pile.** La pile prend au plus 45 % de la hauteur libre au-dessus de l'horloge ; la colonne des alertes s'arrête au-dessus d'elle et défile si besoin. Dans le jeu de base, les alertes passent d'abord et les lettres prennent le reste.
- **Surbrillance.** Le survol encadre la première cible (le cadre du tutoriel est réutilisé) au lieu de surligner chaque cible.
- **Lue.** Le jeu de base ne garde pas l'état « lu » ; ici, ouvrir une lettre la marque lue et arrête son clignotement et son rebond.
- **Bornes.** La pile garde au plus 200 lettres (la plus ancienne la quitte et reste archivée) et 200 entrées peuvent être épinglées, pour borner la sauvegarde. L'archive est taillée à chaque changement (arrivée, retrait, désépinglage) plutôt qu'à la seule arrivée.
- **Journal.** Le journal de la colonie garde ses 80 dernières lignes, inchangé ; une ligne entre dans l'archive quand on l'épingle. Dans le jeu de base, chaque message est archivé.
- **Messages.** Les messages temporaires du coin supérieur gauche (apprivoisement réussi, tâche terminée…) ne sont pas encore faits : la notice centrale existante reste pour les retours de commande.

## Ce qui reste

- Les sons d'arrivée propres à chaque classe.
- Les messages temporaires avec leurs types Core (ThreatBig, NegativeHealthEvent, TaskCompletion, PositiveEvent…), leur regroupement des doublons et leur archivage.
- Les lettres à choix (rançon, visiteurs, recrue), les lettres différées et le ralentissement forcé de certaines classes.
- Les producteurs d'événements que le jeu n'a pas encore (meute enragée sur la carte du foyer, infestation, crash de vaisseau, folie animale de masse, thrumbo, météorite, ambroisie…), la confusion d'origine clinique et le décès d'un colon en caravane.
