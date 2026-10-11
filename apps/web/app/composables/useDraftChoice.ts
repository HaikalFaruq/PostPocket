/** Jawaban untuk draf surat yang belum dikirim: mulai baru (draf dihapus), atau pakai draf itu. */
export type DraftChoice = 'new' | 'add'

export interface DraftQuestion {
  /** `photo`: foto dari Pocket atau Booth mau dipakai di surat. `reply`: mulai membalas surat. */
  kind: 'photo' | 'reply'
  /** Asal foto untuk keterangan, misalnya "Booth". */
  from?: string
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
    asking.value = null
    current?.answer(choice)
  }
  return { asking: readonly(asking), answer }
}
