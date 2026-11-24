import { describe, expect, it, vi } from 'vitest';
import { applyCommand, stepWorld } from '../src/sim/index';
import { addMaterial } from '../src/sim/materials';
import { createDeteriorationState } from '../src/sim/deterioration-content';
import { tradeGoods } from '../src/sim/trade-goods';
import { tradingAtContact } from '../src/sim/trade-contact';
import { orbitalAtContact, orbitalTradeGoods } from '../src/sim/orbital-rules';
import type { Command, World } from '../src/sim/types';
import type { NativePage, NativeUiState } from '../src/ui3d/native-contract';
import { createNativeLocalTrade } from '../src/ui3d/native-local-trade';
import { visitorTradeFixture } from './scenarios/visitors';
import { orbitalCamp } from './helpers/orbital-v281';

async function settled(): Promise<void> { for (let index = 0; index < 8; index++) await Promise.resolve(); }
function model(world: World) {
  let page: NativePage | undefined;
  const state: NativeUiState = { world, epoch: 1, panel: null, category: 'orders', tool: 'select', orientation: 0,
    selectedPawnIds: [], selectedObjects: [], constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } },
    speed: 1, hasGame: true, busy: false, saves: [] };
  const options = { readState: () => state, command: vi.fn(async (command: Command) => applyCommand(state.world!, command)),
    pause: vi.fn(async () => { state.speed = 0; }), resume: vi.fn(async () => { state.speed = 1; }),
    show: (next: NativePage) => { page = next; }, close: vi.fn(() => { page = undefined; }),
    isCurrent: (): boolean => manager.ownsPage(page?.id), focusPawn: vi.fn(), focusCell: vi.fn() };
  const manager = createNativeLocalTrade(options);
  const click = async (id: string) => {
    const control = [...page!.rows.flatMap(row => row.controls ?? []), ...page!.actions ?? []].find(control => control.id === `native-local-trade-${id}`)!;
    expect(control, id).toBeDefined(); expect(control.disabled, id).not.toBe(true);
    await control.onActivate(); await settled();
  };
  const quantity = async (id: number, value: number) => { await page!.rows.find(row => row.id === `native-local-trade-good-pile:${id}`)!.input!.onCommit(String(value)); await settled(); };
  return { manager, options, state, click, quantity, get page() { return page; } };
}
async function visitors() {
  const f = visitorTradeFixture(), world = f.world;
  // The historical producer fixture prepares its arrival tick directly. Start
  // the current prospective calendar at that declared boundary, as medicalCamp
  // does, before the real contact walk; no skipped interval is simulated.
  world.deterioration = createDeteriorationState(world.seed, world.tick);
  expect(applyCommand(world, { type: 'area', action: 'home', from: { x: 0, z: 0 }, to: { x: 31, z: 31 } }).ok).toBe(true);
  addMaterial(world, 'silver', 500, { type: 'ground', x: 2, z: 3 }, 'silver');
  const ui = model(world), pawn = world.pawns.find(pawn => pawn.id === f.pawnId)!, trader = world.pawns.find(pawn => pawn.id === f.traderId)!;
  await ui.manager.openVisitors(); await ui.click('approach');
  for (let index = 0; index < 1200 && !tradingAtContact(world, pawn, trader); index++) stepWorld(world);
  expect(tradingAtContact(world, pawn, trader)).toBe(true);
  ui.manager.update(); await settled();
  expect(ui.options.pause).toHaveBeenCalledTimes(1);
  return { ...f, ui, pawn, trader };
}

