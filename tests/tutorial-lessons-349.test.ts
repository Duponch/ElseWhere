import {beforeAll,describe,expect,it} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {SCHEMA_VERSION,type Cell,type Command,type World} from '../src/sim/types';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {captureGeneratedGeography256} from '../src/sim/world-geography-owner-256';
import {createGeographicNewGame256} from '../src/sim/geographic-new-game-256';
import {ACTUAL_SHRINES_750_256} from '../src/sim/ancient-temple-orchestration-256';
import {createStartingCandidateRoster,previewStartingCandidate} from '../src/sim/starting-candidates';
import {startingOriginalRequestFromRoster256} from '../src/sim/starting-original-request-256';
import {violentWorkRefusal} from '../src/sim/colonist-backgrounds';
import {isColonist} from '../src/sim/affiliation';
import {medicalStatus} from '../src/sim/injury-state';
import {damageUnarmoredPawnWithBullet} from '../src/sim/bullet-damage';
import {tutorialMode347} from '../src/sim/game-profile';
import {TUTORIAL_LESSONS_349,contractRect349,coverCells349,doorCells349,rectEdgeCells349,sandbagCells349,tutorialLessons349,type TutorialLessonId349} from '../src/sim/tutorial-lessons-349';
import {createTutorialEngine349} from '../src/ui/tutorial-engine-349';
import {tutorialCommandActions349,tutorialMainTabTag349,tutorialToolTag349,tutorialInspectorTag349,tutorialBiomeTag349} from '../src/ui/tutorial-actions-349';
import {TUTORIAL_LESSON_DEFS_349} from '../src/ui/tutorial-lessons-349';
import {createLearningHelper} from '../src/ui/learning-helper';
import {LEARNING_CONCEPTS} from '../src/ui/learning-concepts';
import {asOldSchema} from './scenarios/old-schema';

/* Core RimWorld 1.6 "Learn to play", the 37 lessons (schema 349):
 * TutorSystem.Notify_Event/AllowAction, ActiveLessonHandler, Lesson_Instruction,
 * the Instruction_* classes and Data/Core/Defs/Tutor/Instructions.xml. */

const drain=<Y,T>(it:Generator<Y,T,void>):T=>{let step=it.next();while(!step.done)step=it.next();return step.value;};
const ROSTER_SEED=259017;
function newGame(tutorial:boolean):World {
 const draft=drain(generateGeographicWorldDraft256({seed:'Camp2274 preview 256 🌲',settings:{...defaultWorldGenerationSettings(),rainfall:4,temperature:2},tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'QA349'}));
 const geography=captureGeneratedGeography256(draft);
 const roster=createStartingCandidateRoster(ROSTER_SEED),able=roster.filter(d=>violentWorkRefusal(previewStartingCandidate(ROSTER_SEED,d))===undefined);
 const ordered=[...able.slice(0,3),...roster.filter(d=>!able.slice(0,3).includes(d))];
 return drain(createGeographicNewGame256({draft,geography,tile:50388,size:200,scenario:'crashlanded',startingParty:startingOriginalRequestFromRoster256(ROSTER_SEED,ordered),...tutorial?{tutorial:true as const}:{}},{shrines750:ACTUAL_SHRINES_750_256}));
}
const copy=(w:World)=>deserializeWorld(serializeWorld(w));
const roundTrip=(w:World)=>{const text=serializeWorld(w);const back=deserializeWorld(text);expect(serializeWorld(back)).toBe(text);return back;};
const colonists=(w:World)=>w.pawns.filter(p=>isColonist(p)&&!p.prisoner);
function openPods(w:World):void {for(let i=0;i<40&&w.startingArrival?.phase!=='opened';i++)stepWorld(w,50);expect(w.startingArrival?.phase).toBe('opened');}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

/** The interface around the engine, as main.ts wires it: a gate before each
 * command, the event once it is accepted, the learning helper's knowledge. */
function driver(w:World) {
 const clock={ms:0},state:{world:World;selected?:number;epoch:number}={world:w,epoch:1};
 const helper=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>null,write:()=>true});
 const sent:Command[]=[];let ended=0;
 const engine=createTutorialEngine349({world:()=>state.world,epoch:()=>state.epoch,playing:()=>true,helper,selectedStructure:()=>state.selected,now:()=>clock.ms,
  send:async c=>{sent.push(c);const r=applyCommand(state.world,c);if(!r.ok)throw Error(r.reason);return r;},ended:()=>{ended++;}});
 /** main.ts client.command wrapper. */
 const act=(command:Command):{ok:boolean;refused?:string}=>{
  const actions=tutorialCommandActions349(command,state.world);
  if(actions.gate){const refusal=engine.allow(actions.gate);if(refusal!==undefined)return {ok:false,refused:refusal};}
  const r=applyCommand(state.world,command);
  if(r.ok&&actions.event)engine.notify(actions.event.tag);
  return {ok:r.ok,...r.ok?{}:{refused:r.reason}};
 };
 const tick=async()=>{await flush();engine.tick();await flush();};
 return {engine,helper,clock,state,sent,act,tick,get ended(){return ended;}};
}
const lessonOf=(w:World)=>tutorialLessons349(w)?.active;

let tutorialGame:World,normalGame:World;
beforeAll(()=>{tutorialGame=newGame(true);normalGame=newGame(false);},300000);

describe('the lessons record of a tutorial game',()=>{
 it('is born with the game and starting items are remembered',()=>{
  const w=copy(tutorialGame);
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);
  const record=tutorialLessons349(w)!;
  expect(record).toMatchObject({revision:1,introDone:true});expect(record.active).toBeUndefined();
  // GenStep_ScatterThings nearPlayerStart: the near-start steel, wood and cloth.
  const near=record.startingItems.map(id=>w.piles.find(p=>p.id===id)?.item);
  expect(near.length).toBeGreaterThan(0);expect(new Set(near)).toEqual(new Set(['steel','wood','cloth']));
  openPods(w);
  const after=tutorialLessons349(w)!.startingItems.map(id=>w.piles.find(p=>p.id===id));
  // ActiveTransporter: the pod contents (weapons among them), never the slag.
  expect(after.some(p=>p?.weapon!==undefined)).toBe(true);
  expect(after.some(p=>p?.item==='slag-steel-chunk')).toBe(false);
  expect(after.every(p=>!p||p.forbidden===true||p.weapon?.forbidden===true||p.apparel?.forbidden===true)).toBe(true);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
 },300000);
});

