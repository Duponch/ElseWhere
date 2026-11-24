/** Pure rules of Core's float menus and tooltips, used by NativeStage. */

interface Box { x:number; y:number; width:number; height:number }

/** Core FloatMenu.UpdateBaseColor: the menu rectangle grown by 5 px; past
 * 95 px from it, the menu closes (vanishIfMouseDistant). */
export const FLOAT_MENU_MARGIN_PX = 5, FLOAT_MENU_VANISH_PX = 95;
export function floatMenuDistance(box:Box,x:number,y:number):number {
  const dx = Math.max(box.x - FLOAT_MENU_MARGIN_PX - x, 0, x - (box.x + box.width + FLOAT_MENU_MARGIN_PX));
  const dy = Math.max(box.y - FLOAT_MENU_MARGIN_PX - y, 0, y - (box.y + box.height + FLOAT_MENU_MARGIN_PX));
  return Math.hypot(dx, dy);
}
export const floatMenuVanishes = (box:Box,x:number,y:number):boolean => floatMenuDistance(box, x, y) > FLOAT_MENU_VANISH_PX;
/** Core WindowStack.HandleEventsHighPriority: a press outside every window
 * closes the windows that close on outside clicks, and the press is used. */
export const pressOutsideFloatMenu = (box:Box,x:number,y:number):boolean => !(x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height);

/** Core TipSignal default delay (s). */
export const TOOLTIP_DELAY_MS = 450;
/** Core GenUI.GetMouseAttachedWindowPos. */
export function mouseAttachedTipPosition(x:number,y:number,width:number,height:number,screenWidth:number,screenHeight:number):{left:number;top:number} {
  const top = y + 14 + height < screenHeight ? y + 14 : y - 5 - height >= 0 ? y - 5 - height : screenHeight - (14 + height);
  const left = x + 16 + width < screenWidth ? x + 16 : x - 4 - width;
  return {left, top};
}
/** Core TooltipHandler: the tip of a region is re-triggered every frame the
 * mouse is over it and re-reads its text; it only dies when the region is no
 * longer triggered (mouse left, region gone) or has no text. */
export function tipTextAction(shown:string,current:string):'keep'|'retext'|'clear' {
  return !current ? 'clear' : current === shown ? 'keep' : 'retext';
}

/** Core `FloatMenuOption` sizes (Small text, line 22): 4 above and below the
 * label, 6 beside it, 4 more after it; a Tiny menu (over 60 options) uses
 * Tiny text and 1 / 3 margins. The label wraps at 300 minus the margins; a
 * column is never wider than 300 nor narrower than 70. */
export const FLOAT_MENU={maxWidth:300,minColumn:70,overlap:-1,scrollbar:16,screenFraction:.9,screenMargin:16,mouseShift:4,inset:6,titleOffsetY:25,titleHeight:23,labelShift:4} as const;
export interface FloatMenuOptionSize {width:number;height:number}
export interface FloatMenuPlacement {x:number;y:number;width:number;height:number}
export interface FloatMenuLayout {
  columnWidth:number;columns:number;scrolling:boolean;width:number;viewHeight:number;height:number;
  placements:FloatMenuPlacement[];
}
/** Required size of an option from its measured text. */
export function floatMenuOptionSize(textWidth:number,lines:number,tiny=false,lineHeight=22):FloatMenuOptionSize {
  const horizontal=tiny?3:6,vertical=tiny?1:4;
  return {width:horizontal+4+textWidth+horizontal+4,height:2*vertical+lines*lineHeight};
}
export const floatMenuLabelWidth=(tiny=false):number=>FLOAT_MENU.maxWidth-(2*(tiny?3:6)+4);
/** Core `FloatMenu` column rules: column width from the widest option, columns
 * filled top to bottom up to 90 % of the screen height, a scrollbar only when
 * the columns do not fit the screen width; options overlap by one point. */
