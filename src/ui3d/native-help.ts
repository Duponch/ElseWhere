import type {World} from '../sim/types';
import type {NativeControl, NativePage, NativeRow, NativeUiActions} from './native-contract';
import {LESSONS, type FirstGesturesLearning, type FirstGesturesLearningState} from '../ui/first-gestures-learning';
import {readFirstDayGuide, type FirstDayGuideAction} from '../ui/first-day-guide';
import {captureFoodReadability} from '../sim/food-readability';
import {knownBuilding256, knownPile256} from '../ui/exploration-readers-256';
import {GESTURE_ACTION_LABELS} from '../ui/guidance-card';

export interface NativeHelpActions extends Pick<NativeUiActions, 'showPage' | 'panel' | 'category' | 'tool'> {
  currentWorld?: () => World | undefined;
  onGuideAction?: (action: FirstDayGuideAction) => void | Promise<unknown>;
  learning?: FirstGesturesLearning;
  close?: () => void;
  /** On-screen advice card of the current colony: show or hide it again. */
  guidanceCard?: {shown: boolean; toggle: () => void};
}

interface HelpSection {id: string; title: string; text: string; action?: FirstDayGuideAction; actionLabel?: string}

/** Authored structured text from layout.ts's survival notebook. No HTML is
 * parsed, measured, rendered, or used as an interaction authority. */
const firstDaySections: readonly HelpSection[] = [
  {id: 'new-game', title: 'Nouvelle partie', text: 'Choisir le scénario, le narrateur, le monde, le lieu et trois personnes. Le départ est en pause ; Reprendre fait descendre puis ouvrir leurs capsules. Les scénarios grisés restent indisponibles. Tutoriel lance une partie d’apprentissage : narrateur Tuteur sans incident ni alerte, difficulté Bâtisseur de communauté, jusqu’au choix du narrateur dans le Menu ; ses leçons pas à pas viendront plus tard.'},
  {id: 'work', title: 'Travail et Planning', text: 'Vérifier les capacités des colons et cocher construction, culture et transport. Avec Priorités manuelles, 1 est la plus forte priorité et une case vide désactive un métier. Planning règle les heures de repos, de loisirs et de travail.', action: {panel: 'work'}, actionLabel: 'Ouvrir Travail'},
  {id: 'stockpile', title: 'Zones → Réserve', text: 'Tracer des cases accessibles, puis inspecter la réserve pour choisir ses filtres et sa priorité. Les transporteurs y regroupent les objets physiques. Une étagère construite offre trois piles par case et ses propres filtres.', action: {panel: 'architect', mapTools: 'zones', tool: 'stockpile'}, actionLabel: 'Choisir Réserve'},
  {id: 'orders', title: 'Ordres et équipements', text: 'Récolter les plantes mûres et abattre les arbres. Les produits apparaissent au sol ; ils doivent être transportés. Pour les armes initiales, sélectionner un seul colon, faire un clic droit sur l’arme au sol et choisir Équiper. Les politiques d’Assignation ne choisissent pas une arme à sa place.', action: {panel: 'architect', mapTools: 'orders'}, actionLabel: 'Ouvrir Ordres'},
  {id: 'furniture', title: 'Architecte → Meubles / Structure', text: 'Un couchage au sol est immédiat et gratuit ; un lit, des murs et des portes demandent des matériaux livrés puis du travail de construction. Q / E tourne le meuble. Inspecter un chantier indique ce qui lui manque.', action: {panel: 'architect', category: 'furniture'}, actionLabel: 'Ouvrir Meubles'},
  {id: 'cultivation', title: 'Zones → Culture', text: 'Choisir une plante adaptée au sol et au climat. Le riz pousse vite ; une zone dessinée ne fournit pas de nourriture immédiatement. Le semis et la récolte demandent un colon affecté à Culture.', action: {panel: 'architect', mapTools: 'zones', tool: 'growing'}, actionLabel: 'Choisir Culture'},
  {id: 'production', title: 'Architecte → Production', text: 'Construire une cuisinière et ajouter une facture de repas dans son inspection. Il faut un cuisinier, des ingrédients accessibles et, selon le poste, du combustible ou de l’électricité.', action: {panel: 'architect', category: 'production'}, actionLabel: 'Ouvrir Production'},
  {id: 'shelter', title: 'Abri et santé', text: 'Contrôler le toit au-dessus des couchages et la température des pièces. Un couchage affecté aux soins, un médecin et des médicaments accessibles permettent les soins ; inspecter Santé pour comprendre une blessure. Les alertes conduisent aux personnes concernées.'},
  {id: 'saves', title: 'Menu → Sauvegardes', text: 'Créer une copie nommée (jusqu’à douze) ou Exporter la partie actuelle pour conserver son checkpoint en JSON. Trois copies automatiques tournent à un intervalle de jeu actif réglable dans les Options, cinq minutes réelles par défaut ; la pause ne déclenche pas ces captures. Les copies locales appartiennent à ce navigateur et cette adresse. Charger une partie ou Importer un fichier reprend en pause. Exporter avant de quitter : fermer l’onglet ne garantit pas une dernière sauvegarde automatique.', action: {panel: 'menu'}, actionLabel: 'Ouvrir Menu'},
  {id: 'optional', title: 'Un carnet facultatif', text: 'Vous donnez les ordres. Les colons choisissent leurs tâches et se déplacent de façon autonome. Ce carnet ne donne aucun objet, ne règle aucune priorité et ne remplace pas les alertes.'},
  {id: 'inspection', title: 'Comprendre une attente', text: 'Inspectez un chantier pour comprendre son attente, ou une réserve pour modifier ses filtres. Planning permet de régler les plages de travail et de repos. Un piquet de fers à cheval offre une autre famille de loisirs que l’observation du ciel. Les onglets grisés indiquent les domaines actuellement indisponibles.'}
];

