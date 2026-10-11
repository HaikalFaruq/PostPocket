/** Jawaban untuk draf surat yang belum dikirim: mulai baru (draf dihapus), atau pakai draf itu. */
export type DraftChoice = 'new' | 'add'

export interface DraftQuestion {
  /** `photo`: foto dari Pocket atau Booth mau dipakai di surat. `reply`: mulai membalas surat. */
  kind: 'photo' | 'reply'
  /** Potongan isi draf yang belum dikirim, supaya user tahu draf yang mana. */
  draft: string
  /** Asal foto untuk keterangan, misalnya "Booth". */
  from?: string
  /** Draf sudah berisi 4 foto, jadi fotonya tidak bisa ditambahkan. */
  full?: boolean
  /** Draf itu sudah jadi balasan untuk surat lain. */
  replyingElsewhere?: boolean
}

// Hanya diisi dari event di browser, jadi tidak pernah terbawa antar-request di server.
const asking = shallowRef<
  (DraftQuestion & { answer: (choice: DraftChoice | null) => void }) | null
>(null)

/**
 * Tanya user mau diapakan draf surat yang belum dikirim. Dialognya (`<DraftChoiceDialog>` di
 * app.vue) muncul di halaman tempat user berada, jadi "Batal" meninggalkan semuanya seperti
 * semula, misalnya strip Booth yang belum disimpan. Hasilnya `null` kalau dibatalkan.
 */
export function askDraftChoice(question: DraftQuestion): Promise<DraftChoice | null> {
  asking.value?.answer(null)
  return new Promise((resolve) => {
    asking.value = { ...question, answer: resolve }
  })
}

/** Pertanyaan yang sedang menunggu jawaban, untuk `<DraftChoiceDialog>`. */
export function useDraftChoice() {
  function answer(choice: DraftChoice | null) {
    const current = asking.value
    if (!current) return
    current.answer(choice)
    // Dialog ditutup sesaat kemudian, setelah pemanggilnya selesai (misalnya tombol "Pakai di
    // surat" aktif lagi), supaya fokus kembali ke tombol itu, bukan ke <body>.
    setTimeout(() => {
      if (asking.value === current) asking.value = null
    })
  }
  return { asking: readonly(asking), answer }
}
