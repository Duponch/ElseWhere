import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { siteHudLayout, siteSkyPosition, temperaturePresentation } from '../src/ui/site-hud';
import { TIME_CONTROL_ASSETS, TIME_CONTROL_FRAMES } from '../src/ui/time-controls';

test('temperature indicators distinguish freezing, cold, temperate and heat without rounding away threshold changes', () => {
  const temperatures = [-40, -20, -19.9, 0, .1, 10, 10.1, 25, 25.001, 35, 35.1, 60];
  expect(temperatures.map(value => temperaturePresentation(value).band)).toEqual([
    'freezing', 'freezing', 'cold', 'cold', 'cool', 'cool', 'temperate', 'temperate', 'warm', 'warm', 'hot', 'hot',
  ]);
  expect(temperaturePresentation(24.999).band).not.toBe(temperaturePresentation(25.001).band);
  const markers = [-30, -10, 5, 20, 30, 40].map(temperaturePresentation);
  expect(new Set(markers.map(marker => marker.color)).size).toBe(6);
  for (let index = 1; index < markers.length; index++) expect(markers[index]!.fill).toBeGreaterThan(markers[index - 1]!.fill);
  expect(temperaturePresentation(NaN)).toEqual({ band: 'unknown', color: '#d0d9e6', fill: 0 });
});

test('sun and moon rise, cross the apex and set on the same arc, with separate weather and wind symbols', () => {
  expect(siteSkyPosition(360).phase).toBe('day');
  expect(siteSkyPosition(1080).phase).toBe('night');
  expect(siteSkyPosition(720).celestial.x).toBeCloseTo(140);
  expect(siteSkyPosition(720).celestial.y).toBeCloseTo(22);
  expect(siteSkyPosition(0).celestial).toEqual(siteSkyPosition(1440).celestial);
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  for (let minute = 0; minute < 1440; minute++) {
    const positions = siteSkyPosition(minute);
    for (const position of [positions.celestial, positions.weather, positions.wind]) {
      expect(((position.x - 140) / 122) ** 2 + ((position.y - 94) / 72) ** 2).toBeCloseTo(1, 10);
    }
    expect(distance(positions.celestial, positions.weather)).toBeGreaterThan(32);
    expect(distance(positions.celestial, positions.wind)).toBeGreaterThan(32);
    expect(distance(positions.weather, positions.wind)).toBeGreaterThan(32);
  }
});

test('weather illustration has no inset background plate and its thermometer exposes independent fill and color', () => {
  const markup = siteHudLayout();
  const sky = markup.slice(markup.indexOf('<div id="site-sky"'), markup.indexOf('<div id="biome-current"'));
  expect(sky).not.toContain('<rect');
  expect(sky).not.toContain('<linearGradient');
  expect(sky).toContain('site-sky-arc');
  expect(markup).toContain('id="site-thermometer-fill"');
  expect(markup).toContain('class="site-thermometer"');
});

test('time pictograms are transparent vectors with matching square view boxes', () => {
  for (const speed of [0, 1, 3, 6] as const) {
    const svg = readFileSync(new URL(`../public${TIME_CONTROL_ASSETS[speed]}`, import.meta.url),'utf8');
    expect(svg).toContain('viewBox="0 0 64 64"');expect(svg).toContain('data-art="adult-hand-20261107"');
    expect(svg).not.toContain('<rect');expect(svg).toContain('<path');
    const [x, y, width, height] = TIME_CONTROL_FRAMES[speed];
    expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(64); expect(y + height).toBeLessThanOrEqual(64);
  }
});
