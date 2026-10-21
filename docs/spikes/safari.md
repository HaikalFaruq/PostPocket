# Spike: filter kanvas dan kamera di Safari

Sprint 0 · 10 Oktober 2026 · Kall

## Ringkasan

**Safari tidak mendukung `ctx.filter`.** Filter CSS di layar (video Booth, foto di TV) jalan, tapi saat foto diekspor ke kanvas filternya hilang begitu saja. Ini persis risiko di PRD. Jalur cadangannya sudah dibuat dan diuji: `drawFiltered()` di `apps/web/app/utils/photo-filter.ts` menerjemahkan string filter preset jadi matriks warna sesuai spesifikasi Filter Effects, lalu menerapkannya ke piksel. Hasilnya hampir identik dengan `ctx.filter` asli Chrome.

## Hasil cek fitur (`/lab/safari`)

| Fitur | Chromium 156 | WebKit 27.2 (engine Safari) |
| --- | --- | --- |
| `ctx.filter` mengubah piksel | Ya | **Tidak**, properti tidak ada |
| 7 filter TV lewat `ctx.filter` | Semua berubah sesuai harapan | Piksel tetap untuk semua |
| `OffscreenCanvas` dengan `filter` | Ya | Tidak |
| WebGL2 | Ya | Ya |
| `getUserMedia` | Ada | Ada |
| `navigator.storage.persist` | Ada | Ada |
| IndexedDB, `createImageBitmap` | Ada | Ada |

Karena WebKit versi terbaru belum punya `ctx.filter`, Safari iOS yang sudah rilis juga belum punya.

## Akurasi jalur cadangan

Gambar uji gradien warna 96×64 diproses dua cara di Chromium: `ctx.filter` asli dan jalur cadangan. Selisihnya dihitung per kanal (skala 0–255, tepi 4 px dilewati):

| Filter | Selisih maks | Rata-rata |
| --- | --- | --- |
| Normal | 0 | 0 |
| Kodak | 3 | 0,81 |
| Noir | 2 | 0,87 |
| Glitch | 1 | 0,28 |
| VHS (termasuk blur 0,4 px) | 3 | 0,90 |
| Cyan | 2 | 0,34 |
| Velvia | 2 | 0,26 |

E2E memastikan selisih maksimumnya tetap ≤ 4 di Chromium, dan memastikan foto upload dengan filter Noir benar-benar jadi abu-abu di WebKit.

Catatan: efek tambahan di preset (`rgb-split` untuk Glitch, `scanlines` dan `noise` untuk VHS) bukan bagian CSS filter. Efek ini harus digambar terpisah di layar maupun saat ekspor (Sprint 3).

## Kamera

Simulator iOS tidak punya kamera, dan `getUserMedia` butuh HTTPS, jadi kamera diuji di HP sungguhan lewat `/lab/safari`: nyalakan kamera depan, ganti ke kamera belakang, ambil foto dengan filter, lalu bandingkan video live (CSS filter) dengan hasil ekspor. Kalau izin kamera ditolak, halaman menampilkan pesan dan opsi upload foto.

- [x] Uji di iPhone (Safari) lewat HTTPS: preview deploy, atau `pnpm dev --host` ditambah tunnel HTTPS. Lolos 22 Oktober 2026.
- [x] Uji di Chrome Android. Lolos 22 Oktober 2026.

## Dampak ke rencana

- Booth dan ekspor TV memakai `drawFiltered()`, bukan `ctx.filter` langsung.
- Jalur cadangan berjalan di thread utama, sekitar 50 juta operasi untuk foto 2048 px. Kalau terasa lambat saat ekspor, pindahkan ke Web Worker (pakai `ImageData`, karena OffscreenCanvas di Safari tidak punya `filter`) atau ke shader WebGL2.
