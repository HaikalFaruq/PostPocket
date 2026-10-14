# Sumber dan lisensi aset

Setiap aset yang masuk repo dicatat di sini (PRD bagian Risiko: lisensi aset tidak jelas). Aset dari tiga web referensi tidak boleh masuk repo.

| Aset | Lokasi | Sumber | Lisensi |
| --- | --- | --- | --- |
| Font Gantari (Lafontype), Delicious Handrawn (Agung Rohmat), VT323 | Diunduh saat build oleh `@nuxt/fonts` | Google Fonts | SIL Open Font License 1.1 |
| Ilustrasi depan kartu (padang bunga, ranting, malam berbintang) dan tanda sampul belakang | `apps/web/public/illustrations/` | Dibuat sendiri, hasil `apps/web/scripts/illustrations.mjs` | Milik sendiri |
| Ikon garis (chevron, tutup, kamera, dan lainnya) | `apps/web/app/utils/icons.ts` | Digambar sendiri | Milik sendiri |
| Ikon bunga di swatch warna foil | `apps/web/app/components/letter/FoilSwatchIcon.vue` | Digambar sendiri (SVG) | Milik sendiri |
| Favicon amplop | `apps/web/public/favicon.svg` | Digambar sendiri | Milik sendiri |
| Ikon aplikasi (PWA dan layar utama iPhone) | `apps/web/public/pwa-*.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` | Dibuat sendiri dari amplop favicon, hasil `apps/web/scripts/pwa-icons.mjs` | Milik sendiri |
| Foto contoh pantai senja | `apps/web/public/samples/contoh-foto.svg` | Digambar sendiri (SVG) | Milik sendiri |
| Gambar OG bawaan (`og-surat.jpg`, `og-beranda.jpg`) | `apps/web/public/` | Disusun dari ilustrasi padang bunga, favicon, dan warna foil emas sendiri, hasil `apps/web/scripts/og-images.mjs` (font Gantari dari Google Fonts, bingkai par avion) | Milik sendiri; Gantari SIL Open Font License 1.1 |
| Kantong snack Pocket dan jepitan kayunya | `apps/web/app/components/pocket/SnackPacket.vue` | Digambar sendiri dengan CSS (gradien dan clip-path bergerigi), tanpa file gambar | Milik sendiri |
| Folder kaca Kotak surat: panel belakang bercorak cairan, kaca buram, dan lembar surat | `apps/web/app/components/kotak/GlassFolder.vue`, `apps/web/app/utils/folder-art.ts`, `apps/web/app/utils/folder-paint.ts`, resepnya di `packages/presets/kotak.json` | Diadaptasi ke Vue dari komponen React [Glassmorphism Folder Cards](https://21st.dev/kedhareswer/glass-folder-cards/default) karya Kedhareswer Naidu di 21st.dev, dibagikan Kall (14 Oktober 2026). Seninya digambar di browser dari resep, tanpa file gambar | MIT, pemberitahuannya di [Lisensi kode pihak ketiga](#lisensi-kode-pihak-ketiga) |
| Folder kaca kecil di Beranda | `apps/web/app/components/kotak/FolderMini.vue` | Digambar sendiri dengan CSS (gradien dan clip-path) | Milik sendiri |
| Tekstur serat kertas dan butiran kilau foil | `--texture-paper` dan `--texture-glitter` di `apps/web/app/assets/css/main.css` | Noise SVG `feTurbulence` | Milik sendiri |
| Logo G Google di tombol "Masuk dengan Google" | `apps/web/app/components/GoogleMark.vue` | [Pedoman branding Sign in with Google](https://developers.google.com/identity/branding-guidelines), dipakai utuh tanpa diubah warna atau bentuknya | Merek dagang Google, boleh dipakai untuk tombol login sesuai pedoman itu |
| Stiker isi surat dan Pocket (21 buah) | `apps/web/public/stickers/` | [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) gaya 3D, commit `1ffb34c`, diperkecil ke WebP 192 px oleh `apps/web/scripts/stickers.mjs` | MIT, teks lisensinya di `apps/web/public/stickers/LICENSE` |

Screenshot tiga web referensi tidak disimpan di repo karena repo public; yang ada di `docs/reference/` hanya ukuran dan catatan.

## Pustaka dengan lisensi khusus

Pustaka npm lain berlisensi permisif (MIT, Apache, ISC). Yang di bawah ini perlu perlakuan khusus.

| Pustaka | Dipakai untuk | Lisensi | Catatan |
| --- | --- | --- | --- |
| `libheif-js` 1.23.2, berisi libheif dan libde265 (WebAssembly) | Mengubah foto HEIC ke JPEG di browser yang tidak bisa membukanya sendiri (Chrome, Firefox); Safari tidak memakainya | LGPL-3.0, teks lisensinya ada di paket npm | Dibundel tanpa diubah sebagai berkas terpisah `heic.worker-*.js`, jadi bisa diganti versi lain sesuai syarat LGPL. Hanya dimuat saat ada foto HEIC dan tidak ikut precache PWA. Format HEVC punya urusan paten; untuk beta gratis risikonya kecil, ditinjau lagi sebelum ada model bisnis. Versinya dipatok persis. |
| Foto uji `apps/web/e2e/fixtures/foto.heic` | E2E HEIC | Milik sendiri | Gradien buatan sendiri, diubah ke HEIC dengan `sips` di macOS |
| Foto uji `apps/web/e2e/fixtures/foto-kecil.jpg` | E2E Kotak surat | Milik sendiri | Gradien 32×24 buatan sendiri, dibuat dengan `ffmpeg` |
| Foto uji `apps/web/e2e/fixtures/foto-tanggal.heic` | Unit test tanggal EXIF HEIC | Milik sendiri | Pola warna buatan sendiri dengan EXIF DateTimeOriginal 2026:10:05 14:30:00, diubah ke HEIC dengan `sips` di macOS |

## Lisensi kode pihak ketiga

Kode yang disalin atau diadaptasi langsung ke repo, bukan dipasang lewat npm, membawa pemberitahuan lisensinya di sini.

### Glassmorphism Folder Cards

Sumber: [21st.dev/kedhareswer/glass-folder-cards](https://21st.dev/kedhareswer/glass-folder-cards/default), dipakai di `GlassFolder.vue`, `folder-art.ts`, dan `folder-paint.ts`. Halaman komponennya mencantumkan lisensi MIT tanpa teks lisensi, jadi pemberitahuannya ditulis dengan nama pembuatnya.

```text
MIT License

Copyright (c) Kedhareswer Naidu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
