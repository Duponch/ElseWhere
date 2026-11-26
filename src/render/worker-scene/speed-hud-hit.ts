import type {ColonySpeed,SpeedHudHits} from './protocol';

/** Owned by the canvas input adapter. Poses reuse immutable hit geometry and a
 * lazily projected buffer per card. A pointer outside the bounds projects nothing. */
export class PresentedSpeedHits {
  private hits?:SpeedHudHits;
  private readonly cards=new Map<ColonySpeed,{vertices:Float32Array;triangles:Float64Array;dirty:boolean}>();
  update(hits:SpeedHudHits):void {
    this.hits=hits;
    for(const button of hits.buttons){
      if(button.vertices)this.cards.set(button.speed,{vertices:button.vertices,triangles:new Float64Array(button.vertices.length),dirty:true});
      else {const card=this.cards.get(button.speed);if(card)card.dirty=true;}
    }
  }
  hit(x:number,y:number,width:number,height:number):ColonySpeed|null {
  const hits=this.hits;
  if(!hits||hits.width!==width||hits.height!==height)return null;
  let speed:ColonySpeed|null=null,nearest=Infinity;
  for(const button of hits.buttons){
    const bounds=button.bounds;
    if(x<bounds[0]!||y<bounds[1]!||x>bounds[2]!||y>bounds[3]!)continue;
    const card=this.cards.get(button.speed);if(!card)continue;
    const t=card.triangles;
    if(card.dirty){
      const m=button.transform;
      for(let i=0;i<card.vertices.length;i+=3){
        const a=card.vertices[i]!,b=card.vertices[i+1]!,c=card.vertices[i+2]!;
        const w=1/(m[3]!*a+m[7]!*b+m[11]!*c+m[15]!);
        t[i]=(1+(m[0]!*a+m[4]!*b+m[8]!*c+m[12]!)*w)*width/2;
        t[i+1]=(1-(m[1]!*a+m[5]!*b+m[9]!*c+m[13]!)*w)*height/2;
        t[i+2]=(m[2]!*a+m[6]!*b+m[10]!*c+m[14]!)*w;
      }
      card.dirty=false;
    }
    for(let i=0;i<t.length;i+=9){
      const ax=t[i]!,ay=t[i+1]!,bx=t[i+3]!-ax,by=t[i+4]!-ay,cx=t[i+6]!-ax,cy=t[i+7]!-ay;
      const det=bx*cy-by*cx;
      if(det>=0)continue; // Front-facing in screen coordinates (Y points down).
      const u=((x-ax)*cy-(y-ay)*cx)/det,v=(bx*(y-ay)-by*(x-ax))/det;
      if(u<0||v<0||u+v>1)continue;
      const depth=t[i+2]!+u*(t[i+5]!-t[i+2]!)+v*(t[i+8]!-t[i+2]!);
      if(depth<nearest){nearest=depth;speed=button.speed;}
    }
  }
  return speed;
  }
}
