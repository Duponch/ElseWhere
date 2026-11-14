import {mechRaidGroups261} from '../sim/mechanical-raid-groups-261';
import type {CampaignState} from '../sim/world-map-state';
import {registeredMaps,registeredMapId} from '../sim/world-map-context';
import type { World } from '../sim/types';
import type { SecondaryMap } from '../sim/secondary-site-state';
import { alertManhunter } from '../sim/status-alert-rules';

export type ThreatPauseMode = 'never' | 'major' | 'any-threat';
export interface ThreatPauseToken { generation: number; pauseRevision: number }
export interface ThreatSpeedOptions { explicit: true; token: ThreatPauseToken }
export type ThreatSite = 'home' | 'secondary';
export type ThreatKind = 'raid' | 'mechanoid' | 'manhunter' | 'ancient-shrine' | 'camp-detected';
export interface UrgentThreatRow {
  mapId?:number;tile?:number|null;site: ThreatSite; kind: ThreatKind; totalArrivals: number; lastTick: number;
  lastCount: number; actorId?: number;
}
export interface UrgentThreatSnapshot extends ThreatPauseToken {
  serial: number; urgentHeld: boolean; rows: UrgentThreatRow[];
}
export interface UrgentThreatArrival extends UrgentThreatRow { delta: number }
export interface UrgentThreatReceipt extends ThreatPauseToken {
  serial: number; paused: boolean; tick: number; rows: UrgentThreatArrival[];
}
export const validThreatPauseMode = (v: unknown): v is ThreatPauseMode => v === 'never' || v === 'major' || v === 'any-threat';
const slot = (r: Pick<UrgentThreatRow, 'site' | 'kind' | 'mapId' | 'tile'>) => (r.mapId!==undefined?'tile:'+String(r.tile):r.site) + ':' + r.kind;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
function record(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return (proto === Object.prototype || proto === null) && Reflect.ownKeys(v).every(k => typeof k === 'string' && 'value' in Object.getOwnPropertyDescriptor(v, k)!);
}
function keys(v: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
}
/** A small transport guard; never reads a World or commits a Decoder. */
export function validUrgentThreatSnapshot(v: unknown, tick: unknown, speed: unknown,maxTiles?:number): v is UrgentThreatSnapshot {
  if (!integer(tick) || ![0, 1, 3, 6].includes(speed as number) || !record(v)
    || !keys(v, ['generation','pauseRevision','serial','urgentHeld','rows'])
    || !integer(v.generation) || v.generation < 1 || !integer(v.pauseRevision) || !integer(v.serial)
    || v.pauseRevision > v.serial || typeof v.urgentHeld !== 'boolean'
    || (v.urgentHeld && (v.pauseRevision === 0 || speed !== 0)) || !Array.isArray(v.rows) || v.rows.length > (maxTiles===undefined?3_000_000:Math.max(8,(maxTiles+1)*5)) || Reflect.ownKeys(v.rows).length !== v.rows.length + 1) return false;
  const seen = new Set<string>(); let total = 0;
  for (let i = 0; i < v.rows.length; i++) {
    const d = Object.getOwnPropertyDescriptor(v.rows, String(i));
    if (!d || !('value' in d)) return false;
    const r = d.value;
    if (!record(r) || !keys(r, ['site','kind','totalArrivals','lastTick','lastCount'], ['actorId','mapId','tile'])
      || !['home','secondary'].includes(r.site as string) || !['raid','mechanoid','manhunter','ancient-shrine','camp-detected'].includes(r.kind as string)
      || Object.hasOwn(r,'mapId')!==Object.hasOwn(r,'tile')||r.mapId!==undefined&&(!integer(r.mapId)||r.tile!==null&&(!integer(r.tile)||maxTiles!==undefined&&r.tile>=maxTiles))
      || !integer(r.totalArrivals) || r.totalArrivals < 1 || !integer(r.lastTick) || r.lastTick > tick
      || !integer(r.lastCount) || r.lastCount < 1 || (Object.hasOwn(r, 'actorId') && (!integer(r.actorId) || r.actorId < 1))) return false;
    const key = slot(r as unknown as UrgentThreatRow); if (seen.has(key)) return false;
    seen.add(key); total += r.totalArrivals;
  }
  return Number.isSafeInteger(total) && total === v.serial;
}

