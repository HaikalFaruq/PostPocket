<script setup lang="ts">
// Tanpa NUXT_PUBLIC_FEEDBACK_URL, "Lapor masalah" membuka GitHub Issues yang publik.
const publicReports = !useRuntimeConfig().public.feedbackUrl
// Kotak bareng baru dijelaskan begitu fiturnya menyala.
const kotakBareng = !!useRuntimeConfig().public.kotakBareng

useSeoMeta({
  title: 'Privasi · PostPocket',
  description: 'Apa yang disimpan PostPocket di perangkatmu, dan apa yang dikirim ke server.',
})
</script>

<template>
  <InfoPage title="Privasi" lead="Ringkasan cara PostPocket menyimpan datamu.">
    <h2>Yang tersimpan di perangkatmu</h2>
    <ul>
      <li>
        Draf surat, kantong Pocket, album TV, dan hasil Booth disimpan di browser ini. Tanpa login,
        semuanya hanya ada di sini, dan kami tidak bisa melihatnya.
      </li>
      <li>
        Tanpa login, semua itu hilang kalau data browser dihapus, atau kalau kamu pindah HP atau
        browser.
      </li>
      <li>
        Supaya tidak dihapus browser diam-diam, PostPocket meminta izin penyimpanan permanen. Paling
        aman kalau PostPocket dipasang ke layar utama.
      </li>
      <li>
        Surat yang kamu simpan lewat "Simpan surat" (Kotak surat) juga ada di browser ini. Fotonya
        disimpan sebagai kenangan Pocket di CD "Surat untukmu", jadi suratnya tetap bisa dibuka
        setelah surat dan fotonya dihapus dari server.
      </li>
    </ul>

    <h2>Yang dikirim ke server</h2>
    <p>Untuk surat, hanya saat kamu menekan "Buat link untuk dikirim":</p>
    <ul>
      <li>desain kartu dan isi surat: tulisan, foto, dan stiker beserta posisinya;</li>
      <li>
        foto di dalam surat dan foto depan kartu, setelah diperkecil dan dibersihkan dari data
        lokasi (EXIF);
      </li>
      <li>gambar pratinjau untuk WhatsApp;</li>
      <li>waktu surat diterbitkan dan pertama kali dibuka.</li>
    </ul>
    <p>Surat dan fotonya disimpan di Supabase (Sydney, Australia); halamannya dilayani Vercel.</p>

    <h2>Cadangan Pocket dengan akun Google</h2>
    <p>
      Masuk dengan Google di Pocket tidak wajib. Surat tetap bisa dibuat dan dibuka tanpa akun.
      Kalau kamu masuk:
    </p>
    <ul>
      <li>
        kantong Pocket, album CD, foto, dan tanggal fotonya dicadangkan ke Supabase (Sydney,
        Australia) supaya bisa dibuka di HP lain. Fotonya diperkecil (paling besar 500 KB per foto),
        dibersihkan dari data lokasi, dan hanya bisa dibuka akunmu;
      </li>
      <li>
        untuk login, Supabase menyimpan email, nama, dan foto profil akun Googlemu. PostPocket hanya
        menampilkan emailnya di kartu Cadangan;
      </li>
      <li>cadangan paling banyak 100 foto per akun;</li>
      <li>
        foto, kantong, dan album yang kamu hapus di Pocket ikut dihapus dari cadangan. Berkas
        fotonya dibersihkan paling lama sekitar satu jam kemudian, sedangkan catatan penghapusannya
        (tanpa foto) disimpan 30 hari supaya penghapusannya sampai juga ke HP lain;
      </li>
      <li>keluar dari akun tidak menghapus cadangan maupun kenangan di perangkat ini.</li>
    </ul>
    <p>
      Akun bisa kamu hapus sendiri dari Pocket, lewat Hapus akun di kartu Cadangan. Akun dan semua
      cadangannya di server, termasuk fotonya, langsung terhapus. Kenangan di perangkatmu dan surat
      yang sudah kamu kirim<template v-if="kotakBareng">, juga kotak bareng,</template> tidak ikut
      terhapus, karena tidak terikat ke akun. Kalau tidak bisa masuk lagi, minta penghapusan akun
      lewat <FeedbackLink>Lapor masalah</FeedbackLink>.
    </p>

    <h2>Siapa yang bisa membuka suratmu</h2>
    <p>
      Siapa pun yang memegang <span class="whitespace-nowrap">link-nya</span>. Link berisi kode acak
      yang sulit ditebak, tidak muncul di mesin pencari, dan tidak didaftar di mana pun, jadi
      bagikan hanya ke orang yang kamu tuju.
    </p>

    <h2>Berapa lama disimpan</h2>
    <ul>
      <li>Surat bisa dibuka 30 hari sejak dikirim, lalu dihapus.</li>
      <li>Foto di dalamnya dihapus 7 hari setelah surat pertama kali dibuka.</li>
      <li>
        Salinan foto di cache CDN, server perantara yang mempercepat pemuatan gambar, bisa masih
        terbuka sampai sekitar satu jam setelah fotonya dihapus.
      </li>
      <li>
        Kalau pembuatan link gagal di tengah jalan, data yang sempat terunggah dihapus otomatis
        sekitar 24 jam kemudian.
      </li>
      <li>
        Kamu bisa menghapus surat kapan saja lewat "Surat terkirim" di halaman tulis surat, dari
        browser yang dipakai untuk mengirimnya.
      </li>
    </ul>

    <template v-if="kotakBareng">
      <h2>Kotak bareng</h2>
      <p>Kalau kamu membuat kotak bareng atau menitip surat ke kotak:</p>
      <ul>
        <li>
          selain isi surat dan fotonya, server menyimpan judul kotak, nama penerima, dan nama
          pengirim tiap titipan;
        </li>
        <li>
          pembuat kotak memegang link buka untuk diberikan ke penerima, dan bisa membuka kotaknya
          lebih awal. Sebelum kotak terbuka, ia hanya melihat nama pengirim dan jumlah fotonya.
          Setelah terbuka, isi semua surat bisa dibaca siapa pun yang memegang link buka, termasuk
          pembuat kotak;
        </li>
        <li>
          kotak menerima titipan paling lama 30 hari. Kotak dan semua titipannya dihapus 30 hari
          setelah kotaknya terbuka, dan fotonya 7 hari setelah penerima membuka surat pertama;
        </li>
        <li>
          pengirim bisa menarik suratnya, dan pembuat kotak bisa menghapus titipan atau kotaknya
          kapan saja, dari browser yang dipakai untuk mengirim atau membuatnya.
        </li>
      </ul>
    </template>

    <h2>Alamat IP dan pembatasan spam</h2>
    <p>
      Satu jaringan bisa membuat paling banyak 10 surat<template v-if="kotakBareng"
        >, 5 kotak bareng, dan 30 titipan surat ke kotak</template
      >
      per jam. Untuk menghitungnya, server menyimpan versi tersandi (hash berkunci) dari alamat IP
      pengirim, bukan alamat
      <span class="whitespace-nowrap">IP-nya</span>, dan menghapusnya paling lambat 2 jam kemudian.
      Fungsi server PostPocket tidak mencatat alamat IP.
    </p>
    <p>
      Penyedia hosting (Supabase dan Vercel) tetap mencatat alamat IP di log teknis mereka untuk
      sementara, untuk keamanan dan operasional.
    </p>

    <h2>Tanpa iklan dan pelacak</h2>
    <p>
      PostPocket tidak memakai iklan, cookie pelacak, atau analitik pihak ketiga. Server hanya
      menghitung berapa surat dibuat, dibuka, dan dibalas, tanpa mencatat surat yang mana, alamat
      IP, atau perangkat yang dipakai.
    </p>
    <p>
      Tombol Traktir hanya membuka halaman Sociabuzz di tab baru. PostPocket tidak mengirim data apa
      pun ke sana, dan pembayaran dukungan diatur oleh Sociabuzz. Waktu dialog Traktir terakhir
      muncul sendiri dicatat di perangkat ini saja, supaya tidak muncul lagi selama 30 hari.
    </p>

    <h2>Ada pertanyaan atau masalah?</h2>
    <p>
      Kirim lewat <FeedbackLink>Lapor masalah</FeedbackLink>. Laporan otomatis menyertakan halaman,
      versi aplikasi, dan jenis perangkatmu, tanpa link suratmu.
      <template v-if="publicReports">
        Laporan masuk ke GitHub Issues: perlu akun GitHub dan bisa dibaca publik, jadi jangan tulis
        data pribadi di sana.
      </template>
    </p>
  </InfoPage>
</template>
