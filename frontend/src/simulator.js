export const scenarios = {
  normal: { label: '正常波动', offsets: [-15, -10, -5, -8, -10] },
  once: { label: '一次超温', offsets: [-15, -5, 5, 8, -10] },
  repeated: { label: '反复超温', offsets: [-15, 5, 8, -10, 6, 9, -10] },
}

// Serial sampling: a slow submission never creates concurrent or catch-up requests.
export function createSimulation({ scenario, threshold, rounds, interval, onSample, onFinish,
  schedule = setTimeout, cancel = clearTimeout }) {
  if (!scenarios[scenario] || !Number.isFinite(threshold) ||
      !Number.isInteger(rounds) || rounds < 1 || rounds > 10 ||
      !Number.isFinite(interval) || interval < 1 || interval > 60) throw new Error('模拟参数无效')
  const values = Array.from({ length: rounds }, () => scenarios[scenario].offsets).flat()
  let index = 0, above = false, stopped = false, paused = false, pending = false, timer
  function queue() {
    if (!stopped && !paused && !pending) timer = schedule(tick, interval * 1000)
  }
  async function tick() {
    if (stopped || paused || pending) return
    const value = threshold + values[index++], high = value > threshold
    const sample = { index, total: values.length, value, high, crossing: high && !above, recovered: !high && above }
    above = high
    pending = true
    try { await onSample(sample) }
    catch (error) { stopped = true; onFinish(error) }
    finally { pending = false }
    if (stopped) return
    if (index === values.length) { stopped = true; onFinish(); return }
    queue()
  }
  return {
    start: queue,
    pause() { paused = true; cancel(timer) },
    resume() { if (!paused || stopped) return; paused = false; queue() },
    stop() { stopped = true; cancel(timer) },
  }
}
