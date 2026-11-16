import { afterEach, expect, test, vi } from 'vitest';
import { PresentationChanges } from '../src/bridge/presentation-changes.ts';
import { mentalCrisisLabel, MENTAL_CRISIS_CATALOG, type MentalCrisisKind } from '../src/sim/mental-catalog.ts';
import { isMoodPoolCrisis350,type MoodPoolCrisisKind350 } from '../src/sim/mental-breaks-350.ts';
import { mentalCrisisStatus, mentalCrisisView } from '../src/sim/mental-presentation.ts';
import { startAlcoholBinge265, startBerserk, startFoodBinge, startMurderousRage, startSadWander, startTantrum } from '../src/sim/mental-break.ts';
import {addMaterial} from '../src/sim/materials.ts';
import { finishMentalBreak } from '../src/sim/mental-state.ts';
import { queryOrderOptions } from '../src/sim/player-orders.ts';
import type { Pawn, World } from '../src/sim/types.ts';
import { updateDraftControls } from '../src/ui/drafting-controls.ts';
import { pawnJournalRows } from '../src/ui/journal-inspection.ts';
import { createMoodInspection, updateMoodInspection } from '../src/ui/mood-inspection.ts';
import { crisisBuildings, mentalCrisesCamp } from './helpers/mental-crises-v211.ts';
import { animalCombatCamp } from './scenarios/animal-combat.ts';

const starters:Record<Exclude<MentalCrisisKind,MoodPoolCrisisKind350>,(world:World,pawn:Pawn)=>boolean>={
  'sad-wander':startSadWander,'food-binge':startFoodBinge,tantrum:startTantrum,berserk:startBerserk,'murderous-rage':startMurderousRage,
  'drug-binge':(world,pawn)=>{addMaterial(world,'beer',1,{type:'ground',x:pawn.x+1,z:pawn.z},'beer');return startAlcoholBinge265(world,pawn);},
};
// The schema 350 breaks have their own presentation checks (mood-pool-350.test.ts).
const kinds=(Object.keys(MENTAL_CRISIS_CATALOG) as MentalCrisisKind[]).filter((k):k is Exclude<MentalCrisisKind,MoodPoolCrisisKind350>=>!isMoodPoolCrisis350(k));
function camp(){const world=mentalCrisesCamp();crisisBuildings(world);return world;}

/** DOM double only for projection and focusability. Real keyboard delivery,
 * tooltip layout and portraits are exercised by the native browser oracle. */
class ElementFixture {
  children:ElementFixture[]=[];dataset:Record<string,string>={};style:Record<string,string>={};
  attributes=new Map<string,string>();nodes=new Map<string,ElementFixture>();
  hidden=false;tabIndex=-1;disabled=false;value='';id='';className='';private text='';
  set textContent(value:string){this.text=value;this.children=[];}
  get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value:string){
    if(value!=='<strong>Humeur</strong><span data-mood-current></span>')throw Error('Snapshot strings must be presented through textContent.');
    const heading=new ElementFixture(),current=new ElementFixture();heading.textContent='Humeur';current.dataset.moodCurrent='';this.append(heading,current);
  }
  append(...children:ElementFixture[]):void{this.children.push(...children);}
  replaceChildren(...children:ElementFixture[]):void{this.text='';this.children=children;}
  setAttribute(name:string,value:string):void{this.attributes.set(name,value);}
  hasAttribute(name:string):boolean{return this.attributes.has(name);}
  removeAttribute(name:string):void{this.attributes.delete(name);}
  querySelector<T=ElementFixture>(selector:string):T|null{return (this.nodes.get(selector)??this.querySelectorAll(selector)[0]??null) as T|null;}
  querySelectorAll(selector:string):ElementFixture[]{
    const attribute=/^\[data-([a-z-]+)\]$/.exec(selector),key=attribute?.[1]?.replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase());
    return this.children.flatMap(child=>[...((selector.startsWith('#')&&child.id===selector.slice(1)||key&&Object.hasOwn(child.dataset,key))?[child]:[]),...child.querySelectorAll(selector)]);
  }
}
function panelWith(...selectors:string[]):ElementFixture {
  const panel=new ElementFixture();for(const selector of selectors)panel.nodes.set(selector,new ElementFixture());return panel;
}
const html=(element:ElementFixture):HTMLElement=>element as unknown as HTMLElement;
afterEach(()=>vi.unstubAllGlobals());

