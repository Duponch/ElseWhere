import type { StockpileCell, Structure, World } from '../sim/types';
import {readResidentAuxiliaryFrame} from '../bridge/resident-auxiliary-sections';

// This owns primitive captures, never a World, source array, building or policy.
type Scalar = string | number | boolean | bigint | null | undefined;
const scalar = (value: unknown): value is Scalar => value === null || value === undefined ||
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint';
function equal(a: readonly Scalar[], b: readonly Scalar[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
function allScalars(values: readonly Scalar[]): boolean {
  for (let i = 0; i < values.length; i++) if (!scalar(values[i])) return false;
  return true;
}

function legacyStructureSignature(structures: readonly Structure[], doorAxesKey: string, packageKey: string): string {
  return doorAxesKey + packageKey + structures.map(s => `${s.id}:${s.kind}:${s.material}:${s.x}:${s.z}:${s.orientation}:${s.footprint}:${s.medical}:${s.grave?.corpseId}:${s.flower?.plant ? `${s.flower.plant.hitPoints > 0}:${Math.floor(s.flower.plant.growth * 4)}` : ''}:${s.power?.on}:${s.power?.parentId}:${s.power?.switchOn}:${s.breakdown?.brokenAt ?? ''}:${s.fuel ? s.fuel.ticks > 0 : ''}${s.kind==='cryptosleep-casket'?':crypto'+!!s.cryptosleep?.human:s.kind==='ship-cryptosleep-casket'?':crypto'+!!s.shipCryptosleep277?.occupant:''}${s.kind==='ship-reactor'?':reactor'+(s.shipReactor275?.state??'hibernating'):''}`).join('|');
}

/** Recapture all interpolation inputs on every read, including mutable arrays.
 * Raw differences may rebuild the same legacy string: its collisions are kept.
 * Caller supplies freshly computed door/package strings; neither dependency is
 * replaced by a structures-only witness, tick, reference or public boolean. */
export class StructurePresentationSignature {
  private readonly slots: { values: Scalar[]; text: string }[] = [];
  private readonly scratch: Scalar[] = [];
  private doorAxesKey: string | undefined;
  private packageKey: string | undefined;
  private signature = '';
  private valid = false;
  private flowerPlanValid = false;
  private readonly pendingFlowers = new Set<number>();

  clear(): void {
    this.pendingFlowers.clear();this.flowerPlanValid=false;
    this.slots.length = this.scratch.length = 0;
    this.doorAxesKey = this.packageKey = undefined;
    this.signature = '';
    this.valid = false;
  }

  read(structures: readonly Structure[], doorAxesKey: string, packageKey: string, reset = false): string {
    if (reset) this.clear();
    const previousFlowerPlanValid=this.flowerPlanValid;
    // Poison before even the historical length/guard reads can throw.
    this.flowerPlanValid = false;
    let changed = !this.valid || this.slots.length !== structures.length || this.doorAxesKey !== doorAxesKey || this.packageKey !== packageKey;
    let flowerOnly = !changed && previousFlowerPlanValid;
    this.valid = false;
    const v = this.scratch;
    for (let i = 0; i < structures.length; i++) {
      const s = structures[i]!;
      const plant = s.flower?.plant, fuel = s.fuel;
      // Check raw arithmetic inputs before any coercion. Unsupported objects or
      // symbols use the original expression each call and leave no receipt.
      const hitPoints = plant?.hitPoints, growth = plant?.growth, ticks = fuel?.ticks;
      if (!scalar(hitPoints) || !scalar(growth) || !scalar(ticks)) {
        this.clear(); return legacyStructureSignature(structures, doorAxesKey, packageKey);
      }
      v[0] = s.id; v[1] = s.kind; v[2] = s.material; v[3] = s.x; v[4] = s.z;
      v[5] = s.orientation; v[6] = s.footprint; v[7] = s.medical; v[8] = s.grave?.corpseId;
      v[9] = !!plant; v[10] = plant ? plant.hitPoints > 0 : undefined;
      v[11] = plant ? Math.floor(plant.growth * 4) : undefined;
      v[12] = s.power?.on; v[13] = s.power?.parentId; v[14] = s.power?.switchOn;
      v[15] = s.breakdown?.brokenAt ?? ''; v[16] = fuel ? fuel.ticks > 0 : '';v[17]=s.kind==='cryptosleep-casket'?!!s.cryptosleep?.human:s.kind==='ship-cryptosleep-casket'?!!s.shipCryptosleep277?.occupant:undefined;v[18]=s.kind==='ship-reactor'?(s.shipReactor275?.state??'hibernating'):undefined;
      if (!allScalars(v)) {
        this.clear(); return legacyStructureSignature(structures, doorAxesKey, packageKey);
      }
      const old = this.slots[i];
      if (!old || !equal(old.values, v)) {
        if(flowerOnly){
          if(!old || old.values[1]!=='flower-pot' || v[1]!=='flower-pot' || old.values[9]!==true || v[9]!==true)flowerOnly=false;
          else for(let field=0;field<v.length;field++)if(field!==10&&field!==11&&!Object.is(old.values[field],v[field])){flowerOnly=false;break;}
          if(flowerOnly)this.pendingFlowers.add(i);
        }
        const flower = v[9] ? `${v[10]}:${v[11]}` : '';
        this.slots[i] = { values: v.slice(), text: `${v[0]}:${v[1]}:${v[2]}:${v[3]}:${v[4]}:${v[5]}:${v[6]}:${v[7]}:${v[8]}:${flower}:${v[12]}:${v[13]}:${v[14]}:${v[15]}:${v[16]}${v[17]===undefined?'':':crypto'+v[17]}${v[18]===undefined?'':':reactor'+v[18]}` };
        changed = true;
      }
    }
    this.slots.length = structures.length;
    if (changed) this.signature = doorAxesKey + packageKey + this.slots.map(slot => slot.text).join('|');
    this.doorAxesKey = doorAxesKey; this.packageKey = packageKey;
    this.valid = true;this.flowerPlanValid=flowerOnly;
    return this.signature;
  }

  /** Cumulative since the last successful furniture build ACK. A colliding
   * non-floral raw change remains a full barrier even if its text is equal. */
  flowerChanges(): readonly number[] | undefined {
    return this.valid&&this.flowerPlanValid?[...this.pendingFlowers].sort((a,b)=>a-b):undefined;
  }

  /** Changed structure kinds are not tracked here: always a full build. */
  changedKinds(): ReadonlySet<unknown> | undefined {return undefined;}

  /** Caller ACKs only after a full or partial build succeeds, never on throw. */
  ackFurnitureBuild(): void {
    this.pendingFlowers.clear();this.flowerPlanValid=this.valid;
  }
}

/** Object.entries is intentionally retained: own enumerable string keys and
 * getter values have the original snapshot semantics; symbols/inherited keys
 * and truthy-but-not-true values stay excluded. Only sorting/stringing is reused. */
class AllowedKeys {
  private keys = new Set<string>();
  private text = '';
  private readonly scratch: string[] = [];

  read(values: object): string {
    const current = this.scratch;
    current.length = 0;
    let changed = false;
    for (const [key, value] of Object.entries(values)) if (value === true) {
      current.push(key);
      if (!this.keys.has(key)) changed = true;
    }
    if (current.length !== this.keys.size) changed = true;
    if (changed) {
      this.keys = new Set(current);
      this.text = current.sort().join(',');
    }
    return this.text;
  }
}

function legacyStorageSignature(stockpiles: readonly StockpileCell[]): string {
  const allowed = (values: object) => Object.entries(values).filter(([, value]) => value === true).map(([key]) => key).sort().join(',');
  return stockpiles.map(s => `${s.id}:${s.x}:${s.z}:${s.priority}:${s.capacity}:${allowed(s.filters)}:${s.items ? allowed(s.items) : '*'}${s.zoneId===undefined?'':`:zone=${s.zoneId}`}`).join('|');
}

export class StoragePresentationSignature {
  private readonly slots: { values: Scalar[]; text: string; filters: AllowedKeys; items: AllowedKeys }[] = [];
  private readonly scratch: Scalar[] = [];
  private signature = '';
  private valid = false;
  private residentToken:object|undefined;

  clear(): void { this.slots.length = this.scratch.length = 0; this.signature = ''; this.valid = false;this.residentToken=undefined; }

  /** Only the renderer's explicit immutable lane calls this. Unknown/cloned
   * Worlds and every ordinary public read retain the complete value pass. */
  readResident(world:World,reset=false):string {
    const token=readResidentAuxiliaryFrame(world)?.token('stockpiles');
    if(!reset&&token&&token===this.residentToken&&this.valid)return this.signature;
    const value=this.read(world.stockpiles,reset);this.residentToken=token;return value;
  }

  read(stockpiles: readonly StockpileCell[], reset = false): string {
    this.residentToken=undefined;
    if (reset) this.clear();
    let changed = !this.valid || this.slots.length !== stockpiles.length;
    this.valid = false;
    const v = this.scratch;
    for (let i = 0; i < stockpiles.length; i++) {
      const s = stockpiles[i]!;
      let slot = this.slots[i];
      if (!slot) { slot = { values: [], text: '', filters: new AllowedKeys(), items: new AllowedKeys() }; this.slots[i] = slot; }
      v[0] = s.id; v[1] = s.x; v[2] = s.z; v[3] = s.priority; v[4] = s.capacity;
      if (!allScalars(v)) {
        this.clear(); return legacyStorageSignature(stockpiles);
      }
      v[5] = slot.filters.read(s.filters);
      v[6] = s.items ? slot.items.read(s.items) : '*';
      v[7] = s.zoneId===undefined?'':`:zone=${s.zoneId}`;
      if (!equal(slot.values, v)) {
        slot.values = v.slice(); slot.text = `${v[0]}:${v[1]}:${v[2]}:${v[3]}:${v[4]}:${v[5]}:${v[6]}${v[7]}`;
        changed = true;
      }
    }
    this.slots.length = stockpiles.length;
    if (changed) this.signature = this.slots.map(slot => slot.text).join('|');
    this.valid = true;
    return this.signature;
  }
}

/** Optional separate home prefix. The array is fully reread; ordering, duplicate
 * cells, absent/nullish join entries and the original comma collisions remain. */
export class HomePresentationSignature {
  private values: Scalar[] = [];
  private text = '';
  private present = false;
  private residentToken:object|undefined;

  clear(): void { this.values.length = 0; this.text = ''; this.present = false;this.residentToken=undefined; }

  readResident(world:World):string {
    const token=readResidentAuxiliaryFrame(world)?.token('home');
    if(token&&token===this.residentToken)return this.text;
    const value=this.read(world.home);this.residentToken=token;return value;
  }

  read(home: readonly number[] | undefined): string {
    this.residentToken=undefined;
    if (home === undefined) { this.clear(); return ''; }
    let changed = !this.present || this.values.length !== home.length;
    this.present = false;
    for (let i = 0; i < home.length; i++) {
      const value = home[i];
      if (!scalar(value)) { this.clear(); return home.join(','); }
      if (!Object.is(this.values[i], value)) changed = true;
    }
    if (changed) { this.values = home.slice(); this.text = home.join(','); }
    this.present = true;
    return this.text;
  }
}
