/**
 * Surat: kartu ucapan di atas meja, ditulis baris demi baris, lalu masuk amplop dan dioper.
 * Posisi pointer dari kiri ke kanan memajukan ceritanya lewat satu pegas: tulis, masukkan,
 * oper. Saat diam kartunya setengah tertulis dan pulpennya berdiri di ujung baris yang sedang
 * ditulis. Angka slider: seberapa jauh amplopnya dioper.
 */
import { HL } from './kernel'

const {
  Cam,
  clamp,
  facing,
  fit,
  hull,
  lerp,
  open,
  poly,
  prism,
  proj,
  put,
  rings,
  seg,
  solid,
  spring,
  stepS,
  mk,
  place,
  flatDot,
  pointer,
  register,
  disposer,
  rad,
} = HL

const DESK = [-8, -10, 150, 84],
  CARD = [6, 30, 66, 76],
  ENV = [80, -2, 142, 46]
const LINES = [
    [42, 44],
    [52, 34],
    [62, 40],
  ],
  LX = 14,
  CT = 1.4,
  ET = 3,
  FLAP = 24
const REST = 0.28,
  PEN = 46,
  PR = 2.3
// Tiap baris kecuali yang terakhir: 65% jatahnya untuk menulis, sisanya pulpen terangkat dan
// kembali ke awal baris berikutnya, jadi pulpennya tidak pernah melompat saat ganti baris.
const WRITE = 0.65,
  LIFT = 6
const ease = (t) => t * t * (3 - 2 * t)
const norm = (v) => {
  const l = Math.hypot(...v)
  return v.map((c) => c / l)
}
const UP = norm([0.42, -0.5, 0.78]),
  DOWN = norm([0.62, -0.78, 0.06])

/** A ring turned by `ang` degrees round (cx, cy) and moved by (dx, dy): the envelope as it is passed. */
function spin(ring, cx, cy, ang, dx, dy) {
  const c = Math.cos(rad(ang)),
    s = Math.sin(rad(ang))
  return ring.map((q) => ({
    u: cx + dx + (q.u - cx) * c - (q.v - cy) * s,
    v: cy + dy + (q.u - cx) * s + (q.v - cy) * c,
    nu: q.nu * c - q.nv * s,
    nv: q.nu * s + q.nv * c,
  }))
}

/** The pen, a round bar from its tip along `d`: its outline, a grip band and the cap seam. */
function pen(P, tip, d) {
  const e1 = norm(Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [-d[1], d[0], 0])
  const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]]
  const ring = (t, r = PR) =>
    Array.from({ length: 16 }, (_, k) => {
      const a = (k / 16) * Math.PI * 2,
        cs = Math.cos(a) * r,
        sn = Math.sin(a) * r
      return P(...tip.map((c, i) => c + d[i] * t + e1[i] * cs + e2[i] * sn))
    })
  // Lipatan: busur 90° di sisi bawah cincin. Sudut terbawahnya dihitung langsung (proyeksinya
  // linear di cos dan sin), bukan dipilih dari 16 titik cincin, jadi lipatannya tidak meloncat satu
  // ruas saat pulpennya miring.
  const half = (t) => {
    const at = (cs, sn) => P(...tip.map((c, i) => c + d[i] * t + e1[i] * cs + e2[i] * sn))
    const o = at(0, 0)[1],
      lo = Math.atan2(at(0, PR)[1] - o, at(PR, 0)[1] - o)
    return [-2, -1, 0, 1, 2].map((k) => {
      const a = lo + (k * Math.PI) / 8
      return at(Math.cos(a) * PR, Math.sin(a) * PR)
    })
  }
  return {
    sil: poly(hull([P(...tip), ...ring(7), ...ring(PEN)])),
    crease: open(half(13)) + open(half(PEN - 9)),
  }
}

