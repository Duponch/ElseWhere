import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {TICKS_PER_DAY, type World} from '../sim/types';
import {activeHeatwave, heatwaveOffset} from '../sim/heatwave';
import {HEAT_UNIT, heatStage} from '../sim/heat-rules';
import {raidGroups261} from '../sim/temp-map-raids-261';
import {mechRaidGroups261} from '../sim/mechanical-raid-groups-261';
import {mechanoidDefinition, type MechanoidKind} from '../sim/mechanoid-definition';
import {previewBackgroundSkills} from '../sim/background-generation';
import {startingSkills} from '../sim/skills';
import {biologicalYears, chronologicalYears} from '../sim/human-age';
import {visitorMayTrade} from '../sim/visitors';
import {tradeRequestContent284} from '../sim/trade-request-content-284';
import {backgroundSkillSummary} from '../ui/background-inspection';
import {traitSummary} from '../ui/traits-inspection';
import {offeredRelationshipText} from '../ui/relationship-inspection';
import {weatherConditionInspection} from '../ui/weather-inspection';
import {shortCircuitInspection} from '../ui/short-circuit';
import {peaceTalksFacts293} from '../ui/peace-talks-293';
import {raidNotificationTargets} from '../ui/raids';
import {startingArrivalPresentation} from '../ui/starting-arrival';
import {knownNotificationTarget256, cellNotificationTarget, personNotificationTarget, actorNotificationTarget, type NotificationTarget} from '../ui/notification-focus';

export type NativeDomainAlertAction =
  | {kind: 'arrivals'; offerId: number}
  | {kind: 'quests'; questId?: number; requestId?: number; siteId?: number}
  | {kind: 'trade'; traderId?: number}
  | {kind: 'orbital'; shipId?: number}
  | {kind: 'site'; condition: 'starting-arrival' | 'heatwave' | 'cold-snap' | 'eclipse' | 'toxic-fallout' | 'volcanic-winter' | 'solar-flare' | 'flashstorm' | 'short-circuit'}
  | {kind: 'raid-focus'; raidId: number; mechanical: boolean};

export interface NativeDomainAlert {
  key: string;
  text: string;
  title: string;
  body: string;
  tooltip: {title: string; body: string};
  severity: 'info' | 'warning' | 'danger';
  targets: NotificationTarget[];
  action: NativeDomainAlertAction;
}

function timeLeft(ticks: number, elapsed = false): string {
  const exact = Math.max(0, ticks) * 1440 / TICKS_PER_DAY;
  const minutes = elapsed ? Math.floor(exact) : Math.ceil(exact);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}
const mechanicalSummary = (kinds: readonly MechanoidKind[]): string => {
  const counts = new Map<MechanoidKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => `${mechanoidDefinition(kind).label} ×${count}`).join(' · ') || '0 machine';
};

/** Missing legacy letter projections, read only from the current confirmed
 * World. No retained event stream, new incident, prediction, command or UI node.
 * Action discriminants are resolved by Main against its current authority.
 * Text follows arrivals/quests/raids/conditions/trade's existing letter views.
 */
