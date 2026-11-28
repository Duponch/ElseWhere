/** Core 1.6.4871 Buildings_Security.xml / Items_Resource_Stuff.xml /
 * Various_Stone.xml. Barricade is a distinct ThingDef (not sandbags):
 * waist-high PassThroughOnly edifice, IsFence, fill .55, pathCost 42 with
 * ignored repeats, base HP 300, work 320, Beauty -3, flammability 1. */
export const BARRICADE_382=Object.freeze({cost:5,work:320,maxHp:300,beauty:-3,fill:.55,pathCost:42});
export const BARRICADE_STUFF_382=Object.freeze({
 wood:{hp:.65,work:.7,offset:0,flammability:1,beautyOffset:0,support:'Light',color:0x856143},
 steel:{hp:1,work:1,offset:0,flammability:.4,beautyOffset:0,support:'Medium',color:0x696969},
 silver:{hp:.7,work:1,offset:0,flammability:.4,beautyOffset:6,support:'Medium',color:0xb4ad96},
 gold:{hp:.6,work:.9,offset:0,flammability:.4,beautyOffset:20,support:'Medium',color:0xffeb7a},
 plasteel:{hp:2.8,work:2.2,offset:0,flammability:0,beautyOffset:0,support:'Medium',color:0x9aabb8},
 uranium:{hp:2.5,work:1.9,offset:0,flammability:0,beautyOffset:0,support:'Medium',color:0x646464},
 jade:{hp:.5,work:5,offset:0,flammability:0,beautyOffset:10,support:'Heavy',color:0x557645},
 'granite-blocks':{hp:1.7,work:6,offset:140,flammability:0,beautyOffset:0,support:'Heavy',color:0x77736b},
 'limestone-blocks':{hp:1.55,work:6,offset:140,flammability:0,beautyOffset:0,support:'Heavy',color:0xb1ae99},
 'marble-blocks':{hp:1.2,work:5.5,offset:140,flammability:0,beautyOffset:0,support:'Heavy',color:0xbfb4a7},
 'sandstone-blocks':{hp:1.4,work:5,offset:140,flammability:0,beautyOffset:0,support:'Heavy',color:0xaf9173},
 'slate-blocks':{hp:1.3,work:6,offset:140,flammability:0,beautyOffset:0,support:'Heavy',color:0x5b606d},
} as const);
export type BarricadeMaterial382=keyof typeof BARRICADE_STUFF_382;
export const BARRICADE_MATERIALS_382=Object.freeze(Object.keys(BARRICADE_STUFF_382) as BarricadeMaterial382[]);
export const isBarricadeMaterial382=(v:unknown):v is BarricadeMaterial382=>typeof v==='string'&&Object.hasOwn(BARRICADE_STUFF_382,v);
export function barricadeStuff382(value:unknown){return isBarricadeMaterial382(value)?BARRICADE_STUFF_382[value]:undefined;}
