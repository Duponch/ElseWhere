export interface ScreenPawn { id:number; x:number; y:number; radius:number; depth:number; group?:string; category?:number }
export type SelectionGesture = { ids:number[]; additive:boolean; toggle:boolean };
/** Player colonists, other people, animals, then bodies; never mix the lower
 * priority actor categories into a colonist rectangle. Evaluated on gestures. */
export function rectangleActors(pawns:readonly ScreenPawn[],x1:number,y1:number,x2:number,y2:number):number[] {
  const inside=pawns.filter(p=>p.x>=Math.min(x1,x2)&&p.x<=Math.max(x1,x2)&&p.y>=Math.min(y1,y2)&&p.y<=Math.max(y1,y2));
  const priority=inside.reduce((best,p)=>Math.min(best,p.category??0),Infinity);
  return inside.filter(p=>(p.category??0)===priority).map(p=>p.id);
}
export function hitActors(pawns:readonly ScreenPawn[],x:number,y:number):ScreenPawn[] {
  return pawns.filter(p=>Math.hypot(x-p.x,y-p.y)<=p.radius).sort((a,b)=>(a.category??0)-(b.category??0)||a.depth-b.depth||a.id-b.id);
}
export function equivalentActors(pawns:readonly ScreenPawn[],hit:ScreenPawn):number[]{return [hit.id,...pawns.filter(p=>p.id!==hit.id&&p.group===hit.group).map(p=>p.id)].slice(0,200);}
interface Callbacks {
  enabled():boolean;
  pawns():ScreenPawn[];
  selected():ReadonlySet<number>;
  canInspect(event:PointerEvent):boolean;
  preferObjectCycle(event:PointerEvent):boolean;
  select(gesture:SelectionGesture):void;
  inspect(event:PointerEvent):void;
  inspectGroup?(event:MouseEvent):boolean;
  /** Core Selector.SelectInsideDragBox; false when the box selected nothing,
   * which falls back to the click under the mouse (SelectUnderMouse). */
  rectangleSelect?(x1:number,y1:number,x2:number,y2:number,shift:boolean):boolean;
  lock(locked:boolean):void;
  rectangle?:(bounds:{left:number;top:number;width:number;height:number}|null)=>void;
}
/** Screen-space rectangle remains meaningful after rotating either 3D camera.
 * Simulation cells and GPU rig geometry are never used as selection authority. */
export class PawnSelectionInput {
  private drag:{id:number;x:number;y:number;shift:boolean}|null=null;
  private readonly box:HTMLDivElement|undefined;
  constructor(private readonly canvas:HTMLCanvasElement,private readonly callbacks:Callbacks) {
    if(!callbacks.rectangle){this.box=document.createElement('div');this.box.className='selection-rectangle';this.box.hidden=true;document.body.append(this.box);}
    canvas.addEventListener('dblclick',this.doubleClick);
  }
  get active():boolean{return this.drag!==null;}
  down(event:PointerEvent):boolean {
    if(this.drag){this.cancel();event.preventDefault();event.stopImmediatePropagation();return true;}
    if(!this.callbacks.enabled()||event.button!==0||!event.isPrimary)return false;
    this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,shift:event.shiftKey};
    this.canvas.setPointerCapture(event.pointerId);this.callbacks.lock(true);
    event.preventDefault();event.stopImmediatePropagation();return true;
  }
  move(event:PointerEvent):boolean {
    const drag=this.drag;if(!drag||drag.id!==event.pointerId)return false;
    if(event.buttons&2){this.cancel();return true;}
    const visible=Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6;
    const bounds={left:Math.min(event.clientX,drag.x),top:Math.min(event.clientY,drag.y),width:Math.abs(event.clientX-drag.x),height:Math.abs(event.clientY-drag.y)};
    if(this.callbacks.rectangle)this.callbacks.rectangle(visible?bounds:null);
    else if(this.box){this.box.hidden=!visible;Object.assign(this.box.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`});}
    return true;
  }
  up(event:PointerEvent):boolean {
    const drag=this.drag;if(!drag||drag.id!==event.pointerId||event.button!==0)return false;
    const inside=document.elementFromPoint(event.clientX,event.clientY)===this.canvas;
    this.cancel();if(!inside)return true;
    const dragged=Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6;
    if(dragged&&!this.callbacks.rectangleSelect) {
      const ids=rectangleActors(this.callbacks.pawns(),drag.x,drag.y,event.clientX,event.clientY);
      this.callbacks.select({ids,additive:drag.shift,toggle:false});
    } else if(!dragged||!this.callbacks.rectangleSelect!(drag.x,drag.y,event.clientX,event.clientY,drag.shift)) {
      const hits=this.hits(event.clientX,event.clientY),selected=this.callbacks.selected();
      if(!drag.shift&&this.callbacks.preferObjectCycle(event)){this.callbacks.inspect(event);return true;}
      // Cycle overlapping pawns and map objects on ordinary clicks. Shift
      // still toggles a pawn; double-click still selects the visible group.
      const current=drag.shift?-1:hits.findIndex(p=>selected.has(p.id));
      const next=current+1,inspect=next===hits.length&&this.callbacks.canInspect(event);
      const pawn=inspect?undefined:hits[next%hits.length];
      if(pawn)this.callbacks.select({ids:[pawn.id],additive:drag.shift,toggle:drag.shift});
      else if(!drag.shift)this.callbacks.inspect(event);
    }
    return true;
  }
  private hits(x:number,y:number):ScreenPawn[] {
    return hitActors(this.callbacks.pawns(),x,y);
  }
  private doubleClick=(event:MouseEvent):void=>{
    if(!this.callbacks.enabled()||event.button!==0)return;
    if(this.callbacks.inspectGroup?.(event)){event.preventDefault();return;}
    const pawns=this.callbacks.pawns(),hit=hitActors(pawns,event.clientX,event.clientY)[0];
    if(!hit)return;
    this.callbacks.select({ids:equivalentActors(pawns,hit),additive:event.shiftKey,toggle:false});
    event.preventDefault();
  };
  cancel():boolean {
    const drag=this.drag;this.drag=null;if(this.box)this.box.hidden=true;this.callbacks.rectangle?.(null);
    if(drag){this.callbacks.lock(false);if(this.canvas.hasPointerCapture(drag.id))this.canvas.releasePointerCapture(drag.id);}
    return !!drag;
  }
  dispose():void {this.cancel();this.canvas.removeEventListener('dblclick',this.doubleClick);this.box?.remove();}
}
