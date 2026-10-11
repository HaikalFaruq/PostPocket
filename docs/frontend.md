# Panduan Frontend PostPocket

Untuk Kall dan agent-nya. Baca [AGENTS.md](../AGENTS.md) dulu; detail produk lengkap ada di [PRD](prd/PRD-PostPocket.md), hasil bedah referensi di [docs/reference](reference/README.md).

## Mulai lokal

Butuh Node 24 (lihat `.nvmrc`) dan pnpm 9.

```sh
pnpm install   # sekali per clone, sekalian mengaktifkan hook git
cp apps/web/.env.example apps/web/.env   # isi URL dan publishable key Supabase dari Bintang
pnpm dev       # http://localhost:3000
```

Frontend hanya memakai URL proyek dan **publishable key** Supabase (aman dipakai di browser). Secret key tidak pernah masuk frontend, `.env`, atau commit.

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Server development `apps/web` |
| `pnpm lint` | ESLint (warning dianggap gagal) dan Prettier, semua package |
| `pnpm typecheck` | `nuxt typecheck` (vue-tsc) dan `tsc` untuk preset |
| `pnpm test` | Unit test Vitest, semua package |
| `pnpm test:e2e` | Playwright di build production: Android (Pixel 7), iPhone (WebKit), desktop |
| `pnpm build` | Build production `apps/web` |

Pertama kali menjalankan E2E di mesin baru: `pnpm --filter @postpocket/web exec playwright install chromium webkit`.

> [!NOTE]
> TypeScript dikunci di 6.0.x karena `vue-tsc` belum bisa memakai TypeScript 7 (versi native tidak punya `lib/tsc`). Naikkan bersama `vue-tsc` kalau sudah didukung.

> [!NOTE]
> `pnpm.overrides` di `package.json` root memaksa versi yang sudah ditambal untuk dua alat dev: `simple-git` 4 (dipakai Nuxt DevTools) dan `esbuild` 0.28 (dipakai `fontless` dari `@nuxt/fonts`). simple-git 4 tidak punya export default, jadi `patches/@nuxt__devtools@3.4.2.patch` mengganti import-nya di DevTools. Kalau `pnpm install` menolak karena patch tidak terpakai setelah Nuxt naik versi: hapus patch dan override `simple-git` kalau DevTools versi baru sudah tidak memakai simple-git 3, atau buat ulang patch-nya dengan `pnpm patch @nuxt/devtools@<versi>`. Override `esbuild` boleh dihapus begitu `fontless` memakai esbuild 0.28.1 ke atas.

## Struktur

```text
apps/web/
  app/assets/css/main.css   design token (@theme Tailwind) dan gaya dasar
  app/components/           komponen bersama dari PRD, dipanggil tanpa prefix: <StepCard>, <PillGroup>, ...
  app/components/letter/    komponen khusus Letter: FoilCard, LetterPage, LetterEditor, FrontPicker, dll.
  app/components/tv/        TvSet, CdShelf, TvSlideshow, BoothCamera, BoothResult
  app/components/pocket/    SnackPacket (kantong snack), SaveDayModal (modal simpan hari), MonthPicker
  app/composables/          useCardMotion (gerak kartu), useFoilMask (peta foil), usePrintArt (gambar cetak)
  app/stores/               useLetterDraft (draf surat) dan useMemories (momen, hari Pocket, album CD) di IndexedDB
  app/utils/                logika murni (card-motion, foil-map, letter-draft, memories, calendar, exif,
                            color, foil, icons) dan util browser (front-image, photo-filter), diuji di test/
  app/pages/                / (Beranda), /letter/new (editor surat), /l/:slug (penerima), /tv (TV dan Booth), /pocket (kalender), /pocket/:date (isi kantong), /lab, /lab/foil, /lab/safari, /lab/kirim
  public/illustrations/     ilustrasi depan kartu, hasil scripts/illustrations.mjs
  e2e/                      skenario Playwright
  server/routes/mock-api/   mock API surat untuk development dan E2E (NUXT_MOCK_API=1)
  test/                     unit test Vitest
packages/presets/           pilihan desain dalam JSON + tipe dan helper (byId, isAllowed, surprise)
```

## Aturan frontend

