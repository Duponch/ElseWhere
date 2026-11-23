import {geyserInspection256} from './geyser-inspection-256';
import {knownPosition256} from './exploration-readers-256';
import {UNDISCOVERED_CELL_LABEL_256} from '../sim/exploration-visibility-256';
import {roofKindAt} from '../sim/roof-rules';
import { ITEM_DEFINITIONS } from '../sim/items';
import { LightEnvironmentCache, type LightEnvironment } from '../sim/light-environment';
import { soilFertility } from '../sim/soil';
import type { Cell, Tile, World } from '../sim/types';
import { terrainSurfaceLabel,terrainSurfaceWalkable,TERRAIN_LABELS } from './terrain-inspection';
import { terrainTravelDelay } from '../sim/furniture-travel';
import { buildingLabels } from './building-labels';
import { floraDefinition } from '../sim/biome-flora';
import { rockInspection, rockThingLabel } from './geology-inspection';
import { PLANT_DEFINITIONS, plantGrowth } from '../sim/plants';
import type { CropKind } from '../sim/crops';
import { mechanoidDefinition } from '../sim/mechanoid-definition';
import { STONE_LABELS } from '../sim/geology';
import { snowDepthAt } from '../sim/snow-surface';
import { FILTH_DEFINITIONS } from '../sim/filth-rules';
import { isConstruction } from '../sim/construction-rules';
import { footprintContains } from '../sim/definitions';
import { carrierOf } from '../sim/rescue-state';
import { isColonist } from '../sim/affiliation';
import { pawnShortName } from './pawn-short-name';
import { animalSpecies } from '../sim/animal-species';
import { geyserAt256 } from '../sim/local-geyser-state-256';

const lightCache=new LightEnvironmentCache();

/** Pointer movement may cross dozens of cells between simulation snapshots.
 * Reuse the same lighting solution within a short readout interval instead of
 * rescanning every map tile and light source for each pointer event. */
export class MapHoverLightCache {
  private readonly cache=new LightEnvironmentCache();
  private environment?:LightEnvironment;
  private lastAt=-Infinity;
  private lastTick=Infinity;
  private lastSeed?:number;
  private lastWidth=0;
  private lastHeight=0;
  lightAt(world:World,cell:Cell,now:number):number {
    if(!knownPosition256(world,cell))return 0;
    if(!this.environment||now-this.lastAt>=250||world.tick<this.lastTick||world.seed!==this.lastSeed||world.width!==this.lastWidth||world.height!==this.lastHeight){
      this.environment=this.cache.read(world);
      this.lastAt=now;this.lastTick=world.tick;this.lastSeed=world.seed;this.lastWidth=world.width;this.lastHeight=world.height;
    }
    return this.environment.lightAt(cell);
  }
}

/** Core GlowGrid.PsychGlowAtGlow and PsychGlowUtility.GetLabel (labels
 * adapted). MouseoverUtility.GetGlowLabelByValue writes the rounded percent. */
export function glowLabel(glow:number):string {
  const value=Math.max(0,Math.min(1,glow));
  return `${value>.9?'Très éclairé':value>.3?'Éclairé':'Sombre'} (${Math.round(value*100)} %)`;
}
/** Core GenPath.SpeedPercentString: 13 / (pathCost + 13), rounded. */
const speedPercent=(pathCostCore:number):number=>Math.round(13/(pathCostCore+13)*100);
const cap=(text:string):string=>text.charAt(0).toLocaleUpperCase('fr')+text.slice(1);
/** Core WeatherBuildupUtility: category of a snow depth, its description and
 * the movement ticks it adds. */
function snowLine(depth:number):string|undefined {
  if(!(depth>.03))return undefined;
  const [label,addOn]=depth<.25?['poudreuse',0]:depth<.5?['fine',4]:depth<.75?['moyenne',8]:['épaisse',12];
  return `Neige (${label}) (vitesse de marche ${speedPercent(addOn as number)} %)`;
}
/** The terrain under a natural rock Thing: Core's rock walls stand on their
 * rough stone floor, which keeps its label and walk speed in the readout. */
function terrainLine(world:World,index:number):string {
  const tile=world.tiles[index]!;
  const ground:Tile=tile.terrain==='rock'&&!tile.collapsedRock?{terrain:'rough-stone',...tile.stone?{stone:tile.stone}:{}}:tile;
  const label=ground.bridge?'Pont':ground.terrain==='rough-stone'&&!ground.floor?(ground.stone?`${STONE_LABELS[ground.stone]} ${ground.stone==='slate'?'brute':'brut'}`:TERRAIN_LABELS['rough-stone']):terrainSurfaceLabel(ground);
  if(tile.collapsedRock||!terrainSurfaceWalkable(ground,world))return label;
  const delay=ground===tile?terrainTravelDelay(world,index):terrainTravelDelay({...world,tiles:[ground]},0);
  const fertility=ground.floor||ground.bridge?0:soilFertility(ground.terrain);
  return `${label} (vitesse de marche ${speedPercent(delay*10)} %${fertility>.0001?` fert. ${Math.round(fertility*100)} %`:''})`;
}
/** Core RoofDef labels (RoofConstructed, RoofRockThin, RoofRockThick). */
const ROOF_LABELS={constructed:'Toit construit','natural-thin':'Toit de roche mince','natural-thick':'Montagne au-dessus'} as const;

