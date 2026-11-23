/**
 * Core ThingSelectionUtility.SelectNextColonist / SelectPreviousColonist
 * (keys Period / Comma): over the colonists in colonist bar order, the one
 * after the last selected (next) or before the first selected (previous);
 * with none selected, the first (next) or the last (previous).
 */
export function cycledColonist(colonists:readonly number[],selected:ReadonlySet<number>,next:boolean):number|undefined {
  if(!colonists.length)return undefined;
  let at=-1;
  if(next){for(let i=colonists.length-1;i>=0;i--)if(selected.has(colonists[i]!)){at=i;break;}}
  else at=colonists.findIndex(id=>selected.has(id));
  if(at<0)return next?colonists[0]:colonists.at(-1);
  const n=colonists.length;
  return colonists[((next?at+1:at-1)%n+n)%n];
}
