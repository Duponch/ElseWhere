import type { BackgroundDefinition,BackgroundSkillId,BackgroundWorkTag } from './colonist-backgrounds.ts';
import type { BodyTypeId } from './pawn-appearance.ts';
import type { CoreTraitDefName } from './traits.ts';
import { CORE_BACKSTORY_TEXTS_370 } from './core-backstory-texts-370.ts';
import type { WorkType } from './types.ts';

/** Schema 370: Core's 166 shuffled BackstoryDefs (Data/Core/Defs/
 * BackstoryDefs/Shuffled, file and definition order), id = Core defName.
 * Every mechanical field is Core's: slot, spawnCategories, skillGains,
 * workDisables, requiredWorkTags, forced and disallowed traits (degree 0 when
 * the XML gives none, as BackstoryTrait does), body types, requiresSpawnCategory
 * and the Core-only possessions (the seven that need a DLC are left out, as in
 * a Core game). The solid backstories of named people (PawnBio) are not
 * included. No Core BackstoryDef carries a gender restriction: only titles and
 * body types depend on the person's sex. Texts: core-backstory-texts-370.ts. */
export type CoreBackstorySlot370='childhood'|'adulthood';
export type CoreBody370=Readonly<{g?:BodyTypeId;m?:BodyTypeId;f?:BodyTypeId}>;
export type CoreTraitRef370=readonly [def:CoreTraitDefName,degree:number];
export interface CoreBackstory370 extends BackgroundDefinition {
  readonly id:string;readonly slot:CoreBackstorySlot370;
  readonly labelShort:string;readonly labelFemale?:string;readonly labelShortFemale?:string;
  readonly categories:readonly string[];readonly requiresCategory:boolean;
  readonly forcedTraits:readonly CoreTraitRef370[];readonly disallowedTraits:readonly CoreTraitRef370[];
  readonly body:CoreBody370;
  /** Core ThingDef and count (an exact IntRange in every Core def). */
  readonly possessions:readonly (readonly [string,number])[];
}
interface Extra {forced?:readonly CoreTraitRef370[];disallowed?:readonly CoreTraitRef370[];possessions?:readonly (readonly [string,number])[];requiresCategory?:true}
function s(slot:'c'|'a',categories:readonly string[],gains:Partial<Record<BackgroundSkillId,number>>,disables:readonly BackgroundWorkTag[],requires:readonly BackgroundWorkTag[],body:CoreBody370,extra:Extra={}):Omit<CoreBackstory370,'id'|'label'|'labelShort'|'description'> {
  return {slot:slot==='c'?'childhood':'adulthood',gains:Object.freeze({...gains}),disables:Object.freeze([...disables]),requires:Object.freeze([...requires]),
    categories:Object.freeze([...categories]),requiresCategory:extra.requiresCategory===true,forcedTraits:Object.freeze([...extra.forced??[]]),disallowedTraits:Object.freeze([...extra.disallowed??[]]),
    body:Object.freeze({...body}),possessions:Object.freeze([...extra.possessions??[]])};
}
const RAW={
 SewerKid57:s('c',['InsectsRelated'],{cooking:2},[],[],{}),
 NavyScientist52:s('a',['Offworld','Scientist','Researcher'],{intellectual:8},[],['intellectual'],{m:'Male',f:'Female'}),
 GlitterworldEmpath26:s('a',['Offworld','Researcher'],{social:8,medicine:2},['violent'],['social'],{m:'Thin',f:'Thin'},{disallowed:[['Psychopath',0]]}),
 GlitterworldSurgeon15:s('a',['Offworld','Pirate','Scientist','Researcher'],{artistic:5,medicine:3,social:1},[],['caring','artistic'],{m:'Male',f:'Female'},{possessions:[['MedicineUltratech',2]]}),
 Novelist7:s('a',['Offworld','Researcher'],{construction:-5,mining:-5,artistic:8},['manual-dumb','social'],['intellectual'],{m:'Thin',f:'Thin'},{possessions:[['Novel',1]]}),
 CharityWorker36:s('a',['Offworld'],{social:6,mining:-3},['violent'],['caring','social'],{m:'Thin',f:'Thin'},{disallowed:[['Psychopath',0]]}),
 GlitterworldOfficer60:s('a',['Offworld','Pirate','Researcher'],{melee:6,artistic:4},['manual-dumb'],['violent'],{m:'Hulk',f:'Hulk'}),
 BiosphereManager95:s('a',['Offworld','Farmer'],{shooting:-4,animals:6,plants:6},['manual-dumb','crafting','cooking'],['artistic'],{m:'Male',f:'Female'}),
 VRDesigner87:s('a',['Offworld','Scientist','Farmer'],{construction:3,plants:4,artistic:5},['manual-dumb'],['artistic'],{m:'Thin',f:'Thin'}),
 Architect28:s('a',['Offworld'],{construction:5,artistic:7,crafting:-3},['manual-dumb'],['intellectual'],{m:'Male',f:'Female'},{possessions:[['TextBook',1]]}),
 Sculptor63:s('a',['Offworld'],{plants:-4,mining:4,artistic:9},['manual-dumb','crafting','cooking'],['artistic'],{m:'Fat',f:'Fat'},{possessions:[['BlocksMarble',10]]}),
 MedievalFarmOaf58:s('a',['Offworld','Pirate','Farmer'],{plants:8,mining:3},['intellectual'],['manual-dumb','plant-work','mining'],{g:'Fat'}),
 MedievalLord57:s('a',['Offworld'],{social:7,melee:5,shooting:5},['manual-dumb','manual-skilled'],['social'],{m:'Hulk',f:'Thin'}),
 MedievalMinstrel95:s('a',['Offworld','Pirate'],{social:4,artistic:3,melee:2},['manual-skilled','hauling'],[],{m:'Fat',f:'Fat'}),
 Taster16:s('a',['Offworld','Pirate'],{cooking:7,construction:-4,crafting:-4},['manual-dumb'],['cooking'],{m:'Fat',f:'Fat'},{possessions:[['MealLavish',1]]}),
 Blacksmith72:s('a',['Offworld','Pirate'],{shooting:-5,melee:4,crafting:6},['intellectual'],['manual-dumb','manual-skilled'],{m:'Male',f:'Female'},{possessions:[['MeleeWeapon_LongSword',1]]}),
 MessageCarrier77:s('a',['Offworld','Pirate'],{melee:3,animals:4},['intellectual'],[],{m:'Hulk',f:'Hulk'}),
 MedievalDoctor40:s('a',['Offworld','Pirate'],{melee:6,medicine:1},[],['caring'],{m:'Male',f:'Thin'}),
 Herbalist54:s('a',['Offworld','Pirate','Farmer','Cult'],{plants:4,medicine:4,social:-2},[],['caring','plant-work'],{m:'Thin',f:'Thin'},{possessions:[['MedicineHerbal',5]]}),
 MedievalSailor97:s('a',['Offworld','Pirate'],{melee:4,social:4,animals:4},['manual-skilled'],['manual-dumb'],{m:'Male',f:'Female'}),
 MedievalSlave49:s('c',['Offworld','Pirate','Cult'],{plants:2,construction:2,mining:2,intellectual:-3},[],[],{}),
 MedievalLordling19:s('c',['Offworld'],{social:4,construction:-1,mining:-1,plants:-1},['manual-dumb'],[],{}),
 ConventChild16:s('c',['Offworld','Farmer','Cult'],{construction:3,plants:3},['intellectual','violent'],[],{}),
 Policeman45:s('a',['Offworld','ImperialCommon','Outlander'],{social:3,shooting:4,melee:3},[],['social','violent'],{m:'Male',f:'Female'}),
 Chef52:s('a',['Offworld','Pirate'],{cooking:6,social:2},['cleaning','manual-dumb'],['cooking'],{m:'Male',f:'Female'},{possessions:[['MealFine',3]]}),
 Housemate8:s('a',['Offworld','Outlander','ImperialCommon'],{cooking:3,medicine:3,crafting:2},[],['manual-dumb'],{m:'Male',f:'Female'},{possessions:[['Novel',1]]}),
 Inventor6:s('a',['Offworld','Outlander','Scientist','Researcher'],{crafting:5,intellectual:2},[],['intellectual','crafting'],{m:'Thin',f:'Thin'},{possessions:[['Schematic',1]]}),
 Teacher20:s('a',['Offworld','Outlander'],{intellectual:3,social:4},[],['intellectual','social'],{m:'Male',f:'Female'}),
 CivilServant2:s('a',['Offworld','Outlander','ImperialCommon'],{social:3,intellectual:3,construction:-2},[],[],{m:'Male',f:'Female'}),
 Bartender62:s('a',['Offworld','Outlander','Pirate','ImperialCommon'],{social:4,melee:2,cooking:2},[],['social','cooking'],{m:'Hulk',f:'Fat'},{possessions:[['Beer',6]]}),
 ConceptualArtist39:s('a',['Offworld'],{artistic:8,crafting:1},['social','caring','hauling'],['artistic'],{m:'Male',f:'Female'}),
 Evangelist39:s('a',['Offworld','Outlander','Cult','Researcher'],{social:4,artistic:4,medicine:-3},[],['social','caring'],{m:'Male',f:'Female'}),
 AsceticPriest84:s('a',['Offworld','Outlander','Cult'],{plants:4,medicine:2,cooking:2},['violent','social'],['plant-work','manual-dumb'],{m:'Thin',f:'Thin'},{forced:[['Ascetic',0]]}),
 EscapedConvict90:s('a',['Offworld','Outlander','Pirate','ImperialCommon','Madman','Miner'],{mining:4,crafting:2},['caring'],['violent'],{m:'Male',f:'Female'}),
 Nurse61:s('a',['Offworld','Outlander','ImperialCommon','Scientist'],{social:4,medicine:5},['violent'],['caring'],{m:'Male',f:'Female'}),
 HouseServant63:s('a',['Offworld','Outlander','Pirate','ImperialCommon'],{cooking:4,plants:-3,mining:-3},['intellectual'],['manual-dumb','cleaning'],{m:'Fat',f:'Fat'}),
 Bodyguard58:s('a',['Offworld','Outlander','Pirate'],{shooting:4,melee:4},['social'],['violent'],{m:'Hulk',f:'Hulk'},{possessions:[['Gun_Autopistol',1]]}),
 Mathematician6:s('a',['Offworld','Researcher'],{shooting:-3,intellectual:8},['manual-dumb'],['intellectual'],{m:'Thin',f:'Thin'},{possessions:[['TextBook',1]]}),
 Paramedic45:s('a',['Offworld','Outlander','ImperialCommon','Scientist'],{shooting:-5,medicine:6},[],['caring','violent'],{m:'Male',f:'Female'}),
 Gardener99:s('a',['Offworld','Pirate','ImperialCommon','Farmer'],{plants:8},['intellectual','crafting'],['manual-dumb','plant-work'],{m:'Male',f:'Female'},{possessions:[['PlantPot',1]]}),
 Torturer37:s('a',['Offworld','Outlander','Pirate','ImperialCommon'],{melee:6},['social','caring'],['violent'],{m:'Male',f:'Female'},{forced:[['Psychopath',0]]}),
 Defector78:s('a',['Offworld','Outlander','Pirate'],{shooting:5,social:-4,medicine:3},['artistic'],['violent','caring'],{m:'Male',f:'Female'}),
 ConstructionEngineer32:s('a',['Offworld','Pirate'],{construction:8,plants:-3},['intellectual','cooking'],['manual-skilled'],{m:'Hulk',f:'Female'}),
 Rancher43:s('a',['Offworld','Outlander','Pirate','Hunter'],{animals:8,cooking:-4,mining:-4},['manual-dumb'],['animals'],{m:'Fat',f:'Fat'},{possessions:[['Apparel_CowboyHat',1]]}),
 LowWageWorker7:s('a',['Offworld','Outlander','Pirate','ImperialCommon'],{cooking:4,plants:3,crafting:3},[],['manual-dumb','cleaning'],{m:'Male',f:'Female'}),
 Model99:s('a',['Offworld'],{social:5,artistic:6},['manual-dumb','intellectual','manual-skilled','caring'],['social','artistic'],{m:'Hulk',f:'Thin'},{forced:[['Beauty',2]]}),
 Geologist66:s('a',['Offworld','Outlander','Pirate','Scientist','Miner','Researcher'],{mining:8,crafting:3},[],['intellectual'],{m:'Male',f:'Female'},{possessions:[['Jade',2]]}),
 Jailbird40:s('a',['Offworld','Outlander','Pirate','Madman'],{melee:5,cooking:3},['social','caring'],['violent'],{m:'Hulk',f:'Hulk'}),
 Actor72:s('a',['Offworld','Outlander','ImperialCommon'],{social:8,crafting:3},['manual-dumb'],['social'],{m:'Male',f:'Female'}),
 Veterinarian99:s('a',['Offworld','Outlander','Scientist'],{animals:4,medicine:4,cooking:-4},[],['caring'],{m:'Male',f:'Female'}),
 ExplosivesExpert26:s('a',['Offworld','Outlander','Pirate','ImperialCommon','Miner'],{mining:5,intellectual:5},['manual-dumb'],['violent'],{m:'Fat',f:'Fat'}),
 Counselor26:s('a',['Offworld','Outlander'],{social:9},['cooking'],['social'],{m:'Thin',f:'Thin'}),
 Recruiter14:s('a',['Offworld','Outlander','Pirate','Miner','Cult'],{melee:5,social:5},['caring'],['social'],{m:'Male',f:'Female'}),
 Drifter67:s('a',['Offworld','Outlander','Pirate','Cult'],{cooking:3,construction:3,artistic:-4},[],[],{m:'Thin',f:'Thin'},{possessions:[['Novel',1]]}),
 MachineCollector55:s('a',['Offworld','Outlander','Scientist'],{social:-3,crafting:6,intellectual:6},[],['crafting'],{m:'Male',f:'Female'},{possessions:[['Schematic',1]]}),
 ConArtist80:s('a',['Offworld','Outlander'],{social:10},['violent'],['social'],{m:'Male',f:'Thin'}),
 CaveExplorer45:s('a',['Offworld','Outlander','Pirate','Scientist','Miner','Researcher'],{mining:8},[],['mining'],{m:'Male',f:'Female'}),
 QuarryWorker29:s('a',['Offworld','Outlander','Pirate','Scientist','Miner'],{mining:8},[],['mining'],{m:'Male',f:'Female'}),
 ContractMiner86:s('a',['Offworld','Outlander','Pirate','Scientist','Miner'],{mining:8},[],['mining'],{m:'Male',f:'Female'}),
 Logger95:s('a',['Offworld','Outlander','Pirate','Scientist','Logger'],{plants:8},[],['plant-work'],{m:'Male',f:'Female'},{possessions:[['WoodLog',10]]}),
 Ranger96:s('a',['Offworld','Outlander','Pirate','Scientist','Logger'],{plants:6,shooting:2},[],['plant-work'],{m:'Male',f:'Female'}),
 Forester96:s('a',['Offworld','Outlander','Pirate','Scientist','Logger'],{plants:6,intellectual:2},[],['plant-work'],{m:'Male',f:'Female'}),
 FurnitureBuilder83:s('a',['Offworld','Outlander','Pirate','Scientist','Logger'],{construction:4,plants:3},[],['plant-work','constructing'],{m:'Male',f:'Female'}),
 Hunter89:s('a',['Offworld','Outlander','Pirate','Scientist','Hunter'],{animals:3,shooting:5},[],['violent','animals'],{m:'Male',f:'Female'},{possessions:[['Leather_Bear',10]]}),
 Slaughterer58:s('a',['Offworld','Outlander','Pirate','Scientist','Hunter'],{animals:5,shooting:3},[],['violent','animals'],{m:'Male',f:'Female'},{possessions:[['Meat_Pig',5]]}),
 AnimalFarmer21:s('a',['Offworld','Outlander','Pirate','Scientist','Hunter'],{animals:5,shooting:3},[],['violent','animals'],{m:'Male',f:'Female'},{possessions:[['Kibble',10]]}),
 CropFarmer17:s('a',['ImperialCommon','Offworld','Farmer'],{plants:8},[],['plant-work'],{m:'Hulk',f:'Female'},{possessions:[['SunLamp',1]]}),
 CorporateManager76:s('a',['ImperialCommon','Offworld'],{social:6,intellectual:2},[],['social'],{m:'Male',f:'Female'}),
 LivestockFarmer8:s('a',['ImperialCommon','Offworld','Hunter'],{animals:7},[],['animals'],{m:'Hulk',f:'Female'},{possessions:[['Milk',3]]}),
 VatgrownSoldier8:s('c',['Offworld','Pirate','ImperialCommon','ImperialFighter','Vatgrown'],{melee:4,shooting:4},['social','caring'],[],{}),
 SicklyChild55:s('c',['Offworld','Outlander','ImperialCommon','ImperialFighter'],{intellectual:4,medicine:5,melee:-2,social:-2,construction:-2},[],[],{},{possessions:[['TextBook',1]]}),
 FrightenedChild43:s('c',['Offworld','Outlander','ImperialCommon','Madman','Cult'],{medicine:3,cooking:3},['violent'],[],{}),
 ComaChild93:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter'],{social:4,construction:-2,mining:-2},[],[],{m:'Thin',f:'Thin'}),
 Pyromaniac18:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter'],{social:-3,cooking:-2,artistic:3},['firefighting'],[],{},{forced:[['Pyromaniac',0]]}),
 Mute34:s('c',['Offworld','Outlander','ImperialCommon','ImperialFighter','Cult'],{animals:5},['social'],[],{}),
 WarRefugee51:s('c',['Offworld','Outlander','ImperialCommon'],{cooking:2,crafting:2},['violent'],[],{}),
 MusicalKid86:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter'],{social:-2,artistic:5},[],[],{}),
 ChildStar74:s('c',['Offworld','Pirate'],{social:3,artistic:3,intellectual:-2},['manual-dumb'],[],{}),
 ChildSpy47:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter','Cult'],{social:4,intellectual:-2},[],[],{}),
 ShopKid36:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter'],{social:4,intellectual:2},[],[],{}),
 OrganFarm67:s('c',['Offworld','Outlander','ImperialCommon','Madman'],{medicine:5},['violent'],[],{m:'Male',f:'Female'}),
 MedicalAssistant12:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter','Scientist'],{medicine:5},['firefighting'],[],{},{disallowed:[['Pyromaniac',0]]}),
 CultChild3:s('c',['Offworld','Outlander','Pirate','Madman','Cult'],{medicine:-3,artistic:5},['intellectual'],[],{}),
 StoryWriter67:s('c',['Offworld','Outlander','Pirate','ImperialCommon','ImperialFighter'],{artistic:4,intellectual:3},[],[],{},{possessions:[['Novel',1]]}),
 FactoryWorker58:s('a',['Offworld','Outlander','Pirate'],{animals:3,construction:3,crafting:2},['intellectual','artistic','cooking'],['manual-dumb','manual-skilled','animals'],{m:'Hulk',f:'Hulk'}),
 PsychiatricPatient94:s('a',['Offworld','Outlander','Madman','Cult'],{cooking:-2,crafting:-2},['social','caring','violent'],[],{m:'Thin',f:'Thin'}),
 HumanComputer83:s('a',['Offworld','Pirate','Scientist','Researcher'],{shooting:3,intellectual:7},['artistic'],['intellectual'],{m:'Thin',f:'Thin'}),
 Sheriff52:s('a',['Offworld','Outlander','Pirate'],{shooting:4,melee:4,social:4},[],['violent'],{m:'Fat',f:'Fat'},{possessions:[['Apparel_Duster',1]]}),
 UrbworldEntrepreneur14:s('a',['Offworld','Researcher'],{social:6,intellectual:3},[],['social'],{m:'Male',f:'Thin'}),
 JoywireArtist8:s('a',['Offworld','Pirate','Scientist'],{artistic:3,intellectual:2,medicine:2},['manual-dumb'],['intellectual'],{m:'Male',f:'Female'}),
 MafiaBoss17:s('a',['Offworld','Pirate','Cult'],{shooting:4,melee:3,social:4},['manual-dumb','caring','cooking'],['social'],{m:'Hulk',f:'Female'}),
 UrbworldDrone32:s('a',['Offworld','Pirate','Miner'],{construction:5,mining:4,social:-2},['artistic','intellectual'],['manual-dumb','manual-skilled'],{m:'Hulk',f:'Hulk'}),
 UrbworldRebel56:s('a',['Offworld','Pirate'],{melee:3,construction:3,mining:2},['intellectual','crafting'],['manual-dumb'],{m:'Hulk',f:'Female'}),
 CaveworldIlluminator95:s('a',['Offworld','Pirate','Miner'],{mining:3,social:2},[],['mining','manual-skilled'],{m:'Male',f:'Female'},{forced:[['Undergrounder',0]]}),
 ColonySettler53:s('a',['Offworld','Outlander','Researcher'],{construction:4,plants:4,mining:4},[],['manual-dumb','manual-skilled'],{m:'Hulk',f:'Female'}),
 DeepSpaceMiner3:s('a',['Offworld','Pirate','Miner','Researcher'],{mining:7,construction:3,melee:2},[],['manual-dumb','manual-skilled'],{m:'Fat',f:'Female'}),
 StarshipJanitor33:s('a',['Offworld','ImperialCommon','Researcher'],{construction:2,crafting:3},[],['manual-dumb','manual-skilled'],{m:'Male',f:'Female'}),
 Castaway57:s('a',['Offworld','Pirate','Madman','Cult'],{melee:5,animals:3,construction:4},['intellectual','social','artistic'],['manual-dumb','plant-work'],{m:'Hulk',f:'Hulk'}),
 Taxonomist0:s('a',['Offworld','Scientist','Researcher'],{animals:5,plants:5},['violent'],['intellectual'],{m:'Thin',f:'Thin'},{possessions:[['TextBook',1]]}),
 SpaceTactician28:s('a',['Offworld','Pirate','ImperialCommon'],{shooting:4,intellectual:4},['social','artistic'],['intellectual'],{m:'Thin',f:'Thin'}),
 IndustrialOrphan13:s('c',['Offworld','Pirate'],{crafting:3,mining:3,intellectual:-2},[],[],{}),
 UrbworldUrchin61:s('c',['Offworld','Pirate','Cult'],{melee:4,shooting:2},[],[],{}),
 TestSubject15:s('c',['Offworld','Pirate','Madman','Cult'],{shooting:4},['social','caring','firefighting'],[],{}),
 WreckageExplorer93:s('c',['Offworld','Outlander','Pirate','Scientist'],{animals:3,intellectual:3},[],[],{}),
 ApocalypseSurvivor23:s('c',['Offworld','Pirate','Cult'],{shooting:4,artistic:-3,intellectual:-3},[],[],{}),
 CaveworldTender26:s('c',['Offworld','Pirate','Farmer'],{plants:4,mining:2,shooting:-3},[],[],{},{forced:[['Undergrounder',0]]}),
 CaveworldTunneler48:s('c',['Offworld','Pirate','Miner'],{construction:1,mining:6,shooting:-2},['intellectual','crafting'],[],{m:'Hulk',f:'Hulk'},{forced:[['Undergrounder',0]]}),
 Scout44:s('c',['Offworld','Outlander','Pirate','ImperialCommon'],{shooting:3,crafting:2,construction:1},['artistic','intellectual'],[],{}),
 ShelterChild50:s('c',['Offworld','Pirate'],{intellectual:3,medicine:3,social:2,construction:-2,mining:-2},[],[],{},{possessions:[['TextBook',1]]}),
 Hermit82:s('a',['Outsider','Cult'],{plants:4,crafting:3,construction:1},['social'],['plant-work','manual-dumb','crafting'],{m:'Thin',f:'Thin'},{forced:[['Ascetic',0]]}),
 SpacePirate55:s('a',['Pirate'],{melee:4,shooting:4},[],['violent'],{m:'Hulk',f:'Female'}),
 PitBrawler76:s('a',['Pirate'],{melee:8},['intellectual','caring'],['violent'],{m:'Hulk',f:'Female'},{forced:[['Brawler',0]]}),
 IllegalShipwright76:s('a',['Pirate'],{construction:7},[],['manual-skilled'],{m:'Fat',f:'Fat'}),
 Gigolo30:s('a',['Offworld','Pirate'],{social:8,melee:3},['manual-dumb','manual-skilled'],['social'],{m:'Hulk',f:'Thin'},{forced:[['Beauty',2]]}),
 SpaceMarine16:s('a',['Offworld','Pirate','Researcher'],{melee:5,shooting:7},[],['violent'],{m:'Hulk',f:'Thin'}),
 Assassin20:s('a',['Offworld','Pirate','Cult'],{melee:10,shooting:10},['intellectual','manual-dumb','manual-skilled','social','caring'],['violent'],{m:'Hulk',f:'Thin'},{forced:[['Psychopath',0]]}),
 Newborn79:s('c',['Newborn'],{},[],[],{},{requiresCategory:true}),
 Child27:s('c',['Child'],{},[],[],{},{requiresCategory:true}),
 ChildTribal:s('c',['ChildTribal'],{},[],[],{},{requiresCategory:true}),
 ColonyChild59:s('c',['AdultColonist'],{},[],[],{},{requiresCategory:true}),
 TribeChild19:s('c',['AdultTribal'],{},[],[],{},{requiresCategory:true}),
 VatgrownChild11:s('c',['VatGrown'],{},[],[],{},{requiresCategory:true}),
 Colonist97:s('a',['AdultColonist'],{},[],[],{m:'Male',f:'Female'},{requiresCategory:true}),
 TribeMember57:s('a',['AdultTribal'],{},[],[],{m:'Male',f:'Female'},{requiresCategory:true}),
 Hunter74:s('a',['Tribal','TribalHunter'],{shooting:4,melee:3,animals:2},[],['violent','animals'],{m:'Male',f:'Female'}),
 Logger16:s('a',['Tribal','TribalLogger'],{plants:6,melee:3},[],['plant-work'],{m:'Hulk',f:'Hulk'},{possessions:[['WoodLog',10]]}),
 Gatherer70:s('a',['Tribal','TribalFarmer'],{plants:8,animals:-2},[],['plant-work'],{m:'Male',f:'Female'}),
 Digger66:s('a',['Tribal','TribalMiner'],{mining:6,construction:2},[],['mining'],{m:'Hulk',f:'Hulk'},{forced:[['Undergrounder',0]],possessions:[['Jade',3]]}),
 Weaver63:s('a',['Tribal'],{crafting:6,plants:2},[],['crafting'],{m:'Male',f:'Female'},{possessions:[['Cloth',10]]}),
 Framer37:s('a',['Tribal'],{construction:6,plants:2},[],['manual-skilled'],{m:'Male',f:'Female'}),
 StewKeeper95:s('a',['Tribal'],{cooking:6,plants:2},[],['cooking'],{m:'Male',f:'Female'}),
 Tamer79:s('a',['Tribal'],{animals:6,social:2},[],['animals'],{m:'Male',f:'Female'}),
 Carver1:s('a',['Tribal'],{artistic:7},[],['artistic'],{m:'Male',f:'Female'},{possessions:[['WoodLog',1]]}),
 Healer46:s('a',['Tribal','TribalFarmer'],{medicine:5,plants:3},[],['caring'],{m:'Male',f:'Female'},{possessions:[['MedicineHerbal',5]]}),
 HearthTender66:s('a',['Tribal'],{cooking:4,medicine:3,crafting:2},[],[],{m:'Male',f:'Female'},{forced:[['Undergrounder',0]]}),
 Warrior94:s('a',['Tribal','TribalHunter'],{melee:4,shooting:4},[],['violent'],{m:'Male',f:'Female'},{possessions:[['Pila',1]]}),
 Archer25:s('a',['Tribal','TribalHunter'],{melee:2,shooting:7},[],['violent'],{m:'Thin',f:'Thin'},{possessions:[['Bow_Short',1]]}),
 Brave88:s('a',['Tribal'],{melee:7,shooting:2},[],['violent'],{m:'Hulk',f:'Hulk'}),
 Scout59:s('a',['Tribal','TribalHunter'],{shooting:2,intellectual:2,social:2},[],['violent'],{m:'Male',f:'Female'},{forced:[['SpeedOffset',2]]}),
 VengefulHunter32:s('a',['Tribal','TribalHunter','Cult'],{shooting:4,melee:6},['animals'],['violent'],{m:'Hulk',f:'Hulk'},{possessions:[['MeleeWeapon_Spear',1]]}),
 MuffaloShaman95:s('a',['Tribal','Cult'],{melee:5,social:2},[],[],{m:'Hulk',f:'Hulk'}),
 LoreKeeper51:s('a',['Tribal','Cult'],{intellectual:2,social:3,artistic:2},[],['intellectual'],{m:'Male',f:'Female'}),
 Loner61:s('a',['Tribal','TribalFarmer','TribalHunter','Cult'],{shooting:3,melee:2,plants:5,construction:1},['social'],[],{m:'Thin',f:'Thin'}),
 Banished68:s('a',['Tribal','TribalHunter','Cult'],{melee:3,shooting:2,plants:4},['social'],[],{m:'Thin',f:'Thin'}),
 Malingerer28:s('a',['Tribal','Cult'],{intellectual:2,social:5},['manual-dumb'],[],{m:'Male',f:'Female'}),
 Excavator55:s('a',['Tribal','TribalMiner','Cult'],{mining:8},[],['mining'],{m:'Male',f:'Female'}),
 Digger31:s('a',['Tribal','TribalMiner'],{mining:8},[],['mining'],{m:'Hulk',f:'Hulk'}),
 CaveBuilder81:s('a',['Tribal','TribalMiner'],{mining:8,construction:2},[],['mining','constructing'],{m:'Male',f:'Female'}),
 TreehouseBuilder86:s('a',['Tribal','TribalLogger'],{plants:6,melee:3},[],['plant-work'],{m:'Hulk',f:'Hulk'}),
 PlankCutter72:s('a',['Tribal','TribalLogger'],{plants:6,melee:3},[],['plant-work'],{m:'Hulk',f:'Hulk'}),
 Herder33:s('a',['Tribal','TribalHunter'],{shooting:3,animals:5},[],['violent','animals'],{m:'Thin',f:'Thin'}),
 Butcher40:s('a',['Tribal','TribalHunter'],{cooking:6,animals:3},[],['violent','animals'],{m:'Male',f:'Female'},{possessions:[['Meat_Bison',5]]}),
 TribeChild40:s('c',['Tribal'],{plants:2,melee:2,shooting:2,intellectual:-3},[],[],{}),
 AbandonedChild23:s('c',['Tribal','Cult'],{melee:3,crafting:3,social:-2},[],[],{m:'Male',f:'Female'}),
 ReclusiveChild81:s('c',['Tribal','Cult'],{melee:4,crafting:3},['social'],[],{}),
 Herder19:s('c',['Tribal'],{animals:3,melee:3,social:-2},[],[],{}),
 Scavenger22:s('c',['Tribal'],{mining:3,intellectual:3},['manual-dumb'],[],{}),
 CaveChild30:s('c',['Tribal'],{mining:3,construction:3},[],[],{},{forced:[['Undergrounder',0]]}),
 SoleSurvivor21:s('c',['Tribal','TribalFarmer','Cult'],{plants:3,cooking:3},['violent'],[],{}),
 VengefulChild43:s('c',['Tribal','Cult'],{melee:3,shooting:3},['caring'],[],{}),
 FireKeeper44:s('c',['Tribal'],{crafting:2,cooking:2},[],[],{}),
 Hideaway7:s('c',['Tribal'],{intellectual:3,crafting:3,social:-2},[],[],{},{possessions:[['Novel',1]]}),
 CrashBaby32:s('c',['Tribal'],{social:3,intellectual:2},[],[],{}),
 BuddingArtist44:s('c',['Tribal'],{artistic:5},[],[],{}),
 Bully70:s('c',['Tribal'],{melee:2,shooting:3},['caring'],[],{}),
 Bookworm19:s('c',['Tribal'],{intellectual:6,artistic:2,social:-3},['manual-dumb'],[],{},{possessions:[['Novel',1]]}),
};
export type CoreBackstoryId370=keyof typeof RAW;
/** The catalogue, in Core's definition order. */
export const CORE_BACKSTORY_LIST_370:readonly CoreBackstory370[]=Object.freeze((Object.keys(RAW) as CoreBackstoryId370[]).map(id=>{
  const text=CORE_BACKSTORY_TEXTS_370[id];if(!text)throw Error(`Missing text for backstory ${id}`);
  const [label,labelShort,description,labelFemale,labelShortFemale]=text;
  return Object.freeze({...RAW[id],id,label,labelShort,description,...labelFemale?{labelFemale}:{},...labelShortFemale?{labelShortFemale}:{}});
}));
export const CORE_BACKSTORIES_370:Readonly<Record<CoreBackstoryId370,CoreBackstory370>>=Object.freeze(Object.fromEntries(CORE_BACKSTORY_LIST_370.map(story=>[story.id,story]))) as Readonly<Record<CoreBackstoryId370,CoreBackstory370>>;
export const isCoreBackstoryId370=(id:unknown):id is CoreBackstoryId370=>typeof id==='string'&&Object.hasOwn(CORE_BACKSTORIES_370,id);
/** Core TitleFor / TitleShortFor: the female title when one exists. */
export const coreBackstoryTitle370=(story:CoreBackstory370,sex?:'male'|'female'):string=>sex==='female'&&story.labelFemale?story.labelFemale:story.label;
export const coreBackstoryShortTitle370=(story:CoreBackstory370,sex?:'male'|'female'):string=>sex==='female'&&story.labelShortFemale?story.labelShortFemale:story.labelShort||coreBackstoryTitle370(story,sex);
/** Core BackstoryDef.BodyTypeFor: the global body, else the sexed one. */
export const coreBackstoryBody370=(story:CoreBackstory370,sex:'male'|'female'):BodyTypeId|undefined=>story.body.g??(sex==='female'?story.body.f:story.body.m);

