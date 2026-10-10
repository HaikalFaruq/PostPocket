<script setup lang="ts">
import {
  byId,
  defaultLetterDesign,
  letter,
  normalizeContent,
  publishableContent,
} from '@postpocket/presets'
import { preparePhoto } from '~/utils/front-image'
import {
  LetterApiError,
  errorMessage,
  sendLetter,
  type Letter,
  type SentLetter,
  type UploadImage,
} from '~/utils/letter-api'
import { compressPhoto, renderOgImage } from '~/utils/upload-image'

useSeoMeta({ title: 'Uji kirim surat · PostPocket', robots: 'noindex' })

/**
 * Uji alur "Buat link" dari ujung ke ujung tanpa editor: kompres foto, render gambar OG, kirim
 * ke API (mock lokal atau Supabase, sesuai NUXT_PUBLIC_API_BASE), baca lagi, tandai dibuka,
 * lalu hapus. Foto bisa dipilih sendiri untuk menguji kompres di HP sungguhan.
 */
const api = useLetterApi()
const config = useRuntimeConfig().public
const status = ref<'idle' | 'running' | 'done' | 'error'>('idle')
const steps = ref<string[]>([])
const error = ref('')
const picked = ref<File | null>(null)
const result = ref<{
  photo: UploadImage
  og: UploadImage
  ogUrl: string
  sent: SentLetter
  letter: Letter
  sameContent: boolean
  openedAt: string
  deleted: boolean
} | null>(null)

const kb = (bytes: number) => `${(bytes / 1000).toFixed(0)} KB`
const step = (text: string) => steps.value.push(text)

function onPick(event: Event) {
  picked.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

/** Foto uji 2048×1536 dengan noise, jauh di atas 500 KB, supaya kompres benar-benar bekerja. */
async function samplePhoto() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1536
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 2048, 1536)
  gradient.addColorStop(0, '#f6b48f')
  gradient.addColorStop(1, '#5b7fc7')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 2048, 1536)
  const pixels = ctx.getImageData(0, 0, 2048, 1536)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 70
    pixels.data[i] = pixels.data[i]! + noise
    pixels.data[i + 1] = pixels.data[i + 1]! + noise
    pixels.data[i + 2] = pixels.data[i + 2]! + noise
  }
  ctx.putImageData(pixels, 0, 0)
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((value) => resolve(value!), 'image/jpeg', 0.95),
  )
  return { blob, width: 2048, height: 1536 }
}

