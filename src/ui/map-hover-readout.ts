import {geyserInspection256} from './geyser-inspection-256';
import {knownPosition256} from './exploration-readers-256';
import {UNDISCOVERED_CELL_LABEL_256} from '../sim/exploration-visibility-256';
import {roofKindAt} from '../sim/roof-rules';
import { ITEM_DEFINITIONS } from '../sim/items';
import { LightEnvironmentCache, type LightEnvironment } from '../sim/light-environment';
import { soilFertility } from '../sim/soil';
import type { Cell, World } from '../sim/types';
import { terrainSurfaceLabel,bridgeTerrainNote,terrainSurfaceSpeed,terrainAffordanceNote } from './terrain-inspection';
import { mapObjectsAt } from './map-object-selection';
import { selectedMapJob296 } from './wall-door-selection-296';
import { buildingLabels } from './building-labels';
import { floraDefinition } from '../sim/biome-flora';
import { rockInspection } from './geology-inspection';
import { PLANT_DEFINITIONS } from '../sim/plants';
import type { CropKind } from '../sim/crops';
import { mechanoidDefinition } from '../sim/mechanoid-definition';

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

/** Mouseover information is independent from selection and has no map overlay. */
export function mapHoverLines(world:World,cell:Cell,lightLevel?:number):string[] {
  const index=cell.z*world.width+cell.x,tile=world.tiles[index];
  if(!tile)return [];
  if(!knownPosition256(world,cell))return [UNDISCOVERED_CELL_LABEL_256];
  const label=terrainSurfaceLabel(tile);
  const speed=terrainSurfaceSpeed(world,index);
  const ground=`${label} (vitesse de déplacement ${speed} %, fertilité ${tile.floor||tile.bridge?0:Math.round(soilFertility(tile.terrain)*100)} %)`+(terrainAffordanceNote(tile,world)&&!tile.bridge?` · ${terrainAffordanceNote(tile,world)}`:tile.terrain==='water-shallow'&&!tile.bridge?' · Marche : +3 ticks · Terrain non cultivable · Support de construction ordinaire absent':'');
  const light=Math.round((lightLevel??lightCache.read(world).lightAt(cell))*100);
  const objects=mapObjectsAt(world,cell).flatMap(selected=>{
    switch(selected.kind){
      case 'geyser': {const info=geyserInspection256(world,selected.id);return info?[info.title]:[];}
      case 'pile': {const pile=world.piles.find(p=>p.id===selected.id);return pile?[`${ITEM_DEFINITIONS[pile.item].label} ×${pile.quantity}`]:[];}
      case 'packed': {const packed=world.packed.find(p=>p.building.id===selected.id);return packed?[`Meuble emballé · ${buildingLabels[packed.building.kind]}`]:[];}
      case 'structure': {const structure=world.structures.find(s=>s.id===selected.id);return structure?[`${buildingLabels[structure.kind]}${structure.kind==='cryptosleep-casket'?(structure.cryptosleep?.human?' · occupé':' · vide'):''}${structure.kind==='fermenting-barrel'&&structure.fermentation?structure.fermentation.ruin>=1?' · contenu perdu':structure.fermentation.wort?` · ${structure.fermentation.wort} ${structure.fermentation.progress>=1?'bières prêtes':`moûts · ${Math.floor(structure.fermentation.progress*100)} %`}`:' · vide':''}${structure.breakdown?' · Panne mécanique':''}`]:[];}
      case 'resource': {const resource=world.resources.find(r=>r.id===selected.id);return resource?[rockInspection(tile,resource)?.title??floraDefinition(resource)?.label??((resource.kind in PLANT_DEFINITIONS)?PLANT_DEFINITIONS[resource.kind as CropKind].label:resource.kind==='tree'?'Arbre':resource.kind)]:[];}
      case 'rock':return [rockInspection(tile)?.title??'Massif rocheux'];
      case 'job': {const job=selectedMapJob296(world,selected.id);return job?[`Ordre · ${job.kind==='smooth-floor'?'Lisser le sol':job.kind==='smooth-wall'?'Lisser le mur':job.kind==='fix-breakdown'?'Remplacer le composant':world.jobs.some(j=>j.wallDoor296?.plan?.id===selected.id)?`Plan de ${buildingLabels[job.kind as keyof typeof buildingLabels]} · mur à démonter`:job.kind}`]:[];}
      case 'growing':return ['Zone de culture'];
      case 'stockpile':return ['Réserve'];
    }
  });
  for(const mech of world.mechanoids??[])if(mech.x===cell.x&&mech.z===cell.z)objects.push(`${mechanoidDefinition(mech.mechKind).label} ${mech.id} · ${mech.state==='dead'?'neutralisé':mech.state==='downed'?'incapacité mécanique':'hostile'}`);
  return [ground,...(tile.bridge?[bridgeTerrainNote(tile)]:[]),`Lumière : ${light} %`,...objects,...(roofKindAt(world,index)?[roofKindAt(world,index)==='natural-thick'?'Toit naturel épais':roofKindAt(world,index)==='natural-thin'?'Toit naturel mince':'Toit']:[])];
}
