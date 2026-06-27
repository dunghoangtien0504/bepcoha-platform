<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { promptApi } from '@/api/endpoints';
import type { AnalyzedPrompt } from '@/api/types';
import { formatNumber } from '@/utils/format';
import { toastError, toastSuccess } from '@/utils/swal';

const rows = ref<AnalyzedPrompt[]>([]);
const loading = ref(true);
const preview = ref<AnalyzedPrompt | null>(null);

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    rows.value = await promptApi.cached();
  } finally {
    loading.value = false;
  }
};
const removeCache = async (p: AnalyzedPrompt): Promise<void> => {
  try {
    await promptApi.setCache(p.id, false);
    toastSuccess('Đã bỏ khỏi cache.');
    await load();
  } catch {
    toastError('Thao tác thất bại.');
  }
};
const copy = async (p: AnalyzedPrompt): Promise<void> => {
  try {
    await navigator.clipboard.writeText(p.contentPreview ?? '');
    toastSuccess('Đã copy prompt.');
  } catch {
    toastError('Trình duyệt chặn clipboard.');
  }
};
onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">Prompt Caching</h1>
      <p class="text-sm text-slate-500">Các prompt chất lượng đã được cache / đưa vào knowledge để tái sử dụng.</p>
    </header>

    <p v-if="loading" class="text-sm text-slate-400">Đang tải…</p>

    <section v-else class="grid gap-4 md:grid-cols-2">
      <div v-for="p in rows" :key="p.id" class="card space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex gap-1">
            <span v-if="p.isCached" class="rounded bg-brand-light px-2 py-0.5 text-xs font-medium text-brand">cached</span>
            <span v-if="p.isKnowledge" class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">knowledge</span>
          </div>
          <span class="text-xs text-slate-400">{{ formatNumber(p.totalTokens) }} token · {{ p.model ?? '—' }}</span>
        </div>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{{ p.contentPreview }}</pre>
        <div class="flex justify-end gap-3 text-sm">
          <button class="text-brand hover:underline" @click="copy(p)">Copy</button>
          <button class="text-slate-500 hover:underline" @click="preview = p">Xem</button>
          <button class="text-rose-600 hover:underline" @click="removeCache(p)">Bỏ cache</button>
        </div>
      </div>
      <p v-if="rows.length === 0" class="card text-center text-sm text-slate-400 md:col-span-2">
        Chưa có prompt nào được cache. Vào <strong>Prompt List</strong> để đưa prompt chất lượng vào cache.
      </p>
    </section>

    <div v-if="preview" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" @click.self="preview = null">
      <div class="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">Prompt (rút gọn)</h3>
          <button class="text-slate-400 hover:text-slate-700" @click="preview = null"><span class="material-symbols-rounded">close</span></button>
        </div>
        <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{{ preview.contentPreview }}</pre>
      </div>
    </div>
  </div>
</template>
