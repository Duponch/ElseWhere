import {afterEach,expect,test,vi} from 'vitest';
const authority=vi.hoisted(()=>({reason:vi.fn<(...args:unknown[])=>string|undefined>(()=>undefined)}));
vi.mock('../src/sim/firefoam-manual-290',()=>({queryFirefoamUseReason290:authority.reason}));
import {firefoamControls290,updateFirefoamControls290,appendFirefoamOptions290} from '../src/ui/firefoam-controls-290';
import {firefoamParts290} from '../src/render/firefoam-parts-290';
import {modelIconUrl} from '../src/ui/pictograms';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {readProjectProgress,researchCost,researchUnlocked} from '../src/sim/research';
import {constructionRecipe,validConstructionMaterial,constructionSkillRequired} from '../src/sim/construction-materials';
import type {Command,Structure,World} from '../src/sim/types';

/** Minimal literal DOM port: actual pointer layout is a separate muted native
 * qualification, while these checks cover commands and confirmed publications. */
class Node469 {
 children:(Node469|string)[]=[];dataset:Record<string,string>={};attributes=new Map<string,string>();checked=false;disabled=false;hidden=false;type='';className='';text='';
 onclick:((event:{shiftKey:boolean})=>void)|null=null;onchange:(()=>void)|null=null;
 constructor(readonly tag:string){}
 get ownerDocument(){return document;}
 set textContent(value:string){this.text=value;this.children=[];}
 get textContent():string{return this.text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
 append(...children:(Node469|string)[]){this.children.push(...children);}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 querySelectorAll<T=Node469>(selector:string):T[]{
  const match=/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector),key=match?.[1]?.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase());
  return this.children.flatMap(c=>typeof c==='string'?[]:[...(key&&Object.hasOwn(c.dataset,key)&&(match![2]===undefined||c.dataset[key]===match![2])?[c]:[]),...c.querySelectorAll<Node469>(selector)]) as unknown as T[];
 }
 querySelector(selector:string){return this.querySelectorAll<Node469>(selector)[0];}
 click(shiftKey=false){if(!this.disabled)this.onclick?.({shiftKey});}
}
afterEach(()=>{vi.unstubAllGlobals();authority.reason.mockReset();authority.reason.mockReturnValue(undefined);});
const settled=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(response?:(command:Command)=>unknown){
 vi.stubGlobal('document',{createElement:(tag:string)=>new Node469(tag)});
 const structure:Structure={id:12,kind:'firefoam-popper',x:9,z:11,orientation:0,footprint:'standard',material:'steel',firefoam290:{autoRebuild:false}};
 const world={schemaVersion:290,tick:2000,width:32,height:32,structures:[structure],research:{project:null,points:0,firefoam:{points:600_000_000,completedAt:1999}}} as unknown as World;
 const sent:Command[]=[],section=firefoamControls290(world,structure,c=>{sent.push(c);return response?.(c);}) as unknown as Node469,host=new Node469('host');host.append(section);
 const input=section.querySelector('[data-firefoam-auto-rebuild]')!,status=section.querySelector('[data-firefoam-status]')!,state=section.querySelector('[data-firefoam-state]')!;
 const refresh=(w:World=world,s:Structure|undefined=structure)=>updateFirefoamControls290(host as unknown as ParentNode,w,s);
 return {structure,world,sent,section,host,input,status,state,refresh};
}

test('installed current controls are pure and historical/future or removed devices hide',()=>{
 const f=fixture(),before=JSON.stringify(f.world);expect(f.section.hidden).toBe(false);expect(f.state.textContent).toContain('Prêt');
 for(let i=0;i<10;i++)f.refresh();expect(JSON.stringify(f.world)).toBe(before);expect(f.sent).toEqual([]);
 for(const schemaVersion of [289,288,292]){f.refresh({...f.world,schemaVersion} as World);expect(f.section.hidden).toBe(true);}
 f.refresh();expect(f.section.hidden).toBe(false);f.refresh({...f.world,structures:[]});expect(f.section.hidden).toBe(true);
});

test('automatic replacement sends only the independent command and waits for a confirmed state',async()=>{
 let resolve!:()=>void;const pending=new Promise<void>(yes=>{resolve=yes;}),f=fixture(()=>pending),before=JSON.stringify(f.structure);
 f.input.checked=true;f.input.onchange?.();expect(f.sent).toEqual([{type:'firefoam-auto-rebuild',structureId:12,on:true}]);expect(JSON.stringify(f.structure)).toBe(before);expect(f.input.disabled).toBe(true);
 f.refresh();resolve();await settled();expect(f.status.textContent).toContain('attente');expect(f.input.disabled).toBe(true);
 f.structure.firefoam290!.autoRebuild=true;f.refresh();expect(f.input.disabled).toBe(false);expect(f.input.checked).toBe(true);expect(f.status.textContent).toContain('confirmée');
});

test('rejection restores the confirmed option and preserves the existing wick',async()=>{
 const f=fixture(()=>Promise.reject(Error('Appareil retiré.')));f.structure.firefoam290!.wick={startedAtCore:20000,endCore:20145};const before=JSON.stringify(f.structure);
 f.input.checked=true;f.input.onchange?.();await settled();expect(f.input.checked).toBe(false);expect(f.input.disabled).toBe(false);expect(f.status.textContent).toBe('Appareil retiré.');expect(JSON.stringify(f.structure)).toBe(before);
});

