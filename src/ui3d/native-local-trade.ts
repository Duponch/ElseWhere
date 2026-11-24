import type { NativeControl, NativePage, NativeRow, NativeUiState } from './native-contract';
import type { Cell, Command, MaterialPile, Pawn, World } from '../sim/types';
import type { TradeLine } from '../sim/trade-state';
import { isColonist } from '../sim/affiliation';
import { registeredMapId } from '../sim/world-map-context';
import { visitorMayTrade, visitorMerchantLabel } from '../sim/visitors';
import { negotiatorRefusal, tradingAtContact } from '../sim/trade-contact';
import { tradeGoods, quoteTrade } from '../sim/trade-goods';
import { orbitalAtContact, orbitalTradeGoods, orbitalTradeReason, quoteOrbitalTrade } from '../sim/orbital-rules';
import { tradeImprovement } from '../sim/trade-negotiator';
import { tradePriceInspirationOffset360 } from '../sim/inspirations-360';
import { ITEM_DEFINITIONS } from '../sim/items';
import { weaponLabel,QUALITY_LABELS } from '../sim/equipment-rules';
import { apparelDefinition, apparelLabel } from '../sim/apparel-rules';
import { isSculptureMaterial, sculptureMaxHitPoints } from '../sim/furniture-stats';
import {NATIVE_MESSAGE,NATIVE_TRADE} from './native-dialog-metrics';

export interface NativeLocalTradeOptions {
  readState: () => NativeUiState;
  command: (command: Command) => Promise<unknown>;
  pause: () => Promise<unknown>;
  /** Main supplies its existing guarded deferred-resume callback. */
  resume: () => Promise<unknown>;
  show: (page: NativePage) => void;
  close: () => void;
  isCurrent: () => boolean;
  focusPawn: (id: number) => void;
  focusCell?: (cell: Cell) => void;
  /** Presentation: the trade window opens (Core Dialog_Trade CommsWindow_Open). */
  opened?: () => void;
}
interface Scope { epoch: number | undefined; seed: number; mapId: number | undefined }
interface Good {
  key: string; id: number; packed: boolean; side: 'buy' | 'sell'; available: number;
  unitPrice: number; label: string; icon?:string;detail?: string; refusal?: string;
}
type Quote = { ok: false; reason: string } | { ok: true; signature: string; net: number; paid: number; forgone: number };
interface Confirmation { lines: TradeLine[]; signature: string; net: number; paid: number; forgone: number; acceptShortfall: boolean;stamp:string|undefined }
const prefix = 'native-local-trade-';
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
const formatter=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});
const money = (amount: number) => formatter.format(amount);
const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
const sortLabels={catalogue:'Ordre du catalogue',name:'Nom',price:'Prix unitaire',stock:'Stock disponible'} as const;
const filterLabels={all:'Tous les biens',buy:'Achats',sell:'Ventes',negotiable:'Échanges possibles'} as const;
type TradeSort=keyof typeof sortLabels;
type TradeFilter=keyof typeof filterLabels;
function pileLabel(pile: MaterialPile): string {
  return pile.book ? `${pile.book.title} · ${QUALITY_LABELS[pile.book.quality]} · ${60-(pile.damage??0)}/60 PV` : pile.weapon ? weaponLabel(pile) : pile.apparel ? `${apparelLabel(pile)} · ${pile.apparel.hitPoints}/${apparelDefinition(pile).hitPoints} PV` : ITEM_DEFINITIONS[pile.item].label;
}

/** Local contact and orbital trading retain their original real owners,
 * contact checks, price quotes, delivery and finite stocks. No DOM controller
 * or hidden legacy field supplies a choice, quantity or command. */
