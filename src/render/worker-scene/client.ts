import {decodeSceneTexture} from './texture';
import {PresentedSpeedHits} from './speed-hud-hit';
import {readColonyGraphicsPreferences} from '../colony-graphics-preferences';
import type {CameraInput,ColonySpeed,PickImage,SceneReply,SceneRequest,SceneSize,WorkerColonyState} from './protocol';
export type {CameraInput,ColonySpeed,WorkerColonyState} from './protocol';

interface Callbacks {
  onState(state:WorkerColonyState):void;
  onError(message:string):void;
  onProgress?(message:string):void;
  onViewChange?():void;
}
interface Waiter {resolve():void; reject(reason:Error):void}

/** A canvas can be transferred only once. One host owns its worker and all
 * outstanding image decodes; closing it also terminates the nested simulation. */
export class WorkerColonyClient {
  private worker?:Worker;
  private closed=false;
  private visibleNow=!document.hidden;
  private size:SceneSize;
  private hudHits?:PresentedSpeedHits;
  enableSpeedHud(uiScale:number,reducedMotion:boolean):void {this.post({type:'speed-hud',uiScale,reducedMotion});}
  nativeSpeedAt(x:number,y:number,width:number,height:number):ColonySpeed|null {return this.hudHits?.hit(x,y,width,height)??null;}
  speedHudPointer(hover:ColonySpeed|null,press=false):void {this.post({type:'speed-hud-pointer',hover,press});}
  private nextId=1;
  private readonly waiters=new Map<number,Waiter>();
  private pickWaiter?:{id:number;timer:number;resolve:(value:PickImage)=>void;reject:(error:Error)=>void};

  constructor(private readonly canvas:HTMLCanvasElement,private readonly callbacks:Callbacks) {
    this.size={width:Math.max(1,canvas.clientWidth),height:Math.max(1,canvas.clientHeight),pixelRatio:window.devicePixelRatio};
  }

  async open(file:File|string):Promise<void> {
    if(this.worker||this.closed)throw Error('Cette vue a déjà été ouverte ou fermée.');
    if(!('gpu' in navigator)||!this.canvas.transferControlToOffscreen)throw Error('Ce navigateur requiert WebGPU et un canvas transférable.');
    let save=file;
    if(typeof file==='string'){
      const url=new URL(file,location.href);
      if(url.origin!==location.origin)throw Error('La sauvegarde doit être servie par le jeu.');
      save=url.href;
    }
    const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module',name:'ElseWhere — rendu de la colonie'});
    this.worker=worker;
    worker.onmessage=({data}:MessageEvent<SceneReply>)=>this.receive(data,worker);
    worker.onerror=event=>this.fail(event.message||'Le Worker de rendu a été interrompu.');
    worker.onmessageerror=()=>this.fail('Message du Worker de rendu illisible.');
    try {
      const surface=this.canvas.transferControlToOffscreen();
      const graphics=readColonyGraphicsPreferences(key=>localStorage.getItem(key));
      const request:SceneRequest={type:'open',save,canvas:surface,size:this.size,visible:this.visibleNow,graphics};
      await new Promise<void>((resolve,reject)=>{
        this.waiters.set(0,{resolve,reject});
        worker.postMessage(request,[surface]);
      });
    } catch(error) {
      this.dispose();throw error;
    }
  }

  speed(speed:ColonySpeed):Promise<void> {
    if(!this.worker||this.closed||this.waiters.has(0))return Promise.reject(Error('La colonie est indisponible.'));
    this.invalidateView();
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      this.waiters.set(id,{resolve,reject});
      try {this.post({type:'speed',id,speed});}catch(error){this.waiters.delete(id);reject(error);}
    });
  }
  pick(u:number,v:number):Promise<PickImage>{
    this.cancelPick();
    if(!this.worker||this.closed||this.waiters.has(0)||!this.visibleNow)return Promise.reject(Error('La carte est indisponible.'));
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      const timer=window.setTimeout(()=>this.cancelPick('L’image a expiré. Clique de nouveau.'),4000);
      this.pickWaiter={id,timer,resolve,reject};
      try{this.post({type:'pick',id,u,v,size:this.size});}catch(error){this.cancelPick(String(error));}
    });
  }
  cancelPick(reason='Lecture annulée.'):void {
    const pending=this.pickWaiter;if(!pending)return;
    this.pickWaiter=undefined;window.clearTimeout(pending.timer);
    try{this.post({type:'cancel-pick',id:pending.id});}finally{pending.reject(Error(reason));}
  }
  private invalidateView():void {this.cancelPick();this.callbacks.onViewChange?.();}
  camera(input:CameraInput):void {this.invalidateView();this.post({type:'camera',input});}
  resize(width:number,height:number,pixelRatio=window.devicePixelRatio):void {
    if(!Number.isFinite(width)||!Number.isFinite(height)||!(pixelRatio>0)||!Number.isFinite(pixelRatio))return;
    const next={width:Math.max(1,Math.round(width)),height:Math.max(1,Math.round(height)),pixelRatio};
    if(this.size.width===next.width&&this.size.height===next.height&&this.size.pixelRatio===next.pixelRatio)return;
    this.invalidateView();this.size=next;
    this.post({type:'resize',size:this.size});
  }
  visible(visible:boolean):void {if(visible!==this.visibleNow)this.invalidateView();this.visibleNow=visible;this.post({type:'visible',visible});}

  private post(message:SceneRequest):void {this.worker?.postMessage(message);}
  private receive(message:SceneReply,worker:Worker):void {
    if(this.closed||worker!==this.worker){if(message.type==='pick-image')message.bitmap.close();return;}
    switch(message.type) {
      case 'speed-hud-hits':(this.hudHits??=new PresentedSpeedHits()).update(message.hits);break;
      case 'texture': void this.sendTexture(worker,message.id,message.url);break;
      case 'fatal': this.fail(message.message);break;
      case 'progress': this.callbacks.onProgress?.(message.message);break;
      case 'state': this.callbacks.onState(message.state);break;
      case 'pick-image':
      case 'pick-unavailable':{
        const pending=this.pickWaiter;
        if(!pending||pending.id!==message.id){if(message.type==='pick-image')message.bitmap.close();break;}
        this.pickWaiter=undefined;window.clearTimeout(pending.timer);
        if(message.type==='pick-image')pending.resolve(message);else pending.reject(Error(message.message));
        break;
      }
      case 'ready':
      case 'ack': {
        const id=message.type==='ready'?0:message.id,waiter=this.waiters.get(id);
        if(!waiter)break;
        this.waiters.delete(id);
        if(message.type==='ack'&&message.error)waiter.reject(Error(message.error));
        else waiter.resolve();
      }
    }
  }
  private async sendTexture(worker:Worker,id:number,url:string):Promise<void> {
    try {
      const bitmap=await decodeSceneTexture(url);
      if(worker!==this.worker){bitmap.close();return;}
      try {worker.postMessage({type:'texture',id,bitmap} satisfies SceneRequest,[bitmap]);}
      catch(error){bitmap.close();throw error;}
    } catch(error) {
      if(worker===this.worker)this.post({type:'texture-error',id,message:String(error)});
    }
  }
  private fail(message:string):void {
    if(this.closed)return;
    this.close(Error(message));this.callbacks.onError(message);
  }
  dispose():void {this.close(Error('Vue de la colonie fermée.'));}
  private close(reason:Error):void {
    this.closed=true;
    this.worker?.terminate();this.worker=undefined;
    this.invalidateView();
    for(const waiter of this.waiters.values())waiter.reject(reason);
    this.waiters.clear();
  }
}