test('a confirmed wick updates the readout from the simulation clock without arming anything',()=>{
 const f=fixture();f.structure.firefoam290!.wick={startedAtCore:20000,endCore:20145};const before=JSON.stringify(f.structure);f.refresh();expect(f.state.textContent).toContain('2.4 s');
 f.refresh({...f.world,tick:2005});expect(f.state.textContent).toContain('1.6 s');expect(JSON.stringify(f.structure)).toBe(before);expect(f.sent).toEqual([]);
});

test('manual menu uses the shared pure authority and sends an actual direct order',async()=>{
 const f=fixture(),menu=new Node469('menu'),send=vi.fn(async(_c:unknown)=>{}),close=vi.fn(),report=vi.fn(),before=JSON.stringify(f.world);
 expect(appendFirefoamOptions290(menu as unknown as HTMLElement,f.world,3,{x:9,z:11},false,{send,close,report})).toBe(1);
 expect(authority.reason).toHaveBeenCalledWith(f.world,3,12);const button=menu.querySelector('[data-order-firefoam]')!;expect(button.disabled).toBe(false);button.click();await settled();
 expect(send).toHaveBeenCalledWith({type:'firefoam-trigger',pawnId:3,structureId:12});expect(close).toHaveBeenCalledOnce();expect(JSON.stringify(f.world)).toBe(before);
});

test('manual refusal and queue prevent sending, including a later shift click',()=>{
 const f=fixture(),send=vi.fn(async(_c:unknown)=>{}),close=vi.fn(),report=vi.fn(),actions={send,close,report};authority.reason.mockReturnValue('Colon mobilisé.');
 const refused=new Node469('menu');appendFirefoamOptions290(refused as unknown as HTMLElement,f.world,3,{x:9,z:11},false,actions);expect(refused.textContent).toContain('Colon mobilisé.');refused.querySelector('[data-order-firefoam]')!.click();expect(send).not.toHaveBeenCalled();
 authority.reason.mockReturnValue(undefined);const queued=new Node469('menu');appendFirefoamOptions290(queued as unknown as HTMLElement,f.world,3,{x:9,z:11},true,actions);expect(queued.querySelector('[data-order-firefoam]')!.disabled).toBe(true);
 const direct=new Node469('menu');appendFirefoamOptions290(direct as unknown as HTMLElement,f.world,3,{x:9,z:11},false,actions);direct.querySelector('[data-order-firefoam]')!.click(true);expect(send).not.toHaveBeenCalled();expect(report).toHaveBeenCalledWith('Déclenchement direct ; relâchez Maj.',true);
});

test('manual options are absent from older or future worlds and unrelated cells',()=>{
 const f=fixture(),menu=new Node469('menu'),actions={send:async()=>{},close(){},report(){}};
 for(const schemaVersion of [289,292])expect(appendFirefoamOptions290(menu as unknown as HTMLElement,{...f.world,schemaVersion} as World,3,{x:9,z:11},false,actions)).toBe(0);
 expect(appendFirefoamOptions290(menu as unknown as HTMLElement,f.world,3,{x:8,z:11},false,actions)).toBe(0);expect(authority.reason).not.toHaveBeenCalled();
});

test('original geometry and pictogram retain physical selection and no external asset',()=>{
 const f=fixture(),before=JSON.stringify(f.world),parts=firefoamParts290(f.world);expect(parts.length).toBeGreaterThan(12);expect(parts.every(p=>p.targetId===12&&p.key===12)).toBe(true);
 expect(parts.every(p=>Math.abs(p.x-9)+(p.sx??0)/2<=.36&&Math.abs(p.z-11)+(p.sz??0)/2<=.36)).toBe(true);expect(JSON.stringify(f.world)).toBe(before);
 expect(modelIconUrl('firefoam-popper')).toBe('/assets/ui/elsewhere/pictograms-20261107/firefoam-popper.svg');
});

test('research projection and construction visibility require the prospective completed research',()=>{
 const f=fixture();delete f.world.research;expect(researchCost('firefoam')).toBe(600_000_000);expect(researchUnlocked(f.world,'firefoam')).toBe(false);expect(architectToolAvailable(f.world,'firefoam-popper')).toBe(false);
 f.world.research={project:null,points:0,firefoam:{points:600_000_000,completedAt:1999}};const before=JSON.stringify(f.world);expect(readProjectProgress(f.world.research,'firefoam')?.completedAt).toBe(1999);expect(architectToolAvailable(f.world,'firefoam-popper')).toBe(true);expect(JSON.stringify(f.world)).toBe(before);
 for(const schemaVersion of [289,292])expect(architectToolAvailable({...f.world,schemaVersion} as World,'firefoam-popper')).toBe(false);
 expect(constructionRecipe(f.structure)).toMatchObject({ingredients:[{item:'steel',quantity:75},{item:'component',quantity:1}],work:150,coreWork:1500});expect(constructionSkillRequired('firefoam-popper')).toBe(5);
 expect(validConstructionMaterial('firefoam-popper','steel',290)).toBe(true);expect(validConstructionMaterial('firefoam-popper','wood',290)).toBe(false);expect(validConstructionMaterial('firefoam-popper','steel',289)).toBe(false);
});