describe('the 37 lessons in order',()=>{
 it('runs the whole chain on real events, to the storyteller handover',async()=>{
  const w=copy(tutorialGame),d=driver(w),e=d.engine,text=(id:TutorialLessonId349)=>TUTORIAL_LESSON_DEFS_349.find(l=>l.id===id)!.text;
  const seen:TutorialLessonId349[]=[];
  const note=()=>{const id=e.lesson;if(id&&seen.at(-1)!==id)seen.push(id);};
  // ---- Creation pages: no World, the lessons live in the interface.
  d.state.world=undefined as unknown as World;
  e.beginCreation();
  e.notify('PageStart-CreateWorldParams');note();expect(e.lesson).toBe('CreateWorldParams');
  // Lesson_Instruction intro: centered on a dark overlay that absorbs every input.
  expect(e.view()!.intro).toEqual({centered:1,overlay:.9});expect(e.introBlocking).toBe(true);expect(e.allow({tag:'GotoNextPage'})).toBe('');
  d.clock.ms=4500;expect(e.view()!.intro!.centered).toBeCloseTo(.5);
  d.clock.ms=5000;e.tick();expect(e.introBlocking).toBe(false);expect(e.view()!.intro).toBeUndefined();
  expect(e.allow({tag:'GotoNextPage'})).toBeUndefined();expect(e.allow({tag:'RandomizePawn'})).toBe(text('CreateWorldParams'));
  e.notify('PageClosed');expect(e.lesson).toBeUndefined();
  e.notify('PageStart-SelectStartingSite');note();expect(e.lesson).toBe('ChooseLandingSite');
  expect(e.allow({tag:tutorialBiomeTag349('desert','flat')})).toBe(text('ChooseLandingSite'));
  expect(e.allow({tag:tutorialBiomeTag349('temperate-forest','small-hills')})).toBe(text('ChooseLandingSite'));
  expect(e.allow({tag:tutorialBiomeTag349('temperate-forest','flat')})).toBeUndefined();
  e.notify('PageClosed');e.notify('PageStart-ConfigureStartingPawns');note();expect(e.lesson).toBe('ReorderCharacters');
  expect(e.allow({tag:'RandomizePawn'})).toBe(text('ReorderCharacters'));expect(e.allow({tag:'ReorderPawn'})).toBeUndefined();
  e.notify('ReorderPawn');expect(e.lesson).toBe('ReorderCharacters');
  // The source rule: ReorderPawnOptionalToStarting activates RandomizeCharacter from ReorderCharacters.
  e.notify('ReorderPawnOptionalToStarting');note();expect(e.lesson).toBe('RandomizeCharacter');
  e.notify('RandomizePawn');note();expect(e.lesson).toBe('AcceptStartingPawns');
  expect(e.allow({tag:'GotoNextPage'})).toBeUndefined();
  e.notify('PageClosed');expect(e.lesson).toBeUndefined();e.endCreation();
  // ---- The map.
  d.state.world=w;d.state.epoch=2;
  await d.tick();note();expect(lessonOf(w)).toBe('MapCameraDolly');expect(d.sent).toEqual([{type:'tutorial-lesson',lesson:'MapCameraDolly'}]);
  // A camera lesson allows nothing gated; the Menu and the camera never are.
  expect(e.allow({tag:tutorialMainTabTag349('architect')!})).toBe(text('MapCameraDolly'));expect(tutorialMainTabTag349('menu')).toBeUndefined();
  expect(d.act({type:'area',action:'home',from:{x:10,z:10},to:{x:12,z:12}}).refused).toBe(text('MapCameraDolly'));
  openPods(w);
  // Instruction_LearnConcept: knowledge reset to 0, then learned by the gestures.
  for(const [lesson,concept] of [['MapCameraDolly','camera-dolly'],['MapCameraZoom','camera-zoom'],['Pause','pause'],['TimeControls','time-controls']] as const){
   expect(lessonOf(w)).toBe(lesson);expect(d.helper.knowledge(concept)).toBe(0);
   for(let i=0;i<3;i++){d.helper.demonstrate(concept,'specific');await d.tick();if(i<2)expect(lessonOf(w)).toBe(lesson);}
   note();
  }
  // MakeStockpile: exactly the shown 6 x 6 rect (EventCellsMatchExactly).
  expect(lessonOf(w)).toBe('MakeStockpile');
  const stock=tutorialLessons349(w)!.zoneRect!;expect(stock.maxX-stock.minX).toBe(5);
  expect(d.act({type:'area',action:'stockpile',from:{x:stock.minX,z:stock.minZ},to:{x:stock.maxX-1,z:stock.maxZ}}).refused).toBe(text('MakeStockpile'));
  expect(e.allow({tag:tutorialToolTag349('stockpile')!})).toBeUndefined();expect(e.allow({tag:tutorialToolTag349('growing')!})).toBe(text('MakeStockpile'));
  expect(d.act({type:'area',action:'stockpile',from:{x:stock.minX,z:stock.minZ},to:{x:stock.maxX,z:stock.maxZ}}).ok).toBe(true);
  await flush();note();expect(lessonOf(w)).toBe('EndStockpileDesignating');
  e.notify('ClearDesignatorSelection');await flush();note();expect(lessonOf(w)).toBe('UnforbidStartingResources');
  // UnforbidStartingResources: every remembered starting item allowed.
  expect(e.view()!.progress).toBeLessThan(1);
  expect(d.act({type:'area',action:'allow',from:{x:0,z:0},to:{x:w.width-1,z:w.height-1}}).ok).toBe(true);
  await d.tick();note();expect(lessonOf(w)).toBe('BuildRoomWalls');
  // PostDeactivated: only the starting weapons stay remembered.
  expect(tutorialLessons349(w)!.startingItems.every(id=>w.piles.find(p=>p.id===id)?.weapon!==undefined)).toBe(true);
  // BuildRoomWalls: wood walls on the 12 x 8 room edge only.
  const room=tutorialLessons349(w)!.roomRect!;expect([room.maxX-room.minX+1,room.maxZ-room.minZ+1]).toEqual([12,8]);
  expect(d.act({type:'build-line',kind:'wall',from:{x:room.minX,z:room.minZ-1},to:{x:room.maxX,z:room.minZ-1},material:'wood'}).refused).toBe(text('BuildRoomWalls'));
  for(const [from,to] of [[{x:room.minX,z:room.minZ},{x:room.maxX,z:room.minZ}],[{x:room.minX,z:room.maxZ},{x:room.maxX,z:room.maxZ}],[{x:room.minX,z:room.minZ+1},{x:room.minX,z:room.maxZ-1}],[{x:room.maxX,z:room.minZ+1},{x:room.maxX,z:room.maxZ-1}]] as [Cell,Cell][]){
   const r=d.act({type:'build-line',kind:'wall',from,to,material:'wood'});expect(r,JSON.stringify(r)).toMatchObject({ok:true});
  }
  await d.tick();note();expect(lessonOf(w)).toBe('BuildRoomDoor');
  // BuildRoomDoor: a door on the edge, never a corner.
  expect(d.act({type:'designate',kind:'door',x:room.minX,z:room.minZ,material:'wood'}).refused).toBe(text('BuildRoomDoor'));
  const doorCell=doorCells349(room).find(c=>c.z===room.minZ)!;
  const door=d.act({type:'designate',kind:'door',...doorCell,material:'wood'});expect(door,JSON.stringify(door)).toMatchObject({ok:true});
  await flush();note();expect(lessonOf(w)).toBe('BuildBeds');
  /** Places a building on the first candidate the game accepts; a tutorial refusal is a failure. */
  const place=(lesson:TutorialLessonId349,command:(c:Cell)=>Command,cells:readonly Cell[]):Cell=>{
   for(const c of cells){const r=d.act(command(c));if(r.ok)return c;expect(r.refused,`${lesson} ${JSON.stringify(c)}`).not.toBe(text(lesson));}
   throw Error(`No cell for ${lesson}`);
  };
  const inner=contractRect349(room,1),innerCells:Cell[]=[];
  for(let z=inner.minZ;z<=inner.maxZ;z++)for(let x=inner.minX;x<=inner.maxX;x++)innerCells.push({x,z});
  const used=new Set<string>(),free=()=>innerCells.filter(c=>!used.has(`${c.x},${c.z}`)&&!used.has(`${c.x},${c.z-1}`)&&!used.has(`${c.x},${c.z+1}`));
  const mark=(c:Cell,size=2)=>{for(let i=-1;i<=size;i++)used.add(`${c.x},${c.z+i}`);};
  // Instruction_BuildInRoom: 3 beds inside the room only (progress 0, 1/3, 2/3 then done).
  expect(d.act({type:'designate',kind:'bed',x:room.maxX+3,z:room.minZ+2,orientation:0,material:'wood'}).refused).toBe(text('BuildBeds'));
  for(let n=0;n<3;n++){
   expect(e.view()!.progress).toBeCloseTo(n/3);
   const at=place('BuildBeds',c=>({type:'designate',kind:'bed',...c,orientation:0,material:'wood'}),free().filter(c=>c.x%2===inner.minX%2));mark(at);
   await d.tick();
  }
  note();expect(lessonOf(w)).toBe('BuildTorchLamp');expect(e.view()!.progress).toBeUndefined();
  mark(place('BuildTorchLamp',c=>({type:'designate',kind:'torch-lamp',...c,orientation:0}),free()),1);await d.tick();note();
  expect(lessonOf(w)).toBe('BuildAnimalSleepingSpot');
  mark(place('BuildAnimalSleepingSpot',c=>({type:'designate',kind:'animal-sleeping-spot',...c,orientation:0}),free()),1);await d.tick();note();
  // Instruction_BuildNearRoom: within 10 cells of the room, never inside it.
  expect(lessonOf(w)).toBe('BuildHorseshoesPin');
  expect(d.act({type:'designate',kind:'horseshoes',...free()[0]!,orientation:0,material:'wood'}).refused).toBe(text('BuildHorseshoesPin'));
  expect(d.act({type:'designate',kind:'horseshoes',x:room.maxX+11,z:room.minZ,orientation:0,material:'wood'}).refused).toBe(text('BuildHorseshoesPin'));
  const around:Cell[]=[];for(let dz=-6;dz<=6;dz++)for(let dx=2;dx<=8;dx++)around.push({x:room.maxX+dx,z:room.minZ+dz},{x:room.minX-dx,z:room.minZ+dz});
  place('BuildHorseshoesPin',c=>({type:'designate',kind:'horseshoes',...c,orientation:0,material:'wood'}),around.filter(c=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height));
  await d.tick();note();expect(lessonOf(w)).toBe('MakeGrowingZone');
  // MakeGrowingZone: the exact fertile 10 x 8 rect.
  const field=tutorialLessons349(w)!.zoneRect!;expect([field.maxX-field.minX+1,field.maxZ-field.minZ+1]).toEqual([10,8]);
  expect(d.act({type:'area',action:'growing',from:{x:field.minX,z:field.minZ},to:{x:field.maxX,z:field.maxZ+1}}).refused).toBe(text('MakeGrowingZone'));
  expect(d.act({type:'area',action:'growing',from:{x:field.minX,z:field.minZ},to:{x:field.maxX,z:field.maxZ}}).ok).toBe(true);
  await flush();note();expect(lessonOf(w)).toBe('SetToGrowRice');
  // SetToGrowRice: Command_SetPlantToGrow, rice only.
  const zone=w.growingZones.at(-1)!;
  expect(d.act({type:'growing-policy',zoneId:zone.id,plant:'potato',allowSow:true,allowCut:true}).refused).toBe(text('SetToGrowRice'));
  expect(d.act({type:'growing-policy',zoneId:zone.id,plant:'rice',allowSow:true,allowCut:true}).ok).toBe(true);
  await flush();note();expect(lessonOf(w)).toBe('EquipWeapons');
  // EquipWeapons: every free colonist holds a primary (orders are never gated).
  const weapons=tutorialLessons349(w)!.startingItems.map(id=>w.piles.find(p=>p.id===id)!).filter(p=>p&&p.owner.type==='ground');
  expect(weapons.length).toBeGreaterThanOrEqual(colonists(w).length);
  colonists(w).forEach((p,i)=>expect(d.act({type:'order-equipment',pawnId:p.id,itemId:weapons[i]!.id,action:'equip',queue:false}).ok).toBe(true));
  for(let i=0;i<60&&lessonOf(w)==='EquipWeapons';i++){stepWorld(w,50);await d.tick();}
  note();expect(lessonOf(w)).toBe('BuildFueledStove');
  const stoveAt=place('BuildFueledStove',c=>({type:'designate',kind:'fueled-stove',...c,orientation:0,material:'steel'}),free());mark(stoveAt,1);
  await d.tick();note();expect(lessonOf(w)).toBe('AddBillSimpleMeal');
  // Lesson_Instruction.OnActivated: 75 raw potatoes.
  expect(w.gameProfile!.tutorial347!.potatoesAtCore).toBeDefined();
  // Instruction_AddBill: the selected stove, its simple meal bill repeated 10 times.
  expect(e.allow({tag:tutorialInspectorTag349('station-bills')!})).toBeUndefined();expect(e.allow({tag:tutorialInspectorTag349('pawn-tab-gear')!})).toBe(text('AddBillSimpleMeal'));
  for(let i=0;i<80&&!w.structures.some(s=>s.kind==='fueled-stove');i++)stepWorld(w,300);
  const stove=w.structures.find(s=>s.kind==='fueled-stove')!;expect(stove).toBeDefined();
  expect(d.act({type:'bill-add',recipe:'simple-meal',structureId:stove.id}).ok).toBe(true);
  await d.tick();expect(lessonOf(w)).toBe('AddBillSimpleMeal');expect(e.view()!.progress).toBe(0);
  d.state.selected=stove.id;await d.tick();expect(e.view()!.progress).toBeGreaterThan(0);
  const {id:_,recipe:__,worker:___,reservePause:____,...settings}=w.structures.find(s=>s.id===stove.id)!.bills!.find(b=>b.recipe==='simple-meal')!;
  expect(d.act({type:'bill-update',structureId:stove.id,billId:_,settings:{...settings,mode:'times',target:10}}).ok).toBe(true);
  await d.tick();note();expect(lessonOf(w)).toBe('MineSteel');d.state.selected=undefined;
  // Instruction_MineSteel: the lump scattered at activation; mining only on its cells.
  const lump=tutorialLessons349(w)!.mineCells!;expect(lump.length).toBeGreaterThan(0);expect(w.gameProfile!.tutorial347!.steelLumpAtCore).toBeDefined();
  const rock=w.tiles.findIndex((t,i)=>t.terrain==='rock'&&!t.fogged&&!lump.includes(i));
  if(rock>=0){const c={x:rock%w.width,z:Math.floor(rock/w.width)};expect(d.act({type:'area',action:'mine',from:c,to:c}).refused).toBe(text('MineSteel'));}
  const xs=lump.map(i=>i%w.width),zs=lump.map(i=>Math.floor(i/w.width));
  expect(d.act({type:'area',action:'mine',from:{x:Math.min(...xs),z:Math.min(...zs)},to:{x:Math.max(...xs),z:Math.max(...zs)}}).ok).toBe(true);
  await flush();note();expect(lessonOf(w)).toBe('ChopTrees');
  // Instruction_ChopWood: ten tree harvest designations.
  let chopped=0;
  for(const r of w.resources.filter(r=>r.kind==='tree'&&!w.tiles[r.z*w.width+r.x]!.fogged)){if(chopped>=10)break;if(d.act({type:'designate',kind:'chop',x:r.x,z:r.z}).ok)chopped++;}
  expect(chopped).toBe(10);await d.tick();note();expect(lessonOf(w)).toBe('OpenMainTabWork');
  expect(e.allow({tag:tutorialMainTabTag349('research')!})).toBe(text('OpenMainTabWork'));
  e.notify('MainTab-Work-Open');await flush();note();expect(lessonOf(w)).toBe('ChangeWorkSettings');
  for(let i=0;i<3;i++){d.helper.demonstrate('work-tab','specific');await d.tick();}
  note();expect(lessonOf(w)).toBe('BuildSimpleResearchBench');
  place('BuildSimpleResearchBench',c=>({type:'designate',kind:'research-bench',...c,orientation:0,material:'wood'}),free());
  await d.tick();note();expect(lessonOf(w)).toBe('OpenMainTabResearch');
  e.notify('MainTab-Research-Open');await flush();note();expect(lessonOf(w)).toBe('SelectResearchProject');
  const project=(['electricity','stonecutting','complex-furniture','air-conditioning','tree-sowing','long-blades','recurve-bow'] as const).find(p=>d.act({type:'research-project',project:p} as Command).ok);
  expect(project).toBeDefined();await flush();note();expect(lessonOf(w)).toBe('ExpandAreaHome');
  // Instruction_ExpandArea: counted from the area size at activation.
  expect(tutorialLessons349(w)!.areaStart).toBe(w.home?.length??0);
  const free2=(size:number)=>{for(let z=20;z<w.height-20;z+=size)for(let x=20;x<w.width-20;x+=size){let ok=true;for(let dz=0;dz<size&&ok;dz++)for(let dx=0;dx<size;dx++){const t=w.tiles[(z+dz)*w.width+x+dx]!;if(t.fogged||t.terrain==='rock'||(w.home??[]).includes((z+dz)*w.width+x+dx)){ok=false;break;}}if(ok)return {x,z};}throw Error('no free square');};
  const homeAt=free2(7);
  expect(d.act({type:'area',action:'home',from:homeAt,to:{x:homeAt.x+6,z:homeAt.z+6}}).ok).toBe(true);
  await d.tick();note();expect(lessonOf(w)).toBe('ExpandAreaBuildRoof');
  expect(d.act({type:'area',action:'build-roof',from:{x:room.minX,z:room.minZ},to:{x:room.maxX,z:room.maxZ}}).ok).toBe(true);
  await d.tick();note();expect(lessonOf(w)).toBe('BuildSandbags');
  // Instruction_BuildSandbags: the 7 x 7 ring without its center lines.
  const bags=tutorialLessons349(w)!.sandbagsRect!,ring=sandbagCells349(bags);expect(ring).toHaveLength(20);
  expect(d.act({type:'designate',kind:'sandbags',x:bags.minX+3,z:bags.minZ,orientation:0}).refused).toBe(text('BuildSandbags'));
  for(const c of ring){const r=d.act({type:'designate',kind:'sandbags',...c,orientation:0});expect(r,JSON.stringify(c)).toMatchObject({ok:true});}
  await d.tick();note();expect(lessonOf(w)).toBe('FinishSandbags');
  // Instruction_FinishConstruction: every blueprint and frame of the player done.
  expect(tutorialLessons349(w)!.blueprints).toBeGreaterThan(0);
  expect(d.act({type:'cancel',x:ring[0]!.x,z:ring[0]!.z}).refused).toBe(text('FinishSandbags'));
  const initial=tutorialLessons349(w)!.blueprints!;
  for(let i=0;i<3&&lessonOf(w)==='FinishSandbags';i++){stepWorld(w,600);await d.tick();}
  if(lessonOf(w)==='FinishSandbags'){
   // Test shortcut, outside the lesson's gate: the constructions left are cancelled.
   expect(e.view()!.progress).toBeCloseTo(1-w.jobs.filter(j=>!['mine','chop','build-roof','remove-roof','harvest','cut','sow','deconstruct','uninstall','install','smooth-floor','remove-floor','extract-tree','replant-tree','flick','repair','fix-breakdown','remove-bridge'].includes(j.kind)).length/initial);
   for(const j of w.jobs.filter(j=>!['mine','chop','build-roof','remove-roof','harvest','cut','sow','deconstruct','uninstall'].includes(j.kind)))applyCommand(w,{type:'cancel',x:j.x,z:j.z});
   await d.tick();
  }
  note();expect(lessonOf(w)).toBe('DownRaider');
  // Instruction_DownRaider: the single-raider raid at activation; draft and
  // fire are allowed, the rest refused; once a colonist is down every hostile is.
  expect(w.gameProfile!.tutorial347!.raidAtCore).toBeDefined();
  const raider=w.pawns.find(p=>p.raid&&!p.prisoner)!;expect(raider).toBeDefined();expect(raider.state).not.toBe('downed');
  expect(e.allow({tag:tutorialMainTabTag349('architect')!})).toBe(text('DownRaider'));expect(e.allow({tag:tutorialInspectorTag349('pawn-tab-health')!})).toBeUndefined();
  expect(d.act({type:'draft',pawnIds:colonists(w).map(p=>p.id),enabled:true}).ok).toBe(true);
  expect(e.outline()).toEqual({x:tutorialLessons349(w)!.sandbagsRect!.minX,z:tutorialLessons349(w)!.sandbagsRect!.minZ,width:7,height:7});
  await d.tick();expect(lessonOf(w)).toBe('DownRaider');
  const victim=colonists(w)[0]!;damageUnarmoredPawnWithBullet(w,victim,{damage:30,part:'spine'});expect(victim.state).toBe('downed');
  stepWorld(w,1);
  const fallen=w.pawns.find(p=>p.id===raider.id)!;expect(fallen.state).toBe('downed');expect(medicalStatus(fallen.health!)).toBe('downed');
  await d.tick();note();expect(lessonOf(w)).toBe('UndraftAll');
  // Instruction_UndraftAll.
  expect(e.allow({tag:'Undraft'})).toBeUndefined();expect(e.allow({tag:'FireAtWillToggle'})).toBe(text('UndraftAll'));
  const drafted=colonists(w).filter(p=>p.draft).map(p=>p.id);
  if(drafted.length){expect(e.view()!.progress).toBeLessThan(1);expect(d.act({type:'draft',pawnIds:drafted,enabled:false}).ok).toBe(true);}
  await d.tick();note();expect(lessonOf(w)).toBe('ChooseStoryteller');
  // ChooseStoryteller: the Menu (never gated) and the choice end the tutorial.
  expect(e.allow({tag:'MainTab-Menu-Open'})).toBeUndefined();
  expect(d.act({type:'choose-storyteller',storyteller:'cassandra-partial',difficulty:'adventure-story'}).ok).toBe(true);
  await flush();
  expect(d.ended).toBe(1);expect(e.active).toBe(false);expect(e.lesson).toBeUndefined();expect(e.view()).toBeUndefined();
  expect(tutorialMode347(w)).toBe(false);
  // TutorialState.Notify_TutorialEnding: starting items and rectangles cleared, endTick set.
  expect(w.gameProfile!.tutorial347).toMatchObject({lessons349:{revision:1,introDone:true,startingItems:[]},endedAtCore:expect.any(Number)});
  expect(Object.keys(w.gameProfile!.tutorial347!.lessons349!)).toEqual(['revision','introDone','startingItems']);
  // Nothing is gated any more.
  expect(e.allow({tag:tutorialMainTabTag349('architect')!})).toBeUndefined();
  const after=d.act({type:'area',action:'home',from:{x:room.minX,z:room.minZ},to:{x:room.maxX,z:room.maxZ}});
  expect(after.refused===undefined||!TUTORIAL_LESSON_DEFS_349.some(l=>l.text===after.refused)).toBe(true);
  expect(seen).toEqual([...TUTORIAL_LESSONS_349]);
  expect(d.sent.map(c=>(c as {lesson:string}).lesson)).toEqual(TUTORIAL_LESSONS_349.slice(5));
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
 },900000);
});

