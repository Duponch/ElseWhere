/** Geometry of the always-visible HUD, as RimWorld's classes compute it, in
 * logical pixels. Pure functions: no scene, no allocation per frame (callers
 * recompute only when the viewport or the colonist list changes).
 * - `ColonistBar` and `ColonistBarDrawLocsFinder`: 48 × 48 portrait cells
 *   spaced by 24 horizontally and 32 vertically, scaled down by 0.95 steps
 *   until every group fits in the rows the scale allows, D'Hondt shares of the
 *   slots between groups, last row centred, top margin 21, width screen − 520.
 * - `AlertsReadout`: a 154-wide column flush with the right edge, stacked
 *   upward so that it ends where the letters begin.
 * - `LetterStack`: 38 × 30 letters, 12 apart, 10 above the global controls.
 * - `GlobalControls`/`GlobalControlsUtility`: the right column from the bottom:
 *   display settings (24 × 24, five per row), time speed (32 × 24, started 16
 *   in from a 150-wide strip), date (48), weather (26), temperature (26). */
export const BAR_BASE=48,BAR_SPACE_X=24,BAR_SPACE_Y=32,BAR_GROUP_GAP=25,BAR_MARGIN_TOP=21,BAR_SCREEN_MARGIN=520;
export const BAR_MIN_SCREEN={width:800,height:500} as const;
export interface BarLayout{scale:number;/** Top-left corner of each entry's 48 × 48 cell, in entry order. */locs:{x:number;y:number}[];slotsPerGroup:number[];rows:number;left:number;right:number;bottom:number}
/** `GetAllowedRowsCountForScale`. */
export function barAllowedRows(scale:number):number{return scale>.58?1:scale>.42?2:3;}
/** `GenMath.DHondtDistribution`: each of `total` seats goes to the candidate
 * with the highest `score / (seats + 1)`, the first one on a tie. */
export function dHondt(scores:readonly number[],total:number):number[]{
  const seats=scores.map(()=>0),quotient=scores.slice();
  for(let n=0;n<total;n++){
    let best=0;for(let i=1;i<quotient.length;i++)if(quotient[i]!>quotient[best]!)best=i;
    seats[best]!++;quotient[best]=scores[best]!/(seats[best]!+1);
  }
  return seats;
}
/** `TryDistributeHorizontalSlotsBetweenGroups`: a group left with no slot takes
 * one from the largest, unless that one has at most one. */
function distribute(counts:readonly number[],perRow:number):number[]|null{
  const slots=dHondt(counts,perRow);
  for(let k=0;k<slots.length;k++)if(slots[k]===0){
    const max=Math.max(...slots);if(max<=1)return null;
    slots[slots.indexOf(max)]!--;slots[k]!++;
  }
  return slots;
}
/** `CalculateDrawLocs`. `groups[i]` is the group index of entry i; entries of a
 * group are contiguous and groups increase. */
export function colonistBarLayout(groups:readonly number[],screenWidth:number):BarLayout{
  if(!groups.length)return{scale:1,locs:[],slotsPerGroup:[],rows:0,left:screenWidth/2,right:screenWidth/2,bottom:BAR_MARGIN_TOP};
  const count=groups.at(-1)!+1,counts=new Array<number>(count).fill(0);
  for(const g of groups)counts[g]!++;
  const maxWidth=screenWidth-BAR_SCREEN_MARGIN;
  let scale=1,onlyOneRow=true,perGlobalRow=0,slots:number[]=[];
  for(;;){
    const cell=(BAR_BASE+BAR_SPACE_X)*scale;
    perGlobalRow=Math.floor((maxWidth-(count-1)*BAR_GROUP_GAP*scale)/cell);
    onlyOneRow=true;
    const found=distribute(counts,perGlobalRow);
    if(found){
      slots=found;const allowed=barAllowedRows(scale);let fits=true;
      for(let g=0;g<count;g++){
        if(!counts[g])continue;
        const rows=Math.ceil(counts[g]!/slots[g]!);
        if(rows>1)onlyOneRow=false;
        if(rows>allowed){fits=false;break;}
      }
      if(fits)break;
    }
    scale*=.95;
    if(scale<1e-3)break;
  }
  const cell=(BAR_BASE+BAR_SPACE_X)*scale;let perRow=perGlobalRow;
  if(onlyOneRow){for(let g=0;g<count;g++)slots[g]=Math.min(slots[g]!,counts[g]!);perRow=groups.length;}
  const total=perRow*cell+(count-1)*BAR_GROUP_GAP*scale;
  let groupX=(screenWidth-total)/2,previous=-1,index=0,rows=1,left=Infinity,right=-Infinity,bottom=0;
  const locs:{x:number;y:number}[]=[];
  for(let i=0;i<groups.length;i++){
    const g=groups[i]!;
    if(previous!==g){
      if(previous>=0){groupX+=BAR_GROUP_GAP*scale;groupX+=slots[previous]!*scale*(BAR_BASE+BAR_SPACE_X);}
      index=0;previous=g;
    }else index++;
    let x=groupX+(index%slots[g]!)*scale*(BAR_BASE+BAR_SPACE_X);
    const y=BAR_MARGIN_TOP+Math.floor(index/slots[g]!)*scale*(BAR_BASE+BAR_SPACE_Y);
    if(index>=counts[g]!-counts[g]!%slots[g]!)x+=(slots[g]!-counts[g]!%slots[g]!)*scale*(BAR_BASE+BAR_SPACE_X)*.5;
    locs.push({x,y});
    rows=Math.max(rows,Math.floor(index/slots[g]!)+1);
    left=Math.min(left,x);right=Math.max(right,x+BAR_BASE*scale);bottom=Math.max(bottom,y+BAR_BASE*scale);
  }
  return{scale,locs,slotsPerGroup:slots,rows,left,right,bottom};
}
/** `ColonistBar.Visible`: hidden on screens under 800 × 500. */
export const colonistBarVisible=(width:number,height:number):boolean=>width>=BAR_MIN_SCREEN.width&&height>=BAR_MIN_SCREEN.height;

