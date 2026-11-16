import {drawPicto} from '../ui/picto-artwork';
import type {ColonistBarState346} from '../ui/colonist-bar-state-346';
import {PALETTE} from './prototype-art';

const FONT = '"Comic Sans MS", "Chalkboard SE", Georgia, serif';
const barRiskLabels = {none: '', minor: 'Risque de crise mineure', major: 'Risque de crise majeure', extreme: 'Risque de crise extrême'} as const;
const barRiskColors = {minor: '#e0b43a', major: '#e0862e', extreme: '#d4433a'} as const;
const barIconPictos: Partial<Record<ColonistBarState346['icons'][number]['kind'], string>> = {'forming-caravan': 'monde', 'medical-rest': 'hospital-bed', sleeping: 'moon', fleeing: 'back', attacking: 'target', idle: 'hourglass', burning: 'flame'};
/** Core DrawColonist/DrawIcons in the 70 × 96 card: threshold fill (10 % minor,
 * 15 % otherwise), inner edge for major/extreme and the bottom gradient over
 * the portrait, then the activity icons along its lower left edge. */
export function drawColonistBarState346(ctx: CanvasRenderingContext2D, bar: ColonistBarState346): void {
  if (bar.tint && bar.threshold !== 'none') {
    const color = barRiskColors[bar.threshold];
    ctx.save();
    ctx.globalAlpha = bar.threshold === 'minor' ? .1 : .15; ctx.fillStyle = color; ctx.fillRect(6, 6, 58, 54);
    const gradient = ctx.createLinearGradient(0, 60, 0, 38); gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = .6; ctx.fillStyle = gradient; ctx.fillRect(6, 38, 58, 22);
    if (bar.threshold !== 'minor') { ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = bar.threshold === 'extreme' ? 4 : 3; ctx.strokeRect(2.5, 2.5, 65, 91); }
    ctx.restore();
  }
  const size = Math.min(56 / Math.max(1, bar.icons.length), 14);
  bar.icons.forEach((icon, index) => {
    const cx = 7 + size * index + size / 2, cy = 59 - size / 2;
    ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = PALETTE.creamPaper; ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const picto = barIconPictos[icon.kind];
    if (picto) drawPicto(ctx, picto, cx, cy, size * .42, icon.kind === 'burning' ? PALETTE.terracotta : PALETTE.inkDark);
    else { ctx.save(); ctx.fillStyle = icon.kind === 'mental-aggro' ? '#c23a2e' : '#3f6fa8'; ctx.font = `bold ${Math.round(size * .9)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('!', cx, cy + size * .32); ctx.restore(); }
  });
}
/** Tooltip suffix: the activity icons, then the mood-risk tint. */
export function colonistBarStateLabel346(bar: ColonistBarState346): string {
  return `${bar.icons.map(icon => ` · ${icon.label}`).join('')}${bar.tint && bar.threshold !== 'none' ? ` · ${barRiskLabels[bar.threshold]}` : ''}`;
}
