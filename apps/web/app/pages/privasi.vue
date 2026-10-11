<script setup lang="ts">
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
    <p>Server dan foto surat disimpan di Supabase (Singapura); halamannya dilayani Vercel.</p>

    <h2>Siapa yang bisa membuka suratmu</h2>
    <p>
      Siapa pun yang memegang link-nya. Link berisi kode acak yang sulit ditebak, tidak muncul di
      mesin pencari, dan tidak didaftar di mana pun, jadi bagikan hanya ke orang yang kamu tuju.
    </p>

    <h2>Berapa lama disimpan</h2>
    <ul>
      <li>Surat bisa dibuka 30 hari sejak dikirim, lalu dihapus.</li>
      <li>Foto di dalamnya dihapus 7 hari setelah surat pertama kali dibuka.</li>
      <li>Surat yang belum sempat diterbitkan dihapus dalam 24 jam.</li>
      <li>
        Kamu bisa menghapus surat kapan saja lewat "Surat terkirim" di halaman tulis surat, dari
        browser yang dipakai untuk mengirimnya.
      </li>
    </ul>

    <h2>Pembatasan spam</h2>
    <p>
      Satu jaringan bisa membuat paling banyak 10 surat per jam. Untuk menghitungnya, server
      menyimpan sidik acak dari alamat IP pengirim, bukan alamat IP-nya.
    </p>

    <h2>Tanpa iklan dan pelacak</h2>
    <p>PostPocket tidak memakai iklan, cookie pelacak, atau analitik pihak ketiga.</p>
  </InfoPage>
</template>
