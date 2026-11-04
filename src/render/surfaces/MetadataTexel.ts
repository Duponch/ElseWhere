/** Exact integer reads of the renderer-owned, unflipped metadata tables.
 * r186's normalized nearest-float fallback generates textureDimensions from a
 * string expression; vertex-only lookups can leak that expression into the
 * fragment without its texture binding. No filtering or UV transform belongs
 * to these bounded integer addresses. Source values and buffers stay intact. */
import * as THREE from 'three/webgpu';
import {int,nodeObject} from 'three/tsl';

class MetadataTextureNode extends THREE.TextureNode {
 // Public TextureNode extension point. These data tables never flip in Y;
 // bypass its dynamic UV setup and its otherwise unused texture-size probe.
 setupUV(_builder:THREE.NodeBuilder,coordinates:THREE.Node):THREE.Node{return coordinates;}
}

export function metadataTexel(map:THREE.DataTexture,coordinates:THREE.Node<'ivec2'>):THREE.Node<'vec4'>{
 if(map.flipY||map.colorSpace!==THREE.NoColorSpace||map.type!==THREE.FloatType||map.minFilter!==THREE.NearestFilter||map.magFilter!==THREE.NearestFilter||map.generateMipmaps)throw Error('Exact unflipped nearest float metadata required');
 const read=new MetadataTextureNode(map,coordinates,int(0));read.sampler=false;
 return nodeObject(read).context({forceUVContext:false}) as THREE.Node<'vec4'>;
}
