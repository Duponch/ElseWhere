import type {AreaCommand,Cell,CommandResult,World} from './types.ts';

/** Schema 369: Core RimWorld 1.6 plans (Designator_Plan_Add, Designator_Plan_Remove).
 * Facts only, nothing copied:
 * - 1.6 replaced the Plan designation (DesignationDef Plan is kept for back
 *   compatibility only) by Plan objects held by the map's PlanManager: one
 *   plan per cell (planGrid), each plan with a colour (ColorDef of type
 *   Planning: PlanGray, PlanRed, PlanOrange, PlanYellow, PlanGreen, PlanCyan,
 *   PlanBlue, PlanPurple, PlanPink, alpha 0.4), a label, its cells and a
 *   hidden flag (Plan.ExposeData: ID, label, baseLabel, hidden, color, cells).
 * - A new plan is named "Plan N", N the first of 1..1000 that no plan uses
 *   (PlanManager.NewPlanName), otherwise "Plan X".
 * - Designator_Plan_Add (key Misc9 = I, Orders category, DrawStyleCategory
 *   Plans: filled rectangle by default) uses the colour chosen from the grid
 *   (default: the first Planning colour, gray). CanDesignateCell: in bounds,
 *   not in the 10-cell no-build edge (GenGrid.NoBuildEdgeWidth); no fog or
 *   terrain check. One cell on a plan of the same colour only selects it.
 *   PlanCells: the selected plan (or the one same-colour plan met in the
 *   drag) receives every dragged cell; without one, a new plan starts from
 *   the first cell. Every same-colour plan touching a dragged cell
 *   (cardinal neighbour) merges into it; dragged cells leave other plans.
 *   The plans touched are then split into 4-connected pieces
 *   (Plan.CheckContiguous): each other piece becomes a new plan of the same
 *   colour that copies the label (and is not hidden).
 * - Designator_Plan_Remove (key Misc8 = K) accepts only cells holding a plan,
 *   of any colour, removes them and splits the plans touched the same way.
 *   An emptied plan is deregistered.
 * - A selected plan (selectable after things and zones, Selector) shows its
 *   size and the total planning area, and the gizmos hide (Misc2), expand and
 *   shrink (Misc6), change colour, delete (the deconstruct key), copy.
 * - Plans are drawn on the MetaOverlays layer (SectionLayer_Plans), above
 *   fog and buildings, unless hidden; nothing in the simulation reads them:
 *   no job, no path cost, no building rule. Designator_Cancel ignores them.
 * Adaptations (see docs/gameplay/plans-v369.md): no 10-cell edge (Elsewhere
 * allows building there), the piece that keeps a split plan's identity is the
 * one holding its lowest cell index (Core: the first cell of a shuffled
 * list), labels are not renamable (only their number is kept). */
export const PLANS_SCHEMA_369=369;
export const isPlans369=(version:unknown):boolean=>Number(version)>=PLANS_SCHEMA_369;
/** ColorDefs.xml, Planning colours, in their def order (Designator_Plan_Add.Colors). */
export const PLAN_COLORS_369=['gray','red','orange','yellow','green','cyan','blue','purple','pink'] as const;
export type PlanColor369=typeof PLAN_COLORS_369[number];
export const PLAN_COLOR_DEFS_369:Readonly<Record<PlanColor369,{readonly label:string;readonly rgba:readonly [number,number,number,number]}>>=Object.freeze({
 gray:{label:'Gris',rgba:[.68,.68,.68,.4]},red:{label:'Rouge',rgba:[.9,.4,.4,.4]},orange:{label:'Orange',rgba:[.9,.7,.4,.4]},
 yellow:{label:'Jaune',rgba:[.9,.9,.4,.4]},green:{label:'Vert',rgba:[.4,.9,.4,.4]},cyan:{label:'Cyan',rgba:[.4,.9,.9,.4]},
 blue:{label:'Bleu',rgba:[.2,.4,.9,.4]},purple:{label:'Violet',rgba:[.6,.2,.9,.4]},pink:{label:'Rose',rgba:[.9,.4,.9,.4]},
});
/** Designator_Plan_Add: Colors.FirstOrDefault(). */
export const DEFAULT_PLAN_COLOR_369:PlanColor369='gray';
/** Alpha of the plan overlay (every Planning ColorDef). */
export const PLAN_OVERLAY_ALPHA_369=.4;
/** PlanManager.NewPlanName tries 1..1000. */
export const MAX_PLAN_NUMBER_369=1000;
export const isPlanColor369=(v:unknown):v is PlanColor369=>typeof v==='string'&&(PLAN_COLORS_369 as readonly string[]).includes(v);
export const planColorHex369=(color:PlanColor369):number=>{const [r,g,b]=PLAN_COLOR_DEFS_369[color].rgba;return (Math.round(r*255)<<16)|(Math.round(g*255)<<8)|Math.round(b*255);};

