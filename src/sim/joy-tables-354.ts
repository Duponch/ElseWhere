import type { Cell, Orientation } from './types.ts';

/** Schema 354: the four Core joy buildings Elsewhere lacked (Buildings_Joy.xml,
 * JoyGivers.xml, Jobs_Joy.xml of RimWorld 1.6). Below 354 none of these
 * kinds, activities or fields exist and every draw stays untouched. */
export const JOY_TABLES_SCHEMA_354=354;
export const isJoyTablesSchema354=(version:unknown):boolean=>Number(version)>=JOY_TABLES_SCHEMA_354;

export const JOY_TABLE_KINDS_354=['hoopstone-ring','billiards-table','game-of-ur-board','poker-table'] as const;
export type JoyTableKind354=typeof JOY_TABLE_KINDS_354[number];
export const isJoyTableKind354=(value:unknown):value is JoyTableKind354=>typeof value==='string'&&(JOY_TABLE_KINDS_354 as readonly string[]).includes(value);

/** JoyGiverDef order in Core: Play_Hoopstone, Play_Billiards, Play_GameOfUr,
 * then Play_Chess, then Play_Poker. */
export const JOY_TABLE_ACTIVITIES_354=['hoopstone','billiards','game-of-ur','poker'] as const;
export type JoyTableActivity354=typeof JOY_TABLE_ACTIVITIES_354[number];
export const isJoyTableActivity354=(value:unknown):value is JoyTableActivity354=>typeof value==='string'&&(JOY_TABLE_ACTIVITIES_354 as readonly string[]).includes(value);

