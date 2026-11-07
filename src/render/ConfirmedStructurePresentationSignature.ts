import type { Structure } from '../sim/types';

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
  return doorAxesKey + packageKey + structures.map(s => `${s.id}:${s.kind}:${s.material}:${s.x}:${s.z}:${s.orientation}:${s.footprint}:${s.medical}:${s.grave?.corpseId}:${s.flower?.plant ? `${s.flower.plant.hitPoints > 0}:${Math.floor(s.flower.plant.growth * 4)}` : ''}:${s.power?.on}:${s.power?.parentId}:${s.power?.switchOn}:${s.breakdown?.brokenAt ?? ''}:${s.fuel ? s.fuel.ticks > 0 : ''}${s.vent?':vent'+s.vent.open:''}${s.kind==='cryptosleep-casket'?':crypto'+!!s.cryptosleep?.human:s.kind==='ship-cryptosleep-casket'?':crypto'+!!s.shipCryptosleep277?.occupant:''}${s.kind==='ship-reactor'?':reactor'+(s.shipReactor275?.state??'hibernating'):''}`).join('|');
}

/** Recapture all interpolation inputs on every read, including mutable arrays.
 * Raw differences may rebuild the same legacy string: its collisions are kept.
 * Caller supplies freshly computed door/package strings; neither dependency is
 * replaced by a structures-only witness, tick, reference or public boolean. */
export class ConfirmedStructurePresentationSignature {
  private readonly slots: { values: Scalar[]; text: string }[] = [];
  private readonly scratch: Scalar[] = [];
  private doorAxesKey: string | undefined;
  private packageKey: string | undefined;
  private signature = '';
  private valid = false;
  private flowerPlanValid = false;
  private readonly pendingFlowers = new Set<number>();
  /** Kinds of the structures whose slot changed, appeared or disappeared since
   * the last furniture build ACK; `pendingOther` marks any change that is not
   * a structure slot (reset, legacy text, door axes or packed furniture). */
  private readonly pendingKinds = new Set<Scalar>();
  private pendingOther = true;

  clear(): void {
    this.pendingFlowers.clear();this.flowerPlanValid=false;this.pendingKinds.clear();this.pendingOther=true;
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
    if (!this.valid || this.doorAxesKey !== doorAxesKey || this.packageKey !== packageKey) this.pendingOther = true;
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
      v[15] = s.breakdown?.brokenAt ?? ''; v[16] = fuel ? fuel.ticks > 0 : ''; v[17] = s.vent?.open;v[18]=s.kind==='cryptosleep-casket'?!!s.cryptosleep?.human:s.kind==='ship-cryptosleep-casket'?!!s.shipCryptosleep277?.occupant:undefined;v[19]=s.kind==='ship-reactor'?(s.shipReactor275?.state??'hibernating'):undefined;
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
        if (old) this.pendingKinds.add(old.values[1]);
        this.pendingKinds.add(v[1]);
        const flower = v[9] ? `${v[10]}:${v[11]}` : '';
        this.slots[i] = { values: v.slice(), text: `${v[0]}:${v[1]}:${v[2]}:${v[3]}:${v[4]}:${v[5]}:${v[6]}:${v[7]}:${v[8]}:${flower}:${v[12]}:${v[13]}:${v[14]}:${v[15]}:${v[16]}${v[17]===undefined?'':':vent'+v[17]}${v[18]===undefined?'':':crypto'+v[18]}${v[19]===undefined?'':':reactor'+v[19]}` };
        changed = true;
      }
    }
    for (let i = structures.length; i < this.slots.length; i++) this.pendingKinds.add(this.slots[i]!.values[1]);
    this.slots.length = structures.length;
    if (changed) this.signature = doorAxesKey + packageKey + this.slots.map(slot => slot.text).join('|');
    this.doorAxesKey = doorAxesKey; this.packageKey = packageKey;
    this.valid = true;this.flowerPlanValid=flowerOnly;
    return this.signature;
  }

  // V299_CONFIRMED_READ_BEGIN
  // Only the central native closure may supply an exhaustive confirmed suffix.
  readConfirmed(structures: readonly Structure[], doorAxesKey: string, packageKey: string, indices?: readonly number[], reset = false): string {
    if (reset || !this.valid || this.slots.length !== structures.length || indices === undefined) return this.read(structures,doorAxesKey,packageKey,reset);
    let previousIndex = -1;
    for (const index of indices) {
      if (!Number.isSafeInteger(index) || index <= previousIndex || index >= structures.length) return this.read(structures,doorAxesKey,packageKey);
      previousIndex = index;
    }
    const previousFlowerPlanValid=this.flowerPlanValid;
    // Poison before even the historical length/guard reads can throw.
    this.flowerPlanValid = false;
    let changed = !this.valid || this.slots.length !== structures.length || this.doorAxesKey !== doorAxesKey || this.packageKey !== packageKey;
    let flowerOnly = !changed && previousFlowerPlanValid;
    if (!this.valid || this.doorAxesKey !== doorAxesKey || this.packageKey !== packageKey) this.pendingOther = true;
    this.valid = false;
    const v = this.scratch;
    for (const i of indices) {
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
      v[15] = s.breakdown?.brokenAt ?? ''; v[16] = fuel ? fuel.ticks > 0 : ''; v[17] = s.vent?.open;v[18]=s.kind==='cryptosleep-casket'?!!s.cryptosleep?.human:s.kind==='ship-cryptosleep-casket'?!!s.shipCryptosleep277?.occupant:undefined;v[19]=s.kind==='ship-reactor'?(s.shipReactor275?.state??'hibernating'):undefined;
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
        if (old) this.pendingKinds.add(old.values[1]);
        this.pendingKinds.add(v[1]);
        const flower = v[9] ? `${v[10]}:${v[11]}` : '';
        this.slots[i] = { values: v.slice(), text: `${v[0]}:${v[1]}:${v[2]}:${v[3]}:${v[4]}:${v[5]}:${v[6]}:${v[7]}:${v[8]}:${flower}:${v[12]}:${v[13]}:${v[14]}:${v[15]}:${v[16]}${v[17]===undefined?'':':vent'+v[17]}${v[18]===undefined?'':':crypto'+v[18]}${v[19]===undefined?'':':reactor'+v[19]}` };
        changed = true;
      }
    }
    this.slots.length = structures.length;
    if (changed) this.signature = doorAxesKey + packageKey + this.slots.map(slot => slot.text).join('|');
    this.doorAxesKey = doorAxesKey; this.packageKey = packageKey;
    this.valid = true;this.flowerPlanValid=flowerOnly;
    return this.signature;
  }

  // V299_CONFIRMED_READ_END

  /** Cumulative since the last successful furniture build ACK. A colliding
   * non-floral raw change remains a full barrier even if its text is equal. */
  flowerChanges(): readonly number[] | undefined {
    return this.valid&&this.flowerPlanValid?[...this.pendingFlowers].sort((a,b)=>a-b):undefined;
  }

  /** Kinds of every structure slot that changed since the last furniture build
   * ACK, or undefined when anything else changed (or the read is not valid). */
  changedKinds(): ReadonlySet<Scalar> | undefined {
    return this.valid && !this.pendingOther ? this.pendingKinds : undefined;
  }

  /** Caller ACKs only after a full or partial build succeeds, never on throw. */
  ackFurnitureBuild(): void {
    this.pendingFlowers.clear();this.flowerPlanValid=this.valid;this.pendingKinds.clear();this.pendingOther=!this.valid;
  }
}

