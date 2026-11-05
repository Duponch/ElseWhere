/** A bounded oracle for these named production B/I kernels, not a WGSL parser
 * or GPU validation. Balanced lexical blocks preserve their actual scopes. */
export interface BiInkProgramNames {bodyVariable:string;dxVariable:string;dyVariable:string;formatToken?:string;resultVariable?:string}
type Block={start:number;end:number;parent:Block|undefined;condition?:string};
type Call={kind:'textureSample'|'textureSampleGrad';at:number;end:number;args:string[];block:Block|undefined};
const compact=(s:string)=>s.replace(/\s+/g,'');
function close(code:string,start:number,left:string,right:string):number{let depth=0;for(let i=start;i<code.length;i++){if(code[i]===left)depth++;else if(code[i]===right&&!--depth)return i;}throw Error('Unbalanced acquired WGSL '+left);}
function argumentsOf(code:string,start:number,end:number):string[]{const args:string[]=[];let first=start+1,depth=0;for(let i=first;i<end;i++){if('([{'.includes(code[i]!))depth++;else if(')]}'.includes(code[i]!))depth--;else if(code[i]===','&&!depth){args.push(compact(code.slice(first,i)));first=i+1;}}args.push(compact(code.slice(first,end)));return args;}
export function inspectBiInkOccupancyProgram(source:string,names:BiInkProgramNames){
 const code=source.replace(/\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,s=>' '.repeat(s.length)),blocks:Block[]=[],stack:Block[]=[];
 for(let i=0;i<code.length;i++)if(code[i]==='{'){const b:Block={start:i,end:-1,parent:stack.at(-1)};blocks.push(b);stack.push(b);}else if(code[i]==='}'){const b=stack.pop();if(!b)throw Error('Unbalanced acquired WGSL block');b.end=i;}if(stack.length)throw Error('Unbalanced acquired WGSL block');
 for(const m of code.matchAll(/\bif\s*\(/g)){const open=code.indexOf('(',m.index),end=close(code,open,'(',')'),next=code.slice(end+1).search(/\S/),brace=end+1+next,b=blocks.find(v=>v.start===brace);if(b)b.condition=code.slice(open+1,end);}
 const containing=(at:number)=>blocks.filter(b=>b.start<at&&b.end>at).at(-1),banks=[...code.matchAll(/\bvar(?:\s*<[^>]+>)?\s+(\w+)\s*:\s*texture_2d_array\s*<\s*f32\s*>/g)].map(m=>m[1]!);
 const calls:Call[]=[];for(const m of code.matchAll(/\b(textureSampleGrad|textureSample)\s*\(/g)){const start=code.indexOf('(',m.index),end=close(code,start,'(',')'),args=argumentsOf(code,start,end);if(banks.includes(args[0]!))calls.push({kind:m[1] as Call['kind'],at:m.index!,end,args,block:containing(m.index!)});}
 const errors:string[]=[];if(banks.length!==1)errors.push('Exactly one actual RGBA array bank required');const pastel=calls.filter(c=>c.kind==='textureSample'),grad=calls.filter(c=>c.kind==='textureSampleGrad');
 if(pastel.length!==1)errors.push('Exactly one implicit Pastel bank sample required');if(grad.length!==2)errors.push('Exactly one explicit Body and one explicit conditional Ink sample required');
 const gate=blocks.find(b=>b.condition&&compact(b.condition).includes(names.bodyVariable+'.w>0.0'));
 if(!gate)errors.push('Strict positive sampled Body occupancy gate absent');if(gate&&names.formatToken&&!compact(gate.condition!).includes(names.formatToken+'==1.0'))errors.push('Exact B/I format discriminator must participate in the same occupancy gate');
 const body=grad.find(c=>!gate||!(c.at>gate.start&&c.at<gate.end)),ink=grad.find(c=>gate&&c.at>gate.start&&c.at<gate.end);
 if(!body||!ink)errors.push('Body must precede and dominate the gate; Ink must be inside it');
 const dxMatch=new RegExp('\\b'+names.dxVariable+'\\s*=\\s*dpdx\\s*\\(').exec(code),dyMatch=new RegExp('\\b'+names.dyVariable+'\\s*=\\s*-\\s*dpdy\\s*\\(').exec(code);
 // Installed r186 WGSLNodeBuilder maps dFdy to -dpdy (Y convention).
 // Require that exact mapping rather than accepting an arbitrary sign.
 if(!dxMatch||!dyMatch)errors.push('Actual explicit derivative assignments required');
 const derivativeCoordinates=(match:RegExpExecArray)=>{const open=code.indexOf('(',match.index),end=close(code,open,'(',')');return compact(code.slice(open+1,end));};
 if(body&&dxMatch&&dyMatch&&(derivativeCoordinates(dxMatch)!==body.args[2]||derivativeCoordinates(dyMatch)!==body.args[2]))errors.push('Both explicit derivatives must use the same coordinates as Body and Ink');
 if(body&&ink){if(body.at>=ink.at||!gate||body.at>=gate.start)errors.push('Body sample does not dominate Ink gate');if(body.args.length!==6||ink.args.length!==6)errors.push('Expected exact array SampleGrad signature');if(body.args[0]!==ink.args[0]||body.args[1]!==ink.args[1]||body.args[2]!==ink.args[2]||body.args[4]!==ink.args[4]||body.args[5]!==ink.args[5])errors.push('Body and Ink bank/sampler/coordinates/gradients differ');if(body.args[4]!==names.dxVariable||body.args[5]!==names.dyVariable)errors.push('Explicit sample does not use the two named derivative assignments');if(!body.block||gate?.parent!==body.block)errors.push('Occupancy gate must be nested directly after Body in Gouache branch');
  if(dxMatch&&dyMatch){if(dxMatch.index>=body.at||dyMatch.index>=body.at||containing(dxMatch.index)!==body.block||containing(dyMatch.index)!==body.block)errors.push('Derivative assignments must dominate Body/Ink inside Gouache branch');}
 }
 if(body&&gate&&names.resultVariable){const pattern=new RegExp('\\b'+names.resultVariable+'\\s*=\\s*([^;]+);','g'),assigned=[...code.matchAll(pattern)].some(m=>m.index!>body.at&&m.index!<gate.start&&containing(m.index!)===body.block&&m[1]!.includes(names.bodyVariable));if(!assigned)errors.push('Premultiplied Body RGB must be assigned unconditionally before the occupancy gate');}
 if(pastel[0]&&body){if(!pastel[0].block||pastel[0].block===body.block||pastel[0].block.parent!==body.block?.parent)errors.push('Pastel and Gouache samples must be isolated in sibling encoding branches');if(dxMatch&&pastel[0].block&&dxMatch.index>pastel[0].block.start&&dxMatch.index<pastel[0].block.end||dyMatch&&pastel[0].block&&dyMatch.index>pastel[0].block.start&&dyMatch.index<pastel[0].block.end)errors.push('Gouache derivatives leaked into Pastel branch');}
 return{scope:'Acquired WGSL lexical/dataflow contract for named product kernel; no device or pixel proof',errors,banks,calls:calls.map(c=>({kind:c.kind,at:c.at,args:c.args,block:c.block&&{start:c.block.start,end:c.block.end}})),gate:gate&&{condition:gate.condition,start:gate.start,end:gate.end},derivativeAssignments:{dx:dxMatch?.index,dy:dyMatch?.index}};
}
