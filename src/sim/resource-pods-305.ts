import {schemaAtLeast} from './schema-range.ts';
import {TRADE_CATALOGUE} from './trade-catalogue.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {freshRot} from './food-preservation.ts';
import {nearbyGround,groundCapacity,groundPile} from './ground-placement.ts';
import {isColonist} from './affiliation.ts';
import {blockedCells} from './pathfinding.ts';
import {candidateAccess} from './candidate-access.ts';
import {canStandAt,captureStandability} from './furniture-travel.ts';
import {isRoofed} from './roof-rules.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {footprintCells} from './definitions.ts';
import {refreshStock} from './materials.ts';
import type {Cell,MaterialPile,World} from './types.ts';

/* Schema 305: Core ResourcePodCrash (Misc, weight 1.0). One kind of
 * sellable, non-equipment item worth 1 to 40 silver a unit is chosen; 150 to
 * 600 silver of it fall in pods, in stacks of 20 to 40 units (at most the
 * stack limit and the remaining budget), seven stacks at most. Meats,
 * leathers and eggs each weigh as at most five kinds in the choice. The pods
 * land on an open, reachable cell, open, and leave a steel slag chunk.
 * Adaptation: one landing per incident, the stacks set around it; the fall
 * and opening use the short staging of the refugee capsule. */
export const isResourcePods305=schemaAtLeast(305);
export const RESOURCE_POD_FALL_TICKS305=6,RESOURCE_POD_OPEN_TICKS305=11;
export interface ResourcePodPending305 {start:number;landAt:number;openAt:number;cell:Cell;seed:number}

function random(state:{rng:number}):number {let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng/0x100000000;}
const isMeat=(item:string)=>item.endsWith('-meat');
const isLeather=(item:string)=>item.endsWith('-leather')||item==='foxfur';
const isEgg=(item:string)=>item.includes('egg');
/** Candidate kinds in catalogue order, with their category-adjusted weight. */
export function resourcePodKinds305():{item:ItemId;value:number;weight:number}[] {
  const rows:{item:ItemId;value:number}[]=[];
  for(const [id,entry] of Object.entries(TRADE_CATALOGUE)){
    const item=id as ItemId,definition=ITEM_DEFINITIONS[item];
    if(!entry||!definition||!entry.playerCanBuy||entry.hasQuality||!(entry.baseMarketValue>=1&&entry.baseMarketValue<40))continue;
    if(definition.kind==='weapon'||definition.kind==='apparel'||isEgg(id))continue;
    rows.push({item,value:entry.baseMarketValue});
  }
  const meats=rows.filter(r=>isMeat(r.item)).length,leathers=rows.filter(r=>isLeather(r.item)).length;
  return rows.map(r=>({...r,weight:(isMeat(r.item)?Math.min(5/meats,1):1)*(isLeather(r.item)?Math.min(5/leathers,1):1)}));
}
/** The pod contents drawn from the incident seed: one kind, its stacks. */
export function resourcePodContents305(seed:number):{item:ItemId;stacks:number[]} {
  const state={rng:seed>>>0||1},kinds=resourcePodKinds305();
  const total=kinds.reduce((n,k)=>n+k.weight,0);let ticket=random(state)*total,kind=kinds[kinds.length-1]!;
  for(const k of kinds){ticket-=k.weight;if(ticket<0){kind=k;break;}}
  let budget=150+450*random(state);const stacks:number[]=[],limit=ITEM_DEFINITIONS[kind.item].stackLimit;
  while(budget>kind.value&&stacks.length<7){
    let count=Math.min(20+Math.floor(random(state)*21),limit);
    if(count*kind.value>budget)count=Math.floor(budget/kind.value);
    if(count<=0)break;
    stacks.push(count);budget-=count*kind.value;
    if(budget<=kind.value)break;
  }
  return {item:kind.item,stacks};
}
/** An open, reachable, visible cell where a pod can land. */
export function resourcePodLanding305(world:World,seed:number):Cell|undefined {
  const colonist=world.pawns.find(p=>isColonist(p)&&!p.prisoner&&p.state!=='dead');if(!colonist)return;
  const blocked=blockedCells(world),stand=captureStandability(world),access=candidateAccess(world,colonist,blocked,new Set(),true);
  const built=new Set<number>();for(const s of world.structures)for(const c of footprintCells(s))built.add(c.z*world.width+c.x);
  const cells:Cell[]=[];
  for(let z=1;z<world.height-1;z++)for(let x=1;x<world.width-1;x++){
    const key=z*world.width+x;
    if(!blocked[key]&&!built.has(key)&&stand({x,z})&&!isRoofed(world,key)&&access.has(key)&&!foggedCell256(world,key))cells.push({x,z});
  }
  return cells.length?cells[(seed>>>0)%cells.length]:undefined;
}
const emit=(world:World,message:string)=>{world.events.push({tick:world.tick,type:'need',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);};
export function resolveSelectedResourcePod305(world:World,seed:number):boolean {
  const state=world.miscIncidents;
  if(!state||!isResourcePods305(Number(world.schemaVersion))||state.resourcePod305||!Number.isSafeInteger(world.tick+RESOURCE_POD_FALL_TICKS305+RESOURCE_POD_OPEN_TICKS305))return false;
  const cell=resourcePodLanding305(world,seed);if(!cell)return false;
  state.resourcePod305={start:world.tick,landAt:world.tick+RESOURCE_POD_FALL_TICKS305,openAt:world.tick+RESOURCE_POD_FALL_TICKS305+RESOURCE_POD_OPEN_TICKS305,cell,seed:seed>>>0||1};
  state.resourcePods305=(state.resourcePods305??0)+1;
  emit(world,'Des capsules de fret tombent du ciel : leur cargaison sera récupérable après l’ouverture.');
  return true;
}
/** Opens the pods when due; a cell made unusable keeps the pod closed. */
export function advanceResourcePod305(world:World):void {
  const state=world.miscIncidents,pending=state?.resourcePod305;if(!state||!pending||world.tick<pending.openAt)return;
  if(!canStandAt(world,pending.cell))return;
  const {item,stacks}=resourcePodContents305(pending.seed),made:MaterialPile[]=[];
  const draft:World={...world,piles:[...world.piles]};let nextId=world.nextId;
  const place=(subject:ItemId,quantity:number):boolean=>{
    // One new stack per free floor cell: a cell already holding a stack (this
    // pod's or an older one) is skipped, never given a second stack.
    for(const cell of nearbyGround(draft,pending.cell)){
      if(groundPile(draft,cell))continue;
      const room=Math.min(quantity,groundCapacity(draft,cell,subject));if(room<=0)continue;
      const pile:MaterialPile={id:nextId++,kind:ITEM_DEFINITIONS[subject].kind,item:subject,quantity:room,owner:{type:'ground',x:cell.x,z:cell.z},...freshRot(subject,world.tick)} as MaterialPile;
      draft.piles.push(pile);made.push(pile);quantity-=room;
      if(!quantity)return true;
    }
    return false;
  };
  for(const count of stacks)if(!place(item,count))return;
  if(!place('slag-steel-chunk',1))return;
  if(!Number.isSafeInteger(nextId)||draft.piles.length>32768)return;
  world.piles=draft.piles;world.nextId=nextId;delete state.resourcePod305;refreshStock(world);
  const total=stacks.reduce((n,c)=>n+c,0);
  emit(world,`Les capsules se sont ouvertes : ${total} × ${ITEM_DEFINITIONS[item].label} à récupérer, et une scorie d’acier.`);
}
