import type {SimulationClient} from '../bridge/SimulationClient';
import type {Cell, Command, World} from '../sim/types';
import type {OrderOption} from '../sim/player-orders';
import {isColonist} from '../sim/affiliation';
import {footprintContains} from '../sim/definitions';
import {isAncientCasket256} from '../sim/ancient-casket-state-256';
import {firePosition} from '../sim/fire-rules';
import {queryFirefoamUseReason290} from '../sim/firefoam-manual-290';
import {shipCasketOptions277} from '../ui/ship-casket-controls-277';
import {cryptosleepOptions271} from '../ui/cryptosleep-controls-271';
import {contextConsumesFood, tacticalAttackPolicy, tacticalPawns, tacticalRescuePolicy, tacticalTendingPolicy} from '../ui/order-menu';
import type {NativeControl, NativePage, NativeRow} from './native-contract';

/** Methods must be bound by the host. Optional readers preserve the current
 * selection/map while a worker query or a native confirmation is pending. */
export interface NativeOrderClient {
  orderOptions: SimulationClient['orderOptions'];
  command: SimulationClient['command'];
  currentWorld?: () => World | undefined;
  currentSelectedPawnIds?: () => readonly number[];
  isCurrent?: () => boolean;
  queueHeld?: () => boolean;
  close?: () => void;
  report?: (message: string, error?: boolean) => void;
}
let revision = 0;

/** Call on interaction cancellation, page dismissal and map/world replacement.
 * A late query can never reopen a cancelled native context. */
export function cancelNativeOrderPage(): void { revision++; }

const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);
const sameIds = (left: readonly number[], right: readonly number[]): boolean => left.length === right.length && [...left].sort((a, b) => a - b).every((id, index) => id === [...right].sort((a, b) => a - b)[index]);
const optionKey = (option: OrderOption): string => JSON.stringify([option.jobId, option.openCasketId, option.consumePileId, option.arrestPatientId, option.capturePatientId, option.equipmentItemId, option.equipmentAction, option.feedPatientId, option.tendPatientId, option.rescuePatientId, option.cookStationId, option.haulTarget]);

function optionCommand(option: OrderOption, pawnId: number, queue: boolean): Command {
  if (option.openCasketId !== undefined) return {type: 'order-open-casket', pawnId, casketId: option.openCasketId};
  if (option.consumePileId !== undefined) return {type: 'order-consume', pawnId, pileId: option.consumePileId, queue: false};
  if (option.arrestPatientId !== undefined) return {type: 'order-arrest', pawnId, patientId: option.arrestPatientId, queue: false};
  if (option.capturePatientId !== undefined) return {type: 'order-capture', pawnId, patientId: option.capturePatientId, queue};
  if (option.equipmentItemId !== undefined) {
    if (!option.equipmentAction) throw new Error('Action d’équipement indisponible.');
    return {type: 'order-equipment', pawnId, itemId: option.equipmentItemId, action: option.equipmentAction, queue};
  }
  if (option.feedPatientId !== undefined) return {type: 'order-feed', pawnId, patientId: option.feedPatientId, queue};
  if (option.tendPatientId !== undefined) return {type: 'order-tend', pawnId, patientId: option.tendPatientId, queue};
  if (option.rescuePatientId !== undefined) return {type: 'order-rescue', pawnId, patientId: option.rescuePatientId, queue};
  if (option.cookStationId !== undefined) return {type: 'order-cook', pawnId, structureId: option.cookStationId, queue};
  if (option.haulTarget) return {type: 'order-haul', pawnId, target: option.haulTarget, queue};
  return {type: 'order-job', pawnId, jobId: option.jobId, queue};
}

/** The context is 3D-page data. x/y are retained for the renderer callback
 * contract and never become browser/CSS layout coordinates. The worker remains
 * the final command authority, including physical contact and reservations. */
