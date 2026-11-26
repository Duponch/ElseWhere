import type {WorkerColonyClient} from './client';
import type {PresentedPick} from './protocol';

const labels:Record<PresentedPick['target']['kind'],string>={
  pawn:'Personnage',animal:'Animal',mechanoid:'Mécanoïde',terrain:'Terrain',outside:'Hors carte',geyser:'Geyser',
  packed:'Bâtiment emballé',pile:'Pile',structure:'Bâtiment',resource:'Ressource',rock:'Roche',job:'Chantier',
  growing:'Zone de culture',stockpile:'Stockage',plan:'Plan',
};
const sameRect=(a:DOMRect,b:DOMRect)=>a.width===b.width&&a.height===b.height&&a.left===b.left&&a.top===b.top;

export class PickOverlay {
  private active?:{shown:boolean;released:boolean;rect:DOMRect;pixelRatio:number;u:number;v:number;pick?:PresentedPick;layer?:HTMLCanvasElement;marker?:HTMLElement;timer:number};
  constructor(private readonly canvas:HTMLCanvasElement,private readonly client:WorkerColonyClient,
    private readonly result:HTMLElement,private readonly confirm:HTMLButtonElement,private readonly cancel:HTMLButtonElement){
    confirm.onclick=()=>{if(this.active?.shown&&this.active.released)this.commit();};
    cancel.onclick=()=>this.clear();
  }
  get pinned():boolean{return !!this.active?.layer;}
  clear(erase=true):void {
    const old=this.active;this.active=undefined;
    if(old){window.clearTimeout(old.timer);old.layer?.remove();old.marker?.remove();this.client.cancelPick();}
    this.confirm.hidden=this.cancel.hidden=true;
    if(erase){this.result.textContent='';for(const key of Object.keys(this.result.dataset))delete this.result.dataset[key];}
  }
  begin(x:number,y:number):void {
    this.clear();const rect=this.canvas.getBoundingClientRect(),u=(x-rect.left)/rect.width,v=(y-rect.top)/rect.height;
    if(!(u>=0&&u<1&&v>=0&&v<1))return;
    const timer=window.setTimeout(()=>this.expire(),12000);
    this.active={shown:false,released:false,rect,pixelRatio:window.devicePixelRatio,u,v,timer};const held=this.active;
    void this.client.pick(u,v).then(({pick,bitmap})=>{
      try{
        if(this.active!==held)return;
        if(!this.sameView()||pick.u!==u||pick.v!==v||pick.viewport.width!==this.canvas.clientWidth||pick.viewport.height!==this.canvas.clientHeight||pick.viewport.pixelRatio!==held.pixelRatio){this.expire();return;}
        const layer=document.createElement('canvas');
        layer.className='picked-frame';layer.width=bitmap.width;layer.height=bitmap.height;
        const ink=layer.getContext('2d');if(!ink)throw Error('Impossible d’afficher l’image.');
        ink.drawImage(bitmap,0,0);
        const marker=document.createElement('span');marker.className='pick-marker';
        marker.style.left=u*100+'%';marker.style.top=v*100+'%';
        this.canvas.parentElement!.append(layer,marker);held.pick=pick;held.layer=layer;held.marker=marker;
        this.cancel.hidden=false;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(this.active!==held)return;
          if(!this.sameView()){this.expire();return;}
          held.shown=true;this.explain();
        }));
      }finally{bitmap.close();}
    }).catch(error=>{if(this.active===held){this.clear();this.result.textContent=String(error instanceof Error?error.message:error);}});
  }
  end(x:number,y:number):void {
    const held=this.active;if(!held||held.released)return;
    const rect=this.canvas.getBoundingClientRect();
    if(!this.sameView()||!this.canvas.matches(':focus')){this.clear();return;}
    const layer=held.layer;
    const same=!!layer&&Math.floor((x-rect.left)/rect.width*layer.width)===Math.floor(held.u*layer.width)
      &&Math.floor((y-rect.top)/rect.height*layer.height)===Math.floor(held.v*layer.height);
    held.released=true;
    if(held.shown&&same)this.commit();else this.explain();
  }
  private explain():void {
    const held=this.active;if(!held?.shown)return;
    this.confirm.hidden=!held.released;
    this.result.textContent=held.released?'Image figée. Confirme le point marqué.':'Relâche au point marqué pour le sélectionner.';
  }
  private expire():void {this.clear();this.result.textContent='Image expirée. Clique de nouveau sur la carte.';}
  private sameView():boolean {
    const held=this.active;
    return !!held&&!document.hidden&&held.pixelRatio===window.devicePixelRatio&&sameRect(held.rect,this.canvas.getBoundingClientRect());
  }
  private commit():void {
    const held=this.active,pick=held?.pick;if(!held||!pick)return;
    if(!this.sameView()){this.expire();return;}
    const t=pick.target;
    this.clear();
    Object.assign(this.result.dataset,{frame:pick.frame,tick:pick.tick,map:pick.map,kind:t.kind,u:pick.u,v:pick.v,
      viewport:JSON.stringify(pick.viewport),camera:JSON.stringify(pick.camera),presentationTick:pick.presentationTick});
    if('id'in t)this.result.dataset.id=String(t.id);
    if(pick.revision!==undefined)Object.assign(this.result.dataset,{epoch:pick.epoch,revision:pick.revision});
    if('x'in t)Object.assign(this.result.dataset,{x:t.x,z:t.z});
    this.result.textContent=labels[t.kind]+('id'in t?' nº '+t.id:'')+('x'in t?' · case '+t.x+', '+t.z:'')+' · image '+pick.frame+' · tick '+pick.tick;
  }
}
