/**
 * Apakah browser menggambar dengan CPU, menurut nama renderer WebGL-nya (`null` kalau WebGL tidak
 * ada). Efek yang mahal tanpa GPU, misalnya latar kabur seluruh layar, dimatikan di sana.
 */
export function isSoftwareRenderer(renderer: string | null): boolean {
  if (renderer === null) return true
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)
}

/**
 * Gerak dikurangi: pengguna memintanya, atau browser menggambar tanpa GPU (lihat
 * plugins/render.client.ts). Animasi langsung ke keadaan akhirnya.
 */
export function calmMotion(): boolean {
  return (
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.render === 'cpu'
  )
}
