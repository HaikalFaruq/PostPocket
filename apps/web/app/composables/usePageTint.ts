/**
 * Latar halaman sampai ke tepi layar. Warna `<html>` terlihat di bawah toolbar Safari iOS dan
 * saat layar ditarik melewati ujung halaman, sedangkan `theme-color` mewarnai bilah status. Tanpa
 * ini, halaman yang latarnya beda dari kanvas tampak bergaris di atas dan bawah layar HP.
 *
 * `className` adalah kelas latar dari token (misalnya `bg-pocket-page`), `color` nilai heks token
 * yang sama, karena meta tag tidak bisa membaca variabel CSS.
 */
export function usePageTint(className: string, color: string) {
  useHead({
    htmlAttrs: { class: className },
    meta: [{ name: 'theme-color', content: color }],
  })
}
