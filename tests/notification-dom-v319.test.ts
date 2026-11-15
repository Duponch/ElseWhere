import {afterEach,expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import {createMedicalRecord} from '../src/sim/injury-state';
import {createStatusAlerts} from '../src/ui/status-alerts';
import {createRaidUI} from '../src/ui/raids';
import {createHeatwaveUI} from '../src/ui/heatwave';
import {actorNotificationTarget} from '../src/ui/notification-focus';

/** DOM contract double only; camera positions and native event delivery belong
 * to the composed native UI pilot run by ROOT. */
class NodeFixture {
  children:NodeFixture[]=[];parentElement:NodeFixture|null=null;dataset:Record<string,string>={};attributes=new Map<string,string>();style:Record<string,string>={};
  id='';className='';title='';type='';hidden=false;disabled=false;tabIndex=-1;open=false;textWrites=0;onclick:(()=>void)|null=null;onkeydown:((e:{key:string;preventDefault:()=>void;stopPropagation:()=>void})=>void)|null=null;private text='';
  set textContent(text:string){this.text=text;this.children=[];this.textWrites++;}get textContent():string{return this.text+this.children.map(child=>child.textContent).join(' ');}
  set innerHTML(_text:string){throw Error('Save strings must remain literal.');}
  append(...nodes:NodeFixture[]){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  prepend(node:NodeFixture){node.remove();node.parentElement=this;this.children.unshift(node);}
  insertBefore(node:NodeFixture,before:NodeFixture|null){node.remove();node.parentElement=this;if(!before)this.children.push(node);else this.children.splice(this.children.indexOf(before),0,node);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  setAttribute(key:string,value:string){this.attributes.set(key,value);}showModal(){this.open=true;}close(){this.open=false;}
  find(id:string):NodeFixture|undefined {if(this.id===id)return this;for(const child of this.children){const found=child.find(id);if(found)return found;}}
}
function documentFixture(){
  const body=new NodeFixture(),alerts=new NodeFixture(),enable=new NodeFixture();alerts.id='alerts';enable.id='enable-raids';body.append(alerts,enable);
  vi.stubGlobal('document',{body,createElement:()=>new NodeFixture(),getElementById:(id:string)=>body.find(id)??null});return {body,alerts};
}
afterEach(()=>vi.unstubAllGlobals());

test('V379 an off-map alert calls navigation with the latest real-ID metadata, never local focus before switching',()=>{
  documentFixture();const host=new NodeFixture(),focus=vi.fn(),context=vi.fn(),campaign=vi.fn(),ui=createStatusAlerts(host as unknown as HTMLElement,{},{focus,context,campaign});
  // DOM contract double only. Real admission/ID/transport/epoch assertions
  // belong to secondary-incidents-v379; no absent actor is simulated here.
  const w=createWorld(379,32,32);w.campaignMap={active:'home',secondaryTile:52,createdAt:0,visitIds:[],incidents:[{site:'secondary',kind:'raid',count:1,actorId:379}]};
  ui.update(w);const node=host.children.find(n=>n.dataset.alert==='campaign:secondary:raid:379')!;
  node.onclick!();expect(campaign).toHaveBeenLastCalledWith({site:'secondary',actorId:379});expect(focus).not.toHaveBeenCalled();
  w.campaignMap.incidents![0]={site:'secondary',kind:'raid',count:2,actorId:379};ui.update(w);
  expect(host.children.find(n=>n.dataset.alert==='campaign:secondary:raid:379')).toBe(node);
  w.campaignMap.incidents![0]={site:'secondary',kind:'raid',count:2,actorId:380};ui.update(w);
  const replacement=host.children.find(n=>n.dataset.alert==='campaign:secondary:raid:380')!;expect(replacement).not.toBe(node);
  const event={key:'Enter',preventDefault:vi.fn(),stopPropagation:vi.fn()};replacement.onkeydown!(event);
  expect(campaign).toHaveBeenLastCalledWith({site:'secondary',actorId:380});expect(focus).not.toHaveBeenCalled();expect(event.preventDefault).toHaveBeenCalledOnce();
  w.campaignMap.incidents=[];ui.update(w);expect(host.children.some(n=>n.dataset.alert.startsWith('campaign:secondary:raid:'))).toBe(false);
});

test('V319 status nodes retain keyboard identity, count changes and per-key ring while refreshing their actual target data',()=>{
  documentFixture();const host=new NodeFixture(),focus=vi.fn(),context=vi.fn(),tab=vi.fn(),ui=createStatusAlerts(host as unknown as HTMLElement,{},{focus,context,tab});
  // Alerts lot A moved hypothermia to Core's serious threshold; malnutrition
  // keeps the same counted, health-tab row shape for this DOM identity contract.
  const w=createWorld(319,32,32),[a,b,c]=w.pawns;for(const p of [a!,b!]){p.health=createMedicalRecord(w.tick);p.health.malnutrition=1;}
  ui.update(w);const node=host.children.find(n=>n.dataset.alert==='malnutrition')!;expect(node.tabIndex).toBe(0);expect(node.attributes.get('role')).toBe('button');node.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(a!.id));expect(tab).toHaveBeenLastCalledWith('health');
  const writes=node.textWrites,click=node.onclick;ui.update(structuredClone(w));expect(node.textWrites).toBe(writes);expect(node.onclick).toBe(click);
  const copy=structuredClone(w);copy.pawns[0]!.health!.malnutrition=0;copy.pawns[2]!.health=createMedicalRecord(copy.tick);copy.pawns[2]!.health!.malnutrition=1;ui.update(copy);
  expect(host.children.find(n=>n.dataset.alert==='malnutrition')).toBe(node);expect(node.textContent).toBe('2 colon(s) en malnutrition');
  const event={key:'Enter',preventDefault:vi.fn(),stopPropagation:vi.fn()};node.onkeydown!(event);expect(event.preventDefault).toHaveBeenCalledOnce();expect(event.stopPropagation).toHaveBeenCalledOnce();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(b!.id));
  node.onkeydown!({...event,key:' '});expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(c!.id));expect(context).not.toHaveBeenCalled();
});
test('V319 notifications without entities open their explicit context and never emit commands or silent focus',()=>{
  documentFixture();const host=new NodeFixture(),focus=vi.fn(),context=vi.fn(),ui=createStatusAlerts(host as unknown as HTMLElement,{},{focus,context}),w=createWorld(319,32,32);w.stockpiles=[];w.structures=[];w.piles=[];
  const before=JSON.stringify(w);ui.update(w);host.children.find(n=>n.dataset.alert==='beds')!.onclick!();expect(context).toHaveBeenLastCalledWith({panel:'architect',category:'furniture'});
  host.children.find(n=>n.dataset.alert==='no-stockpile')!.onclick!();expect(context).toHaveBeenLastCalledWith({panel:'architect',tool:'stockpile'});expect(focus).not.toHaveBeenCalled();expect(JSON.stringify(w)).toBe(before);
});
test('V319 completed raid primary click locates downed actors without a modal, details preserve information and modal locate cycles',()=>{
  const {body,alerts}=documentFixture(),focus=vi.fn(),send=vi.fn(),ui=createRaidUI(send,focus),w=createWorld(319,32,32),[a,b]=w.pawns;
  for(const p of [a!,b!]){p.state='downed';p.raid={group:7,exiting:false,goal:null};}
  w.raids={profile:'camp-raids-v1',rng:1,nextCheck:100,serial:7,completed:1,departed:[],last:{id:7,tick:w.tick,reason:'defended',killed:0,downed:2,escaped:0}};
  ui.update(w);const letter=alerts.find('raid-letter')!,dialog=body.find('raid-dialog')!,details=alerts.find('raid-details')!,locate=body.find('locate-raid')!;
  expect(letter.textContent).toBe('Assaut terminé');letter.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(a!.id));expect(dialog.open).toBe(false);
  ui.update(structuredClone(w));expect(alerts.find('raid-letter')).toBe(letter);letter.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(b!.id));expect(dialog.open).toBe(false);
  details.onclick!();expect(dialog.open).toBe(true);locate.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(a!.id));expect(dialog.open).toBe(false);expect(send).not.toHaveBeenCalled();
});
test('V319 completed raid with no present actor opens its result instead of using a past group',()=>{
  const {body,alerts}=documentFixture(),focus=vi.fn(),ui=createRaidUI(vi.fn(),focus),w=createWorld(319,32,32);w.pawns[0]!.raid={group:6,exiting:false,goal:null};
  w.raids={profile:'camp-raids-v1',rng:1,nextCheck:100,serial:7,completed:1,departed:[],last:{id:7,tick:w.tick,reason:'withdrawn',killed:0,downed:0,escaped:1}};
  ui.update(w);expect(alerts.find('raid-details')!.hidden).toBe(true);expect(body.find('locate-raid')!.hidden).toBe(true);alerts.find('raid-letter')!.onclick!();expect(body.find('raid-dialog')!.open).toBe(true);expect(focus).not.toHaveBeenCalled();
});
test('V319 heatstroke primary click cycles affected patients, information is independent, and absence removes the full control',()=>{
  const {body,alerts}=documentFixture(),enable=new NodeFixture();enable.id='enable-heatwaves';body.append(enable);const focus=vi.fn(),ui=createHeatwaveUI(vi.fn(),focus),w=createWorld(319,32,32),[a,b]=w.pawns;
  for(const p of [a!,b!]){p.health=createMedicalRecord(w.tick);p.health.heatstroke=40000000;}
  ui.update(w);const letter=alerts.find('heatwave-letter')!;letter.onclick!();letter.onclick!();expect(focus.mock.calls.map(call=>call[0])).toEqual([actorNotificationTarget(a!.id),actorNotificationTarget(b!.id)]);expect(body.find('heatwave-dialog')!.open).toBe(false);
  alerts.find('heatwave-details')!.onclick!();expect(body.find('heatwave-dialog')!.open).toBe(true);for(const p of w.pawns)delete p.health?.heatstroke;ui.update(w);expect(alerts.find('heatwave-letter')).toBeUndefined();expect(alerts.find('heatwave-details')).toBeUndefined();expect(body.find('heatwave-dialog')!.open).toBe(false);
});
