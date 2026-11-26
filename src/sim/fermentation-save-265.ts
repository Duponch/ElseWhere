import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {carryQuantityBound379} from './carry-quantity-379.ts';
import {validFermentationState265,FERMENTING_SERVICE_TICKS_265} from './fermentation-state-265.ts';
import {isHaulOrder} from './order-types.ts';
import {everyHumanPawnOwner} from './human-owners.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {Pawn,Structure,World} from './types.ts';

const own=(o:object,k:string)=>Object.hasOwn(o,k);
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const brewingKind=(kind:unknown)=>kind==='brewery'||kind==='fermenting-barrel';
const incompatibleExtraction=(p:Pawn):boolean=>!!(p.need||p.recreation.task||p.allowedAreaReturn||p.animalRescue||p.deepWork||p.orbitalTrade||p.animalHandling||p.animalCare||p.animalFeed||p.burial||p.cleaning||p.openCasket||p.trade||p.firefighting||p.burning||p.ward||p.hunting||p.heatRefuge||p.research||p.tactics||p.flee||p.bombRefuge||p.melee||p.stun||p.shooting||p.draft||p.equipmentTask||p.feed||p.tend||p.surgery||p.rescue||p.medicalSleep||p.interruptedCargo||p.transitExit||p.visitor||p.prisoner||p.raid||p.podRescue||p.mental?.crisis);
/** Domain check AFTER ordinary shape/ID/owner validation. Traverses Things and
 * real containers only: no terrain scan, cloning or mutation on public reads. */
export function validFermentationWorld265(w:World,version:number=w.schemaVersion):boolean {
  const building=(s:Structure):boolean=>{
    if(brewingKind(s.kind)){
      if(!isSchema265OrLater(version)||s.material!=='wood'||s.footprint!=='standard'||!integer(s.orientation,0,3)||['quality','power','fuel'].some(k=>own(s,k)))return false;
      return s.kind==='fermenting-barrel'?own(s,'fermentation')&&validFermentationState265(s.fermentation):!own(s,'fermentation');
    }
    return !own(s,'fermentation');
  };
  const packed=(a:readonly PackedFurniture[]|undefined):boolean=>(a??[]).every(p=>!own(p,'fermentation')&&building(p.building));
  if(w.structures.some(s=>!building(s))||!packed(w.packed))return false;
  for(const j of w.jobs){
    if(own(j,'fermentation'))return false;
    const targets=[j.furniture,j.deconstruction,j.fixBreakdown,j.repair];
    if(targets.some(v=>v&&own(v,'fermentation')))return false;
    if(!isSchema265OrLater(version)&&(brewingKind(j.kind)||targets.some(v=>v&&'kind' in v&&brewingKind(v.kind))))return false;
    if(brewingKind(j.kind)&&(j.material!=='wood'||j.footprint!=='standard'||!integer(j.orientation,0,3)||own(j,'quality')||own(j,'fuel')||own(j,'power')))return false;
  }
  for(const key of ['lostWort','lostBeer'] as const)if(own(w.deconstructed,key)&&(!isSchema265OrLater(version)||!integer(w.deconstructed[key],1)))return false;
  const barrelClaims=new Set<number>();
  const pawn=(p:Pawn,local:boolean):boolean=>{
    if(own(p,'brewing')){
      const t=p.brewing;
      if(!isSchema265OrLater(version)||!local||!exact(t,['barrelId','spot','progress'])||!integer(t.barrelId,1,w.nextId-1)||!exact(t.spot,['x','z'])||!integer(t.spot.x,0,w.width-1)||!integer(t.spot.z,0,w.height-1)||!integer(t.progress,0,FERMENTING_SERVICE_TICKS_265)||p.haul||p.cooking||p.jobId!==null||incompatibleExtraction(p)||barrelClaims.has(t.barrelId))return false;
      const s=w.structures.find(s=>s.id===t.barrelId&&s.kind==='fermenting-barrel');
      if(!s||!s.fermentation||s.fermentation.wort<=0||s.fermentation.progress<1||Math.abs(s.x-t.spot.x)+Math.abs(s.z-t.spot.z)!==1)return false;
      barrelClaims.add(t.barrelId);
    }
    const tasks=[...(p.haul?[p.haul]:[]),...p.orders.queue.filter(isHaulOrder)];
    for(const h of tasks)if(h.destination.type==='fermenting-barrel'){
      const d=h.destination;
      if(!isSchema265OrLater(version)||!local||!exact(d,['type','structureId'])||!integer(d.structureId,1,w.nextId-1)||!integer(h.quantity,1,carryQuantityBound379({schemaVersion:version},'wort'))||barrelClaims.has(d.structureId)||h.serviceProgress!==undefined&&!integer(h.serviceProgress,0,FERMENTING_SERVICE_TICKS_265))return false;
      const s=w.structures.find(s=>s.id===d.structureId&&s.kind==='fermenting-barrel'),pile=w.piles.find(i=>i.id===(h.phase==='pickup'?h.sourcePileId:h.carryPileId));
      if(!s?.fermentation||s.fermentation.progress>=1||s.fermentation.wort+h.quantity>25||!pile||pile.item!=='wort')return false;
      barrelClaims.add(d.structureId);
    }
    return true;
  };
  if(!everyHumanPawnOwner(w,(p,kind)=>pawn(p,kind==='map')))return false;
  const group=(g:NonNullable<World['group']>)=>('members' in g?g.members.every(p=>pawn(p,false)):true)&&('packed' in g?packed(g.packed):true);
  if(w.group&&!group(w.group)||w.groupLosses?.some(l=>!packed(l.packed)))return false;
  for(const rows of [w.visitors?.departed??[],w.podRescues?.departed??[]])for(const row of rows)if(!packed(row.packed))return false;
  for(const row of w.worldPawns?.owners??[])if(!packed(row.packed)||row.kind==='human'&&!pawn(row.actor,false))return false;
  const groups=w.worldGroups;
  if(groups&&(groups.groups.some(r=>!group(r.state))||groups.losses.some(l=>!packed(l.packed))||groups.animalLosses?.some(l=>!packed(l.packed))||groups.abandonedPawns.some(p=>!packed(p.packed))||groups.abandonedContents.some(c=>c.humans.some(p=>!packed(p.packed))||c.animals.some(a=>!packed(a.packed)))))return false;
  const campaign=w.campaignMap;
  if(campaign?.revision===2&&(campaign.groups.some(g=>!group(g.state))||campaign.groupLosses.some(l=>!packed(l.packed))||campaign.animalLosses?.some(l=>!packed(l.packed))))return false;
  return true;
}
