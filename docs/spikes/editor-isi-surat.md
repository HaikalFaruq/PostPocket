# Keputusan: editor isi surat memakai DOM, bukan vue-konva

**Editor isi surat (`LetterEditor`) dan halaman surat di kartu (`LetterPage`) memakai komponen tampilan yang sama, `LetterElementView`.** Posisinya relatif terhadap halaman (persen dan `cqw`), sesuai bentuk `content` di [docs/api/openapi.yaml](../api/openapi.yaml). vue-konva yang disebut PRD tidak dipasang.

## Kenapa

- **Penerima melihat persis yang disusun pengirim.** Teks Caveat dipenggal oleh mesin yang sama di editor, kartu, dan halaman penerima. Kalau editornya canvas (Konva) sedangkan kartu dan halaman penerima DOM, pemenggalan baris bisa berbeda di lebar yang sama.
- **Kartu foil sudah DOM + CSS 3D** ([spike](foil-3d.md)). Halaman surat ada di muka kartu yang diskalakan dan diputar. Teks DOM tetap tajam di sana, sedangkan resolusi canvas harus dihitung ulang setiap ukuran kartu berubah.
- **Aksesibel dan bisa dites.** Isi surat terbaca pembaca layar di halaman penerima, dan E2E bisa memeriksa tiap elemennya.
- **Lebih ringan.** Halaman penerima tidak perlu memuat Konva (sekitar 150 KB sebelum gzip).

## Yang ditulis sendiri

- Gestur satu jari di halaman datar layar penuh (bukan di dalam kartu 3D, supaya posisi jari selalu tepat):
  - geser untuk memindah;
  - pegangan pojok untuk ukuran;
  - pegangan atas untuk memutar, menempel ke kelipatan 90° kalau dekat.
- Cubit dua jari di HP untuk ukuran, putaran, dan posisi sekaligus. Jari kedua boleh mendarat di luar elemen yang dipilih, dan seluruh panggung editor memakai `touch-action: none` supaya browser tidak ikut memperbesar halaman. Petunjuk di header menyebut cubitan di layar sentuh dan pegangan di layar dengan mouse.

  Hitungannya ada di `apps/web/app/utils/letter-gesture.ts` beserta unit test-nya.
- Keyboard:
  - panah menggeser elemen, dengan Shift untuk langkah besar;
  - Delete menghapus;
  - Enter memilih;
  - Escape melepas pilihan, lalu menutup editor.

## Belum

- Ekspor halaman surat jadi gambar. Kalau dibutuhkan, gambarnya bisa disusun dari `content` di canvas biasa tanpa Konva.
