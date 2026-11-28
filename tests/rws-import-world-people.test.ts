import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {ImportContext,convertRwsSave} from '../src/import/rimworld/convert.ts';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {at,parseXml} from '../src/import/rimworld/xml.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {importWorldPeople} from '../src/import/rimworld/import-world-people.ts';
import {importHumanSocial} from '../src/import/rimworld/import-human-social.ts';
import {startingPawn} from '../src/sim/starting-pawns.ts';
import {generatePlanet} from '../src/sim/planet-generation.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {bindBornHumanFaction259} from '../src/sim/world-affiliation-259.ts';
import {validWorldPawnsEnvelope256,validateWorldPawnOwners256} from '../src/sim/world-pawn-save-256.ts';
import {initialWorldPawns256} from '../src/sim/world-pawn-state-256.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const sourceHuman=(id:number,faction:string,name:string,starter=false)=>`
<li><def>Human</def><id>Human${id}</id><faction>${faction}</faction><gender>Male</gender>
<name Class="NameTriple"><first>${name}</first><nick>${name}</nick><last>Témoin</last></name>
<ageTracker><ageBiologicalTicks>90000007</ageBiologicalTicks><birthAbsTicks>-90000000</birthAbsTicks></ageTracker>
<story><headType>Male_AverageNormal</headType><hairDef>Mohawk</hairDef><bodyType>Male</bodyType><childhood>CaveChild30</childhood><adulthood>Hunter74</adulthood></story>
<style><beardDef>Wizard</beardDef></style>
<genes><endogenes><li><def>Skin_Melanin8</def><overriddenByGene>null</overriddenByGene></li></endogenes></genes>
<skills><skills><li><def>Construction</def><level>6</level><xpSinceLastLevel>100</xpSinceLastLevel><passion>Major</passion></li></skills></skills>
<healthTracker><hediffSet><hediffs/></hediffSet></healthTracker>
${starter?'<wasLeftBehindStartingPawn>True</wasLeftBehindStartingPawn><becameWorldPawnTickAbs>17500</becameWorldPawnTickAbs><apparel><wornApparel><innerList><li><def>Apparel_Pants</def><id>Apparel_Pants9001</id><stuff>Cloth</stuff><quality>Good</quality><health>50</health></li></innerList></wornApparel></apparel>':''}
</li>`;
it('replaces an actual left-behind starter and source leader without fabricating unknown world origins',()=>{
 const save=readRwsSave(fixture.replace('<def>Pirate</def><name>Les Pillards</name>','<def>Pirate</def><name>Les Pillards</name><leader>Thing_Human9002</leader>'));
 const result=convertRwsSave(save,{planet:false}),w=result.world;
 const planet=generatePlanet(w.seed,{biome:'temperate-forest',latitude:0,longitude:0,meanTemperature:15,rainfall:1200},w.tick,2);
 const f=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles:planet.tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
 if(!f.ok)throw Error(f.reason);
 const complete=completeWorldFactionRegistry256({version:w.schemaVersion,draft:f.draft,playerDef:'PlayerColony',name:'Camp témoin',postWorldRandom:new WorldGenerationRandom(718)});
 if(!complete.ok)throw Error(complete.reason);
 w.planet=planet;w.worldFactions=complete.registry;w.nextId=f.nextThingId;
 const player=complete.registry.playerFactionId,pirate=complete.registry.factions.find(r=>r.def==='Pirate')!.id;
 const old=startingPawn(w.nextId++,'Généré à remplacer',0,0,0,66,w.seed,w.tick,w.schemaVersion);
 bindBornHumanFaction259(w,old,player);
 w.worldPawns=initialWorldPawns256();w.worldPawns.atCore=w.tick*10;
 if(w.tick)w.worldPawns.physicalClockCore297=effectiveCore297(w);
 w.worldPawns.owners=[{kind:'human',actor:old,factionId:player,originMapId:null,context:{seed:w.seed,width:32,height:32},clockCore:w.tick*10,enteredAtAbsCore:17500,mode:'active',items:[],packed:[],keepForever:true,startingPawnLeftBehind:true}];
 at(save.game,'world')!.children.push(parseXml(`<worldPawns><pawnsForcefullyKeptAsWorldPawns><li>Thing_Human9001</li></pawnsForcefullyKeptAsWorldPawns><pawnsMothballed>${sourceHuman(9001,'Faction_1','Réserve',true)}${sourceHuman(9002,'Faction_0','Chef')}${sourceHuman(9003,'Faction_0','OrigineInconnue')}</pawnsMothballed></worldPawns>`));
 const human=save.maps[0]!.things.find(t=>t.def==='Human')!;
 human.node.children.push(parseXml('<social><directRelations><li><def>Parent</def><otherPawn>Thing_Human9001</otherPawn></li></directRelations></social>'));
 const notes=new ImportNotes(),ctx=new ImportContext(save,save.maps[0]!,w,notes,true,new Map([['Faction_1',player],['Faction_0',pirate]]));
 for(const [key,id] of result.thingIds)ctx.thingIds.set(key,id);
 importWorldPeople(ctx);
 const row=w.worldPawns.owners[0]!;
 if(row.kind!=='human')throw Error('Human owner required');
 expect(row.actor.name).toBe('Réserve Témoin');expect(row.actor.id).toBe(old.id);expect(row.items).toHaveLength(1);
 expect(row.items[0]).toMatchObject({item:'cloth-pants',owner:{type:'apparel',pawnId:old.id},apparel:{quality:'good',hitPoints:50}});
 expect(row.heldAtCore259).toBe(w.tick*10);expect(ctx.thingIds.get('Human9001')).toBe(old.id);
 expect(row.actor.nativeHuman?.biologicalCoreRemainder).toBe(7);
 const leader=w.worldFactions.leaders.find(x=>x.factionId===pirate)!;
 expect(leader.pawn.name).toBe('Chef Témoin');expect(ctx.thingIds.get('Human9002')).toBe(leader.pawn.id);
 expect(ctx.thingIds.has('Human9003')).toBe(false);expect(w.worldPawns.owners).toHaveLength(1);
 expect(notes.summary('world').dropped).toBeGreaterThan(0);
 const localId=ctx.thingIds.get(human.id)!;
 w.relationships={links:[{kind:'lover',aId:Math.min(localId,old.id),bId:Math.max(localId,old.id),recordedAt:w.tick}]};
 importHumanSocial(ctx,[{thing:human,pawn:w.pawns.find(p=>p.id===ctx.thingIds.get(human.id))!}]);
 expect(w.relationships?.links).toContainEqual({kind:'parent',aId:ctx.thingIds.get(human.id),bId:old.id,recordedAt:0});
 expect(w.relationships?.links.some(x=>x.kind==='lover')).toBe(false);
 expect(validWorldPawnsEnvelope256({worldPawns:w.worldPawns},w.schemaVersion,effectiveCore297(w),w.nextId)).toBe(true);
 expect(validateWorldPawnOwners256(w.worldPawns,w,new Set(),undefined,new Set(w.pawns.map(p=>p.id)))).toEqual([]);
});
