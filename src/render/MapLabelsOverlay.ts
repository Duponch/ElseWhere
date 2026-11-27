import {knownPile256,knownPosition256} from '../ui/exploration-readers-256';
import {explorationEnabled256} from '../sim/exploration-state-256';
import type { OrthographicCamera, PerspectiveCamera } from 'three/webgpu';
import { QUALITY_LABELS, type WeaponQuality } from '../sim/equipment-rules';
import { ITEM_DEFINITIONS } from '../sim/items';
import type { MaterialPile, World } from '../sim/types';
import { MapLabelBatch } from './MapLabelBatch';
import {DEFAULT_ITEM_LABEL_MIN_CELL_PIXELS,itemLabelMinCellPixels} from '../ui/item-label-visibility';
import {pileIdentitySurfacesFromCells,pileShelfCells,pileSurfaces,type PileShelfCell,type PileSurface} from './pile-surfaces';
import {packedLabelAnchor,pileLabelAnchor} from './map-label-anchors';
import {bedOwnerLabelEntries} from './bed-owner-labels';
import type {MapLabelEntry} from './MapLabelBatch';

export const PILE_LABEL_MIN_CELL_PIXELS = DEFAULT_ITEM_LABEL_MIN_CELL_PIXELS;

const QUALITY_SHORT: Readonly<Record<WeaponQuality, string>> = {
  awful: 'dépl.', poor: 'médi.', normal: 'norm.', good: 'bon',
  excellent: 'exc.', masterwork: 'chef-d’œuvre', legendary: 'lég.',
};

function pileCaption(pile: MaterialPile): string {
  // Core labels even a single unit when the thing's stack limit is above one.
  if (ITEM_DEFINITIONS[pile.item].stackLimit > 1) return String(pile.quantity);
  const quality = pile.weapon?.quality ?? pile.apparel?.quality;
  if (quality) return QUALITY_SHORT[quality] ?? QUALITY_LABELS[quality];
  return '';
}

function samePileLabels(a: World['piles'] | undefined, b: World['piles'],shelves=false): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < b.length; i++) {
    const before = a[i]!, after = b[i]!;
    // Even an uncaptioned weapon can change the level occupied by a labelled
    // stack. With shelves, track every physical ground identity and position.
    if(shelves&&(before.id!==after.id||before.owner.type!==after.owner.type||before.owner.type==='ground'&&after.owner.type==='ground'&&(before.owner.x!==after.owner.x||before.owner.z!==after.owner.z)))return false;
    const oldLabel = before.owner.type === 'ground' ? pileCaption(before) : '';
    const newLabel = after.owner.type === 'ground' ? pileCaption(after) : '';
    if (oldLabel !== newLabel || oldLabel && (before.id!==after.id || before.item!==after.item || before.owner.type !== 'ground' ||
      after.owner.type !== 'ground' || before.owner.x !== after.owner.x || before.owner.z !== after.owner.z)) return false;
  }
  return true;
}

function packedCaption(packed: World['packed'][number]): string {
  return packed.owner.type === 'ground' && packed.building.quality
    ? QUALITY_SHORT[packed.building.quality] : '';
}

function samePackedLabels(a: World['packed'] | undefined, b: World['packed']): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < b.length; i++) {
    const before = a[i]!, after = b[i]!;
    const oldLabel = packedCaption(before), newLabel = packedCaption(after);
    if (oldLabel !== newLabel || oldLabel && (before.building.kind!==after.building.kind || before.owner.type !== 'ground' ||
      after.owner.type !== 'ground' || before.owner.x !== after.owner.x || before.owner.z !== after.owner.z)) return false;
  }
  return true;
}

function sameSurfaces(a:ReadonlyMap<number,PileSurface>,b:ReadonlyMap<number,PileSurface>):boolean {
  if(a.size!==b.size)return false;
  for(const [cell,value]of a){const next=b.get(cell);if(!next||value.x!==next.x||value.y!==next.y||value.z!==next.z||value.scale!==next.scale||value.scaleHeight!==next.scaleHeight)return false;}
  return true;
}
function sameShelfCells(a:ReadonlyMap<number,PileShelfCell>,b:ReadonlyMap<number,PileShelfCell>):boolean {
  if(a.size!==b.size)return false;
  for(const [cell,value]of a){const next=b.get(cell);if(!next||value.id!==next.id||value.orientation!==next.orientation)return false;}
  return true;
}

/** Physical captions indexed at snapshot changes. The resident GPU batch owns
 * camera projection and depth rejection, with no per-label camera work here. */
export class MapLabelsOverlay {
  private readonly batch = new MapLabelBatch();
  readonly mesh = this.batch.mesh;
  private sourcePiles: World['piles'] | undefined;
  private sourcePacked: World['packed'] | undefined;
  private sourceStructures:World['structures']|undefined;
  private sourcePawns:World['pawns']|undefined;
  private bedLabels:readonly MapLabelEntry[]=[];
  private bedLabelsVisible=true;
  private bedLabelsDirty=false;
  private supportCells:ReadonlyMap<number,PileSurface>=new Map();
  private shelfCells:ReadonlyMap<number,PileShelfCell>=new Map();
  private sourceWorld:World|undefined;
  private explorationRevision:number|undefined;
  private explorationEnabled=false;
  private sourceWidth = -1;
  private chunks: { entries: { x: number; y:number; z: number; label: string;pileId?:number;shelf?:boolean;offsetY:number }[] }[] = [];
  private minCellPixels=PILE_LABEL_MIN_CELL_PIXELS;
  setMinCellPixels(value:number):void {this.minCellPixels=itemLabelMinCellPixels(value);}
  setBedOwnerLabelsVisible(visible:boolean):void {if(this.bedLabelsVisible!==visible){this.bedLabelsVisible=visible;this.bedLabelsDirty=true;}}