export function layoutFloatMenu(options:readonly FloatMenuOptionSize[],screenWidth:number,screenHeight:number):FloatMenuLayout {
  if(!options.length){const width=Math.min(FLOAT_MENU.minColumn,screenWidth);return {columnWidth:width,columns:1,scrolling:false,width,viewHeight:0,height:1,placements:[]};}
  let columnWidth:number=FLOAT_MENU.minColumn;
  for(const option of options){if(option.width>=FLOAT_MENU.maxWidth){columnWidth=FLOAT_MENU.maxWidth;break;}if(option.width>columnWidth)columnWidth=option.width;}
  columnWidth=Math.max(1,Math.min(Math.round(columnWidth),screenWidth));
  const maxWindow=Math.max(1,screenHeight*FLOAT_MENU.screenFraction),maxColumns=Math.max(1,Math.floor((screenWidth-FLOAT_MENU.screenMargin)/columnWidth));
  let fitColumns=1,stack=0;
  for(const option of options){const h=option.height+FLOAT_MENU.overlap;if(stack>0&&stack+h>maxWindow){stack=h;fitColumns++;}else stack+=h;}
  const tallest=Math.max(...options.map(option=>option.height));
  const scrolling=fitColumns>maxColumns||tallest+FLOAT_MENU.overlap>maxWindow,columns=Math.min(fitColumns,maxColumns);
  const scrollbar=scrolling?Math.min(FLOAT_MENU.scrollbar,Math.max(0,screenWidth-1)):0;
  if(scrolling)columnWidth=Math.max(1,Math.min(columnWidth,Math.floor((screenWidth-scrollbar)/columns)));
  let maxViewHeight=maxWindow;
  if(scrolling){
    const sum=options.reduce((total,option)=>total+option.height+FLOAT_MENU.overlap,0);
    maxViewHeight=Math.max(tallest,(sum+columns*tallest)/columns);
  }
  let viewHeight=0;stack=0;
  for(const option of options){const h=option.height+FLOAT_MENU.overlap;if(stack>0&&stack+h>maxViewHeight){viewHeight=Math.max(viewHeight,stack);stack=h;}else stack+=h;}
  viewHeight=Math.max(viewHeight,stack);
  const placements:FloatMenuPlacement[]=[];let x=0,y=0;
  for(const option of options){
    if(y>0&&y+option.height+FLOAT_MENU.overlap>maxViewHeight){y=0;x+=columnWidth+FLOAT_MENU.overlap;}
    placements.push({x,y,width:columnWidth,height:option.height});y+=option.height+FLOAT_MENU.overlap;
  }
  return {columnWidth,columns,scrolling,width:columns*columnWidth+scrollbar,viewHeight,height:Math.min(viewHeight,maxWindow)+1,placements};
}
/** Where the window opens: the mouse plus (4, 0), kept on the screen. */
export function floatMenuOrigin(mouseX:number,mouseY:number,width:number,height:number,screenWidth:number,screenHeight:number):{x:number;y:number} {
  let x=mouseX+FLOAT_MENU.mouseShift,y=mouseY;
  if(x+width>screenWidth)x=screenWidth-width;
  if(y+height>screenHeight)y=screenHeight-height;
  return {x:Math.max(0,x),y:Math.max(0,y)};
}

/** Core `ActiveTip`: Small text, at most 260 wide, 4 of margin on every side,
 * the rectangle rounded up. */
export const TOOLTIP_BOX={maxTextWidth:260,margin:4} as const;
export function tooltipBoxSize(textWidth:number,textHeight:number):{width:number;height:number} {
  return {width:Math.ceil(Math.min(textWidth,TOOLTIP_BOX.maxTextWidth)+2*TOOLTIP_BOX.margin),height:Math.ceil(textHeight+2*TOOLTIP_BOX.margin)};
}

/** Core `MainTabWindow_Architect`, `ArchitectCategoryTab` and `GizmoGridDrawer`:
 * categories in two columns of 32 in a 200 wide window; the 200 × 270
 * information box above it; the designators as 75 × 75 gizmos 5 apart (14
 * between rows) to its right, from x = 210. */
export const ARCHITECT_WINDOW={width:200,columns:2,rowHeight:32,infoHeight:270,infoMargin:7,gridStart:210,gizmo:75,gizmoGapX:5,gizmoGapY:14} as const;
/** Category button `index`: halves of the window, rows of 32 (a button is one
 * point taller, and the left one one point wider, as in `DoCategoryButton`). */
export function architectCategoryRect(index:number,width:number=ARCHITECT_WINDOW.width):{x:number;y:number;width:number;height:number} {
  const column=index%ARCHITECT_WINDOW.columns,half=width/ARCHITECT_WINDOW.columns;
  return {x:column*half,y:Math.floor(index/ARCHITECT_WINDOW.columns)*ARCHITECT_WINDOW.rowHeight,width:half+(column===0?1:0),height:ARCHITECT_WINDOW.rowHeight+1};
}
export const architectWindowHeight=(categories:number):number=>Math.ceil(categories/ARCHITECT_WINDOW.columns)*ARCHITECT_WINDOW.rowHeight;