export interface JoyTableFacts354 {
  readonly kind:JoyTableKind354;
  readonly defName:string;
  readonly activity:JoyTableActivity354;
  /** JoyKindDef: Gaming_Dexterity or Gaming_Cerebral. */
  readonly joyKind:'dexterity'|'cerebral';
  readonly label:string;
  readonly activityLabel:string;
  readonly width:number;
  readonly depth:number;
  readonly rotatable:boolean;
  /** costStuffCount, Metallic/Woody/Stony. */
  readonly stuff:number;
  /** costList beside the stuff (Cloth, WoodLog). */
  readonly cloth:number;
  readonly wood:number;
  /** WorkToBuild in Core ticks, before the stuff work factor. */
  readonly coreWork:number;
  readonly constructionSkill:number;
  readonly research:'complex-furniture'|null;
  /** maxTechLevelToBuild Neolithic: Designator_Build hides it for a richer player faction. */
  readonly neolithicOnly:boolean;
  readonly maxHitPoints:number;
  readonly beauty:number;
  readonly mass:number;
  readonly fillPercent:number;
  readonly passability:'standable'|'pass-through';
  readonly affordance:'Light'|'Medium';
  readonly quality:boolean;
  /** JoyGainFactor before the quality factor. */
  readonly joyGainFactor:number;
  /** JoyGiverDef baseChance. */
  readonly baseChance:number;
  /** JobDef joyMaxParticipants. */
  readonly maxParticipants:number;
  readonly skill:'shooting'|'intellectual';
  /** JobDef joyXpPerTick, per Core tick. */
  readonly xpPerCoreTick:number;
  readonly needsSight:boolean;
}
const facts=(value:JoyTableFacts354):JoyTableFacts354=>Object.freeze(value);
export const JOY_TABLES_354:Readonly<Record<JoyTableKind354,JoyTableFacts354>>=Object.freeze({
  'hoopstone-ring':facts({kind:'hoopstone-ring',defName:'HoopstoneRing',activity:'hoopstone',joyKind:'dexterity',label:'Anneau de lancer de pierres',activityLabel:'lancer des pierres dans l’anneau',
    width:1,depth:1,rotatable:false,stuff:20,cloth:0,wood:0,coreWork:100,constructionSkill:0,research:null,neolithicOnly:true,maxHitPoints:100,beauty:0,mass:4,fillPercent:0,passability:'standable',affordance:'Light',quality:false,
    joyGainFactor:1,baseChance:2,maxParticipants:3,skill:'shooting',xpPerCoreTick:.003,needsSight:false}),
  'billiards-table':facts({kind:'billiards-table',defName:'BilliardsTable',activity:'billiards',joyKind:'dexterity',label:'Table de billard',activityLabel:'jouer au billard',
    width:2,depth:3,rotatable:true,stuff:80,cloth:80,wood:30,coreWork:12000,constructionSkill:6,research:'complex-furniture',neolithicOnly:false,maxHitPoints:250,beauty:0,mass:60,fillPercent:.4,passability:'pass-through',affordance:'Medium',quality:true,
    joyGainFactor:1.3,baseChance:4,maxParticipants:2,skill:'shooting',xpPerCoreTick:.004,needsSight:true}),
  'game-of-ur-board':facts({kind:'game-of-ur-board',defName:'GameOfUrBoard',activity:'game-of-ur',joyKind:'cerebral',label:'Plateau du jeu royal d’Ur',activityLabel:'jouer au jeu royal d’Ur',
    width:1,depth:1,rotatable:true,stuff:35,cloth:0,wood:0,coreWork:6000,constructionSkill:0,research:null,neolithicOnly:true,maxHitPoints:90,beauty:2,mass:2,fillPercent:.2,passability:'pass-through',affordance:'Light',quality:true,
    joyGainFactor:.8,baseChance:2,maxParticipants:2,skill:'intellectual',xpPerCoreTick:.0015,needsSight:false}),
  'poker-table':facts({kind:'poker-table',defName:'PokerTable',activity:'poker',joyKind:'cerebral',label:'Table de poker',activityLabel:'jouer au poker',
    width:2,depth:2,rotatable:false,stuff:50,cloth:50,wood:25,coreWork:10000,constructionSkill:6,research:'complex-furniture',neolithicOnly:false,maxHitPoints:250,beauty:0,mass:30,fillPercent:.4,passability:'pass-through',affordance:'Light',quality:true,
    joyGainFactor:1.3,baseChance:4,maxParticipants:4,skill:'intellectual',xpPerCoreTick:.004,needsSight:true}),
});
export const JOY_TABLE_BY_ACTIVITY_354:Readonly<Record<JoyTableActivity354,JoyTableFacts354>>=Object.freeze({
  hoopstone:JOY_TABLES_354['hoopstone-ring'],billiards:JOY_TABLES_354['billiards-table'],
  'game-of-ur':JOY_TABLES_354['game-of-ur-board'],poker:JOY_TABLES_354['poker-table'],
});
/** JobDriver_PlayBilliards.ShotDuration 600 Core ticks, ten Core ticks per local tick. */
export const BILLIARDS_SHOT_TICKS_354=60;
/** JoyGiverDef.requireChair: true by default, false for Play_GameOfUr. */
export const joyTableRequiresChair354=(activity:JoyTableActivity354):boolean=>activity==='poker';
/** JoyGainFactor quality part (StatPart_Quality of Stats_Building_Special). */
const QUALITY_JOY_354:Readonly<Record<string,number>>=Object.freeze({awful:.76,poor:.88,normal:1,good:1.12,excellent:1.24,masterwork:1.4,legendary:1.8});
export const joyTableGainFactor354=(kind:JoyTableKind354,quality:unknown):number=>{
  const f=JOY_TABLES_354[kind];return Math.max(.3,f.joyGainFactor*(f.quality?QUALITY_JOY_354[typeof quality==='string'?quality:'normal']??1:1));
};
/** Learn per local tick: joyXpPerTick of the JobDef, ten Core ticks. */
export const joyTableXpPerTick354=(activity:JoyTableActivity354):number=>Math.round(JOY_TABLE_BY_ACTIVITY_354[activity].xpPerCoreTick*10000);

const DIRECTIONS=[[0,1],[1,0],[0,-1],[-1,0]] as const;
/** Anchor cell plus `depth` cells along the orientation and `width` across,
 * as the other rotatable multi-cell furniture (table 2×4). */