/** A tutorial game advanced to a lesson by the real chain (no creation pages). */
async function reach(lesson:TutorialLessonId349):Promise<{w:World;d:ReturnType<typeof driver>}> {
 const w=copy(tutorialGame),d=driver(w);
 await d.tick();
 const concepts:Record<string,string>={MapCameraDolly:'camera-dolly',MapCameraZoom:'camera-zoom',Pause:'pause',TimeControls:'time-controls'};
 while(lessonOf(w)!==lesson){
  const id=lessonOf(w)!,concept=concepts[id];
  if(!concept)throw Error(`reach() stops at ${id}`);
  for(let i=0;i<3;i++)d.helper.demonstrate(concept,'specific');
  await d.tick();
 }
 return {w,d};
}

describe('each kind of lesson',()=>{
 it('the gate refuses, then allows, with the lesson\'s own cells',async()=>{
  const {w,d}=await reach('MakeStockpile'),e=d.engine,data=tutorialLessons349(w)!,r=data.zoneRect!;
  const text=TUTORIAL_LESSON_DEFS_349.find(l=>l.id==='MakeStockpile')!.text;
  // Lookups on the action tag: the main tabs, designators and gizmos the lesson does not name.
  for(const tag of [tutorialMainTabTag349('work')!,tutorialToolTag349('mine')!,'Draft','ToggleForbidden','TutorTagNotSet',tutorialInspectorTag349('pawn-tab-bio')!])expect(e.allow({tag})).toBe(text);
  expect(e.allow({tag:'MainTab-Architect-Open'})).toBeUndefined();expect(e.allow({tag:tutorialToolTag349('stockpile')!})).toBeUndefined();
  // EventCellsMatchExactly: a bigger, smaller or shifted rect is refused.
  for(const bad of [{...r,maxX:r.maxX+1},{...r,minZ:r.minZ+1},{minX:r.minX+1,minZ:r.minZ,maxX:r.maxX+1,maxZ:r.maxZ}])
   expect(tutorialCommandActions349({type:'area',action:'stockpile',from:{x:bad.minX,z:bad.minZ},to:{x:bad.maxX,z:bad.maxZ}},w).gate&&e.allow(tutorialCommandActions349({type:'area',action:'stockpile',from:{x:bad.minX,z:bad.minZ},to:{x:bad.maxX,z:bad.maxZ}},w).gate!)).toBe(text);
  // The same rect, drawn from either corner.
  expect(e.allow(tutorialCommandActions349({type:'area',action:'stockpile',from:{x:r.maxX,z:r.maxZ},to:{x:r.minX,z:r.minZ}},w).gate!)).toBeUndefined();
  // The gate never touches the game: refused commands are not sent.
  const before=serializeWorld(w);expect(d.act({type:'area',action:'growing',from:{x:r.minX,z:r.minZ},to:{x:r.maxX,z:r.maxZ}}).refused).toBe(text);expect(serializeWorld(w)).toBe(before);
  // Ungated actions pass: orders, priorities, the lessons' own chain, the Menu.
  expect(tutorialCommandActions349({type:'priority',pawnId:1,work:'haul',value:1},w)).toEqual({});
  expect(tutorialCommandActions349({type:'tutorial-lesson',lesson:'MapCameraZoom'},w)).toEqual({});
  expect(tutorialMainTabTag349('menu')).toBeUndefined();
 },300000);
 it('the room lessons check the room: walls on missing edges, the door off the corners, furniture inside',()=>{
  const w=copy(tutorialGame),room={minX:40,minZ:40,maxX:51,maxZ:47};
  const record=tutorialLessons349(w)!;record.active='BuildRoomWalls';record.roomRect=room;
  const e=createTutorialEngine349({world:()=>w,epoch:()=>1,playing:()=>true,send:async()=>({ok:true}),now:()=>0});
  const walls=TUTORIAL_LESSON_DEFS_349.find(l=>l.id==='BuildRoomWalls')!;
  const wall=(from:Cell,to:Cell)=>e.allow(tutorialCommandActions349({type:'build-line',kind:'wall',from,to,material:'wood'},w).gate!);
  expect(e.lesson).toBe('BuildRoomWalls');expect(e.view()!.progress).toBe(0);
  expect(wall({x:40,z:40},{x:51,z:40})).toBeUndefined();expect(wall({x:40,z:41},{x:51,z:41})).toBe(walls.text);expect(wall({x:39,z:40},{x:51,z:40})).toBe(walls.text);
  // A wall blueprint already on a cell: that cell is skipped (not designatable again).
  w.jobs.push({id:999001,kind:'wall',x:40,z:40,progress:0,reservedBy:null} as unknown as World['jobs'][number]);
  expect(e.view()!.progress).toBeCloseTo(1/rectEdgeCells349(room).length);
  expect(wall({x:40,z:40},{x:40,z:47})).toBeUndefined();
  for(const c of rectEdgeCells349(room))w.jobs.push({id:999100+c.x*100+c.z,kind:'wall',x:c.x,z:c.z,progress:0,reservedBy:null} as unknown as World['jobs'][number]);
  expect(e.view()!.progress).toBe(1);
  record.active='BuildRoomDoor';
  const door=(c:Cell)=>e.allow(tutorialCommandActions349({type:'designate',kind:'door',...c,material:'wood'},w).gate!);
  expect(door({x:40,z:40})).toBeDefined();expect(door({x:51,z:47})).toBeDefined();expect(door({x:45,z:44})).toBeDefined();
  expect(doorCells349(room).every(c=>door(c)===undefined)).toBe(true);expect(doorCells349(room)).toHaveLength(rectEdgeCells349(room).length-4);
  record.active='BuildBeds';
  const bed=(c:Cell)=>e.allow(tutorialCommandActions349({type:'designate',kind:'bed',...c,orientation:0,material:'wood'},w).gate!);
  expect(bed({x:41,z:41})).toBeUndefined();expect(bed({x:40,z:41})).toBeDefined();expect(bed({x:55,z:41})).toBeDefined();
  expect(e.view()!.progress).toBe(0);
  for(const x of [41,43,45])w.jobs.push({id:999900+x,kind:'bed',x,z:41,progress:0,reservedBy:null} as unknown as World['jobs'][number]);
  // Instruction_BuildAtRoom counts building centers inside the room only.
  w.jobs.push({id:999990,kind:'bed',x:60,z:41,progress:0,reservedBy:null} as unknown as World['jobs'][number]);
  expect(e.view()!.progress).toBe(1);
  record.active='BuildHorseshoesPin';
  const pin=(c:Cell)=>e.allow(tutorialCommandActions349({type:'designate',kind:'horseshoes',...c,orientation:0,material:'wood'},w).gate!);
  expect(pin({x:45,z:44})).toBeDefined();expect(pin({x:55,z:44})).toBeUndefined();expect(pin({x:62,z:44})).toBeDefined();
  // Instruction_BuildSandbags and DownRaider: the ring without its center lines, the cover one cell in.
  const bags={minX:60,minZ:60,maxX:66,maxZ:66};
  expect(sandbagCells349(bags)).toHaveLength(20);expect(sandbagCells349(bags).some(c=>c.x===63||c.z===63)).toBe(false);
  expect(coverCells349(bags)).toHaveLength(12);expect(coverCells349(bags).every(c=>c.x>=61&&c.x<=65&&c.z>=61&&c.z<=65)).toBe(true);
  // Each kind decides its own end (contractRect349 = Core ContractedBy).
  expect(contractRect349(room,1)).toEqual({minX:41,minZ:41,maxX:50,maxZ:46});
 },300000);
});