export function createNativeLocalTrade(options: NativeLocalTradeOptions) {
  let mode: 'visitors' | 'orbital' = 'visitors', active = false, disposed = false, pending = false;
  let scope: Scope | undefined, generation = 0, pawnId: number | undefined, peerId: number | undefined, consoleId: number | undefined;
  let error = '', readyKey = '', acceptShortfall = false, confirmation: Confirmation | undefined;
  let search='',sort:TradeSort='catalogue',filter:TradeFilter='all',observedStamp:string|undefined;
  const quantities = new Map<string, number>();
  const ownsPage = (id: string | undefined) => !!id?.startsWith(prefix);
  function sameScope(state: NativeUiState): boolean {
    return !!scope && !!state.world && state.epoch === scope.epoch && state.world.seed === scope.seed && registeredMapId(state.world) === scope.mapId;
  }
  function current(): World {
    const state = options.readState();
    if (!sameScope(state)) throw Error('La carte ou la colonie a changé. Rouvrez le commerce.');
    return state.world!;
  }
  function resetBasket(): void { quantities.clear(); acceptShortfall = false; confirmation = undefined; }
  function selectedPawn(world: World): Pawn | undefined { return world.pawns.find(pawn => pawn.id === pawnId); }
  function peers(world: World) {
    return mode === 'visitors'
      ? world.pawns.filter(pawn => visitorMayTrade(world, pawn)).map(pawn => ({ id: pawn.id, label: visitorMerchantLabel(world, pawn) }))
      : (world.orbital?.ships ?? []).filter(ship => ship.announced && ship.departAt > world.tick).map(ship => ({ id: ship.id, label: `${ship.name} · ${ship.kind === 'bulk' ? 'Gros' : 'Exotique'} · départ dans ${ship.departAt - world.tick} pas` }));
  }
  function syncChoices(world: World): void {
    const people = world.pawns.filter(pawn => isColonist(pawn) && pawn.state !== 'dead'), choices = peers(world);
    const before = `${pawnId}:${peerId}:${consoleId}`;
    if (!people.some(pawn => pawn.id === pawnId)) pawnId = people.find(pawn => mode === 'visitors' ? pawn.trade : pawn.orbitalTrade)?.id ?? people[0]?.id;
    const pawn = selectedPawn(world);
    if (mode === 'visitors' && pawn?.trade) peerId = pawn.trade.traderId;
    else if (mode === 'orbital' && pawn?.orbitalTrade) { peerId = pawn.orbitalTrade.shipId; consoleId = pawn.orbitalTrade.consoleId; }
    else if (!choices.some(peer => peer.id === peerId)) peerId = choices[0]?.id;
    if (mode === 'orbital' && !world.structures.some(structure => structure.kind === 'comms-console' && structure.id === consoleId)) consoleId = world.structures.find(structure => structure.kind === 'comms-console')?.id;
    if (before !== `${pawnId}:${peerId}:${consoleId}`) { resetBasket(); readyKey = ''; }
  }
  function ready(world: World): boolean {
    const pawn = selectedPawn(world); if (!pawn) return false;
    if (mode === 'visitors') { const trader = world.pawns.find(pawn => pawn.id === peerId); return !!trader && tradingAtContact(world, pawn, trader); }
    const ship = world.orbital?.ships.find(ship => ship.id === peerId); return !!ship && orbitalAtContact(world, pawn, ship);
  }
  function taskStamp(world: World): string | undefined {
    const pawn = selectedPawn(world), task = mode === 'visitors' ? pawn?.trade : pawn?.orbitalTrade;
    if (!task) return;
    return mode === 'visitors' && pawn?.trade ? `${pawn.id}:${pawn.trade.traderId}:${pawn.trade.startedAt}`
      : pawn?.orbitalTrade ? `${pawn.id}:${pawn.orbitalTrade.shipId}:${pawn.orbitalTrade.consoleId}:${pawn.orbitalTrade.startedAt}` : undefined;
  }
  async function send(command: Command): Promise<void> {
    const result = await options.command(command);
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) throw Error('reason' in result ? String(result.reason) : 'La commande de commerce a été refusée.');
  }
  async function run(action: () => Promise<unknown>, token = generation): Promise<boolean> {
    if (disposed || !active || pending || !options.isCurrent() || token !== generation) return false;
    try { current(); } catch (cause) { error = message(cause); paint(); return false; }
    if (options.readState().busy || options.readState().fault) return false;
    pending = true; error = ''; paint();
    let success = false;
    try { await action(); success = true; } catch (cause) { if (token === generation) error = message(cause); }
    finally { if (token === generation) { pending = false; if (active && options.isCurrent()) { paint(); pauseAtContact(); } } }
    return success;
  }
  function button(id: string, label: string, action: () => unknown, disabled = false, selected = false, hint?: string): NativeControl {
    const token = generation,dialog=confirmation,choice=`${pawnId}:${peerId}:${consoleId}`,locked=disabled||pending||options.readState().busy||!!options.readState().fault;
    return { id: `${prefix}${id}`, label, active: selected, hint, disabled: locked,
      onActivate: () => {if(locked||confirmation!==dialog||choice!==`${pawnId}:${peerId}:${consoleId}`)return;return run(async () => {
        if(confirmation!==dialog||choice!==`${pawnId}:${peerId}:${consoleId}`)throw Error('Le contact commercial a changé.');await action();
      }, token);} };
  }
  function choices(id: string, label: string, value: number | undefined, entries: { id: number; label: string }[], change: (id: number) => void, locked: boolean): NativeRow {
    return { id: `${prefix}${id}`, label, value: entries.find(entry => entry.id === value)?.label ?? 'Aucun choix disponible', controls: entries.map(entry => button(`${id}-${entry.id}`, entry.label, () => { change(entry.id); resetBasket(); readyKey = ''; }, locked, entry.id === value)) };
  }
  function goods(world: World): { goods: Good[]; silver: number; merchantSilver: number } {
    const pawn = selectedPawn(world); if (!pawn || !ready(world)) return { goods: [], silver: 0, merchantSilver: 0 };
    const trader = world.pawns.find(person => person.id === peerId), ship = world.orbital?.ships.find(ship => ship.id === peerId);
    const localStock=mode === 'visitors' && trader ? tradeGoods(world,pawn,trader) : undefined;
    const stock = localStock ?? (mode === 'orbital' && ship ? orbitalTradeGoods(world, pawn, ship) : undefined);
    if (!stock) return { goods: [], silver: 0, merchantSilver: 0 };
    const result: Good[] = stock.goods.map(good => ({ key: `pile:${good.pile.id}`, id: good.pile.id, packed: false, side: good.side, available: good.available, unitPrice: good.unitPrice, refusal: good.refusal, label: pileLabel(good.pile),icon:`item-${good.pile.item}` }));
    for (const good of localStock?.artGoods??[]) {
      const building = good.packed.building, kind = building.kind;
      if (kind !== 'small-sculpture' && kind !== 'large-sculpture') continue;
      const max = isSculptureMaterial(building.material) ? sculptureMaxHitPoints(kind, building.material) : 0;
      result.push({ key: `packed:${building.id}`, id: building.id, packed: true, side: good.side, available: 1, unitPrice: good.unitPrice,icon:kind,
        label: `${kind === 'small-sculpture' ? 'Petite sculpture' : 'Grande sculpture'} · ${building.material ? ITEM_DEFINITIONS[building.material].label : 'Matière inconnue'} · ${building.quality ?? 'normal'}`,
        detail: `${max - (building.damage ?? 0)}/${max} PV · Auteur ${world.pawns.find(pawn => pawn.id === building.art?.authorId)?.name ?? `#${building.art?.authorId ?? '?'}`} · Objet ${building.id}` });
    }
    return { goods: result, silver: stock.silver.reduce((sum, pile) => sum + pile.quantity, 0), merchantSilver: stock.merchantSilver.reduce((sum, pile) => sum + pile.quantity, 0) };
  }
  function lines(): TradeLine[] {
    return [...quantities].filter(([, quantity]) => quantity !== 0).map(([key, quantity]) => key.startsWith('packed:') ? { packedId: Number(key.slice(7)), quantity } : { pileId: Number(key.slice(5)), quantity });
  }
  function quote(world: World, basket: TradeLine[]): Quote {
    if (pawnId === undefined || peerId === undefined) return { ok: false, reason: 'Choisissez un négociateur et un partenaire commercial.' };
    return mode === 'visitors' ? quoteTrade(world, pawnId, peerId, basket) : quoteOrbitalTrade(world, pawnId, peerId, basket);
  }
  async function editQuantity(key: string, text: string, token: number,stamp:string|undefined): Promise<boolean> {
    if(confirmation)return false;
    return run(async () => {
      const world=current();if(stamp!==taskStamp(world)||confirmation)throw Error('Le contact commercial a changé.');
      const good = goods(world).goods.find(good => good.key === key), value = Number(text);
      if (!good || good.refusal) throw Error(good?.refusal ?? 'Ce bien n’est plus disponible au contact.');
      if (!text.trim() || !Number.isSafeInteger(value) || value < 0 || value > good.available || value > 250000) throw Error(`Choisissez un entier de 0 à ${Math.min(good.available, 250000)}.`);
      if (value) quantities.set(key, good.side === 'buy' ? value : -value); else quantities.delete(key);
      acceptShortfall = false; confirmation = undefined;
    }, token);
  }
  function goodRow(good: Good,index:number,stamp:string|undefined): NativeRow {
    const quantity=quantities.get(good.key)??0,count = Math.abs(quantity), token = generation;
    const value=`${good.side === 'buy' ? 'Acheter' : 'Vendre'} · stock ${good.available} · ${money(good.unitPrice)} argent/unité`;
    return { id: `${prefix}good-${good.key}`, label: good.label, value,region:'catalogue',
      tradeEntry:{side:good.side,available:good.available,unitPrice:good.unitPrice,quantity,refused:!!good.refusal,index,icon:good.icon},
      hint:[good.label,value,good.packed?`Objet n° ${good.id}`:`Lot n° ${good.id}`,good.detail,good.refusal].filter(Boolean).join('\n'),
      detail: [good.detail, good.refusal].filter(Boolean).join(' · ') || undefined,
      ...!good.refusal ? { input: { value: String(count), kind: 'number' as const, onCommit: (value: string) => editQuantity(good.key, value, token,stamp) } } : {},
      controls: [button(`good-${good.key}-less`, '−', () => editQuantityNow(good.key, -1,stamp), !!good.refusal || count <= 0), button(`good-${good.key}-more`, '+', () => editQuantityNow(good.key, 1,stamp), !!good.refusal || count >= Math.min(good.available, 250000))] };
  }
  function editQuantityNow(key: string, delta: number,stamp:string|undefined): void {
    const world=current();if(stamp!==taskStamp(world)||confirmation)throw Error('Le contact commercial a changé.');
    const good = goods(world).goods.find(good => good.key === key), value = Math.abs(quantities.get(key) ?? 0) + delta;
    if (!good || good.refusal || value < 0 || value > Math.min(good.available, 250000)) throw Error(good?.refusal ?? 'Le stock disponible a changé.');
    if (value) quantities.set(key, good.side === 'buy' ? value : -value); else quantities.delete(key);
    acceptShortfall = false; confirmation = undefined;
  }
  function visibleGoods(stock:readonly Good[]):Good[]{
    const needle=fold(search.trim()),visible=stock.filter(good=>(filter==='all'||filter==='negotiable'&&!good.refusal||filter===good.side)&&(!needle||fold([good.label,good.detail,good.refusal].filter(Boolean).join(' ')).includes(needle)));
    if(sort==='name')visible.sort((a,b)=>a.label.localeCompare(b.label,'fr')||a.key.localeCompare(b.key));
    else if(sort==='price')visible.sort((a,b)=>a.unitPrice-b.unitPrice||a.key.localeCompare(b.key));
    else if(sort==='stock')visible.sort((a,b)=>b.available-a.available||a.key.localeCompare(b.key));
    return visible;
  }
  function viewChange(token:number,stamp:string|undefined,write:()=>void):void{
    if(!active||disposed||pending||confirmation||token!==generation||!options.isCurrent()||!sameScope(options.readState()))return;
    const world=current();if(!ready(world)||taskStamp(world)!==stamp)return;write();paint();
  }
  function searchRow(stamp:string|undefined):NativeRow{
    const token=generation,control=<T extends string>(id:string,value:T,labels:Record<T,string>,write:(value:T)=>void):NativeControl=>({
      ...button(id,labels[value],()=>{}),select:{value,options:Object.entries<string>(labels).map(([value,label])=>({value,label})),onChange:value=>{
        if(!Object.hasOwn(labels,value))return;viewChange(token,stamp,()=>write(value as T));
      }}
    });
    return {id:`${prefix}search`,label:'Rechercher',region:'navigation',hint:'Filtrer ou trier la liste sans modifier le panier.',input:{value:search,placeholder:'Rechercher une marchandise',maxLength:160,onCommit:value=>viewChange(token,stamp,()=>{search=value;})},controls:[control('filter',filter,filterLabels,value=>{filter=value;}),control('sort',sort,sortLabels,value=>{sort=value;})]};
  }
  function status(world: World): string {
    const pawn = selectedPawn(world);
    if (mode === 'visitors') {
      if (!world.visitors) return 'Cette partie conserve son calendrier historique. Vous pouvez autoriser les prochaines visites.';
      if (!world.pawns.some(person => person.id === peerId && visitorMayTrade(world, person))) return 'Aucun marchand disponible. Les visiteurs ne commercent pas tous.';
      if (!pawn) return 'Aucun négociateur disponible.';
      if (pawn.trade?.traderId === peerId) return ready(world) ? `Au contact · avantage du négociateur ${(tradeImprovement(pawn, tradePriceInspirationOffset360(pawn)) * 100).toFixed(1)} %` : 'Le négociateur rejoint le marchand.';
      return negotiatorRefusal(pawn, world.schemaVersion) ?? 'Rejoindre reprend le temps si nécessaire. La partie se met en pause au contact.';
    }
    if (!world.orbital) return 'Le calendrier orbital sera adopté par les événements futurs.';
    const ship = world.orbital.ships.find(ship => ship.id === peerId && ship.announced && ship.departAt > world.tick), console = world.structures.find(structure => structure.id === consoleId);
    if (!ship) return 'Aucun vaisseau détecté. Alimenter une console permet de découvrir les vaisseaux encore en orbite.';
    if (!console) return 'Construisez une console de communication et une balise, puis alimentez-les.';
    if (!pawn) return 'Aucun négociateur disponible.';
    return ready(world) ? `Au contact · avantage du négociateur ${(tradeImprovement(pawn, tradePriceInspirationOffset360(pawn)) * 100).toFixed(1)} %` : pawn.orbitalTrade?.shipId === peerId ? 'Le négociateur rejoint la console.' : orbitalTradeReason(world, pawn, ship, console) ?? 'Rejoindre reprend le temps. La partie se met en pause au contact.';
  }
  function contactReason(world: World): string | undefined {
    const pawn = selectedPawn(world); if (!pawn) return 'Choisissez un négociateur.';
    if (mode === 'visitors') return !world.pawns.some(person => person.id === peerId && visitorMayTrade(world, person)) ? 'Choisissez un marchand disponible.' : pawn.trade ? 'Un contact est déjà engagé.' : negotiatorRefusal(pawn, world.schemaVersion);
    const ship = world.orbital?.ships.find(ship => ship.id === peerId), console = world.structures.find(structure => structure.id === consoleId);
    return !ship ? 'Choisissez un vaisseau détecté.' : pawn.orbitalTrade ? 'Un appel est déjà engagé.' : orbitalTradeReason(world, pawn, ship, console);
  }
  async function approach(): Promise<void> {
    const world = current(), reason = contactReason(world); if (reason) throw Error(reason);
    if (mode === 'visitors') { options.focusPawn(peerId!); await send({ type: 'order-trade', pawnId: pawnId!, traderId: peerId! }); }
    else { const console = world.structures.find(structure => structure.id === consoleId)!; options.focusCell?.(console); await send({ type: 'order-orbital-trade', pawnId: pawnId!, shipId: peerId!, consoleId: consoleId! }); }
    await options.resume();
  }
  async function cancelTask(): Promise<void> {
    const world = current(), pawn = selectedPawn(world), stamp = taskStamp(world);
    if (!pawn || !stamp) return;
    await send(mode === 'visitors' ? { type: 'cancel-trade', pawnId: pawn.id } : { type: 'cancel-orbital-trade', pawnId: pawn.id });
    resetBasket(); readyKey = '';
    if (mode === 'orbital') await options.resume();
  }
  async function finishClose(): Promise<void> {
    const token = generation, wasCurrent = options.isCurrent();
    if (!active || pending) return;
    if (wasCurrent && sameScope(options.readState())) {
      const succeeded = await run(cancelTask, token); if (!succeeded) return;
    }
    if (token !== generation) return;
    active = false; resetBasket();
    if (wasCurrent && options.isCurrent()) options.close();
  }
  function confirmQuote(): void {
    const world=current(),basket = lines(), checked = quote(world, basket);
    if (!checked.ok) throw Error(checked.reason);
    if (checked.forgone && !acceptShortfall) throw Error('Le partenaire manque d’argent. Acceptez explicitement la perte indiquée ou réduisez les ventes.');
    confirmation = { lines: structuredClone(basket), signature: checked.signature, net: checked.net, paid: checked.paid, forgone: checked.forgone, acceptShortfall,stamp:taskStamp(world) };
  }
  async function execute(captured:Confirmation): Promise<void> {
    if (confirmation!==captured) throw Error('Vérifiez à nouveau le panier.');
    const world=current();if(taskStamp(world)!==captured.stamp)throw Error('Le contact commercial a changé. Revenez au panier.');
    const checked = quote(world, captured.lines);
    if (!checked.ok || checked.signature !== captured.signature) throw Error(checked.ok ? 'Le panier, ses prix ou ses propriétaires ont changé. Revenez au panier et vérifiez les nouvelles valeurs.' : checked.reason);
    if (checked.forgone && !captured.acceptShortfall) throw Error('La perte d’argent exige une acceptation explicite.');
    const command: Command = mode === 'visitors'
      ? { type: 'trade-execute', pawnId: pawnId!, traderId: peerId!, lines: captured.lines, quote: captured.signature, acceptShortfall: captured.acceptShortfall }
      : { type: 'orbital-trade-execute', pawnId: pawnId!, shipId: peerId!, lines: captured.lines, quote: captured.signature, acceptShortfall: captured.acceptShortfall };
    const token = generation;
    await send(command);
    if (token !== generation || !sameScope(options.readState())) return;
    resetBasket(); active = false;
    if (options.isCurrent()) options.close();
    if (mode === 'orbital') await options.resume();
  }
  function paint(): void {
    if (!active || disposed || !options.isCurrent()) return;
    let world: World;
    try { world = current(); } catch (cause) {
      options.show({ id: `${prefix}stale`, title: 'Commerce interrompu', modal: true, rows: [{ id: 'stale', label: message(cause) }], actions: [{ id: `${prefix}stale-close`, label: 'Fermer', onActivate: () => { active = false; options.close(); } }], onClose: () => { active = false; options.close(); },closeOwnsNavigation:true }); return;
    }
    syncChoices(world);
    const pawn = selectedPawn(world), locked = !!(mode === 'visitors' ? pawn?.trade : pawn?.orbitalTrade), atContact = ready(world),stamp=taskStamp(world),token=generation;
    if(stamp!==observedStamp){observedStamp=stamp;resetBasket();}
    const partnerKind=mode==='visitors'?'Marchand':'Vaisseau',title=mode==='visitors'?'Visiteurs et commerce':'Commerce orbital';
    const rows: NativeRow[] = [];
    if (error) rows.push({ id: `${prefix}error`, label: error,region:atContact?'navigation':undefined });
    if (confirmation) {
      const q = confirmation;
      rows.push({ id: `${prefix}confirmed-total`, label: q.net >= 0 ? 'À payer' : 'À recevoir', value: `${money(q.net >= 0 ? q.net : -q.paid)} argent`, detail: q.forgone ? `${money(q.forgone)} argent abandonné explicitement.` : 'Le prix et les mêmes stocks seront vérifiés avant la commande.' });
      const stock = new Map(goods(world).goods.map(good=>[good.key,good]));
      for (const line of q.lines) { const key = 'packedId' in line && line.packedId !== undefined ? `packed:${line.packedId}` : `pile:${line.pileId}`; rows.push({ id: `${prefix}confirmed-${key}`, label: stock.get(key)?.label ?? `Objet ${key}`, value: `${line.quantity > 0 ? 'Acheter' : 'Vendre'} × ${Math.abs(line.quantity)}` }); }
      const checked = quote(world, q.lines), stale = !checked.ok || checked.signature !== q.signature||q.stamp!==stamp;
      if (stale) rows.push({ id: `${prefix}quote-changed`, label: checked.ok ? 'Le devis a changé.' : checked.reason, detail: 'Revenez au panier et vérifiez les nouvelles valeurs.' });
      options.show({ id: `${prefix}confirm`, title: 'Confirmer l’échange', modal: true, closable: !pending, layout:'message',width:NATIVE_MESSAGE.width,height:NATIVE_MESSAGE.height,rows,
        actions: [button('confirm-back', 'Revoir le panier', () => { confirmation = undefined; }), button('confirm-apply', 'Conclure l’échange', ()=>execute(q), stale)], onClose: () => { if (token===generation&&confirmation===q&&!pending) { confirmation = undefined; paint(); } },closeOwnsNavigation:true }); return;
    }
    const closePage=()=>{if(token===generation&&!confirmation)return finishClose();},close:NativeControl={id:`${prefix}close`,label:'Fermer',disabled:pending||options.readState().busy,onActivate:closePage};
    const contactActions=[...locked?[button('cancel-contact',mode==='visitors'?'Annuler le contact':'Annuler l’appel',cancelTask)]:[],...pawn?[button('focus-negotiator','Repérer le négociateur',()=>options.focusPawn(pawn.id))]:[]];
    if(!atContact){
      rows.push(choices('negotiator', 'Négociateur', pawnId, world.pawns.filter(pawn => isColonist(pawn) && pawn.state !== 'dead').map(pawn => ({ id: pawn.id, label: `${pawn.name} · Social ${pawn.skills.social?.level ?? 0}` })), id => { pawnId = id; }, locked));
      rows.push(choices('partner', partnerKind, peerId, peers(world), id => { peerId = id; }, locked));
      if (mode === 'orbital') rows.push(choices('console', 'Console de communication', consoleId, world.structures.filter(structure => structure.kind === 'comms-console').map(structure => ({ id: structure.id, label: `Console ${structure.id} · ${structure.x}, ${structure.z}` })), id => { consoleId = id; }, locked));
      const reason=contactReason(world);
      rows.push({id:`${prefix}contact`,label:'Contact réel',detail:status(world),controls:[
        ...mode==='visitors'&&!world.visitors?[button('enable-visitors','Autoriser les prochaines visites',()=>send({type:'enable-visitors'}))]:[button('approach',mode==='visitors'?'Rejoindre le marchand':'Rejoindre la console',approach,!!reason,false,reason)],...contactActions,
      ]});
      options.show({id:`${prefix}${mode}`,title,modal:true,closable:!pending,width:8.2,rows,actions:[close],onClose:()=>{void closePage();},closeOwnsNavigation:true});return;
    }
    if (atContact) {
      const stock = goods(world),visible=visibleGoods(stock.goods),partner=peers(world).find(entry=>entry.id===peerId)?.label??'Partenaire indisponible';
      const console=mode==='orbital'?world.structures.find(structure=>structure.id===consoleId):undefined;
      rows.push({id:`${prefix}negotiator`,label:`Négociateur : ${pawn?.name??'—'}`,value:`${partnerKind} : ${partner}`,region:'navigation',hint:[pawn?`Social ${pawn.skills.social?.level??0}`:'',status(world),console?`Console ${console.id} · ${console.x}, ${console.z}`:''].filter(Boolean).join('\n')});
      const stockRules=mode === 'visitors'
        ? 'Biens au foyer ou en réserve, accessibles et libres de réservation. Les achats sont déposés au contact, puis rangés par les colons. Les provisions personnelles sont exclues.'
        : 'Seuls les biens au sol couverts par une balise alimentée et libres de réservation sont vendables. Les achats et l’argent reçu arrivent en capsule, puis sont rangés. Ce canal échange des marchandises, sans animaux, équipement ou sculptures.';
      rows.push({id:`${prefix}funds`,label:'Argent disponible',value:`Colonie ${money(stock.silver)} · ${partnerKind} ${money(stock.merchantSilver)}`,region:'navigation',hint:stockRules,detail:mode==='visitors'?'Stocks libres de réservation · Dépôt au contact.':'Stocks sous balise alimentée · Livraison en capsules.'},
        searchRow(stamp),{id:`${prefix}contact`,label:'Contact réel',value:status(world),region:'navigation',controls:contactActions},
        {id:`${prefix}stock-heading`,label:'Marchandises',region:'toolbar',tradeHeading:true,hint:'Stock de la colonie et prix de vente à gauche ; prix d’achat et stock du partenaire à droite. Chaque ligne représente un lot réel.'});
      rows.push(...visible.map((good,index)=>goodRow(good,index,stamp)));
      if (!visible.length) rows.push({id:`${prefix}no-goods`,region:'catalogue',label:stock.goods.length?'Aucun bien ne correspond aux filtres.':'Aucun bien négociable disponible au contact.'});
      const basket = lines(), checked = quote(world, basket);
      const visibleKeys=new Set(visible.map(good=>good.key)),hidden=[...quantities].filter(([key,value])=>value!==0&&!visibleKeys.has(key)).length;
      rows.push({id:`${prefix}total`,label:'Panier',region:'details',value:checked.ok?`${checked.net>=0?'À payer':'À recevoir'} : ${money(checked.net>=0?checked.net:-checked.paid)} argent`:checked.reason,detail:`${basket.length} lot(s) dans le panier · ${visible.length} / ${stock.goods.length} affichés${hidden?` · ${hidden} lot(s) du panier masqués par les filtres`:''}.`});
      if (checked.ok && checked.forgone) rows.push({ id: `${prefix}shortfall`, label: `${money(checked.forgone)} argent sans contrepartie`,region:'details', value: acceptShortfall ? 'Perte acceptée explicitement' : 'Acceptation requise', controls: [button('accept-shortfall', acceptShortfall ? 'Refuser cette perte' : 'Accepter cette perte', () => { acceptShortfall = !acceptShortfall; }, false, acceptShortfall)] });
      options.show({id:`${prefix}${mode}`,title,modal:true,closable:!pending,width:NATIVE_TRADE.width,layout:'trade',contentKey:`${search}:${sort}:${filter}`,rows,
        actions:[button('clear-basket','Vider le panier',resetBasket,!basket.length),button('check-quote','Vérifier le panier',confirmQuote,!checked.ok||!!checked.forgone&&!acceptShortfall,false,checked.ok?'Vérifie tous les lots, même masqués par un filtre. Une confirmation distincte reste nécessaire.':checked.reason),close],onClose:()=>{void closePage();},closeOwnsNavigation:true});
    }
  }
  function pauseAtContact(): void {
    if (!active || pending || disposed || !options.isCurrent() || !sameScope(options.readState())) return;
    const world = current(), stamp = taskStamp(world);
    if (!stamp || !ready(world) || readyKey === stamp) return;
    readyKey = stamp; void run(options.pause);
  }
  async function open(next: 'visitors' | 'orbital', preferredConsole?: number): Promise<void> {
    if (disposed || pending) return;
    if (active && options.isCurrent()) { await finishClose(); if (active) return; }
    const state = options.readState(), world = state.world;
    if (!world) throw Error('Affichez une carte locale pour commercer avec ses habitants.');
    if (state.busy || state.fault) throw Error(state.fault ?? 'Une opération est encore en cours.');
    mode = next; active = true; generation++; scope = { epoch: state.epoch, seed: world.seed, mapId: registeredMapId(world) };
    pawnId = peerId = undefined; consoleId = preferredConsole; readyKey = ''; error = ''; search='';sort='catalogue';filter='all';observedStamp=undefined;resetBasket(); syncChoices(world);
    options.opened?.();
    // Establish the owned page before normal guarded renders may inspect it.
    options.show({ id: `${prefix}${mode}`, title: mode === 'visitors' ? 'Visiteurs et commerce' : 'Commerce orbital', modal: true, rows: [] });
    paint(); pauseAtContact();
  }
  return {
    openVisitors: () => open('visitors'), openOrbital: (consoleId?: number) => open('orbital', consoleId), ownsPage,
    update(): void { if (!active || disposed || !options.isCurrent()) return; paint(); pauseAtContact(); },
    dispose(): void { disposed = true; active = false; generation++; resetBasket(); },
  };
}