- **Hanya token.** Warna, radius, font, dan bayangan diambil dari `main.css`. Warna bawaan Tailwind sengaja dimatikan, jadi `bg-red-500` tidak akan jalan; pakai `bg-ink`, `text-ink-muted`, `rounded-card`, `shadow-raised`, dan seterusnya.
- **Pilihan desain dari preset.** Kertas, foil, kantong, bingkai, dan filter dibaca dari `@postpocket/presets`. Yang disimpan di surat (dan dikirim ke backend) hanya id-nya.
- **Logika di utils.** Hitungan dan validasi masuk `app/utils` beserta unit test di `test/`. Komponen cukup menampilkan data.
- **Ilustrasi milik sendiri.** Ubah `scripts/illustrations.mjs`, lalu jalankan `node scripts/illustrations.mjs`. Aset dari web referensi tidak boleh masuk repo.
- **Cek efek 3D di Safari sungguhan.** Screenshot Playwright WebKit tidak memakai compositing 3D, jadi `backface-visibility` terlihat rusak padahal di Safari benar. E2E kartu memeriksa state DOM; tampilannya dicek di simulator iOS atau iPhone.
- **`mask` dijalankan setelah `filter`.** Kalau elemen ber-mask butuh bayangan, taruh `drop-shadow` di pembungkusnya.
- **Foto user selalu lewat `preparePhoto()`**: diputar sesuai EXIF, diperkecil ke 2048 px, lalu disimpan ulang sebagai JPEG supaya metadata lokasi hilang (PRD bagian Privasi).
- **Draf di IndexedDB menyimpan foto sebagai byte (`ArrayBuffer`), bukan `Blob`**: Safari Private Browsing menolak Blob di IndexedDB. Foto disimpan di key terpisah supaya mengetik isi surat tidak menulis ulang foto.
- **Isi surat hanya dirender `LetterElementView`**, di editor, kartu, maupun halaman penerima. Jangan bikin renderer kedua, supaya yang dilihat penerima sama dengan yang disusun pengirim ([keputusan](spikes/editor-isi-surat.md)).
- **Ekspor foto berfilter lewat `drawFiltered()`**, jangan `ctx.filter` langsung: Safari tidak mendukung `ctx.filter` dan filternya hilang diam-diam ([hasil spike](spikes/safari.md)).

## Komponen bersama

| Komponen | Dipakai di | Catatan |
| --- | --- | --- |
| `StepCard` | Letter, Pocket | `variant="section"` (nomor lingkaran hitam, gaya Foil Studio) atau `"card"` (nomor "01", gaya Day Pocket); slot `action` untuk tombol di kanan judul |
| `PillGroup` + `PillChip` | Semua | Pilihan teks tunggal (Reka UI RadioGroup); panah kiri/kanan pindah pilihan |
| `SwatchGroup` + `Swatch` | Letter, Pocket, TV | Ukuran `sm` 30 px, `md` 40 px, `lg` 48 px dengan ikon di slot; `check` untuk centang gaya Day Pocket; `--swatch-gap` mengikuti warna latar |
| `StickyCTA` | Letter, Booth | Tombol hitam selebar panel yang menempel di bawah; `loading` dan `disabled` |
| `BottomSheet` | HP | Sheet yang bisa dilipat lewat chevron; slot `peek` untuk petunjuk dan `footer` untuk CTA |
| `SidePanel` | Desktop | Kolom kanan 400 px setinggi layar; slot `footer` |
| `Modal` | Pocket | Dua kolom (slot `preview` dan isi), layar penuh di HP, Esc menutup, fokus terkunci |
| `IconButton` | Semua | Tombol bulat 32/40/44 px; `label` wajib |
| `PhotoFrame` | Pocket, Booth, Letter | `polaroid`, `stamp` (tepi bergerigi), `ticket`; warna teks menyesuaikan warna bingkai |
| `FoilCard` | Letter, Beranda, halaman penerima | Kartu lipat foil CSS 3D, lihat [spike](spikes/foil-3d.md) |

Semua komponen bisa dilihat dan dicoba di `/lab`.

## Data surat untuk API

Bahan kontrak `docs/api/openapi.yaml`: apa yang dikirim frontend saat "Buat link" dan apa yang dibutuhkan halaman penerima. Nama field final mengikuti kontrak yang ditulis Bintang. Tipe dan validasinya ada di `packages/presets/src/letter-content.ts` (`normalizeContent`, `publishableContent`, `contentPhotoKeys`).

