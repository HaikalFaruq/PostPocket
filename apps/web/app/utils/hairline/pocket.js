/**
 * Pocket: tiga kantong jajan dijepit di tali. Kantong di bawah pointer membuka mulutnya dan
 * fotonya naik keluar; kantong lain bergoyang menjauh, berurutan dari yang dipilih. Saat pointer
 * pergi fotonya turun lagi dan kantongnya tertutup: tersimpan. Saat diam, foto di kantong tengah
 * baru setengah masuk. Angka slider: jeda antarkantong, dalam ms.
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
  seg,
  solid,
  tdone,
  tset,
  tval,
  tween,
  mk,
  pointer,
  register,
  disposer,
  rad,
} = HL

const XS = [34, 80, 126],
  Y = 40,
  LINE0 = -4,
  LINE1 = 164,
  LZ = 94,
  SAG = 7
const W = 17,
  TOP = 7,
  BOT = 56,
  REST = [-6, 4, -3],
  PEEK = [0, 0.62, 0],
  LEAN = 9
const PW = 11,
  PH = 11
const lineZ = (x) => LZ - SAG * Math.sin((Math.PI * (x - LINE0)) / (LINE1 - LINE0))

// The pouch, flat in its own (u, depth) plane: rounded bottom, a tear notch on the right.
const POUCH = fillet(
  [
    [-W, TOP],
    [W, TOP],
    [W, TOP + 6],
    [W - 2, TOP + 7.5],
    [W, TOP + 9],
    [W, BOT],
    [-W, BOT],
  ],
  [1.4, 1.4, 0.4, 0.4, 0.4, 7, 7],
)
const CRIMP = Array.from({ length: 17 }, (_, k) => [-W + 1 + k * 2, TOP + (k % 2 ? 1.2 : 3)])

function mount({ stage, svg, read }, value) {
  const bag = disposer()
  let step = value
  const C = Cam(45, 0.5, 1.72)
  fit(
    C,
    [
      [LINE0 - 10, Y - 12, -5],
      [LINE1 + 10, Y + 12, -5],
      [LINE0, Y, LZ + 8],
      [LINE1, Y, LZ + 8],
      [XS[0], Y + 14, lineZ(XS[0]) - BOT],
      [XS[2], Y + 14, lineZ(XS[2]) - BOT],
      [XS[1], Y, LZ + 26],
    ],
    200,
    168,
  )
  const P = proj(C),
    front = facing(C)

  const g = mk('g', {}, svg)
  const [br, bi] = rings(LINE0 - 10, Y - 12, LINE1 + 10, Y + 12, 7, 2)
  put(solid(g), prism(P, front, br, bi, -5, 0))
  const post = (x) => {
    const [r, i] = rings(x - 3, Y - 3, x + 3, Y + 3, 1.6, 0.8)
    const s = solid(g)
    put(s, prism(P, front, r, i, 0, LZ + 6))
    return s
  }
  post(LINE0)
  const line = []
  for (let x = LINE0; x <= LINE1; x += 4) line.push(P(x, Y, lineZ(x)))
  mk('path', { d: open(line), class: 'nf sil' }, g)

  const packs = XS.map((cx, i) => {
    const grp = mk('g', {}, g)
    const back = mk('path', { class: 'lo' }, grp),
      photo = mk('path', { class: 'sil' }, grp)
    const pic = mk('path', { class: 'nf' }, grp),
      face = mk('path', { class: 'sil' }, grp)
    const crimp = mk('path', { class: 'nf' }, grp),
      seam = mk('path', { class: 'nf lo' }, grp)
    // Dua jepitan di sudut atas, jadi fotonya keluar di tengah mulut kantong.
    for (const u of [-12, 12]) {
      const z = lineZ(cx + u),
        [pr, pi] = rings(cx + u - 2.2, Y - 3.4, cx + u + 2.2, Y + 3.4, 1.1, 0.6)
      put(solid(grp), prism(P, front, pr, pi, z - TOP - 4, z + 4.5))
    }
    const zp = lineZ(cx)
    return {
      cx,
      zp,
      back,
      photo,
      pic,
      face,
      crimp,
      seam,
      lean: tween(REST[i]),
      up: tween(PEEK[i]),
      drawn: '',
    }
  })
  post(LINE1)

  /** Packet i at lean th (degrees, toward the viewer is positive), mouth opened by m, photo risen by r. */
  function draw(k, th, m, r) {
    const pk = packs[k],
      key = `${th.toFixed(2)} ${m.toFixed(3)} ${r.toFixed(3)}`
    if (key === pk.drawn) return
    pk.drawn = key
    const c = Math.cos(rad(th)),
      s = Math.sin(rad(th))
    const at =
      (f) =>
      ([u, d]) =>
        P(pk.cx + u, Y + f * c + d * s, pk.zp - d * c + f * s)
    pk.back.setAttribute('d', poly(POUCH.map(at(-3 - m))))
    pk.face.setAttribute('d', poly(POUCH.map(at(3 + 2.5 * m))))
    const lift = 44 * r,
      ph = [
        [-PW, 24 - lift],
        [PW, 24 - lift],
        [PW, 24 + 2 * PH - lift],
        [-PW, 24 + 2 * PH - lift],
      ]
    pk.photo.setAttribute('d', poly(ph.map(at(0))))
    const inner = [
      [-PW + 2.5, 26.5 - lift],
      [PW - 2.5, 26.5 - lift],
      [PW - 2.5, 24 + 2 * PH - 6 - lift],
      [-PW + 2.5, 24 + 2 * PH - 6 - lift],
    ]
    const hill = [
      [-PW + 2.5, 38 - lift],
      [-3, 31 - lift],
      [3, 35 - lift],
      [PW - 2.5, 29.5 - lift],
    ]
    pk.pic.setAttribute('d', poly(inner.map(at(0))) + open(hill.map(at(0))))
    pk.crimp.setAttribute('d', open(CRIMP.map(at(3 + 2.5 * m))))
    pk.seam.setAttribute(
      'd',
      seg(at(3 + 2.5 * m)([-W + 1, TOP + 5]), at(3 + 2.5 * m)([W - 1, TOP + 5])),
    )
  }

  let act = -1
  const B = register(stage, (_dt, now) => {
    let moving = false
    packs.forEach((pk, k) => {
      const m = tval(pk.up, now)
      draw(k, tval(pk.lean, now), clamp(m * 1.6, 0, 1), m)
      if (!tdone(pk.lean, now) || !tdone(pk.up, now)) moving = true
    })
    return moving
  })
  bag.add(B.unregister)

  function choose(a) {
    if (a === act) return
    const now = performance.now(),
      from = a >= 0 ? a : act
    act = a
    packs.forEach((pk, i) => {
      const delay = Math.abs(i - from) * step
      tset(pk.lean, a < 0 ? REST[i] : i === a ? LEAN : Math.sign(i - a) * -5, now, delay)
      tset(pk.up, a < 0 ? PEEK[i] : i === a ? 1 : 0, now, delay)
      pk.photo.classList.toggle('hi', a < 0 ? PEEK[i] > 0 : i === a)
    })
    read.textContent = a < 0 ? 'rest' : `kantong ${a + 1}`
    B.wake()
  }
  packs.forEach((pk, i) => pk.photo.classList.toggle('hi', PEEK[i] > 0))

  // Hit: the packet whose resting centre is nearest the pointer on screen, inside the row's band.
  const mids = packs.map((pk) => P(pk.cx, Y, pk.zp - (TOP + BOT) / 2))
  bag.add(
    pointer(stage, {
      move: ([x, y]) => {
        const near = mids.reduce(
          (b, q, i) => (Math.abs(q[0] - x) < Math.abs(mids[b][0] - x) ? i : b),
          0,
        )
        const inside = Math.abs(mids[near][0] - x) < 34 && Math.abs(mids[near][1] - y) < 70
        choose(inside ? near : -1)
      },
      leave: () => choose(-1),
    }),
  )
  bag.add(() => svg.replaceChildren())

  return {
    set: (v) => {
      step = v
    },
    destroy: bag.dispose,
  }
}

export default {
  label: 'Kantong jajan dijepit di tali: kantong yang disentuh membuka dan fotonya naik',
  rest: 'rest',
  name: 'pocket',
  means:
    'Kantong jajan dijepit di tali: yang di bawah pointer membuka dan fotonya naik, lalu tersimpan lagi.',
  rules: [1, 2, 5, 8],
  range: [20, 60, 110],
  tour: [[150, 150], [265, 205], [205, 178], null],
  mount,
}
