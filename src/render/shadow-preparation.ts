import type { WebGPURenderer, Scene, Camera } from 'three/webgpu';
import type { BoxBatches } from './BoxBatches';

/** Three r186 deliberately skips shadow passes in compileAsync. Render their
 * resident instance variants behind loading, never at the first material drop.
 * The caller suspends ordinary frames and disables culling until this resolves. */
export async function prepareShadowPipelines(renderer:WebGPURenderer,scene:Scene,camera:Camera,boxes:BoxBatches,parallel=false):Promise<void> {
  const restore=boxes.prepareEmptyShadows();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    // Parallel warm-ups compile every new pipeline concurrently but skip the
    // draws still compiling; the owner ends with an ordinary render that
    // re-records retained bundles (landscape.needsUpdate) with ready pipelines.
    const warming=parallel?(renderer as WebGPURenderer&{renderWarmingPipelines?:(scene:Scene,camera:Camera)=>Promise<void>}).renderWarmingPipelines:undefined;
    if(warming)await warming.call(renderer,scene,camera);
    else renderer.render(scene,camera);
    const context=renderer.getContext() as GPUCanvasContext|WebGL2RenderingContext;
    if('getConfiguration' in context) {
      const device=context.getConfiguration()?.device;
      if(device)await Promise.race([device.queue.onSubmittedWorkDone(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Préparation des ombres GPU interrompue après 30 secondes.')),30000);})]);
    }
  } finally {clearTimeout(timer);restore();}
}