**`design`** berisi id preset dengan bentuk `LetterDesign`: `illustration`, `shape`, `foilMode`, `foilBorder`, `foilColor`, `paper`, dan `template`. `illustration: "upload"` berarti gambar depannya foto user.

**`content`** berisi elemen kanvas halaman surat. Posisi dan ukurannya relatif terhadap halaman, jadi tampil sama di layar mana pun.

```json
{
  "version": 1,
  "elements": [
    { "kind": "photo", "id": "e1", "x": 0.5, "y": 0.32, "width": 0.7, "rotation": -3, "photo": "p1", "aspect": 1.33 },
    { "kind": "text", "id": "e2", "x": 0.5, "y": 0.72, "width": 0.8, "rotation": 0, "text": "Selamat ulang tahun!", "size": 0.07, "align": "center" },
    { "kind": "sticker", "id": "e3", "x": 0.84, "y": 0.12, "width": 0.18, "rotation": 12, "sticker": "heart" }
  ]
}
```

| Field | Elemen | Arti | Rentang |
| --- | --- | --- | --- |
| `id` | Semua | Unik per surat | 1–40 huruf, angka, `-`, atau `_` |
| `x`, `y` | Semua | Titik tengah elemen, pecahan lebar dan tinggi halaman | 0–1 |
| `width` | Semua | Lebar, pecahan lebar halaman | 0,05–1 |
| `rotation` | Semua | Derajat searah jarum jam | -180–180 |
| `text` | `text` | Tulisan tangan Caveat, warnanya ikut kertas | Maksimal 600 karakter per blok |
| `size` | `text` | Ukuran huruf, pecahan lebar halaman | 0,02–0,25 |
| `align` | `text` | `left`, `center`, atau `right` | |
| `photo` | `photo` | Kunci foto di daftar `photos` | Pola sama dengan `id` |
| `aspect` | `photo` | Lebar dibagi tinggi bingkai; foto di-crop menutupi bingkai | 0,2–5 |
| `sticker` | `sticker` | Id stiker dari preset | Pola sama dengan `id` |

- Urutan `elements` adalah urutan tumpukan: yang terakhir tampil paling atas.
- Maksimal 4 blok teks, 4 foto, dan 16 stiker. Satu foto hanya dipakai sekali.
- Teks tidak berisi `\u0000` karena `jsonb` Postgres menolaknya; `normalizeContent()` sudah membuangnya.
- Slot foto kosong (`"photo": null`) hanya ada di draf dan dibuang sebelum dikirim.

**Berkas yang diunggah**

| Berkas | Kapan | Format |
| --- | --- | --- |
| Cover | Kalau `design.illustration` bernilai `upload` | JPEG atau WebP, maksimal 500.000 byte, sisi panjang maksimal 2048 px |
| `photos` | Satu per kunci `photo` di `content`, maksimal 4 | Sama dengan cover |
| Gambar OG | Selalu | JPEG 1200×630, maksimal 300.000 byte. PNG dari foto bisa lebih dari 750 KB |

Untuk setiap foto, frontend mengirim `key` (khusus `photos`), `type`, `width`, `height`, dan `size`. Server mengembalikan URL upload bertanda tangan untuk tiap foto, cover, dan gambar OG. `replyTo` berisi slug surat yang dibalas lewat "Bikin balasan".

**Yang dibutuhkan halaman penerima dari `GET /l/:slug`**: `design`, `content`, URL cover, URL tiap foto per kunci, URL gambar OG, `openedAt`, `expiresAt`, dan `photosDeletedAt`. Setelah foto dihapus, URL-nya tidak dikirim lagi dan halaman menampilkan placeholder di slotnya. Kalau `og` bernilai `null` (cover dari foto user ikut dihapus), meta tag OG memakai gambar bawaan `/og-surat.jpg` dan kartu memakai sampul polos.

**CORS** perlu mengizinkan `https://postpocket.vercel.app`, preview `https://postpocket-*-haikalfaruqs-projects.vercel.app`, dan `http://localhost:3000`.

