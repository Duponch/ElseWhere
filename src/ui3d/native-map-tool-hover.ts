import type {CardboardPiece} from './prototype-art';

/** Map tools grow around their own fixed centre; layout and neighbours stay put. */
export function applyNativeMapToolHover(piece:CardboardPiece,hover:number):boolean {
  const u=piece.userData,h=Math.max(0,Math.min(1,hover)),press=Math.max(0,Math.min(1,u.pressVal??0));
  const zoom=1+h*.45-press*.025,x=u.basePos.x,y=u.basePos.y,z=u.basePos.z+(u.active ? .02 : 0)+h*.24-press*.015;
  const sx=u.baseScale.x*zoom,sy=u.baseScale.y*zoom,sz=u.baseScale.z*zoom;
  const rx=u.baseRot.x-h*.06,ry=u.baseRot.y+h*.04,rz=u.baseRot.z+h*.012,shadow=u.shadowMesh.position;
  const shadowX=.022+h*.04,shadowY=-.025-h*.05,shadowZ=-.012-h*.06;
  if(piece.position.x===x&&piece.position.y===y&&piece.position.z===z&&piece.rotation.x===rx&&piece.rotation.y===ry&&piece.rotation.z===rz&&piece.scale.x===sx&&piece.scale.y===sy&&piece.scale.z===sz&&shadow.x===shadowX&&shadow.y===shadowY&&shadow.z===shadowZ)return false;
  piece.position.set(x,y,z);piece.rotation.set(rx,ry,rz);piece.scale.set(sx,sy,sz);shadow.set(shadowX,shadowY,shadowZ);return true;
}
