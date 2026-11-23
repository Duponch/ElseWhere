import {afterEach,expect,test,vi} from 'vitest';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {readAnimalTraining282,nextTrainable282} from '../src/sim/animal-training-282.ts';
import {animalInspectorView,createAnimalInspector,updateAnimalInspector} from '../src/ui/animal-inspector.ts';
import {updateAnimalsPanel} from '../src/ui/animals-panel.ts';
import {animalActivity} from '../src/ui/animal-activity.ts';
import {actionProgress} from '../src/render/action-feedback.ts';
import type {Command,World} from '../src/sim/types.ts';

/** Narrow DOM port, like the neighboring UI tests: there is no JSDOM package.
 * It parses the real authored scaffold, never reproduces its controls or
 * selectors. Saved names still use textContent. Native layout/pointers remain
 * a separate muted browser qualification. */
class UiNode459 {
 children:UiNode459[]=[];parentElement?:UiNode459;dataset:Record<string,string>={};attributes=new Map<string,string>();
 className='';id='';title='';value='';type='';scope='';min='';max='';step='';tabIndex=-1;
 hidden=false;checked=false;disabled=false;private text='';
 onclick:((event:{currentTarget:UiNode459})=>void)|null=null;
 onchange:((event:{currentTarget:UiNode459})=>void)|null=null;
 private listeners=new Map<string,((event:{currentTarget:UiNode459;key?:string;preventDefault():void})=>void)[]>();
 constructor(readonly tag='div'){}
 readonly classList={
  add:(...names:string[])=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' ');},
  remove:(...names:string[])=>{this.className=this.className.split(' ').filter(n=>!names.includes(n)).join(' ');},
  toggle:(name:string,force?:boolean)=>{const enabled=force??!this.className.split(' ').includes(name);if(enabled)this.classList.add(name);else this.classList.remove(name);return enabled;},
 };
 get textContent():string{return this.text+this.children.map(n=>n.textContent).join('');}
 set textContent(value:string){this.text=value;this.children=[];}
 set innerHTML(markup:string){
  this.text='';this.children=[];const stack:UiNode459[]=[this];
  for(const match of markup.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)){
   const token=match[0];if(token.startsWith('</')){stack.pop();continue;}
   if(!token.startsWith('<')){const node=new UiNode459('#text');node.textContent=token;stack.at(-1)!.append(node);continue;}
   const head=/^<([a-z][a-z0-9-]*)\b/i.exec(token)!;const node=new UiNode459(head[1]!.toLowerCase());
   for(const attr of token.slice(head[0].length,-1).matchAll(/([^\s=]+)(?:="([^"]*)")?/g))node.setAttribute(attr[1]!,attr[2]??'');
   stack.at(-1)!.append(node);if(!['input','br','hr','img','meta','link'].includes(node.tag))stack.push(node);
  }
 }
 append(...nodes:UiNode459[]){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes:UiNode459[]){this.text='';this.children=[];this.append(...nodes);}
 setAttribute(key:string,value:string){
  this.attributes.set(key,value);
  if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase())]=value;
  else if(key==='class')this.className=value;else if(key==='id')this.id=value;else if(key==='type')this.type=value;
  else if(key==='value')this.value=value;else if(key==='hidden')this.hidden=true;else if(key==='checked')this.checked=true;
 }
 getAttribute(key:string){return this.attributes.get(key)??null;}
 hasAttribute(key:string){return this.attributes.has(key);}
 removeAttribute(key:string){this.attributes.delete(key);}
 addEventListener(name:string,callback:(event:{currentTarget:UiNode459;key?:string;preventDefault():void})=>void){const rows=this.listeners.get(name)??[];rows.push(callback);this.listeners.set(name,rows);}
 click(){
  if(this.disabled)return;const event={currentTarget:this,preventDefault(){}};
  if(this.tag==='input'&&this.type==='checkbox'){this.checked=!this.checked;this.onchange?.(event);}
  for(const callback of this.listeners.get('click')??[])callback(event);this.onclick?.(event);
 }
 focus(){(document as unknown as {activeElement:UiNode459}).activeElement=this;}
 private matches(selector:string):boolean {
  const data=/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if(data){const key=data[1]!.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase());return Object.hasOwn(this.dataset,key)&&(data[2]===undefined||this.dataset[key]===data[2]);}
  return selector.startsWith('.')?this.className.split(' ').includes(selector.slice(1)):this.tag===selector;
 }
 querySelectorAll<T=UiNode459>(selector:string):T[]{
  const [ancestor,descendant]=selector.split(' '),all=this.children.flatMap(n=>[n,...n.querySelectorAll<UiNode459>('*')]);
  return all.filter(n=>{
   if(selector==='*')return true;
   if(!descendant)return n.matches(ancestor!);
   if(!n.matches(descendant))return false;
   for(let p=n.parentElement;p&&p!==this;p=p.parentElement)if(p.matches(ancestor!))return true;
   return false;
  }) as unknown as T[];
 }
 querySelector<T=UiNode459>(selector:string):T|null{return this.querySelectorAll<T>(selector)[0]??null;}
}
afterEach(()=>vi.unstubAllGlobals());
function dom(){
 vi.stubGlobal('document',{activeElement:null,createElement:(tag:string)=>new UiNode459(tag),createTextNode:(text:string)=>{const node=new UiNode459('#text');node.textContent=text;return node;}});
 return new UiNode459();
}
const element=(root:UiNode459,selector:string)=>{const node=root.querySelector(selector);expect(node,selector).not.toBeNull();return node!;};
const command=(w:World,c:Command)=>{const result=applyCommand(w,c);expect(result.ok,result.reason).toBe(true);};
function inspector(f=animalHaulingCamp459()){
 const root=dom(),sent:Command[]=[];
 createAnimalInspector(root as unknown as HTMLElement,{onHunt:()=>{},onClose:()=>{},onTraining:(animalId,skill,wanted)=>sent.push({type:'animal-training',animalId,skill,wanted})});
 const update=()=>expect(updateAnimalInspector(root as unknown as HTMLElement,f.world,f.animalId)).toBe(true);update();
 return {...f,root,sent,update};
}

