/** Writes tests/fixtures/rws/petite-colonie.rws: a hand-written 20×20
 * RimWorld 1.6 save (Core only) whose grids are encoded as the game encodes
 * them (base64 of raw DEFLATE, 16-bit definition short hashes, packed bits).
 * node --experimental-transform-types scripts/rws-import-fixture.ts */
import {deflateRawSync} from 'node:zlib';
import {writeFileSync,mkdirSync} from 'node:fs';
import {rawShortHash} from '../src/import/rimworld/short-hash.ts';

const W=20,H=20,N=W*H,idx=(x:number,z:number)=>z*W+x;
const b64=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64').replace(/(.{100})/g,'$1\n');
const deflated=(bytes:Uint8Array)=>b64(deflateRawSync(bytes));
function ushorts(values:number[]):Uint8Array {const out=new Uint8Array(values.length*2);values.forEach((v,i)=>{out[i*2]=v&255;out[i*2+1]=v>>8;});return out;}
function bits(on:(i:number)=>boolean):Uint8Array {const out=new Uint8Array(Math.ceil(N/8));for(let i=0;i<N;i++)if(on(i))out[i>>3]!|=1<<(i&7);return out;}
const grid=(f:(x:number,z:number)=>string|undefined)=>ushorts(Array.from({length:N},(_,i)=>{const name=f(i%W,Math.floor(i/W));return name?rawShortHash(name):0;}));

// Room: walls x 2..8, z 2..8, door at (5,2); wooden floor inside; rocks top-right.
const inRoom=(x:number,z:number)=>x>2&&x<8&&z>2&&z<8;
const wallCell=(x:number,z:number)=>x>=2&&x<=8&&z>=2&&z<=8&&!inRoom(x,z);
const rock=(x:number,z:number)=>x>=16&&z>=16;
const top=grid((x,z)=>rock(x,z)?'Granite_Rough':inRoom(x,z)?'WoodPlankFloor':z===12?'WaterShallow':x<2?'Gravel':x>=12&&x<16&&z<6?'SoilRich':'Soil');
const under=grid((x,z)=>inRoom(x,z)?'Soil':undefined);
const roofs=grid((x,z)=>inRoom(x,z)?'RoofConstructed':undefined);
const compressed=grid((x,z)=>rock(x,z)?(x===18&&z===18?'MineableSteel':'Granite'):undefined);
const fog=bits(i=>i===idx(19,19));
const home=bits(i=>{const x=i%W,z=Math.floor(i/W);return x>=1&&x<=10&&z>=1&&z<=10;});

