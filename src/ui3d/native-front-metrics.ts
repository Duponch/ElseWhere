/** RimWorld 1.6: MainMenuDrawer, Dialog_FileList and Page with its creation
 * subclasses. These are logical interface points, independent of UI scale. */
export const NATIVE_HOME={width:450,height:550,gameWidth:170,extraWidth:145,columnGap:17,offsetY:50,buttonHeight:45,buttonGap:7} as const;
export const NATIVE_FILE_LIST={width:620,height:700,rowHeight:40,actionWidth:100,actionHeight:36,infoWidth:94,nameInset:8,nameGap:4,manageWidth:36,nameFieldWidth:400,nameFieldHeight:35,nameFieldGap:20} as const;
export const NATIVE_CREATION={width:1020,height:764,titleHeight:45,buttonWidth:150,buttonHeight:38,footerGap:17,
  columnGap:17,scenarioFraction:.35,scenarioHeight:68,storytellerWidth:138,storytellerHeight:130,storytellerGap:10,radioHeight:22,radioGap:3,worldLabelWidth:200,worldFieldHeight:30,worldRowPitch:40,
  rosterWidth:140,rosterHeight:60,rosterHeadingHeight:22,portraitWidth:92,portraitHeight:128,selectorPortraitWidth:70,summaryHeight:127} as const;

/** The whole record remains selectable on very narrow interfaces. The date
 * and kind are always available in the dossier and the tooltip. */
export function nativeFileColumns(width:number,managed=false){
  const m=NATIVE_FILE_LIST,gap=Math.min(m.nameGap,width/20),inset=Math.min(m.nameInset,width/12);
  const manage=managed?Math.min(m.manageWidth,width*.16):0,manageX=width-manage;
  const action=Math.min(m.actionWidth,Math.max(1,(manageX-inset-gap)*.36));
  const info=manageX>=280?m.infoWidth:0;
  const actionX=manageX-action,infoX=actionX-info;
  return{inset,gap,action,actionX,info,infoX,manage,manageX,name:Math.max(1,infoX-inset-gap)};
}
