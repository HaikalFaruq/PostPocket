// Splash PostPocket (AppSplash, docs/desain.md bagian Splash): logo yang terbentuk dan tanda tangan
// yang ditulis, sekali di awal setiap sesi. Keputusannya diambil skrip kecil di <head> sebelum
// halaman tergambar (`splashScript` di nuxt.config), jadi tidak ada kedip halaman sebelum splash
// atau splash yang muncul sesaat lalu hilang.

/** Penanda di sessionStorage: splash sudah diputar di sesi ini. */
export const SPLASH_KEY = 'postpocket:splash'

/**
 * Halaman yang langsung menampilkan isinya: surat, kotak, dan halaman titip yang dibuka dari link
 * (penerimanya datang untuk isinya, dan pratinjau chat harus cepat), halaman info, dan lab.
 */
export const SPLASH_SKIP = ['/l/', '/k/', '/titip/', '/privasi', '/lisensi', '/lab']

/** Lama splash dari awal sampai hilang, sama dengan animasi keluarnya di AppSplash. */
export const SPLASH_MS = 2800

/** Halaman ini boleh dibuka dengan splash. */
export const splashRoute = (path: string) => !SPLASH_SKIP.some((prefix) => path.startsWith(prefix))

/**
 * Skrip <head>: splash dilewati kalau sudah diputar di sesi ini, kalau pengguna meminta gerakan
 * dikurangi, kalau browser dikendalikan tes otomatis (tes splash sendiri menimpa
 * `navigator.webdriver`), atau di halaman yang langsung menampilkan isinya. Selain itu sesi ditandai
 * sudah melihatnya. Kalau sessionStorage tidak bisa dipakai, splash juga dilewati.
 */
export const splashScript = `(function(){var d=document.documentElement;try{var s=sessionStorage,p=location.pathname,skip=${JSON.stringify(SPLASH_SKIP)};if(s.getItem('${SPLASH_KEY}')||navigator.webdriver||matchMedia('(prefers-reduced-motion: reduce)').matches||skip.some(function(x){return p.indexOf(x)===0})){d.dataset.splash='skip'}else{s.setItem('${SPLASH_KEY}','1')}}catch(e){d.dataset.splash='skip'}})()`
