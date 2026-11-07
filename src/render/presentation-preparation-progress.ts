/** Loading-screen observation of the display preparation. Presentation only:
 * reporting never changes what is prepared, and observers are never awaited. */
export type PresentationPreparationStage =
  | 'renderer' // graphics device and resident layers
  | 'world' // first adoption of the confirmed world
  | 'surfaces' // shared tree/rock/actor surfaces
  | 'scene' // scene programs, one step per projection
  | 'actors' // body variants of the colonists
  | 'shadows' // shadow-pass programs
  | 'first-frame';

export interface PresentationPreparationStep {
  stage:PresentationPreparationStage;
  /** Steps completed inside the stage, out of total. */
  completed:number;
  total:number;
}

export interface PresentationPreparationTiming extends PresentationPreparationStep { at:number }

export class PresentationPreparationReporter {
  /** Each reported step with its time; bounded, read by diagnostics only. */
  readonly timeline:PresentationPreparationTiming[]=[];
  observer?:(step:PresentationPreparationStep)=>void;
  report(stage:PresentationPreparationStage,completed=0,total=1):void {
    if(this.timeline.length<512)this.timeline.push({stage,completed,total,at:performance.now()});
    try{this.observer?.({stage,completed,total});}catch{/* An observer never interrupts the preparation. */}
  }
}

/** Lets the loading screen repaint between two long synchronous steps. */
export const yieldToPaint=():Promise<void>=>new Promise(resolve=>{
  if(typeof requestAnimationFrame==='function'){let done=false;const finish=()=>{if(!done){done=true;resolve();}};requestAnimationFrame(()=>setTimeout(finish,0));setTimeout(finish,50);}
  else setTimeout(resolve,0);
});