/** One plan. `n` is the number of its label ("Plan n", 0 is "Plan X");
 * cells are map indices, strictly ascending and 4-connected. */
export interface Plan369 {id:number;n:number;color:PlanColor369;cells:number[];hidden?:true}
/** The map's plans, in registration order (ids ascending); absent when none. */
export interface PlanState369 {nextId:number;plans:Plan369[]}
export type PlanCommand369=
 |{type:'plan-369';action:'delete';planId:number}
 |{type:'plan-369';action:'color';planId:number;color:PlanColor369}
 |{type:'plan-369';action:'hide';planId:number;hidden:boolean};

export const planLabel369=(plan:Pick<Plan369,'n'>):string=>plan.n>0?`Plan ${plan.n}`:'Plan X';
export const planById369=(w:Pick<World,'plans369'>,id:number):Plan369|undefined=>w.plans369?.plans.find(p=>p.id===id);
/** The plan of a cell (one plan per cell, PlanManager.PlanAt). */
export function planAt369(w:Pick<World,'plans369'|'width'|'height'>,cell:Cell):Plan369|undefined {
 if(!w.plans369||cell.x<0||cell.z<0||cell.x>=w.width||cell.z>=w.height)return undefined;
 const i=cell.z*w.width+cell.x;
 for(const plan of w.plans369.plans)if(hasSorted(plan.cells,i))return plan;
 return undefined;
}
/** Plan.GetInspectString: total planning area of the map. */
export const totalPlanArea369=(w:Pick<World,'plans369'>):number=>(w.plans369?.plans??[]).reduce((sum,p)=>sum+p.cells.length,0);
function hasSorted(cells:readonly number[],i:number):boolean {let lo=0,hi=cells.length;while(lo<hi){const m=(lo+hi)>>>1;if(cells[m]!<i)lo=m+1;else hi=m;}return cells[lo]===i;}

// ---------------------------------------------------------------- validation
const own=(v:unknown,key:string):PropertyDescriptor|undefined=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,key):undefined;
const plain=(v:unknown,keys:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 const present=Reflect.ownKeys(v);
 if(present.some(k=>typeof k!=='string'||!keys.includes(k)&&!optional.includes(k)))return false;
 for(const k of present){const d=own(v,k as string)!;if(!d.enumerable||!Object.hasOwn(d,'value'))return false;}
 return keys.every(k=>Object.hasOwn(v,k));
};
const denseArray=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max
 &&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>{const d=own(v,String(i));return !!d&&d.enumerable&&Object.hasOwn(d,'value');}).every(Boolean);
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function connected(cells:readonly number[],width:number,height:number):boolean {
 const set=new Set(cells),seen=new Set<number>([cells[0]!]),queue=[cells[0]!];
 for(let q=0;q<queue.length;q++)for(const n of neighbours(queue[q]!,width,height))if(set.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}
 return seen.size===set.size;
}
/** The world field: absent below 369 and when the map has no plan; strict. */
export function validatePlans369(w:World,version:number):string[] {
 const d=own(w,'plans369');
 if(!d)return w&&typeof w==='object'&&'plans369'in w?['Malformed plans.']:[];
 if(!isPlans369(version))return ['Plans are not supported before schema 369.'];
 if(!d.enumerable||!Object.hasOwn(d,'value'))return ['Malformed plans.'];
 const state=d.value,size=Number(w.width)*Number(w.height);
 if(!Number.isSafeInteger(size)||size<1||!plain(state,['nextId','plans'])||!int(state.nextId,2,Number.MAX_SAFE_INTEGER)||!denseArray(state.plans,size)||!state.plans.length)return ['Invalid plans.'];
 const used=new Set<number>();let lastId=0;
 for(const plan of state.plans){
  if(!plain(plan,['id','n','color','cells'],['hidden'])||!int(plan.id,lastId+1,state.nextId-1)||!int(plan.n,0,MAX_PLAN_NUMBER_369)||!isPlanColor369(plan.color)
   ||Object.hasOwn(plan,'hidden')&&plan.hidden!==true||!denseArray(plan.cells,size)||!plan.cells.length)return ['Invalid plan.'];
  lastId=plan.id;let previous=-1;
  for(const cell of plan.cells){if(!int(cell,previous+1,size-1)||used.has(cell))return ['Invalid or overlapping plan cells.'];used.add(cell);previous=cell;}
  if(!connected(plan.cells as number[],w.width,w.height))return ['A plan must be one connected piece.'];
 }
 return [];
}