/** Core WorkTypes.xml workTags of each delivered work type, in Core order.
 * Elsewhere's historical table (colonist-backgrounds.ts) is a subset of each
 * list; the other Core tags can only be disabled by a Core backstory. */
export const CORE_WORK_TYPE_TAGS_370:Readonly<Record<WorkType,readonly BackgroundWorkTag[]>>=Object.freeze({
  firefight:['firefighting','commoner','all-work'],patient:[],doctor:['caring','commoner','all-work'],bedrest:[],basic:['commoner','all-work'],
  warden:['social','all-work'],handle:['animals','commoner','all-work'],cook:['cooking','manual-skilled','commoner','all-work'],
  hunt:['violent','hunting','commoner','shooting','all-work'],build:['manual-skilled','commoner','constructing','all-work'],
  grow:['manual-skilled','plant-work','commoner','all-work'],mine:['manual-skilled','mining','commoner','all-work'],
  gather:['manual-skilled','plant-work','commoner','all-work'],smith:['crafting','manual-skilled','commoner','all-work'],
  tailor:['crafting','manual-skilled','commoner','all-work'],art:['artistic','commoner','all-work'],
  craft:['crafting','manual-skilled','commoner','all-work'],haul:['manual-dumb','hauling','commoner','all-work'],
  clean:['manual-dumb','cleaning','commoner','all-work'],research:['intellectual','commoner','all-work'],
});
/** Core SkillDef.IsDisabled read through the work types whose relevant skill
 * it is: these Core tags complete Elsewhere's historical skill table. */
export const CORE_SKILL_EXTRA_TAGS_370:Readonly<Partial<Record<BackgroundSkillId,readonly BackgroundWorkTag[]>>>=Object.freeze({
  construction:['constructing'],mining:['mining'],cooking:['cooking'],crafting:['crafting'],
});
