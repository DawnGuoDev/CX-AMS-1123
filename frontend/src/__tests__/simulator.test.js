import { describe, expect, it, vi } from 'vitest'
import { createSimulation, scenarios } from '../simulator'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function manualClock() {
  const timers = []
  return {
    schedule: (fn) => { timers.push(fn); return timers.length },
    cancel: (id) => {
      if (id) timers[id - 1] = null
      // The component-level default is clearTimeout; the real scheduler must also be neutralized.
      clearTimeout(id)
    },
    /** Pops the next pending tick (without running it). */
    next() {
      while (timers.length && !timers[0]) timers.shift()
      const fn = timers.shift()
      if (!fn) throw new Error('no scheduled tick')
      return fn
    },
    /** Runs one tick and lets the simulator schedule the following one. */
    async runOne() {
      const fn = this.next()
      await fn()
      await flush()
    },
    pending: () => timers.filter(Boolean).length,
  }
}

function harness(overrides = {}) {
  const clock = manualClock()
  const samples = []
  const finishes = []
  const sim = createSimulation({
    scenario: 'once',
    threshold: 80,
    rounds: 1,
    interval: 5,
    onSample: async (sample) => samples.push(sample),
    onFinish: (error) => finishes.push(error),
    schedule: clock.schedule,
    cancel: clock.cancel,
    ...overrides,
  })
  return { clock, samples, finishes, sim }
}

describe('simulation scenarios', () => {
  it('exposes the three documented scenarios', () => {
    expect(Object.keys(scenarios)).toEqual(['normal', 'once', 'repeated'])
    expect(scenarios.once.offsets).toHaveLength(5)
  })

  it('rejects invalid parameters before scheduling anything', () => {
    const base = { scenario: 'once', threshold: 80, rounds: 1, interval: 5, onSample: () => {}, onFinish: () => {} }
    expect(() => createSimulation({ ...base, scenario: 'unknown' })).toThrow('模拟参数无效')
    expect(() => createSimulation({ ...base, threshold: Number.NaN })).toThrow('模拟参数无效')
    expect(() => createSimulation({ ...base, rounds: 0 })).toThrow('模拟参数无效')
    expect(() => createSimulation({ ...base, rounds: 11 })).toThrow('模拟参数无效')
    expect(() => createSimulation({ ...base, interval: 0.5 })).toThrow('模拟参数无效')
    expect(() => createSimulation({ ...base, interval: 61 })).toThrow('模拟参数无效')
  })
})

describe('sampling sequence', () => {
  it('emits one crossing at the first above-threshold sample and one recovery', async () => {
    const { clock, samples, finishes, sim } = harness()
    sim.start()
    for (let i = 0; i < 5; i++) {
      await clock.runOne()
    }
    expect(samples.map(s => s.value)).toEqual([65, 75, 85, 88, 70])
    expect(samples.filter(s => s.crossing)).toHaveLength(1)
    expect(samples.find(s => s.crossing).index).toBe(3)
    expect(samples.filter(s => s.recovered)).toHaveLength(1)
    expect(samples.find(s => s.recovered).index).toBe(5)
    expect(finishes).toEqual([undefined])
    expect(clock.pending()).toBe(0)
  })

  it('never treats a sustained high sample as a new crossing', async () => {
    const { clock, samples, sim } = harness({ scenario: 'repeated', rounds: 1 })
    sim.start()
    for (let i = 0; i < scenarios.repeated.offsets.length; i++) {
      await clock.runOne()
    }
    expect(samples.map(s => s.value > 80)).toEqual([false, true, true, false, true, true, false])
    expect(samples.filter(s => s.crossing).map(s => s.index)).toEqual([2, 5])
    expect(samples.filter(s => s.recovered).map(s => s.index)).toEqual([4, 7])
  })

  it('waits for a pending submission before scheduling the next sample', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const { clock, samples, sim } = harness({
      onSample: async (sample) => { samples.push(sample); await gate },
    })
    sim.start()
    const firstTick = clock.next()()
    await flush()
    expect(samples).toHaveLength(1)
    expect(clock.pending()).toBe(0) // no next tick while the submission is in flight
    release()
    await firstTick
    await flush()
    expect(clock.pending()).toBe(1) // scheduled only after the sample settled
  })

  it('stops permanently and reports the error when a submission fails', async () => {
    const failure = new Error('network down')
    const { clock, samples, finishes, sim } = harness({
      onSample: async () => { throw failure },
    })
    sim.start()
    await clock.runOne()
    expect(samples).toHaveLength(0)
    expect(finishes).toEqual([failure])
    expect(clock.pending()).toBe(0)
  })
})

describe('pause / resume / stop', () => {
  it('pause cancels the pending timer and resume continues the sequence', async () => {
    const { clock, samples, finishes, sim } = harness()
    sim.start()
    sim.pause()
    expect(clock.pending()).toBe(0)
    sim.resume()
    await clock.runOne()
    expect(samples).toHaveLength(1)
    expect(finishes).toEqual([])
  })

  it('ignores resume while running and after stop', async () => {
    const { clock, samples, sim } = harness()
    sim.start()
    await clock.runOne()
    const before = samples.length
    sim.resume()
    expect(samples).toHaveLength(before)
    sim.stop()
    expect(clock.pending()).toBe(0)
    sim.resume()
    expect(samples).toHaveLength(before)
  })

  it('stop prevents further samples and completion callbacks', async () => {
    const { clock, samples, finishes, sim } = harness()
    sim.start()
    sim.stop()
    expect(clock.pending()).toBe(0)
    expect(samples).toHaveLength(0)
    expect(finishes).toHaveLength(0)
  })
})