test.each(kinds)('%s shares its actual label, refuses direct orders and keeps the recorded cause in the journal',kind=>{
  const world=camp(),pawn=world.pawns[0]!;pawn.name='<b>Élan</b> & rêve';
  expect(starters[kind](world,pawn)).toBe(true);
  const before=JSON.stringify(world),view=mentalCrisisView(world,pawn);
  expect(view?.label).toBe(mentalCrisisLabel(kind));expect(mentalCrisisStatus(world,pawn)).toContain(view!.label);
  if(kind==='drug-binge'){
    expect(view?.symbol).toBe('↝');expect(view?.target).toBeUndefined();expect(view?.description).toContain('bière physique');
    expect(world.piles.filter(p=>p.item==='beer').reduce((sum,p)=>sum+p.quantity,0)).toBe(1);
    expect(pawn.melee).toBeFalsy();
  }
  const options=queryOrderOptions(world,pawn.id,{x:12,z:15},false);
  expect(options).toHaveLength(1);expect(options[0]).toMatchObject({label:view!.label,enabled:false});
  expect(options[0]!.reason).toContain(view!.label);
  const event=world.events.at(-1)!;
  expect(pawnJournalRows(world,pawn)[0]).toEqual({tick:event.tick,kind:'mental',text:event.message});
  expect(JSON.stringify(world)).toBe(before);
});

test('target presentation follows confirmed identities, including animals, and invents no fallback victim',()=>{
  const world=camp(),pawn=world.pawns[0]!,victim=world.pawns[1]!;
  expect(startMurderousRage(world,pawn)).toBe(true);
  const crisis=pawn.mental!.crisis!;if(crisis.kind!=='murderous-rage')throw Error('Expected admitted murder crisis');
  crisis.targetId=victim.id;
  expect(mentalCrisisView(world,pawn)?.target).toEqual({type:'pawn',id:victim.id,cell:{x:victim.x,z:victim.z},label:victim.name});
  world.pawns=world.pawns.filter(p=>p!==victim);
  expect(mentalCrisisView(world,pawn)?.target).toBeUndefined();
  const animalWorld=animalCombatCamp(),aggressor=animalWorld.pawns[0]!,animal=animalWorld.wildlife!.animals[0]!;
  expect(startBerserk(animalWorld,aggressor)).toBe(true);
  const berserk=aggressor.mental!.crisis!;if(berserk.kind!=='berserk')throw Error('Expected admitted berserk');
  berserk.targetId=animal.id;berserk.jobUntilCore=animalWorld.tick*10+420;
  expect(mentalCrisisView(animalWorld,aggressor)?.target).toMatchObject({type:'animal',id:animal.id,cell:{x:animal.x,z:animal.z}});
  expect(mentalCrisisView(animalWorld,aggressor)?.target?.label).toContain('lièvre');
});

test('confirmed retarget and threat changes publish immediately without continuous age forcing publication',()=>{
  const world=camp(),pawn=world.pawns[0]!,observer=new PresentationChanges();
  expect(startMurderousRage(world,pawn)).toBe(true);observer.capture(world);
  const crisis=pawn.mental!.crisis!;if(crisis.kind!=='murderous-rage')throw Error('Expected admitted murder crisis');
  crisis.age+=30;expect(observer.capture(world)).toBe(false);
  crisis.targetId=world.pawns.find(p=>p!==pawn&&p.id!==crisis.targetId)!.id;
  expect(observer.capture(world)).toBe(true);expect(observer.capture(world)).toBe(false);
  world.pawns[1]!.meleeThreat={attackerId:pawn.id,atCore:world.tick*10};expect(observer.capture(world)).toBe(true);
});

test('Besoins and the keyboard refusal show literal target names, then clear when the real episode ends',()=>{
  vi.stubGlobal('document',{createElement:()=>new ElementFixture()});
  const world=camp(),pawn=world.pawns[0]!;
  for(const victim of world.pawns.slice(1))victim.name='<img src=x onerror=alert(1)> & cible';
  expect(startMurderousRage(world,pawn)).toBe(true);
  const mood=new ElementFixture();createMoodInspection(html(mood));
  const draft=panelWith('#toggle-draft','#inspector-hostility-label','#inspector-hostility','#stop-draft','#fire-at-will','#draft-help');
  updateMoodInspection(html(mood),world,pawn);updateDraftControls(html(draft),[pawn]);
  const crisis=mood.querySelector<ElementFixture>('#mood-crisis')!,help=draft.nodes.get('#draft-help')!;
  expect(crisis.hidden).toBe(false);expect(crisis.tabIndex).toBe(0);expect(crisis.hasAttribute('data-tooltip')).toBe(true);
  expect(crisis.textContent).toContain('<img src=x onerror=alert(1)> & cible');
  expect(mood.querySelector<ElementFixture>('#mood-target')!.textContent).toContain('Colère meurtrière');
  expect(help.tabIndex).toBe(0);expect(help.hasAttribute('data-tooltip')).toBe(true);expect(help.textContent).toContain('Colère meurtrière');
  expect(draft.nodes.get('#toggle-draft')!.disabled).toBe(true);
  finishMentalBreak(world,pawn);updateMoodInspection(html(mood),world,pawn);updateDraftControls(html(draft),[pawn]);
  expect(crisis.hidden).toBe(true);expect(crisis.textContent).toBe('');expect(crisis.dataset.mentalCrisis).toBeUndefined();
  expect(help.textContent).not.toContain('Colère meurtrière');expect(draft.nodes.get('#toggle-draft')!.disabled).toBe(false);
});
