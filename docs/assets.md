# Sumber dan lisensi aset

Setiap aset yang masuk repo dicatat di sini (PRD bagian Risiko: lisensi aset tidak jelas). Aset dari tiga web referensi tidak boleh masuk repo.

| Aset | Lokasi | Sumber | Lisensi |
| --- | --- | --- | --- |
| Font Inter, Caveat, VT323 | Diunduh saat build oleh `@nuxt/fonts` | Google Fonts | SIL Open Font License 1.1 |
| Ilustrasi depan kartu (padang bunga, ranting, malam berbintang) dan tanda sampul belakang | `apps/web/public/illustrations/` | Dibuat sendiri, hasil `apps/web/scripts/illustrations.mjs` | Milik sendiri |
| Ikon garis (chevron, tutup, kamera, dan lainnya) | `apps/web/app/utils/icons.ts` | Digambar sendiri | Milik sendiri |
| Ikon bunga di swatch warna foil | `apps/web/app/components/letter/FoilSwatchIcon.vue` | Digambar sendiri (SVG) | Milik sendiri |
| Favicon amplop | `apps/web/public/favicon.svg` | Digambar sendiri | Milik sendiri |
| Ikon aplikasi (PWA dan layar utama iPhone) | `apps/web/public/pwa-*.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` | Dibuat sendiri dari amplop favicon, hasil `apps/web/scripts/pwa-icons.mjs` | Milik sendiri |
| Foto contoh pantai senja | `apps/web/public/samples/contoh-foto.svg` | Digambar sendiri (SVG) | Milik sendiri |
| Gambar OG bawaan (`og-surat.jpg`, `og-beranda.jpg`) | `apps/web/public/` | Disusun dari ilustrasi padang bunga, favicon, dan warna foil emas sendiri, hasil `apps/web/scripts/og-images.mjs` (font Inter dari Google Fonts) | Milik sendiri; Inter SIL Open Font License 1.1 |
| Kantong snack Pocket dan jepitan kayunya | `apps/web/app/components/pocket/SnackPacket.vue` | Digambar sendiri dengan CSS (gradien dan clip-path bergerigi), tanpa file gambar | Milik sendiri |
| Tekstur serat kertas dan butiran kilau foil | `--texture-paper` dan `--texture-glitter` di `apps/web/app/assets/css/main.css` | Noise SVG `feTurbulence` | Milik sendiri |
| Stiker isi surat dan Pocket (18 buah) | `apps/web/public/stickers/` | [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) gaya 3D, commit `1ffb34c`, diperkecil ke WebP 192 px oleh `apps/web/scripts/stickers.mjs` | MIT, teks lisensinya di `apps/web/public/stickers/LICENSE` |

Screenshot tiga web referensi tidak disimpan di repo karena repo public; yang ada di `docs/reference/` hanya ukuran dan catatan.

## Pustaka dengan lisensi khusus

Pustaka npm lain berlisensi permisif (MIT, Apache, ISC). Yang di bawah ini perlu perlakuan khusus.

| Pustaka | Dipakai untuk | Lisensi | Catatan |
| --- | --- | --- | --- |
| `libheif-js` 1.23.2, berisi libheif dan libde265 (WebAssembly) | Mengubah foto HEIC ke JPEG di browser yang tidak bisa membukanya sendiri (Chrome, Firefox); Safari tidak memakainya | LGPL-3.0, teks lisensinya ada di paket npm | Dibundel tanpa diubah sebagai berkas terpisah `heic.worker-*.js`, jadi bisa diganti versi lain sesuai syarat LGPL. Hanya dimuat saat ada foto HEIC dan tidak ikut precache PWA. Format HEVC punya urusan paten; untuk beta gratis risikonya kecil, ditinjau lagi sebelum ada model bisnis. Versinya dipatok persis. |
| Foto uji `apps/web/e2e/fixtures/foto.heic` | E2E HEIC | Milik sendiri | Gradien buatan sendiri, diubah ke HEIC dengan `sips` di macOS |
