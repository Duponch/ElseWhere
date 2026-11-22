/** Core RimWorld 1.6 tutorial ("Apprendre à jouer"), schema 347: what the
 * game owes the 37 lessons, not the lessons themselves.
 *
 * - Forced content, given once each at the activation of its lesson
 *   (Lesson_Instruction.OnActivated): 75 raw potatoes (AddBillSimpleMeal,
 *   giveOnActivateDef RawPotatoes x75 at FindUsableRect(2,2).CenterCell), a
 *   compacted steel lump (Instruction_MineSteel: FindUsableRect(10,10, no
 *   items) then GenStep_ScatterLumpsMineable.ForceScatterAt with
 *   MineableSteel, lump size 30~40) and the single-raider raid
 *   (Instruction_DownRaider: RaidEnemy, points = Drifter combatPower 35,
 *   EdgeWalkIn, ImmediateAttack, raidForceOneDowned).
 * - The handover (ChooseStoryteller, endTutorial): the player's storyteller
 *   and difficulty replace the Tutor; its comps start from the current tick
 *   (Storyteller.Notify_DefChanged), past opportunities are not replayed.
 *
 * The lessons (next lot) issue these commands; the simulation only checks
 * that the game is the tutorial and that each content is given once. */
import {isColonist} from './affiliation.ts';
import {adoptFluIncidents} from './flu-incidents.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import {chooseRaidComposition} from './raids.ts';
import {drawRaidFaction331} from './raid-factions-331.ts';
import {createRaidGroup} from './raid-spawn.ts';
import {raidEntries} from './raid-space.ts';
import {raidRandom} from './raid-state.ts';
import {enableVisitors} from './visitors.ts';
import {INTRO_VISITOR_TICK} from './visitor-state.ts';
import {captureStandability} from './furniture-travel.ts';
import {footprintCells} from './definitions.ts';
import {terrainSupportsAffordance256,terrainGroundFertility256} from './natural-terrain-runtime-256.ts';
import {isNaturalTerrain256} from './local-terrain-definitions-256.ts';
import {localIrregularOreLump256} from './local-ore-scattering-256.ts';
import {ORE_MINEABLE_DEFS_256} from './local-mineable-owner-256.ts';
import {isStoneKind,type StoneKind} from './geology.ts';
import {WorldGenerationRandom} from './world-generation-random.ts';
import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {invalidateAnimalPens} from './animal-pens.ts';
import {isPlant} from './plants.ts';
import {addGroundMaterial} from './materials.ts';
import {healthRandom} from './health.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema347OrLater,tutorialMode347,type GameProfile,type TutorialState347} from './game-profile.ts';
import {endTutorialLessons349} from './tutorial-lessons-state-349.ts';
export {isSchema347OrLater};
import type {Cell,CommandResult,Job,Tile,World} from './types.ts';

export type TutorialContentCommand347=
  | {type:'tutorial-potatoes'}
  | {type:'tutorial-steel-lump'}
  | {type:'tutorial-raid'}
  | {type:'choose-storyteller';storyteller:'cassandra-partial';difficulty:'adventure-story'};
/** Every tutorial command; schema 349 adds the lessons' chain. */
export type TutorialCommand347=TutorialContentCommand347|import('./tutorial-lessons-349.ts').TutorialLessonCommand349;
const TYPES=new Set(['tutorial-potatoes','tutorial-steel-lump','tutorial-raid','choose-storyteller']);
export const isTutorialCommand347=(c:unknown):c is TutorialContentCommand347=>!!c&&typeof c==='object'&&TYPES.has(String((c as {type?:unknown}).type));

/** Core InstructionDef AddBillSimpleMeal: giveOnActivateDef/Count. */
export const TUTORIAL_POTATOES_347=75;
/** Core PawnKindDef Drifter combatPower: the tutorial raid's points. */
export const TUTORIAL_RAID_POINTS_347=35;
/** Core ThingDef MineableSteel mineableScatterLumpSizeRange. */
export const TUTORIAL_LUMP_SIZE_347=Object.freeze({min:30,max:40});
/** Core GenGrid.NoBuildEdgeWidth (the no-zone edge, 5, lies inside it). */
const NO_BUILD_EDGE=10;
export interface TutorialRect347 {readonly minX:number;readonly minZ:number;readonly maxX:number;readonly maxZ:number}
/** Core CellRect.CenterCell (integer halves). */
export const tutorialRectCenter347=(r:TutorialRect347):Cell=>({x:r.minX+Math.floor((r.maxX-r.minX+1)/2),z:r.minZ+Math.floor((r.maxZ-r.minZ+1)/2)});

