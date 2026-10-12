/**
 * Lintasan piringan CD dari rak ke slot TV dan sebaliknya, sebagai keyframe Web Animations.
 * Elemen yang diterbangkan diletakkan `position: fixed` di kotak asalnya, lalu transform-nya
 * membawanya ke slot: naik sedikit seperti diangkat, miring sampai tinggal garis tipis, lalu
 * masuk ke slot.
 */

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

const center = (box: Box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 })

/** Skala piringan supaya garis tipisnya selebar mulut slot. */
export function slotScale(disc: Box, slot: Box): number {
  return Math.min(1, (slot.width * 0.9) / disc.width)
}

function transform(x: number, y: number, tilt: number, scale: number) {
  return `perspective(900px) translate(${round(x)}px, ${round(y)}px) rotateX(${tilt}deg) scale(${round(scale, 3)})`
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits))

/** Dari kotak piringan `from` (posisinya di layar sekarang) sampai tertelan slot TV. */
export function insertKeyframes(from: Box, slot: Box): Keyframe[] {
  const a = center(from)
  const b = center(slot)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const scale = slotScale(from, slot)
  // Piringan yang hampir tegak lurus tingginya tinggal beberapa px; berhenti tepat di atas slot.
  const above = dy - 14
  return [
    { offset: 0, transform: transform(0, 0, 0, 1), opacity: 1 },
    {
      offset: 0.2,
      transform: transform(dx * 0.1, dy * 0.1 - 34, 24, 1.07),
      opacity: 1,
      easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
    },
    { offset: 0.66, transform: transform(dx, above, 80, scale), opacity: 1 },
    { offset: 0.8, transform: transform(dx, dy - 4, 86, scale), opacity: 1, easing: 'ease-in' },
    { offset: 1, transform: transform(dx, dy + 12, 88, scale * 0.96), opacity: 0 },
  ]
}

/** Kebalikan `insertKeyframes`: keluar dari slot lalu kembali ke kotak `to` di rak. */
export function ejectKeyframes(slot: Box, to: Box): Keyframe[] {
  return insertKeyframes(to, slot)
    .map((frame) => ({ ...frame, offset: 1 - (frame.offset as number) }))
    .reverse()
    .map(({ easing: _easing, ...frame }) => frame)
}

/** Kotak `box` digeser supaya titik `point` (jari atau kursor) tetap di tempat yang sama. */
export function followPointer(
  box: Box,
  grab: { x: number; y: number },
  point: { x: number; y: number },
): Box {
  return { ...box, left: point.x - grab.x, top: point.y - grab.y }
}

/** Titik ada di dalam kotak, dengan kelonggaran `margin` px. */
export function inside(point: { x: number; y: number }, box: Box, margin = 0): boolean {
  return (
    point.x >= box.left - margin &&
    point.x <= box.left + box.width + margin &&
    point.y >= box.top - margin &&
    point.y <= box.top + box.height + margin
  )
}
