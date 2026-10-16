<script setup lang="ts">
import { postmarkDate } from '~/utils/support'

/**
 * Perangko PostPocket untuk ajakan dukungan: kertas putih bergerigi dengan logo P-amplop, nilai
 * "Rp seikhlasnya", dan cap pos bertanggal hari ini kalau `postmark`. Hanya hiasan, jadi
 * disembunyikan dari pembaca layar. Ukurannya mengikuti lebar dari kelas (misalnya `w-32`).
 */
withDefaults(defineProps<{ postmark?: boolean; animate?: boolean }>(), {
  postmark: false,
  animate: false,
})

// Tanggal dihitung di browser saja, supaya hasil SSR dan hidrasi tidak berbeda di pergantian hari.
const today = ref('')
onMounted(() => {
  today.value = postmarkDate(new Date())
})
</script>

<template>
  <span class="stamp" :class="{ 'stamp--animate': animate }" aria-hidden="true">
    <span class="stamp__paper">
      <span class="stamp__face">
        <span class="stamp__value">Rp seikhlasnya</span>
        <BrandLogo variant="symbol" class="stamp__logo" />
        <span class="stamp__country">Indonesia</span>
      </span>
    </span>
    <svg v-if="postmark" class="stamp__postmark" viewBox="0 0 150 80">
      <defs>
        <path id="postmark-arc" d="M12 40a28 28 0 0 1 56 0" />
      </defs>
      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="1.2" />
      <text class="stamp__postmark-ring">
        <textPath href="#postmark-arc" startOffset="50%" text-anchor="middle">POSTPOCKET</textPath>
      </text>
      <text x="40" y="47" text-anchor="middle" class="stamp__postmark-date">{{ today }}</text>
      <path
        d="M80 26q8-5 16 0t16 0 16 0 16 0M80 36q8-5 16 0t16 0 16 0 16 0M80 46q8-5 16 0t16 0 16 0 16 0M80 56q8-5 16 0t16 0 16 0 16 0"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.stamp {
  position: relative;
  display: block;
  aspect-ratio: 4 / 5;
  rotate: -4deg;
  /* Bayangan ikut gerigi kertas, karena mask memotong box-shadow. */
  filter: drop-shadow(0 1px 1px rgb(24 32 74 / 0.12)) drop-shadow(0 10px 14px rgb(24 32 74 / 0.18));
}

/*
 * Gerigi perangko: lubang bulat di sepanjang tepi lewat mask (teknik Temani Afif), ditambah
 * persegi penuh di tengah supaya bagian dalamnya tidak ikut berlubang. Ubinnya 12% lebar dan
 * 9,6% tinggi, jadi persegi di kotak 4:5, dan digeser setengah ubin supaya lubangnya tepat di tepi.
 */
.stamp__paper {
  position: absolute;
  inset: 0;
  display: block;
  padding: 9%;
  background: var(--color-surface);
  mask:
    radial-gradient(circle closest-side, #0000 62%, #000 70%) round -6% -4.8% / 12% 9.6%,
    linear-gradient(#000 0 0) no-repeat 50% / 88% 90.4%;
}

.stamp__face {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 9% 6% 7%;
  background-color: var(--color-canvas);
  background-image: var(--texture-paper);
  background-blend-mode: soft-light;
  box-shadow: inset 0 0 0 1px var(--color-line);
  color: var(--color-ink);
  container-type: inline-size;
}

.stamp__value {
  align-self: flex-end;
  font-size: 11cqw;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

.stamp__logo {
  height: 46cqw;
}

.stamp__country {
  align-self: flex-start;
  font-size: 10cqw;
  font-weight: 600;
  line-height: 1;
  color: var(--color-ink-muted);
}

/* Cap pos menimpa pojok kanan bawah perangko, tinta yang sedikit pudar seperti cap sungguhan. */
.stamp__postmark {
  position: absolute;
  right: -74%;
  bottom: -6%;
  width: 118%;
  rotate: -9deg;
  color: var(--color-ink);
  opacity: 0.55;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.stamp__postmark-ring {
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  fill: currentColor;
}

.stamp__postmark-date {
  font-size: 7.5px;
  font-weight: 700;
  fill: currentColor;
}

/* Saat dialog dibuka: perangkonya ditempel, lalu cap posnya menyusul. */
@media (prefers-reduced-motion: no-preference) {
  .stamp--animate {
    animation: stamp-place 420ms var(--ease-card) both;
  }

  .stamp--animate .stamp__postmark {
    animation: stamp-press 360ms 320ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
  }
}

@keyframes stamp-place {
  from {
    opacity: 0;
    translate: 0 -14px;
    rotate: -14deg;
    scale: 1.08;
  }
}

@keyframes stamp-press {
  from {
    opacity: 0;
    scale: 1.35;
  }
}
</style>
