import createLibheif from 'libheif-js/libheif-wasm/libheif-bundle.mjs'

// Worker pengubah HEIC ke JPEG (dipanggil dari utils/heic.ts). libheif memutar gambar sesuai
// metadata HEIF-nya, lalu hasilnya diperkecil ke `maxSide` sebelum disimpan sebagai JPEG.

interface Job {
  id: number
  buffer: ArrayBuffer
  maxSide: number
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Job>) => void) | null
  postMessage: (message: unknown) => void
}

let libheif: Awaited<ReturnType<typeof createLibheif>> | undefined

async function convert({ buffer, maxSide }: Job): Promise<Blob> {
  libheif ??= await createLibheif()
  const decoder = new libheif.HeifDecoder()
  const images = decoder.decode(new Uint8Array(buffer))
  const image = images.find((item) => item.is_primary()) ?? images[0]
  if (!image) throw new Error('Tidak ada gambar di berkas HEIC')
  const width = image.get_width()
  const height = image.get_height()
  const pixels = await new Promise<ImageData>((resolve, reject) => {
    const target = new ImageData(width, height)
    image.display(target, (result) =>
      result ? resolve(result) : reject(new Error('HEIC gagal dibuka')),
    )
  })
  image.free()
  const full = new OffscreenCanvas(width, height)
  full.getContext('2d')!.putImageData(pixels, 0, 0)
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const out = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale))
  out.getContext('2d')!.drawImage(full, 0, 0, out.width, out.height)
  return out.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
}

scope.onmessage = async (event) => {
  const { id } = event.data
  try {
    scope.postMessage({ id, blob: await convert(event.data) })
  } catch {
    scope.postMessage({ id })
  }
}
