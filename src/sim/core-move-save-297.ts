import {isCorePhysicalSchema297} from './physical-schema-297.ts';
const TOKENS297=['coreMove297','coreMoveWalk297'] as const;
const HISTORICAL_TOKENS297=[...TOKENS297,'phaseCore297','corePathBudget297','heldAtCore297','physicalClockCore297','heldGoodsCore297','deathAtCore297','removedAtCore297','stop297'] as const;
/** Metadata shape only, no authority/owner/carry permission is granted here. */
export function validCapturedCoreMove297(value:unknown,version:number,allowHuman=true):boolean {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(!Number.isSafeInteger(version)||version<1||version>300)return false;
 const core='coreMove297' in value,walk='coreMoveWalk297' in value;
 if(!core&&!walk)return true;
 if(!isCorePhysicalSchema297(version)||!allowHuman||!core)return false;
 for(const key of TOKENS297)if(key in value){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||d.enumerable!==true||!Object.hasOwn(d,'value')||d.value!==true)return false;}
 return true;
}
/** Historical absence fence. Only owner/transport lanes, never unknown payloads.
 * The current schema is checked locally by the ordinary human/animal/mech guards.
 * No walker cost on the current297 hot path; no gameplay result is memoized. */
export function validCoreMoveHistoricalTransport297(raw:unknown,version:number):boolean {
 try {
  if(!Number.isSafeInteger(version)||version<1||version>300)return false;
  if(isCorePhysicalSchema297(version))return true;
  const lanes=["world","summary","dynamic","campaign","worldMaps","worldGroups","worldPawns","worldFactions","campaignMap","secondarySite","map","maps","sites","entries","groups","group","state","groupLosses","pending261","battlefield261","retained","people","pawns","resources","wildlife","animals","piles","items","packed","building","structures","jobs","deconstruction","wallDoor296","plan","body","cryptosleep","shipCryptosleep277","occupant","human","pawn","animal","actor","contents","lost","abandoned","abandonedContents","abandonedPawns","humans","pods","animalLosses","losses","members","owners","heldCaskets259","heldPlayerCaskets271","heldShipCaskets277","casket","upserted","orbital","ships","deliveries","cargo","pending","departures","commercialTrip","civilianPost","visitors","raids","trade","prisonDepartures","arrivals","startingArrival","podRescues","scout","quests","worldSites263","tradeRequests284","requests","rewards","options","stockpiles","filters","shelf","settings","policy","privatePolicy","linkedStorage286","policies","recreation","task","bills","ledger","destroyed","stock","motion","segments","tracks","mechanoids"];
  const laneSet=new Set(lanes),order=new Map(lanes.map((key,index)=>[key,index])),active=new Set<object>();let budget=2_000_000;
  const inherited=Reflect.ownKeys(Object.prototype).filter((key):key is string=>typeof key==='string'&&laneSet.has(key));
  const data=(v:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(v,key);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
  const visit=(value:unknown):boolean=>{
   if(--budget<0)return false;if(value===null||typeof value!=='object')return true;
   if(Array.isArray(value)){
    if(active.has(value)||value.length>100000||Reflect.ownKeys(value).length!==value.length+1)return false;active.add(value);
    for(let i=0;i<value.length;i++){const d=data(value,String(i));if(!d||!visit(d.value))return false;}
   }else{
    const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return false;
    if(HISTORICAL_TOKENS297.some(key=>key in value))return false;
    if(proto===Object.prototype&&inherited.some(key=>!Object.hasOwn(value,key)))return false;
    const present=Object.getOwnPropertyNames(value).filter(key=>laneSet.has(key)).sort((a,b)=>order.get(a)!-order.get(b)!);
    if(!present.length)return true;if(active.has(value))return false;active.add(value);
    for(const key of present){const d=data(value,key);if(!d||!visit(d.value))return false;}
   }
   active.delete(value);return true;
  };
  return visit(raw);
 }catch{return false;}
}
