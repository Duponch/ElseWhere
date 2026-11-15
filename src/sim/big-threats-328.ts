/** Core StorytellerComp_OnOffCycle for Cassandra's big threats (schema 328).
 *
 * Before 20 whole days the slot is always an enemy raid
 * (forceRaidEnemyBeforeDaysPassed). Afterwards Core draws the incident by its
 * ThreatBig weight among those that can fire. Elsewhere has only the raid
 * (pirates or mechanoids): any other ticket uses the slot up with no event,
 * the rule the small threats and the misc lottery already follow. Points
 * minimums are the Core ones; the absent threats keep no refire memory. */
export const BIG_THREATS_328=Object.freeze([
  {id:'raid',weight:7.4,minPoints:0},
  {id:'infestation',weight:2.7,minPoints:400},
  {id:'manhunter-pack',weight:2,minPoints:0},
  {id:'defoliator-ship-part',weight:2,minPoints:400},
  {id:'psychic-ship-part',weight:2,minPoints:400},
  {id:'mass-animal-insanity',weight:1.3,minPoints:0},
] as const);
export type BigThreat328=typeof BIG_THREATS_328[number]['id'];
export const FORCE_RAID_DAYS_328=20;

/** points undefined (no wealth record yet) leaves every ticket eligible.
 * From schema 341 `recent` gives the recent-incident factor of each ticket
 * (recent-incidents-341.ts); the raid ignores it, as Core's RaidEnemy is
 * flagged ignoreRecentSelectionWeighting. */
export function drawBigThreat328(wholeDays:number,points:number|undefined,random:()=>number,recent?:(id:string)=>number):BigThreat328 {
  if(wholeDays<FORCE_RAID_DAYS_328)return 'raid';
  const rows=BIG_THREATS_328.filter(row=>points===undefined||points>=row.minPoints);
  const weight=recent?(row:typeof rows[number])=>row.id==='raid'?row.weight:row.weight*recent(row.id):(row:typeof rows[number])=>row.weight;
  let roll=random()*rows.reduce((sum,row)=>sum+weight(row),0);
  for(const row of rows){roll-=weight(row);if(roll<0)return row.id;}
  return rows.at(-1)!.id;
}
