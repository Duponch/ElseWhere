import {afterEach,expect,test,vi} from 'vitest';
import {medicalCamp} from './scenarios/health';
import {legacyHumanAge} from '../src/sim/human-age';
import {newCryptosleepHolder271,type PlayerCasket271,type CryptosleepCommand271} from '../src/sim/cryptosleep-state-271';
import {cryptosleepOptions271,appendCryptosleepOptions271} from '../src/ui/cryptosleep-controls-271';
import {cryptosleepInspectionText271} from '../src/ui/cryptosleep-inspection-271';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {researchProjects} from '../src/ui/research-projects';
import {researchLinks} from '../src/ui/research-panel';
import {readResearchReadiness} from '../src/ui/research-readiness';
import {placementMaterial} from '../src/ui/construction-controls';

/** UI contract fixture only: existing adult humans, casket and optional patient
 * are prepared. No entry, research, acquisition or clinical result is claimed. */
function prepared(count=2){
 const w=medicalCamp(count),p=w.pawns[0]!;w.structures=[];w.jobs=[];w.piles=[];w.resources=[];
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));
 for(const q of w.pawns){q.age=legacyHumanAge();Object.assign(q,{state:'idle',path:[],moveCooldown:0,jobId:null,need:null});delete q.motion;delete q.background;delete q.traits;}
 Object.assign(p,{x:11,z:10});
 const c:PlayerCasket271={id:w.nextId++,kind:'cryptosleep-casket',x:10,z:10,orientation:0,footprint:'standard',material:'steel',cryptosleep:newCryptosleepHolder271(w.tick)};
 w.structures.push(c);return {w,p,c};
}

test('context menus read both casket cells and the real patient, preserve originals, and admit queued actions only from 378',()=>{
 const {w,p,c}=prepared(),patient=w.pawns[1]!;Object.assign(patient,{state:'downed',x:14,z:10});const before=structuredClone(w);
 for(const cell of [c,{x:c.x,z:c.z+1}]){
  const options=cryptosleepOptions271(w,p.id,cell);
  expect(options.find(o=>o.command.type==='order-enter-cryptosleep')).toMatchObject({enabled:true,confirmLast:false});
  expect(options.find(o=>o.command.type==='order-carry-cryptosleep')).toMatchObject({enabled:true,command:{patientId:patient.id,casketId:c.id}});
 }
 expect(cryptosleepOptions271(w,p.id,patient).find(o=>o.command.type==='order-carry-cryptosleep')?.enabled).toBe(true);
 expect(cryptosleepOptions271(w,p.id,c,true).filter(o=>o.command.type==='order-enter-cryptosleep'||o.command.type==='order-carry-cryptosleep').map(o=>o.enabled)).toEqual([true,true]);
 const historical={...w,schemaVersion:377 as typeof w.schemaVersion};
 expect(cryptosleepOptions271(historical,p.id,c,true).every(o=>!o.enabled)).toBe(true);
 expect(w).toEqual(before);expect(w.pawns[1]).toBe(patient);expect(c.cryptosleep.human).toBeNull();
 w.pawns.pop();c.cryptosleep.human=patient;
 expect(cryptosleepOptions271(w,p.id,c)).toMatchObject([{enabled:true,command:{type:'order-open-cryptosleep',pawnId:p.id,casketId:c.id}}]);
 p.cryptosleepTask={action:'open',casketId:c.id,phase:'opening',progressCore:150,lastWorkedAt:w.tick};
 expect(cryptosleepInspectionText271(w,c)).toContain(patient.name);expect(cryptosleepInspectionText271(w,c)).toContain('Ouverture : 50 %');
});

class ElementFixture {
 children:ElementFixture[]=[];parent:ElementFixture|undefined;dataset:Record<string,string>={};attributes=new Map<string,string>();events=new Map<string,((e:Event)=>void)[]>();
 className='';type='';textContent='';disabled=false;open=false;isConnected=true;onclick:((event:{shiftKey?:boolean})=>void)|null=null;
 constructor(readonly ownerDocument:Document){}
 append(...nodes:ElementFixture[]){for(const node of nodes){node.parent=this;this.children.push(node);}}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 addEventListener(type:string,callback:(e:Event)=>void){this.events.set(type,[...(this.events.get(type)??[]),callback]);}
 showModal(){this.open=true;}close(){this.open=false;}focus(){}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.isConnected=false;}
 set innerHTML(_value:string){throw Error('Names must use textContent');}
}
afterEach(()=>vi.unstubAllGlobals());
test('last-colonist menu requires a real modal acceptance; cancel never sends and acceptance sends one explicit acknowledgement',()=>{
 const doc={activeElement:null,body:undefined,createElement:(_tag:string)=>new ElementFixture(doc as unknown as Document)} as unknown as Document;
 Object.assign(doc,{body:new ElementFixture(doc)});vi.stubGlobal('HTMLElement',ElementFixture);
 const parent=new ElementFixture(doc),sent:CryptosleepCommand271[]=[],{w,p,c}=prepared(1);p.name='<img src=x onerror=bad>';
 const actions={close:vi.fn(),send:async(command:CryptosleepCommand271)=>{sent.push(command);},report:vi.fn()};
 expect(appendCryptosleepOptions271(parent as unknown as HTMLElement,w,p.id,c,false,actions)).toBe(1);
 const button=parent.children[0]!;button.onclick!({});expect(sent).toEqual([]);
 let dialog=(doc.body as unknown as ElementFixture).children.at(-1)!;expect(dialog.open).toBe(true);expect(dialog.children[1]!.textContent).toContain(p.name);
 dialog.children[2]!.onclick!({});expect(sent).toEqual([]);
 button.onclick!({});dialog=(doc.body as unknown as ElementFixture).children.at(-1)!;dialog.children[3]!.onclick!({});dialog.children[3]!.onclick!({});
 expect(sent).toEqual([{type:'order-enter-cryptosleep',pawnId:p.id,casketId:c.id,confirmLastColonist:true}]);
});

test('architecture and research explain the actual2000-point analyzer requirement with a unique graph position',()=>{
 const {w}=prepared();w.research={project:null,points:0};expect(architectToolAvailable(w,'cryptosleep-casket')).toBe(false);
 w.research.cryptosleep={points:2_000_000_000,completedAt:w.tick};expect(architectToolAvailable(w,'cryptosleep-casket')).toBe(true);
 expect(placementMaterial('cryptosleep-casket','wood')).toBe('steel');
 const project=researchProjects.find(p=>p.id==='cryptosleep')!;expect(project.cost).toBe(2000);expect(project.detail).toContain('bureau avancé');expect(project.detail).toContain('multi-analyseur');
 expect(researchLinks).toContainEqual(['multi-analyzer','cryptosleep']);expect(researchProjects.filter(p=>p.x===project.x&&p.y===project.y)).toHaveLength(1);
 expect(readResearchReadiness(w,'cryptosleep').stationIssue).toBe('advanced-bench');
});
