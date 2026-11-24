/** Window points from Verse.Dialog_MessageBox and RimWorld.Dialog_Options.
 * The paper keeps Elsewhere's own art and the shared native font scale. */
export const NATIVE_MESSAGE={width:640,height:460,titleHeight:42,buttonHeight:35,buttonGap:10,bodyGap:5} as const;
export const NATIVE_OPTIONS={width:650,height:600,categoryWidth:160,categoryHeight:48,categoryGap:2,categoryInset:4,
  categoryIconSize:20,sectionGap:17,listingGap:5,bottomSpace:60,okayWidth:160,okayHeight:40} as const;

/** Dialog_Trade / TradeUI: name on the left, two counts and two prices
 * around a signed quantity editor. Narrower windows reduce the lanes, not
 * the hit area of one stock into the adjacent physical record. */
export const NATIVE_TRADE={width:1024,titleHeight:45,topHeight:58,rowHeight:30,countWidth:75,priceWidth:100,adjustWidth:240,footerWidth:160,footerHeight:40,footerGap:10,headingHeight:34,compactBelow:620,compactRowHeight:54} as const;
export function nativeTradeColumns(width:number){
  const m=NATIVE_TRADE,compact=width<m.compactBelow;
  if(compact){const adjustX=width*.53;return{compact,name:width,sellCountX:0,count:0,sellPriceX:0,price:0,adjustX,adjust:width-adjustX,buyPriceX:0,buyCountX:0};}
  const name=Math.max(1,width-Math.min(2*(m.countWidth+m.priceWidth)+m.adjustWidth,width*.76)),numbers=Math.max(0,width-name);
  const factor=numbers/(2*(m.countWidth+m.priceWidth)+m.adjustWidth),count=m.countWidth*factor,price=m.priceWidth*factor,adjust=m.adjustWidth*factor;
  const sellCountX=name,sellPriceX=sellCountX+count,adjustX=sellPriceX+price,buyPriceX=adjustX+adjust,buyCountX=buyPriceX+price;
  return{compact,name,sellCountX,count,sellPriceX,price,adjustX,adjust,buyPriceX,buyCountX};
}

/** Verse.Dialog_InfoCard, StatDrawEntry and StatsReportUtility. The 18-point
 * Window margin is followed by a second 18-point inset around the card. */
export const NATIVE_INFO={width:950,height:760,margin:18,cardInset:18,titleHeight:34,iconSize:34,iconOffset:9,tabBand:45,tabHeight:30,detailInset:10,rowInset:8,valueFraction:.45,categoryHeight:25,footerReserve:38,closeWidth:120,closeHeight:40,searchWidth:240,searchHeight:24,compactBelow:520} as const;