describe('native local trade keeps contact, finite ownership and quote consent', () => {
  it('reaches the real visitor and buys through the existing signed command', async () => {
    const { world, ui, pawn, trader } = await visitors();
    const good = tradeGoods(world, pawn, trader).goods.find(good => good.side === 'buy' && good.pile.item === 'medicine')!;
    const before = world.piles.reduce((sum, pile) => sum + (pile.item === 'medicine' ? pile.quantity : 0), 0);
    await ui.quantity(good.pile.id, 1); await ui.click('check-quote');
    expect(ui.page!.id).toBe('native-local-trade-confirm');
    expect([ui.page!.layout,ui.page!.width,ui.page!.height]).toEqual(['message',640,460]);
    expect(ui.options.command.mock.calls.filter(([command]) => command.type === 'trade-execute')).toHaveLength(0);
    await ui.click('confirm-apply');
    expect(world.trade!.count).toBe(1);
    expect(world.piles.reduce((sum, pile) => sum + (pile.item === 'medicine' ? pile.quantity : 0), 0)).toBe(before);
    expect(world.piles.some(pile => pile.item === 'medicine' && pile.owner.type === 'ground')).toBe(true);
    expect(ui.options.close).toHaveBeenCalledTimes(1); ui.manager.dispose();
  });

  it('refuses a captured confirmation when the quoted stock changes', async () => {
    const { world, ui, pawn, trader } = await visitors();
    const good = tradeGoods(world, pawn, trader).goods.find(good => good.side === 'buy' && good.pile.item === 'medicine')!;
    await ui.quantity(good.pile.id, 1); await ui.click('check-quote');
    const apply = ui.page!.actions!.find(control => control.id === 'native-local-trade-confirm-apply')!;
    world.piles.find(pile => pile.id === good.pile.id)!.quantity--;
    await apply.onActivate(); await settled();
    expect(ui.options.command.mock.calls.filter(([command]) => command.type === 'trade-execute')).toHaveLength(0);
    expect(ui.page!.rows.some(row => /changé|stock/.test(row.label))).toBe(true); ui.manager.dispose();
  });

  it('requires explicit acceptance of a visitor cash shortfall', async () => {
    const { world, ui, pawn, trader } = await visitors();
    world.piles = world.piles.filter(pile => !(pile.item === 'silver' && pile.owner.type === 'inventory' && pile.owner.pawnId === trader.id));
    // The generated standard visitor handles cloth, whereas wood is correctly
    // displayed as refused by its real catalogue profile.
    addMaterial(world, 'textile', 10, { type: 'ground', x: 3, z: 3 }, 'cloth'); ui.manager.update(); await settled();
    const good = tradeGoods(world, pawn, trader).goods.find(good => good.side === 'sell' && good.pile.item === 'cloth' && !good.refusal)!;
    expect(good).toBeDefined();
    await ui.quantity(good.pile.id, 1);
    expect(ui.page!.actions!.find(control=>control.id==='native-local-trade-check-quote')!.disabled).toBe(true);
    await ui.click('accept-shortfall'); await ui.click('check-quote'); await ui.click('confirm-apply');
    const command = ui.options.command.mock.calls.map(([command]) => command).find(command => command.type === 'trade-execute');
    expect(command).toMatchObject({ acceptShortfall: true }); expect(world.trade!.forgone).toBeGreaterThan(0); ui.manager.dispose();
  });

  it('reaches the powered orbital console and preserves capsule delivery ownership', async () => {
    const f = orbitalCamp(), ui = model(f.world), pawn = f.world.pawns.find(pawn => pawn.id === f.negotiatorId)!, ship = f.world.orbital!.ships.find(ship => ship.id === f.shipId)!;
    await ui.manager.openOrbital(f.consoleId); await ui.click('approach');
    for (let index = 0; index < 300 && !orbitalAtContact(f.world, pawn, ship); index++) stepWorld(f.world);
    expect(orbitalAtContact(f.world, pawn, ship)).toBe(true); ui.manager.update(); await settled();
    const good = orbitalTradeGoods(f.world, pawn, ship).goods.find(good => good.side === 'buy' && good.pile.item === 'component')!;
    await ui.quantity(good.pile.id, 1); await ui.click('check-quote'); await ui.click('confirm-apply');
    expect(f.world.orbital!.pending).toHaveLength(1);
    const delivery = f.world.orbital!.pending[0]!;
    expect(f.world.piles.some(pile => pile.item === 'component' && pile.owner.type === 'orbital-cargo' && pile.owner.deliveryId === delivery.id)).toBe(true);
    expect(ui.options.resume).toHaveBeenCalledTimes(2); ui.manager.dispose();
  });

  it('shows each real lot in its own stock lane and keeps hidden lines in the verified basket',async()=>{
    const {world,ui,pawn,trader}=await visitors();
    addMaterial(world,'textile',10,{type:'ground',x:3,z:3},'cloth');ui.manager.update();await settled();
    const stock=tradeGoods(world,pawn,trader).goods,good=stock.find(good=>good.side==='buy'&&good.pile.item==='medicine')!;
    expect(ui.page!.layout).toBe('trade');expect(ui.page!.width).toBe(1024);
    for(const record of stock){const row=ui.page!.rows.find(row=>row.id===`native-local-trade-good-pile:${record.pile.id}`)!;
      expect(row.tradeEntry).toMatchObject({side:record.side,available:record.available,unitPrice:record.unitPrice,quantity:0,refused:!!record.refusal,icon:`item-${record.pile.item}`});
      if(record.refusal){expect(row.input).toBeUndefined();expect(row.controls!.every(control=>control.disabled)).toBe(true);}
    }
    await ui.quantity(good.pile.id,1);const controls=()=>ui.page!.rows.find(row=>row.id==='native-local-trade-search')!;
    await controls().controls![1]!.select!.onChange('stock');let stocks=ui.page!.rows.filter(row=>row.tradeEntry).map(row=>row.tradeEntry!.available);expect(stocks).toEqual([...stocks].sort((a,b)=>b-a));
    await controls().controls![0]!.select!.onChange('sell');expect(ui.page!.rows.filter(row=>row.tradeEntry).every(row=>row.tradeEntry!.side==='sell')).toBe(true);
    await controls().input!.onCommit('aucune marchandise de ce nom');expect(ui.page!.rows.some(row=>row.tradeEntry)).toBe(false);
    expect(ui.page!.rows.find(row=>row.id==='native-local-trade-total')!.detail).toContain('1 lot(s) du panier masqués');
    await ui.click('check-quote');expect(ui.page!.rows.find(row=>row.id===`native-local-trade-confirmed-pile:${good.pile.id}`)!.value).toBe('Acheter × 1');
    expect(ui.options.command.mock.calls.filter(([command])=>command.type==='trade-execute')).toHaveLength(0);await ui.click('confirm-apply');
    expect(ui.options.command.mock.calls.map(([command])=>command).find(command=>command.type==='trade-execute')).toMatchObject({lines:[{pileId:good.pile.id,quantity:1}]});ui.manager.dispose();
  });

  it('does not turn a stale review or a retained quantity input into consent for a new quote',async()=>{
    const {world,ui,pawn,trader}=await visitors(),good=tradeGoods(world,pawn,trader).goods.find(good=>good.side==='buy'&&good.pile.item==='medicine')!;
    const input=ui.page!.rows.find(row=>row.id===`native-local-trade-good-pile:${good.pile.id}`)!.input!;
    await ui.quantity(good.pile.id,1);await ui.click('check-quote');const oldPage=ui.page!,oldApply=oldPage.actions!.find(control=>control.id==='native-local-trade-confirm-apply')!;
    expect(await input.onCommit('2')).toBe(false);expect(ui.page!.id).toBe('native-local-trade-confirm');
    await ui.click('confirm-back');await ui.quantity(good.pile.id,2);await ui.click('check-quote');await oldApply.onActivate();oldPage.onClose?.();
    expect(ui.options.command.mock.calls.filter(([command])=>command.type==='trade-execute')).toHaveLength(0);expect(ui.page!.rows.find(row=>row.id===`native-local-trade-confirmed-pile:${good.pile.id}`)!.value).toBe('Acheter × 2');
    await ui.click('confirm-apply');expect(ui.options.command.mock.calls.map(([command])=>command).find(command=>command.type==='trade-execute')).toMatchObject({lines:[{pileId:good.pile.id,quantity:2}]});ui.manager.dispose();
  });

  it('rejects an old quantity callback after a replacement world and never takes over another page', async () => {
    const { world, ui, pawn, trader } = await visitors();
    const good = tradeGoods(world, pawn, trader).goods.find(good => good.side === 'buy' && !good.refusal)!;
    const commit = ui.page!.rows.find(row => row.id === `native-local-trade-good-pile:${good.pile.id}`)!.input!.onCommit;
    const commands = ui.options.command.mock.calls.length; ui.state.epoch=(ui.state.epoch??0)+1;
    expect(await commit('1')).toBe(false); expect(ui.options.command.mock.calls).toHaveLength(commands);
    ui.options.show({ id: 'different-page', title: 'Autre page', rows: [] }); ui.manager.update();
    expect(ui.page!.id).toBe('different-page'); ui.manager.dispose();
  });
});
