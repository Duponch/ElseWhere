import * as THREE from 'three/webgpu';
import { attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, positionGeometry, texture, uniform, uv, vec2, vec4 } from 'three/tsl';
import { perspectiveDetailRange, screenSpriteScale } from './map-overlay-detail';
import {JOURNAL_PICTOGRAMS,type JournalPictogram} from '../ui/journal-events';
import {drawJournalPictogram} from '../ui/journal-pictograms';

export interface MapLabelEntry {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly label: string;
  /** Optional sRGB ink for a dedicated tinted annotation batch. Ordinary
   * inventory labels keep the original atlas and vertex layout. */
  readonly color?:number;
  /** CSS pixels below the anchor, fixed when the label data changes. */
  readonly offsetY?: number;
  /** Dedicated bounded journal pool only; ordinary inventory labels ignore it. */
  readonly ownerId?:number;
  readonly icon?:JournalPictogram;
}

const GLYPH_WIDTH = 20;
const GLYPH_HEIGHT = 24;
const ATLAS_COLUMNS = 16;
const ATLAS_RATIO = 2;
// One original atlas covers numeric stacks, both short and full French quality
// labels, and a visible fallback. It never grows with quantities or camera DPR.
const GLYPHS = [...Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)),
  ...'àâäçéèêëîïôöùûüÿœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒ’–—'];
const BUBBLE_BACKGROUND='\ue000',BUBBLE_TAIL='\ue001';
const journalGlyph=(icon:JournalPictogram)=>String.fromCharCode(0xe010+JOURNAL_PICTOGRAMS.indexOf(icon));
interface Glyph { index: number; advance: number }

function makeAtlas(bubbles=false): { map: THREE.Texture; glyphs: ReadonlyMap<string, Glyph>;rows:number } {
  const characters=bubbles?[...GLYPHS,BUBBLE_BACKGROUND,BUBBLE_TAIL,...JOURNAL_PICTOGRAMS.map(journalGlyph)]:GLYPHS,rows=Math.ceil(characters.length/ATLAS_COLUMNS);
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas')
    : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : undefined;
  if (canvas) {
    canvas.width = ATLAS_COLUMNS * GLYPH_WIDTH * ATLAS_RATIO;
    canvas.height = rows * GLYPH_HEIGHT * ATLAS_RATIO;
  }
  const context = canvas?.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
  const glyphs = new Map<string, Glyph>();
  if (context) {
    context.setTransform(ATLAS_RATIO, 0, 0, ATLAS_RATIO, 0, 0);
    context.font = '12px Arial, sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.lineJoin = 'round'; context.lineWidth = 2.5;
    context.strokeStyle = 'rgba(24, 29, 27, .85)';
    context.fillStyle = '#fff4d9';
  }
  characters.forEach((character, index) => {
    glyphs.set(character, { index, advance: context ? context.measureText(character).width : 7 });
    if (!context) return;
    const x = (index % ATLAS_COLUMNS + .5) * GLYPH_WIDTH;
    const y = (Math.floor(index / ATLAS_COLUMNS) + .5) * GLYPH_HEIGHT;
    if(bubbles){
      if(character===BUBBLE_BACKGROUND||character===BUBBLE_TAIL){
        context.save();context.fillStyle='#f4ead4';context.strokeStyle='#64523f';context.lineWidth=1;
        context.beginPath();
        if(character===BUBBLE_BACKGROUND){context.roundRect(x-9,y-11,18,22,3);}else{context.moveTo(x-5,y-9);context.lineTo(x,y+5);context.lineTo(x+5,y-9);}
        context.fill();context.stroke();context.restore();return;
      }
      const icon=JOURNAL_PICTOGRAMS.find(icon=>journalGlyph(icon)===character);
      if(icon){
        context.save();context.fillStyle='#e4c58e';context.strokeStyle='#64523f';context.lineWidth=.8;
        context.beginPath();context.roundRect(x-9,y-10,18,20,3);context.fill();context.stroke();context.restore();
        drawJournalPictogram(context as CanvasRenderingContext2D,icon,x,y,8,'#30261e');return;
      }
      context.save();context.fillStyle='#44392f';context.fillText(character,x,y);context.restore();return;
    }
    context.strokeText(character, x, y); context.fillText(character, x, y);
  });
  // Pure Node consumers can construct/dispose the batch without a DOM. This
  // transparent placeholder is not an alternative browser text renderer.
  const map = context && canvas ? new THREE.CanvasTexture(canvas)
    : new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  return { map, glyphs,rows };
}