const shortcutRows: readonly NativeRow[] = [
  {id: 'key-space', label: 'Espace', detail: 'Mettre en pause ou reprendre à la dernière vitesse active.'},
  {id: 'key-speed', label: '1 / 2 / 3', detail: 'Choisir respectivement les vitesses ×1 / ×3 / ×6.'},
  {id: 'key-tab', label: 'Tab', detail: 'Ouvrir ou fermer Architecte.'},
  {id: 'key-f1-f3', label: 'F1 / F2 / F3', detail: 'Ouvrir ou fermer Travail / Planning / Assignations.'},
  {id: 'key-f8', label: 'F8', detail: 'Ouvrir Monde sur les cartes.'},
  {id: 'key-save', label: 'Ctrl+S / ⌘+S', detail: 'Sauvegarder la partie actuelle.'},
  {id: 'key-help', label: 'H', detail: 'Ouvrir ce carnet de survie pendant la partie ; le bouton Aide, en haut à droite, fait de même.'},
  {id: 'key-escape', label: 'Échap', detail: 'Annuler le ciblage de combat, fermer l’ordre contextuel ou annuler le tracé, puis fermer le panneau et retirer la sélection.'},
  {id: 'key-rotate', label: 'Q / E', detail: 'Tourner le meuble ou le plan orientable en cours de placement.'},
  {id: 'key-tools', label: 'M / C / B / L / X / S', detail: 'Choisir Miner / Abattre / Mur / Lit / Annuler / Réserve.'},
  {id: 'key-r', label: 'R', detail: 'Avec des colons sélectionnés : mobiliser ou démobiliser les personnes admissibles. Sans cette sélection : choisir Récolter.'},
  {id: 'map-designation', label: 'Tracer un rectangle', detail: 'Abattage, récolte, réserves et annulation : cliquer ou maintenir le bouton gauche pour tracer un rectangle. Les cases retenues sont surlignées. Relâcher applique ; Échap ou clic droit annule le tracé.'},
  {id: 'map-orders', label: 'Clic droit / Maj', detail: 'Avec un colon sélectionné, consulter les ordres réellement disponibles sur la case. Maj ajoute les travaux compatibles à leur file. Les déplacements tactiques admettent une file ; les attaques, la consommation et les autres ordres directs la refusent.'},
  {id: 'camera', label: 'Caméra', detail: 'Molette : zoom · glisser le bouton droit : tourner · bouton central ou flèches : déplacer la caméra. La coupe des murs sert à voir les intérieurs ; leurs obstacles restent en place.'},
  {id: 'native-pages', label: 'Panneaux et listes', detail: 'Les fiches de gestion et leurs commandes se cliquent dans la scène 3D. La molette fait défiler un panneau ouvert. Les flèches de la barre des colons parcourent les portraits ; sa liste complète conserve toutes les personnes.'}
];

