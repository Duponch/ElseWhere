import {expect,test} from 'vitest';
import {isMaplessCampaign} from '../src/sim/world-map-state.ts';

/** Envelope fixture only (as world-map-storage.test.ts): a campaign whose
 * last map was abandoned keeps its shared campaign fields. Found while
 * integrating lot 344: the population gain clock (schema 320) was missing
 * from the mapless key list, so a colony that had gained a colonist and then
 * abandoned every map could no longer be saved or loaded. */
const campaign=(schemaVersion:number,extra:Record<string,unknown>)=>({schemaVersion,tick:42,rng:1,nextId:1,
 worldMaps:{revision:1,rootMapId:null,selectedMapId:null,nextMapId:1,campaignSeed:42,mapSize:{width:250,height:250},sites:[],retired:[]},
 worldGroups:{revision:1,selectedGroupId:null,groups:[],losses:[],legacyTravellers:[],events:[],abandonedPawns:[],abandonedContents:[]},
 ...extra});

test('a mapless campaign keeps its population gain clock from schema 320',()=>{
 expect(isMaplessCampaign(campaign(320,{populationGainCore320:300}))).toBe(true);
 expect(isMaplessCampaign(campaign(344,{populationGainCore320:300}))).toBe(true);
 expect(isMaplessCampaign(campaign(319,{populationGainCore320:300}))).toBe(false);
});

test('a mapless campaign keeps its simple Work tab setting from schema 344',()=>{
 expect(isMaplessCampaign(campaign(344,{simpleWorkTab344:true}))).toBe(true);
 expect(isMaplessCampaign(campaign(343,{simpleWorkTab344:true}))).toBe(false);
});
