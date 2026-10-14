/**
 * Booth: bilik foto bertirai, dengan kaki orang di dalamnya terlihat di bawah tirai. Posisi
 * pointer dari kiri ke kanan menghitung jepretan: setiap jepretan baru lampunya berkilat, tirainya
 * bergoyang, dan strip foto turun satu bingkai dari celah di samping bilik. Saat diam dua bingkai
 * sudah keluar. Angka slider: seberapa jauh tirai bergoyang.
 */
import { HL } from './kernel'

const {
  Cam,
  clamp,
  facing,
  fillet,
  fit,
  open,
  poly,
  prism,
  proj,
  put,
  rings,
  solid,
  tdone,
  tset,
  tval,
  tween,
  spring,
  stepS,
  mk,
  pointer,
  register,
  disposer,
} = HL

const BOX = [6, 6, 76, 66],
  H = 116,
  LAMP = [22, 24, 60, 48],
  SHOTS = 4,
  REST = 2
const OPEN = [16, 66, 18, 104],
  FOLDS = [22, 30, 38, 46, 54, 61],
  HEM = 24,
  ROD = 101
const SLOT = [26, 46, 68],
  STRIP = [28, 44],
  FRAME = 15,
  FLASH = 420

function mount({ stage, svg, read }, value) {
  const bag = disposer()
  let swayBy = value
  const C = Cam(45, 0.5, 1.5)
  fit(
    C,
    [
      [-12, -12, -5],
      [112, 92, -5],
      [112, -12, -5],
      [-12, 92, -5],
      [BOX[0], BOX[1], H + 10],
      [BOX[2] + 1, STRIP[1], SLOT[2] - 4 - SHOTS * FRAME],
    ],
    200,
    166,
  )
  const P = proj(C),
    front = facing(C)

  const g = mk('g', {}, svg)
  const [pr, pi] = rings(-12, -12, 112, 92, 9, 2.2)
  put(solid(g), prism(P, front, pr, pi, -5, 0))
  const [cr, ci] = rings(...BOX, 7, 1.8)
  put(solid(g), prism(P, front, cr, ci, 0, H))
  const [lr, li] = rings(...LAMP, 4, 1.2)
  const lamp = solid(g)
  put(lamp, prism(P, front, lr, li, H, H + 9))

  // Muka depan (y = 66): bukaan berbingkai, batang tirai, lipatan tirai, dan kelimnya.
  const onFront = ([x, z]) => P(x, BOX[3] + 0.01, z),
    onSide = ([y, z]) => P(BOX[2] + 0.01, y, z)
  const [ox0, ox1, oz0, oz1] = OPEN
  mk(
    'path',
    {
      d: poly(
        fillet(
          [
            [ox0, oz0],
            [ox1, oz0],
            [ox1, oz1],
            [ox0, oz1],
          ],
          [1, 1, 3, 3],
        ).map(onFront),
      ),
      class: 'nf',
    },
    g,
  )
  mk(
    'path',
    {
      d: open(
        [
          [ox0 + 1, ROD],
          [ox1 - 1, ROD],
        ].map(onFront),
      ),
      class: 'nf',
    },
    g,
  )
  const folds = mk('path', { class: 'nf lo' }, g),
    hem = mk('path', { class: 'nf' }, g)

  // Kaki dan sepatu orang di dalam bilik, di bawah kelim tirai.
  for (const x of [33, 44]) {
    const [kr, ki] = rings(x, 58, x + 5, 63, 2, 0.8)
    put(solid(g), prism(P, front, kr, ki, 3, HEM - 1))
    const [sr, si] = rings(x - 1, 57, x + 6, 68, 2.4, 0.9)
    put(solid(g), prism(P, front, sr, si, 0, 3.2))
  }

  // Muka samping (x = 76): celah strip, lalu stripnya, yang turun bingkai demi bingkai.
  const [sy0, sy1, sz] = SLOT
  mk(
    'path',
    {
      d: poly(
        fillet(
          [
            [sy0, sz - 2],
            [sy1, sz - 2],
            [sy1, sz + 2],
            [sy0, sz + 2],
          ],
          [2, 2, 2, 2],
        ).map(onSide),
      ),
      class: 'nf',
    },
    g,
  )
  const strip = mk('path', { class: 'sil' }, g)
  const frames = Array.from({ length: SHOTS }, () => mk('path', { class: 'nf' }, g))

  const n = tween(REST),
    sway = spring(0.6),
    at = { shot: -1e9 }
  let target = REST,
    drawn = ''

  function draw(len, sw, flash) {
    const key = `${len.toFixed(3)} ${sw.toFixed(3)} ${flash.toFixed(2)}`
    if (key === drawn) return
    drawn = key
    const bend = (x, z) => [x + sw * swayBy * ((ROD - z) / (ROD - HEM)) ** 2, z]
    folds.setAttribute(
      'd',
      FOLDS.map((x) => open([ROD - 1, 80, 60, 40, HEM + 1].map((z) => onFront(bend(x, z))))).join(
        '',
      ),
    )
    hem.setAttribute(
      'd',
      open(
        Array.from({ length: 13 }, (_, k) =>
          onFront(bend(ox0 + 2 + k * 3.8, HEM + (k % 2 ? -0.8 : 0.8))),
        ),
      ),
    )
    const out = 4 + len * FRAME,
      [y0, y1] = STRIP
    strip.setAttribute(
      'd',
      poly(
        fillet(
          [
            [y0, sz],
            [y1, sz],
            [y1, sz - out],
            [y0, sz - out],
          ],
          [0, 0, 1.6, 1.6],
        ).map(([y, z]) => P(BOX[2] + 1, y, z)),
      ),
    )
    const newest = Math.ceil(len - 0.05) - 1
    frames.forEach((el, k) => {
      const top = sz - 4 - k * FRAME,
        shown = k < len - 0.05
      el.setAttribute(
        'd',
        shown
          ? poly(
              fillet(
                [
                  [y0 + 2, top],
                  [y1 - 2, top],
                  [y1 - 2, top - FRAME + 3],
                  [y0 + 2, top - FRAME + 3],
                ],
                [1, 1, 1, 1],
              ).map(([y, z]) => P(BOX[2] + 1.2, y, z)),
            )
          : '',
      )
      el.classList.toggle('hi', flash <= 0 && k === newest)
    })
    lamp.sil.classList.toggle('hi', flash > 0)
  }

  const B = register(stage, (dt, now) => {
    const flash = clamp(1 - (now - at.shot) / FLASH, 0, 1)
    const moving = stepS(sway, dt)
    draw(tval(n, now), sway.x, flash)
    return moving || !tdone(n, now) || flash > 0
  })
  bag.add(B.unregister)

  /** Takes the strip to k frames: every new frame is a shot, with a flash and the curtain moving. */
  function shoot(k) {
    if (k === target) return
    const now = performance.now()
    if (k > target) {
      at.shot = now
      sway.t = (k % 2 ? -1 : 1) * 0.9
    }
    target = k
    tset(n, k, now, k > tval(n, now) ? FLASH * 0.6 : 0)
    B.wake()
  }

  bag.add(
    pointer(stage, {
      move: ([x]) => {
        const k = Math.round(clamp((x - 110) / 200, 0, 1) * SHOTS)
        shoot(k)
        read.textContent = `foto ${k}`
      },
      leave: () => {
        shoot(REST)
        sway.t = 0.6
        read.textContent = 'rest'
        B.wake()
      },
    }),
  )
  bag.add(() => svg.replaceChildren())

  return {
    set: (v) => {
      swayBy = v
      drawn = ''
      B.wake()
    },
    destroy: bag.dispose,
  }
}

export default {
  label:
    'Bilik foto bertirai: tiap jepretan lampunya berkilat dan strip fotonya bertambah satu bingkai',
  rest: 'rest',
  name: 'booth',
  means:
    'Bilik foto dengan kaki di bawah tirai: tiap langkah ke kanan satu jepretan, satu kilat, satu bingkai.',
  rules: [1, 5, 8, 9],
  range: [1, 3, 5],
  tour: [[160, 160], [260, 160], [310, 160], null],
  mount,
}