/** Construction blueprints and frames occupy their cells (Core Blueprint);
 * the other jobs are designations, which do not. */
const DESIGNATIONS=new Set(['smooth-wall','smooth-floor','remove-bridge','extract-tree','remove-floor','flick','repair','fix-breakdown','build-roof','remove-roof','mine','chop','harvest','cut','sow','deconstruct','uninstall']);
const isBlueprint=(j:Job):boolean=>!DESIGNATIONS.has(j.kind);

/** Core TutorUtility.FindUsableRect: a width x height rect drawn around the
 * map center with a growing jitter (+0.25 a try), every cell of the rect
 * expanded by one unfogged, walkable, Heavy-affordance, at least minFertility,
 * outside any zone, without building or blueprint (nor item if noItems) and
 * away from the no-build edge. Draws on the world's gameplay stream.
 * Core loops without end; this one stops once the jitter covers the map. */
export function findUsableRect347(w:World,width:number,height:number,minFertility=0,noItems=false):TutorialRect347|null {
  if(![width,height].every(v=>Number.isInteger(v)&&v>=1&&v<=64)||!Number.isFinite(minFertility))throw RangeError('Invalid tutorial rect');
  const stands=captureStandability(w),n=w.width*w.height,blocked=new Uint8Array(n),zone=new Uint8Array(n),item=new Uint8Array(n);
  for(const s of w.structures)for(const c of footprintCells(s))if(c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height)blocked[c.z*w.width+c.x]=1;
  for(const j of w.jobs)if(isBlueprint(j))for(const c of footprintCells(j))if(c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height)blocked[c.z*w.width+c.x]=1;
  for(const s of w.stockpiles)zone[s.z*w.width+s.x]=1;
  for(const g of w.growingZones)for(const i of g.cells)if(i>=0&&i<n)zone[i]=1;
  for(const p of w.piles)if(p.owner.type==='ground')item[p.owner.z*w.width+p.owner.x]=1;
  for(const p of w.packed)if(p.owner.type==='ground')item[p.owner.z*w.width+p.owner.x]=1;
  const usable=(x:number,z:number):boolean=>{
    if(x<NO_BUILD_EDGE||z<NO_BUILD_EDGE||x>=w.width-NO_BUILD_EDGE||z>=w.height-NO_BUILD_EDGE)return false;
    const i=z*w.width+x,tile=w.tiles[i]!;
    return tile.fogged!==true&&stands({x,z})&&terrainSupportsAffordance256(tile,'Heavy',w)&&terrainGroundFertility256(tile)>=minFertility&&!zone[i]&&!blocked[i]&&!(noItems&&item[i]);
  };
  const cx=Math.floor(w.width/2),cz=Math.floor(w.height/2),limit=Math.max(w.width,w.height);
  for(let jitter=1;jitter<=limit;jitter+=.25){
    const dx=Math.trunc(-jitter+healthRandom(w)*2*jitter),dz=Math.trunc(-jitter+healthRandom(w)*2*jitter);
    // CellRect.CenteredOn(center, width/2) then Width/Height, ExpandedBy(1).
    const minX=cx+dx-Math.floor(width/2),minZ=cz+dz-Math.floor(width/2);
    let ok=true;
    for(let z=minZ-1;ok&&z<=minZ+height;z++)for(let x=minX-1;x<=minX+width;x++)if(!usable(x,z)){ok=false;break;}
    if(ok)return {minX,minZ,maxX:minX+width-1,maxZ:minZ+height-1};
  }
  return null;
}

const refuse=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const exact=(c:object,keys:readonly string[]):boolean=>Reflect.ownKeys(c).length===keys.length&&keys.every(k=>Object.hasOwn(c,k));
function tutorialState(w:World):TutorialState347|undefined {return tutorialMode347(w)?w.gameProfile!.tutorial347:undefined;}

/** Lesson AddBillSimpleMeal activation: 75 raw potatoes, not forbidden, at
 * the center of a usable 2x2 rect. Core spawns the stack on that very cell;
 * here it goes to that cell or, when the cell holds another stack, to the
 * nearest one that has room (one stack a cell). */
