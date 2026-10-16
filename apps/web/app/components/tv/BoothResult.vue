<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'
import { FocusScope } from 'reka-ui'
import { canvasBlob, composeStrip, SHOT_HEIGHT, SHOT_WIDTH, type BoothLayout } from '~/utils/booth'
import { isDark } from '~/utils/color'
import { dayKey } from '~/utils/memories'
import { sendPhotoToLetter } from '~/utils/pending-photo'

/**
 * Hasil Booth (PRD): strip berbingkai dengan tanggal. Simpan ke Pocket hari ini, masukkan ke CD,
 * pakai di surat, unduh PNG, atau ulangi. Jepretan disimpan sekali sebagai momen dan dipakai
 * bersama oleh Pocket dan CD.
 */
const props = defineProps<{ shots: HTMLCanvasElement[]; layout: BoothLayout }>()
const emit = defineEmits<{
  /** `kept` kalau strip-nya sudah disimpan ke mana pun. */
  close: [kept: boolean]
  retake: []
  /** Hasilnya masuk CD: rak TV memilih CD itu dan menandai foto barunya. */
  cd: [albumId: string, moments: string[]]
}>()
const memories = useMemories()

const frameColor = ref(pocket.frameColors[0]!.id)
const frameOptions = pocket.frameColors.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))
const stripUrl = ref<string | null>(null)
let strip: HTMLCanvasElement | null = null
const today = dayKey(new Date())
const saved = reactive({ pocket: false, cd: false, file: false })
const busy = ref(false)
const message = ref('')
let momentIds: string[] | null = null

async function render() {
  const hex = byId(pocket.frameColors, frameColor.value)?.color ?? '#fbf6ec'
  const ink = isDark(hex)
    ? '#ffffff'
    : getComputedStyle(document.documentElement).getPropertyValue('--color-pocket-ink').trim() ||
      '#4a3b30'
  strip = await composeStrip(props.shots, props.layout, { frameColor: hex, ink, date: new Date() })
  const url = URL.createObjectURL(await canvasBlob(strip, 'image/png'))
  if (stripUrl.value) URL.revokeObjectURL(stripUrl.value)
  stripUrl.value = url
}
watch(frameColor, render, { immediate: true })
onBeforeUnmount(() => stripUrl.value && URL.revokeObjectURL(stripUrl.value))

/** Jepretan sebagai momen hari ini, disimpan sekali saja. */
async function moments(): Promise<string[]> {
  if (momentIds) return momentIds
  const photos = await Promise.all(
    props.shots.map(async (shot) => ({
      photo: {
        blob: await canvasBlob(shot, 'image/jpeg', 0.9),
        width: SHOT_WIDTH,
        height: SHOT_HEIGHT,
      },
    })),
  )
  momentIds = await memories.addMoments(photos, { day: today, source: 'booth' })
  return momentIds
}

async function run(action: () => Promise<void>) {
  busy.value = true
  message.value = ''
  try {
    await action()
  } catch {
    message.value = 'Gagal menyimpan di perangkat ini. Coba lagi.'
  } finally {
    busy.value = false
  }
}

const saveToPocket = () =>
  run(async () => {
    const ids = await moments()
    const day = memories.data.days[today]
    await memories.saveDay(
      day
        ? { ...day, moments: [...day.moments, ...ids.filter((id) => !day.moments.includes(id))] }
        : {
            day: today,
            packet: pocket.packetColors[0]!.id,
            sticker: letter.stickers[0]!.id,
            frame: pocket.frames[0]!.id,
            frameColor: frameColor.value,
            moments: ids,
            savedAt: new Date().toISOString(),
          },
    )
    saved.pocket = true
    message.value = 'Tersimpan di kantong hari ini.'
  })

const putInCd = () =>
  run(async () => {
    const ids = await moments()
    const album =
      memories.data.albums.find((item) => item.title === 'Photo Booth') ??
      (await memories.createAlbum('Photo Booth', '📸'))
    await memories.addToAlbum(album.id, ids)
    saved.cd = true
    message.value = 'Masuk ke CD Photo Booth.'
    emit('cd', album.id, ids)
  })

