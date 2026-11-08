import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

const StorageBase=THREE.StorageBufferNode as unknown as new(value:THREE.StorageBufferAttribute,type:string,count:number)=>THREE.StorageBufferNode<'vec4'>&{uuid:string};
const TextureBase=THREE.TextureNode as unknown as new(value?:THREE.Texture,uvNode?:THREE.Node|null,levelNode?:THREE.Node|null,biasNode?:THREE.Node|null)=>THREE.TextureNode&{getBase():{uuid:string}};
/** A storage node identified by itself, never merged with another node that
 * happens to point at the same buffer when a program is built. */
class ObjectBoundStorageNode extends StorageBase {
  getHash():string {return this.uuid;}
}
/** A texture node whose reads (load/sample clones) share one binding of their
 * own, never merged with another node that happens to hold the same texture. */
class ObjectBoundTextureNode extends TextureBase {
  getUniformHash():string {return this.getBase().uuid;}
}
type Slot<R>={readonly node:{value:unknown};readonly read:(record:R)=>unknown};

/**
 * One shader program shared by several objects whose resources differ.
 *
 * Three builds a node graph once per material, but each drawn object keeps its
 * own copy of the object-group bindings. Before each object's bindings are
 * updated, this node (updated per OBJECT) writes that object's textures,
 * storage buffers and uniform values into the shared nodes. Each object's
 * bindings then keep pointing at its own resources from frame to frame.
 *
 * Every object drawn with a program that contains this binder must resolve to
 * its record: attached explicitly, or found by the optional resolver (for
 * example from its geometry). An unresolved object is refused rather than
 * drawn with the resources of another one. Uniforms must stay in the object
 * group (the default): render and frame groups are not copied per object.
 */
export class ObjectResourceBinder<R extends object> extends THREE.Node {
  private readonly slots:Slot<R>[]=[];
  private readonly records=new WeakMap<THREE.Object3D,R>();
  constructor(private readonly label:string,private readonly resolve?:(object:THREE.Object3D)=>R|undefined) {
    super('void');
    this.updateType=THREE.NodeUpdateType.OBJECT;
  }
  /** The object's record; also used by stand-ins sharing its resources. */
  attach(object:THREE.Object3D,record:R):void {this.records.set(object,record);}
  detach(object:THREE.Object3D):void {this.records.delete(object);}
  recordOf(object:THREE.Object3D):R|undefined {return this.records.get(object);}
  texture(read:(record:R)=>THREE.Texture,initial:THREE.Texture):THREE.TextureNode {
    const node=new ObjectBoundTextureNode(initial);this.slots.push({node,read});return node;
  }
  storage<T extends 'vec4'|'float'|'uint'|'int'|'vec2'|'vec3'>(read:(record:R)=>THREE.StorageBufferAttribute,initial:THREE.StorageBufferAttribute,type:T):THREE.StorageBufferNode<T> {
    const node=new ObjectBoundStorageNode(initial,type,0).toReadOnly() as unknown as THREE.StorageBufferNode<T>;
    this.slots.push({node:node as unknown as {value:unknown},read});return node;
  }
  uniform(read:(record:R)=>number,initial:number):THREE.UniformNode<'float',number>;
  uniform(read:(record:R)=>THREE.Vector2,initial:THREE.Vector2):THREE.UniformNode<'vec2',THREE.Vector2>;
  uniform(read:(record:R)=>number|THREE.Vector2,initial:number|THREE.Vector2):unknown {
    const node=uniform(initial as never);this.slots.push({node:node as unknown as {value:unknown},read});return node;
  }
  private apply(object:THREE.Object3D|null|undefined):void {
    const record=object?this.records.get(object)??this.resolve?.(object):undefined;
    if(!record)throw Error(`${this.label}: object drawn without its own resources`);
    for(const {node,read} of this.slots)node.value=read(record);
  }
  setup(builder:THREE.NodeBuilder):null {this.apply(builder.object);return null;}
  update(frame:THREE.NodeFrame):boolean|undefined {this.apply(frame.object);return undefined;}
  generate():string {return '';}
  getHash():string {return this.uuid;}
}
