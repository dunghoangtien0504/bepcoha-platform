<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { promptApi } from '@/api/endpoints';
import type { AnalyzedPrompt } from '@/api/types';
import { formatNumber } from '@/utils/format';
import { toastError, toastSuccess } from '@/utils/swal';

const rows = ref<AnalyzedPrompt[]>([]);
const loading = ref(true);
const filters = reactive({ quality: '' as '' | 'good' | 'poor' });
const preview = ref<AnalyzedPrompt | null>(null);

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    rows.value = await promptApi.list({ quality: filters.quality || undefined, limit: 300 });
  } finally {
    loading.value = false;
  }
};

const setCache = async (p: AnalyzedPrompt): Promise<void> => {
  try {
    await promptApi.setCache(p.id, !p.isCached);
    toastSuccess(p.isCached ? 'Đã bỏ cache.' : 'Đã đưa vào cache.');
    await load();
  } catch {
    toastError('Thao tác thất bại.');
  }
};
const setKnowledge = async (p: AnalyzedPrompt): Promise<void> => {
  try {
    await promptApi.setKnowledge(p.id, !p.isKnowledge);
    toastSuccess(p.isKnowledge ? 'Đã gỡ khỏi knowledge.' : 'Đã đưa vào knowledge.');
    await load();
  } catch {
    toastError('Thao tác thất bại.');
  }
};
onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Prompt List</h1>
        <p class="text-sm text-slate-500">Danh sách prompt đã capture — chất lượng, token, lý do, và đưa vào cache/knowledge.</p>
      </div>
      <select v-model="filters.quality" class="input w-48" @change="load">
        <option value="">— Tất cả chất lượng —</option>
        <option value="good">Chất lượng</option>
        <option value="poor">Kém hiệu quả</option>
      </select>
    </header>

    <section class="card">
      <div class="table-scroll">
        <table class="data-table min-w-[980px]">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Nội dung (rút gọn)</th><th>Chất lượng</th><th class="text-right">Token</th>
              <th>Model</th><th>Lý do</th><th>Cờ</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" class="border-b last:border-0 hover:bg-slate-50">
              <td class="max-w-[320px] truncate py-2 text-slate-700">
                <button class="text-left hover:text-brand" @click="preview = p">{{ p.contentPreview ?? '—' }}</button>
              </td>
              <td>
                <span v-if="p.quality === 'good'" class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Chất lượng ({{ p.qualityScore }})</span>
                <span v-else class="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">✗ Kém ({{ p.qualityScore }})</span>
              </td>
              <td class="text-right text-slate-500">{{ formatNumber(p.totalTokens) }}</td>
              <td class="text-slate-500">{{ p.model ?? '—' }}</td>
              <td class="max-w-[220px] text-xs text-rose-500">{{ p.reasons.join('; ') || '—' }}</td>
              <td class="whitespace-nowrap text-xs">
                <span v-if="p.isCached" class="mr-1 rounded bg-brand-light px-1.5 py-0.5 text-brand">cached</span>
                <span v-if="p.isKnowledge" class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">knowledge</span>
              </td>
              <td class="whitespace-nowrap text-right">
                <button class="text-brand hover:underline" @click="setCache(p)">{{ p.isCached ? 'Bỏ cache' : 'Cache' }}</button>
                <button class="ml-3 text-amber-600 hover:underline" @click="setKnowledge(p)">{{ p.isKnowledge ? 'Bỏ KB' : 'Knowledge' }}</button>
              </td>
            </tr>
            <tr v-if="rows.length === 0 && !loading"><td colspan="7" class="py-6 text-center text-slate-400">Chưa có prompt nào được capture.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Preview modal -->
    <div v-if="preview" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" @click.self="preview = null">
      <div class="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">Nội dung prompt (rút gọn)</h3>
          <button class="text-slate-400 hover:text-slate-700" @click="preview = null"><span class="material-symbols-rounded">close</span></button>
        </div>
        <p class="text-xs text-slate-400">{{ preview.totalTokens }} token · {{ preview.model ?? '—' }} · hash {{ (preview.contentHash ?? '').slice(0, 12) }}…</p>
        <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{{ preview.contentPreview }}</pre>
      </div>
    </div>
  </div>
</template>
