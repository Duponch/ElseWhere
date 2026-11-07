import {pictoDataUrl} from './picto-artwork';
import './site-hud.css';
import { calendarTick } from '../sim/calendar';
import { climateDate } from '../sim/site-climate';
import { TICKS_PER_DAY, type World } from '../sim/types';
import { WEATHER, type WeatherKind } from '../sim/weather-definitions';
import { perceivedWeather } from '../sim/weather';
import { windIntensity } from '../sim/wind-rules';

const quadrums = ['avrimai', 'juillêt', 'septobre', 'décembary'] as const;
const seasons = ['Printemps', 'Été', 'Automne', 'Hiver'] as const;

/** Pure presentation bands; these are not exposure or thermostat rules. */
export const TEMPERATURE_DISPLAY_BANDS = [
  { maximum: -20, band: 'freezing', color: '#78b7ff', fill: 4 },
  { maximum: 0, band: 'cold', color: '#99cfff', fill: 8 },
  { maximum: 10, band: 'cool', color: '#a5e4ed', fill: 12 },
  { maximum: 25, band: 'temperate', color: '#f7e6ac', fill: 17 },
  { maximum: 35, band: 'warm', color: '#ffc16d', fill: 22 },
  { maximum: Infinity, band: 'hot', color: '#ff8176', fill: 27 },
] as const;
const unknownTemperature = { band: 'unknown', color: '#d0d9e6', fill: 0 } as const;
export function temperaturePresentation(temperature: number) {
  return Number.isFinite(temperature) ? TEMPERATURE_DISPLAY_BANDS.find(band => temperature <= band.maximum)! : unknownTemperature;
}

/** Every symbol follows the same ellipse, only at civil-minute boundaries. */
export function siteSkyPosition(minute: number) {
  const civilMinute = (minute % 1440 + 1440) % 1440;
  const isDay = civilMinute >= 360 && civilMinute < 1080;
  const progress = isDay ? (civilMinute - 360) / 720 : ((civilMinute + 360) % 1440) / 720;
  const onArc = (value: number) => ({ x: 140 - 122 * Math.cos(value * Math.PI), y: 94 - 72 * Math.sin(value * Math.PI) });
  return { phase: isDay ? 'day' : 'night', celestial: onArc(progress),
    weather: onArc(Math.abs(progress - .73) < .14 ? .43 : .73),
    wind: onArc(Math.abs(progress - .25) < .14 ? .52 : .25) };
}

/** Civil dates follow the saved climate origin, rather than elapsed game days. */
export function siteHudDate(world: World): { day: number; label: string; full: string; season?: number } {
  if (!world.climate) {
    const day = 1 + Math.floor(calendarTick(world) / TICKS_PER_DAY);
    return { day, label: 'Partie historique', full: `Jour ${day} · calendrier historique` };
  }
  const date = climateDate(world);
  return { day: date.day, label: `${quadrums[date.quadrum]} ${date.year}`,
    full: `${date.day} ${quadrums[date.quadrum]} ${date.year} · ${date.season}`, season: date.quadrum };
}

