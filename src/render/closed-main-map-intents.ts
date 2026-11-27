import type { World } from '../sim/types';
import { confirmedRouteEdgeSignature,type ConfirmedIntentFields,type ConfirmedIntentRoute } from './confirmed-intent-fields';
import { selectedConfirmedPath } from './action-feedback';

/** Only the private MAIN renderer supplies this reader. This interface is a
 * dependency injection port, not a capability inferred from a World or flag.
 * The default exported PresentationQueue continues its literal RAW read. */
export interface ClosedMainMapIntentReader {
  read(world:World):string;
  /** Only the fixed closed MAIN renderer calls this after decoder admission. */
  admit?(world:World):ConfirmedIntentFields;
  clear():void;
}

type Primitive = number|string|null;
const GROUP={jobs:0,growing:1,stockpile:2,home:3,roof:4,snow:5,allowed:6,plans:7,routes:8,piles:9} as const;
type IntentGroup=typeof GROUP[keyof typeof GROUP];
const GROUP_COUNT=10;

// Keep this projection literal and ordered. It is called on a real primitive
// change or conservative fallback, never on stable eligible MAIN captures.
function historicalSignature(world:World):string {
  return JSON.stringify([
    world.jobs.map(j=>[j.id,j.kind,j.x,j.z,j.orientation,j.footprint,j.construction,...j.wallDoor296?[j.wallDoor296.manual,j.wallDoor296.plan?.id,j.wallDoor296.plan?.kind,j.wallDoor296.plan?.material]:[],...Number(world.schemaVersion)>=379&&j.forbidden379===true?['forbidden379']:[],...Number(world.schemaVersion)>=379&&j.wallDoor296?.plan?.forbidden379===true?['door-plan-forbidden379']:[]]),
    world.growingZones.map(zone=>[zone.id,zone.cells,zone.plant]),
    world.stockpiles.map(cell=>[cell.id,cell.zoneId,cell.x,cell.z]),world.home,world.roofing?.build,world.roofing?.remove,
    world.piles.filter(p=>p.kind==='chunk'&&p.haulRequested).map(p=>[p.id,p.owner]),
  ]);
}

/** Reusable primitive observations of the historical queue and confirmed
 * intentions. Only the closed admission retains immutable intention arrays;
 * the public read path keeps literal V304 semantics. Closed MAIN construction
 * proves data-only records; shape tests here are conservative admission,
 * never discovery of such a mandate on a public RAW/getter/Proxy graph. */
class MainMapIntentReader implements ClosedMainMapIntentReader {
  private committed:Primitive[]=[];
  private scratch:Primitive[]=[];
  private committedLength=0;
  private cursor=0;
  private differs=false;
  private ready=false;
  private signature:string|undefined;
  private admitted=new WeakMap<World,string>();
  private projection:ConfirmedIntentFields|undefined;
  private generation=0;
  private captureEligible=false;
  private projectedGeneration=-1;
  private capturedRoutes:ConfirmedIntentRoute[]=[];
  // Groups in the flat scratch stream have variable lengths. Comparing at
  // the same absolute offset can mistake the tail of another group for an
  // unchanged home/roof/zone after preceding rows are added or removed.
  // Fixed reusable ranges preserve independent exact comparisons without
  // allocating per-field arrays or rebuilding unaffected resident producers.
  private committedRanges=new Int32Array(GROUP_COUNT*2).fill(-1);
  private scratchRanges=new Int32Array(GROUP_COUNT*2).fill(-1);
  private captureGroup:IntentGroup|undefined;
  private groupStart=0;
  private previousGroupStart=-1;
  private previousGroupLength=0;
  private changedGroups=0;

  clear():void {
    this.ready=false;
    this.signature=undefined;
    this.admitted=new WeakMap();this.projection=undefined;this.projectedGeneration=-1;this.capturedRoutes=[];
    this.committedLength=0;
    this.cursor=0;
    this.differs=false;
    this.committedRanges.fill(-1);
    // Primitive scratch capacity is reusable; admitted references are cleared.
  }