test('opening the real inspector exposes training and unrestricted-area limits without adopting progress or reserving property',()=>{
 const f=animalHaulingCamp459(),before=JSON.stringify(f.world),ui=inspector(f);
 expect(element(ui.root,'[data-animal-tab="training"]').hidden).toBe(false);
 element(ui.root,'[data-animal-tab="training"]').click();expect(element(ui.root,'[data-animal-panel="training"]').hidden).toBe(false);
 // The real main inspector rebuild removes host classes before reusing tabs.
 // Re-entering the same animal must restore layout without replacing its tab.
 ui.root.classList.remove('animal-inspector-host');
 createAnimalInspector(ui.root as unknown as HTMLElement,{onHunt:()=>{},onClose:()=>{}});
 expect(ui.root.className.split(' ')).toContain('animal-inspector-host');
 expect(element(ui.root,'[data-animal-tab="training"]').getAttribute('aria-selected')).toBe('true');
 expect(element(ui.root,'[data-animal-training="haul"]').checked).toBe(false);
 expect(element(ui.root,'[data-animal-training-progress="haul"]').textContent).toContain('0 / 7 · À apprendre');
 expect(element(ui.root,'[data-animal-training-prerequisites="haul"]').textContent).toContain('Obéissance 0/3');
 expect(element(ui.root,'[data-animal-content="training"]').textContent).toContain('Zone de l’animal : Sans restriction');
 expect(element(ui.root,'[data-animal-content="training"]').textContent).toContain('Les aires animales ne se règlent pas encore ici');
 expect(element(ui.root,'[data-animal-content="training"]').textContent).not.toMatch(/schéma|migration|prototype/i);
 expect(ui.sent).toEqual([]);expect(f.animal.training).toBeUndefined();expect(JSON.stringify(f.world)).toBe(before);
});

