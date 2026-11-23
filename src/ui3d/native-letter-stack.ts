import * as THREE from 'three/webgpu';
import {NATIVE_TEXT} from './native-ui-scale';
import type {World} from '../sim/types';
import {BUNDLE_LETTER_COLOR_352, LETTER_CLASSES_352, isSchema352OrLater, letterStackRows352, stackLetters352, type Letter352} from '../sim/letters-352';
import {PALETTE, drawHandRect, type CardboardPiece, type PrototypeCardboardArt} from './prototype-art';

/* The Core letter stack (LetterStack.LettersOnGUI, Letter.DrawButtonAt,
 * BundleLetter), drawn as native cardboard cards above the time board:
 * - newest letter at the bottom, rows of 30 px with 12 px between them;
 * - when the column has fewer rows than letters, the oldest ones fold into
 *   one bundle card ("N de plus…") whose click lists them;
 * - a new letter falls in over one second; threat letters bounce sideways
 *   every five seconds after fifteen while not hovered; an unread letter
 *   flashes its class colour every `flashInterval` seconds;
 * - hover shows the text and highlights the targets, left click opens the
 *   letter, right click dismisses it (not the bundle).
 * Cards are rebuilt only when the stack changes; the animations move cards
 * or repaint one card a few times per flash, never every frame. */

export interface NativeLetterActions {
  open(letter:Letter352):void;
  dismiss(letter:Letter352):void;
  openBundle(letters:readonly Letter352[]):void;
  /** View-only: highlight the letter's targets while hovered (null: stop). */
  hover(letter:Letter352|null):void;
}
interface LetterCard {key:string;piece:CardboardPiece;letter?:Letter352;bundle?:readonly Letter352[];width:number;baseY:number;arrivedAt:number;flashing:boolean;signature:string}
const FONT='"Comic Sans MS", "Chalkboard SE", Georgia, serif';
/** Core Letter.DrawHeight and LetterStack.LetterSpacing, in logical pixels. */
export const LETTER_ROW_PX=30,LETTER_SPACING_PX=12;
const ICON_PX=38,LABEL_MAX_PX=210,FALL_SECONDS=1,FALL_PX=200;
/** Bottom of the stack: just above the weather card of the time board. */
const BASE_Y=2.64;

export class NativeLetterStack {
  private cards:LetterCard[]=[];
  private signature='';
  private capacity=4;
  private seconds=0;
  private hovered:string|null=null;
  private readonly seen=new Set<number>();
  private session='';
  /** Bumped at each rebuild, so the stage repaints only when the stack changed. */
  revision=0;

  constructor(private readonly art:PrototypeCardboardArt,private readonly layer:THREE.Group,private readonly actions:NativeLetterActions) {}

  /** Rows the column may use: up to 45% of the space above the time board,
   * at least one (the bundle). Returns the reserved height in pixels. */
  setViewport(height:number):number {
    const column=Math.max(0,height-16-30-252);
    const capacity=Math.max(1,Math.min(10,Math.floor(column*.45/(LETTER_ROW_PX+LETTER_SPACING_PX))));
    if(capacity!==this.capacity){this.capacity=capacity;this.signature='';}
    return this.reservedPx;
  }
  get reservedPx():number {return this.cards.length?this.cards.length*(LETTER_ROW_PX+LETTER_SPACING_PX)+6:0;}
  get count():number {return this.cards.length;}

  /** Reads the confirmed campaign letters. Returns the ids that arrived since
   * the previous reading of the same session (a load or a new game adopts its
   * stack silently), for the arrival sound. */
  update(world:World|undefined,session:string):Letter352[] {
    const state=world&&isSchema352OrLater(world.schemaVersion)?world.letters352:undefined;
    const letters=stackLetters352(state);
    const fresh=session!==this.session;
    if(fresh){this.session=session;this.seen.clear();}
    const arrived:Letter352[]=[];
    for(const letter of letters)if(!this.seen.has(letter.id)){this.seen.add(letter.id);if(!fresh)arrived.push(letter);}
    if(this.seen.size>4*letters.length+64){const keep=new Set(letters.map(l=>l.id));for(const id of this.seen)if(!keep.has(id))this.seen.delete(id);}
    const signature=JSON.stringify([this.capacity,letters.map(l=>[l.id,l.read===true,l.title])]);
    if(signature!==this.signature){this.signature=signature;this.revision++;this.rebuild(letters,new Set(arrived.map(l=>l.id)));}
    return arrived;
  }

