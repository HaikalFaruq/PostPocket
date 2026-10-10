# Spike: kartu foil 3D, CSS vs TresJS

Sprint 0 · 10 Oktober 2026 · Kall

## Keputusan

**Rilis 1 memakai CSS 3D** lewat komponen `FoilCard`. TresJS/WebGL tidak dipasang. Di semua kondisi yang bisa diuji, CSS 3D mencapai batas 60 fps, termasuk tanpa GPU. Versi WebGL baru setara kalau GPU-nya kuat, dan menambah sekitar 136 KB gzip (three.js) plus sekitar 22 KB (TresJS).

Gerbang PRD (di atas 50 fps di HP Android kelas menengah) **belum** terbukti di HP sungguhan. Itu sisa pekerjaan Sprint 0, lihat bagian Belum terbukti.

## Yang dibangun

- `FoilCard`: kartu lipat dua dengan empat muka (sampul depan, dalam sampul, halaman surat, sampul belakang) memakai `transform-style: preserve-3d` dan `backface-visibility: hidden`.
- Foil adalah gradien logam dari preset warna foil di dalam lapisan ber-mask. Alpha mask diambil dari lapisan foil ilustrasi. Di atasnya ada butiran kilau (noise SVG), pantulan cahaya, dan bayangan diam supaya foil terlihat timbul.
- Tiap frame hanya menulis `transform` rotor dan empat CSS variable (`--mx`, `--my`, `--gx`, `--gy`). Tidak ada reaktivitas Vue di jalur animasi.
- Interaksi: drag memutar sampai sampul belakang, pegas berhenti di muka terdekat (dengan lemparan), tap atau Enter membuka dalam 520 ms, panah kiri/kanan membalik, hover tilt di desktop, dan `prefers-reduced-motion` dihormati.
- Uji performa bawaan: `/lab/foil?bench=1` memutar kartu mengikuti lintasan tetap selama 4 detik, lalu mencatat fps, durasi frame persentil 95, dan porsi frame di atas 20 ms. Lintasannya sama persis untuk versi WebGL, jadi hasilnya bisa dibandingkan.

## Hasil pengukuran

Build production, emulasi Pixel 7 (412×915, DPR 2,625), ilustrasi Padang bunga dengan foil emas. Diukur di MacBook M4 saat load mesin di bawah 6.

| Lingkungan | CSS 3D | WebGL (three.js) |
| --- | --- | --- |
| Chromium headless tanpa GPU (SwiftShader) | 60 fps · p95 16,7 ms · 0% frame >20 ms | 12,8 fps · p95 100 ms · 100% |
| Chromium tanpa GPU, CPU 4× lebih lambat | 60 fps · p95 16,7 ms · 0% | 10,4 fps · p95 117 ms · 100% |
| Chrome dengan GPU (Apple M4) | 60 fps · p95 16,7 ms · 0% | 60 fps · p95 16,7 ms · 0% |
| Chrome dengan GPU, CPU 6× lebih lambat | 60 fps · p95 16,7 ms · 0% | 60 fps · p95 16,8 ms · 0% |
| Safari iOS 26.5 (simulator, build dev, load Mac 15–40) | 47,6 fps · p95 27 ms | – |

Versi WebGL di tabel memakai `MeshPhysicalMaterial` logam dengan environment map, tekstur ilustrasi dan mask foil yang sama, dan lintasan putar yang sama.

Baris Safari hanya membuktikan bahwa kartu dan benchmark jalan di Safari iOS. Simulator memakai CPU Mac yang saat itu sibuk karena simulator baru boot, jadi angkanya tidak mewakili iPhone.

## Temuan

- **Screenshot Playwright WebKit tidak memakai compositing 3D.** Flip card paling dasar pun terlihat terbalik di sana, padahal di Safari iOS sungguhan (simulator) keempat muka kartu tampil benar. Efek 3D harus dicek di simulator atau iPhone. E2E kartu memeriksa state DOM, bukan piksel.
- **`mask` dijalankan setelah `filter`.** Bayangan (`drop-shadow`) di elemen ber-mask ikut terpotong, jadi bayangan dipasang di pembungkus.
- **Properti yang meratakan 3D** (`overflow`, `filter`, `mask`, `opacity < 1`, `mix-blend-mode`) hanya boleh ada di muka kartu, tidak di rotor, spread, atau lembar.
- **Kecepatan lemparan harus basi kalau jari diam.** Kalau kartu ditahan lalu dilepas, sampel gerakan lama sempat membuat kartu ikut terlempar. Sudah diperbaiki dan diuji E2E.

## Belum terbukti

- [ ] Benchmark di HP Android kelas menengah (gerbang PRD) dan satu HP murah: buka `/lab/foil?bench=1`, lalu salin hasilnya ke tabel di atas.
- [ ] Benchmark di iPhone sungguhan.

Kalau HP Android kelas menengah di bawah 50 fps, urutan penghematannya: matikan butiran kilau, ganti blend mode pantulan ke `normal` dengan opacity rendah, kecilkan `inset` lapisan logam, lalu turunkan resolusi mask. Kalau masih kurang, baru pertimbangkan WebGL untuk perangkat yang mampu.