async function run() {
  status.value = 'running'
  steps.value = []
  error.value = ''
  if (result.value) URL.revokeObjectURL(result.value.ogUrl)
  result.value = null
  try {
    const source = picked.value ? await preparePhoto(picked.value) : await samplePhoto()
    step(`Foto asal ${kb(source.blob.size)}, ${source.width}×${source.height}`)
    const photo = await compressPhoto(source)
    step(`Foto dikompres ${kb(photo.size)}, ${photo.width}×${photo.height}`)

    const illustration = letter.illustrations[0]!
    const og = await renderOgImage({
      art: illustration.art,
      foilMask: illustration.foil,
      foil: byId(letter.foilColors, 'gold')!,
      paper: byId(letter.papers, 'cream')!,
      ratio: illustration.ratio,
      foilBorder: true,
    })
    step(`Gambar OG ${kb(og.size)}, ${og.width}×${og.height}`)

    const design = { ...defaultLetterDesign, template: 'photo-1' }
    const content = normalizeContent({
      elements: [
        {
          kind: 'photo',
          id: 'p1',
          x: 0.5,
          y: 0.35,
          width: 0.74,
          rotation: -2,
          photo: 'f1',
          aspect: 1.25,
        },
        {
          kind: 'text',
          id: 't1',
          x: 0.5,
          y: 0.8,
          width: 0.8,
          rotation: 0,
          text: 'Uji kirim dari lab',
          size: 0.06,
          align: 'center',
        },
      ],
    })
    const sent = await sendLetter(
      api,
      { design, content, cover: null, photos: { f1: photo }, og },
      (done, total) => step(`Unggah ${done}/${total}`),
    )
    step(`Terbit di ${sent.url}`)

    const stored = await api.get(sent.slug)
    const sameContent =
      JSON.stringify(stored.content) === JSON.stringify(publishableContent(content))
    const opened = await api.open(sent.slug)
    step(`Ditandai dibuka ${opened.openedAt}`)
    await api.remove(sent.id, sent.editToken)
    const deleted = await api.get(sent.slug).then(
      () => false,
      (problem) => problem instanceof LetterApiError && problem.code === 'not_found',
    )
    step(deleted ? 'Dihapus, link sudah 404' : 'Hapus belum berhasil')
    result.value = {
      photo,
      og,
      ogUrl: URL.createObjectURL(og.blob),
      sent,
      letter: stored,
      sameContent,
      openedAt: opened.openedAt,
      deleted,
    }
    status.value = 'done'
  } catch (problem) {
    error.value = errorMessage(problem)
    step(`Gagal: ${problem instanceof Error ? problem.message : String(problem)}`)
    status.value = 'error'
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-8 sm:px-6" data-testid="lab-kirim" :data-status="status">
    <NuxtLink to="/lab" class="text-caption text-ink-muted hover:text-ink">← Lab</NuxtLink>
    <h1 class="mt-3 text-title font-semibold">Uji kirim surat</h1>
    <p class="mt-1 text-ink-muted">
      Kompres foto, render gambar OG, lalu kirim, baca, buka, dan hapus lewat API
      <code class="text-caption">{{ config.apiBase || 'Supabase' }}</code
      >.
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <label
        class="inline-flex h-9 cursor-pointer items-center rounded-control bg-surface px-3.5 text-body font-semibold inset-ring inset-ring-line"
      >
        {{ picked ? picked.name : 'Pakai foto sendiri' }}
        <input type="file" accept="image/*" class="sr-only" @change="onPick" />
      </label>
      <button
        type="button"
        class="inline-flex h-9 items-center rounded-control bg-ink px-4 text-body font-semibold text-white disabled:opacity-50"
        :disabled="status === 'running'"
        @click="run"
      >
        {{ status === 'running' ? 'Berjalan…' : 'Jalankan uji kirim' }}
      </button>
    </div>

    <ol v-if="steps.length" class="mt-6 space-y-1 text-caption text-ink-muted">
      <li v-for="(text, index) in steps" :key="index">{{ text }}</li>
    </ol>
    <p v-if="error" role="alert" class="mt-4 rounded-control bg-fill px-3 py-2 text-caption">
      {{ error }}
    </p>

    <section v-if="result" class="mt-6 space-y-4">
      <img
        :src="result.ogUrl"
        alt="Gambar OG hasil render"
        class="w-full rounded-card shadow-raised"
      />
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
        <dt class="text-ink-muted">Foto</dt>
        <dd data-testid="photo" :data-size="result.photo.size" :data-type="result.photo.type">
          {{ kb(result.photo.size) }} · {{ result.photo.width }}×{{ result.photo.height }}
        </dd>
        <dt class="text-ink-muted">Gambar OG</dt>
        <dd
          data-testid="og"
          :data-size="result.og.size"
          :data-width="result.og.width"
          :data-height="result.og.height"
        >
          {{ kb(result.og.size) }} · {{ result.og.width }}×{{ result.og.height }}
        </dd>
        <dt class="text-ink-muted">Slug</dt>
        <dd data-testid="slug">{{ result.sent.slug }}</dd>
        <dt class="text-ink-muted">Isi sama</dt>
        <dd data-testid="same-content">{{ result.sameContent ? 'ya' : 'tidak' }}</dd>
        <dt class="text-ink-muted">Foto di server</dt>
        <dd data-testid="photo-count">{{ Object.keys(result.letter.photos).length }}</dd>
        <dt class="text-ink-muted">Dibuka</dt>
        <dd data-testid="opened">{{ result.openedAt }}</dd>
        <dt class="text-ink-muted">Dihapus</dt>
        <dd data-testid="deleted">{{ result.deleted ? 'ya' : 'tidak' }}</dd>
      </dl>
    </section>
  </main>
</template>