const useInLetter = () =>
  run(async () => {
    if (!strip) return
    const blob = await canvasBlob(strip, 'image/jpeg', 0.9)
    await sendPhotoToLetter({ blob, width: strip.width, height: strip.height }, 'Booth')
  })

const download = () =>
  run(async () => {
    if (!strip) return
    const url = URL.createObjectURL(await canvasBlob(strip, 'image/png'))
    const link = document.createElement('a')
    link.href = url
    link.download = `postpocket-booth-${today}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    saved.file = true
    message.value = 'Strip diunduh ke perangkatmu.'
  })

/** Strip yang belum disimpan ke mana pun tidak dibuang tanpa bertanya. `false` kalau batal. */
function discard(then: 'close' | 'retake'): boolean {
  const kept = saved.pocket || saved.cd || saved.file
  if (!kept && !window.confirm('Buang strip ini? Strip-nya belum disimpan.')) return false
  if (then === 'close') emit('close', kept)
  else emit('retake')
  return true
}

// Back di HP menutup hasil Booth dengan pertanyaan yang sama, bukan meninggalkan TV.
useBackToClose(true, () => discard('close'))

// Fokus terkunci di dalam lembar ini, dimulai dari tombol utamanya.
const primaryButton = ref<HTMLButtonElement | null>(null)
function focusPrimary(event: Event) {
  event.preventDefault()
  primaryButton.value?.focus()
}
</script>

<template>
  <div
    class="scrim fixed inset-0 z-50 grid place-items-center p-4"
    data-testid="booth-result"
    @click.self="discard('close')"
  >
    <FocusScope as-child trapped loop @mount-auto-focus="focusPrimary">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booth-result-title"
        class="flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-[24px] bg-surface p-5 *:shrink-0"
      >
        <div class="flex items-center justify-between">
          <h2 id="booth-result-title" class="text-title">Hasil Booth</h2>
          <IconButton label="Tutup" size="sm" variant="ghost" @click="discard('close')">
            <Icon name="close" :size="15" />
          </IconButton>
        </div>
        <div class="mt-3 grid place-items-center rounded-[16px] bg-fill p-3">
          <img
            v-if="stripUrl"
            :src="stripUrl"
            alt="Strip hasil Booth"
            class="max-h-[44vh] w-auto rounded-[4px] shadow-raised"
            data-testid="booth-strip"
          />
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <span class="text-caption text-ink-muted">Bingkai</span>
          <SwatchGroup v-model="frameColor" label="Warna bingkai" :options="frameOptions" />
        </div>
        <button
          ref="primaryButton"
          type="button"
          class="mt-4 h-11 w-full rounded-control bg-ink text-body font-semibold text-white disabled:opacity-55"
          :disabled="busy || saved.pocket"
          @click="saveToPocket"
        >
          {{ saved.pocket ? '✓ Tersimpan di Pocket' : 'Simpan ke Pocket hari ini' }}
        </button>
        <div class="mt-2 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          <button type="button" class="booth-action" :disabled="busy || saved.cd" @click="putInCd">
            {{ saved.cd ? '✓ Di CD' : 'Masukkan ke CD' }}
          </button>
          <button type="button" class="booth-action" :disabled="busy" @click="useInLetter">
            Pakai di surat
          </button>
          <button type="button" class="booth-action" :disabled="busy" @click="download">
            {{ saved.file ? '✓ Diunduh' : 'Unduh gambar' }}
          </button>
        </div>
        <p v-if="message" role="status" class="mt-3 text-caption text-ink-muted">{{ message }}</p>
        <button
          type="button"
          class="mt-4 h-10 w-full rounded-control text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
          @click="discard('retake')"
        >
          Ulangi
        </button>
      </div>
    </FocusScope>
  </div>
</template>

<style scoped>
.booth-action {
  min-height: 44px;
  padding: 6px;
  line-height: 1.2;
  border-radius: var(--radius-control);
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-line);
  font-size: var(--text-body);
  font-weight: 600;
}

.booth-action:hover:not(:disabled) {
  background-color: var(--color-panel);
}

.booth-action:disabled {
  opacity: 0.55;
}
</style>
