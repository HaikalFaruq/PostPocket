import { isSoftwareRenderer } from '~/utils/render'

/**
 * Browser yang menggambar tanpa GPU (renderer WebGL perangkat lunak, atau WebGL tidak ada) diberi
 * `data-render="cpu"` di <html>. Di sana efek yang mahal per frame dimatikan: latar popup cukup
 * diredupkan (bukan dikaburkan), dan kantong serta tali foto Pocket langsung ke keadaan akhirnya
 * seperti saat pengguna meminta gerakan dikurangi.
 *
 * Browser yang dikendalikan tes otomatis (`navigator.webdriver`) diperlakukan sama: di CI selalu
 * tanpa GPU, tapi WebKit di Linux hanya menyebut renderernya "WebKit WebGL". Latar kabur dan
 * animasinya dicek lewat screenshot dan di HP sungguhan.
 */
export default defineNuxtPlugin(() => {
  if (navigator.webdriver || isSoftwareRenderer(webglRenderer())) {
    document.documentElement.dataset.render = 'cpu'
  }
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
