import {ownedNavigationSource379,navigationBaseAncestor379} from './owned-navigation-grid-379.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';

const SIDE=8,CELLS=64;
interface Page {readonly labels:Uint8Array;readonly count:number;readonly edges:(Int32Array|undefined)[]}
interface Directory {readonly width:number;readonly height:number;readonly across:number;readonly down:number;readonly grid:Uint8Array;readonly pages:(Page|undefined)[]}
const directories=new WeakMap<Uint8Array,Directory>();
const work={decisions:0,basePages:0,baseCells:0,baseTransitions:0,retainedPages:0,overridePages:0,overrideCells:0,expandedRegions:0,queries:0};
export const candidatePageWork379=()=>({...work});
export interface CandidatePageConnectivity379 {has(target:number):boolean;readonly expandedRegions:number}

function buildPage(directory:Directory,pageId:number,grid:Uint8Array,override:boolean):Page {
 const {width,height,across}=directory,x0=pageId%across*SIDE,z0=Math.floor(pageId/across)*SIDE,nx=Math.min(SIDE,width-x0),nz=Math.min(SIDE,height-z0);
 const labels=new Uint8Array(CELLS),stack=new Uint8Array(CELLS);let count=0;
 // Labels describe only cardinal connectivity inside this page. Diagonal
 // costs, movement parents and region traversal quotas never use these IDs.
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const root=z*SIDE+x;if(labels[root]||grid[(z0+z)*width+x0+x])continue;
  const label=++count;let top=0;labels[root]=label;stack[top++]=root;
  while(top){const i=stack[--top]!,cx=i&7,cz=i>>>3;
   if(cz>0){const n=i-SIDE;if(!labels[n]&&!grid[(z0+cz-1)*width+x0+cx]){labels[n]=label;stack[top++]=n;}}
   if(cx+1<nx){const n=i+1;if(!labels[n]&&!grid[(z0+cz)*width+x0+cx+1]){labels[n]=label;stack[top++]=n;}}
   if(cz+1<nz){const n=i+SIDE;if(!labels[n]&&!grid[(z0+cz+1)*width+x0+cx]){labels[n]=label;stack[top++]=n;}}
   if(cx>0){const n=i-1;if(!labels[n]&&!grid[(z0+cz)*width+x0+cx-1]){labels[n]=label;stack[top++]=n;}}
  }
 }
 if(override){work.overridePages++;work.overrideCells+=nx*nz;}else{work.basePages++;work.baseCells+=nx*nz;}
 return {labels,count,edges:new Array(count)};
}
const basePage=(directory:Directory,pageId:number):Page=>directory.pages[pageId]??=buildPage(directory,pageId,directory.grid,false);

/** Outgoing page portals, in ascending original cell/label order. Adjacent
 * unaffected pages retain this list across actors; only a page touching an
 * actual override needs query-specific links. */
function links(directory:Directory,pageId:number,label:number,page:(id:number)=>Page):Int32Array {
 const {width,height,across}=directory,labels=page(pageId).labels,px=pageId%across,pz=Math.floor(pageId/across),x0=px*SIDE,z0=pz*SIDE,out:number[]=[];
 const add=(id:number,slot:number)=>{const next=page(id).labels[slot]!;if(next){const node=id*CELLS+next;if(!out.includes(node))out.push(node);}};
 for(let slot=0;slot<CELLS;slot++)if(labels[slot]===label){const x=slot&7,z=slot>>>3;
  if(z===0&&z0>0)add(pageId-across,(SIDE-1)*SIDE+x);
  if(x===SIDE-1&&x0+SIDE<width)add(pageId+1,z*SIDE);
  if(z===SIDE-1&&z0+SIDE<height)add(pageId+across,x);
  if(x===0&&x0>0)add(pageId-1,z*SIDE+SIDE-1);
 }
 return Int32Array.from(out.sort((a,b)=>a-b));
}

/** A work-planner existence reader after its small ordinary flood was
 * insufficient. Its actual producer grid names every sparse override of an
 * immutable base. Base page labels/portals are resident and lazy; actor/door
 * edits rebuild only their own pages and adjoining portal lists. */
