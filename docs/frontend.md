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

Edge Functions produksi tidak menerima origin `http://localhost:3000` (kontrak 0.2.3). Jadi untuk `pnpm dev`, aktifkan mock API di `.env` (`NUXT_MOCK_API=1` dan `NUXT_PUBLIC_API_BASE=/mock-api`), atau arahkan URL dan publishable key di `.env` ke stack Supabase lokal (`http://127.0.0.1:54321`, key dari `supabase status`), yang gateway-nya menjawab CORS dengan `*`. Kalau `.env` menunjuk ke Supabase produksi tanpa mock, halaman surat masih bisa dibuka karena SSR, tapi "Buat link" dan menandai surat dibuka gagal karena CORS. Untuk menguji backend asli, pakai tes live ke domain produksi ([Gerbang Sprint 2](#gerbang-sprint-2)). Kotak bareng hanya tampil dengan `NUXT_PUBLIC_KOTAK_BARENG=1`, jadi nyalakan bersama mock API ([Kotak bareng](#kotak-bareng)).

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
  app/components/tv/        TvSet, CdShelf, CdDisc, TvSlideshow, BoothCamera, BoothLayoutPreview, BoothResult
  app/components/pocket/    SnackPacket (kantong foil SVG), TearablePacket (ketuk atau gores untuk menyobek),
                            PhotoLine (foto dijepit di tali), SaveDayModal (modal simpan hari), MonthPicker
  app/components/kotak/     GlassFolder (folder kaca), LetterViewer (baca surat satu per satu), FolderMini,
                            KeepBox (Simpan semua di kotak bareng)
  app/composables/          useCardMotion (gerak kartu), useFoilMask (peta foil), usePrintArt (gambar cetak)
  app/workers/              heic.worker.ts: HEIC ke JPEG dengan libheif, dimuat hanya saat ada foto HEIC
  app/stores/               useLetterDraft (draf surat), useMemories (momen, hari Pocket, album CD), dan
                            useSavedLetters (surat tersimpan di Kotak surat) di IndexedDB
  app/utils/                logika murni (card-motion, foil-map, letter-draft, memories, calendar, exif,
                            color, foil, icons, packet-art, packet-tear, photo-line) dan util browser
                            (front-image, photo-filter), diuji di test/
  app/pages/                / (Beranda), /letter/new (editor surat), /l/:slug (penerima), /tv (TV dan Booth), /pocket (kalender), /pocket/:date (isi kantong), /kotak (Kotak surat), /kotak/baru dan /kotak/:id (bikin dan kelola kotak bareng), /titip/:kode (titip surat), /k/:slug (kotak bareng untuk penerima), /lab, /lab/foil, /lab/safari, /lab/kirim
  public/illustrations/     ilustrasi depan kartu, hasil scripts/illustrations.mjs
  e2e/                      skenario Playwright
  server/routes/mock-api/   mock API surat dan kotak bareng untuk development dan E2E (NUXT_MOCK_API=1)
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
- **Id momen dan album Pocket adalah UUID (`crypto.randomUUID()`)**, karena sinkron fase 2 memakai id dari browser ([Rancangan skema fase 2](backend.md#rancangan-skema-fase-2)). Data lama, dengan id `m`/`a` + 6 karakter, diganti sekali saat dimuat. Fotonya tetap di kunci lama lewat `Moment.photoKey`, jadi penggantiannya cukup satu tulisan dan aman kalau terputus. Baca dan hapus foto selalu lewat store, jangan pakai `PHOTO_PREFIX + id` langsung.
- **Isi surat hanya dirender `LetterElementView`**, di editor, kartu, maupun halaman penerima. Jangan bikin renderer kedua, supaya yang dilihat penerima sama dengan yang disusun pengirim ([keputusan](spikes/editor-isi-surat.md)).
- **Surat yang sudah dikirim dirender `ReceivedLetter`** dari bentuk `ShownLetter` (`utils/letter-view.ts`), entah datangnya dari `GET /l/:slug` atau dari Kotak surat. Jangan bikin kartu penerima kedua.
- **Ekspor foto berfilter lewat `drawFiltered()`**, jangan `ctx.filter` langsung: Safari tidak mendukung `ctx.filter` dan filternya hilang diam-diam ([hasil spike](spikes/safari.md)).

## Komponen bersama

| Komponen | Dipakai di | Catatan |
| --- | --- | --- |
| `StepCard` | Letter, Pocket | `variant="section"` (nomor lingkaran hitam, gaya Foil Studio) atau `"card"` (nomor "01", gaya Day Pocket); slot `action` untuk tombol di kanan judul |
| `PillGroup` + `PillChip` | Semua | Pilihan teks tunggal (Reka UI RadioGroup); panah kiri/kanan pindah pilihan |
| `SwatchGroup` + `Swatch` | Letter, Pocket, TV | Ukuran `sm` 30 px, `md` 40 px, `lg` 48 px dengan ikon di slot; `check` untuk centang gaya Day Pocket; `--swatch-gap` mengikuti warna latar |
| `StickyCTA` | Letter, Booth | Tombol hitam selebar panel yang menempel di bawah; `loading` dan `disabled` |
| `BottomSheet` | HP | Sheet yang opsinya bisa dilipat lewat chevron; slot `peek` untuk petunjuk dan `footer` untuk CTA, yang tetap terlihat saat sheet dilipat |
| `SidePanel` | Desktop | Kolom kanan 400 px setinggi layar; slot `footer` |
| `Modal` | Pocket | Dua kolom (slot `preview` dan isi), layar penuh di HP, Esc menutup, fokus terkunci, latar `scrim` yang kabur seperti semua popup (diredupkan saja di browser tanpa GPU) |
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
| `text` | `text` | Tulisan tangan (Delicious Handrawn), warnanya ikut kertas | Maksimal 600 karakter per blok |
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

**CORS** diatur di bagian CORS `docs/api/openapi.yaml`. Sejak 0.2.3, `http://localhost:3000` tidak diterima di produksi, jadi `pnpm dev` memakai mock API atau stack Supabase lokal ([Mulai lokal](#mulai-lokal)).

**Region fungsi.** Semua panggilan ke fungsi Supabase membawa `?forceFunctionRegion=ap-southeast-2` (kontrak 0.2.2, `useLetterApi`), termasuk SSR halaman surat dari Vercel `sin1`. DB dan Storage ada di Sydney; tanpa query ini fungsi jalan di Singapura dan setiap query bolak-balik ke Sydney (`GET /l/:slug` median sekitar 1,0 detik, dengan query sekitar 0,55 detik). Unggahan ke `signedUrl` dan mock lokal tidak memakainya.

**Mock API.** `apps/web/server/routes/mock-api/` meniru kelima endpoint di atas dan endpoint kotak bareng (kontrak 0.3.0, `server/utils/mock-boxes.ts`) (validasi, kode error, upload ke URL bertanda tangan) dengan data di memori, supaya alur "Buat link" dan halaman penerima bisa dibangun sebelum backend siap. Body `POST /letters` diperiksa langsung dengan skema di `docs/api/openapi.yaml` (ajv, `server/utils/contract.ts`): yang tidak sesuai skema dijawab `400` beserta `details` berisi lokasi field-nya, sedangkan isi yang ditolak (preset tidak dikenal, kunci foto tidak cocok, cover, `replyTo`, batas per jenis elemen) dijawab `422`. Jadi kalau kontraknya berubah, mock ikut berubah. `test/contract.test.ts` memastikan body dari klien lolos skema, dan E2E `mock-api.spec.ts` mencocokkan setiap respons mock dengan skemanya. Nyalakan dengan `NUXT_MOCK_API=1` dan `NUXT_PUBLIC_API_BASE=/mock-api` (contohnya di `apps/web/.env.example`); E2E selalu memakainya, produksi tidak. `/lab/kirim` menjalankan alur kirim dari ujung ke ujung: kompres foto, render gambar OG, kirim, baca, buka, lalu hapus.

## Kotak surat

Surat dari link hilang 30 hari setelah dikirim dan fotonya 7 hari setelah dibuka (kontrak), jadi penerima bisa menyimpannya di perangkatnya ([PRD Modul 4](prd/PRD-PostPocket.md#modul-4-kotak-surat)). Tidak ada perubahan backend: semuanya di IndexedDB.

- **Simpan surat** (`KeepLetter` di `/l/:slug`) memanggil `useSavedLetters().keep()`. Foto depan dan foto isi diunduh dari URL publiknya, disimpan sebagai momen lewat `useMemories().addMoments()`, baru suratnya dicatat (`utils/saved-letters.ts`). Jadi surat tersimpan tidak pernah menunjuk foto yang belum ada, dan fotonya ikut sinkron Pocket kalau login menyala. Foto yang sudah dihapus server (404, atau 400 dari Storage) jadi placeholder; gangguan koneksi menghentikan proses tanpa menyimpan setengah. Data surat tersimpan ditulis lewat `update()` idb-keyval dalam satu transaksi, jadi tab atau jendela PWA lain tidak tertimpa, dan tampilan baru berubah setelah tulisannya berhasil.
- **Satu CD per folder.** Foto surat di folder "Surat untukmu" masuk CD "Surat untukmu"; CD-nya dicatat di folder (`album`) dan dibuat lagi kalau sudah dihapus. Setelah tiap penyimpanan (juga yang terputus di tengah), CD-nya dicocokkan lagi dengan semua surat di folder itu. Menghapus surat atau folder dari Kotak surat tidak menghapus fotonya dari CD. `/tv?album=<id>` langsung memutar CD itu.
- **Unduh foto** (`utils/letter-photos.ts`): di iPhone dan iPad lewat lembar Bagikan (`navigator.share({ files })`), karena unduhan biasa masuk app File, bukan Foto. Di tempat lain unduhan biasa berjeda 350 ms. Fotonya diunduh lebih dulu begitu bagian Simpan tampil, karena Safari menolak lembar Bagikan kalau ketukannya sudah lama berlalu. Kalau belum selesai saat diketuk, ketukan itu memakai unduhan yang sedang berjalan, dan di iPhone ketukan berikutnya yang membuka lembar Bagikan.
- **Folder kaca** (`GlassFolder`): panggung 340 × 272 yang diskalakan ke lebar folder. Seninya dilukis di kanvas dari resep `kotak.folders` (`utils/folder-art.ts`), bertahap paling lama 6 ms per frame lewat satu antrean (`utils/folder-paint.ts`) dan disimpan per resep dan ukuran. Tanpa GPU (`data-render="cpu"`) dan dengan `prefers-reduced-transparency`, kacanya tidak dikaburkan tapi lapisan warnanya lebih pekat. Lembar yang menyembul di atas kaca bisa diketuk; bagian di balik kaca menutup folder. Nama dan tanggal di lembar ada di label putih, jadi terbaca di atas gambar depan apa pun. Saat terbuka, ruang di atas folder membesar sesuai jumlah lembar di kipas (`openRoom()`), jadi kipasnya tidak menutupi judul di atasnya; halaman yang memuat folder memakai `overflow-x-clip`, jadi kipas yang melewati tepi layar HP tidak membuat halaman bisa digeser. Folder condong hanya saat disorot mouse (`@media (hover: hover)`) atau difokus keyboard (`:focus-visible`), karena di HP `:hover` dan fokus menempel setelah diketuk. Folder `sealed` tidak bisa dibuka, memakai cap tanggal, dan bergoyang saat diketuk.
- **Penampil** (`LetterViewer`): kartu tumbuh dari lembar yang diketuk (`origin`), lalu Sebelumnya dan Berikutnya menggeser kartu. Kartu yang sedang keluar dibuat `inert` dan `aria-hidden`, jadi hanya satu surat yang aktif. Setiap kali penampil dibuka, kartunya mulai tertutup. Tanpa lembar asal (dibuka dari daftar, atau lembarnya di luar layar), kartunya naik dari bawah, dan selama bergerak kartunya tidak bisa diketuk. "Baca lebih besar" (`LetterReader`, z-60) menutupi penampil. Di surat pertama dan terakhir fokus keyboard pindah ke tombol arah sebaliknya, dan kalau lembar yang membuka penampil ikut terhapus, fokus kembali ke `fallbackFocus` (judul halaman Kotak surat). Aksi tambahan, misalnya Hapus di Kotak surat, ada di kepala penampil, jadi tinggi kakinya tetap. Tanpa GPU atau dengan `prefers-reduced-motion`, animasinya langsung ke keadaan akhir (`calmMotion()`).

## Kotak bareng

Banyak pengirim, satu penerima ([PRD Modul 4](prd/PRD-PostPocket.md#modul-4-kotak-surat), kontrak 0.3.0, [rancangan backend](backend.md#rancangan-kotak-bareng)). Selama Edge Function `boxes` dan `k` belum ter-deploy, frontend memakai mock, dan semua halamannya 404 kecuali `NUXT_PUBLIC_KOTAK_BARENG=1` (E2E selalu menyalakannya; produksi menyala setelah backend siap).

- **Pembuat**: `/kotak/baru` memanggil `POST /boxes`, lalu menyimpan `editToken` di IndexedDB (`utils/my-boxes.ts`) seperti surat terkirim. Kalau browser menolak menyimpannya, kedua link langsung ditampilkan di halaman itu. Hanya browser itu yang bisa membuka `/kotak/:id`, dan tokennya hanya dilupakan kalau server menjawab `box_not_found`. Halaman kelola memuat ulang saat dibuka lagi tanpa menimpa hasil aksi yang lebih baru, dan "Buka sekarang" mengirim `openNow`, jadi jam HP tidak dipakai; status terbukanya dari `openable`. Hasil aksi tampil di bagian yang tombolnya ditekan (`BoxMessage`), dan setelah kotak terbuka link titip tidak ditawarkan lagi. `/kotak/baru` mengingatkan bahwa kotak hanya bisa dikelola dari browser itu, apalagi kalau terbuka di browser bawaan aplikasi lain.
- **Teman yang menitip**: `/titip/:kode` (SSR, `noindex`, OG `og-titip.jpg`) membuka editor dengan `?titip=<kode>`. Draf menyimpan kotak tujuan dan nama pengirim (`draft.box`, `draft.from`); kotaknya tetap saat strip Booth masuk lewat Pakai di surat. Surat titipan dikirim tanpa gambar OG, dan dicatat di Surat terkirim dengan `titip`, jadi bisa ditarik lagi dari halaman titip. Kalau kotaknya gagal dimuat karena koneksi, `?titip=` dikembalikan ke alamat supaya muat ulang mencoba lagi. Titipan yang ditolak karena kotaknya dihapus, ditutup, atau penuh tidak ditawari Coba lagi.
- **Penerima**: `/k/:slug` (SSR, `noindex`, OG `og-kotak.jpg`). Sebelum `openable`, folder tersegel; halaman memuat ulang sendiri saat jadwalnya tiba, atau sekali semenit untuk kotak manual, selama tab terlihat. Membuka surat pertama memanggil `POST /k/:slug/open`, kecuali di browser pembuatnya. Surat yang sudah dibuka dicatat di `localStorage` (`utils/box-read.ts`) untuk titik "belum dibuka". "Simpan semua" (`KeepBox`) menyimpan semua titipan ke folder `kotak-<slug>` di Kotak surat dengan satu CD. Tab yang kembali terlihat langsung memeriksa kotak yang masih disegel, kotak yang terbuka sendiri diumumkan ke pembaca layar, dan halaman yang gagal dimuat punya tombol Muat ulang.
- **Seni folder** satu kotak sama di halaman penerima, halaman kelola, dan Kotak surat (`folderSeed(slug)`); halaman titip memakai kode titipnya.
- **Waktu** (`utils/box-time.ts`): halaman yang di-SSR menulis WIB dulu, lalu zona waktu HP setelah dimuat (WIB, WITA, WIT, atau singkatan browser di luar Indonesia). Halaman yang hanya dirender di browser langsung memakai zona HP, sama dengan jam yang dipilih di input jadwal.
- **Unduh semua foto** (`KeepBox`): fotonya baru diunduh saat diminta, karena bisa puluhan. Di iPhone ketukan pertama menyiapkannya dan ketukan kedua membuka lembar Bagikan, karena Safari menolak lembar Bagikan kalau ketukannya sudah lama berlalu.
- **Halaman pribadi**: `/k/…` dan `/titip/…` tidak pernah disimpan service worker (`isPrivatePath()`).
- Gambar OG kotak dibuat ulang dengan `node scripts/og-images.mjs og-kotak.jpg og-titip.jpg`.

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

- [x] Editor isi surat dengan 4 template, teks tulisan tangan, foto (maksimal 4), dan stiker. Editornya DOM, bukan vue-konva ([keputusan](spikes/editor-isi-surat.md))
- [x] Alur "Buat link": kompres tiap foto sampai di bawah 500 KB (JPEG atau WebP), hapus EXIF lokasi, upload ke URL bertanda tangan, lalu publish (kontrak dari `docs/api/openapi.yaml`). Diuji lewat mock API; begitu Edge Function siap tinggal ganti `NUXT_PUBLIC_API_BASE`
- [x] Gambar OG dirender di browser waktu "Buat link" dari kartu yang sama: JPEG 1200×630 maksimal 300.000 byte, diunggah lewat URL bertanda tangan seperti foto. Jangan pasang Nuxt OG Image
- [x] Halaman penerima `/l/:slug` dengan animasi buka di bawah 600 ms dan tombol Bikin balasan; placeholder di slot foto kalau fotonya sudah dihapus (7 hari setelah surat pertama kali dibuka), dan sampul polos kalau cover dari foto user ikut dihapus
- [x] `/l/**` di-SSR lewat `routeRules` dengan header `X-Robots-Tag: noindex`, dan meta tag OG memakai URL gambar OG dari `GET /l/:slug`, atau gambar OG bawaan kalau sudah dihapus
- [x] Region fungsi Vercel `sin1` (Singapura), bukan US. Supabase-nya di Sydney (`ap-southeast-2`), bukan Singapura ([Deploy](#deploy))
- [x] Gerbang: link terbuka di HP lain tanpa login dan preview-nya tampil di WhatsApp ([cara cek](#gerbang-sprint-2)), lolos 13 Oktober 2026

**Sprint 3 (minggu 6–7)**

- [x] Halaman TV: badan clay dengan 8 warna, panel filter, rak CD (ketuk punggung untuk memilih, ketuk lagi untuk membuka, lalu seret piringan ke TV atau tekan Masukkan CD; piringan terbang ke slot), slideshow
- [x] Booth: hitung mundur, strip 1×4 / 2×2 / satu foto dengan pratinjau bentuk hasilnya di layar, unduh PNG dengan filter yang sama dengan layar
- [x] Kirim hasil Booth ke Letter

**Sprint 4 dan beta (minggu 8–10)**

- [x] Pocket: kalender, modal simpan hari, buka kantong, album otomatis per bulan ke TV
- [x] `navigator.storage.persist()` dan ajakan pasang PWA ([PWA](#pwa))
- [ ] Uji di 3 HP; perbaiki bug dari tester

**Fase 2: login dan sinkron Pocket** (skema sudah di produksi sejak #50, [rancangan](backend.md#rancangan-skema-fase-2))

- [x] Id momen dan album jadi UUID, data lama diganti saat dimuat (#48)
- [ ] OAuth client Google (Google Cloud) dan provider Google di Supabase Auth
- [ ] Login Google dan halaman akun. Surat tetap bisa dibuat dan dibuka tanpa login
- [ ] Sinkron dua arah sesuai catatan Sinkron di rancangan:
  - tarik dengan jendela 5 menit, penerapannya idempoten;
  - momen yang hilang dari `moment_ids` kantong ditempel lagi;
  - unggah versi kompres ke `<owner_id>/<id>.jpg`.
- [ ] Pesan saat kuota penuh (`23514`, 100 foto) dan saat unggah ditolak policy (Storage menjawab `400`)
- [ ] `/privasi` menjelaskan akun Google dan cadangan foto, sebelum login dibuka
- [ ] Sinkron baru dinyalakan di produksi setelah job pembersihan berkas dan baris berstatus hapus dari Bintang ada

**Kotak surat** ([PRD Modul 4](prd/PRD-PostPocket.md#modul-4-kotak-surat))

- [x] Simpan surat dan Unduh foto di halaman penerima; fotonya masuk CD "Surat untukmu" di TV
- [x] Halaman `/kotak` dengan folder kaca, baca surat satu per satu, hapus surat dan folder
- [ ] Animasi folder kaca dan penampil dicek di iPhone dan Android sungguhan ([langkah 9](#uji-di-hp-sungguhan))
- [x] Kotak bareng di atas mock (kontrak 0.3.0): bikin dan kelola kotak, titip dari editor dan Booth, kotak tersegel, baca satu per satu, Simpan semua
- [ ] Kotak bareng menyala di produksi (`NUXT_PUBLIC_KOTAK_BARENG=1` di Vercel) setelah Edge Function `boxes` dan `k` dari Bintang ter-deploy, lalu dicek dengan langkah 10

## PWA

PostPocket bisa dipasang ke layar utama lewat `@vite-pwa/nuxt` (manifest dan service worker). Service worker hanya ada di build production; `pnpm dev` tidak memakainya, jadi cek PWA lewat `pnpm build && node apps/web/.output/server/index.mjs` atau `pnpm test:e2e`.

| Yang disimpan | Cara | Kenapa |
| --- | --- | --- |
| JS, CSS, ilustrasi, ikon, stiker, `offline.html` | Precache saat service worker dipasang | Aplikasi tetap jalan tanpa sinyal |
| Halaman | Jaringan dulu, salinan terakhir kalau offline. Beranda, editor surat, Pocket, TV, Kotak surat, dan halaman pertama disimpan sejak kunjungan pertama | Selalu versi terbaru, tapi tetap bisa dibuka offline; draf surat, kenangan, dan surat tersimpan memang ada di IndexedDB, dan Pocket, TV, serta Kotak surat hanya dirender di browser, jadi salinan halamannya tidak memuat data pribadi |
| Font (`/_fonts/`) | Disimpan saat dipakai | Hanya subset yang benar-benar dimuat |
| Surat penerima (`/l/…`), kotak bareng (`/k/…`), dan halaman titip (`/titip/…`) | Tidak pernah disimpan | Isinya pribadi |

- Halaman yang belum pernah tersimpan menampilkan `offline.html` saat offline.
- Versi baru tidak langsung dipakai. Toast "Versi baru PostPocket siap" muncul dan user memilih kapan memuat ulang, supaya tulisan yang sedang diketik tidak hilang.
- Kartu "Pasang PostPocket" di Beranda memakai dialog pasang bawaan Chrome, atau petunjuk Tambah ke Layar Utama di iPhone. Aplikasi yang terpasang meminta `navigator.storage.persist()`, dan Safari tidak menghapus datanya setelah 7 hari.
- Begitu foto pertama tersimpan di perangkat (kenangan Pocket, Booth, foto dari TV, atau foto draf surat), browser juga diminta menyimpan secara permanen. Chrome dan Safari memutuskannya sendiri, Firefox menanyakan izin sekali.
- Halaman baru yang menampilkan data pribadi wajib dikecualikan dari cache: tambahkan ke `isPrivatePath()` di `app/utils/pwa.ts` dan aturan `runtimeCaching` di `nuxt.config.ts`.
- Ikon aplikasi dibuat ulang dengan `node scripts/pwa-icons.mjs` dari folder `apps/web`.

## Uji di HP sungguhan

Item checklist yang tersisa dicek sekali jalan dengan daftar di bawah:
- benchmark dan kamera (Sprint 0);
- gerbang 50 fps (Sprint 1);
- uji di 3 HP (beta);
- animasi Kotak surat (langkah 9).

Pakai tiga HP: iPhone (Safari), Android kelas menengah (Chrome), dan satu Android lain, lebih bagus lagi kalau yang murah. Semua dibuka di domain produksi, karena kamera butuh HTTPS.

| # | Lakukan | Yang harus terjadi |
| --- | --- | --- |
| 1 | Buka `/lab/foil?bench=1`, tunggu 4 detik, lalu tekan "Salin hasil" di langkah 5 | Hasil fps dan p95 tersalin. Gerbang: di atas 50 fps di Android kelas menengah |
| 2 | Buka `/lab/safari` | Semua cek lolos, dan kamera tampil setelah diberi izin |
| 3 | Tulis surat: foto depan dari galeri (HEIC di iPhone), coba Detail, Bayangan, dan Satu warna, isi 2 foto dan stiker, lalu Buat link | Kartu berubah langsung, link keluar, dan foto tidak tertutup foil |
| 4 | Kirim link-nya lewat WhatsApp ke HP lain, buka, ketuk kartu, lalu Bikin balasan | Preview muncul, surat terbuka tanpa login, dan animasi bukanya mulus |
| 5 | Pocket: simpan hari dengan 3 foto, buka kantong dengan ketukan lalu dengan goresan, geser foto di tali, ganti desain, lalu hapus kantong | Foto keluar dari mulut kantong, tali bisa digeser, tidak patah-patah |
| 6 | TV: putar album bulan ini, seret CD ke TV, ganti filter | CD terbang ke slot dan slideshow jalan dengan filter |
| 7 | Booth: ambil strip 1×4, simpan ke Pocket dan CD, lalu Pakai di surat | Hitung mundur jalan, strip sesuai pratinjau, dan muncul di surat |
| 8 | Pasang ke layar utama, nyalakan mode pesawat, buka Pocket dan TV | Keduanya tetap terbuka offline, lengkap dengan foto |
| 9 | Buka surat berfoto dari link WhatsApp, Simpan surat, lalu Unduh foto. Buka Kotak surat, buka foldernya, ketuk salah satu surat, geser ke surat berikutnya, lalu nyalakan mode pesawat dan buka lagi | Foto masuk app Foto (iPhone) atau galeri (Android). Folder condong dan menyebar tanpa patah-patah, kartu keluar dari lembarnya, dan surat tetap terbuka offline |
| 10 | Setelah kotak bareng menyala: bikin kotak, bagikan link titip ke grup, titip dari dua HP (satu dengan strip Booth), lalu buka link penerima di HP ketiga sebelum dan sesudah Buka sekarang | Preview WhatsApp tampil untuk kedua link, kotak tersegel lalu terbuka sendiri, surat dibaca satu per satu, dan Simpan semua masuk Kotak surat |

Laporan per HP berisi:
- model HP, versi OS, dan browser;
- hasil langkah 1;
- nomor langkah yang bermasalah, beserta screenshot.

Kalau ketiga HP lolos, centang item-item itu di checklist.

- `/lab/foil?bench=1` menjalankan benchmark otomatis; hasilnya muncul di pojok kanan atas dan bisa disalin dari langkah 5. Parameter lain: `?flip=1` (sampul belakang) dan `?open=1` (kartu terbuka).
- `/lab/safari` memeriksa `ctx.filter`, OffscreenCanvas, WebGL2, IndexedDB, dan kamera. Kamera hanya jalan di HTTPS: buka di domain produksi, atau `pnpm dev --host` lalu tunnel HTTPS.

Domain produksi: [postpocket.vercel.app/lab/foil?bench=1](https://postpocket.vercel.app/lab/foil?bench=1) dan [postpocket.vercel.app/lab/safari](https://postpocket.vercel.app/lab/safari).

## Gerbang Sprint 2

Begitu Edge Function `letters` dan `l` ter-deploy, gerbangnya dicek dalam tiga langkah:

1. `LIVE_BASE_URL=https://postpocket.vercel.app pnpm --filter @postpocket/web exec playwright test --project=android` menjalankan `e2e/live.spec.ts` ke backend asli: kirim surat berfoto, buka dari konteks browser baru tanpa login (seperti HP lain), cek aturan preview WhatsApp, lalu hapus suratnya lagi. Tes lain dilewati dan server lokal tidak dinyalakan. Uji ini membuat satu surat sungguhan, jadi ikut dihitung rate limit (10 surat per jam per IP).
   - Tiap langkah dibatasi 30 detik. Kalau ada yang macet, tes gagal sebelum batas 120 detik, dan surat ujinya tetap dihapus.
   - Hasil tiap run disimpan di folder sendiri, `apps/web/test-results/live-<waktu>/`, jadi run berikutnya tidak menghapusnya. Trace hanya ada untuk tes yang gagal. Buka dengan `pnpm --filter @postpocket/web exec playwright show-trace <folder>/trace.zip`.
   - Kalau `POST /l/:slug/open` tidak dijawab, pesan gagalnya mendaftar semua panggilan fungsi dari "HP lain", termasuk preflight yang gagal.
2. `pnpm --filter @postpocket/web check:preview <link surat>` memeriksa satu link seperti crawler WhatsApp. Syarat preview: halaman 200 tanpa login, meta OG ada di HTML dari server, gambar OG https, JPEG atau PNG, 1200×630, dan maksimal 300.000 byte. Cek privasinya: halaman surat wajib `noindex`. Aturannya di `apps/web/scripts/link-preview.mjs`, dan E2E `kirim-terima.spec.ts` ikut memakainya dengan mock.
3. Terakhir, cek manual: kirim linknya lewat WhatsApp ke HP lain, pastikan preview (judul dan sampul) muncul dan suratnya terbuka tanpa login.

Langkah 1 hanya bisa jalan ke backend asli, karena tesnya mengecek region fungsi dan header dari Supabase, jadi mock tidak bisa dipakai. Sejak kontrak 0.2.3, ini juga satu-satunya cara menguji backend asli dari browser: `pnpm dev` dan preview Vercel ditolak CORS.

Hasil 13 Oktober 2026, setelah region fungsi Sydney (#31, #33) ter-deploy:

| Langkah | Hasil |
| --- | --- |
| 1. Tes live | Lolos di Android dan iPhone. Semua panggilan fungsi dijawab dari `ap-southeast-2` |
| 2. `check:preview` | Semua aturan lolos untuk surat dari Bintang: halaman 200, gambar OG JPEG 1200×630 sebesar 162.145 byte, `noindex` |
| 3. WhatsApp | Kall dan Bintang saling kirim surat. Preview tampil dan suratnya terbuka tanpa login |

## Deploy

Proyek Vercel `postpocket` (Hobby, akun Kall) tersambung ke repo ini lewat GitHub. Setiap push ke `main` deploy ke produksi di [postpocket.vercel.app](https://postpocket.vercel.app), setiap PR dapat preview.

| Setting | Nilai |
| --- | --- |
| Root directory | `apps/web`, file di luar root ikut di-build (misalnya `packages/presets`) |
| Framework dan Node | Nuxt, 24.x |
| Region fungsi | `sin1` (Singapura), dekat dengan pengguna di Indonesia. Supabase ada di Sydney (`ap-southeast-2`) |
| Env production, preview, development | `NUXT_PUBLIC_SUPABASE_URL` dan `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, nilainya sama dengan `apps/web/.env` |

- Preview dilindungi Vercel Authentication, jadi hanya bisa dibuka akun pemilik proyek. Domain produksi terbuka untuk siapa saja.
- Sejak kontrak 0.2.3, Edge Functions hanya menerima origin domain produksi. Di preview, halaman surat masih terbuka lewat SSR, tapi "Buat link" dan menandai surat dibuka ditolak CORS. Alur kirim diuji di E2E (mock) dan tes live (produksi).
- Env baru atau yang berubah baru terpakai di deploy berikutnya. Hanya nilai yang aman di browser yang boleh masuk sini; secret key tetap di Supabase.