const things:string[]=[];let nextId=100;
const thing=(cls:string,def:string,x:number,z:number,body='')=>{const id=`${def}${nextId++}`;things.push(`<thing Class="${cls}"><def>${def}</def><id>${id}</id><map>0</map><pos>(${x}, 0, ${z})</pos>${body}</thing>`);return id;};
for(let z=2;z<=8;z++)for(let x=2;x<=8;x++)if(wallCell(x,z)&&!(x===5&&z===2))thing('Building','Wall',x,z,'<health>300</health><stuff>BlocksGranite</stuff>');
thing('Building_Door','Door',5,2,'<health>120</health><stuff>WoodLog</stuff>');
const bed=thing('Building_Bed','Bed',4,5,'<rot>2</rot><health>91</health><stuff>WoodLog</stuff><faction>Faction_1</faction><assignedPawns><li>Thing_Human1</li></assignedPawns><quality>Good</quality>');
thing('Building','Table1x2c',6,4,'<stuff>WoodLog</stuff><quality>Normal</quality>');
thing('Building','Telescope',6,6);
thing('ThingWithComps','Steel',10,10,'<stackCount>50</stackCount>');
thing('ThingWithComps','WoodLog',11,10,'<stackCount>30</stackCount>');
thing('ThingWithComps','MealSimple',10,11,'<stackCount>5</stackCount><forbidden>True</forbidden>');
thing('ThingWithComps','Luciferium',11,11,'<stackCount>2</stackCount>');
thing('Apparel','Apparel_Parka',12,10,'<stackCount>1</stackCount><stuff>Leather_Plain</stuff><health>90</health><quality>Excellent</quality>');
thing('Plant','Plant_TreeOak',14,14,'<growth>0.8</growth>');
thing('Plant','Plant_Grass',13,14,'<growth>0.5</growth>');
for(const [x,z] of [[13,2],[14,2],[13,3]] as const)thing('Plant','Plant_Potato',x,z,'<growth>0.4</growth>');
thing('Plant','Plant_Ambrosia',15,8,'<growth>1</growth>');
const priorities=(v:number[])=>`<workSettings><priorities><vals>${v.map(n=>`<li>${n}</li>`).join('')}</vals></priorities></workSettings>`;
const skills=(levels:[string,number,string?][])=>`<skills><skills>${levels.map(([d,l,p])=>`<li><def>${d}</def><level>${l}</level><xpSinceLastLevel>120.5</xpSinceLastLevel>${p?`<passion>${p}</passion>`:''}</li>`).join('')}</skills><lastXpSinceMidnightResetTimestamp>350000</lastXpSinceMidnightResetTimestamp></skills>`;
const allSkills=(main:Record<string,[number,string?]>)=>skills(['Shooting','Melee','Construction','Mining','Cooking','Plants','Animals','Crafting','Artistic','Medicine','Social','Intellectual'].map(d=>[d,main[d]?.[0]??2,main[d]?.[1]] as [string,number,string?]));
const colonist=(id:string,x:number,z:number,body:string)=>things.push(`<thing Class="Pawn"><def>Human</def><id>${id}</id><map>0</map><pos>(${x}, 0, ${z})</pos><kindDef>Colonist</kindDef><faction>Faction_1</faction>${body}</thing>`);
colonist('Human1',4,4,`<gender>Female</gender><name Class="NameTriple"><first>Alma</first><nick>Fourmi</nick><last>Rivière</last></name>
<ageTracker><ageBiologicalTicks>108000000</ageBiologicalTicks><birthAbsTicks>-110000000</birthAbsTicks></ageTracker>
<story><bodyType>Thin</bodyType><hairDef>Flowy</hairDef><hairColor>RGBA(0.5, 0.25, 0.1, 1.000)</hairColor><headType>Female_AverageWide</headType><childhood>MedicalAssistant12</childhood><adulthood>Gardener99</adulthood>
<traits><allTraits><li><def>Kind</def></li><li><def>SpeedOffset</def><degree>2</degree></li><li><def>Pyromaniac</def></li></allTraits></traits></story>
${allSkills({Plants:[12,'Major'],Medicine:[8,'Minor'],Cooking:[6]})}
${priorities([1,1,2,3,3,0,0,2,0,3,1,0,2,0,0,0,0,3,3,0])}
<healthTracker><hediffSet><hediffs>
<li Class="Hediff_Injury"><def>Scratch</def><severity>3</severity><part><body>Human</body><index>0</index></part><isPermanent>True</isPermanent><painCategory>LowPain</painCategory></li>
<li Class="Hediff_MissingPart"><def>MissingBodyPart</def><part><body>Human</body><index>29</index></part></li>
<li Class="HediffWithComps"><def>Flu</def><severity>0.2</severity></li>
</hediffs></hediffSet></healthTracker>
<apparel><wornApparel><innerList><li><def>Apparel_CollarShirt</def><id>Apparel_CollarShirt300</id><health>70</health><stuff>Cloth</stuff><quality>Good</quality></li><li><def>Apparel_ShieldBelt</def><id>Apparel_ShieldBelt301</id></li></innerList></wornApparel></apparel>
<equipment><equipment><innerList><li><def>Gun_Revolver</def><id>Gun_Revolver302</id><health>80</health><quality>Masterwork</quality></li></innerList></equipment></equipment>
<inventory><innerContainer><innerList><li Class="ThingWithComps"><def>MealSimple</def><id>MealSimple303</id><stackCount>2</stackCount></li></innerList></innerContainer></inventory>
<needs><needs><li Class="Need_Food"><def>Food</def><curLevel>0.7</curLevel></li><li Class="Need_Mood"><def>Mood</def><curLevel>0.65</curLevel></li></needs></needs>
<guest><hostFaction>null</hostFaction></guest>`);
colonist('Human2',6,5,`<gender>Male</gender><name Class="NameTriple"><first>Bruno</first><nick>Bruno</nick><last>Sable</last></name>
<ageTracker><ageBiologicalTicks>90000000</ageBiologicalTicks><birthAbsTicks>-90000000</birthAbsTicks></ageTracker>
<story><bodyType>Hulk</bodyType><hairDef>Mohawk</hairDef><headType>Male_NarrowPointy</headType><childhood>CaveChild30</childhood><adulthood>Hunter74</adulthood>
<traits><allTraits><li><def>Brawler</def></li><li><def>Nerves</def><degree>-1</degree></li></allTraits></traits></story>
${allSkills({Shooting:[10,'Major'],Melee:[9,'Minor'],Mining:[11]})}
${priorities([1,1,0,3,3,0,0,0,1,2,0,1,0,0,0,0,0,3,3,0])}
<healthTracker><hediffSet><hediffs>
<li Class="Hediff_AddedPart"><def>PegLeg</def><part><body>Human</body><index>46</index></part></li>
<li Class="Hediff_MissingPart"><def>MissingBodyPart</def><part><body>Human</body><index>47</index></part></li>
<li Class="Hediff_Injury"><def>Cut</def><severity>2</severity><part><body>Human</body><index>25</index></part></li>
</hediffs></hediffSet></healthTracker>
<apparel><wornApparel><innerList><li><def>Apparel_Pants</def><id>Apparel_Pants304</id><stuff>WoolSheep</stuff></li></innerList></wornApparel></apparel>
<equipment><equipment><innerList><li><def>MeleeWeapon_LongSword</def><id>MeleeWeapon_LongSword305</id><stuff>Steel</stuff><quality>Normal</quality></li></innerList></equipment></equipment>
<guest><hostFaction>null</hostFaction></guest>`);
things.push(`<thing Class="Pawn"><def>Husky</def><id>Husky1</id><map>0</map><pos>(10, 0, 6)</pos><kindDef>Husky</kindDef><gender>Female</gender><faction>Faction_1</faction>
<name Class="NameSingle"><name>Neige</name></name><ageTracker><ageBiologicalTicks>15000000</ageBiologicalTicks></ageTracker>
<training><learned><vals><li>True</li><li>False</li><li>False</li><li>False</li><li>True</li></vals></learned></training>
<playerSettings><master>Thing_Human2</master></playerSettings><social><directRelations><li><def>Bond</def><otherPawn>Thing_Human2</otherPawn></li></directRelations></social></thing>`);
things.push(`<thing Class="Pawn"><def>Hare</def><id>Hare1</id><map>0</map><pos>(15, 0, 4)</pos><kindDef>Hare</kindDef><gender>Male</gender><ageTracker><ageBiologicalTicks>6000000</ageBiologicalTicks></ageTracker></thing>`);
things.push(`<thing Class="Pawn"><def>Thrumbo</def><id>Thrumbo1</id><map>0</map><pos>(9, 0, 15)</pos><kindDef>Thrumbo</kindDef><gender>Male</gender></thing>`);
void bed;