export function candidatePageConnectivity379(grid:Uint8Array,width:number,height:number,origin:number,queue:Int32Array):CandidatePageConnectivity379|undefined {
 const source=ownedNavigationSource379(grid,width,height),size=width*height;
 if(!source||!Number.isInteger(origin)||origin<0||origin>=size||queue.length<size)return;
 let directory=directories.get(source.base);
 if(!directory||directory.width!==width||directory.height!==height){
  const across=Math.ceil(width/SIDE),down=Math.ceil(height/SIDE),ancestor=navigationBaseAncestor379(source.base),prior=ancestor?directories.get(ancestor.before):undefined;
  let pages:(Page|undefined)[]=new Array(across*down);
  if(prior&&prior.width===width&&prior.height===height&&ancestor){
   pages=prior.pages.slice();const changed=new Set<number>(),adjacent=new Set<number>();
   for(const cell of ancestor.changed)changed.add(Math.floor(cell/width/SIDE)*across+Math.floor(cell%width/SIDE));
   for(const id of changed){const px=id%across,pz=Math.floor(id/across);if(px>0)adjacent.add(id-1);if(px+1<across)adjacent.add(id+1);if(pz>0)adjacent.add(id-across);if(pz+1<down)adjacent.add(id+across);pages[id]=undefined;}
   // The labels of a neighbouring unchanged page remain valid, but an
   // outgoing portal may now end in a different label on the edited page.
   for(const id of adjacent){const p=pages[id];if(p)pages[id]={labels:p.labels,count:p.count,edges:new Array(p.count)};}
   work.baseTransitions++;for(const p of pages)if(p)work.retainedPages++;
  }
  directory={width,height,across,down,grid:source.base,pages};directories.set(source.base,directory);
 }
 const map=directory,changed=new Set<number>(),affected=new Set<number>(),overrides=new Map<number,Page>();
 const pageOf=(cell:number)=>Math.floor(cell/width/SIDE)*map.across+Math.floor(cell%width/SIDE);
 for(const cell of source.changed)changed.add(pageOf(cell));
 for(const id of changed){affected.add(id);const px=id%map.across,pz=Math.floor(id/map.across);if(pz>0)affected.add(id-map.across);if(px+1<map.across)affected.add(id+1);if(pz+1<map.down)affected.add(id+map.across);if(px>0)affected.add(id-1);}
 const page=(id:number):Page=>{if(!changed.has(id))return basePage(map,id);let result=overrides.get(id);if(!result){result=buildPage(map,id,grid,true);overrides.set(id,result);}return result;};
 const queryLinks=new Map<number,Int32Array>(),seen=new Uint32Array(map.pages.length);let head=0,tail=0,expanded=0;
 const enqueue=(node:number)=>{const id=Math.floor(node/CELLS),bit=1<<((node&63)-1);if(!(seen[id]!&bit)){seen[id]=seen[id]!|bit;queue[tail++]=node;}};
 const nodeAt=(cell:number):number=>{const id=pageOf(cell),x=cell%width,z=Math.floor(cell/width),label=page(id).labels[(z&7)*SIDE+(x&7)]!;return label?id*CELLS+label:-1;};
 const seed=(cell:number)=>{const node=nodeAt(cell);if(node>=0)enqueue(node);};
 // A blocked origin still discovers its four free neighbours in the original
 // flood. Seeding every such component preserves that exact union, without
 // turning the origin into a traversable cell for other queries.
 if(!grid[origin])seed(origin);else{const x=origin%width;if(origin>=width)seed(origin-width);if(x+1<width)seed(origin+1);if(origin+width<size)seed(origin+width);if(x>0)seed(origin-1);}
 let oracle:Uint8Array|undefined;
 const verify=(target:number,result:boolean):boolean=>{
  if(verifyTerrainWriteCaches){if(!oracle){oracle=new Uint8Array(size);const pending=new Int32Array(size);let begin=0,end=1;pending[0]=origin;oracle[origin]=1;const add=(i:number)=>{if(!grid[i]&&!oracle![i]){oracle![i]=1;pending[end++]=i;}};while(begin<end){const i=pending[begin++]!,x=i%width;if(i>=width)add(i-width);if(x+1<width)add(i+1);if(i+width<size)add(i+width);if(x>0)add(i-1);}}if(result!==(oracle[target]===1))throw Error('Candidate page graph differs from the original cardinal flood');}return result;
 };
 work.decisions++;
 return {get expandedRegions(){return expanded;},has(target){
  work.queries++;if(!Number.isInteger(target)||target<0||target>=size)return false;if(target===origin)return verify(target,true);if(grid[target])return verify(target,false);
  const targetNode=nodeAt(target),id=Math.floor(targetNode/CELLS),bit=1<<((targetNode&63)-1);
  while(head<tail&&!(seen[id]!&bit)){
   const node=queue[head++]!,pageId=Math.floor(node/CELLS),label=node&63;let adjacent:Int32Array|undefined;
   if(affected.has(pageId)){adjacent=queryLinks.get(node);if(!adjacent){adjacent=links(map,pageId,label,page);queryLinks.set(node,adjacent);}}
   else{const row=basePage(map,pageId);adjacent=row.edges[label-1]??=links(map,pageId,label,id=>basePage(map,id));}
   for(const next of adjacent)enqueue(next);expanded++;work.expandedRegions++;
  }
  return verify(target,!!(seen[id]!&bit));
 }};
}
