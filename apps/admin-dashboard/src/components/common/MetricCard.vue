<script setup lang="ts">
defineProps<{
  title: string;
  primary: string;
  secondary?: string;
  tone?: 'neutral' | 'positive' | 'negative';
}>();
</script>

<template>
  <div class="card">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ title }}</p>
    <p
      class="mt-2 text-2xl font-bold"
      :class="{
        'text-slate-900': !tone || tone === 'neutral',
        'text-emerald-600': tone === 'positive',
        'text-rose-600': tone === 'negative',
      }"
    >
      {{ primary }}
    </p>
    <p v-if="secondary" class="mt-1 text-sm text-slate-500">{{ secondary }}</p>
  </div>
</template>
