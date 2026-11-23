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