  private markGroupChanged():void {
    this.differs=true;this.changedGroups|=1<<this.captureGroup!;
  }
  private finishGroup():void {
    if(this.captureGroup===undefined)return;
    const length=this.cursor-this.groupStart,at=this.captureGroup*2;
    this.scratchRanges[at]=this.groupStart;this.scratchRanges[at+1]=length;
    if(this.previousGroupStart<0||length!==this.previousGroupLength)this.markGroupChanged();
  }
  private beginGroup(group:IntentGroup):void {
    this.finishGroup();this.captureGroup=group;this.groupStart=this.cursor;
    this.previousGroupStart=this.committedRanges[group*2]!;
    this.previousGroupLength=this.committedRanges[group*2+1]!;
  }
  private writeAt(index:number,value:Primitive):void {
    this.scratch[index]=value;
    // JSON normalizes both signs of zero. Numbers admitted below are finite.
    const relative=index-this.groupStart;
    if(this.previousGroupStart<0||relative>=this.previousGroupLength||value!==this.committed[this.previousGroupStart+relative])this.markGroupChanged();
  }
  private put(value:Primitive):void {
    this.writeAt(this.cursor++,value);
  }
  private number(value:unknown):boolean {
    if(typeof value!=='number'||!Number.isFinite(value))return false;
    this.put(value===0?0:value);return true;
  }
  private string(value:unknown):boolean {
    if(typeof value!=='string')return false;
    this.put(value);return true;
  }
  private optionalNumber(value:unknown):boolean {
    if(value===undefined){this.put(null);return true;}
    return this.number(value);
  }
  private optionalString(value:unknown):boolean {
    if(value===undefined){this.put(null);return true;}
    return this.string(value);
  }
  private cells(cells:unknown,optional:boolean):boolean {
    if(cells===undefined&&optional){this.put(-1);return true;}
    if(!Array.isArray(cells))return false;
    this.put(cells.length);
    for(let i=0;i<cells.length;i++)if(!this.number(cells[i]))return false;
    return true;
  }

  private capture(world:World,extended=false):boolean {
    this.capturedRoutes=[];this.changedGroups=0;this.captureGroup=undefined;this.scratchRanges.fill(-1);this.beginGroup(GROUP.jobs);
    if(!Array.isArray(world.jobs))return false;
    this.put(world.jobs.length);
    for(let i=0;i<world.jobs.length;i++){
      const job=world.jobs[i];
      if(!job||typeof job!=='object'
        ||!this.number(job.id)||!this.string(job.kind)||!this.number(job.x)||!this.number(job.z)
        ||!this.number(job.orientation)||!this.string(job.footprint)||!this.optionalString(job.construction)
        ||extended&&(!this.optionalString(job.furniture?.kind)||!this.optionalString(job.deconstruction?.kind)))return false;
      const future=job.wallDoor296;
      this.put(future?1:0);
      if(future){
        this.put(future.manual?1:0);
        if(!this.optionalNumber(future.plan?.id)||!this.optionalString(future.plan?.kind)||!this.optionalString(future.plan?.material))return false;
      }
      if(Number(world.schemaVersion)>=379){if(job.forbidden379===true)this.put('forbidden379');if(future?.plan?.forbidden379===true)this.put('door-plan-forbidden379');}
    }
    this.beginGroup(GROUP.growing);
    if(!Array.isArray(world.growingZones))return false;
    this.put(world.growingZones.length);
    for(let i=0;i<world.growingZones.length;i++){
      const zone=world.growingZones[i];
      if(!zone||typeof zone!=='object'||!this.number(zone.id)||!this.cells(zone.cells,false)||!this.string(zone.plant))return false;
      if(extended){this.put(zone.allowSow?1:0);this.put(zone.allowCut?1:0);}
    }
    this.beginGroup(GROUP.stockpile);
    if(!Array.isArray(world.stockpiles))return false;
    this.put(world.stockpiles.length);
    for(let i=0;i<world.stockpiles.length;i++){
      const cell=world.stockpiles[i];
      if(!cell||typeof cell!=='object'||!this.number(cell.id)||!this.optionalNumber(cell.zoneId)
        ||!this.number(cell.x)||!this.number(cell.z))return false;
    }
    this.beginGroup(GROUP.home);if(!this.cells(world.home,true))return false;
    this.beginGroup(GROUP.roof);if(!this.cells(world.roofing?.build,true)||!this.cells(world.roofing?.remove,true))return false;
    if(extended){
    this.beginGroup(GROUP.snow);
    if(!this.cells(world.snowClearArea,true))return false;
    this.beginGroup(GROUP.allowed);
    if(world.allowedAreas!==undefined&&!Array.isArray(world.allowedAreas))return false;
    this.put(world.allowedAreas?.length??0);
    for(const area of world.allowedAreas??[])
      if(!this.number(area.id)||!this.number(area.color)||!this.cells(area.cells,false))return false;
    this.beginGroup(GROUP.plans);
    const plans=world.plans369;
    if(plans===undefined)this.put(-1);
    else{
      if(!this.number(plans.nextId)||!Array.isArray(plans.plans))return false;
      this.put(plans.plans.length);
      for(const plan of plans.plans){
        if(!plan||!this.number(plan.id)||!this.number(plan.n)||!this.string(plan.color))return false;
        this.put(plan.hidden?1:0);if(!this.cells(plan.cells,false))return false;
      }
    }
    this.beginGroup(GROUP.routes);
    if(!Array.isArray(world.pawns))return false;
    const routeCount=this.cursor++;let routes=0;
    for(const pawn of world.pawns){
      const cells=selectedConfirmedPath(world,pawn);if(!cells.length)continue;
      const edgeSignature=confirmedRouteEdgeSignature(pawn.motion);
      if(!this.number(pawn.id)||!this.number(pawn.x)||!this.number(pawn.z)||!this.string(edgeSignature))return false;
      this.put(cells.length);
      for(const cell of cells)if(!this.number(cell.x)||!this.number(cell.z))return false;
      this.capturedRoutes.push({pawnId:pawn.id,origin:{x:pawn.x,z:pawn.z},edgeSignature,cells});routes++;
    }
    this.writeAt(routeCount,routes);
    }
    this.beginGroup(GROUP.piles);
    if(!Array.isArray(world.piles))return false;
    // A count prefix disambiguates every group. Reserve this slot until the
    // historical filter has read the piles once, rather than scanning twice.
    const countIndex=this.cursor++;
    let count=0;
    for(let i=0;i<world.piles.length;i++){
      const pile=world.piles[i];
      if(!pile||typeof pile!=='object'||typeof pile.kind!=='string')return false;
      if(pile.kind!=='chunk')continue;
      if(pile.haulRequested!==undefined&&pile.haulRequested!==true)return false;
      if(!pile.haulRequested)continue;
      if(!this.number(pile.id))return false;
      if(!pile.owner||typeof pile.owner!=='object'||Array.isArray(pile.owner))return false;
      // Preserve owner property ordering and the exact small JSON. Owner
      // equality cannot be inferred just from type and x/z/ID membership.
      const owner=JSON.stringify(pile.owner);
      if(typeof owner!=='string')return false;
      this.put(owner);count++;
    }
    this.writeAt(countIndex,count);this.finishGroup();
    return true;
  }