function mount({ stage, svg, read }, value) {
  const bag = disposer()
  let reach = value
  const C = Cam(45, 0.5, 1.6)
  fit(
    C,
    [
      [DESK[0], DESK[1], -5],
      [DESK[2], DESK[3], -5],
      [DESK[2], DESK[1], -5],
      [DESK[0], DESK[3], -5],
      [36, 53, 34],
      [60, 20, PEN * UP[2]],
      [ENV[2] + 30, ENV[1] - 14, 22],
      [111, ENV[3], FLAP + ET],
    ],
    200,
    168,
  )
  const P = proj(C),
    front = facing(C)

  const g = mk('g', {}, svg)
  const [dr, di] = rings(...DESK, 10, 2.2)
  put(solid(g), prism(P, front, dr, di, -5, 0))

  const card = mk('g', {}, g),
    cardEl = solid(card),
    rules = LINES.map(() => mk('path', { class: 'nf' }, card))
  const penG = mk('g', {}, g),
    penEl = solid(penG),
    tip = flatDot(penG, C, 0.8, 'dot')
  const env = mk('g', {}, g),
    envEl = solid(env)
  const stamp = mk('path', { class: 'sil' }, env),
    stampIn = mk('path', { class: 'nf dash' }, env)
  const flap = mk('path', { class: 'sil' }, g)

  // Satu pegas menggerakkan cerita lima tahap. Dengan kekakuan bawaan (k 100), pointer yang pergi dari
  // ujung kanan memutar mundur seluruh ceritanya dalam kurang dari setengah detik dan tutup amplopnya
  // menyentak; pegas teredam kritis yang sedikit lebih lunak memutarnya dengan tenang.
  const p = spring(REST, { k: 60, c: 15.5, eps: 0.002 })
  let drawn = NaN,
    painted = ''

  function draw(v) {
    const w = clamp(v / 0.5, 0, 1) * LINES.length
    const q = ease(clamp((v - 0.5) / 0.25, 0, 1)),
      s = clamp((v - 0.75) / 0.25, 0, 1)
    // Tutupnya menutup di 60% pertama tahap oper, amplopnya mulai dioper di separuh kedua: rentang
    // yang lebar dan bertumpuk ini membuat lipatannya tidak menyentak saat pointer bergerak cepat.
    const fold = ease(clamp(s / 0.6, 0, 1)) * Math.PI,
      go = ease(clamp((s - 0.4) / 0.6, 0, 1))
    const [ox, oy, oz, yaw] = [go * reach, -go * reach * 0.5, go * reach * 0.7, -14 * go]
    const ecx = (ENV[0] + ENV[2]) / 2,
      ecy = (ENV[1] + ENV[3]) / 2

    // Kartu: dari meja, melengkung naik, lalu turun ke dalam amplop.
    const cx = lerp(0, ecx - (CARD[0] + CARD[2]) / 2, q),
      cy = lerp(0, ecy - (CARD[1] + CARD[3]) / 2, q)
    // Di dalam amplop kartunya ikut dioper, tertutup pelat amplop.
    const inside = q >= 1,
      cz = inside ? oz + 0.6 : Math.sin(Math.PI * q) * 30
    const cardRings = rings(CARD[0] + cx, CARD[1] + cy, CARD[2] + cx, CARD[3] + cy, 2.4, 1)
    const [cr, ci] = inside ? cardRings.map((r) => spin(r, ecx, ecy, yaw, ox, oy)) : cardRings
    put(cardEl, prism(P, front, cr, ci, cz, cz + CT))
    const k = Math.min(LINES.length - 1, Math.floor(w))
    const last = LINES.length - 1
    const written = (i) => clamp((w - i) / (i < last ? WRITE : 1), 0, 1)
    LINES.forEach(([y, len], i) => {
      const f = inside ? 0 : written(i)
      rules[i].setAttribute(
        'd',
        f > 0 ? seg(P(LX + cx, y + cy, cz + CT), P(LX + cx + len * f, y + cy, cz + CT)) : '',
      )
      rules[i].classList.toggle('hi', v < 0.5 && i === k)
    })

    // Pulpen: berdiri di ujung baris, terangkat ke awal baris berikutnya, lalu diletakkan di meja
    // saat kartunya diambil.
    const u = clamp(w - k, 0, 1)
    let px = LX + LINES[k][1] * written(k),
      py = LINES[k][0],
      lift = 0
    if (k < last && u > WRITE) {
      const r = ease((u - WRITE) / (1 - WRITE))
      px = lerp(LX + LINES[k][1], LX, r)
      py = lerp(LINES[k][0], LINES[k + 1][0], r)
      lift = Math.sin(Math.PI * r) * LIFT
    }
    const at = [lerp(px, 18, q), lerp(py, 86, q), lerp(CT + lift, PR, q)]
    put(penEl, pen(P, at, norm(UP.map((c, i) => lerp(c, DOWN[i], q)))))
    place(tip, P(...at))
    tip.setAttribute('class', v < 0.5 ? 'dot' : 'dot off')

    // Amplop: diputar sedikit dan diangkat ke kanan saat dioper, bersama perangko dan tutupnya.
    const [er, ei] = rings(...ENV, 3, 1.4).map((r) => spin(r, ecx, ecy, yaw, ox, oy))
    put(envEl, prism(P, front, er, ei, oz, oz + ET))
    const turn = (x, y, z) => {
      const [r] = spin([{ u: x, v: y, nu: 0, nv: 0 }], ecx, ecy, yaw, ox, oy)
      return P(r.u, r.v, z)
    }
    const sq = (a, b) => [
      [ENV[2] - a, ENV[1] + b],
      [ENV[2] - b, ENV[1] + b],
      [ENV[2] - b, ENV[1] + a],
      [ENV[2] - a, ENV[1] + a],
    ]
    stamp.setAttribute('d', poly(sq(17, 4).map(([x, y]) => turn(x, y, oz + ET))))
    stampIn.setAttribute('d', poly(sq(15, 6).map(([x, y]) => turn(x, y, oz + ET))))
    envEl.sil.classList.toggle('hi', v >= 0.75)
    cardEl.sil.classList.toggle('hi', v >= 0.5 && v < 0.75)

    // Tutup: terbuka rata di meja, berdiri, lalu menutup di atas amplop.
    const top = oz + ET,
      flapAt = (x, d) => turn(x, ENV[3] + d * Math.cos(fold), top + d * Math.sin(fold))
    flap.setAttribute(
      'd',
      poly([
        flapAt(ENV[0] + 1.5, 0),
        flapAt(ecx - 5, FLAP - 2.5),
        flapAt(ecx, FLAP),
        flapAt(ecx + 5, FLAP - 2.5),
        flapAt(ENV[2] - 1.5, 0),
      ]),
    )

    // Urutan cat: kartu di atas amplop selama melayang; pulpen di atas kartu selama di meja.
    const order = cz > top + 0.5 ? 'pec' : 'cpe'
    if (order !== painted) {
      painted = order
      for (const ch of order) flap.before({ p: penG, c: card, e: env }[ch])
    }
  }

  const B = register(stage, (dt) => {
    const moving = stepS(p, dt)
    if (p.x !== drawn) {
      drawn = p.x
      draw(p.x)
    }
    return moving
  })
  bag.add(B.unregister)

  const caption = (v) =>
    v < 0.5 ? `baris ${Math.min(3, Math.floor((v / 0.5) * 3) + 1)}` : v < 0.75 ? 'masuk' : 'oper'
  bag.add(
    pointer(stage, {
      move: ([x]) => {
        p.t = clamp((x - 80) / 240, 0, 1)
        read.textContent = caption(p.t)
        B.wake()
      },
      leave: () => {
        p.t = REST
        read.textContent = 'rest'
        B.wake()
      },
    }),
  )
  bag.add(() => svg.replaceChildren())

  return {
    set: (v) => {
      reach = v
      drawn = NaN
      B.wake()
    },
    destroy: bag.dispose,
  }
}

export default {
  label: 'Kartu surat ditulis baris demi baris, dimasukkan ke amplop, lalu dioper',
  rest: 'rest',
  name: 'surat',
  means:
    'Kartu ditulis baris demi baris, masuk amplop, lalu dioper saat pointer bergerak ke kanan.',
  rules: [1, 5, 8, 9],
  range: [14, 24, 34],
  tour: [[190, 160], [255, 160], [320, 160], null],
  mount,
}