test('checkboxes wait for real command confirmation, request unmet prerequisites and preserve learned steps when lessons are disabled',()=>{
 const ui=inspector(),haul=element(ui.root,'[data-animal-training="haul"]');haul.click();
 expect(ui.sent).toEqual([{type:'animal-training',animalId:ui.animalId,skill:'haul',wanted:true}]);
 expect(haul.checked).toBe(false);expect(ui.animal.training).toBeUndefined();
 command(ui.world,ui.sent[0]!);ui.update();expect(haul.checked).toBe(true);
 expect(element(ui.root,'[data-animal-training="obedience"]').checked).toBe(true);
 expect(nextTrainable282(ui.world,ui.animal)).toBe('obedience');expect(readAnimalTraining282(ui.animal,'haul')).toMatchObject({steps:0,learned:false});
 // Authored projection of an already learned/decayed skill, not a claim of
 // successful lessons. The separate physical loop earns all ten successes.
 ui.animal.training!.obedience={steps:3,learned:true,wanted:true};ui.animal.training!.haul={steps:6,learned:true,wanted:true};ui.animal.training!.masterId=ui.handlerId;
 ui.update();expect(element(ui.root,'[data-animal-training-progress="haul"]').textContent).toContain('Acquis, entretien nécessaire');
 haul.click();expect(haul.checked).toBe(true);command(ui.world,ui.sent.at(-1)!);ui.update();
 expect(haul.checked).toBe(false);expect(readAnimalTraining282(ui.animal,'haul')).toMatchObject({steps:6,learned:true,wanted:false});
 expect(element(ui.root,'[data-animal-training-master]').textContent).toContain(ui.handler.name);
});

test('the list sends the actual local animal ID, keeps confirmed state and removes controls when ownership is lost',()=>{
 const f=animalHaulingCamp459(),root=dom(),sent:Command[]=[],focus=vi.fn();
 const update=()=>updateAnimalsPanel(root as unknown as HTMLElement,f.world,focus,undefined,undefined,(animalId,skill,wanted)=>sent.push({type:'animal-training',animalId,skill,wanted}));update();
 element(root,`[data-domestic-focus="${f.animalId}"]`).click();expect(focus).toHaveBeenCalledWith(f.animalId);
 const check=element(root,`[data-domestic-train="${f.animalId}"]`);expect(check.disabled).toBe(false);check.click();expect(check.checked).toBe(false);
 expect(sent).toEqual([{type:'animal-training',animalId:f.animalId,skill:'haul',wanted:true}]);command(f.world,sent[0]!);update();expect(check.checked).toBe(true);
 // A changed real owner makes the pending choice stale. It does not grant a
 // skill or publish an optimistic checkbox when authority refuses the order.
 delete f.animal.domestic;const before=JSON.stringify(f.world),refused=applyCommand(f.world,{type:'animal-training',animalId:f.animalId,skill:'haul',wanted:false});expect(refused.ok).toBe(false);expect(refused.reason).toContain('n’appartient pas');
 expect(JSON.stringify(f.world)).toBe(before);update();expect(root.querySelector(`[data-domestic-train="${f.animalId}"]`)).toBeNull();
});

test('historical and future views hide prospective training, and read-only current controls stay disabled',()=>{
 const ui=inspector();element(ui.root,'[data-animal-tab="training"]').click();
 for(const version of [281,283]){
  const view={...ui.world,schemaVersion:version} as unknown as World,before=JSON.stringify(view);
  expect(updateAnimalInspector(ui.root as unknown as HTMLElement,view,ui.animalId)).toBe(true);
  expect(element(ui.root,'[data-animal-tab="training"]').hidden).toBe(true);expect(ui.root.dataset.animalInspectorTab).toBe('info');
  expect(animalInspectorView(view,ui.animalId)?.training).toBeUndefined();expect(JSON.stringify(view)).toBe(before);
 }
 const root=dom();createAnimalInspector(root as unknown as HTMLElement,{onHunt:()=>{},onClose:()=>{}});updateAnimalInspector(root as unknown as HTMLElement,ui.world,ui.animalId);
 expect(element(root,'[data-animal-training="obedience"]').disabled).toBe(true);expect(element(root,'[data-animal-training="haul"]').disabled).toBe(true);
});