export async function nativeOrderPage(
  world: World,
  selectedPawnIds: readonly number[],
  cell: Cell,
  _x: number,
  _y: number,
  queue: boolean,
  targetId: number | undefined,
  client: NativeOrderClient,
  show: (page: NativePage) => void
): Promise<void> {
  const token = ++revision, ids = [...new Set(selectedPawnIds)], selection = new Set(ids), at = {x: cell.x, z: cell.z};
  let busy = false;
  const current = (): boolean => revision === token && (client.isCurrent?.() ?? true);
  const close = (): void => { if (revision === token) revision++; client.close?.(); };
  const latest = (): World => client.currentWorld ? client.currentWorld() ?? world : world;
  const shift = (): boolean => queue || (client.queueHeld?.() ?? false);
  const read = (): World | undefined => {
    if (!current()) return;
    const live = client.currentWorld ? client.currentWorld() : world;
    if (!live || live.seed !== world.seed || live.width !== world.width || live.height !== world.height || live.tick < world.tick || client.currentSelectedPawnIds && !sameIds(ids, client.currentSelectedPawnIds())) { close(); return; }
    return live;
  };
  const present = (page: NativePage): void => {
    if (!current()) return;
    show({...page, modal: true, width: page.width ?? 6.2, ...(client.close ? {onClose: close} : {})});
  };
  const message = (title: string, text: string): void => present({id: 'native-orders', title, rows: [{id: 'order-message', label: text}]});
  const fail = (error: unknown): void => {
    if (!current()) return;
    const text = errorText(error); client.report?.(text, true);
    present({id: 'native-orders', title: 'Ordre refusé', rows: [{id: 'order-refusal', label: text}], actions: [{id: 'orders-refresh', label: 'Vérifier de nouveau', onActivate: () => nativeOrderPage(latest(), ids, at, _x, _y, queue, targetId, client, show)}]});
  };
  const finish = (text: string): void => {
    if (!current()) return;
    revision++; client.report?.(text);
    if (client.close) client.close();
    else show({id: 'native-order-result', title: 'Ordre accepté', modal: true, rows: [{id: 'order-result', label: text}]});
  };
  const run = async (prepare: (live: World) => Command | undefined | Promise<Command | undefined>, text: string): Promise<void> => {
    if (busy) return;
    const live = read(); if (!live) return;
    busy = true;
    try {
      const command = await prepare(live);
      if (!command || !read()) return;
      await client.command(command);
      finish(text);
    } catch (error) { fail(error); }
    finally { busy = false; }
  };
  const commandRow = (id: string, label: string, enabled: boolean, reason: string | undefined, prepare: (live: World) => Command | undefined | Promise<Command | undefined>, success: string, detail?: string): NativeRow => ({
    id, label, ...(reason ? {value: reason} : {}), ...(detail ? {detail} : {}),
    controls: [{id: `${id}-execute`, label: enabled ? label : 'Indisponible', disabled: !enabled, hint: reason, onActivate: () => run(prepare, success)}]
  });

  if (!Number.isInteger(at.x) || !Number.isInteger(at.z) || at.x < 0 || at.z < 0 || at.x >= world.width || at.z >= world.height) { message('Ordres', 'Cette case est hors de la carte.'); return; }
  const selected = world.pawns.filter(pawn => selection.has(pawn.id) && isColonist(pawn) && !pawn.prisoner);
  const tactical = selected.some(pawn => pawn.draft);
  const service = world.structures.some(structure => (isAncientCasket256(structure) || structure.kind === 'cryptosleep-casket' || structure.kind === 'ship-cryptosleep-casket' || [290, 291, 292, 293,294,295,296,297,298,299].includes(world.schemaVersion) && structure.kind === 'firefoam-popper') && footprintContains(structure, at) && (targetId === undefined || targetId === structure.id))
    || contextConsumesFood(world, selection, at, targetId)
    || targetId === undefined && world.structures.some(structure => structure.kind === 'mini-turret' && structure.x === at.x && structure.z === at.z);

  if (tactical && !service) {
    const tacticalIds = new Set(selected.map(pawn => pawn.id));
    if (targetId === undefined) {
      const pawns = tacticalPawns(world, tacticalIds);
      if (!pawns.length) { message('Ordre tactique', 'Mobilisez un colon libre et capable de se déplacer.'); return; }
      await run(live => {
        const eligible = tacticalPawns(live, tacticalIds);
        if (!eligible.length) throw new Error('Mobilisez un colon libre et capable de se déplacer.');
        return {type: 'draft-move', pawnIds: eligible.map(pawn => pawn.id), target: at, queue: shift()};
      }, `${queue ? 'Déplacement en file' : 'Déplacement'} demandé vers ${at.x}, ${at.z}.`);
      return;
    }
    const policy = tacticalAttackPolicy(world, tacticalIds, targetId, queue), tending = tacticalTendingPolicy(world, tacticalIds, targetId, queue), rescue = tacticalRescuePolicy(world, tacticalIds, targetId, queue);
    const rows: NativeRow[] = [];
    if (policy.reason) rows.push({id: 'tactical-reason', label: policy.reason});
    if (tacticalIds.size === 1) {
      const actor = [...tacticalIds][0]!;
      for (const option of shipCasketOptions277(world, actor, at, queue, targetId)) rows.push(commandRow(`ship-${JSON.stringify(option.command)}`, option.label, option.enabled, option.reason, live => {
        const fresh = shipCasketOptions277(live, actor, at, shift(), targetId).find(candidate => JSON.stringify(candidate.command) === JSON.stringify(option.command));
        if (!fresh?.enabled) throw new Error(fresh?.reason ?? 'Cette action de caisson spatial n’est plus disponible.');
        return fresh.command;
      }, 'Ordre de caisson spatial accepté.'));
    }
    if (rescue) rows.push(commandRow('tactical-rescue', rescue.label, rescue.enabled, rescue.reason, live => {
      const fresh = tacticalRescuePolicy(live, tacticalIds, targetId, shift());
      if (!fresh?.enabled || fresh.pawnId === undefined) throw new Error(fresh?.reason ?? 'Secours indisponible.');
      return {type: 'order-rescue', pawnId: fresh.pawnId, patientId: fresh.patientId, queue: false};
    }, `Secours demandé pour ${policy.target}.`));
    if (tending) rows.push(commandRow('tactical-tend', tending.label, tending.enabled, tending.reason, live => {
      const fresh = tacticalTendingPolicy(live, tacticalIds, targetId, shift());
      if (!fresh?.enabled || fresh.pawnId === undefined) throw new Error(fresh?.reason ?? 'Soins mobilisés indisponibles.');
      return {type: 'order-drafted-tend', pawnId: fresh.pawnId, patientId: fresh.patientId, queue: false};
    }, `Soins sans médicament demandés pour ${policy.target}.`));
    if (!policy.reason) {
      if (policy.drafted < policy.selected) rows.push({id: 'tactical-excluded', label: `${policy.selected - policy.drafted} membre(s) non mobilisé(s) ou indisponible(s) exclus.`});
      for (const option of policy.options) rows.push(commandRow(`attack-${option.kind}`, option.label, option.enabled, option.reason, live => {
        const fresh = tacticalAttackPolicy(live, tacticalIds, targetId, shift()), accepted = fresh.options.find(candidate => candidate.kind === option.kind);
        if (!accepted?.enabled) throw new Error(fresh.reason ?? accepted?.reason ?? 'Cette attaque n’est plus disponible.');
        return {type: option.kind, pawnIds: accepted.pawnIds, targetId};
      }, `${option.kind === 'shoot' ? 'Tir' : 'Mêlée'} demandé sur ${policy.target}.`));
    }
    if (queue) rows.push({id: 'tactical-queue-note', label: 'Seuls les déplacements ont une file d’ordres tactiques.'});
    present({id: 'native-orders', title: `${policy.target} · case ${at.x}, ${at.z}`, rows});
    return;
  }

  const pawn = ids.length === 1 ? world.pawns.find(person => person.id === ids[0]) : undefined;
  if (!pawn) { message('Ordres de travail', 'Sélectionnez un seul colon pour lui donner un travail.'); return; }
  if (!isColonist(pawn) || pawn.prisoner) { message('Ordres de travail', pawn.prisoner ? 'Les prisonniers se gèrent dans leur inspection. Ils ne reçoivent pas d’ordres de colon.' : 'Cette personne ne fait pas partie de la colonie.'); return; }
  message(`${pawn.name} · case ${at.x}, ${at.z}`, 'Vérification des accès…');
  try {
    const options = await client.orderOptions(pawn.id, at.x, at.z, queue);
    const live = read(); if (!live) return;
    const rows: NativeRow[] = [];
    let firefoamCount = 0;
    if ([290, 291, 292, 293,294,295,296,297,298,299].includes(live.schemaVersion)) {
      for (const structure of live.structures.filter(structure => structure.kind === 'firefoam-popper' && footprintContains(structure, at)).sort((a, b) => a.id - b.id)) {
        firefoamCount++;
        const reason = queue ? 'Déclenchement direct ; relâchez Maj.' : queryFirefoamUseReason290(live, pawn.id, structure.id);
        rows.push(commandRow(`firefoam-${structure.id}`, 'Déclencher sur place : mousse anti-incendie', !reason, reason, currentWorld => {
          const refusal = shift() ? 'Déclenchement direct ; relâchez Maj.' : queryFirefoamUseReason290(currentWorld, pawn.id, structure.id);
          if (refusal) throw new Error(refusal);
          return {type: 'firefoam-trigger', pawnId: pawn.id, structureId: structure.id};
        }, 'Déclenchement demandé : trajet et travail au contact.'));
      }
    }
    const ship = shipCasketOptions277(live, pawn.id, at, queue);
    for (const option of ship) rows.push(commandRow(`ship-${JSON.stringify(option.command)}`, option.label, option.enabled, option.reason, currentWorld => {
      const fresh = shipCasketOptions277(currentWorld, pawn.id, at, shift()).find(candidate => JSON.stringify(candidate.command) === JSON.stringify(option.command));
      if (!fresh?.enabled) throw new Error(fresh?.reason ?? 'Cette action de caisson spatial n’est plus disponible.');
      return fresh.command;
    }, 'Ordre de caisson spatial accepté.'));

    const cryptosleep = cryptosleepOptions271(live, pawn.id, at, queue);
    for (const option of cryptosleep) {
      const prepare = (currentWorld: World, confirmed = false): Command | undefined => {
        const fresh = cryptosleepOptions271(currentWorld, pawn.id, at, shift()).find(candidate => JSON.stringify(candidate.command) === JSON.stringify(option.command));
        if (!fresh?.enabled) throw new Error(fresh?.reason ?? 'Cette action de cryptosommeil n’est plus disponible.');
        if (fresh.confirmLast && fresh.command.type === 'order-enter-cryptosleep') {
          if (confirmed) return {...fresh.command, confirmLastColonist: true};
          const name = currentWorld.pawns.find(person => person.id === pawn.id)?.name ?? 'Ce colon';
          const cancel: NativeControl = {id: 'cryptosleep-cancel', label: 'Annuler', onActivate: () => nativeOrderPage(latest(), ids, at, _x, _y, queue, targetId, client, show)};
          const accept: NativeControl = {id: 'cryptosleep-confirm', label: 'Entrer en cryptosommeil', onActivate: () => run(next => prepare(next, true), 'Ordre de cryptosommeil accepté.')};
          present({id: 'native-cryptosleep-confirm', title: 'Dernier colon hors des caissons', rows: [{id: 'last-colon', label: `${name} est le dernier colon libre encore présent hors des caissons. Une autre personne devra ouvrir son caisson sur place. Continuer ?`}], actions: [cancel, accept]});
          return;
        }
        return fresh.command;
      };
      rows.push(commandRow(`cryptosleep-${JSON.stringify(option.command)}`, option.label, option.enabled, option.reason, currentWorld => prepare(currentWorld), 'Ordre de cryptosommeil accepté.'));
    }

    for (const option of options) {
      const direct = option.openCasketId !== undefined || option.consumePileId !== undefined;
      const label = option.enabled && !direct ? `${queue ? 'Mettre en file :' : 'Prioriser :'} ${option.label}` : option.label;
      rows.push(commandRow(`order-${optionKey(option)}`, label, option.enabled, option.reason, async () => {
        const queued = shift();
        if (queued && option.openCasketId !== undefined) throw new Error('Ouvrir est un ordre direct ; relâchez Maj.');
        if (queued && option.consumePileId !== undefined) throw new Error('Consommer est un ordre direct ; relâchez Maj.');
        const fresh = (await client.orderOptions(pawn.id, at.x, at.z, queued)).find(candidate => optionKey(candidate) === optionKey(option));
        if (!read()) return;
        if (!fresh?.enabled) throw new Error(fresh?.reason ?? 'Ce travail ou cet objet n’est plus disponible sur cette case.');
        return optionCommand(fresh, pawn.id, queued);
      }, option.arrestPatientId !== undefined ? 'Tentative d’arrestation demandée ; l’acceptation sera vérifiée au contact.' : 'Ordre accepté.', option.warnings?.join(' · ')));
    }
    const fire = live.fires?.items.find(candidate => { const position = firePosition(live, candidate); return position?.x === at.x && position.z === at.z; });
    if (fire) rows.push(commandRow(`fire-${fire.id}`, 'Prioriser : éteindre le feu', true, undefined, currentWorld => {
      const currentFire = currentWorld.fires?.items.find(candidate => candidate.id === fire.id), position = currentFire && firePosition(currentWorld, currentFire);
      if (!position || position.x !== at.x || position.z !== at.z) throw new Error('Ce feu n’est plus présent sur cette case.');
      return {type: 'order-extinguish', pawnId: pawn.id, fireId: fire.id};
    }, 'Extinction prioritaire demandée.'));
    if (!options.length && !fire && !cryptosleep.length && !ship.length && !firefoamCount) rows.push({id: 'orders-empty', label: 'Aucun travail ni pile à transporter ici. Utilisez les ordres d’Architecte.'});
    const hint = firefoamCount ? 'Déclenchement direct : le colon rejoint l’appareil puis travaille au contact. Toute interruption avant la fin empêche l’armement.'
      : ship.length ? 'Le caisson spatial se ferme au contact et son occupant peut ensuite être éjecté directement, sans autre colon ni électricité.'
      : cryptosleep.length ? 'Le cryptosommeil se prépare au contact. Un autre colon devra ouvrir le caisson sur place.'
      : options.some(option => option.openCasketId !== undefined) ? 'Le colon rejoint la capsule et l’ouvre sur place. Ordre direct, sans mise en file.'
      : options.some(option => option.consumePileId !== undefined) ? 'Consommer remplace l’activité en cours, sans mise en file. Un colon mobilisé reste mobilisé. La nourriture se mange et la bière se boit au contact de la pile.'
      : options.some(option => option.arrestPatientId !== undefined) ? 'Arrestation directe par un colon démobilisé, avec lit de prison accessible. La chance affichée dépend de l’état actuel ; un refus peut provoquer une fureur violente.'
      : fire ? 'L’extinction est un ordre direct, sans mise en file.'
      : options.some(option => option.capturePatientId !== undefined) ? 'La capture est un ordre direct. Préparez un lit de prison dans une pièce fermée.'
      : 'Maj : ajouter à la file. Construction et cuisine peuvent se poursuivre sur cette case.';
    rows.push({id: 'orders-hint', label: hint});
    present({id: 'native-orders', title: `${pawn.name} · case ${at.x}, ${at.z}`, rows});
  } catch (error) { fail(error); }
}
