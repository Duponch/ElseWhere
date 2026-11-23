import {describe,expect,it} from 'vitest';
import {ALERT_COLUMN_WIDTH,BAR_BASE,BAR_MARGIN_TOP,barAllowedRows,colonistBarLayout,colonistBarVisible,dHondt,globalColumn} from '../src/ui3d/native-hud-rimworld';

/** Independent single-group reference of ColonistBarDrawLocsFinder (one map). */
function reference(count:number,screen:number){
  let scale=1;
  for(;;){
    const perRow=Math.floor((screen-520)/((48+24)*scale));
    if(perRow>=1&&Math.ceil(count/perRow)<=barAllowedRows(scale))return{scale,perRow};
    scale*=.95;
  }
}

describe('colonist bar draw locations · ColonistBarDrawLocsFinder',()=>{
  it('keeps three colonists on one row at full size, centred, 72 apart, 21 from the top',()=>{
    const bar=colonistBarLayout([0,0,0],1920);
    expect(bar.scale).toBe(1);expect(bar.rows).toBe(1);
    expect(bar.locs.map(loc=>loc.x)).toEqual([852,924,996]);expect(bar.locs.every(loc=>loc.y===BAR_MARGIN_TOP)).toBe(true);
    // The row is centred on the screen: the 48-wide cells span 3 × 72 − 24.
    expect((bar.left+bar.right)/2).toBeCloseTo(960-12/1,0);
  });
  it('scales 20 and 80 colonists down by 0.95 steps until the rows the scale allows are enough',()=>{
    for(const count of [20,80]){
      const bar=colonistBarLayout(Array(count).fill(0),1920),expected=reference(count,1920);
      expect(bar.scale).toBeCloseTo(expected.scale,10);
      expect(bar.rows).toBeLessThanOrEqual(barAllowedRows(bar.scale));
      expect(bar.slotsPerGroup).toEqual([Math.min(expected.perRow,count)]);
      expect(bar.locs).toHaveLength(count);
      for(const loc of bar.locs){expect(loc.x).toBeGreaterThanOrEqual(260-1);expect(loc.x+BAR_BASE*bar.scale).toBeLessThanOrEqual(1920-260+1);}
      expect(Math.max(...bar.locs.map(loc=>loc.y))).toBeCloseTo(BAR_MARGIN_TOP+(bar.rows-1)*80*bar.scale,6);
    }
    // 20 colonists: 19 slots at scale 1 need two rows, only one is allowed above 0.58, so one 0.95 step gives 20 slots on one row.
    expect(colonistBarLayout(Array(20).fill(0),1920).scale).toBeCloseTo(.95,10);
    const eighty=colonistBarLayout(Array(80).fill(0),1920);expect(eighty.scale).toBeLessThan(.5);expect(eighty.scale).toBeGreaterThan(.4);
  });
  it('centres the last, shorter row and wraps by the horizontal slots',()=>{
    const bar=colonistBarLayout(Array(80).fill(0),1920),slots=bar.slotsPerGroup[0]!,cell=72*bar.scale;
    const lastRowCount=80%slots;
    if(lastRowCount){
      const first=bar.locs[80-lastRowCount]!,firstOfFirstRow=bar.locs[0]!;
      expect(first.x-firstOfFirstRow.x).toBeCloseTo((slots-lastRowCount)*cell/2,6);
    }
    expect(bar.locs[slots]!.y-bar.locs[0]!.y).toBeCloseTo(80*bar.scale,6);
  });
  it('shares slots between groups by D’Hondt and spaces groups by 25 scaled px',()=>{
    expect(dHondt([5,3],4)).toEqual([3,1]);expect(dHondt([1,1],3)).toEqual([2,1]);
    const bar=colonistBarLayout([0,0,0,1,1],1920);
    expect(bar.scale).toBe(1);
    // One row: each group keeps its own entries; the gap between groups is 25 on top of the cell step.
    expect(bar.locs[3]!.x-bar.locs[2]!.x).toBeCloseTo(72+25,6);
  });
  it('is hidden under 800 × 500 and empty without entries',()=>{
    expect(colonistBarVisible(799,600)).toBe(false);expect(colonistBarVisible(800,499)).toBe(false);expect(colonistBarVisible(800,500)).toBe(true);
    expect(colonistBarLayout([],1920).locs).toEqual([]);
  });
});

describe('right column · GlobalControls, AlertsReadout, LetterStack',()=>{
  it('stacks from the bottom: display settings, speed, date, weather, temperature, then 10 before the letters',()=>{
    const column=globalColumn(6);
    const rows=[...new Set(column.view.map(rect=>rect.bottom))];
    expect(rows).toEqual([4,30]);
    expect(column.view.filter(rect=>rect.bottom===4)).toHaveLength(5);expect(column.view.filter(rect=>rect.bottom===30)).toHaveLength(1);
    expect(column.view.map(rect=>rect.right).slice(0,5)).toEqual([0,26,52,78,104]);
    expect(column.speed.map(rect=>[rect.width,rect.height])).toEqual(Array(4).fill([32,24]));
    expect(column.speed.map(rect=>rect.right)).toEqual([102,70,38,6]);
    expect(column.speed[0]!.bottom).toBe(58);
    expect([column.date.bottom,column.date.height,column.date.width]).toEqual([86,48,200]);
    expect([column.weather.bottom,column.weather.height]).toEqual([134,26]);
    expect([column.temperature.bottom,column.temperature.height]).toEqual([160,26]);
    expect(column.height).toBe(186);expect(column.lettersBase).toBe(196);
    expect(column.speed[0]!.bottom).toBeGreaterThan(column.view.at(-1)!.bottom+24);
  });
  it('keeps the alert column 154 wide',()=>{expect(ALERT_COLUMN_WIDTH).toBe(154);});
});