describe('forced content and the raid lesson',()=>{
 it('activations scatter the steel lump and send the raid; a downed colonist downs every hostile',async()=>{
  const w=copy(tutorialGame);openPods(w);
  const record=tutorialLessons349(w)!;record.active='AddBillSimpleMeal';
  expect(applyCommand(w,{type:'tutorial-lesson',lesson:'MineSteel'})).toMatchObject({ok:true});
  const cells=tutorialLessons349(w)!.mineCells!;expect(cells.length).toBeGreaterThanOrEqual(20);
  expect(cells.every(i=>w.tiles[i]!.terrain==='rock'&&w.tiles[i]!.ore==='steel')).toBe(true);
  // A lesson out of order is refused.
  expect(applyCommand(w,{type:'tutorial-lesson',lesson:'DownRaider'}).ok).toBe(false);
  record.active='FinishSandbags';record.blueprints=0;
  const t=tutorialLessons349(w)!;delete t.mineCells;t.roomRect={minX:40,minZ:40,maxX:51,maxZ:47};t.sandbagsRect={minX:60,minZ:60,maxX:66,maxZ:66};
  expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'tutorial-lesson',lesson:'DownRaider'})).toMatchObject({ok:true});
  const raider=w.pawns.find(p=>p.raid&&!p.prisoner)!;expect(raider).toBeDefined();expect(w.gameProfile!.tutorial347!.raidAtCore).toBeDefined();
  // Nobody down yet: the raider stands.
  stepWorld(w,1);expect(w.pawns.find(p=>p.id===raider.id)!.state).not.toBe('downed');
  const victim=colonists(w)[0]!;damageUnarmoredPawnWithBullet(w,victim,{damage:30,part:'spine'});expect(victim.state).toBe('downed');
  stepWorld(w,1);
  const fallen=w.pawns.find(p=>p.id===raider.id)!;expect(fallen.state).toBe('downed');expect(fallen.health!.death).toBeUndefined();
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
 },300000);
});

