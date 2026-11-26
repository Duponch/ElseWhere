import {rasterClockHour,type ClockHour} from './native-clock-ink';

self.onmessage=(event:MessageEvent<ClockHour>)=>{
  const sheet=rasterClockHour(event.data);
  self.postMessage(sheet,{transfer:[sheet.bitmap]});
};