  private rebuild(letters:readonly Letter352[],arrived:ReadonlySet<number>):void {
    const {bundle,shown}=letterStackRows352(letters,this.capacity);
    const previous=new Map(this.cards.map(card=>[card.key,card]));
    const rows:{key:string;letter?:Letter352;bundle?:readonly Letter352[]}[]=shown.map(letter=>({key:`letter:${letter.id}`,letter}));
    if(bundle.length)rows.unshift({key:'bundle',bundle});
    this.cards=[];
    let y=BASE_Y+LETTER_ROW_PX/200;
    for(let i=rows.length-1;i>=0;i--){
      const row=rows[i]!,letter=row.letter,label=letter?letter.title:`${row.bundle!.length} de plus…`;
      const color=letter?LETTER_CLASSES_352[letter.cls].color:BUNDLE_LETTER_COLOR_352;
      const width=ICON_PX+Math.min(LABEL_MAX_PX,Math.max(44,this.measure(label)+18));
      const signature=JSON.stringify([label,color,width,letter?.read===true]);
      let card=previous.get(row.key);previous.delete(row.key);
      if(card&&card.signature!==signature){this.art.disposePiece(card.piece);card=undefined;}
      if(!card){
        const live:LetterCard={key:row.key,letter,width,baseY:y,arrivedAt:letter&&arrived.has(letter.id)?this.seconds:this.seconds-1000,flashing:false,signature} as LetterCard;
        live.piece=this.art.createPiece({w:width/100,h:LETTER_ROW_PX/100,depth:.04,bgColor:color,bevel:.03,seed:7300+(letter?.id??0)%997,interactive:true,
          drawFn:(ctx,w,h,rng)=>this.drawCard(ctx,w,h,rng,live,label),
          // Read the card's current letter/bundle: a kept card outlives its row.
          onClick:()=>{if(live.bundle)this.actions.openBundle(live.bundle);else if(live.letter)this.actions.open(live.letter);}});
        if(letter)live.piece.userData.onSecondary=()=>{if(live.letter)this.actions.dismiss(live.letter);};
        live.piece.userData.onHover=(active:boolean)=>{this.hovered=active?row.key:this.hovered===row.key?null:this.hovered;if(live.letter)this.actions.hover(active?live.letter:null);};
        this.layer.add(live.piece);card=live;
      }
      card.letter=letter;card.bundle=row.bundle;card.baseY=y;
      card.piece.userData.nativeId=letter?`hud:letter:${letter.id}`:'hud:letters:bundle';
      card.piece.userData.tooltip=letter?`${letter.title}\n\n${letter.text}\n\nClic gauche : ouvrir · clic droit : retirer`
        :`${row.bundle!.length} lettres de plus :\n${row.bundle!.map(l=>` - ${l.title}`).join('\n')}`;
      this.place(card);
      this.cards.push(card);
      y+=(LETTER_ROW_PX+LETTER_SPACING_PX)/100;
    }
    for(const card of previous.values())this.art.disposePiece(card.piece);
  }

  private measureContext:OffscreenCanvasRenderingContext2D|null|undefined;
  private measure(text:string):number {
    if(this.measureContext===undefined)this.measureContext=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(4,4).getContext('2d'):null;
    const ctx=this.measureContext;
    if(!ctx)return text.length*7;
    ctx.font=`bold ${NATIVE_TEXT.small}px ${FONT}`;return ctx.measureText(text).width;
  }
  private drawCard(ctx:CanvasRenderingContext2D,w:number,h:number,rng:()=>number,card:LetterCard,label:string):void {
    ctx.save();ctx.scale(w/card.width,h/LETTER_ROW_PX);
    if(card.flashing&&card.letter){ctx.fillStyle=LETTER_CLASSES_352[card.letter.cls].flash;ctx.fillRect(0,0,card.width,LETTER_ROW_PX);}
    drawHandRect(ctx,3,3,card.width-6,LETTER_ROW_PX-6,null,PALETTE.inkDark,1.2,rng);
    // Envelope on the right, like Core's icon at the screen edge.
    const ex=card.width-ICON_PX+6,ey=7,ew=ICON_PX-12,eh=LETTER_ROW_PX-14;
    ctx.fillStyle=card.letter?.read?'#e9e2d0':'#fff8e9';ctx.fillRect(ex,ey,ew,eh);
    ctx.strokeStyle=PALETTE.inkDark;ctx.lineWidth=1.4;ctx.strokeRect(ex,ey,ew,eh);
    ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex+ew/2,ey+eh*.6);ctx.lineTo(ex+ew,ey);ctx.stroke();
    ctx.fillStyle=PALETTE.inkDark;ctx.font=`bold ${NATIVE_TEXT.small}px ${FONT}`;ctx.textAlign='left';
    let text=label;while(text.length>1&&ctx.measureText(text).width>card.width-ICON_PX-12)text=text.slice(0,-2)+'…';
    ctx.fillText(text,8,20,card.width-ICON_PX-10);
    ctx.restore();
  }
  private place(card:LetterCard,offsetX=0,offsetY=0):void {
    const x=-card.width/200-.12-offsetX,y=card.baseY+offsetY,base=card.piece.userData.basePos;
    if(base.x!==x||base.y!==y)card.piece.setBaseTransform(x,y,.02,0);
  }

  /** Arrival fall, threat bounce and unread flash. True when a card moved or
   * was repainted this frame. */
  animate(deltaSeconds:number):boolean {
    this.seconds+=Math.max(0,deltaSeconds);
    let changed=false;
    for(const card of this.cards){
      const letter=card.letter,age=this.seconds-card.arrivedAt;
      let dy=0,dx=0;
      if(age<FALL_SECONDS)dy=(1-age/FALL_SECONDS)*FALL_PX/100;
      const def=letter?LETTER_CLASSES_352[letter.cls]:undefined;
      // Letter.DrawButtonAt: threats bounce every 5 s after 15 s, unless hovered.
      if(def?.bounce&&!letter!.read&&this.hovered!==card.key&&age>15&&age%5<1){const t=2*(age%1)-1;dx=.6*(1-t*t);}
      const before=card.piece.userData.basePos;
      const x=-card.width/200-.12-dx,y=card.baseY+dy;
      if(before.x!==x||before.y!==y){card.piece.setBaseTransform(x,y,.02,0);changed=true;}
      // Unread letters flash for one second every flashInterval seconds.
      const flashing=!!def&&!letter!.read&&def.flashInterval>0&&age>FALL_SECONDS&&(age-FALL_SECONDS)%def.flashInterval<1;
      if(flashing!==card.flashing){card.flashing=flashing;card.piece.redraw();changed=true;}
    }
    return changed;
  }

  get pieces():readonly CardboardPiece[] {return this.cards.map(card=>card.piece);}
  dispose():void {for(const card of this.cards)this.art.disposePiece(card.piece);this.cards=[];this.signature='';}
}