// ---------------------------------------------------------------- operations
function neighbours(i:number,width:number,height:number):number[] {
 const x=i%width,z=Math.floor(i/width),out:number[]=[];
 // GenAdj.CardinalDirections order: north, east, south, west.
 if(z+1<height)out.push(i+width);if(x+1<width)out.push(i+1);if(z>0)out.push(i-width);if(x>0)out.push(i-1);
 return out;
}
interface Draft {id:number;n:number;color:PlanColor369;cells:Set<number>;hidden?:true}
/** One transaction on a map's plans (PlanManager + Plan), written back once. */
class PlanEdit {
 readonly plans:Draft[];readonly grid=new Map<number,Draft>();nextId:number;
 constructor(readonly width:number,readonly height:number,state:PlanState369|undefined){
  this.nextId=state?.nextId??1;
  this.plans=(state?.plans??[]).map(p=>({id:p.id,n:p.n,color:p.color,cells:new Set(p.cells),...(p.hidden?{hidden:true as const}:{})}));
  for(const p of this.plans)for(const c of p.cells)this.grid.set(c,p);
 }
 private newNumber():number {const used=new Set(this.plans.map(p=>p.n));for(let i=1;i<=MAX_PLAN_NUMBER_369;i++)if(!used.has(i))return i;return 0;}
 create(color:PlanColor369,n=this.newNumber()):Draft {const p:Draft={id:this.nextId++,n,color,cells:new Set()};this.plans.push(p);return p;}
 add(p:Draft,c:number):void {p.cells.add(c);this.grid.set(c,p);}
 remove(p:Draft,c:number):void {p.cells.delete(c);this.grid.delete(c);if(!p.cells.size)this.plans.splice(this.plans.indexOf(p),1);}
 mergeIn(into:Draft,from:Draft):void {for(const c of [...from.cells]){this.remove(from,c);this.add(into,c);}}
 /** Plan.CheckContiguous. */
 checkContiguous(p:Draft):void {
  if(!p.cells.size||!this.plans.includes(p))return;
  const sorted=[...p.cells].sort((a,b)=>a-b),found=new Set<number>([sorted[0]!]),queue=[sorted[0]!];
  for(let q=0;q<queue.length;q++)for(const n of neighbours(queue[q]!,this.width,this.height))if(p.cells.has(n)&&!found.has(n)){found.add(n);queue.push(n);}
  if(found.size>=p.cells.size)return;
  for(const start of sorted){
   if(found.has(start))continue;
   const piece=[start];found.add(start);
   for(let q=0;q<piece.length;q++)for(const n of neighbours(piece[q]!,this.width,this.height))if(p.cells.has(n)&&!found.has(n)){found.add(n);piece.push(n);}
   const split=this.create(p.color,p.n);
   for(const c of piece){this.remove(p,c);this.add(split,c);}
  }
 }
 result():PlanState369|undefined {
  if(!this.plans.length)return undefined;
  return {nextId:this.nextId,plans:this.plans.map(p=>({id:p.id,n:p.n,color:p.color,cells:[...p.cells].sort((a,b)=>a-b),...(p.hidden?{hidden:true as const}:{})}))};
 }
}
function commit(w:World,edit:PlanEdit):void {const next=edit.result();if(next)w.plans369=next;else delete w.plans369;}

/** Designator_Plan_Add.PlanCells (and its one-cell selection). Returns the
 * plan the designator now holds (Core selects it). */
export function addPlanCells369(w:World,cells:readonly number[],color:PlanColor369,selectedId?:number):{planId:number;affected:number} {
 const edit=new PlanEdit(w.width,w.height,w.plans369);
 let selected=selectedId===undefined?undefined:edit.plans.find(p=>p.id===selectedId&&p.color===color);
 if(cells.length===1){const here=edit.grid.get(cells[0]!);if(here&&here.color===color)return {planId:here.id,affected:0};}
 const before=cells.map(c=>edit.grid.get(c));
 if(!selected){
  let found:Draft|undefined,ambiguous=false;
  for(const c of cells){const p=edit.grid.get(c);if(!p||p.color!==color)continue;if(!found)found=p;else if(p!==found){ambiguous=true;break;}}
  selected=ambiguous?undefined:found;
 }
 const modified=new Set<Draft>(),unset=[...cells];
 if(!selected){
  const first=unset.shift()!,previous=edit.grid.get(first);
  if(previous){edit.remove(previous,first);modified.add(previous);}
  selected=edit.create(color);edit.add(selected,first);
 }
 modified.add(selected);
 for(let i=unset.length-1;i>=0;i--){
  const c=unset[i]!;
  for(const n of neighbours(c,w.width,w.height)){const p=edit.grid.get(n);if(p&&p.color===color&&p!==selected)edit.mergeIn(selected,p);}
  const p=edit.grid.get(c);if(p&&p!==selected){edit.remove(p,c);modified.add(p);}
  if(!selected.cells.has(c))edit.add(selected,c);
 }
 for(const p of modified)edit.checkContiguous(p);
 const affected=cells.reduce((sum,c,i)=>sum+Number(before[i]!==edit.grid.get(c)||before[i]!.color!==color),0);
 commit(w,edit);
 return {planId:selected.id,affected};
}
/** Designator_Plan_Remove: the cells leave their plans, which are then split. */
export function removePlanCells369(w:World,cells:readonly number[]):number {
 const edit=new PlanEdit(w.width,w.height,w.plans369),touched=new Set<Draft>();let removed=0;
 for(const c of cells){const p=edit.grid.get(c);if(!p)continue;edit.remove(p,c);touched.add(p);removed++;}
 for(const p of touched)edit.checkContiguous(p);
 commit(w,edit);return removed;
}

