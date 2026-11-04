import {expect,test} from 'vitest';
import {unboundWgslTextureResources} from './wgsl-resource-bindings';

test('stage-local resource oracle accepts actual binding declarations and texture helper parameters',()=>{
 const source=`@binding(1) @group(0) var pigment: texture_2d<f32>;
@binding(2) @group(0) var point_sampler: sampler;
fn helper(input: texture_2d<f32>, sampled: sampler) -> vec4<f32> {
 return textureSampleLevel(input, sampled, vec2<f32>(0.5), 0.0);
}
fn main() {let size=textureDimensions(pigment,0);let value=textureSampleGrad(pigment,point_sampler,vec2<f32>(0.5),vec2<f32>(0.0),vec2<f32>(0.0));}
// textureDimensions(comment_is_not_a_resource,0);
/* textureLoad(another_comment,vec2<u32>(0),0); */`;
 expect(unboundWgslTextureResources(source)).toEqual([]);
});

test('stage-local oracle rejects the captured orphan dimension bindings and missing samplers, even when another shader declares them',()=>{
 const vertex='@binding(28) @group(1) var nodeUniform15: texture_2d<f32>;\n@binding(29) @group(1) var nodeUniform20: texture_2d<f32>;';
 const fragment='@binding(1) @group(1) var nodeUniform12: texture_2d<f32>;\nfn main(){let a=textureDimensions(nodeUniform15,u32(0.0));let b=textureDimensions(nodeUniform20,u32(0.0));let c=textureSampleLevel(nodeUniform12,missing_sampler,vec2<f32>(0.5),0.0);}';
 expect(unboundWgslTextureResources(vertex)).toEqual([]);expect(unboundWgslTextureResources(fragment)).toEqual([{operation:'textureDimensions',resource:'nodeUniform15',line:2},{operation:'textureDimensions',resource:'nodeUniform20',line:2},{operation:'textureSampleLevel sampler',resource:'missing_sampler',line:2}]);
});
