import type * as THREE from 'three/webgpu';
import type {World} from '../sim/types';
import {MapLabelBatch} from './MapLabelBatch';
import {PawnJournalFeedback,type PawnJournalNotice} from './pawn-journal-feedback';

export class PawnJournalBubbles {
  // A colon in a room must not lose half a sentence behind the near wall.
  // The anchor already checks real pawn visibility/fog; the bubble is HUD ink
  // rather than a physical object and uses the existing above-world batch mode.
  private readonly batch=new MapLabelBatch({journalBubbles:true,aboveWorld:true});
  readonly mesh=this.batch.mesh;
  private readonly feedback:PawnJournalFeedback;
  private current:readonly PawnJournalNotice[]=[];
  constructor(private readonly anchor:(id:number)=>Readonly<{x:number;y:number;z:number}>|null,now:()=>number=()=>performance.now()){
    this.mesh.name='confirmed-pawn-journal-bubbles';this.mesh.renderOrder=8;
    this.feedback=new PawnJournalFeedback(notices=>{this.current=notices;this.batch.update(notices.map(notice=>({...(anchor(notice.pawnId)??{x:0,y:-1e7,z:0}),ownerId:notice.pawnId,label:notice.text,icon:notice.icon,offsetY:-12})));},now);
  }
  adopt(world:World,reset=false,immutableSnapshot=false):void{this.feedback.adopt(world,reset,immutableSnapshot);}
  setEnabled(enabled:boolean):void{this.feedback.setEnabled(enabled);}
  present(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,height:number,cellPixels:number):void{
    this.feedback.advance();
    if(!this.current.length)return;
    this.batch.syncSpeechAnchors(this.anchor);
    this.batch.present(camera,height,cellPixels,12);
  }
  prepareForCompile():()=>void{return this.batch.prepareForCompile();}
  snapshot(){return this.feedback.snapshot();}
  dispose():void{this.feedback.dispose();this.batch.dispose();}
}