type LocalMap = Pick<World, 'raids' | 'wildlife' | 'ancientShrineWarnings'>;
interface MapBaseline { map: LocalMap; raids: Map<string,{kind: 'raid'|'mechanoid';startedAt:number;count:number;actorId?:number}>; animals: Map<number, number>; warnings:Set<string>;detected:boolean }
/** Only active episodes are retained. Archives cannot become arrivals after eviction. */
export class UrgentThreatObserver {
  private maps = new Map<ThreatSite|number, MapBaseline>();
  private state: UrgentThreatSnapshot = { generation: 0, serial: 0, pauseRevision: 0, urgentHeld: false, rows: [] };
  bootstrap(world: CampaignState): void {
    this.state = { generation: this.state.generation + 1, serial: 0, pauseRevision: 0, urgentHeld: false, rows: [] };
    this.maps.clear(); this.prepareMaps(world);
  }
  private owners(world: CampaignState): [ThreatSite|number,LocalMap,(number|null)?,boolean?][] {
    if(world.worldMaps)return registeredMaps(world).map(map=>[registeredMapId(map)!,map,world.worldMaps!.sites.find(s=>s.id===registeredMapId(map))!.tile,!!world.worldMaps!.sites.find(s=>s.id===registeredMapId(map))!.campPressure?.alert]);
    return [['home', world as World], ...(world as World).secondarySite ? [['secondary', (world as World).secondarySite!.map] as [ThreatSite, SecondaryMap]] : []];
  }
  /** Call BEFORE a new map's first step, including command publication. */
  prepareMaps(world: CampaignState): void {
    const owners = this.owners(world);
    for (const site of this.maps.keys()) if (!owners.some(([s]) => s === site)) this.maps.delete(site);
    // Registry IDs are monotone physical owners. Promotion only replaces their context views.
    for (const [site, map,,detected] of owners) { const before=this.maps.get(site); if (!before || typeof site!=='number'&&before.map!==map) this.maps.set(site, this.read(map,detected)); }
  }
  private read(map: LocalMap,detected=false): MapBaseline {
    const raids:MapBaseline['raids'] = new Map(), animals = new Map<number, number>();
    // Schema 333 drop pods: a raider exists only once its pod opened; no
    // actor target is invented for a raid still in the air.
    for(const group of [...map.raids?.active?[map.raids.active]:[],...map.raids?.extraActive261??[]]){const pods=group.arrival333?.pods,actorId=pods?pods.find(p=>p.openedAtCore!==undefined)?.pawnId:group.members[0];raids.set('raid:'+group.id,{kind:'raid',startedAt:group.startedAt,count:group.members.length,...actorId!==undefined?{actorId}:{}});}
    for(const group of mechRaidGroups261(map))raids.set('mechanoid:'+group.id,{kind:'mechanoid',startedAt:group.startedAt,count:group.members.length,actorId:group.members[0]});
    for (const a of map.wildlife?.animals ?? []) if (a.manhunter) animals.set(a.id, a.manhunter!.startedAtCore);
    const warnings=new Set((map.ancientShrineWarnings?.pairs??[]).filter(p=>p.letter).map(p=>p.triggerId+':'+p.letter!.tick));
    return { map, raids, animals, warnings,detected };
  }
  capture(world: CampaignState, mode: ThreatPauseMode): boolean {
    let pause = false;
    const arrive = (site: ThreatSite|number,tile:number|null|undefined, kind: ThreatKind, count: number, actorId?: number) => {
      let row = this.state.rows.find(r=>slot(r)===(typeof site==='number'?'tile:'+String(tile):site)+':'+kind);
      if (!row) { row = { site:typeof site==='number'?site===0?'home':'secondary':site,...typeof site==='number'?{mapId:site,tile:tile??null}:{},kind, totalArrivals: 0, lastTick: world.tick, lastCount: count }; this.state.rows.push(row); }
      if(typeof site==='number')row.mapId=site;row.totalArrivals++; row.lastTick = world.tick; row.lastCount = count;
      if (actorId !== undefined) row.actorId = actorId; else delete row.actorId;
      this.state.serial++;
      pause ||= mode === 'any-threat' || (mode === 'major' && kind !== 'manhunter');
    };
    for (const [site, map,tile,detected] of this.owners(world)) {
      const before = this.maps.get(site);
      if (!before || typeof site!=='number'&&before.map!==map) throw new Error('Threat observer map was not bootstrapped before step.');
      const after = this.read(map,detected);if(after.detected&&!before.detected)arrive(site,tile,'camp-detected',1);
      for(const [key,raid] of after.raids)if(before.raids.get(key)?.startedAt!==raid.startedAt)arrive(site,tile,raid.kind,Math.max(1,raid.count),raid.actorId);
      for (const a of map.wildlife?.animals ?? []) if (alertManhunter(a) && before.animals.get(a.id) !== a.manhunter!.startedAtCore) arrive(site,tile, 'manhunter', 1, a.id);
      for(const warning of map.ancientShrineWarnings?.pairs??[])if(warning.letter&&!before.warnings.has(warning.triggerId+':'+warning.letter.tick))arrive(site,tile,'ancient-shrine',1,warning.letter.pawnId);
      this.maps.set(site, after);
    }
    if (pause) { this.state.pauseRevision++; this.state.urgentHeld = true; }
    return pause;
  }
  token(): ThreatPauseToken { return { generation: this.state.generation, pauseRevision: this.state.pauseRevision }; }
  requestedSpeed(speed: number, options: ThreatSpeedOptions | undefined, beforeAdvance: ThreatPauseToken): number {
    if (speed === 0) return 0;
    if (!this.state.urgentHeld) return speed;
    const t = options?.token;
    if (options?.explicit === true && t?.generation === this.state.generation && t.pauseRevision === this.state.pauseRevision
      && beforeAdvance.generation === this.state.generation && beforeAdvance.pauseRevision === this.state.pauseRevision) {
      this.state.urgentHeld = false; return speed;
    }
    return 0;
  }
  snapshot(): UrgentThreatSnapshot { return { ...this.state, rows: this.state.rows.map(r => ({ ...r })) }; }
}

