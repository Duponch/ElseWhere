/** An exact, centered cover crop in the chart's own physical proportions.
 * Keep the complete long axis; the short axis samples a correspondingly
 * smaller interval. An already proportioned chart is the identity. */
export function paintUvSpan(width:number,height:number,referenceAspect=1):readonly [number,number] {
  if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(referenceAspect)
    ||width<=0||height<=0||referenceAspect<=0)return [1,1];
  const ratio=width/height/referenceAspect;
  return ratio>=1?[1,1/ratio]:[ratio,1];
}

export function paintUv(u:number,v:number,width:number,height:number,referenceAspect=1):readonly [number,number] {
  const [su,sv]=paintUvSpan(width,height,referenceAspect);
  return [.5+(u-.5)*su,.5+(v-.5)*sv];
}
