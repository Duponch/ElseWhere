/** MainTabWindow_Quests and the shared Core window scale. */
export const NATIVE_QUESTS={width:1010,height:640,leftFraction:.36,gap:17,rowHeight:32,searchHeight:24} as const;
/** MainTabWindow_History: message list and its selected message. */
export const NATIVE_HISTORY={width:1010,height:640,rowHeight:30,pinColumn:30,iconColumn:30,pinSize:22,dateColumn:90,columnGap:5,
  detailGap:10,searchWidth:240,searchHeight:24,searchX:720,searchY:8,graphHeight:450} as const;
export function historyColumns(width:number){
  const h=NATIVE_HISTORY,gap=Math.min(h.columnGap,Math.max(0,width/12));
  const pin=Math.min(h.pinColumn,Math.max(12,width*.18)),icon=pin;
  const date=Math.min(h.dateColumn,Math.max(12,width-pin-icon-gap*3-45));
  const iconX=pin+gap,dateX=iconX+icon+gap,messageX=dateX+date+gap;
  return {pin,icon,iconX,date,dateX,messageX,message:Math.max(1,width-messageX)};
}
/** FactionUIUtility: icon and three-line identity, info, the reserved
 * Ideology lane (empty in Core), relations, natural goodwill, enemies. */
export const NATIVE_FACTIONS={width:1010,height:684,rowHeight:80,headerHeight:50,iconSize:42,iconX:24,
  identityX:90,identityWidth:300,infoWidth:40,reservedWidth:60,relationWidth:70,naturalWidth:54,
  enemySize:22,enemyGap:5,siteWidth:88,statusWidth:92} as const;
export function factionTableColumns(contentWidth:number){
  const f=NATIVE_FACTIONS,name=Math.min(f.identityX+f.identityWidth,Math.max(80,Math.floor(contentWidth*.46)));
  const fixed=f.infoWidth+f.reservedWidth+f.relationWidth+f.naturalWidth+f.siteWidth+f.statusWidth;
  const enemies=Math.max(135,contentWidth-name-fixed),widths=[f.infoWidth,f.reservedWidth,f.relationWidth,f.naturalWidth,enemies,f.siteWidth,f.statusWidth];
  return {name,tail:0,widths,total:name+fixed+enemies,rowHeight:f.rowHeight,headerHeight:f.headerHeight};
}
export const NATIVE_MENU={width:450,height:390,primaryWidth:170,secondaryWidth:145,columnGap:17,optionHeight:45,optionGap:7} as const;
