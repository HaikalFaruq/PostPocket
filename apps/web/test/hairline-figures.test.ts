import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { HairlineFigure } from '../app/utils/hairline/figure'
import { HL } from '../app/utils/hairline/kernel'
import booth from '../app/utils/hairline/booth'
import pocket from '../app/utils/hairline/pocket'
import surat from '../app/utils/hairline/surat'

// Ketiga figur Beranda dijalankan tanpa browser: DOM tiruan secukupnya, jam tiruan, dan antrean
// requestAnimationFrame yang dijalankan tangan. Yang diuji: tur otomatisnya sampai di tiap
// pemberhentian, tidak ada angka yang rusak (NaN), putarannya berhenti setelah tenang, dan
// figur yang dihapus tidak meninggalkan apa pun.

type Listener = (event: Record<string, unknown>) => void

class FakeElement {
  attrs: Record<string, string> = {}
  children: FakeElement[] = []
  parent: FakeElement | null = null
  classes = new Set<string>()
  listeners: Record<string, Listener[]> = {}
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: unknown) {
    if (name === 'class') this.classes = new Set(String(value).split(/\s+/).filter(Boolean))
    else this.attrs[name] = String(value)
  }
  get classList() {
    return {
      toggle: (name: string, on = !this.classes.has(name)) => {
        if (on) this.classes.add(name)
        else this.classes.delete(name)
        return on
      },
    }
  }
  appendChild(child: FakeElement) {
    child.remove()
    child.parent = this
    this.children.push(child)
    return child
  }
  append(child: FakeElement) {
    this.appendChild(child)
  }
  before(node: FakeElement) {
    node.remove()
    const parent = this.parent!
    parent.children.splice(parent.children.indexOf(this), 0, node)
    node.parent = parent
  }
  remove() {
    if (!this.parent) return
    this.parent.children.splice(this.parent.children.indexOf(this), 1)
    this.parent = null
  }
  replaceChildren() {
    for (const child of this.children) child.parent = null
    this.children = []
  }
  addEventListener(type: string, fn: Listener) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((other) => other !== fn)
  }
  contains(node: FakeElement | null): boolean {
    for (let at = node; at; at = at.parent) if (at === this) return true
    return false
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 400, height: 320 }
  }
  get ownerDocument() {
    return fakeDocument
  }
  fire(type: string, event: Record<string, unknown>) {
    for (const fn of this.listeners[type] ?? []) fn(event)
  }
  /** Atribut yang berisi angka rusak, di elemen ini dan semua anaknya. */
  broken(): number {
    const own = Object.values(this.attrs).filter((value) => /NaN|Infinity|undefined/.test(value))
    return own.length + this.children.reduce((sum, child) => sum + child.broken(), 0)
  }
}

const fakeDocument = {
  createElementNS: (_ns: string, tag: string) => new FakeElement(tag),
  activeElement: null,
}

let now = 1000
let frames: [number, (time: number) => void][] = []
let frameId = 0
let timers: { at: number; fn: () => void }[] = []
const observers: { cb: (entries: { target: unknown; isIntersecting: boolean }[]) => void }[] = []

beforeAll(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('document', fakeDocument)
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms = 0) => timers.push({ at: now + ms, fn }),
  })
  vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => {
    frames.push([++frameId, fn])
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames = frames.filter(([other]) => other !== id)
  })
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(readonly cb: (typeof observers)[number]['cb']) {
        observers.push(this)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Majukan jam `ms` milidetik, 60 frame per detik, sambil memeriksa tiap frame. */
function pump(ms: number, check?: () => void) {
  const end = now + ms
  while (now < end) {
    now += 1000 / 60
    const due = timers.filter((timer) => timer.at <= now)
    timers = timers.filter((timer) => timer.at > now)
    for (const timer of due) timer.fn()
    const queued = frames
    frames = []
    for (const [, fn] of queued) fn(now)
    check?.()
  }
}

function start(figure: HairlineFigure) {
  const stage = new FakeElement('div')
  const svg = new FakeElement('svg')
  stage.append(svg)
  const reads: string[] = []
  const read = {
    get textContent() {
      return reads.at(-1) ?? null
    },
    set textContent(value: string | null) {
      if (value !== null && reads.at(-1) !== value) reads.push(value)
    },
  }
  read.textContent = figure.rest
  const parts = { stage, svg, read } as unknown as Parameters<HairlineFigure['mount']>[0]
  const tour = HL.tour(stage, figure.tour ?? HL.LAP)
  const handle = figure.mount(parts, figure.range[1]!)
  // Panggungnya terlihat, jadi putarannya boleh berjalan.
  for (const observer of observers) observer.cb([{ target: stage, isIntersecting: true }])
  return { stage, svg, reads, tour, handle }
}

const cases: [HairlineFigure, string[]][] = [
  [surat, ['masuk', 'oper', 'rest']],
  [pocket, ['kantong 1', 'kantong 3', 'kantong 2', 'rest']],
  [booth, ['foto 1', 'foto 3', 'foto 4', 'rest']],
]

describe.each(cases)('figur %s', (figure, stops) => {
  it('menjalankan turnya sendiri tanpa angka rusak, lalu kembali diam', () => {
    const { svg, reads, tour, handle } = start(figure)
    let broken = 0
    pump(20_000, () => (broken += svg.broken()))
    expect(broken).toBe(0)
    for (const caption of stops) expect(reads).toContain(caption)
    tour.stop()
    handle.destroy()
  })

  it('berhenti meminta frame setelah tenang, dan bersih setelah dihapus', () => {
    const { stage, svg, reads, tour, handle } = start(figure)
    // Tangan sungguhan mengambil alih dari tur, lalu diam di satu titik.
    stage.fire('pointermove', { clientX: 200, clientY: 160, pointerType: 'mouse' })
    pump(4000)
    expect(frames).toHaveLength(0)
    stage.fire('pointerleave', { pointerType: 'mouse' })
    pump(50)
    expect(reads.at(-1)).toBe('rest')

    tour.stop()
    handle.destroy()
    pump(100)
    expect(frames).toHaveLength(0)
    expect(svg.children).toHaveLength(0)
    const left = Object.values(stage.listeners).filter((list) => list.length)
    expect(left).toHaveLength(0)
  })
})
