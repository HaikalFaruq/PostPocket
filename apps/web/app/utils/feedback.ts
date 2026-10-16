// Laporan dari pengguna: tombol "Lapor masalah" membuka kanal laporan (GitHub Issues, atau
// kanal lain lewat NUXT_PUBLIC_FEEDBACK_URL) dengan isi awal berisi data untuk melacak masalah.

/** Kanal bawaan. Repo-nya publik, jadi isi awalnya memperingatkan soal data pribadi. */
export const DEFAULT_FEEDBACK_URL =
  'https://github.com/HaikalFaruq/PostPocket/issues/new?title=Laporan%20tester&body={pesan}'

/** Alamat halaman tanpa slug surat, supaya link surat orang tidak ikut terkirim di laporan. */
export function safePath(path: string): string {
  return path.replace(/^\/l\/[^/?#]+/, '/l/…')
}

/** Isi awal laporan: ruang untuk cerita tester, lalu halaman, versi, dan perangkat. */
export function feedbackText(input: {
  path: string
  version: string
  device: string
  isPublic: boolean
}): string {
  return [
    ...(input.isPublic
      ? [
          'Laporan ini bisa dibaca publik. Jangan tulis link surat, nomor HP, atau data pribadi.',
          '',
        ]
      : []),
    'Ceritakan masalahnya di sini:',
    '',
    '',
    '---',
    `Halaman: ${safePath(input.path)}`,
    `Versi: ${input.version}`,
    `Perangkat: ${input.device}`,
  ].join('\n')
}

/** Alamat kanal laporan: `{pesan}` di template diganti isi laporan. */
export function feedbackHref(template: string, text: string): string {
  return template.replace('{pesan}', encodeURIComponent(text))
}
