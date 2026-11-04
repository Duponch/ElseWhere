/** Bounded oracle for Three's generated WGSL resource references. This is not
 * a WGSL validator: it checks direct texture/sampler arguments against resource
 * declarations in this SAME stage, including helper-function parameters. A
 * declaration in the other stage cannot admit an unresolved fragment name.
 * textureGather's optional leading component overload is outside this small
 * oracle; the listed operations always take the texture as their first arg. */
export interface UnboundWgslResource {operation:string;resource:string;line:number}
export function unboundWgslTextureResources(source:string):UnboundWgslResource[]{
 const code=source.replace(/\/\*[\s\S]*?\*\//g,comment=>comment.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,comment=>' '.repeat(comment.length));
 const declared=new Set<string>();
 for(const match of code.matchAll(/\b([A-Za-z_]\w*)\s*:\s*(?:texture_[A-Za-z0-9_]+|sampler(?:_comparison)?)\b/g))declared.add(match[1]!);
 const missing:UnboundWgslResource[]=[],seen=new Set<string>();
 const inspect=(operation:string,resource:string,offset:number)=>{if(declared.has(resource))return;const key=operation+':'+resource;if(seen.has(key))return;seen.add(key);missing.push({operation,resource,line:code.slice(0,offset).split('\n').length});};
 for(const match of code.matchAll(/\b(texture(?:Dimensions|NumLayers|NumLevels|NumSamples|Load|Store|Sample(?:Bias|CompareLevel|Compare|Grad|Level)?|GatherCompare))\s*\(\s*([A-Za-z_]\w*)/g))inspect(match[1]!,match[2]!,match.index!);
 for(const match of code.matchAll(/\b(texture(?:Sample(?:Bias|CompareLevel|Compare|Grad|Level)?|GatherCompare))\s*\(\s*[A-Za-z_]\w*\s*,\s*([A-Za-z_]\w*)/g))inspect(match[1]!+' sampler',match[2]!,match.index!);
 return missing;
}
