<script setup lang="ts">
// Tanpa NUXT_PUBLIC_FEEDBACK_URL, "Lapor masalah" membuka GitHub Issues yang publik.
const publicReports = !useRuntimeConfig().public.feedbackUrl

useSeoMeta({
  title: 'Privasi · PostPocket',
  description: 'Apa yang disimpan PostPocket di perangkatmu, dan apa yang dikirim ke server.',
})
</script>

<template>
  <InfoPage title="Privasi" lead="Ringkasan cara PostPocket menyimpan datamu selama masa beta.">
    <h2>Yang tersimpan di perangkatmu</h2>
    <ul>
      <li>
        Draf surat, kantong Pocket, album TV, dan hasil Booth disimpan di browser ini saja, bukan di
        server. Kami tidak bisa melihatnya.
      </li>
      <li>
        Semua itu hilang kalau data browser dihapus, atau kalau kamu pindah HP atau browser. Belum
        ada akun untuk menyimpannya di tempat lain.
      </li>
      <li>
        Supaya tidak dihapus browser diam-diam, PostPocket meminta izin penyimpanan permanen. Paling
        aman kalau PostPocket dipasang ke layar utama.
      </li>
    </ul>

    <h2>Yang dikirim ke server</h2>
    <p>Hanya saat kamu menekan "Buat link untuk dikirim":</p>
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
        Kalau pembuatan link gagal di tengah jalan, data yang sempat terunggah dihapus otomatis
        sekitar 24 jam kemudian.
      </li>
      <li>
        Kamu bisa menghapus surat kapan saja lewat "Surat terkirim" di halaman tulis surat, dari
        browser yang dipakai untuk mengirimnya.
      </li>
    </ul>

    <h2>Alamat IP dan pembatasan spam</h2>
    <p>
      Satu jaringan bisa membuat paling banyak 10 surat per jam. Untuk menghitungnya, server
      menyimpan versi tersandi (hash berkunci) dari alamat IP pengirim, bukan alamat
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

    <h2>Ada pertanyaan atau masalah?</h2>
    <p>
      Kirim lewat <FeedbackLink>Lapor masalah</FeedbackLink>. Laporan otomatis menyertakan halaman,
      versi aplikasi, dan jenis perangkatmu, tanpa link suratmu.
      <template v-if="publicReports">
        Selama beta, laporan masuk ke GitHub Issues: perlu akun GitHub dan bisa dibaca publik, jadi
        jangan tulis data pribadi di sana.
      </template>
    </p>
  </InfoPage>
</template>