function geometryFor(capacity: number,tinted=false,bubbles=false): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute('labelAnchor', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('labelOffset', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('labelGlyph', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.StaticDrawUsage));
  if(tinted)geometry.setAttribute('labelTint',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.StaticDrawUsage));
  if(bubbles)geometry.setAttribute('labelSize',new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.StaticDrawUsage));
  geometry.instanceCount = 0;
  return geometry;
}

/** One resident draw, with a quad per glyph. Only update() touches instance
 * buffers. Camera motion changes uniforms; the normal scene depth buffer masks
 * text behind opaque geometry at the label's physical anchor depth. */
export class MapLabelBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.MeshBasicNodeMaterial>;
  private readonly atlas:ReturnType<typeof makeAtlas>;
  private readonly screenScale = uniform(1);
  private readonly detailDistance = uniform(0);
  private readonly distanceLimited = uniform(1);
  private readonly perspectiveScale = uniform(0);
  private capacity = 16;
  private instanceCount = 0;
  private entries: MapLabelEntry[] = [];
  private revision = 0;
  private allowed = false;
  private disposed = false;
  private readonly tinted:boolean;
  private readonly bubbles:boolean;
  private bubbleRanges:{entry:MapLabelEntry;start:number;count:number;x:number;y:number;z:number}[]=[];

  constructor(options:{tinted?:boolean;aboveWorld?:boolean;journalBubbles?:boolean}={}) {
    this.tinted=!!options.tinted;
    this.bubbles=!!options.journalBubbles;this.atlas=makeAtlas(this.bubbles);
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: !options.aboveWorld, depthWrite: false, alphaTest: .01, fog: false, toneMapped: false });
    material.lights = false;
    // Entries already passed knownPile/knownPosition. The generic material
    // binder must not derive an owner from this screen-facing quad's vertices.
    material.userData.explorationIntent = true;
    const anchor = attribute('labelAnchor', 'vec3');
    const anchorView = cameraViewMatrix.mul(vec4(anchor, 1));
    const depth = anchorView.z.negate();
    const inRange = this.distanceLimited.lessThan(.5)
      .or(cameraPosition.sub(anchor).length().lessThan(this.detailDistance)).and(depth.greaterThan(0));
    const offset = positionGeometry.xy.mul(this.bubbles?attribute('labelSize','vec2'):vec2(GLYPH_WIDTH, GLYPH_HEIGHT))
      .add(attribute('labelOffset', 'vec2')).mul(this.screenScale)
      .mul(this.perspectiveScale.greaterThan(.5).select(depth, 1)).mul(inRange.select(1, 0));
    // SpriteNodeMaterial r186's positionNode replaces only the world anchor;
    // explicit view-space offsets also preserve glyph spacing and screen size.
    // z/w stay exactly those of the anchor, including across camera switches.
    material.vertexNode = cameraProjectionMatrix.mul(vec4(anchorView.xy.add(offset), anchorView.zw));
    const glyph = attribute('labelGlyph', 'float');
    const atlasUv = vec2(uv().x.add(glyph.mod(ATLAS_COLUMNS)).div(ATLAS_COLUMNS),
      uv().y.add(glyph.div(ATLAS_COLUMNS).floor().negate().add(this.atlas.rows - 1)).div(this.atlas.rows));
    const ink=texture(this.atlas.map,atlasUv);
    material.colorNode=this.tinted?vec4(ink.rgb.mul(attribute('labelTint','vec3')),ink.a):ink;
    this.mesh = new THREE.Mesh(geometryFor(this.capacity,this.tinted,this.bubbles), material);
    this.mesh.name = 'map-label-glyphs';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  update(entries: readonly MapLabelEntry[]): void {
    if (this.disposed) return;
    if(this.bubbles){this.updateSpeech(entries);return;}
    this.revision++;
    this.mesh.geometry.instanceCount = this.instanceCount;
    this.mesh.visible = this.instanceCount > 0 && this.allowed;
    if (entries.length === this.entries.length && entries.every((entry, index) => {
      const before = this.entries[index]!;
      return entry.x === before.x && entry.y === before.y && entry.z === before.z
        && entry.label === before.label && (entry.offsetY ?? 0) === (before.offsetY ?? 0)&&(!this.tinted||entry.color===before.color);
    })) return;
    this.entries = entries.map(entry => ({ ...entry }));
    let count = 0;
    for (const entry of entries) for (const character of entry.label) if (character !== ' ') count++;
    if (count > this.capacity) {
      this.capacity = 2 ** Math.ceil(Math.log2(count));
      const previous = this.mesh.geometry;
      this.mesh.geometry = geometryFor(this.capacity,this.tinted);
      previous.dispose();
    }
    const positions = this.mesh.geometry.getAttribute('labelAnchor');
    const offsets = this.mesh.geometry.getAttribute('labelOffset');
    const glyphs = this.mesh.geometry.getAttribute('labelGlyph');
    const colors=this.tinted?this.mesh.geometry.getAttribute('labelTint'):undefined,color=colors?new THREE.Color():undefined;
    const fallback = this.atlas.glyphs.get('?')!;
    let index = 0;
    for (const entry of entries) {
      if(color)color.setHex(entry.color??0xffffff);
      let width = 0;
      for (const character of entry.label) width += (this.atlas.glyphs.get(character) ?? fallback).advance;
      let cursor = -width / 2;
      for (const character of entry.label) {
        const glyph = this.atlas.glyphs.get(character) ?? fallback;
        if (character !== ' ') {
          positions.setXYZ(index, entry.x, entry.y, entry.z);
          offsets.setXY(index, cursor + glyph.advance / 2, -(entry.offsetY ?? 0));
          glyphs.setX(index, glyph.index);
          if(colors&&color)colors.setXYZ(index,color.r,color.g,color.b);
          index++;
        }
        cursor += glyph.advance;
      }
    }
    if (count > 0){positions.needsUpdate = offsets.needsUpdate = glyphs.needsUpdate = true;if(colors)colors.needsUpdate=true;}
    this.instanceCount = count;
    this.mesh.geometry.instanceCount = count;
    this.mesh.visible = count > 0 && this.allowed;
  }

  /** A separate mode of this resident glyph owner. The background, tail and
   * semantic icon are cells in the same fixed atlas and the same draw. */
  private updateSpeech(entries:readonly MapLabelEntry[]):void {
    this.revision++;
    const fallback=this.atlas.glyphs.get('?')!,widthOf=(text:string)=>Array.from(text).reduce((sum,c)=>sum+(this.atlas.glyphs.get(c)??fallback).advance,0);
    const records=entries.map(entry=>{
      const lines:string[]=[];let line='';
      for(let word of entry.label.replace(/\s+/g,' ').trim().split(' ')){
        while(widthOf(word)>224){
          if(line){lines.push(line);line='';}
          let part='';for(const c of word){if(part&&widthOf(part+c)>224)break;part+=c;}
          lines.push(part);word=word.slice(part.length);
        }
        if(line&&widthOf(line+' '+word)>224){lines.push(line);line=word;}else line+=(line?' ':'')+word;
      }
      if(line)lines.push(line);
      if(lines.length>3){lines.length=3;lines[2]=lines[2]!.replace(/\s+\S*$/,'')+'…';}
      return{entry,lines,width:Math.max(60,...lines.map(widthOf))+48,height:Math.max(1,lines.length)*16+14};
    });
    const count=records.reduce((sum,r)=>sum+3+r.lines.reduce((n,line)=>n+Array.from(line).filter(c=>c!==' ').length,0),0);
    if(count>this.capacity){this.capacity=2**Math.ceil(Math.log2(count));const old=this.mesh.geometry;this.mesh.geometry=geometryFor(this.capacity,false,true);old.dispose();}
    const geometry=this.mesh.geometry,anchors=geometry.getAttribute('labelAnchor'),offsets=geometry.getAttribute('labelOffset'),glyphs=geometry.getAttribute('labelGlyph'),sizes=geometry.getAttribute('labelSize');
    let index=0;this.bubbleRanges=[];
    for(const{entry,lines,width,height}of records){
      const start=index,base=-(entry.offsetY??-12);
      const add=(character:string,x:number,y:number,w=GLYPH_WIDTH,h=GLYPH_HEIGHT)=>{anchors.setXYZ(index,entry.x,entry.y,entry.z);offsets.setXY(index,x,y);glyphs.setX(index,(this.atlas.glyphs.get(character)??fallback).index);sizes.setXY(index,w,h);index++;};
      add(BUBBLE_BACKGROUND,0,base+height/2,width+3,height+3);
      add(BUBBLE_TAIL,-4,base-3,18,18);
      add(journalGlyph(entry.icon??'chat'),-width/2+18,base+height-15,28,32);
      for(let row=0;row<lines.length;row++){
        let x=-width/2+40;
        for(const c of lines[row]!){const advance=(this.atlas.glyphs.get(c)??fallback).advance;if(c!==' ')add(c,x+advance/2,base+height-14-row*16);x+=advance;}
      }
      this.bubbleRanges.push({entry,start,count:index-start,x:entry.x,y:entry.y,z:entry.z});
    }
    this.instanceCount=index;geometry.instanceCount=index;this.mesh.visible=index>0&&this.allowed;
    if(index)for(const a of[anchors,offsets,glyphs,sizes])a.needsUpdate=true;
  }

  /** Only the bounded, currently displayed pool is visited. Text layout,
   * events and the pawn population are never searched during animation. */
  syncSpeechAnchors(read:(ownerId:number)=>Readonly<{x:number;y:number;z:number}>|null):void {
    if(!this.bubbles||!this.instanceCount||this.disposed)return;
    const attribute=this.mesh.geometry.getAttribute('labelAnchor') as THREE.InstancedBufferAttribute;let changed=false;
    attribute.clearUpdateRanges();
    for(const range of this.bubbleRanges){
      const anchor=range.entry.ownerId===undefined?range.entry:read(range.entry.ownerId),x=anchor?.x??0,y=anchor?.y??-1e7,z=anchor?.z??0;
      if(range.x===x&&range.y===y&&range.z===z)continue;
      range.x=x;range.y=y;range.z=z;changed=true;
      for(let i=range.start;i<range.start+range.count;i++)attribute.setXYZ(i,x,y,z);
      attribute.addUpdateRange(range.start*3,range.count*3);
    }
    if(changed)attribute.needsUpdate=true;
  }

  present(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, viewportHeight: number, cellPixels: number, minCellPixels: number): void {
    if (this.disposed) return;
    this.revision++;
    const threshold = Number.isFinite(minCellPixels) && minCellPixels > 0 ? minCellPixels : 0;
    this.allowed = Number.isFinite(viewportHeight) && viewportHeight > 0 && (threshold === 0 || cellPixels >= threshold);
    this.mesh.visible = this.instanceCount > 0 && this.allowed;
    if (!this.mesh.visible) return;
    const perspective = camera instanceof THREE.PerspectiveCamera;
    this.screenScale.value = screenSpriteScale(camera, viewportHeight, 1);
    this.perspectiveScale.value = perspective ? 1 : 0;
    this.distanceLimited.value = perspective && threshold > 0 ? 1 : 0;
    this.detailDistance.value = perspective && threshold > 0
      ? Math.min(1e30, perspectiveDetailRange(camera, viewportHeight, threshold)) : 1e8;
  }

  prepareForCompile(): () => void {
    const visible = this.mesh.visible, revision = this.revision;
    this.mesh.visible = true;
    if (this.instanceCount === 0) this.mesh.geometry.instanceCount = 1;
    return () => {
      if (this.disposed) return;
      this.mesh.geometry.instanceCount = this.instanceCount;
      if (this.revision === revision) this.mesh.visible = visible;
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.entries = [];
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.atlas.map.dispose();
  }
}