  constructor(_host?: HTMLElement) {}

  prepareForCompile():()=>void {return this.batch.prepareForCompile();}

  private index(world: World,explorationRevision?:number): boolean {
    // Stable camera frames consume only uniforms. These are the actual
    // immutable MAIN sources; changed publications still pass the full checks.
    if(!this.bedLabelsDirty&&this.sourceWorld===world&&this.sourcePiles===world.piles&&this.sourcePacked===world.packed
      &&this.sourceStructures===world.structures&&this.sourcePawns===world.pawns&&this.sourceWidth===world.width
      &&this.explorationRevision===explorationRevision)return false;
    // Structure snapshots are immutable in the private MAIN. Compare the real
    // support geometry only when that source changes, never on camera motion.
    let supportsChanged=false;
    if(this.sourceStructures!==world.structures||this.sourceWidth!==world.width){
      const cells=pileSurfaces(world),shelves=pileShelfCells(world);
      if(!sameSurfaces(this.supportCells,cells)){this.supportCells=cells;supportsChanged=true;}
      if(!sameShelfCells(this.shelfCells,shelves)){this.shelfCells=shelves;supportsChanged=true;}
    }
    const enabled=explorationEnabled256(world);
    const sameExploration=this.explorationEnabled===enabled&&(!enabled||(explorationRevision===undefined?this.sourceWorld===world:this.explorationRevision===explorationRevision));
    const nextBeds=this.bedLabelsVisible?bedOwnerLabelEntries(world):[];
    const sameBeds=this.bedLabels.length===nextBeds.length&&this.bedLabels.every((before,i)=>{
      const after=nextBeds[i]!;return before.x===after.x&&before.y===after.y&&before.z===after.z&&before.label===after.label&&before.offsetY===after.offsetY;
    });
    const unchanged = sameExploration && this.sourceWidth === world.width &&
      !supportsChanged&&sameBeds&&samePileLabels(this.sourcePiles, world.piles,this.shelfCells.size>0) && samePackedLabels(this.sourcePacked, world.packed);
    this.bedLabels=nextBeds;this.bedLabelsDirty=false;this.sourcePawns=world.pawns;
    this.sourceWorld=world;this.explorationEnabled=enabled;this.explorationRevision=explorationRevision;
    this.sourcePiles = world.piles; this.sourcePacked = world.packed; this.sourceWidth = world.width;
    this.sourceStructures=world.structures;
    if (unchanged) return false;
    const chunks = new Map<number, typeof this.chunks[number]>(), occupied = new Map<number,number>();
    const add = (x: number, z: number, label: string,y=.32,pileId?:number,shelf=false): void => {
      if (!label) return;
      const cx = Math.floor(x / 16), cz = Math.floor(z / 16), key = cz * Math.ceil(world.width / 16) + cx;
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = {entries: []};
        chunks.set(key, chunk);
      }
      // Ground stacks share one physical anchor. Shelf stacks already have
      // distinct physical levels/slots; do not regroup them as the camera turns.
      const cell=z*world.width+x,overlap=shelf?0:occupied.get(cell)??0;
      if(!shelf)occupied.set(cell,overlap+1);
      chunk.entries.push({ x,y, z, label,pileId,shelf,offsetY:Math.min(overlap,3)*12 });
    };
    const supports=pileIdentitySurfacesFromCells(world.width,world.piles,this.shelfCells);
    for (const pile of world.piles) if (pile.owner.type === 'ground'&&knownPile256(world,pile)){
      const label=pileCaption(pile);if(!label)continue;
      const support=supports.get(pile.id)??this.supportCells.get(pile.owner.z*world.width+pile.owner.x),anchor=pileLabelAnchor(pile,support);
      add(anchor.x,anchor.z,label,anchor.y,pile.id,support?.shelfId!==undefined);
    }
    for (const packed of world.packed) if (packed.owner.type === 'ground'&&knownPosition256(world,packed.owner)){
      const label=packedCaption(packed);if(!label)continue;
      const anchor=packedLabelAnchor(packed,this.supportCells.get(packed.owner.z*world.width+packed.owner.x));
      add(anchor.x,anchor.z,label,anchor.y);
    }
    this.chunks = [...chunks.values()];
    this.batch.update([...this.chunks.flatMap(chunk=>chunk.entries),...this.bedLabels]);
    return true;
  }

  draw(world: World | null | undefined, camera: OrthographicCamera | PerspectiveCamera, cellPixels: number, width: number, height: number,explorationRevision?:number): void {
    // At other scales this exit avoids the pile scan and the draw altogether.
    if (!world || cellPixels < this.minCellPixels || !width || !height) {
      this.mesh.visible=false;
      return;
    }
    this.index(world,explorationRevision);
    this.batch.present(camera,height,cellPixels,this.minCellPixels);
  }

  dispose(): void { this.batch.dispose(); }
}
