import './time-controls.css';

export const TIME_CONTROL_ASSETS = Object.freeze({
  0: '/assets/ui/elsewhere/pictograms-20261107/pause.svg',
  1: '/assets/ui/elsewhere/pictograms-20261107/play.svg',
  3: '/assets/ui/elsewhere/pictograms-20261107/speed-double.svg',
  6: '/assets/ui/elsewhere/pictograms-20261107/speed-triple.svg',
});

/** Equal transparent view boxes keep the new vector transport symbols aligned. */
export const TIME_CONTROL_FRAMES = Object.freeze({
  0: [0, 0, 64, 64],
  1: [0, 0, 64, 64],
  3: [0, 0, 64, 64],
  6: [0, 0, 64, 64],
} as const);

function timeIcon(speed: keyof typeof TIME_CONTROL_ASSETS): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('time-control-icon'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.setAttribute('viewBox', TIME_CONTROL_FRAMES[speed].join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  image.setAttribute('href', TIME_CONTROL_ASSETS[speed]); image.setAttribute('width', '64'); image.setAttribute('height', '64');
  svg.append(image); return svg;
}

/** Static decoration, shared by the controls and the pause readout. The
 * banner follows the actual portrait row in flow, including font changes. */
export function installTimeControls(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-speed]')) {
    const source = TIME_CONTROL_ASSETS[Number(button.dataset.speed) as keyof typeof TIME_CONTROL_ASSETS];
    if (!source) continue;
    button.replaceChildren(timeIcon(Number(button.dataset.speed) as keyof typeof TIME_CONTROL_ASSETS));
  }
  const banner = root.querySelector<HTMLElement>('#pause-banner');
  const bar = root.querySelector<HTMLElement>('.colonist-bar');
  if (banner && bar) {
    const icon = timeIcon(0);
    const text = document.createElement('span'); text.textContent = 'En pause';
    banner.replaceChildren(icon, text); bar.append(banner);
  }
}