describe('saves',()=>{
 it('reloads mid-tutorial on the same lesson, with its data and without resetting the concept',async()=>{
  const {w,d}=await reach('Pause');
  d.helper.demonstrate('pause','specific');await d.tick();expect(d.engine.view()!.progress).toBeCloseTo(.4);
  // A loaded game (another epoch) adopts its lesson: no OnActivated again.
  const loaded=deserializeWorld(serializeWorld(w));d.state.world=loaded;d.state.epoch=7;
  expect(d.engine.lesson).toBe('Pause');await d.tick();
  expect(lessonOf(loaded)).toBe('Pause');expect(d.helper.knowledge('pause')).toBeCloseTo(.4);expect(d.engine.view()!.progress).toBeCloseTo(.4);
  for(let i=0;i<2;i++)d.helper.demonstrate('pause','specific');
  await d.tick();expect(lessonOf(loaded)).toBe('TimeControls');
  for(let i=0;i<3;i++)d.helper.demonstrate('time-controls','specific');
  await d.tick();expect(lessonOf(loaded)).toBe('MakeStockpile');
  // The lesson's own data (Instruction_PlaceStockpile.stockpileRect) is saved with the game.
  const data=structuredClone(tutorialLessons349(loaded)!),text=serializeWorld(loaded),again=deserializeWorld(text);
  expect(serializeWorld(again)).toBe(text);expect(tutorialLessons349(again)).toEqual(data);
  d.state.world=again;d.state.epoch=8;
  expect(d.engine.lesson).toBe('MakeStockpile');expect(d.engine.outline()).toEqual({x:data.zoneRect!.minX,z:data.zoneRect!.minZ,width:6,height:6});
  expect(d.act({type:'area',action:'stockpile',from:{x:data.zoneRect!.minX,z:data.zoneRect!.minZ},to:{x:data.zoneRect!.maxX,z:data.zoneRect!.maxZ}}).ok).toBe(true);
  await flush();expect(lessonOf(again)).toBe('EndStockpileDesignating');
 },300000);
 it('validates the lessons record strictly',()=>{
  const text=serializeWorld(tutorialGame),mutate=(change:(r:Record<string,any>)=>void)=>{const raw=JSON.parse(text);change(raw);return JSON.stringify(raw);};
  const lessons=(r:Record<string,any>)=>r.gameProfile.tutorial347.lessons349;
  expect(()=>deserializeWorld(mutate(r=>{lessons(r).active='MakeStockpile';lessons(r).zoneRect={minX:40,minZ:40,maxX:45,maxZ:45};}))).not.toThrow();
  for(const bad of [
   (r:Record<string,any>)=>{lessons(r).extra=1;},
   (r:Record<string,any>)=>{lessons(r).revision=2;},
   (r:Record<string,any>)=>{lessons(r).introDone='yes';},
   (r:Record<string,any>)=>{lessons(r).active='CreateWorldParams';},
   (r:Record<string,any>)=>{lessons(r).active='Unknown';},
   (r:Record<string,any>)=>{lessons(r).startingItems=[5,5];},
   (r:Record<string,any>)=>{lessons(r).startingItems=[0];},
   (r:Record<string,any>)=>{lessons(r).active='MakeStockpile';lessons(r).zoneRect={minX:40,minZ:40,maxX:45,maxZ:45};lessons(r).roomRect={minX:40,minZ:40,maxX:51,maxZ:47};},
   (r:Record<string,any>)=>{lessons(r).active='MakeStockpile';lessons(r).zoneRect={minX:40,minZ:40,maxX:46,maxZ:45};},
   (r:Record<string,any>)=>{lessons(r).active='Pause';lessons(r).zoneRect={minX:40,minZ:40,maxX:45,maxZ:45};},
   (r:Record<string,any>)=>{lessons(r).active='BuildRoomDoor';lessons(r).zoneRect={minX:40,minZ:40,maxX:45,maxZ:45};},
   (r:Record<string,any>)=>{lessons(r).active='BuildRoomDoor';lessons(r).roomRect={minX:40,minZ:40,maxX:51,maxZ:47};lessons(r).sandbagsRect={minX:60,minZ:60,maxX:66,maxZ:66};},
   (r:Record<string,any>)=>{lessons(r).active='BuildRoomDoor';lessons(r).roomRect={minX:195,minZ:40,maxX:206,maxZ:47};},
   (r:Record<string,any>)=>{lessons(r).active='MineSteel';lessons(r).roomRect={minX:40,minZ:40,maxX:51,maxZ:47};lessons(r).mineCells=[9,3];},
   (r:Record<string,any>)=>{lessons(r).active='ExpandAreaHome';lessons(r).roomRect={minX:40,minZ:40,maxX:51,maxZ:47};},
  ])expect(()=>deserializeWorld(mutate(bad))).toThrow();
 },300000);
 it('migrates a 348 save by its number only: no lessons, nothing offered',()=>{
  for(const game of [tutorialGame,normalGame]){
   const old=asOldSchema(serializeWorld(game),348),loaded=deserializeWorld(old);
   expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);expect(tutorialLessons349(loaded)).toBeUndefined();
   expect(JSON.parse(serializeWorld(loaded)).gameProfile).toEqual(JSON.parse(old).gameProfile);
   // A 348 tutorial keeps going without lessons: the engine stays off, nothing is gated.
   const e=createTutorialEngine349({world:()=>loaded,epoch:()=>1,playing:()=>true,send:async()=>{throw Error('no command');},now:()=>0});
   e.tick();expect(e.active).toBe(false);expect(e.allow({tag:'MainTab-Architect-Open'})).toBeUndefined();
   expect(applyCommand(loaded,{type:'tutorial-lesson',lesson:'MapCameraDolly'}).ok).toBe(false);
  }
  // A lessons record cannot appear in a 348 save.
  const raw=JSON.parse(serializeWorld(tutorialGame));raw.schemaVersion=348;
  expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow();
 },300000);
});

