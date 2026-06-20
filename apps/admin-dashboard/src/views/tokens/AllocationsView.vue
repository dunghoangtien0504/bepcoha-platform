<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { quotaApi } from '@/api/endpoints';
import type { QuotaAllocation } from '@/api/types';
import { formatNumber } from '@/utils/format';

const router = useRouter();
const allocations = ref<QuotaAllocation[]>([]);
const message = ref<string | null>(null);

const load = async (): Promise<void> => {
  try {
    allocations.value = await quotaApi.allocations();
  } catch {
    message.value = 'Không tải được danh sách phân bổ.';
  }
};

const openDetail = (userId: string): void => {
  void router.push({ name: 'token-allocation-detail', params: { userId } });
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">Danh sách phân bổ</h1>
      <p class="text-sm text-slate-500">Hạn ngạch token chuẩn và phần cấp thêm theo từng nhân viên.</p>
    </header>
    <p v-if="message" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{{ message }}</p>

    <section class="card">
      <div class="table-scroll">
      <table class="data-table min-w-[640px]">
        <thead>
          <tr class="border-b text-left text-slate-500">
            <th class="py-2">Nhân viên</th>
            <th class="text-right">Hạn ngạch chuẩn</th>
            <th class="text-right">Cấp thêm</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in allocations"
            :key="row.userId"
            class="cursor-pointer border-b last:border-0 hover:bg-slate-50"
            @click="openDetail(row.userId)"
          >
            <td class="py-2">
              <p class="font-medium text-slate-800">{{ row.displayName || row.fullName }}</p>
              <p class="text-xs text-slate-500">{{ row.email }}{{ row.title ? ' · ' + row.title : '' }}</p>
            </td>
            <td class="text-right">
              <span v-if="row.hasQuota">
                Tháng {{ formatNumber(row.monthlyLimit) }} · Tuần {{ formatNumber(row.weeklyLimit) }} ·
                Ngày {{ formatNumber(row.dailyLimit) }}
              </span>
              <span v-else class="text-slate-400">Chưa cấp</span>
            </td>
            <td class="text-right text-emerald-600">+{{ formatNumber(row.addonTotal) }}</td>
            <td class="text-right text-brand">
              <span class="material-symbols-rounded align-middle text-[18px]">chevron_right</span>
            </td>
          </tr>
          <tr v-if="allocations.length === 0">
            <td colspan="4" class="py-6 text-center text-slate-400">Chưa có nhân viên.</td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>
  </div>
</template>