/** Two-phase receipt: validate before Decoder, commit only after applied. */
export class UrgentThreatDelivery {
  private committed?: UrgentThreatSnapshot;
  token(): ThreatPauseToken { return this.committed ? { generation: this.committed.generation, pauseRevision: this.committed.pauseRevision } : { generation: 0, pauseRevision: 0 }; }
  reset(): void { this.committed = undefined; }
  accepts(next: unknown, tick: unknown, speed: unknown,maxTiles?:number): next is UrgentThreatSnapshot {
    if (!validUrgentThreatSnapshot(next, tick, speed,maxTiles)) return false;
    const prev = this.committed;
    if (!prev) return true;
    if (next.generation < prev.generation) return false;
    if (next.generation > prev.generation) return true;
    if (next.serial < prev.serial || next.pauseRevision < prev.pauseRevision
      || next.pauseRevision - prev.pauseRevision > next.serial - prev.serial
      || (!prev.urgentHeld && next.urgentHeld && next.pauseRevision === prev.pauseRevision)) return false;
    for (const old of prev.rows) {
      const row = next.rows.find(r => slot(r) === slot(old));
      if (!row || row.totalArrivals < old.totalArrivals || row.lastTick < old.lastTick) return false;
      if (row.totalArrivals === old.totalArrivals && (row.lastTick !== old.lastTick || row.lastCount !== old.lastCount || row.actorId !== old.actorId||row.mapId!==old.mapId||row.tile!==old.tile||row.site!==old.site)) return false;
    }
    return true;
  }
  commit(next: UrgentThreatSnapshot, tick: number): UrgentThreatReceipt | undefined {
    const prev = this.committed?.generation === next.generation ? this.committed : undefined;
    const rows = next.rows.flatMap(r => { const delta = r.totalArrivals - (prev?.rows.find(old => slot(old) === slot(r))?.totalArrivals ?? 0); return delta ? [{ ...r, delta }] : []; });
    this.committed = { ...next, rows: next.rows.map(r => ({ ...r })) };
    return rows.length ? { generation: next.generation, serial: next.serial, pauseRevision: next.pauseRevision, paused: next.urgentHeld, tick, rows } : undefined;
  }
}