describe('a normal game',()=>{
 it('has no lesson record, gates nothing and sends nothing',async()=>{
  const w=copy(normalGame),d=driver(w);
  expect(w.gameProfile!.tutorial347).toBeUndefined();expect(serializeWorld(w)).not.toMatch(/lessons349/);
  await d.tick();expect(d.sent).toEqual([]);expect(d.engine.active).toBe(false);expect(d.engine.view()).toBeUndefined();expect(d.engine.outline()).toBeNull();
  for(const tag of ['MainTab-Architect-Open','Designate-Wall','Draft','ChooseStoryteller'])expect(d.engine.allow({tag})).toBeUndefined();
  expect(applyCommand(w,{type:'tutorial-lesson',lesson:'MapCameraDolly'}).ok).toBe(false);
  // The rule of the raid lesson never runs: no lessons, no extra draw.
  openPods(w);const before=serializeWorld(w);const again=deserializeWorld(before);stepWorld(w,30);stepWorld(again,30);expect(serializeWorld(w)).toBe(serializeWorld(again));
 },300000);
});

describe('the learning helper during the tutorial',()=>{
 it('is suspended (no notion shown or opened) and restarts its relax timer at the end',()=>{
  const h=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>null,write:()=>true});
  expect(h.teachOpportunity('drafting','critical')).toBe(true);expect(h.shown.map(c=>c.id)).toEqual(['drafting']);
  h.setSuspended(true);expect(h.shown).toEqual([]);expect(h.teachOpportunity('rescuing','critical')).toBe(false);
  // Demonstrations still count (Core KnowledgeDemonstrated ignores AdaptiveTrainingEnabled).
  h.demonstrate('camera-zoom','specific');expect(h.knowledge('camera-zoom')).toBeCloseTo(.4);
  h.setKnowledge('camera-zoom',0);expect(h.knowledge('camera-zoom')).toBe(0);
  const before=h.secondsSinceLesson;h.update(30,{playing:true,menuOpen:false});expect(h.secondsSinceLesson).toBe(before);
  h.setSuspended(false);h.tutorialEnded();expect(h.secondsSinceLesson).toBe(0);expect(h.shown.map(c=>c.id)).toEqual(['drafting']);
 });
});
