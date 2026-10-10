# Referensi layout

Ukuran dan catatan dari tiga web referensi untuk prinsip "tiru dulu, poles nanti", diambil 10 Oktober 2026 dengan Chromium (HP 390×844 dan desktop 1440×900).

> [!IMPORTANT]
> Repo ini public, jadi screenshot referensi **tidak** disimpan di repo. Screenshot-nya ada di folder bersama Kall dan Bintang. Aset dari web referensi (gambar, stiker, ilustrasi, desain TV) juga tidak boleh disalin ke repo (PRD bagian Design system dan aset).

| Modul | Referensi |
| --- | --- |
| Letter | [Foil Studio](https://www.bubbbly.com/foil-studio) |
| Pocket | [Day Pocket](https://daypocket.replit.app/) |
| TV dan Booth | [Memory TV](https://memorytv.replit.app/) |

## Foil Studio (Letter)

Ukuran diambil dari gaya terhitung di browser, versi desktop:

| Elemen | Nilai |
| --- | --- |
| Panel opsi | Kanan, lebar 400 px, latar `#fcfcfb`, isi berjarak 24 px dari tepi |
| Judul panel | 22 px, tebal 650, letter-spacing -0,55 px |
| Judul langkah | 13 px tebal 600; nomor di lingkaran hitam 18 px dengan angka 10,5 px |
| Chip pilihan | Tinggi 30 px, padding 0 12 px, radius penuh, 12,5 px; aktif `#111114` dengan teks putih |
| Swatch warna foil | 48 px berisi ikon bunga logam; aktif: cincin dalam 1,5 px hitam dan latar putih |
| Swatch kertas | 30 px dengan cincin dalam 1 px `rgba(17,17,20,.14)`; aktif: cincin hitam berjarak |
| Tombol utama | Tinggi 42 px, radius 10 px, 13 px tebal 550, menempel di bawah panel |
| Tombol upload | Tinggi 36 px, radius 10 px, latar putih |
| Teks bantu | 12–12,5 px, `rgba(17,17,20,.55)` |
| Isi surat | Caveat 21 px |
| Petunjuk di bawah kartu | "Tap the card to open it · drag it to turn it round" |
| Kartu | Satu kanvas WebGL; drag memutar sampai sampul belakang ("MADE BY" + nama), tap membuka |
| HP | Panel jadi bottom sheet bersudut 20 px; tombol chevron bulat 44 px di atas sudut kanan sheet untuk melipat |

Warna kertas Foil Studio: White `#f5f4f1`, Cream `#f1e9d9`, Blush `#eccac6`, Sage `#c8d4c0`, Sky `#c8d6e6`, Midnight `#2a2e40`. Preset kita sengaja sedikit berbeda.

## Day Pocket (Pocket)

- Latar halaman `#efefef`, kartu kalender putih bersudut sekitar 30 px, teks `#1c1c1e`.
- Eyebrow, tanggal, dan penghitung memakai monospace sistem 9–11 px, warna cokelat muda `#b09f90`.
- Sel kalender punya jepitan kayu kecil dan tombol "+" bulat; tanggal di luar bulan berlatar `#f9f9fb`.
- Modal "Tuck in a little day": radius sekitar 28 px, latar abu muda, judul sekitar 28 px warna cokelat tua, tanggal di bawahnya, tombol tutup bulat putih.
- Kolom kiri: kantong snack dengan stiker, foto berbingkai miring, dan nama kombinasi monospace ("BLUEBERRY SKY / DAISY").
- Kolom kanan: kartu langkah putih bernomor "01" sampai "04" dalam lingkaran abu monospace; swatch kantong 40 px dengan centang; grid 21 stiker; tiga bingkai (Polaroid, Postage, Ticket) dan enam warna bingkai plus Custom.
- Footer: tombol teks "Not now" dan tombol pil hitam "Tuck it away" dengan ikon centang.

## Memory TV (TV dan Booth)

- Latar `#eaeaeb`, judul VT323 berjarak lebar dengan dua huruf terakhir pink, subjudul huruf kapital renggang abu.
- Badan TV clay pink (`#e48ba1` dan bayangan bertingkat), panel kanan gelap `#2a2a2a`, filter aktif berlatar `#e91e8c`.
- Tujuh filter: Normal, Kodak, Noir, Glitch, VHS, Cyan, Velvia. Delapan warna clay di bawah TV.
- Arsip CD coverflow dengan punggung berwarna, tombol "+ Photos", dan petunjuk "slide disc to insert".