export function readNativeDomainAlerts(world: World, speed?: number): NativeDomainAlert[] {
  const rows: NativeDomainAlert[] = [];
  const add = (key: string, text: string, title: string, body: string, action: NativeDomainAlertAction, severity: NativeDomainAlert['severity'] = 'info', targets: readonly NotificationTarget[] = []): void => {
    rows.push({key: `domain:${key}`, text, title, body, tooltip: {title, body}, severity, action,
      targets: targets.filter(target => knownNotificationTarget256(world, target))});
  };
  const people = (ids: readonly number[]): NotificationTarget[] => ids.flatMap(id => {
    const target = personNotificationTarget(world, id); return target ? [target] : [];
  });

  const starting = startingArrivalPresentation(world, speed ?? 1);
  if (starting) add('starting-arrival', starting.label, 'Arrivée des colons',
    `${starting.names.join(' · ')}. ${starting.phase === 'blocked' ? 'Les sorties doivent être libres pour ouvrir les capsules. ' : ''}${speed === 0 ? 'La partie est en pause. Reprendre fait descendre puis ouvrir leurs capsules.' : 'Les personnes sont encore contenues dans leurs capsules ; leur ouverture réelle reste à effectuer.'}`,
    {kind: 'site', condition: 'starting-arrival'}, starting.phase === 'blocked' ? 'warning' : 'info');

  const offer = world.arrivals?.pending;
  if (offer) {
    const skills = offer.background ? previewBackgroundSkills(offer.profile, offer.background) : startingSkills(offer.profile);
    const age = offer.age ? ` Âge : ${biologicalYears(offer.age)} ans${chronologicalYears(offer.age) === biologicalYears(offer.age) ? '' : ` (${chronologicalYears(offer.age)} chronologiques)`}.` : '';
    const relationship = offer.relationship ? ` ${offeredRelationshipText(world, offer.relationship)}` : '';
    add(`arrival:${offer.id}`, `${offer.name} · demande d’accueil`, `${offer.name} souhaite rejoindre la colonie`,
      `Ce voyageur cherche un nouveau foyer. Profil : ${backgroundSkillSummary(skills, offer)}. Traits : ${traitSummary(offer)}. En l’accueillant, prévoyez sa nourriture, son couchage et son travail. Un refus attristera les colons pendant six jours.${age}${relationship} Temps restant : ${Math.ceil(Math.max(0, offer.expiresAt - world.tick) * 24 / TICKS_PER_DAY)} h. Vous pouvez différer votre réponse ; sans réponse, la demande expire.`,
      {kind: 'arrivals', offerId: offer.id});
  }

  if (world.gameProfile && world.raids?.profile === 'cassandra-raids-v1') for (const quest of world.quests?.entries ?? []) {
    if (quest.status !== 'offered' && quest.status !== 'accepted') continue;
    const offered = quest.status === 'offered';
    let body: string;
    if (offered) {
      const skills = quest.background ? previewBackgroundSkills(quest.profile, quest.background) : startingSkills(quest.profile);
      body = `${quest.name} demande asile avant la fin de l’offre. Profil : ${backgroundSkillSummary(skills, quest)}. En l’accueillant, vous recevez ce colon et sa chemise ; un bandit au couteau le poursuit. Aucun butin n’est promis. Répondez sous ${timeLeft(quest.expiresAt - world.tick)}. Si vous acceptez, arrivée prévue dans ${timeLeft(quest.joinDelay)} et poursuite dans ${timeLeft(quest.raidDelay)} après votre réponse. Une bordure bloquée peut retarder ces entrées. Refuser ou laisser expirer n’a pas de pénalité.`;
    } else if (quest.raidGroupId !== undefined) {
      body = `${quest.name} a rejoint la colonie ; le bandit est apparu. La demande sera conclue dans ${timeLeft((quest.raidAt ?? world.tick) + 60 - world.tick)}. Le combat peut continuer après sa conclusion, sans victoire déclarée par la quête.`;
    } else if (quest.arrivedAt !== undefined) {
      const due = Math.max((quest.acceptedAt ?? world.tick) + quest.raidDelay, quest.arrivedAt + quest.raidDelay - quest.joinDelay);
      body = `${quest.name} a rejoint la colonie. Le bandit annoncé n’est pas encore apparu. ${world.tick < due ? `Poursuite prévue dans ${timeLeft(due - world.tick)}. Préparez la défense.` : 'Le bandit attend une bordure libre ou la fin de l’attaque en cours. La poursuite reste engagée.'}`;
    } else {
      const due = (quest.acceptedAt ?? world.tick) + quest.joinDelay;
      body = `${quest.name} a été accueilli ; son arrivée reste attendue. ${world.tick < due ? `Arrivée prévue dans ${timeLeft(due - world.tick)}. Préparez nourriture et couchage.` : 'Une bordure libre manque encore pour son arrivée. L’asile reste engagé.'}`;
    }
    if (!offered) body += ' Préparez la nourriture, un couchage et la défense. La poursuite annoncée ne peut plus être annulée.';
    add(`quest:${quest.id}`, offered ? `Quête : ${quest.name} demande asile` : `Quête : poursuite de ${quest.name}`, 'Demandes d’asile', body,
      {kind: 'quests', questId: quest.id}, offered ? 'info' : 'warning', quest.pawnId === undefined ? [] : people([quest.pawnId]));
  }

  for (const request of world.tradeRequests284?.entries ?? []) {
    if (request.status !== 'offered' || request.dismissed || world.tick * 10 >= request.offerExpiresAtCore) continue;
    const content = tradeRequestContent284(request.family), destination = world.worldFactions?.settlements.find(settlement => settlement.id === request.settlementId);
    const name = destination?.name ?? request.settlementName, text = `Demande commerciale : ${request.quantity} ${content?.label ?? 'biens demandés'} pour ${name}`;
    add(`trade-request:${request.id}`, text, 'Demandes commerciales',
      `Accepter sous ${timeLeft((request.offerExpiresAtCore - world.tick * 10) / 10)}. Après acceptation : ${timeLeft(request.durationCore / 10)} pour livrer. Livrez les biens dans les inventaires de la caravane : frais, de qualité normale ou meilleure si applicable, et vêtements non souillés. La récompense suit la livraison complète. Masquer l’offre ne la refuse pas et n’arrête pas son délai.`, {kind: 'quests', requestId: request.id});
  }
  if ((Number(world.schemaVersion)===293||(Number(world.schemaVersion)===294||(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))))) for (const site of world.worldSites263?.entries ?? []) {
    if (site.kind !== 'peace-talks') continue;
    const facts = peaceTalksFacts293(world, site);
    if (facts.active) add(`peace-talks:${site.id}`, facts.title, facts.title, `${facts.destination} ${facts.status} ${facts.body}`, {kind: 'quests', siteId: site.id});
  }

  const humanGroups = raidGroups261(world), mechanicalGroups = mechRaidGroups261(world);
  const humans = humanGroups[0], machines = mechanicalGroups[0], lastRaid = world.raids?.last;
  if (humans) {
    const ids = new Set(humanGroups.flatMap(group => group.members)), remaining = world.pawns.filter(pawn => ids.has(pawn.id) && pawn.state !== 'dead' && pawn.state !== 'downed').length;
    const text = humans.phase === 'assault' ? `Raid : ${remaining} assaillant(s)` : 'Retraite des assaillants';
    const body = humans.phase === 'assault' ? 'Des ennemis arrivent par le bord et attaquent la colonie. Mobilisez les défenseurs, placez-les et préparez les secours. Les assaillants peuvent frapper les murs ou portes qui leur barrent l’accès.' : 'Les assaillants cherchent une sortie physique. Surveillez les blessés ; les survivants encore sur la carte restent hostiles.';
    add(`raid:${humans.id}`, text, text, body, {kind: 'raid-focus', raidId: humans.id, mechanical: false}, 'danger', people([...ids]));
  }
  if (machines) {
    const ids = new Set(mechanicalGroups.flatMap(group => group.members)), remaining = (world.mechanoids ?? []).filter(machine => ids.has(machine.id) && machine.state !== 'dead' && machine.state !== 'downed');
    const text = `Raid mécanique : ${mechanicalSummary(remaining.map(machine => machine.mechKind))}${mechanicalGroups.length > 1 ? ` · ${mechanicalGroups.length} groupes` : ''} · ${mechanicalGroups.some(group => group.phase === 'assault') ? 'assaut' : 'regroupement'}`;
    const body = machines.phase === 'staging' ? 'Les machines hostiles se regroupent avant leur assaut. Leur défense est déjà active. Préparez vos positions et votre circuit de défense.' : 'Les machines hostiles attaquent la colonie. Leur anatomie et les phases de leurs gestes sont inspectables ; aucun soin, recrutement ou ordre colonial ne leur est accordé.';
    add(`mech-raid:${machines.id}`, text, text, body, {kind: 'raid-focus', raidId: machines.id, mechanical: true}, 'danger', raidNotificationTargets(world));
  }
  if (!humans && !machines && lastRaid) {
    const text = lastRaid.mechanoid ? 'Assaut mécanique terminé' : 'Assaut terminé';
    const body = lastRaid.mechanoid
      ? `Bilan confirmé : ${mechanicalSummary(lastRaid.mechComposition?.roster ?? [])} neutralisé(s). Une carcasse entière devient disponible après la fin de son déplacement et de sa récupération. Transportez-la pour une facture de concassage ou de broyage ; l’acier est produit à la finition réelle.`
      : `Bilan à la fin de l’assaut : ${lastRaid.killed} ennemi(s) mort(s), ${lastRaid.downed} à terre, ${lastRaid.escaped} parti(s). Démobilisez, soignez les colons et réparez les ouvrages dans la zone de foyer. Les corps restent sur place pour les secours et la sépulture.`;
    // No observer-only membership is fabricated after a reload. The existing
    // pure reader resolves only retained original actors/bodies it can prove.
    add(`raid-last:${lastRaid.id}`, text, text, body, {kind: 'raid-focus', raidId: lastRaid.id, mechanical: !!lastRaid.mechanoid}, 'info', raidNotificationTargets(world));
  }

  const suffering = world.pawns.filter(pawn => pawn.state !== 'dead' && heatStage(pawn.health?.heatstroke) > 0), heatwave = activeHeatwave(world);
  if (heatwave?.active || suffering.length) {
    const text = heatwave?.active ? `Canicule · +${heatwaveOffset(world.tick, heatwave).toFixed(1)} °C` : `Coup de chaleur : ${suffering.length} personne(s)`;
    add('heatwave', text, 'Canicule', 'La chaleur pénètre progressivement dans les pièces. Fermez et couvrez un refuge, construisez un refroidisseur passif et approvisionnez-le en bois. Une tenue tribale en tissu protège mieux de la chaleur qu’une chemise. Les coups de chaleur graves poussent les civils libres à chercher un lieu confortable ; un colon mobilisé reste sous vos ordres. Un patient à terre doit être porté dans un lit situé au frais. Les pansements ne remplacent pas le refroidissement.' + (suffering.length ? ` Exposition : ${suffering.map(pawn => `${pawn.name} ${(100 * pawn.health!.heatstroke! / HEAT_UNIT).toFixed(1)} %`).join(', ')}` : ''),
      {kind: 'site', condition: 'heatwave'}, 'warning', people(suffering.map(pawn => pawn.id)));
  }
  for (const condition of weatherConditionInspection(world)) {
    const targets = condition.kind === 'cold-snap' ? people(world.pawns.filter(pawn => pawn.state !== 'dead' && (pawn.health?.hypothermia ?? 0) > 0).map(pawn => pawn.id)) : [];
    add(condition.kind, condition.summary, condition.title, condition.body, {kind: 'site', condition: condition.kind}, 'warning', targets);
  }
  const solar = world.worldIncidents?.active, solarEnded = world.worldIncidents?.lastEndCore === undefined ? undefined : Math.floor(world.worldIncidents.lastEndCore / 10) + 1;
  if (solar || solarEnded !== undefined && world.tick >= solarEnded && world.tick - solarEnded < 600) {
    add('solar-flare', solar ? `Éruption solaire · ${timeLeft(Math.floor(solar.endCore / 10) + 1 - world.tick)}` : 'Éruption solaire terminée', solar ? 'Éruption solaire' : 'Fin de l’éruption solaire',
      solar ? 'Les appareils électriques s’arrêtent progressivement. Une batterie conserve sa charge mais ne peut ni alimenter le réseau ni se recharger pendant la condition ; son autodécharge continue. Les générateurs restent actifs et brûlent leur bois : demander leur arrêt exige le contact d’un colon. Surveillez le froid, la lumière, les cultures sous toit et les ateliers. Utilisez les appareils au bois et la lumière du jour ; le refroidisseur passif ne remplace pas un congélateur. La couture électrique peut continuer manuellement à vitesse réduite. Les interrupteurs et connexions sont conservés. Aucun toit ne protège de cette condition et la météo reste indépendante.'
        : `La condition est terminée depuis ${timeLeft(world.tick - solarEnded!)}. Les appareils redémarrent selon leurs cadences, leur alimentation et leurs interrupteurs réels. Les batteries peuvent à nouveau charger et décharger. Vérifiez le combustible, les pannes, le froid et les cultures : la fin ne rend pas la croissance ou la conservation perdues.`,
      {kind: 'site', condition: 'solar-flare'}, solar ? 'warning' : 'info');
  }
  const storm = world.flashstorm?.active, stormEnded = world.flashstorm?.lastEnd;
  if (storm || stormEnded !== undefined && world.tick >= stormEnded && world.tick - stormEnded < 600) {
    add('flashstorm', storm ? `Orage sec localisé · ${timeLeft(Math.floor(storm.endCore / 10) + 1 - world.tick)}` : 'Orage sec localisé terminé', storm ? 'Orage sec localisé' : 'Fin de l’orage sec localisé',
      storm ? `Des éclairs peuvent frapper autour de (${storm.center.x}, ${storm.center.z}). Protégez le foyer avec les zones et la priorité Incendie dans Travail. L’Extinction demande aux colons de rejoindre les feux au contact. Éloignez les personnes exposées et soignez les blessés. Une frappe ne garantit pas un incendie. La pluie déjà en transition peut encore tomber et éteindre un feu ; l’orage ne la supprime pas instantanément. ${storm.strikes} frappe(s) confirmée(s).`
        : `La condition est terminée depuis ${timeLeft(world.tick - stormEnded!)}. Les incendies et les blessés éventuels restent à traiter par les zones, l’Extinction au contact et les soins. La fin de l’orage ne termine pas les incendies.`,
      {kind: 'site', condition: 'flashstorm'}, storm ? 'warning' : 'info', storm ? [cellNotificationTarget(`flashstorm:${storm.start}`, storm.center)] : []);
  }
  const short = shortCircuitInspection(world), shortState = world.miscIncidents?.shortCircuits?.last;
  if (short && shortState) add(`short-circuit:${shortState.at}`, short.summary, short.title, short.body, {kind: 'site', condition: 'short-circuit'}, 'warning', [cellNotificationTarget(`short-circuit:${shortState.at}`, shortState.center)]);

  const visitors = world.pawns.filter(pawn => pawn.visitor && pawn.state !== 'dead'), trader = visitors.find(pawn => visitorMayTrade(world, pawn));
  add('visitors', world.visitors ? `Visiteurs : ${visitors.length} · Commerce` : 'Activer les visites', 'Visiteurs et commerce',
    world.visitors ? 'Les biens à vendre et l’argent doivent être accessibles dans le foyer ou une réserve. Les objets réservés, portés et les provisions personnelles sont exclus. Les achats seront déposés au contact, puis rangés par les colons.' : 'Cette ancienne partie conserve son calendrier. Autorisez les visites à partir de maintenant.',
    {kind: 'trade', ...trader ? {traderId: trader.id} : {}}, 'info', visitors.map(visitor => actorNotificationTarget(visitor.id)));
  const ships = world.orbital?.ships.filter(ship => ship.announced && ship.departAt > world.tick) ?? [];
  if (ships.length) {
    const remaining = Math.min(...ships.map(ship => ship.departAt - world.tick));
    add('orbital', `Vaisseaux : ${ships.length} · Commerce orbital · départ dans ${remaining} ticks`, 'Commerce orbital',
      `${ships.map(ship => `${ship.name} · départ dans ${ship.departAt - world.tick} ticks`).join(' ; ')}. Seuls les biens au sol couverts par une balise alimentée et libres de réservation sont vendables. Les achats et l’argent reçu arrivent en capsule, puis sont rangés. Ce canal échange des marchandises, sans animaux, équipement ou sculptures.`,
      {kind: 'orbital', shipId: ships[0]!.id});
  }
  return rows;
}