test('a real first lesson reports its captured feed work and final attempt after the physical food holder is empty',()=>{
 const ui=inspector();command(ui.world,{type:'animal-training',animalId:ui.animalId,skill:'haul',wanted:true});
 const until=(done:()=>boolean)=>{for(let n=0;n<900&&!done();n++)stepWorld(ui.world);expect(done(),`Real lesson at tick ${ui.world.tick}: ${JSON.stringify(ui.handler.animalHandling)}`).toBe(true);};
 until(()=>ui.handler.animalHandling?.kind==='train'&&ui.handler.animalHandling.step===2&&ui.handler.animalHandling.progress>0);
 const task=ui.handler.animalHandling!,food=ui.world.piles.find(p=>p.id===task.carryPileId)!;
 expect(food.owner).toEqual({type:'pawn',pawnId:ui.handlerId});expect(task.feedDuration).toBeGreaterThan(task.progress);
 // Core JobDriver_InteractAnimal draws no progress bar (interactions note).
 ui.update();const before=JSON.stringify(ui.world);expect(actionProgress(ui.world,ui.handler)).toBeUndefined();
 expect(element(ui.root,'[data-animal-training-status]').textContent).toContain('nourrit l’animal');expect(animalActivity(ui.world,ui.animal)).toContain('Reçoit sa nourriture');
 expect(JSON.stringify(ui.world)).toBe(before);
 until(()=>ui.handler.animalHandling?.finalStartedCore!==undefined);const final=ui.handler.animalHandling!;ui.update();
 expect(final).toMatchObject({step:5,quantity:0,carryPileId:null});expect(ui.world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===ui.handlerId)).toBe(false);
 expect(actionProgress(ui.world,ui.handler)).toBeUndefined();
 expect(element(ui.root,'[data-animal-training-status]').textContent).toContain('tentative effectuée');expect(animalActivity(ui.world,ui.animal)).toContain('Termine la tentative');
 expect(element(ui.root,'[data-animal-training-progress="obedience"]').textContent).toContain('1 / 3');
});

test('haul activity distinguishes approach, physical delivery and retained cargo without inventing a timed work bar',()=>{
 const ui=inspector();command(ui.world,{type:'animal-training',animalId:ui.animalId,skill:'haul',wanted:true});
 // These are declared published UI-boundary states, not a claim that this
 // test performed training or the haul. The actual wood remains one object.
 const wood=ui.world.piles.find(p=>p.id===ui.woodId)!,zone=ui.world.stockpiles[0]!;
 ui.animal.haul={phase:'pickup',sourcePileId:wood.id,carryPileId:null,quantity:wood.quantity,destination:{type:'stockpile',stockpileId:zone.id},startedAtCore:ui.world.tick*10};
 expect(animalActivity(ui.world,ui.animal)).toBe('Rejoint une pile à transporter');
 wood.owner={type:'inventory',pawnId:ui.animalId};ui.animal.haul={...ui.animal.haul,phase:'deliver',carryPileId:wood.id};
 expect(animalActivity(ui.world,ui.animal)).toBe('Transporte un objet vers le stockage');
 ui.animal.haul={phase:'holding',carryPileId:wood.id,sinceCore:ui.world.tick*10};ui.update();
 expect(animalActivity(ui.world,ui.animal)).toContain('Conserve un objet');expect(element(ui.root,'[data-animal-training-status]').textContent).toContain('conserve un objet, attend un dépôt');
 expect(ui.world.piles.find(p=>p.id===wood.id)).toBe(wood);expect(wood.quantity).toBe(20);expect(wood.owner).toEqual({type:'inventory',pawnId:ui.animalId});
 expect(actionProgress(ui.world,ui.handler)).toBeUndefined();
});