function givePotatoes(w:World,state:TutorialState347):CommandResult {
  if(state.potatoesAtCore!==undefined)return refuse('Les pommes de terre du tutoriel ont déjà été données.');
  const rect=findUsableRect347(w,2,2);if(!rect)return refuse('Aucun emplacement dégagé près du centre de la carte.');
  const cell=tutorialRectCenter347(rect);
  try{addGroundMaterial(w,'food',TUTORIAL_POTATOES_347,cell,'potato');}catch{return refuse('Pas de place au sol pour les pommes de terre.');}
  state.potatoesAtCore=effectiveCore297(w);
  w.events.push({tick:w.tick,type:'command',message:`${TUTORIAL_POTATOES_347} pommes de terre crues ont été déposées près du centre de la carte.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);
  return {ok:true,affected:1};
}

/** The stone shown around an ore: the nearest natural rock's, else granite. */
function lumpStone(w:World,center:Cell):StoneKind {
  let best:StoneKind|undefined,distance=Infinity;
  for(let i=0;i<w.tiles.length;i++){const t=w.tiles[i]!;if(t.terrain!=='rock'||t.ore!==undefined||!isStoneKind(t.stone))continue;
    const d=(i%w.width-center.x)**2+(Math.floor(i/w.width)-center.z)**2;if(d<distance){distance=d;best=t.stone;}}
  return best??'granite';
}
/** Lesson MineSteel activation: one compacted steel lump of 30 to 40 cells
 * grown around the center of a usable 10x10 rect without items. The lump
 * wipes plants (GenSpawn WipeMode.Vanish) without yield. Adaptations: a cell
 * holding a person, an animal, a job, a floor or bridge, or a non-plant
 * resource is left out of the lump instead of being displaced. */
function scatterSteelLump(w:World,state:TutorialState347):CommandResult {return scatterTutorialSteelLump347(w,state).result;}
/** The same, with the rect and the lump cells (Instruction_MineSteel keeps
 * the steel cells of the rect, schema 349). */
export function scatterTutorialSteelLump347(w:World,state:TutorialState347):{result:CommandResult;rect?:TutorialRect347;cells:number[]} {
  const failed=(reason:string)=>({result:refuse(reason),cells:[] as number[]});
  if(state.steelLumpAtCore!==undefined)return failed('Le filon d’acier du tutoriel a déjà été placé.');
  const rect=findUsableRect347(w,10,10,0,true);if(!rect)return failed('Aucun emplacement dégagé de 10 × 10 près du centre de la carte.');
  const center=tutorialRectCenter347(rect),n=w.width*w.height,occupied=new Uint8Array(n);
  for(const p of w.pawns){occupied[p.z*w.width+p.x]=1;if(p.motion&&p.motion.end>w.tick)occupied[p.motion.from.z*w.width+p.motion.from.x]=1;}
  for(const a of [...w.wildlife?.animals??[],...w.mechanoids??[]])if(a.state!=='dead'){occupied[a.z*w.width+a.x]=1;if(a.motion&&a.motion.end>w.tick)occupied[a.motion.from.z*w.width+a.motion.from.x]=1;}
  for(const j of w.jobs)for(const c of footprintCells(j))if(c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height)occupied[c.z*w.width+c.x]=1;
  for(const r of w.resources)if(!isPlant(r)&&r.kind!=='tree')occupied[r.z*w.width+r.x]=1;
  const allows=(i:number)=>{const t=w.tiles[i]!;return !occupied[i]&&!t.floor&&!t.bridge&&!t.mineable&&!t.collapsedRock&&t.terrain!=='rock'&&isNaturalTerrain256(t.terrain);};
  // RandomInRange (inclusive) then the IrregularLump trimming on a private
  // stream seeded from the gameplay stream; its order is an adaptation.
  const size=TUTORIAL_LUMP_SIZE_347.min+Math.floor(healthRandom(w)*(TUTORIAL_LUMP_SIZE_347.max-TUTORIAL_LUMP_SIZE_347.min+1));
  const random=new WorldGenerationRandom(Math.floor(healthRandom(w)*0x100000000));
  const cells=localIrregularOreLump256(w.width,w.height,center.z*w.width+center.x,size,allows,random);
  if(!cells.length)return failed('Aucune case libre pour le filon d’acier.');
  if(!Number.isSafeInteger(w.nextId+cells.length))return failed('Identités épuisées.');
  const stone=lumpStone(w,center),site3=w.site?.revision===3,wiped=new Set(cells);
  w.resources=w.resources.filter(r=>!wiped.has(r.z*w.width+r.x));
  for(const i of cells){
    const old=w.tiles[i]!,tile:Tile={terrain:'rock',stone,ore:'steel',...old.fogged?{fogged:true}:{},...site3&&isNaturalTerrain256(old.terrain)?{mineable:{id:w.nextId++,def:ORE_MINEABLE_DEFS_256.steel,terrain:old.terrain}}:{}};
    w.tiles[i]=tile;markTerrainCellChanged(w.tiles,i);
  }
  invalidateAnimalPens(w);
  state.steelLumpAtCore=effectiveCore297(w);
  w.events.push({tick:w.tick,type:'command',message:'Un filon d’acier compacté est apparu près du centre de la carte.'});if(w.events.length>80)w.events.splice(0,w.events.length-80);
  return {result:{ok:true,affected:cells.length},rect,cells:[...cells]};
}

/** Lesson DownRaider activation: Core RaidEnemy with the points of one
 * Drifter (35), so only a pirate faction can come; walking in from the edge
 * and attacking at once; its single raider is forced downed (never killed
 * by the downing roll, see population-intent-320.ts). */
function sendRaid(w:World,state:TutorialState347):CommandResult {
  if(state.raidAtCore!==undefined)return refuse('Le raid du tutoriel a déjà été envoyé.');
  const s=w.raids;if(!s||s.profile!=='cassandra-raids-v1'||s.active||s.mechActive||s.extraActive261?.length)return refuse('Un raid est déjà en cours.');
  if(!w.pawns.some(p=>isColonist(p)&&p.state!=='dead'))return refuse('Aucun colon à attaquer.');
  const random={rng:s.rng},pick=w.worldFactions?drawRaidFaction331(w,TUTORIAL_RAID_POINTS_347,()=>raidRandom(random)):undefined;
  if(pick===null||pick&&pick.family!=='pirate')return refuse('Aucune faction hostile ne peut envoyer ce raid.');
  const composition=chooseRaidComposition(TUTORIAL_RAID_POINTS_347,random),count=composition.roster.length;
  const sites=raidEntries(w,s.rng,count);if(!sites)return refuse('Aucune entrée au bord de la carte.');
  const group=createRaidGroup(w,{count,sites,random,composition,...pick?{faction331:{factionId:pick.factionId,family:'pirate' as const}}:{},walkInNow347:true,forceOneDowned347:true});
  if(!group)return refuse('Le raid du tutoriel n’a pas pu entrer sur la carte.');
  if(pick)s.lastFaction331=pick.factionId;
  state.raidAtCore=effectiveCore297(w);
  return {ok:true,affected:group.members.length};
}

/** ChooseStoryteller: the player's storyteller and difficulty replace the
 * Tutor and the tutorial ends (TutorialState.Notify_TutorialEnding sets
 * endTick). Elsewhere offers only Cassandra at Adventure Story; the change
 * is offered only to end the tutorial. Its comps start now: the dormant
 * raid agenda goes on, the disease and visitor calendars are born here with
 * past opportunities discarded (an intro visit still ahead stays), and the
 * other Cassandra calendars are adopted, as for an older save, at the next
 * simulated tick. */
function chooseStoryteller(w:World,state:TutorialState347):CommandResult {
  const root=campaignAuthority(w),core=effectiveCore297(w);
  // Schema 349: TutorialState.Notify_TutorialEnding clears the lessons' state.
  const next:GameProfile={revision:1,storyteller:'cassandra-partial',difficulty:'adventure-story',saveMode:'reloadable',tutorial347:{...endTutorialLessons349(state),endedAtCore:core}};
  root.gameProfile=next;if(w!==root&&w.gameProfile!==next)w.gameProfile=next;
  adoptFluIncidents(w);
  if(!w.visitors){enableVisitors(w);const born=w.visitors as World['visitors']|undefined;if(born&&'introAt'in born&&w.tick<INTRO_VISITOR_TICK)born.introAt=INTRO_VISITOR_TICK;}
  w.events.push({tick:w.tick,type:'command',message:'Fin du tutoriel : Cassandra Classique raconte désormais votre histoire, en Récit d’aventure.'});if(w.events.length>80)w.events.splice(0,w.events.length-80);
  return {ok:true};
}

export function applyTutorialCommand347(w:World,c:TutorialContentCommand347):CommandResult {
  if(!c||typeof c!=='object')return refuse('Commande invalide.');
  const state=tutorialState(w);
  if(!isSchema347OrLater(Number(w.schemaVersion))||!state)return refuse('Cette commande n’existe que pendant le tutoriel.');
  switch(c.type){
    case 'tutorial-potatoes':return exact(c,['type'])?givePotatoes(w,state):refuse('Commande invalide.');
    case 'tutorial-steel-lump':return exact(c,['type'])?scatterSteelLump(w,state):refuse('Commande invalide.');
    case 'tutorial-raid':return exact(c,['type'])?sendRaid(w,state):refuse('Commande invalide.');
    case 'choose-storyteller':return exact(c,['type','storyteller','difficulty'])&&c.storyteller==='cassandra-partial'&&c.difficulty==='adventure-story'?chooseStoryteller(w,state):refuse('Narrateur ou difficulté non disponible.');
    default:return refuse('Commande invalide.');
  }
}
