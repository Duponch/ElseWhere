import type {ReferencePaintDescriptor} from './reference-paint-library';
/** Metadata only: 45 paints from the supplied bestiary (SHA below). Source colors and initial RNG boundaries; current 512² gouache painter and explicit default340 harmonize the existing look. No source repaint equivalence is claimed. Registration never creates a Canvas or texture. */
export interface BestiaryPaintDescriptor extends ReferencePaintDescriptor {origin:string;sourceKey:string}
export const BESTIARY_PAINT_SOURCE_SHA="2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed";
export const BESTIARY_PAINT_DESCRIPTORS:readonly BestiaryPaintDescriptor[]=[
  {
    "key": "best46:matCharcoalGouache",
    "config": {
      "baseColor": "#1a1917",
      "secondaryColor": "#2c2926",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 2014722395637,
    "sourceIndex": 0,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCharcoalGouache"
  },
  {
    "key": "best46:matCreamWhiteGouache",
    "config": {
      "baseColor": "#e8e3d8",
      "secondaryColor": "#d5cebf",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 27444182143329,
    "sourceIndex": 1,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCreamWhiteGouache"
  },
  {
    "key": "best46:matSnowWhiteGouache",
    "config": {
      "baseColor": "#f2f0ea",
      "secondaryColor": "#dce0e6",
      "accentColor": "#ffffff",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 52818694916631,
    "sourceIndex": 2,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matSnowWhiteGouache"
  },
  {
    "key": "best46:matPinkEarGouache",
    "config": {
      "baseColor": "#d99b8e",
      "secondaryColor": "#c48375",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 78293943809648,
    "sourceIndex": 3,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matPinkEarGouache"
  },
  {
    "key": "best46:matTimberWolfGrey",
    "config": {
      "baseColor": "#696e73",
      "secondaryColor": "#4f5459",
      "accentColor": "#8d9399",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 103622667437625,
    "sourceIndex": 4,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matTimberWolfGrey"
  },
  {
    "key": "best46:matWargSlate",
    "config": {
      "baseColor": "#4d4b46",
      "secondaryColor": "#363430",
      "accentColor": "#69655c",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 129070442843447,
    "sourceIndex": 5,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matWargSlate"
  },
  {
    "key": "best46:matPantherBlack",
    "config": {
      "baseColor": "#212329",
      "secondaryColor": "#15161a",
      "accentColor": "#353945",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 154820426608414,
    "sourceIndex": 6,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matPantherBlack"
  },
  {
    "key": "best46:matCougarTawny",
    "config": {
      "baseColor": "#bd874e",
      "secondaryColor": "#a16e38",
      "accentColor": "#d4a168",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 180579568202446,
    "sourceIndex": 7,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCougarTawny"
  },
  {
    "key": "best46:matLynxSpotted",
    "config": {
      "baseColor": "#b8946c",
      "secondaryColor": "#876542",
      "accentColor": "#4a3726",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 206402814599933,
    "sourceIndex": 8,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matLynxSpotted"
  },
  {
    "key": "best46:matFennecSand",
    "config": {
      "baseColor": "#dec292",
      "secondaryColor": "#c7a875",
      "accentColor": "#f0dec0",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 231731538227910,
    "sourceIndex": 9,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matFennecSand"
  },
  {
    "key": "best46:matGrizzlyBrown",
    "config": {
      "baseColor": "#5c3c24",
      "secondaryColor": "#452b18",
      "accentColor": "#785133",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 257133524488407,
    "sourceIndex": 10,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matGrizzlyBrown"
  },
  {
    "key": "best46:matBoarBristle",
    "config": {
      "baseColor": "#4f3b2c",
      "secondaryColor": "#38291e",
      "accentColor": "#6b523e",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 282956770885894,
    "sourceIndex": 11,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matBoarBristle"
  },
  {
    "key": "best46:matRhinoArmour",
    "config": {
      "baseColor": "#7a7e82",
      "secondaryColor": "#616569",
      "accentColor": "#959a9e",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 308706754650861,
    "sourceIndex": 12,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matRhinoArmour"
  },
  {
    "key": "best46:matEquineBay",
    "config": {
      "baseColor": "#7d4427",
      "secondaryColor": "#61321b",
      "accentColor": "#995735",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 334465896244893,
    "sourceIndex": 13,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matEquineBay"
  },
  {
    "key": "best46:matDonkeyDun",
    "config": {
      "baseColor": "#857c70",
      "secondaryColor": "#6b6358",
      "accentColor": "#9e9588",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 360270826984250,
    "sourceIndex": 14,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matDonkeyDun"
  },
  {
    "key": "best46:matAlpacaWool",
    "config": {
      "baseColor": "#e3cfb4",
      "secondaryColor": "#cbb495",
      "accentColor": "#f2e4d0",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 386039126407347,
    "sourceIndex": 15,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matAlpacaWool"
  },
  {
    "key": "best46:matMuffaloBlue",
    "config": {
      "baseColor": "#7c909e",
      "secondaryColor": "#5e7280",
      "accentColor": "#9eb2c2",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 411459428325974,
    "sourceIndex": 16,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matMuffaloBlue"
  },
  {
    "key": "best46:matYakShaggy",
    "config": {
      "baseColor": "#423124",
      "secondaryColor": "#2e2117",
      "accentColor": "#594332",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 437172780774681,
    "sourceIndex": 17,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matYakShaggy"
  },
  {
    "key": "best46:matSlothEarth",
    "config": {
      "baseColor": "#947c5c",
      "secondaryColor": "#786245",
      "accentColor": "#ad9472",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 462803712761803,
    "sourceIndex": 18,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matSlothEarth"
  },
  {
    "key": "best46:matBoomSacAmber",
    "config": {
      "baseColor": "#eb9c26",
      "secondaryColor": "#cf7a12",
      "accentColor": "#ffd15c",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 488617801330225,
    "sourceIndex": 19,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matBoomSacAmber"
  },
  {
    "key": "best46:matChitinOlive",
    "config": {
      "baseColor": "#787d5c",
      "secondaryColor": "#5d6145",
      "accentColor": "#949974",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 514001471932592,
    "sourceIndex": 20,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matChitinOlive"
  },
  {
    "key": "best46:matChitinSpider",
    "config": {
      "baseColor": "#546470",
      "secondaryColor": "#3d4a54",
      "accentColor": "#7a6c52",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 539696508723169,
    "sourceIndex": 21,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matChitinSpider"
  },
  {
    "key": "best46:matCassowaryBlue",
    "config": {
      "baseColor": "#2563eb",
      "secondaryColor": "#1d4ed8",
      "accentColor": "#60a5fa",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 565382387684681,
    "sourceIndex": 22,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCassowaryBlue"
  },
  {
    "key": "best46:matReptileGreen",
    "config": {
      "baseColor": "#528247",
      "secondaryColor": "#3c6333",
      "accentColor": "#72a364",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 591141529278713,
    "sourceIndex": 23,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matReptileGreen"
  },
  {
    "key": "best46:matTortoiseShell",
    "config": {
      "baseColor": "#66583a",
      "secondaryColor": "#473d26",
      "accentColor": "#8c7951",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 616589304684535,
    "sourceIndex": 24,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matTortoiseShell"
  },
  {
    "key": "best46:matCapybaraBrown",
    "config": {
      "baseColor": "#9c673a",
      "secondaryColor": "#80512a",
      "accentColor": "#b57c4c",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 642284341475112,
    "sourceIndex": 25,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCapybaraBrown"
  },
  {
    "key": "best46:matChinchillaSilver",
    "config": {
      "baseColor": "#9ea4ab",
      "secondaryColor": "#7f858c",
      "accentColor": "#bfc5cc",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 667997693923819,
    "sourceIndex": 26,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matChinchillaSilver"
  },
  {
    "key": "best46:matCrimsonWattle",
    "config": {
      "baseColor": "#c43127",
      "secondaryColor": "#961e16",
      "accentColor": "#e35349",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 693491258474966,
    "sourceIndex": 27,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCrimsonWattle"
  },
  {
    "key": "best46:matBeakGold",
    "config": {
      "baseColor": "#e0a224",
      "secondaryColor": "#ba8012",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 719177137436478,
    "sourceIndex": 28,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matBeakGold"
  },
  {
    "key": "best46:matFoxBody",
    "config": {
      "baseColor": "#b35b28",
      "secondaryColor": "#9a491c",
      "accentColor": "#cc6f35",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 744679859816690,
    "sourceIndex": 29,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matFoxBody"
  },
  {
    "key": "best46:matFoxSnout",
    "config": {
      "baseColor": "#b35b28",
      "secondaryColor": "#9a491c",
      "strokeStyle": "directional",
      "gradientTip": {
        "color": "#e6e2d8"
      },
      "strokeCount": 340
    },
    "seed": 770191740025967,
    "sourceIndex": 30,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matFoxSnout"
  },
  {
    "key": "best46:matCamelTan",
    "config": {
      "baseColor": "#8d7960",
      "secondaryColor": "#78654e",
      "accentColor": "#a38d72",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 804467662650449,
    "sourceIndex": 31,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCamelTan"
  },
  {
    "key": "best46:matCamelMuzzle",
    "config": {
      "baseColor": "#8a7d7b",
      "secondaryColor": "#736765",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 830153541611961,
    "sourceIndex": 32,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matCamelMuzzle"
  },
  {
    "key": "best46:matHareSand",
    "config": {
      "baseColor": "#b5a789",
      "secondaryColor": "#9e9073",
      "accentColor": "#cabd9f",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 855528054385263,
    "sourceIndex": 33,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matHareSand"
  },
  {
    "key": "best46:matDogOchre",
    "config": {
      "baseColor": "#c98844",
      "secondaryColor": "#b07130",
      "accentColor": "#debfd0",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 881268880321165,
    "sourceIndex": 34,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matDogOchre"
  },
  {
    "key": "best46:matDogSaddle",
    "config": {
      "baseColor": "#3b2d23",
      "secondaryColor": "#291f18",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 906780760530442,
    "sourceIndex": 35,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matDogSaddle"
  },
  {
    "key": "best46:matDogCollar",
    "config": {
      "baseColor": "#b8332a",
      "secondaryColor": "#8f221b",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 931999590209639,
    "sourceIndex": 36,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matDogCollar"
  },
  {
    "key": "best46:matBuffaloDark",
    "config": {
      "baseColor": "#362d28",
      "secondaryColor": "#261f1b",
      "accentColor": "#4d4039",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 957493154760786,
    "sourceIndex": 37,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matBuffaloDark"
  },
  {
    "key": "best46:matBuffaloHorn",
    "config": {
      "baseColor": "#756d61",
      "secondaryColor": "#575046",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 983261454183883,
    "sourceIndex": 38,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matBuffaloHorn"
  },
  {
    "key": "best46:matGazelleFlank",
    "config": {
      "baseColor": "#c98e4b",
      "secondaryColor": "#b57b3a",
      "strokeStyle": "directional",
      "flankStripe": {
        "bellyColor": "#f0ece1",
        "stripeColor": "#2b1e16"
      },
      "strokeCount": 340
    },
    "seed": 1008709229589705,
    "sourceIndex": 39,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matGazelleFlank"
  },
  {
    "key": "best46:matGazelleTan",
    "config": {
      "baseColor": "#c98e4b",
      "secondaryColor": "#b57b3a",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 1051309618834272,
    "sourceIndex": 40,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matGazelleTan"
  },
  {
    "key": "best46:matDeerAuburn",
    "config": {
      "baseColor": "#8c4927",
      "secondaryColor": "#73381b",
      "accentColor": "#a85c34",
      "strokeStyle": "wavy",
      "strokeCount": 340
    },
    "seed": 1076748236411029,
    "sourceIndex": 41,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matDeerAuburn"
  },
  {
    "key": "best46:matDeerMane",
    "config": {
      "baseColor": "#592e18",
      "secondaryColor": "#42200f",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 1102067802209941,
    "sourceIndex": 42,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matDeerMane"
  },
  {
    "key": "best46:matAntlerCream",
    "config": {
      "baseColor": "#ded5c1",
      "secondaryColor": "#c4b89f",
      "strokeStyle": "directional",
      "strokeCount": 340
    },
    "seed": 1127561366761088,
    "sourceIndex": 43,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matAntlerCream"
  },
  {
    "key": "best46:matElephantSlate",
    "config": {
      "baseColor": "#70757a",
      "secondaryColor": "#585d61",
      "accentColor": "#8a9096",
      "strokeStyle": "coarse",
      "strokeCount": 340
    },
    "seed": 1152972510850650,
    "sourceIndex": 44,
    "origin": "2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed",
    "sourceKey": "matElephantSlate"
  }
];
