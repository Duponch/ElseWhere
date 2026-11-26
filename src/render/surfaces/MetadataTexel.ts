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

const exactTable=(map:THREE.DataTexture)=>!map.flipY&&map.colorSpace===THREE.NoColorSpace&&map.type===THREE.FloatType&&map.minFilter===THREE.NearestFilter&&map.magFilter===THREE.NearestFilter&&!map.generateMipmaps;

/** The only non-native TextureNode shape admitted for these actual Source
 * tables. The private class changes compile-time coordinate generation only;
 * runtime texture references/writers remain Three's native implementations.
 * The compiled-owner checker must also prove the exact declared texture. */
export function isExactMetadataTextureNode435(node:unknown):node is THREE.TextureNode{
 return node instanceof THREE.TextureNode&&Object.getPrototypeOf(node)===MetadataTextureNode.prototype&&Reflect.get(node,'setupUV')===MetadataTextureNode.prototype.setupUV&&node.update===THREE.TextureNode.prototype.update&&node.updateReference===THREE.TextureNode.prototype.updateReference&&node.sampler===false&&node.updateMatrix===false&&node.updateType==='none'&&node.updateBeforeType==='none'&&node.updateAfterType==='none'&&node.value instanceof THREE.DataTexture&&exactTable(node.value);
}

export function metadataTexel(map:THREE.DataTexture,coordinates:THREE.Node<'ivec2'>):THREE.Node<'vec4'>{
 if(!exactTable(map))throw Error('Exact unflipped nearest float metadata required');
 const read=new MetadataTextureNode(map,coordinates,int(0));read.sampler=false;
 return nodeObject(read).context({forceUVContext:false}) as THREE.Node<'vec4'>;
}
