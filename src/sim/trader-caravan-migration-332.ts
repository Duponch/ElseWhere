import {newVisitorAgenda} from './visitor-state.ts';
import {visitorAgendaClock261} from './temp-travelers-save-261.ts';
import {registeredMapForValidation} from './world-map-context.ts';
import {secondaryMapForValidation} from './secondary-site-save.ts';
import type {World} from './types.ts';
import type {CampaignState} from './world-map-state.ts';

/** 331→332: every home visitor calendar of the campaign (loaded map, other
 * registered maps, legacy second site) adopts Cassandra's trader caravan
 * agenda, appended last as enableVisitors does. Like the V123 exotic
 * adoption, the current year's opportunities already past are discarded:
 * no catch-up arrival, no reward, no other agenda, RNG or identity touched. */
export function adoptTraderCaravanSchedule332(input:World):void {
  const adopt=(view:World|undefined)=>{
    const s=view?.visitors;if(!view||s?.profile!=='cassandra-visitors-v1'||s.caravan332)return;
    s.caravan332=newVisitorAgenda(view.seed,'caravan',visitorAgendaClock261(view,332));
  };
  const root=input as unknown as CampaignState;
  if(root.worldMaps)for(const site of root.worldMaps.sites)adopt(registeredMapForValidation(root,site.id));
  else{adopt(input);adopt(secondaryMapForValidation(input));}
}
