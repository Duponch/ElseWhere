// Optional CDP diagnosis for the real publication benchmark. Trace timestamps
// are microseconds on the Chromium monotonic clock. Performance marks link
// them to performance.now() and identify the exact renderer main thread.
const MARK = 'elsewhere-gc-trace-';
const GC = /^(?:MajorGC|MinorGC|V8[._ ]GC|MarkCompact|Scavenge)/;
const MAX_EVENTS = 100000;
const SAMPLE_INTERVAL = 1024 * 1024;
const round = n => Math.round(n * 1000) / 1000;

function coverage(start, end, events) {
  // Inputs are ordered by start. Union nested phases and trim to the window.
  let last = start, total = 0;
  for (const e of events) {
    if (e.start >= end) break;
    if (e.end <= last) continue;
    total += Math.min(end, e.end) - Math.max(last, e.start);
    last = Math.min(end, e.end);
    if (last === end) break;
  }
  return round(total);
}

function summarizeWindow(speed, run, events) {
  const start = events.find(e => e.name === MARK + 'start-' + speed);
  const stop = start && events.find(e => e.name === MARK + 'stop-' + speed && e.pid === start.pid && e.tid === start.tid && e.ts >= start.ts);
  if (!stop) return {warning: 'Missing matching start/stop marks on the same renderer thread'};
  const offset = start.ts - 1000 * run.gcMarkerMs;
  const clockErrorMs = round((stop.ts - offset) / 1000 - run.gcEndMarkerMs);
  const ranges = events.filter(e => e.pid === start.pid && e.tid === start.tid && e.ph === 'X' && GC.test(e.name) && e.dur > 0)
    .map(e => ({name:e.name, start:(e.ts-offset)/1000, end:(e.ts+e.dur-offset)/1000, durationMs:e.dur/1000, data:e.args?.usedHeapSizeBefore !== undefined ? e.args : undefined}))
    .filter(e => e.end > run.gcMarkerMs && e.start < run.gcEndMarkerMs).sort((a,b) => a.start-b.start);
  const top = run.frames.map((frame,index) => ({frame,index})).sort((a,b) => b.frame.dt-a.frame.dt).slice(0,10);
  const topFrames = top.map(({frame,index}) => {
    const observedStart = index ? run.frames[index-1].observationMs : run.gcFirstObservationMs;
    const end = frame.observationMs;
    // Older captures do not retain the previous observation for the first
    // kept frame. Its nominal RAF interval remains measurable.
    const nominal = coverage(frame.rafEndMs-frame.dt, frame.rafEndMs, ranges);
    if (!Number.isFinite(observedStart)) return {index,dtMs:round(frame.dt),nominalRafGcOverlapMs:nominal};
    const overlapping = ranges.filter(e => e.start < end && e.end > observedStart).sort((a,b) => b.durationMs-a.durationMs);
    const largest = overlapping[0], collection = overlapping.find(e => e.data);
    return {index, dtMs:round(frame.dt), observedIntervalMs:round(end-observedStart),
      gcOverlapMs:coverage(observedStart,end,ranges), nominalRafGcOverlapMs:nominal,
      largestGC:largest && {name:largest.name,durationMs:round(largest.durationMs)},
      collection:collection && {name:collection.name,durationMs:round(collection.durationMs),heapBeforeBytes:collection.data.usedHeapSizeBefore,heapAfterBytes:collection.data.usedHeapSizeAfter}};
  });
  return {markerPid:start.pid,markerTid:start.tid,clockErrorMs,mainGcMs:coverage(run.gcMarkerMs,run.gcEndMarkerMs,ranges),topFrames};
}

function heapSummary(profile) {
  const sites = new Map(); let bytes = 0;
  function visit(node) {
    if (node.selfSize) {
      const f = node.callFrame, name = f.functionName + '@' + f.url + ':' + (f.lineNumber+1) + ':' + (f.columnNumber+1);
      sites.set(name,(sites.get(name) ?? 0)+node.selfSize);
      bytes += node.selfSize;
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(profile.head);
  return {samplingIntervalBytes:SAMPLE_INTERVAL,samples:profile.samples.length,estimatedAllocatedBytes:bytes,
    topSites:[...sites].sort((a,b) => b[1]-a[1]).slice(0,20).map(([frame,bytes]) => ({frame,bytes})),
    note:'Main isolate, including warm-ups and objects already collected. Sampling estimates allocation churn, not retained or peak heap.'};
}

export function summarizeClientGc(report, trace, profile) {
  const warnings = [];
  if (trace.dataLossOccurred || trace.dropped) warnings.push('Trace incomplete. GC coverage is a lower bound and missing intervals cannot exclude GC.');
  if (trace.samplingError) warnings.push('Allocation sampling unavailable: ' + trace.samplingError);
  const windows = {};
  for (const [speed,run] of Object.entries(report)) {
    if (!run?.frames) continue;
    windows[speed] = summarizeWindow(speed,run,trace.events);
    if (windows[speed].warning) warnings.push(speed + ': ' + windows[speed].warning);
    else if (Math.abs(windows[speed].clockErrorMs) > 1) warnings.push(speed + ': end mark differs from RAF clock alignment by more than 1 ms');
  }
  return {allTraceEvents:trace.allTraceEvents,retainedEvents:trace.events.length,bufferHighWater:trace.bufferHighWater,
    dataLossOccurred:trace.dataLossOccurred,droppedEvents:trace.dropped,warnings,windows,heap:profile && heapSummary(profile)};
}

export async function startClientGc(context,page) {
  const session = await context.newCDPSession(page);
  const trace = {events:[],allTraceEvents:0,dropped:0,bufferHighWater:0,dataLossOccurred:false};
  session.on('Tracing.dataCollected',({value}) => {
    trace.allTraceEvents += value.length;
    for (const e of value) {
      if (e.name?.startsWith(MARK)) { trace.events.push(e); continue; }
      if (e.ph !== 'X' || !GC.test(e.name) || !(e.dur > 0)) continue;
      if (trace.events.length < MAX_EVENTS) trace.events.push(e); else trace.dropped++;
    }
  });
  session.on('Tracing.bufferUsage',({percentFull,value}) => { trace.bufferHighWater = Math.max(trace.bufferHighWater,percentFull ?? value ?? 0); });
  try {
    await session.send('Tracing.start',{traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:32768,
      includedCategories:['v8','disabled-by-default-v8.gc','blink.user_timing']},transferMode:'ReportEvents',bufferUsageReportingInterval:1000});
  } catch (error) { await session.detach(); throw error; }
  let sampling = false;
  try {
    await session.send('HeapProfiler.startSampling',{samplingInterval:SAMPLE_INTERVAL,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
    sampling = true;
  } catch (error) { trace.samplingError = String(error); }
  return async report => {
    let timer;
    try {
      const completed = new Promise((resolve,reject) => {
        session.once('Tracing.tracingComplete',resolve);
        timer = setTimeout(() => reject(Error('GC trace finalization exceeded 30 seconds')),30000);
      });
      const [,end] = await Promise.all([session.send('Tracing.end'),completed]);
      trace.dataLossOccurred = end.dataLossOccurred ?? false;
      let profile;
      if (sampling) {
        try { ({profile} = await session.send('HeapProfiler.stopSampling')); }
        catch (error) { trace.samplingError = String(error); }
      }
      return summarizeClientGc(report,trace,profile);
    } finally { clearTimeout(timer); await session.detach(); }
  };
}
