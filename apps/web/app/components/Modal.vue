<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'

/**
 * Modal besar dua kolom: preview di kiri, opsi di kanan (gaya Day Pocket).
 * Di HP jadi layar penuh dengan preview di atas. Fokus terkunci di dalam modal dan Esc menutup.
 */
withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    description?: string
    tone?: 'neutral' | 'pocket'
  }>(),
  { eyebrow: undefined, description: undefined, tone: 'neutral' },
)

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay
        class="scrim fixed inset-0 z-40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <div class="pointer-events-none fixed inset-0 z-50 grid md:place-items-center md:p-6">
        <DialogContent
          class="pointer-events-auto flex h-dvh w-full flex-col overflow-hidden bg-canvas shadow-modal data-[state=closed]:animate-rise-out data-[state=open]:animate-rise-in md:h-[min(860px,100%)] md:max-w-[1180px] md:rounded-[28px]"
        >
          <header class="relative shrink-0 border-b border-line-soft px-6 pt-6 pb-4 md:px-8">
            <p
              v-if="eyebrow"
              class="text-caption font-medium"
              :class="tone === 'pocket' ? 'text-pocket-muted' : 'text-ink-muted'"
            >
              {{ eyebrow }}
            </p>
            <DialogTitle
              class="mt-2 pr-12 text-[28px] leading-tight font-bold tracking-[-0.03em]"
              :class="tone === 'pocket' ? 'text-pocket-ink' : 'text-ink'"
            >
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-body text-ink-muted">
              {{ description }}
            </DialogDescription>
            <DialogClose as-child>
              <IconButton label="Tutup" class="absolute top-5 right-5">
                <Icon name="close" :size="18" />
              </IconButton>
            </DialogClose>
          </header>

          <div
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid md:grid-cols-[1.05fr_1fr] md:overflow-hidden"
          >
            <div class="relative min-h-[320px] p-6 md:border-r md:border-line-soft">
              <slot name="preview" />
            </div>
            <div class="space-y-3 p-4 md:overflow-y-auto md:overscroll-contain md:p-5">
              <slot />
            </div>
          </div>

          <footer
            v-if="$slots.footer"
            class="flex shrink-0 items-center justify-end gap-3 border-t border-line-soft px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            <slot name="footer" />
          </footer>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
