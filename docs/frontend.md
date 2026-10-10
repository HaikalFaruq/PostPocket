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

## Struktur

```text
apps/web/
  app/assets/css/main.css   design token (@theme Tailwind) dan gaya dasar
  app/components/           komponen bersama dari PRD, dipanggil tanpa prefix: <StepCard>, <PillGroup>, ...
  app/components/letter/    komponen khusus Letter: FoilCard, FoilSwatchIcon
  app/composables/          useCardMotion: drag, pegas, kilau, benchmark kartu
  app/utils/                logika murni (card-motion, color, foil, icons), diuji di test/
  app/pages/                / (Beranda), /lab, /lab/foil, /lab/safari
  public/illustrations/     ilustrasi depan kartu, hasil scripts/illustrations.mjs
  e2e/                      skenario Playwright
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

- [ ] Halaman `/letter/new` dengan langkah 1 sampai 4 (gambar depan, bagian foil, warna foil, kertas), kartu berubah langsung tanpa reload
- [ ] Upload, drop, dan paste foto sendiri untuk gambar depan; bentuk Asli, Portrait, Square, Landscape
- [ ] Peta foil dari gambar di browser: Detail (deteksi tepi), Bayangan (threshold), Satu warna
- [ ] Surprise me memakai `surprise()` dari preset, dengan animasi kartu berputar sekali
- [ ] Draf otomatis di IndexedDB; refresh tidak menghilangkan isi
- [ ] Gerbang: kartu foil di atas 50 fps di HP Android kelas menengah

**Sprint 2 (minggu 4–5)**

- [ ] Editor isi surat (vue-konva) dengan 4 template, teks Caveat, foto, dan stiker
- [ ] Alur "Buat link": kompres foto, hapus EXIF lokasi, upload ke URL bertanda tangan, publish (kontrak dari `docs/api/openapi.yaml`)
- [ ] Halaman penerima `/l/:slug` dengan animasi buka di bawah 600 ms dan tombol Bikin balasan
- [ ] `/l/**` di-SSR lewat `routeRules` dengan header `X-Robots-Tag: noindex`, karena crawler WhatsApp tidak menjalankan JavaScript
- [ ] Meta tag OG memakai URL gambar OG dari `GET /l/:slug` (dirender backend saat publish, di bawah sekitar 300 KB); jangan pasang Nuxt OG Image
- [ ] Region fungsi Vercel `sin1`, dekat dengan Supabase di Singapore
- [ ] Gerbang: link terbuka di HP lain tanpa login dan preview-nya tampil di WhatsApp

**Sprint 3 (minggu 6–7)**

- [ ] Halaman TV: badan clay dengan 8 warna, panel filter, arsip CD coverflow, slideshow
- [ ] Booth: hitung mundur, strip 1×4 / 2×2 / satu foto, unduh PNG dengan filter yang sama dengan layar
- [ ] Kirim hasil Booth ke Letter

**Sprint 4 dan beta (minggu 8–10)**

- [ ] Pocket: kalender, modal simpan hari, buka kantong, album otomatis per bulan ke TV
- [ ] `navigator.storage.persist()` dan ajakan pasang PWA
- [ ] Uji di 3 HP; perbaiki bug dari tester

## Uji di HP sungguhan

- `/lab/foil?bench=1` menjalankan benchmark otomatis; hasilnya muncul di pojok kanan atas dan bisa disalin dari langkah 5. Parameter lain: `?flip=1` (sampul belakang) dan `?open=1` (kartu terbuka).
- `/lab/safari` memeriksa `ctx.filter`, OffscreenCanvas, WebGL2, IndexedDB, dan kamera. Kamera hanya jalan di HTTPS: pakai preview deploy, atau `pnpm dev --host` lalu tunnel HTTPS.