// ---------------------------------------------------------------- commands
const refusedOld={ok:false as const,code:'invalid-command' as const,reason:'Les plans n’existent pas dans cette partie historique.'};
const rect=(c:AreaCommand)=>({minX:Math.min(c.from.x,c.to.x),maxX:Math.max(c.from.x,c.to.x),minZ:Math.min(c.from.z,c.to.z),maxZ:Math.max(c.from.z,c.to.z)});
/** The rectangle of the plan tools: every cell for Planifier, the planned
 * cells for Retirer le plan (CanDesignateCell of each designator). */
export function queryPlanArea369(w:World,command:AreaCommand):{ok:false;reason:string;code:CommandResult['code']}|{ok:true;bounds:{minX:number;maxX:number;minZ:number;maxZ:number};cells:number[];selected:number;skipped:number} {
 if(!isPlans369(w.schemaVersion))return refusedOld;
 const add=command.action==='plan';
 if(add?command.planColor369!==undefined&&!isPlanColor369(command.planColor369)||command.targetPlanId369!==undefined&&!int(command.targetPlanId369,1,Number.MAX_SAFE_INTEGER)
  :command.planColor369!==undefined||command.targetPlanId369!==undefined)return {ok:false,code:'invalid-command',reason:'Couleur ou plan invalide.'};
 const inside=(c:unknown):c is Cell=>!!c&&typeof c==='object'&&int((c as Cell).x,0,w.width-1)&&int((c as Cell).z,0,w.height-1);
 if(!inside(command.from)||!inside(command.to))return {ok:false,code:'out-of-bounds',reason:'Rectangle hors de la carte.'};
 const bounds=rect(command),cells:number[]=[],planned=add?undefined:new Set((w.plans369?.plans??[]).flatMap(p=>p.cells));
 for(let z=bounds.minZ;z<=bounds.maxZ;z++)for(let x=bounds.minX;x<=bounds.maxX;x++){const i=z*w.width+x;if(add||planned!.has(i))cells.push(i);}
 const selected=(bounds.maxX-bounds.minX+1)*(bounds.maxZ-bounds.minZ+1);
 return {ok:true,bounds,cells,selected,skipped:selected-cells.length};
}
export function applyPlanArea369(w:World,command:AreaCommand):CommandResult&{planId369?:number} {
 const q=queryPlanArea369(w,command);if(!q.ok)return q;
 if(!q.cells.length)return {ok:false,code:'missing-target',reason:'Aucune case compatible dans ce rectangle.'};
 if(command.action==='remove-plan')return {ok:true,affected:removePlanCells369(w,q.cells),skipped:q.skipped};
 const r=addPlanCells369(w,q.cells,command.planColor369??DEFAULT_PLAN_COLOR_369,command.targetPlanId369);
 return {ok:true,affected:r.affected,skipped:q.skipped,planId369:r.planId};
}
export const isPlanCommand369=(c:unknown):c is PlanCommand369=>!!c&&typeof c==='object'&&(c as {type?:unknown}).type==='plan-369';
/** The plan gizmos: delete, change colour (then CheckContiguous), hide. */
export function applyPlanCommand369(w:World,c:PlanCommand369):CommandResult {
 if(!isPlans369(w.schemaVersion))return refusedOld;
 const shape=c.action==='delete'?plain(c,['type','action','planId']):c.action==='color'?plain(c,['type','action','planId','color'])&&isPlanColor369(c.color)
  :c.action==='hide'?plain(c,['type','action','planId','hidden'])&&typeof c.hidden==='boolean':false;
 if(!shape)return {ok:false,code:'invalid-command',reason:'Commande de plan invalide.'};
 const edit=new PlanEdit(w.width,w.height,w.plans369),plan=edit.plans.find(p=>p.id===c.planId);
 if(!plan)return {ok:false,code:'missing-target',reason:'Ce plan n’existe plus.'};
 if(c.action==='delete'){for(const cell of [...plan.cells])edit.remove(plan,cell);}
 else if(c.action==='color'){plan.color=c.color;edit.checkContiguous(plan);}
 else if(c.hidden)plan.hidden=true;else delete plan.hidden;
 commit(w,edit);return {ok:true};
}