/** This small illustration is authored once. Only its phase and position change. */
export function siteHudLayout(): string {
  return `<div class="site-readout" aria-label="Heure, date et conditions extérieures">
    <div class="site-conditions">
      <div id="weather" class="biome-label" data-weather="clear"><span class="site-readout-icon" aria-hidden="true"></span><span class="site-readout-value">Ensoleillé</span></div>
      <div id="outdoor-temperature" class="biome-label"><span class="site-readout-value">— °C</span><svg class="site-thermometer" viewBox="0 0 32 54" aria-hidden="true" focusable="false"><path d="M11 8a5 5 0 0 1 10 0v27a10 10 0 1 1-10 0Z" fill="#fff7e9" stroke="#c7d4e6" stroke-width="1.5"/><path d="M16 11v27" stroke="#293344" stroke-width="5" stroke-linecap="round"/><rect id="site-thermometer-fill" x="14" y="20" width="4" height="17" rx="2" fill="currentColor"/><circle cx="16" cy="43" r="6" fill="currentColor"/><path d="M25 12h4m-4 9h4m-4 9h4" stroke="#aebdd2" stroke-width="1.5" stroke-linecap="round"/></svg></div>
    </div>
    <div id="site-condition" class="site-condition" hidden></div>
    <div class="site-civil-time">
      <div id="clock" aria-label="Heure locale">00:00</div>
      <div class="site-calendar"><div class="site-calendar-icons"><span id="site-season" class="site-season" aria-label="Saison"></span><span class="site-calendar-page" aria-hidden="true"><span id="calendar-day">1</span></span></div><div id="day">avrimai 5500</div></div>
    </div>
    <div id="site-sky" class="site-sky" data-phase="day" data-weather="clear" aria-hidden="true">
      <svg viewBox="0 0 280 115" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path class="site-sky-arc" d="M18 94A122 72 0 0 1 262 94" fill="none" stroke="#6f7b8e" stroke-width="1.3" stroke-dasharray="2 5"/>
        <path d="M18 90v8m122-79v6m122 65v8" stroke="#d4dbe4" stroke-width="1.2" stroke-linecap="round"/>
        <g class="site-stars" fill="#fff7e9"><circle cx="71" cy="61" r="1"/><circle cx="112" cy="43" r="1.3"/><circle cx="153" cy="59" r="1"/><circle cx="212" cy="73" r="1.3"/></g>
        <g id="site-celestial" transform="translate(140 22)"><g class="site-sun" stroke="#ffc23c" stroke-width="2" stroke-linecap="round"><circle r="8" fill="#ffc23c"/><path d="M0-14v3M0 11v3M-14 0h3M11 0h3M-10-10l2 2M8 8l2 2M-10 10l2-2M8-8l2-2"/></g><path class="site-moon" d="M4-9A10 10 0 1 0 9 4A9 9 0 0 1 4-9Z" fill="#fff5cd" stroke="#b4c4dd" stroke-width="1.1"/></g>
        <g id="site-weather-on-arc" transform="translate(221 46)">
          <path class="site-weather-clouds" d="M-12 5c-8 0-9-11-1-13 2-10 15-11 19-3 10-2 16 15 5 16Z" fill="#e0e9f2" stroke="#65748b" stroke-width="1.5"/>
          <g class="site-weather-rain" stroke="#83cfff" stroke-width="2" stroke-linecap="round"><path d="m-9 11-3 7m12-7-3 7m12-7-3 7"/></g>
          <g class="site-weather-snow" fill="#d7f2ff"><circle cx="-9" cy="12" r="2"/><circle cx="2" cy="16" r="2"/><circle cx="12" cy="11" r="2"/></g>
          <g class="site-weather-fog" stroke="#c3d1da" stroke-width="2" stroke-linecap="round"><path d="M-16 11h31M-12 17h25"/></g>
          <path class="site-weather-lightning" d="m2 1-9 12h7l-3 10 13-15H3l5-7Z" fill="#ffc23c" stroke="#263449" stroke-width="1"/>
        </g>
        <g id="site-wind-on-arc" transform="translate(54 43)" fill="none" stroke="#b6d6e8" stroke-width="1.7" stroke-linecap="round"><path class="site-wind-light" d="M-15 0H7c8 0 8-8 2-8"/><path class="site-wind-steady" d="M-9 6h17c7 0 7 8 1 8"/><path class="site-wind-strong" d="M-14-6H0c6 0 6-7 1-7"/></g>
        <text id="site-sky-start" class="site-sky-hour" x="18" y="112" text-anchor="middle">06h</text><text id="site-sky-end" class="site-sky-hour" x="262" y="112" text-anchor="middle">18h</text>
      </svg>
    </div>
    <div id="biome-current" class="biome-label site-biome"></div>
  </div>`;
}

function seasonUrl(index:number):string {
  const id=['season-spring','season-summer','season-autumn','season-winter'][index]!;
  return `url("${pictoDataUrl(id)}")`;
}

/** Cache references once. Presentation changes are applied at minute/condition
 * boundaries, with no observer, timer, frame animation or game-state writes. */
