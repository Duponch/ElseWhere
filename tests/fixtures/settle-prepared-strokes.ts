import type {GraphicsStyleContext} from '../../src/render/graphics-style';
/** CPU-only coefficient fixtures. This intentionally does not impersonate a
 * renderer, bake textures, clear the global registry or qualify a Core hold. */
export function settlePreparedStrokes(context:GraphicsStyleContext):void{
 const snapshot={preferences:context.preferences};if(!context.preparedStrokes.needsPreparation(snapshot))return;
 const stage=context.preparedStrokes.stage(snapshot,()=>{});try{stage.publish();stage.commit();}finally{stage.dispose();}
}
