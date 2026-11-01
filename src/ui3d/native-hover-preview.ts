/** Lifetime of a read-only hover/focus preview; never issues a simulation command. */
export class NativeHoverPreview {
  private effect:((active:boolean)=>void)|undefined;
  constructor(private readonly onError:(message:string)=>void){}
  set(next:((active:boolean)=>void)|undefined):void {
    if(next===this.effect)return;
    const previous=this.effect;this.effect=next;
    for(const [callback,active] of [[previous,false],[next,true]] as const) {
      if(!callback)continue;
      try {callback(active);} catch(error) {this.onError(error instanceof Error?error.message:String(error));}
    }
  }
}