/** A rectangle of the right column: `right` is the distance from the screen's
 * right edge to the rectangle's right edge, `bottom` the height of its lower
 * edge above the column's origin (the line RimWorld calls `screenHeight − 35`). */
export interface ColumnRect{right:number;bottom:number;width:number;height:number}
export const ALERT_COLUMN_WIDTH=154,ALERT_TEXT_WIDTH=148,LETTER_ICON={width:38,height:30,right:12},LETTER_SPACING=12;
export const TIME_BUTTON={width:32,height:24} as const,PLAY_BUTTON=24,PLAY_GAP=2,PLAY_ROW_WIDTH=141,PLAY_PER_ROW=5,DATE_HEIGHT=48,ROW_HEIGHT=26;
export const NATIVE_VIEW_ACTIONS=['walls','roofs','foliage','zones','home','camera','room-stats','beauty'] as const;
export interface GlobalColumn{view:ColumnRect[];speed:ColumnRect[];date:ColumnRect;weather:ColumnRect;temperature:ColumnRect;/** Height of the column. */height:number;/** Where the letters' lowest edge sits (column height plus 10). */lettersBase:number}
/** `GlobalControls.GlobalControlsOnGUI`, from the bottom: 4, display settings
 * (rows of five, wrapping upward), 4, speed, 4, date, weather, temperature, then
 * 10 before the letters. */
export function globalColumn(viewCount:number):GlobalColumn{
  let y=4;const view:ColumnRect[]=[];
  const perRow=Math.min(PLAY_PER_ROW,Math.floor((PLAY_ROW_WIDTH+PLAY_GAP)/(PLAY_BUTTON+PLAY_GAP)));
  for(let i=0;i<viewCount;i++){
    const row=Math.floor(i/perRow),col=i%perRow;
    view.push({right:col*(PLAY_BUTTON+PLAY_GAP),bottom:y+row*(PLAY_BUTTON+PLAY_GAP),width:PLAY_BUTTON,height:PLAY_BUTTON});
  }
  const rows=Math.max(1,Math.ceil(viewCount/perRow));y+=rows*PLAY_BUTTON+(rows-1)*PLAY_GAP+4;
  // Speed strip: left x = screen − 200 + max(0, 200 − 150) + 16, so 134 from the right edge.
  const speed=[0,1,2,3].map(i=>({right:134-TIME_BUTTON.width*(i+1),bottom:y,width:TIME_BUTTON.width,height:TIME_BUTTON.height}));
  y+=TIME_BUTTON.height+4;
  const date={right:0,bottom:y,width:200,height:DATE_HEIGHT};y+=DATE_HEIGHT;
  const weather={right:0,bottom:y,width:222,height:ROW_HEIGHT};y+=ROW_HEIGHT;
  const temperature={right:7,bottom:y,width:200,height:ROW_HEIGHT};y+=ROW_HEIGHT;
  return{view,speed,date,weather,temperature,height:y,lettersBase:y+10};
}