**Mock API.** `apps/web/server/routes/mock-api/` meniru kelima endpoint di atas (validasi, kode error, upload ke URL bertanda tangan) dengan data di memori, supaya alur "Buat link" dan halaman penerima bisa dibangun sebelum backend siap. Body `POST /letters` diperiksa langsung dengan skema di `docs/api/openapi.yaml` (ajv, `server/utils/contract.ts`): yang tidak sesuai skema dijawab `400` beserta `details` berisi lokasi field-nya, sedangkan isi yang ditolak (preset tidak dikenal, kunci foto tidak cocok, cover, `replyTo`, batas per jenis elemen) dijawab `422`. Jadi kalau kontraknya berubah, mock ikut berubah. `test/contract.test.ts` memastikan body dari klien lolos skema, dan E2E `mock-api.spec.ts` mencocokkan setiap respons mock dengan skemanya. Nyalakan dengan `NUXT_MOCK_API=1` dan `NUXT_PUBLIC_API_BASE=/mock-api` (contohnya di `apps/web/.env.example`); E2E selalu memakainya, produksi tidak. `/lab/kirim` menjalankan alur kirim dari ujung ke ujung: kompres foto, render gambar OG, kirim, baca, buka, lalu hapus.

## Checklist per sprint

Centang item di PR yang menyelesaikannya. Agent mulai dari item pertama yang belum dicentang.

**Sprint 0 (minggu 1)**

- [x] Scaffold Nuxt + TypeScript + Pinia, Tailwind, ESLint, Prettier, Vitest, Playwright, CI
- [x] Design token di CSS variables
- [x] Komponen bersama: StepCard, PillChip, PillGroup, Swatch, SwatchGroup, StickyCTA, BottomSheet, SidePanel, Modal, IconButton, PhotoFrame
- [x] Preset desain di `packages/presets`
- [x] Spike kartu foil CSS vs TresJS: CSS 3D dipilih ([hasil](spikes/foil-3d.md))
- [x] Uji `ctx.filter` di engine Safari dan Chrome ([hasil](spikes/safari.md))
- [ ] Uji kamera dan benchmark kartu di iPhone dan HP Android kelas menengah sungguhan (`/lab/safari`, `/lab/foil?bench=1`)
- [x] Ukuran dan catatan referensi di `docs/reference/` (screenshot di luar repo karena repo public)

**Sprint 1 (minggu 2–3)**

- [x] Halaman `/letter/new` dengan langkah 1 sampai 4 (gambar depan, bagian foil, warna foil, kertas), kartu berubah langsung tanpa reload. Langkah 5 sementara berupa kolom teks sampai editor Sprint 2 siap
- [x] Upload, drop, dan paste foto sendiri untuk gambar depan; bentuk Asli, Portrait, Square, Landscape
- [x] Peta foil dari gambar di browser: Detail (deteksi tepi), Bayangan (threshold), Satu warna
- [x] Surprise me memakai `surprise()` dari preset, dengan animasi kartu berputar sekali
- [x] Draf otomatis di IndexedDB; refresh tidak menghilangkan isi
- [ ] Gerbang: kartu foil di atas 50 fps di HP Android kelas menengah

**Sprint 2 (minggu 4–5)**

