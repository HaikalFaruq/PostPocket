<script setup lang="ts">
useSeoMeta({
  title: 'Lisensi · PostPocket',
  description: 'Aset dan pustaka pihak ketiga yang dipakai PostPocket, beserta lisensinya.',
})
</script>

<template>
  <InfoPage
    title="Lisensi"
    lead="PostPocket memakai beberapa aset dan pustaka buatan orang lain. Terima kasih untuk mereka."
  >
    <h2>Stiker</h2>
    <p>
      Stiker di surat dan Pocket diambil dari
      <a href="https://github.com/microsoft/fluentui-emoji" target="_blank" rel="noopener"
        >Microsoft Fluent Emoji</a
      >
      (gaya 3D), dengan
      <a
        href="https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE"
        target="_blank"
        rel="noopener"
        >lisensi MIT</a
      >.
    </p>

    <h2>Huruf</h2>
    <p>
      Gantari karya Lafontype, Delicious Handrawn karya Agung Rohmat, dan VT323 dari Google Fonts,
      dengan
      <a href="https://openfontlicense.org/" target="_blank" rel="noopener"
        >SIL Open Font License 1.1</a
      >.
    </p>

    <h2>Pembuka foto HEIC</h2>
    <p>
      Foto HEIC dibuka dengan
      <a href="https://github.com/catdad-experiments/libheif-js" target="_blank" rel="noopener"
        >libheif-js</a
      >
      1.23.2, yang berisi
      <a href="https://github.com/strukturag/libheif" target="_blank" rel="noopener">libheif</a>
      dan
      <a href="https://github.com/strukturag/libde265" target="_blank" rel="noopener">libde265</a>,
      dengan
      <a href="https://www.gnu.org/licenses/lgpl-3.0.html" target="_blank" rel="noopener"
        >GNU LGPL versi 3</a
      >. Pustaka ini dipakai tanpa diubah, dimuat sebagai berkas terpisah hanya saat browser tidak
      bisa membuka foto HEIC sendiri, dan bisa diganti dengan versi lain. Kode sumbernya ada di
      tautan di atas.
    </p>

    <h2>Beranda dan Kotak surat</h2>
    <p>
      Figur garis Surat, Pocket, dan Photo Booth digambar sendiri di atas mesin
      <a href="https://github.com/lucasmarkes/hairline" target="_blank" rel="noopener">Hairline</a>
      karya Lucas Marques, dengan lisensi MIT. Kerumunan di atas footer memakai
      <a href="https://www.openpeeps.com/" target="_blank" rel="noopener">Open Peeps</a>
      karya Pablo Stanley (CC0), dengan gerakan yang diadaptasi dari Skiper 39 karya
      <a href="https://skiper-ui.com/" target="_blank" rel="noopener">Skiper UI</a>. Tombol bertag
      diadaptasi dari Offer Button karya positronx, dan folder kaca Kotak surat dari Glassmorphism
      Folder Cards karya Kedhareswer Naidu, keduanya di
      <a href="https://21st.dev/" target="_blank" rel="noopener">21st.dev</a> dengan lisensi MIT.
    </p>

    <h2>Kerangka aplikasi</h2>
    <p>
      Nuxt, Vue, Vue Router, Pinia, VueUse, Reka UI, Motion for Vue, Tailwind CSS, dan Workbox
      berlisensi MIT; idb-keyval berlisensi Apache 2.0.
    </p>

    <h2>Buatan sendiri</h2>
    <p>
      Ilustrasi kartu, ikon, kantong Pocket, badan TV, dan tekstur kertas dibuat sendiri untuk
      PostPocket. Kode sumbernya terbuka di
      <a href="https://github.com/HaikalFaruq/PostPocket" target="_blank" rel="noopener">GitHub</a>.
    </p>
  </InfoPage>
</template>