  read(world:World):string {
    const memo=this.admitted.get(world);if(memo!==undefined)return memo;
    return this.readFresh(world);
  }

  admit(world:World):ConfirmedIntentFields {
    const memo=this.admitted.get(world);
    if(memo!==undefined&&this.projection)return this.projection;
    // A public/queue read of an unadmitted World can advance the historical
    // witness without publishing its intent fields. In that case no group may
    // inherit a reference from a projection older than that witness.
    const projectionBehind=this.projectedGeneration!==this.generation;
    const signature=this.readFresh(world,true);
    this.admitted.set(world,signature);
    if(!this.projection||this.projectedGeneration!==this.generation){
      this.projectedGeneration=this.generation;
      const old=this.projection,changed=(group:IntentGroup)=>!old||projectionBehind||!this.captureEligible||!!(this.changedGroups&(1<<group));
      this.projection={jobs:changed(GROUP.jobs)?world.jobs:old!.jobs,
        growingZones:changed(GROUP.growing)?world.growingZones:old!.growingZones,
        stockpiles:changed(GROUP.stockpile)?world.stockpiles:old!.stockpiles,
        home:changed(GROUP.home)?world.home:old!.home,
        snowClearArea:changed(GROUP.snow)?world.snowClearArea:old!.snowClearArea,
        allowedAreas:changed(GROUP.allowed)?world.allowedAreas:old!.allowedAreas,
        plans369:changed(GROUP.plans)?world.plans369:old!.plans369,
        roofBuild:changed(GROUP.roof)?world.roofing?.build??[]:old!.roofBuild,
        roofRemove:changed(GROUP.roof)?world.roofing?.remove??[]:old!.roofRemove,
        routes:changed(GROUP.routes)?(this.captureEligible?this.capturedRoutes:world.pawns.flatMap(pawn=>{
          const cells=selectedConfirmedPath(world,pawn);return cells.length?[{pawnId:pawn.id,
            origin:{x:pawn.x,z:pawn.z},edgeSignature:confirmedRouteEdgeSignature(pawn.motion),cells}]:[];
        })):old!.routes};
    }
    return this.projection;
  }

  private readFresh(world:World,extended=false):string {
    this.cursor=0;this.differs=false;
    const eligible=this.capture(world,extended);this.captureEligible=eligible;
    if(eligible&&this.ready&&!this.differs&&this.cursor===this.committedLength)return this.signature!;
    // Commit only after the complete historical stringify succeeds. A throw
    // leaves the previous facts/signature intact; partial scratch is private.
    const signature=historicalSignature(world);
    this.generation++;
    if(eligible){
      const previous=this.committed;this.committed=this.scratch;this.scratch=previous;
      const ranges=this.committedRanges;this.committedRanges=this.scratchRanges;this.scratchRanges=ranges;
      this.committedLength=this.cursor;this.ready=true;
    }else this.ready=false;
    this.signature=signature;
    return signature;
  }
}

/** ROOT wires this exclusively inside the unexported MainColonyRenderer.
 * Calling this function does not certify an arbitrary World as immutable. */
export function createClosedMainMapIntentReader():ClosedMainMapIntentReader {
  return new MainMapIntentReader();
}