const cellList=(cells:[number,number][])=>cells.map(([x,z])=>`<li>(${x}, 0, ${z})</li>`).join('');
const stockCells:[number,number][]=[];for(let x=10;x<=12;x++)for(let z=10;z<=11;z++)stockCells.push([x,z]);
const xml=`<?xml version="1.0" encoding="utf-8"?>
<savegame>
	<meta><gameVersion>1.6.4633 rev1261</gameVersion><modIds><li>ludeon.rimworld</li></modIds><modSteamIds><li>0</li></modSteamIds><modNames><li>Core</li></modNames></meta>
	<game>
		<tickManager><ticksGame>360000</ticksGame><gameStartAbsTick>17500</gameStartAbsTick><startingYear>5500</startingYear></tickManager>
		<scenario><name>Petite colonie</name></scenario>
		<playSettings><useWorkPriorities>True</useWorkPriorities></playSettings>
		<storyteller><def>Cassandra</def><difficulty>Medium</difficulty></storyteller>
		<researchManager><currentProj>Stonecutting</currentProj><progress><keys><li>ComplexFurniture</li><li>Stonecutting</li><li>PassiveCooler</li><li>Electricity</li></keys><values><li>300</li><li>150</li><li>400</li><li>0</li></values></progress></researchManager>
		<world>
			<info><name>Monde d’essai</name><planetCoverage>0.05</planetCoverage><seedString>essai</seedString><overallRainfall>Normal</overallRainfall><overallTemperature>Normal</overallTemperature></info>
			<factionManager><allFactions>
				<li><def>Pirate</def><name>Les Pillards</name><relations><li><other>Faction_1</other><goodwill>-100</goodwill><kind>Hostile</kind></li></relations></li>
				<li><loadID>1</loadID><def>PlayerColony</def><name>Les Essais</name><relations><li><other>Faction_0</other><goodwill>-100</goodwill><kind>Hostile</kind></li></relations></li>
			</allFactions></factionManager>
			<worldObjects><worldObjects><li Class="Settlement"><def>Settlement</def><tile>5,0</tile><ID>1</ID><faction>Faction_1</faction><nameInt>Le Camp</nameInt></li></worldObjects></worldObjects>
		</world>
		<maps><li>
			<mapInfo><size>(${W}, 1, ${H})</size><parent>WorldObject_1</parent></mapInfo>
			<fogGrid><fogGridDeflate>${deflated(fog)}</fogGridDeflate></fogGrid>
			<roofGrid><roofsDeflate>${deflated(roofs)}</roofsDeflate></roofGrid>
			<terrainGrid><topGridDeflate>${deflated(top)}</topGridDeflate><underGrid>${b64(under)}</underGrid></terrainGrid>
			<zoneManager><allZones>
				<li Class="Zone_Stockpile"><ID>1</ID><label>Réserve</label><cells>${cellList(stockCells)}</cells><settings><priority>Important</priority><filter><allowedDefs><li>Steel</li><li>WoodLog</li><li>MealSimple</li></allowedDefs></filter></settings></li>
				<li Class="Zone_Growing"><ID>2</ID><label>Champ</label><cells>${cellList([[13,2],[14,2],[13,3],[14,3]])}</cells><plantDefToGrow>Plant_Potato</plantDefToGrow><allowSow>True</allowSow></li>
			</allZones></zoneManager>
			<areaManager><areas><li Class="Area_Home"><ID>0</ID><innerGrid><mapSizeX>${W}</mapSizeX><mapSizeZ>${H}</mapSizeZ><arrDeflate>${deflated(home)}</arrDeflate></innerGrid></li><li Class="Area_BuildRoof"><ID>1</ID></li></areas></areaManager>
			<compressedThingMapDeflate>${deflated(compressed)}</compressedThingMapDeflate>
			<things>${things.join('\n')}</things>
		</li></maps>
	</game>
</savegame>
`;
mkdirSync('tests/fixtures/rws',{recursive:true});
writeFileSync('tests/fixtures/rws/petite-colonie.rws',xml);
console.log(JSON.stringify({bytes:xml.length,things:things.length}));