/** Core Verse.MouseoverReadout, in its order from the bottom line up: glow,
 * terrain (walk speed, fertility), zone, snow, then every Thing of the cell by
 * its LabelMouseover (building or natural rock, plants with their growth,
 * items with their count, filth with its thickness, blueprints and frames,
 * people and animals), and the roof. The returned list is top line first, as
 * drawn. Designations, path costs and building supports are not part of it. */
export function mapHoverLines(world:World,cell:Cell,lightLevel?:number):string[] {
  const index=cell.z*world.width+cell.x,tile=world.tiles[index];
  if(!tile)return [];
  if(!knownPosition256(world,cell))return [UNDISCOVERED_CELL_LABEL_256];
  const same=(other:Cell)=>other.x===cell.x&&other.z===cell.z;
  const lines:string[]=[glowLabel(lightLevel??lightCache.read(world).lightAt(cell)),terrainLine(world,index)];
  if(world.growingZones.some(z=>z.cells.includes(index)))lines.push('Zone de culture');
  else if(world.stockpiles.some(same))lines.push('Zone de stockage');
  const snow=snowLine(snowDepthAt(world,index));if(snow)lines.push(snow);
  if(tile.terrain==='rock')lines.push(rockThingLabel(tile));
  const geyser=geyserAt256(world,cell);if(geyser){const info=geyserInspection256(world,geyser.id);if(info)lines.push(info.title);}
  for(const structure of world.structures)if(footprintContains(structure,cell))lines.push(buildingLabels[structure.kind]);
  for(const resource of world.resources)if(same(resource)){
    if(resource.kind==='rock'){lines.push(rockInspection(tile,resource)?.title??'Rochers');continue;}
    const label=floraDefinition(resource)?.label??((resource.kind in PLANT_DEFINITIONS)?PLANT_DEFINITIONS[resource.kind as CropKind].label:resource.kind==='tree'?'Arbre':resource.kind);
    // Core Plant.LabelMouseover: « label (N % grown) ».
    lines.push(`${cap(label)} (croissance ${Math.round(plantGrowth(world,resource)*100)} %)`);
  }
  const corpses=new Set<number>();
  for(const pile of world.piles)if(pile.owner.type==='ground'&&same(pile.owner)){
    if(pile.humanCorpse)corpses.add(pile.humanCorpse.pawnId);
    // Core GenLabel.ThingLabel: the count only above one.
    lines.push(pile.quantity>1?`${ITEM_DEFINITIONS[pile.item].label} ×${pile.quantity}`:ITEM_DEFINITIONS[pile.item].label);
  }
  for(const packed of world.packed)if(packed.owner.type==='ground'&&same(packed.owner))lines.push(`${buildingLabels[packed.building.kind]} (emballé)`);
  // Core Filth.Label: « label xThickness ».
  for(const filth of world.filth?.items??[])if(same(filth))lines.push(`${FILTH_DEFINITIONS[filth.kind].label} ×${filth.thickness}`);
  // Blueprint and Frame labels; designations are not Things.
  for(const job of world.jobs)if(isConstruction(job)&&job.kind in buildingLabels&&footprintContains(job,cell))
    lines.push(`${buildingLabels[job.kind as keyof typeof buildingLabels]} (${job.construction==='frame'?'en construction':'plan'})`);
  for(const pawn of world.pawns)if(same(pawn)&&!corpses.has(pawn.id)&&!carrierOf(world,pawn.id))
    lines.push(pawn.state==='dead'?`Cadavre de ${pawn.name}`:isColonist(pawn)&&!pawn.prisoner?pawnShortName(pawn.name):pawn.name);
  for(const animal of world.wildlife?.animals??[])if(same(animal)){const label=animalSpecies(animal.species).label;lines.push(animal.state==='dead'?`Cadavre de ${label}`:cap(label));}
  for(const mech of world.mechanoids??[])if(same(mech))lines.push(cap(mechanoidDefinition(mech.mechKind).label));
  const roof=roofKindAt(world,index);if(roof)lines.push(ROOF_LABELS[roof]);
  return lines.reverse();
}
