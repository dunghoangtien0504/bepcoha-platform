<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { promptApi } from '@/api/endpoints';
import type { PromptPerformance } from '@/api/types';
import { formatNumber } from '@/utils/format';

const perf = ref<PromptPerformance | null>(null);
const loading = ref(true);

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    perf.value = await promptApi.performance();
  } finally {
    loading.value = false;
  }
};
const pct = (good: number, poor: number): number => {
  const t = good + poor;
  return t ? Math.round((good / t) * 100) : 0;
};
onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">Prompt Performance</h1>
      <p class="text-sm text-slate-500">Số lượng prompt chất lượng vs kém hiệu quả theo dự án & người dùng.</p>
    </header>

    <p v-if="loading" class="text-sm text-slate-400">Đang tải…</p>

    <template v-else-if="perf">
      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="card text-center"><div class="text-2xl font-bold text-slate-800">{{ perf.total }}</div><div class="text-xs text-slate-500">Tổng prompt</div></div>
        <div class="card text-center"><div class="text-2xl font-bold text-emerald-600">{{ perf.good }}</div><div class="text-xs text-slate-500">Chất lượng</div></div>
        <div class="card text-center"><div class="text-2xl font-bold text-rose-600">{{ perf.poor }}</div><div class="text-xs text-slate-500">Kém hiệu quả</div></div>
        <div class="card text-center"><div class="text-2xl font-bold text-brand">{{ perf.goodPercent }}%</div><div class="text-xs text-slate-500">Tỷ lệ chất lượng</div></div>
      </section>

      <section class="card">
        <h2 class="mb-1 text-sm font-semibold text-slate-700">Token lãng phí (từ prompt kém)</h2>
        <p class="text-2xl font-bold text-rose-600">{{ formatNumber(perf.wastedTokens) }} <span class="text-sm font-normal text-slate-400">token</span></p>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <div class="card">
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Theo dự án</h2>
          <div v-for="r in perf.byProject" :key="r.key" class="mb-2">
            <div class="flex justify-between text-sm"><span class="text-slate-600">{{ r.label }}</span><span class="text-slate-500">{{ r.good }}✓ / {{ r.poor }}✗</span></div>
            <div class="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="bg-emerald-500" :style="{ width: pct(r.good, r.poor) + '%' }"></div>
              <div class="bg-rose-400" :style="{ width: (100 - pct(r.good, r.poor)) + '%' }"></div>
            </div>
          </div>
          <p v-if="perf.byProject.length === 0" class="text-sm text-slate-400">Chưa có dữ liệu.</p>
        </div>
        <div class="card">
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Theo người dùng</h2>
          <div v-for="r in perf.byUser" :key="r.key" class="mb-2">
            <div class="flex justify-between text-sm"><span class="text-slate-600">{{ r.label }}</span><span class="text-slate-500">{{ r.good }}✓ / {{ r.poor }}✗</span></div>
            <div class="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="bg-emerald-500" :style="{ width: pct(r.good, r.poor) + '%' }"></div>
              <div class="bg-rose-400" :style="{ width: (100 - pct(r.good, r.poor)) + '%' }"></div>
            </div>
          </div>
          <p v-if="perf.byUser.length === 0" class="text-sm text-slate-400">Chưa có dữ liệu.</p>
        </div>
      </section>
    </template>
  </div>
</template>