export function joyTableCells354(kind:JoyTableKind354,anchor:Cell,orientation:Orientation|number=0):Cell[] {
  const f=JOY_TABLES_354[kind];if(f.width===1&&f.depth===1)return [{x:anchor.x,z:anchor.z}];
  const o=f.rotatable?orientation:0,d=DIRECTIONS[((o%4)+4)%4]!,side=DIRECTIONS[(((o+1)%4)+4)%4]!,cells:Cell[]=[];
  for(let a=0;a<f.depth;a++)for(let b=0;b<f.width;b++)cells.push({x:anchor.x+d[0]*a+side[0]*b,z:anchor.z+d[1]*a+side[1]*b});
  return cells;
}
export function joyTableContains354(kind:JoyTableKind354,anchor:Cell,orientation:Orientation|number,cell:Cell):boolean {
  const f=JOY_TABLES_354[kind];if(f.width===1&&f.depth===1)return cell.x===anchor.x&&cell.z===anchor.z;
  const o=f.rotatable?orientation:0,d=DIRECTIONS[((o%4)+4)%4]!,side=DIRECTIONS[(((o+1)%4)+4)%4]!;
  const dx=cell.x-anchor.x,dz=cell.z-anchor.z,along=dx*d[0]+dz*d[1],across=dx*side[0]+dz*side[1];
  return along>=0&&along<f.depth&&across>=0&&across<f.width&&dx===d[0]*along+side[0]*across&&dz===d[1]*along+side[1]*across;
}
const bounds=(cells:readonly Cell[])=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const c of cells){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x);minZ=Math.min(minZ,c.z);maxZ=Math.max(maxZ,c.z);}return {minX,maxX,minZ,maxZ};};
/** OccupiedRect().ExpandedBy(1) minus the rect: the 8-way adjacent ring
 * (RandomAdjacentCell8Way, ThingHasStandableSpaceOnAllSides). */
export function joyTableRing354(cells:readonly Cell[]):Cell[] {
  const b=bounds(cells),ring:Cell[]=[];
  for(let z=b.minZ-1;z<=b.maxZ+1;z++)for(let x=b.minX-1;x<=b.maxX+1;x++)if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)ring.push({x,z});
  return ring;
}
/** GenAdjFast.AdjacentCellsCardinal of the occupied rect. */
export function joyTableCardinal354(cells:readonly Cell[]):Cell[] {
  const b=bounds(cells),out:Cell[]=[];
  for(let x=b.minX;x<=b.maxX;x++)out.push({x,z:b.minZ-1},{x,z:b.maxZ+1});
  for(let z=b.minZ;z<=b.maxZ;z++)out.push({x:b.minX-1,z},{x:b.maxX+1,z});
  return out;
}
export const inJoyTableRing354=(cells:readonly Cell[],cell:Cell):boolean=>{const b=bounds(cells);return cell.x>=b.minX-1&&cell.x<=b.maxX+1&&cell.z>=b.minZ-1&&cell.z<=b.maxZ+1&&!(cell.x>=b.minX&&cell.x<=b.maxX&&cell.z>=b.minZ&&cell.z<=b.maxZ);};
export const joyTableCardinalCell354=(cells:readonly Cell[],cell:Cell):boolean=>{const b=bounds(cells);
  return (cell.x>=b.minX&&cell.x<=b.maxX&&(cell.z===b.minZ-1||cell.z===b.maxZ+1))||(cell.z>=b.minZ&&cell.z<=b.maxZ&&(cell.x===b.minX-1||cell.x===b.maxX+1));};

/** Designator_Build.Visible: maxTechLevelToBuild Neolithic (TechLevel 2) hides
 * the hoopstone ring and the Game of Ur board from a richer player faction.
 * Every Elsewhere scenario so far starts as PlayerColony (Industrial, 4), the
 * literal pre-registry worlds included. */
export const NEOLITHIC_TECH_LEVEL_354=2;
export function joyTableTechAllows354(kind:JoyTableKind354,world:{worldFactions?:{playerFactionId:number;factions:readonly {id:number;def:string}[]}}):boolean {
  if(!JOY_TABLES_354[kind].neolithicOnly)return true;
  const registry=world.worldFactions,def=registry?.factions.find(f=>f.id===registry.playerFactionId)?.def;
  return (def==='PlayerTribe'?2:4)<=NEOLITHIC_TECH_LEVEL_354;
}
