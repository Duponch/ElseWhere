import {assignPileOwner} from './pile-index.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {hasTravellingCargo} from './interrupted-cargo.ts';
import {clearReleasedPawnAssignments259,planSelectedDrops} from './work-release.ts';
import {removalWritesMutable259,sealRemovalOriginal259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import type {Cell,Pawn,World} from './types.ts';

export type LinkedStorageLogisticsResult286=
 |{ok:false;reason:string}
 |{ok:true;current():boolean;commit():boolean};

const ownContextTasks286:readonly (keyof Pawn)[]=[
 'brewing','orbitalTrade','deepWork','animalHandling','animalCare','animalFeed','burial','cleaning','trade','firefighting',
 'ward','heatRefuge','research','tend','feed','medicalSleep','equipmentTask','shipCasketTask277','cryptosleepTask',
 'rescue','animalRescue','surgery','hunting','openCasket','transitExit','allowedAreaReturn','coupleTask285',
];
const physicalAnimal=(w:World,a:NonNullable<World['wildlife']>['animals'][number]):Cell=>
 a.motion&&a.motion.end>w.tick?a.motion.from:a;

/** Cold, placement-only projection of the actual admitted records. No engine,
 * clinical, ownership-adoption or random helper is run on these projections. */
function prepareWrites286(world:World,ids:ReadonlySet<number>):{writes:MapRemovalWrite259[];moves:string}|undefined {
 const writes:MapRemovalWrite259[]=[],projected=new Map<Pawn,Pawn>(),stationary=new Set<number>();
 const put=(object:object,key:string,value:unknown,present=true)=>writes.push({object,key,present,...present?{value}:{}});
 const view=(p:Pawn)=>{let draft=projected.get(p);if(!draft){draft={...p,orders:{...p.orders},recreation:{...p.recreation}};projected.set(p,draft);}return draft;};
 for(const p of world.pawns){
  const affected=p.haul?.destination.type==='stockpile'&&ids.has(p.haul.destination.stockpileId);
  if(affected){
   // This path replaces an ordinary hauling destination. A different actual
   // cross-owner service must use its own notifier, never this own-record half.
   if(p.jobId!==null||p.need!==null||p.cooking!==null||p.recreation.task!==null
    ||ownContextTasks286.some(k=>p[k]!==undefined)||p.melee||p.shooting)return;
   const draft=view(p),travelling=hasTravellingCargo(world,p);
   clearReleasedPawnAssignments259(draft);
   if(travelling){draft.interruptedCargo=true;draft.planCooldown=0;}
   else {delete draft.interruptedCargo;stationary.add(p.id);}
  }
  const queue=p.orders.queue.filter(o=>typeof o==='number'||!('destination'in o)
   ||o.destination.type!=='stockpile'||!ids.has(o.destination.stockpileId));
  if(queue.length!==p.orders.queue.length)view(p).orders.queue=queue;
  if(p.cooking?.storageId!==null&&p.cooking?.storageId!==undefined&&ids.has(p.cooking.storageId)){
   const draft=view(p);draft.cooking={...p.cooking,storageId:null};delete draft.cooking.storageQuantity;
   draft.path=[];draft.planCooldown=0;
  }
 }
 for(const [p,draft]of projected){
  for(const key of new Set([...Object.keys(p),...Object.keys(draft)])){
   if(key==='orders'||key==='recreation')continue;
   const present=Object.hasOwn(draft,key),old=Reflect.get(p,key),next=Reflect.get(draft,key);
   if(present!==Object.hasOwn(p,key)||!Object.is(old,next))put(p,key,next,present);
  }
  if(draft.orders.active!==p.orders.active)put(p.orders,'active',draft.orders.active);
  if(draft.orders.queue!==p.orders.queue)put(p.orders,'queue',draft.orders.queue);
  // The only nested service changed is an existing production destination;
  // recipe, workpiece, progress and ingredients retain their original owner.
  if(p.cooking&&draft.cooking&&draft.cooking!==p.cooking){
   const index=writes.findIndex(w=>w.object===p&&w.key==='cooking');if(index>=0)writes.splice(index,1);
   put(p.cooking,'storageId',null);if(Object.hasOwn(p.cooking,'storageQuantity'))put(p.cooking,'storageQuantity',undefined,false);
  }
 }
 const animals=world.wildlife?.animals??[],affectedAnimals=new Set(animals.filter(a=>a.haul&&a.haul.phase!=='holding'&&ids.has(a.haul.destination.stockpileId)));
 const animalViews=new Map([...affectedAnimals].map(a=>[a,{...a}]));
 for(const draft of animalViews.values())delete draft.haul;
 // This is the same finite placement shadow used by ordinary drop planning:
 // originals supply geometry, while only admitted reservation/cargo fields
 // are projected. It is never used as a simulated or persisted World.
 const placement:World={...world,pawns:world.pawns.map(p=>projected.get(p)??p),
  piles:world.piles.map(p=>({...p,owner:{...p.owner}})),packed:world.packed.map(p=>({...p,owner:{...p.owner}})),
  ...world.wildlife?{wildlife:{...world.wildlife,animals:animals.map(a=>animalViews.get(a)??a)}}:{}};
 const humanDrops=planSelectedDrops(placement,new Set(),stationary);if(!humanDrops)return;
 const moves:{id:number;owner:unknown}[]=[];
 for(const [id,cell]of humanDrops){
  const pile=placement.piles.find(p=>p.id===id),pack=placement.packed.find(p=>p.building.id===id);
  if(!!pile===!!pack)return;
  const owner={type:'ground' as const,x:cell.x,z:cell.z};
  if(pile){const original=world.piles.find(p=>p.id===id);if(!original||original.owner.type!=='pawn'||!stationary.has(original.owner.pawnId))return;
   assignPileOwner(pile,owner);put(original,'owner',owner);
  }else if(pack){const original=world.packed.find(p=>p.building.id===id);if(!original||original.owner.type!=='pawn'||!stationary.has(original.owner.pawnId))return;
   assignPileOwner(pack,owner);put(original,'owner',owner);
  }
  moves.push({id,owner});
 }
 // Every human promise already occupies the shadow before any animal asks
 // Near. A failed animal drop keeps its same original inventory and holding.
 for(const a of affectedAnimals){
  const task=a.haul!;if(task.phase==='holding')return;
  const draft=animalViews.get(a)!;delete draft.haul;draft.path=[];
  if(!a.motion||a.motion.end<=world.tick){if(draft.state==='moving')draft.state='idle';draft.nextDecision=world.tick;}
  if(task.carryPileId!==null){
   const original=world.piles.find(p=>p.id===task.carryPileId&&p.owner.type==='inventory'&&p.owner.pawnId===a.id);
   const pile=placement.piles.find(p=>p.id===task.carryPileId&&p.owner.type==='inventory'&&p.owner.pawnId===a.id);
   if(!original||!pile)return;
   if(dropRetainingIdentity(placement,pile,physicalAnimal(world,a))){put(original,'owner',pile.owner);moves.push({id:pile.id,owner:pile.owner});}
   else draft.haul={phase:'holding',carryPileId:pile.id,sinceCore:world.tick*10};
  }
  put(a,'haul',draft.haul,draft.haul!==undefined);put(a,'path',draft.path);
  if(draft.state!==a.state)put(a,'state',draft.state);
  if(draft.nextDecision!==a.nextDecision)put(a,'nextDecision',draft.nextDecision);
 }
 return {writes,moves:JSON.stringify(moves)};
}

/** Prepare once for the union of changed installed cells. A linked packed
 * member is policy data, never a local destination under its old coordinates. */
export function prepareLinkedStorageLogistics286(world:World,changedCellIds:readonly number[]):LinkedStorageLogisticsResult286 {
 if(!isSchema286OrLater(world.schemaVersion)||changedCellIds.some(id=>!Number.isSafeInteger(id)||id<1))return {ok:false,reason:'Réévaluation du stockage indisponible pour ce format.'};
 const ids=new Set(changedCellIds),at=world.tick,seed=world.seed,rng=world.rng;
 let used=false;
 if(!ids.size)return {ok:true,current:()=>!used,commit(){if(used)return false;used=true;return true;}};
 try{
  const data=prepareWrites286(world,ids);if(!data)return {ok:false,reason:'Un transport concerné ne peut pas être libéré sans perdre sa cargaison.'};
  const before={pawns:world.pawns,piles:world.piles,jobs:world.jobs,packed:world.packed,animals:world.wildlife?.animals};
  const layout=world.structures.map(s=>({original:s,value:JSON.stringify([s.id,s.kind,s.x,s.z,s.orientation,s.footprint,s.factionId,s.shelf?.cells])}));
  const ownerStamps=world.packed.map(p=>({pack:p,owner:p.owner,building:p.building}));
  const admissions:MapRemovalWrite259[]=[...data.writes,{object:world,key:'stock',present:true,value:world.stock},
   ...world.jobs.map(j=>({object:j,key:'escrow',present:true,value:j.escrow})),
   ...world.pawns.filter(p=>p.jobId===null&&(p.haul===null||p.haul.destination.type==='stockpile'&&ids.has(p.haul.destination.stockpileId)))
    .map(p=>({object:p,key:'planCooldown',present:true,value:p.planCooldown}))];
  if(!removalWritesMutable259(admissions))return {ok:false,reason:'Un détenteur concerné ne peut pas recevoir les nouveaux réglages.'};
  // Cargo wrappers seal their actual owners, not their shelf payload: the
  // group policy is legitimately adopted just before this physical commit.
  const seal=sealRemovalOriginal259({pawns:before.pawns,piles:before.piles,jobs:before.jobs,animals:before.animals,
   packedOwners:ownerStamps.map(p=>p.owner)},admissions,[]);
  const current=()=>!used&&isSchema286OrLater(world.schemaVersion)&&world.tick===at&&world.seed===seed&&world.rng===rng
   &&world.pawns===before.pawns&&world.piles===before.piles&&world.jobs===before.jobs&&world.packed===before.packed&&world.wildlife?.animals===before.animals
   &&ownerStamps.every(p=>world.packed.includes(p.pack)&&p.pack.owner===p.owner&&p.pack.building===p.building)
   &&world.structures.length===layout.length&&layout.every((row,i)=>world.structures[i]===row.original
    &&JSON.stringify([row.original.id,row.original.kind,row.original.x,row.original.z,row.original.orientation,row.original.footprint,row.original.factionId,row.original.shelf?.cells])===row.value)
   &&removalWritesMutable259(admissions)&&seal(0)&&prepareWrites286(world,ids)?.moves===data.moves;
  return {ok:true,current,commit(){if(!current())return false;used=true;
   for(const write of data.writes){if(write.present){if(!Reflect.set(write.object,write.key,write.value))throw Error('Admitted linked storage logistics write failed');}
    else if(!Reflect.deleteProperty(write.object,write.key))throw Error('Admitted linked storage logistics deletion failed');}
   return true;
  }};
 }catch{return {ok:false,reason:'Les détenteurs du transport ne sont pas représentables pour cette modification.'};}
}
