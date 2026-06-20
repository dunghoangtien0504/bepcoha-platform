<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  subtitle?: string;
  width?: string;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <transition name="drawer-fade">
    <div v-if="open" class="fixed inset-0 z-40" @keydown.esc="emit('close')">
      <!-- Lớp nền mờ -->
      <div class="absolute inset-0 bg-slate-900/40" @click="emit('close')"></div>
      <!-- Khung trượt từ phải -->
      <transition name="drawer-slide">
        <aside
          v-if="open"
          class="absolute right-0 top-0 flex h-full flex-col bg-white shadow-2xl"
          :style="{ width: width ?? '480px', maxWidth: '95vw' }"
        >
          <header class="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">{{ title }}</h2>
              <p v-if="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
            </div>
            <button
              class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Đóng"
              @click="emit('close')"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </header>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="border-t border-slate-200 px-5 py-3"
          >
            <slot name="footer" />
          </footer>
        </aside>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.25s ease;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
