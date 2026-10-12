# Identitas visual PostPocket

PRD meminta fase polish "mengganti identitas visual" supaya PostPocket tidak terlihat seperti tiruan tiga web referensinya. Dokumen ini adalah arahnya. Nilai warnanya ada di `apps/web/app/assets/css/main.css`; komponen cukup memakai token.

## Subjek

PostPocket tempat anak muda Indonesia menyimpan momen kecil per hari, lalu mengirimnya sebagai kartu foil 3D lewat satu link. Benda-benda di dunianya: kertas surat, pulpen biru, amplop par avion, kemasan jajanan, strip photobox, dan TV jadul. Pilihan visual diambil dari benda-benda itu, bukan dari pola aplikasi pada umumnya.

## Arah: surat par avion

| Peran | Nilai | Dipakai untuk |
| --- | --- | --- |
| Kertas | `#F1F4F8` | Latar halaman: kertas HVS yang sedikit kebiruan, bukan krem |
| Putih | `#FFFFFF` | Kartu, lembar, dan kolom isian |
| Tinta | `#18204A` | Teks dan tombol utama: biru-hitam pulpen, bukan hitam |
| Merah pos | `#E23B3B` | Hanya di garis par avion dan cap pos di halaman salah alamat (404) |
| Emas foil | dari preset foil | Hanya di kartu dan tanda merek |

Teks sekunder memakai tinta 66% (minimal 4,9:1) dan placeholder tinta 48%.

**Huruf.** Gantari untuk semua teks antarmuka, dari judul sampai keterangan. Gantari dibuat Anugrah Pasau dari Lafontype, foundry di Makassar: huruf buatan Indonesia untuk aplikasi anak muda Indonesia. Bentuknya bersih dan geometris tapi tetap hangat, dan bukan salah satu font yang sering muncul di desain buatan AI (Inter, Space Grotesk, Bricolage Grotesque, Plus Jakarta Sans, dan sejenisnya). Judul memakai ketebalan 700 dengan jarak huruf sedikit rapat, teks biasa 400, dan label 500–600. Caveat tetap untuk isi surat (tulisan tangan), dan VT323 tetap untuk layar TV. Font cadangannya diukur sama dengan Arial (iPhone, desktop) atau Roboto (Android), jadi teks tidak melompat saat Gantari selesai dimuat.

**Modul.** Pocket dan TV memakai kertas dan tinta yang sama dengan Beranda. Ciri tiap modul ada di bendanya: kantong jajan dan jepitan kayu (utility `clothespin`) di Pocket, TV jadul berlayar VT323 di Memori TV dan Booth.

**Lapisan mengambang.** Modal, lembar, dan popup memakai utility `scrim`: halaman di belakangnya kabur (blur 14 px) dan sedikit gelap, jadi yang mengambang terasa terangkat tanpa memutus konteks.

**Satu hal yang berani.** Garis par avion merah-biru hanya membingkai surat: kartu contoh di Beranda dan halaman surat penerima. Bagian lain dibuat tenang.

## Aturan

1. **Bendanya dulu.** Setiap modul dibuka dengan bendanya (kartu foil, kantong, strip, TV), bukan ikon di dalam kartu yang seragam.
2. **Tanpa kebiasaan template.** Hindari pola-pola ini:
   - label huruf kapital berjarak di atas judul;
   - deretan "A · B · C";
   - panah di teks tombol;
   - kartu identik dengan bayangan yang sama;
   - font mono untuk label kecil.

   Kecuali bagian dari benda itu sendiri, misalnya cap tanggal di foto, merek di punggung kartu, atau tulisan di layar TV. Modal kantong Pocket juga pengecualian: kartu langkah bernomor 01–04 mengikuti Day Pocket, keputusan Kall pada 13 Oktober 2026.
3. **Kata-kata dari sudut pandang user.** Kalimat biasa (bukan huruf kapital semua), kata kerja yang jelas, dan satu nama untuk satu aksi di seluruh alur.
4. **Batas mutu tetap berlaku:** kontras minimal 4,5:1 untuk teks, fokus keyboard terlihat, `prefers-reduced-motion` dihormati, dan tata letak tetap rapi dari HP 360 px sampai desktop.

Panduan yang dipakai: skill [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) dari Anthropic, skill [Impeccable](https://github.com/pbakaus/impeccable) (bagian `typeset` dan `craft-floor`, dipakai untuk memilih Gantari), dan [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) dari Vercel.
