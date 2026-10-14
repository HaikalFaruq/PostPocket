/**
 * Figur garis isometrik di atas mesin Hairline (lisensi MIT, lihat docs/assets.md), dalam bentuk
 * yang ditulis skill hairline-create: menggambar ke `svg`, menjawab pointer di `stage`, dan
 * menulis keterangan singkatnya ke `read`.
 */
export interface HairlineFigure {
  name: string
  /** Nama yang dibacakan pembaca layar. */
  label: string
  /** Keterangan saat diam. */
  rest: string
  /** Satu kalimat tentang apa yang ditunjukkan figurnya. */
  means: string
  /** Satu angka figur di intensitas 0, 0,5, dan 1. Yang tengah dipakai. */
  range: number[]
  /** Titik viewBox yang dikunjungi "tangan" tak terlihat saat figurnya bergerak sendiri; `null` berarti pergi. */
  tour: (number[] | null)[] | null
  mount: (
    parts: { stage: HTMLElement; svg: SVGSVGElement; read: { textContent: string | null } },
    value: number,
  ) => { set: (value: number) => void; destroy: () => void }
}