const statusLabels = {ready: 'Disponible', started: 'À compléter', missing: 'À préparer', optional: 'À examiner'} as const;

/** Build all native help pages without changing game or learning state.
 * Index is first. Callbacks use freshly built pages when a guide changes. */
export function buildNativeHelp(actions: NativeHelpActions): NativePage[] {
  const close = (): void => { if (actions.close) actions.close(); else void actions.panel(null); };
  const open = (id: string): void => { const page = buildNativeHelp(actions).find(candidate => candidate.id === id); if (page) actions.showPage(page); };
  const back = (): void => open('help');
  const route = async (action: FirstDayGuideAction): Promise<void> => {
    if (actions.onGuideAction) { await actions.onGuideAction({...action}); return; }
    if (action.target) return;
    if (action.panel) await actions.panel(action.panel);
    if (action.category) actions.category(action.category);
    if (action.mapTools) actions.category(action.mapTools);
    if (action.tool) actions.tool(action.tool);
  };
  const actionControl = (id: string, label: string, action: FirstDayGuideAction): NativeControl => ({
    id, label, disabled: !!action.target && !actions.onGuideAction, hint: action.target && !actions.onGuideAction ? 'Inspectez la personne ou le lieu depuis la carte.' : undefined,
    onActivate: () => route(action)
  });
  const page = (id: string, title: string, rows: NativeRow[], subtitle?: string, controls: NativeControl[] = []): NativePage => ({id, title, rows, subtitle, width: 7.8, modal: true, actions: [...controls, {id: `${id}-back`, label: 'Sommaire', onActivate: back}], onClose: back});
  const firstDay = page('help-first-day', 'Votre première journée', firstDaySections.map(section => ({
    id: `help-${section.id}`, label: section.title, detail: section.text,
    ...section.action ? {controls: [actionControl(`help-open-${section.id}`, section.actionLabel ?? 'Ouvrir', section.action)]} : {}
  })), 'Carnet de survie · conseils facultatifs, sans modification automatique de la colonie.');
  const shortcuts = page('help-shortcuts', 'Commandes et raccourcis', shortcutRows.map(row => ({...row})), 'Les règles et les accès physiques restent vérifiés par la simulation.');

  const learning = actions.learning, current = learning?.current;
  const learned: FirstGesturesLearningState['learned'] = learning?.state.learned ?? {};
  const gestureRows: NativeRow[] = [{id: 'gestures-intro', label: 'Premiers gestes', detail: 'Un petit parcours facultatif. Ces repères sont conservés dans ce navigateur pour toutes vos parties.'}];
  for (const lesson of LESSONS) gestureRows.push({id: `gesture-${lesson.id}`, label: lesson.title,
    value: learned[lesson.id] === 'confirmed' ? 'Ordre accepté' : learned[lesson.id] === 'declared' ? 'Je connais déjà ce geste' : 'À découvrir',
    detail: lesson.instruction, controls: [actionControl(`gesture-open-${lesson.id}`, GESTURE_ACTION_LABELS[lesson.id], lesson.action)]});
  gestureRows.push({id: 'gestures-meaning', label: 'Ce que confirme le parcours', detail: '« Ordre accepté » confirme le geste d’interface. Il ne prouve aucun transport, semis, récolte ou chantier payé achevé. Les huit rubriques des conseils décrivent la colonie actuelle.'});
  const gestureControls: NativeControl[] = [];
  if (learning) {
    const refresh = (change: () => unknown): void => { change(); open('help-gestures'); };
    gestureControls.push({id: 'gestures-toggle', label: learning.state.enabled ? 'Interrompre' : Object.keys(learned).length ? 'Reprendre' : 'Commencer', onActivate: () => refresh(() => learning.state.enabled ? learning.stop() : learning.start())});
    if (learning.state.enabled && current) gestureControls.push({id: 'gestures-declare', label: 'Je connais ce geste', hint: 'Déclaration personnelle : aucune commande au jeu.', onActivate: () => refresh(() => learning.declareCurrentKnown())});
    if (Object.keys(learned).length) gestureControls.push({id: 'gestures-review', label: 'Revoir ces gestes', hint: 'Efface seulement les repères de ce guide. La partie reste telle qu’elle est.', onActivate: () => refresh(() => learning.review())});
    if (!learning.saved) gestureRows.push({id: 'gestures-saving-warning', label: 'Repères conservés dans cette session', detail: 'L’enregistrement dans ce navigateur a échoué. Vos repères restent dans cette session et seront perdus au rechargement.'});
  } else gestureRows.push({id: 'gestures-read-only', label: 'Repères du parcours', detail: 'Ces quatre gestes sont consultables librement. Aucune action de cette page ne déclare une commande de jeu achevée.'});
  const gestures = page('help-gestures', 'Premiers gestes', gestureRows, `${Object.keys(learned).length} / ${LESSONS.length} gestes repérés`, gestureControls);

  const world = actions.currentWorld?.();
  const currentRows: NativeRow[] = [];
  if (world) {
    const food = captureFoodReadability(world, {pileVisible: pile => knownPile256(world, pile), structureVisible: structure => knownBuilding256(world, structure)});
    for (const section of readFirstDayGuide(world, food)) currentRows.push({id: `current-${section.id}`, label: section.title, value: statusLabels[section.status], detail: `${section.detail} ${section.body}`,
      controls: [actionControl(`current-open-${section.id}`, section.actionLabel, section.action)]});
  } else currentRows.push({id: 'current-no-world', label: 'Aucune carte locale active', detail: 'Les préparations de la colonie seront décrites depuis son état confirmé lorsque vous ouvrirez une carte.'});
  const currentPage = page('help-current', 'Conseils pour la colonie actuelle', currentRows, 'Constats actuels · ils ne garantissent ni un trajet, ni une réservation, ni un chantier achevé.');

  const index: NativePage = {id: 'help', title: 'Carnet de survie', subtitle: 'Aide facultative · la simulation conserve seule les objets, les propriétaires et les commandes.', width: 7.2, modal: true, onClose: close,
    rows: [
      {id: 'help-intro', label: 'Vous donnez les ordres', detail: 'Les colons choisissent leurs tâches et se déplacent de façon autonome.'},
      {id: 'help-first-day-link', label: 'Votre première journée', detail: 'Travail, stockage, ordres, couchages, cultures, cuisine, soins et sauvegardes.', controls: [{id: 'help-first-day-open', label: 'Lire le carnet', onActivate: () => open(firstDay.id)}]},
      {id: 'help-shortcuts-link', label: 'Commandes et raccourcis', detail: 'Clavier, caméra, désignations sur la carte et ordres directs.', controls: [{id: 'help-shortcuts-open', label: 'Voir les commandes', onActivate: () => open(shortcuts.id)}]},
      {id: 'help-gestures-link', label: 'Premiers gestes', detail: 'Quatre repères facultatifs, séparés de la progression réelle de la partie.', controls: [{id: 'help-gestures-open', label: 'Voir le parcours', onActivate: () => open(gestures.id)}]},
      {id: 'help-current-link', label: 'Conseils actuels', detail: 'Les huit préparations sont lues dans le même état confirmé.', controls: [{id: 'help-current-open', label: 'Consulter la colonie', onActivate: () => open(currentPage.id)}]},
      ...actions.guidanceCard ? [{id: 'help-card-link', label: 'Carte de conseils', detail: 'Les premiers gestes et les huit préparations restent à l’écran, en bas à gauche. La replier ou la fermer n’efface aucun repère.',
        controls: [{id: 'help-card-toggle', label: actions.guidanceCard.shown ? 'Masquer la carte' : 'Afficher la carte', onActivate: actions.guidanceCard.toggle}]}] : []
    ]};
  return [index, firstDay, shortcuts, gestures, currentPage];
}

export function nativeHelpPage(actions: NativeHelpActions): NativePage { return buildNativeHelp(actions)[0]!; }
