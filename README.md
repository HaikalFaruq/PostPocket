<!-- markdownlint-disable MD013 MD033 MD041 -->

<div align="center">

# PostPocket

**Tangkap momen, simpan per hari, kirim sebagai surat foil 3D.**

Satu web berisi tiga benda: kamera Booth, kantong harian Pocket, dan kartu surat Letter.<br />
Foto dari mana pun bisa mengalir ke modul lain, lalu dikirim ke orang lain lewat satu link.

[![Status](https://img.shields.io/badge/status-sprint_0-F4A6C1?style=flat-square&labelColor=141414)](docs/prd/PRD-PostPocket.md#milestone-dan-pembagian-tugas)
[![Nuxt](https://img.shields.io/badge/frontend-Nuxt-00DC82?style=flat-square&logo=nuxt&logoColor=00DC82&labelColor=141414)](https://nuxt.com)
[![Supabase](https://img.shields.io/badge/backend-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=3ECF8E&labelColor=141414)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white&labelColor=141414)](https://www.typescriptlang.org)

[PRD](docs/prd/PRD-PostPocket.md) · [Panduan frontend](docs/frontend.md) · [Panduan backend](docs/backend.md) · [Aturan kerja](AGENTS.md)

</div>

> [!NOTE]
> **Masih Sprint 0.** Fondasi frontend (`apps/web`: token, komponen bersama, kartu foil 3D) sudah ada dan bisa dicoba di `/lab`. Backend (`supabase/`) menyusul dari Bintang.

## Mulai dari sini

| Kamu | Baca dulu | Lalu |
| --- | --- | --- |
| **Bintang** (backend) | [docs/backend.md](docs/backend.md) | Checklist Sprint 0: proyek Supabase, migrasi `letters` + `letter_assets`, `openapi.yaml` |
| **Kall** (frontend) | [docs/frontend.md](docs/frontend.md) | Checklist Sprint 1: halaman Letter langkah 1–4, Surprise me, draf di IndexedDB |
| **AI agent** | [AGENTS.md](AGENTS.md) | Ikuti peran orang yang menjalankanmu |

## Mulai lokal

Butuh Node 24 dan pnpm 9.

```sh
pnpm install   # sekalian mengaktifkan hook git
pnpm dev       # http://localhost:3000, lalu buka /lab
```

`pnpm check` menjalankan lint, typecheck, dan unit test; `pnpm test:e2e` menjalankan Playwright di build production. Daftar lengkapnya ada di [AGENTS.md](AGENTS.md#6-perintah).

## Apa itu PostPocket

| Modul | Isi | Referensi |
| --- | --- | --- |
| **Letter** | Kartu foil 3D yang bisa diputar, dibuka, diisi foto dan teks, lalu dikirim lewat link | [Foil Studio](https://www.bubbbly.com/foil-studio) |
| **Pocket** | Kalender bulanan; tiap hari diisi foto lalu dibungkus kantong berstiker | [Day Pocket](https://daypocket.replit.app/) |
| **TV & Booth** | TV clay jadul pemutar album CD dengan filter retro, plus photobooth | [Memory TV](https://memorytv.replit.app/) |

<p align="center">
  <img src="docs/prd/images/core-loop.png" width="820" alt="Alur inti: Booth dan upload foto masuk ke Pocket, Pocket diteruskan ke TV dan Letter, Letter dibuka penerima, penerima bikin balasan" />
</p>

Rilis 1 hanya butuh server untuk surat yang dikirim. Pocket, TV, dan Booth berjalan di browser (IndexedDB) sampai fase 2.

## Roadmap

<p align="center">
  <img src="docs/prd/images/roadmap.png" width="820" alt="Roadmap: Sprint 0 setup, Sprint 1–2 Letter end-to-end, Sprint 3 TV dan Booth, Sprint 4 Pocket dan beta tertutup, lalu fase 2" />
</p>

## Aturan repo

Commit dan PR tercatat atas nama orang yang menjalankannya, tanpa atribusi AI. Aturan ini dicek oleh git hook, CI, dan branch protection di `main`. Detail dan cara memperbaiki commit yang ditolak ada di [AGENTS.md](AGENTS.md#1-tanpa-atribusi-ai).

## Tim

<table>
  <tr>
    <td align="center"><a href="https://github.com/HaikalFaruq"><img src="https://github.com/HaikalFaruq.png?size=120" width="72" alt="Kall" /><br /><b>Kall</b></a><br /><sub>Frontend</sub></td>
    <td align="center"><a href="https://github.com/bintangfabian"><img src="https://github.com/bintangfabian.png?size=120" width="72" alt="Bintang" /><br /><b>Bintang</b></a><br /><sub>Backend</sub></td>
  </tr>
</table>
