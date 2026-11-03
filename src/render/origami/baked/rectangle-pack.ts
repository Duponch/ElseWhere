/** Bounded preparation-only fallback. Call ONLY after the unchanged source
 * shelf refuses. No rotation, resizing, quantisation, pixels or source writes. */
export interface PackRect {readonly id:number;readonly width:number;readonly height:number}
export interface PackedRect extends PackRect {readonly x:number;readonly y:number}
export interface PackLimits {width:number;height:number;quantum:number;maxPixels:number;maxRectangles?:number;maxWorkChecks?:number;maxExpandedFreeRectangles?:number}
export interface MaxRectsResult {
 readonly width:number;readonly height:number;readonly quantum:number;readonly occupiedPixels:number;
 readonly placements:readonly PackedRect[];
 readonly facts:{heuristic:'best-short-side-fit';rotated:false;resized:false;candidateChecks:number;scoredFits:number;workChecks:number;peakFreeRectangles:number;peakExpandedFreeRectangles:number};
}
interface Space {x:number;y:number;width:number;height:number}
type Spend=(units?:number)=>void;
const integer=(v:number,min:number,name:string)=>{if(!Number.isSafeInteger(v)||v<min)throw Error('MaxRects: invalid '+name);return v;};
const overlaps=(a:Space,b:Space)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const contains=(a:Space,b:Space)=>a.x<=b.x&&a.y<=b.y&&a.x+a.width>=b.x+b.width&&a.y+a.height>=b.y+b.height;
function subtract(space:Space,used:Space,spend:Spend):Space[]{
 spend();
 if(!overlaps(space,used))return[space];const pieces:Space[]=[];
 if(used.x>space.x)pieces.push({x:space.x,y:space.y,width:used.x-space.x,height:space.height});
 if(used.x+used.width<space.x+space.width)pieces.push({x:used.x+used.width,y:space.y,width:space.x+space.width-used.x-used.width,height:space.height});
 if(used.y>space.y)pieces.push({x:space.x,y:space.y,width:space.width,height:used.y-space.y});
 if(used.y+used.height<space.y+space.height)pieces.push({x:space.x,y:used.y+used.height,width:space.width,height:space.y+space.height-used.y-used.height});
 return pieces;
}
function prune(spaces:Space[],spend:Spend):Space[]{
 // Free rectangles may overlap one another. Containment pruning is exact;
 // every later placement is subtracted from ALL intersected free rectangles.
 for(let i=0;i<spaces.length;i++)for(let j=i+1;j<spaces.length;){
  spend();if(contains(spaces[i]!,spaces[j]!)){spend(spaces.length-j);spaces.splice(j,1);continue;}
  spend();if(contains(spaces[j]!,spaces[i]!)){spend(spaces.length-i);spaces.splice(i,1);i--;break;}j++;
 }
 return spaces.sort((a,b)=>{spend();return a.y-b.y||a.x-b.x||a.width-b.width||a.height-b.height;});
}
/** Returns no partial layout when the greedy attempt cannot fit. An area
 * lower bound alone never counts as success. Inputs are always borrowed. */
export function packMaxRectsNoRotation(rectangles:readonly PackRect[],limits:PackLimits):MaxRectsResult|undefined {
 const width=integer(limits.width,1,'width'),height=integer(limits.height,1,'height'),quantum=integer(limits.quantum,1,'quantum'),maxPixels=integer(limits.maxPixels,1,'maxPixels'),maxRectangles=integer(limits.maxRectangles??2048,1,'maxRectangles'),maxWork=integer(limits.maxWorkChecks??8_000_000,1,'maxWorkChecks'),maxExpanded=integer(limits.maxExpandedFreeRectangles??16384,1,'maxExpandedFreeRectangles');
 if(maxWork>8_000_000||maxExpanded>16384)throw Error('MaxRects: hard preparation work/storage budget refused');
 if(width>4096||height>4096||maxRectangles>2048||quantum>4096||width%quantum||height%quantum||width*height>maxPixels)throw Error('MaxRects: atlas dimension/alignment/pixel budget refused');
 if(!rectangles.length||rectangles.length>maxRectangles)throw Error('MaxRects: rectangle count budget refused');
 const ids=new Set<number>();let area=0,workChecks=0;
 const spend:Spend=(units=1)=>{if(workChecks+units>maxWork)throw Error('MaxRects: bounded preparation work refused');workChecks+=units;};
 // All geometry/budget admission precedes the mutable packing work lists.
 for(const rect of rectangles){spend();integer(rect.id,0,'id');integer(rect.width,1,'rectangle width');integer(rect.height,1,'rectangle height');if(ids.has(rect.id))throw Error('MaxRects: duplicate id');ids.add(rect.id);
  if(rect.width%quantum||rect.height%quantum)throw Error('MaxRects: rectangle alignment refused');if(rect.width>width||rect.height>height)throw Error('MaxRects: rectangle dimension refused');area+=rect.width*rect.height;
 }
 if(!Number.isSafeInteger(area)||area>width*height)throw Error('MaxRects: rectangle area budget refused');
 const remaining=rectangles.map(({id,width,height})=>{spend();return{id,width,height};}).sort((a,b)=>{spend();return a.id-b.id;}),placements:PackedRect[]=[];let free:Space[]=[{x:0,y:0,width,height}],candidateChecks=0,scoredFits=0,peakFreeRectangles=1,peakExpandedFreeRectangles=1;
 while(remaining.length){
  let best:{index:number;rect:PackedRect;score:readonly number[]}|undefined;
  for(let index=0;index<remaining.length;index++)for(const space of free){
   spend();candidateChecks++;
   const r=remaining[index]!;if(r.width>space.width||r.height>space.height)continue;scoredFits++;
   const dx=space.width-r.width,dy=space.height-r.height,score=[Math.min(dx,dy),Math.max(dx,dy),space.y,space.x,r.id];
   let better=!best;if(best)for(let i=0;i<score.length;i++){if(score[i]!==best.score[i]){better=score[i]!<best.score[i]!;break;}}
   if(better)best={index,rect:{...r,x:space.x,y:space.y},score};
  }
  if(!best)return undefined;
  spend(remaining.length-best.index);remaining.splice(best.index,1);placements.push(best.rect);
  const expanded:Space[]=[];
  for(const space of free){const pieces=subtract(space,best.rect,spend);if(expanded.length+pieces.length>maxExpanded)throw Error('MaxRects: expanded free-rectangle storage refused BEFORE prune');spend(pieces.length);expanded.push(...pieces);}
  peakExpandedFreeRectangles=Math.max(peakExpandedFreeRectangles,expanded.length);free=prune(expanded,spend);peakFreeRectangles=Math.max(peakFreeRectangles,free.length);
 }
 placements.sort((a,b)=>{spend();return a.id-b.id;});
 // Final complete-layout admission is separate from the greedy score/pruning.
 for(let i=0;i<placements.length;i++){spend();const a=placements[i]!;if(a.x<0||a.y<0||a.x+a.width>width||a.y+a.height>height||a.x%quantum||a.y%quantum)throw Error('MaxRects: final bounds/alignment failed');for(let j=0;j<i;j++){spend();if(overlaps(a,placements[j]!))throw Error('MaxRects: final overlap refused');}}
 return{width,height,quantum,occupiedPixels:area,placements,facts:{heuristic:'best-short-side-fit',rotated:false,resized:false,candidateChecks,scoredFits,workChecks,peakFreeRectangles,peakExpandedFreeRectangles}};
}