export function createSiteHud(root: HTMLElement): { update(world: World, temperature: number, condition?: string): void } {
  root.querySelector<HTMLElement>('.time-panel')!.classList.add('site-hud-panel');
  const weather = root.querySelector<HTMLElement>('#weather')!;
  const weatherValue = weather.querySelector<HTMLElement>('.site-readout-value')!;
  const temperatureValue = root.querySelector<HTMLElement>('#outdoor-temperature .site-readout-value')!;
  const temperatureRoot = root.querySelector<HTMLElement>('#outdoor-temperature')!;
  const thermometerFill = root.querySelector<SVGRectElement>('#site-thermometer-fill')!;
  const conditionValue = root.querySelector<HTMLElement>('#site-condition')!;
  const clock = root.querySelector<HTMLElement>('#clock')!;
  const calendarDay = root.querySelector<HTMLElement>('#calendar-day')!;
  const day = root.querySelector<HTMLElement>('#day')!;
  const calendar = root.querySelector<HTMLElement>('.site-calendar')!;
  const season = root.querySelector<HTMLElement>('#site-season')!;
  const sky = root.querySelector<HTMLElement>('#site-sky')!;
  const celestial = root.querySelector<SVGGElement>('#site-celestial')!;
  const weatherOnArc = root.querySelector<SVGGElement>('#site-weather-on-arc')!;
  const windOnArc = root.querySelector<SVGGElement>('#site-wind-on-arc')!;
  const skyStart = root.querySelector<SVGTextElement>('#site-sky-start')!;
  const skyEnd = root.querySelector<SVGTextElement>('#site-sky-end')!;
  const icons = seasons.map((_season, index) => seasonUrl(index));
  let previousMinute = -1, previousDate = '', previousWeather: WeatherKind | undefined, previousTemperature = '', previousCondition = '', previousWeatherLabel = '', previousTemperatureBand = '';
  return { update(world, temperature, condition = '') {
    const civil = calendarTick(world), minute = Math.floor((civil % TICKS_PER_DAY) * 1440 / TICKS_PER_DAY);
    if (minute !== previousMinute) {
      previousMinute = minute;
      clock.textContent = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const positions = siteSkyPosition(minute);
      sky.dataset.phase = positions.phase;
      const transform = (position: { x: number; y: number }) => `translate(${position.x.toFixed(2)} ${position.y.toFixed(2)})`;
      celestial.setAttribute('transform', transform(positions.celestial));
      weatherOnArc.setAttribute('transform', transform(positions.weather));
      windOnArc.setAttribute('transform', transform(positions.wind));
      skyStart.textContent = positions.phase === 'day' ? '06h' : '18h';
      skyEnd.textContent = positions.phase === 'day' ? '18h' : '06h';
      const wind = windIntensity(world);
      sky.dataset.wind = !world.wind ? 'none' : wind < .5 ? 'light' : wind < 1.1 ? 'steady' : 'strong';
    }
    const date = siteHudDate(world);
    if (date.full !== previousDate) {
      previousDate = date.full;
      calendarDay.textContent = String(date.day); day.textContent = date.label;
      calendar.title = date.full; calendar.setAttribute('aria-label', date.full);
      season.hidden = date.season === undefined;
      if (date.season !== undefined) { season.style.backgroundImage = icons[date.season]!; season.title = seasons[date.season]!; season.setAttribute('aria-label', seasons[date.season]!); }
    }
    const kind = world.weather ? perceivedWeather(world) : 'clear';
    const weatherLabel = kind === 'clear' && sky.dataset.phase === 'night' ? 'Ciel dégagé' : WEATHER[kind].label;
    if (kind !== previousWeather || condition !== previousCondition || weatherLabel !== previousWeatherLabel) {
      previousWeather = kind; previousCondition = condition; previousWeatherLabel = weatherLabel;
      weather.dataset.weather = kind; sky.dataset.weather = kind;
      weatherValue.textContent = weatherLabel;
      weather.title = [weatherLabel, condition].filter(Boolean).join(' · ');
      conditionValue.textContent = condition; conditionValue.hidden = condition === '';
      sky.dataset.eclipse = String(condition.includes('Éclipse'));
    }
    const formattedTemperature = Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C` : '— °C';
    const appearance = temperaturePresentation(temperature);
    if (formattedTemperature !== previousTemperature || appearance.band !== previousTemperatureBand) {
      previousTemperature = formattedTemperature; temperatureValue.textContent = formattedTemperature;
      previousTemperatureBand = appearance.band;
      temperatureRoot.title = `Température extérieure : ${formattedTemperature}`;
      temperatureRoot.dataset.temperatureBand = appearance.band;
      temperatureRoot.style.setProperty('--temperature-color', appearance.color);
      thermometerFill.setAttribute('height', String(appearance.fill));
      thermometerFill.setAttribute('y', String(37 - appearance.fill));
    }
  } };
}
