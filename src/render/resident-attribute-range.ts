import type {BufferAttribute,InterleavedBuffer} from 'three/webgpu';

/** Retain every outstanding write, including while a mesh is culled. One
 * merged component range bounds bookkeeping across repeated adoptions. */
export function markResidentAttributeRange(attribute:BufferAttribute|InterleavedBuffer,start:number,count:number):void {
 if(count<=0)return;
 let first=start,last=start+count;
 for(const range of attribute.updateRanges){first=Math.min(first,range.start);last=Math.max(last,range.start+range.count);}
 attribute.clearUpdateRanges();attribute.addUpdateRange(first,last-first);attribute.needsUpdate=true;
}
