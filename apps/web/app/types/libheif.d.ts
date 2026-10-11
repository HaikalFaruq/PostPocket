// Bagian API libheif-js yang dipakai app/workers/heic.worker.ts. Paketnya hanya membawa tipe fungsi
// tingkat rendah Emscripten, bukan HeifDecoder.
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number
    get_height(): number
    is_primary(): boolean
    /** Isi `target.data` dengan piksel RGBA, lalu panggil `callback(target)`, atau `null` kalau gagal. */
    display(target: ImageData, callback: (result: ImageData | null) => void): void
    free(): void
  }

  interface LibHeif {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] }
  }

  export default function createLibheif(options?: object): LibHeif | Promise<LibHeif>
}
