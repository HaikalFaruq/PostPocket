# Sumber dan lisensi aset

Setiap aset yang masuk repo dicatat di sini (PRD bagian Risiko: lisensi aset tidak jelas). Aset dari tiga web referensi tidak boleh masuk repo.

| Aset | Lokasi | Sumber | Lisensi |
| --- | --- | --- | --- |
| Font Gantari (Lafontype), Delicious Handrawn (Agung Rohmat), VT323 | Diunduh saat build oleh `@nuxt/fonts`. Garis huruf "PostPocket" untuk tanda tangan splash disimpan di `apps/web/app/utils/brand-signature.ts` | Google Fonts | SIL Open Font License 1.1 |
| Ilustrasi depan kartu (padang bunga, ranting, malam berbintang, ulang tahun, Lebaran), masing-masing dalam empat bentuk kartu, dan tanda sampul belakang | `apps/web/public/illustrations/` | Dibuat sendiri, hasil `apps/web/scripts/illustrations.mjs` | Milik sendiri |
| Ikon garis (chevron, tutup, kamera, dan lainnya) | `apps/web/app/utils/icons.ts` | Digambar sendiri | Milik sendiri |
| Ikon bunga di swatch warna foil | `apps/web/app/components/letter/FoilSwatchIcon.vue` | Digambar sendiri (SVG) | Milik sendiri |
| Logo P-amplop (simbol, wordmark, lockup) dan favicon | `docs/brand/`, `apps/web/app/utils/brand-logo.ts`, `apps/web/public/favicon.svg` | Digambar sendiri dengan skill [logo-design](https://github.com/kaankiziltug/logo-design-skill) (MIT, hanya dipakai sebagai alat, tidak ada berkasnya yang disalin). Wordmark dari huruf Gantari ExtraBold yang dijadikan garis, hasil `apps/web/scripts/brand.mjs` | Milik sendiri; huruf Gantari SIL Open Font License 1.1 |
| Ikon aplikasi (PWA dan layar utama iPhone) | `apps/web/public/pwa-*.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` | Dibuat sendiri dari logo P-amplop di latar kanvas, hasil `apps/web/scripts/pwa-icons.mjs` | Milik sendiri |
| Foto contoh pantai senja (halaman `/lab` dan screenshot README) | `apps/web/app/assets/lab/contoh-foto.svg` | Digambar sendiri (SVG) | Milik sendiri |
| Screenshot README | `docs/screenshots/` | Diambil dari aplikasi sendiri dengan foto contoh di atas | Milik sendiri |
| Gambar OG bawaan (`og-surat.jpg`, `og-beranda.jpg`, `og-kotak.jpg`, `og-titip.jpg`) | `apps/web/public/` | Disusun dari ilustrasi padang bunga, logo P-amplop, warna foil emas, dan folder kaca sendiri, hasil `apps/web/scripts/og-images.mjs` (font Gantari dan Delicious Handrawn dari Google Fonts, kanvas berkisi titik) | Milik sendiri; Gantari SIL Open Font License 1.1 |
| Kantong snack Pocket dan jepitan kayunya | `apps/web/app/components/pocket/SnackPacket.vue` | Digambar sendiri dengan CSS (gradien dan clip-path bergerigi), tanpa file gambar | Milik sendiri |
| Folder kaca Kotak surat: panel belakang bercorak cairan, kaca buram, dan lembar surat | `apps/web/app/components/kotak/GlassFolder.vue`, `apps/web/app/utils/folder-art.ts`, `apps/web/app/utils/folder-paint.ts`, resepnya di `packages/presets/kotak.json` | Diadaptasi ke Vue dari komponen React [Glassmorphism Folder Cards](https://21st.dev/kedhareswer/glass-folder-cards/default) karya Kedhareswer Naidu di 21st.dev, dibagikan Kall (14 Oktober 2026). Seninya digambar di browser dari resep, tanpa file gambar | MIT, pemberitahuannya di [Lisensi kode pihak ketiga](#lisensi-kode-pihak-ketiga) |
| Figur garis Surat, Pocket, dan Photo Booth di Beranda | `apps/web/app/utils/hairline/surat.js`, `pocket.js`, `booth.js` | Digambar sendiri dengan skill `hairline-create` di atas mesin [Hairline](https://github.com/lucasmarkes/hairline) karya Lucas Marques (`apps/web/app/utils/hairline/kernel.js`, v0.5.1 commit 37d2e78, disalin apa adanya dengan satu baris `export`) | Figurnya milik sendiri; mesinnya MIT, pemberitahuannya di [Lisensi kode pihak ketiga](#lisensi-kode-pihak-ketiga) |
| Kerumunan orang di atas footer Beranda | `apps/web/public/peeps/open-peeps.webp` (hasil `apps/web/scripts/peeps.mjs`), `apps/web/app/components/beranda/CrowdStreet.vue` | [Open Peeps](https://www.openpeeps.com/) karya Pablo Stanley, dari lembar di [pen zadvorsky](https://codepen.io/zadvorsky/pen/xxwbBQV) yang dipakai Skiper 39 karya [Skiper UI](https://skiper-ui.com/); 36 orang, diwarnai tinta dan diperkecil. Gerakannya ditulis ulang dari Skiper 39 tanpa GSAP | Gambar CC0. Skiper UI versi gratis meminta atribusi: dicantumkan di `/lisensi` dan di komponennya |
| Tombol bertag di Beranda | `apps/web/app/components/beranda/TagButton.vue` | Diadaptasi ke Vue dari [Offer Button](https://21st.dev/positronx/offer-button/default) karya positronx di 21st.dev, dengan warna tinta PostPocket | MIT, pemberitahuannya di [Lisensi kode pihak ketiga](#lisensi-kode-pihak-ketiga) |
| Folder kaca kecil di Beranda | `apps/web/app/components/kotak/FolderMini.vue` | Digambar sendiri dengan CSS (gradien dan clip-path) | Milik sendiri |
| Tekstur serat kertas dan butiran kilau foil | `--texture-paper` dan `--texture-glitter` di `apps/web/app/assets/css/main.css` | Noise SVG `feTurbulence` | Milik sendiri |
| Logo G Google di tombol "Masuk dengan Google" | `apps/web/app/components/GoogleMark.vue` | [Pedoman branding Sign in with Google](https://developers.google.com/identity/branding-guidelines), dipakai utuh tanpa diubah warna atau bentuknya | Merek dagang Google, boleh dipakai untuk tombol login sesuai pedoman itu |
| Stiker isi surat dan Pocket (21 buah) | `apps/web/public/stickers/` | [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) gaya 3D, commit `1ffb34c`, diperkecil ke WebP 192 px oleh `apps/web/scripts/stickers.mjs` | MIT, teks lisensinya di `apps/web/public/stickers/LICENSE` |

Screenshot tiga web referensi tidak disimpan di repo karena repo public; yang ada di `docs/reference/` hanya ukuran dan catatan.

## Pustaka dengan lisensi khusus

Pustaka npm lain berlisensi permisif (MIT, Apache, ISC). Yang di bawah ini perlu perlakuan khusus.

| Pustaka | Dipakai untuk | Lisensi | Catatan |
| --- | --- | --- | --- |
| `libheif-js` 1.23.2, berisi libheif dan libde265 (WebAssembly) | Mengubah foto HEIC ke JPEG di browser yang tidak bisa membukanya sendiri (Chrome, Firefox); Safari tidak memakainya | LGPL-3.0, teks lisensinya ada di paket npm | Dibundel tanpa diubah sebagai berkas terpisah `heic.worker-*.js`, jadi bisa diganti versi lain sesuai syarat LGPL. Hanya dimuat saat ada foto HEIC dan tidak ikut precache PWA. Format HEVC punya urusan paten; selama PostPocket gratis risikonya kecil, ditinjau lagi sebelum ada model bisnis. Versinya dipatok persis. |
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

### Hairline

Sumber: [github.com/lucasmarkes/hairline](https://github.com/lucasmarkes/hairline), dipakai di `apps/web/app/utils/hairline/kernel.js`. Teks dari berkas `LICENSE` repo itu:

```text
MIT License

Copyright (c) 2026 Lucas Marques

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

### Offer Button

Sumber: [21st.dev/positronx/offer-button](https://21st.dev/positronx/offer-button/default), dipakai di `apps/web/app/components/beranda/TagButton.vue`. Halaman komponennya mencantumkan lisensi MIT tanpa teks lisensi, jadi pemberitahuannya ditulis dengan nama pembuatnya.

```text
MIT License

Copyright (c) shubhu (positronx)

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

### Skiper 39 dan pen zadvorsky

Gerakan kerumunan di `apps/web/app/components/beranda/CrowdStreet.vue` ditulis ulang dari Skiper 39 (Canvas Landing 004) karya Skiper UI ([@gurvinder-singh02](https://gxuri.me)), yang terinspirasi dari [pen zadvorsky](https://codepen.io/zadvorsky/pen/xxwbBQV). Lisensi Skiper UI versi gratis: boleh dipakai dan diubah untuk proyek pribadi maupun komersial, dengan atribusi ke Skiper UI. Atribusinya ada di halaman `/lisensi` dan di komentar komponennya. Gambar orangnya Open Peeps karya Pablo Stanley, CC0.