- [x] Editor isi surat dengan 4 template, teks Caveat, foto (maksimal 4), dan stiker. Editornya DOM, bukan vue-konva ([keputusan](spikes/editor-isi-surat.md))
- [x] Alur "Buat link": kompres tiap foto sampai di bawah 500 KB (JPEG atau WebP), hapus EXIF lokasi, upload ke URL bertanda tangan, lalu publish (kontrak dari `docs/api/openapi.yaml`). Diuji lewat mock API; begitu Edge Function siap tinggal ganti `NUXT_PUBLIC_API_BASE`
- [x] Gambar OG dirender di browser waktu "Buat link" dari kartu yang sama: JPEG 1200×630 maksimal 300.000 byte, diunggah lewat URL bertanda tangan seperti foto. Jangan pasang Nuxt OG Image
- [x] Halaman penerima `/l/:slug` dengan animasi buka di bawah 600 ms dan tombol Bikin balasan; placeholder di slot foto kalau fotonya sudah dihapus (7 hari setelah surat pertama kali dibuka), dan sampul polos kalau cover dari foto user ikut dihapus
- [x] `/l/**` di-SSR lewat `routeRules` dengan header `X-Robots-Tag: noindex`, dan meta tag OG memakai URL gambar OG dari `GET /l/:slug`, atau gambar OG bawaan kalau sudah dihapus
- [x] Region fungsi Vercel `sin1`, dekat dengan Supabase di Singapore ([Deploy](#deploy))
- [ ] Gerbang: link terbuka di HP lain tanpa login dan preview-nya tampil di WhatsApp

**Sprint 3 (minggu 6–7)**

- [x] Halaman TV: badan clay dengan 8 warna, panel filter, arsip CD coverflow, slideshow
- [x] Booth: hitung mundur, strip 1×4 / 2×2 / satu foto, unduh PNG dengan filter yang sama dengan layar
- [x] Kirim hasil Booth ke Letter

**Sprint 4 dan beta (minggu 8–10)**

- [x] Pocket: kalender, modal simpan hari, buka kantong, album otomatis per bulan ke TV
- [x] `navigator.storage.persist()` dan ajakan pasang PWA ([PWA](#pwa))
- [ ] Uji di 3 HP; perbaiki bug dari tester

## PWA

PostPocket bisa dipasang ke layar utama lewat `@vite-pwa/nuxt` (manifest dan service worker). Service worker hanya ada di build production; `pnpm dev` tidak memakainya, jadi cek PWA lewat `pnpm build && node apps/web/.output/server/index.mjs` atau `pnpm test:e2e`.

| Yang disimpan | Cara | Kenapa |
| --- | --- | --- |
| JS, CSS, ilustrasi, ikon, `offline.html` | Precache saat service worker dipasang | Aplikasi tetap jalan tanpa sinyal |
| Halaman | Jaringan dulu, salinan terakhir kalau offline. Beranda, editor surat, dan halaman pertama disimpan sejak kunjungan pertama | Selalu versi terbaru, tapi tetap bisa dibuka offline; draf surat memang ada di IndexedDB |
| Font (`/_fonts/`) | Disimpan saat dipakai | Hanya subset yang benar-benar dimuat |
| Surat penerima (`/l/…`) | Tidak pernah disimpan | Isinya pribadi |

- Halaman yang belum pernah tersimpan menampilkan `offline.html` saat offline.
- Versi baru tidak langsung dipakai. Toast "Versi baru PostPocket siap" muncul dan user memilih kapan memuat ulang, supaya tulisan yang sedang diketik tidak hilang.
- Kartu "Pasang PostPocket" di Beranda memakai dialog pasang bawaan Chrome, atau petunjuk Tambah ke Layar Utama di iPhone. Aplikasi yang terpasang meminta `navigator.storage.persist()`, dan Safari tidak menghapus datanya setelah 7 hari.
- Halaman baru yang menampilkan data pribadi wajib dikecualikan dari cache: tambahkan ke `isPrivatePath()` di `app/utils/pwa.ts` dan aturan `runtimeCaching` di `nuxt.config.ts`.
- Ikon aplikasi dibuat ulang dengan `node scripts/pwa-icons.mjs` dari folder `apps/web`.

## Uji di HP sungguhan

- `/lab/foil?bench=1` menjalankan benchmark otomatis; hasilnya muncul di pojok kanan atas dan bisa disalin dari langkah 5. Parameter lain: `?flip=1` (sampul belakang) dan `?open=1` (kartu terbuka).
- `/lab/safari` memeriksa `ctx.filter`, OffscreenCanvas, WebGL2, IndexedDB, dan kamera. Kamera hanya jalan di HTTPS: buka di domain produksi, atau `pnpm dev --host` lalu tunnel HTTPS.

Domain produksi: [postpocket.vercel.app/lab/foil?bench=1](https://postpocket.vercel.app/lab/foil?bench=1) dan [postpocket.vercel.app/lab/safari](https://postpocket.vercel.app/lab/safari).

## Deploy

Proyek Vercel `postpocket` (Hobby, akun Kall) tersambung ke repo ini lewat GitHub. Setiap push ke `main` deploy ke produksi di [postpocket.vercel.app](https://postpocket.vercel.app), setiap PR dapat preview.

| Setting | Nilai |
| --- | --- |
| Root directory | `apps/web`, file di luar root ikut di-build (misalnya `packages/presets`) |
| Framework dan Node | Nuxt, 24.x |
| Region fungsi | `sin1`, dekat dengan Supabase di Singapore |
| Env production, preview, development | `NUXT_PUBLIC_SUPABASE_URL` dan `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, nilainya sama dengan `apps/web/.env` |

- Preview dilindungi Vercel Authentication, jadi hanya bisa dibuka akun pemilik proyek. Domain produksi terbuka untuk siapa saja.
- Env baru atau yang berubah baru terpakai di deploy berikutnya. Hanya nilai yang aman di browser yang boleh masuk sini; secret key tetap di Supabase.
