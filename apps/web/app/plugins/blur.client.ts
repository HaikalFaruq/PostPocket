import { isSoftwareRenderer } from '~/utils/render'

/**
 * Latar kabur popup (utility `scrim`) hanya untuk browser yang menggambar dengan GPU. Tanpa GPU,
 * setiap frame animasi harus mengaburkan ulang seluruh layar dengan CPU sampai popup tersendat; di
 * sana latarnya cukup diredupkan lewat kelas `no-blur` di <html>.
 */
export default defineNuxtPlugin(() => {
  if (isSoftwareRenderer(webglRenderer())) document.documentElement.classList.add('no-blur')
})

/** Nama renderer WebGL, atau `null` kalau WebGL tidak ada. */
function webglRenderer(): string | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return null
  }
}
