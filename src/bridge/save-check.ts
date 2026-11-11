/* Save validation off the simulation thread.
 *
 * A save used to validate the whole campaign inside the simulation Worker
 * before writing its text: on a large colony (Les Forges) about 1.2 s of a
 * 1.4 s save, during which the game stood still, at every autosave. The
 * client now asks the Worker for the text only (0.14 s there) and has it
 * validated by a dedicated Worker before the save is kept: the complete load
 * path runs on the text (savedCampaignRefusal), so a kept save is one that
 * loads, and a refusal keeps serializeCampaign's "Cannot save invalid world"
 * form. The check takes longer than before (a full load, about 3 s on a large
 * colony) but runs beside the game instead of stopping it. Without
 * Worker support (Node tests) or if this Worker cannot start, the caller
 * keeps the former in-Worker validation. */
export interface SaveCheckRequest {readonly id:number;readonly text:string}
export interface SaveCheckReply {readonly id:number;readonly refusal:string|null}
/** The checker could not run: the caller falls back to the in-Worker check. */
export const SAVE_CHECK_UNAVAILABLE=Symbol('save check unavailable');
export type SaveCheckResult=string|null|typeof SAVE_CHECK_UNAVAILABLE;

export class SaveTextChecker {
 private worker:Worker|undefined;
 private unavailable=false;
 private nextId=1;
 private readonly pending=new Map<number,(result:SaveCheckResult)=>void>();
 constructor(private readonly create:()=>Worker|undefined) {}
 /** null when the text is a valid save, else the refusal message. */
 check(text:string):Promise<SaveCheckResult> {
  const worker=this.start();if(!worker)return Promise.resolve(SAVE_CHECK_UNAVAILABLE);
  const id=this.nextId++;
  return new Promise(resolve=>{this.pending.set(id,resolve);worker.postMessage({id,text} satisfies SaveCheckRequest);});
 }
 /** Starts the checker if needed: false without Worker support or after a failure. */
 available():boolean {return !!this.start();}
 dispose():void {this.worker?.terminate();this.worker=undefined;this.unavailable=true;this.fail();}
 private start():Worker|undefined {
  if(this.unavailable)return undefined;if(this.worker)return this.worker;
  let worker:Worker|undefined;try{worker=this.create();}catch{worker=undefined;}
  if(!worker){this.unavailable=true;return undefined;}
  worker.onmessage=(event:MessageEvent<SaveCheckReply>)=>{
   const reply=event.data,done=this.pending.get(reply?.id);if(!done)return;
   this.pending.delete(reply.id);done(typeof reply.refusal==='string'?reply.refusal:null);
  };
  worker.onerror=()=>{this.worker?.terminate();this.worker=undefined;this.unavailable=true;this.fail();};
  this.worker=worker;return worker;
 }
 private fail():void {const waiting=[...this.pending.values()];this.pending.clear();for(const done of waiting)done(SAVE_CHECK_UNAVAILABLE);}
}
