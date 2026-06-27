<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { usageApi } from '@/api/endpoints';
import type { CaptureMode, IngestResult, IngestUsagePayload, UsageBreakdownRow } from '@/api/types';
import MetricCard from '@/components/common/MetricCard.vue';
import { formatNumber, formatUsd } from '@/utils/format';

const breakdown = ref<UsageBreakdownRow[]>([]);
const models = ref<string[]>([]);
const result = ref<IngestResult | null>(null);
const message = ref<string | null>(null);
const submitting = ref(false);

const form = reactive<{
  captureMode: CaptureMode;
  taskId: string;
  requesterId: string;
  model: string;
  promptText: string;
  completionText: string;
  dryRun: boolean;
}>({
  captureMode: 'CHAT',
  taskId: 'TERO-102',
  requesterId: 'dev@storo.vn',
  model: 'claude-3-5-sonnet',
  promptText: '',
  completionText: '',
  dryRun: true,
});

const loadBreakdown = async (): Promise<void> => {
  try {
    breakdown.value = await usageApi.breakdown();
  } catch {
    message.value = 'Không tải được thống kê nguồn dữ liệu.';
  }
};

const loadModels = async (): Promise<void> => {
  try {
    models.value = await usageApi.models();
    // Đảm bảo model đang chọn nằm trong danh sách hợp lệ.
    if (models.value.length > 0 && !models.value.includes(form.model)) {
      form.model = models.value[0];
    }
  } catch {
    message.value = 'Không tải được danh sách mô hình.';
  }
};

const ingest = async (): Promise<void> => {
  if (!form.taskId || !form.requesterId || !form.promptText) {
    message.value = 'Cần có Task ID, người thực hiện và nội dung prompt.';
    return;
  }
  submitting.value = true;
  message.value = null;
  try {
    const payload: IngestUsagePayload = {
      taskId: form.taskId,
      requesterId: form.requesterId,
      model: form.model || undefined,
      promptText: form.promptText,
      completionText: form.completionText || undefined,
      captureMode: form.captureMode,
      dryRun: form.dryRun,
    };
    result.value = await usageApi.ingest(payload);
    message.value = form.dryRun
      ? 'Ước tính thử (dry-run) — chưa ghi vào nhật ký.'
      : 'Đã ghi nhận usage ước tính vào nhật ký kiểm toán.';
    if (!form.dryRun) await loadBreakdown();
  } catch {
    message.value = 'Đo lường thất bại. Kiểm tra Task ID có tồn tại không.';
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  void loadBreakdown();
  void loadModels();
});
</script>

<template>
  <div class="space-y-6 p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">Đo lường AI Usage</h1>
      <p class="text-sm text-slate-500">
        Ước lượng token &amp; chi phí tham chiếu cho gói cố định (Claude Pro) — không phụ thuộc API
        nhà cung cấp. Thử nghiệm theo 2 ngữ cảnh: prompt chat trong IDE và payload qua API.
      </p>
    </header>
    <p v-if="message" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{{ message }}</p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-800">Nhập liệu đo lường</h2>

        <div class="mb-4 flex gap-2">
          <button
            class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="form.captureMode === 'CHAT' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-600'"
            @click="form.captureMode = 'CHAT'"
          >
            💬 Chat trong IDE (trên file code)
          </button>
          <button
            class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
            :class="form.captureMode === 'API' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-600'"
            @click="form.captureMode = 'API'"
          >
            🔌 API (payload làm prompt)
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="text-sm text-slate-600">
            Task ID
            <input v-model="form.taskId" class="input mt-1" placeholder="TERO-102" />
          </label>
          <label class="text-sm text-slate-600">
            Người thực hiện (email)
            <input v-model="form.requesterId" class="input mt-1" placeholder="dev@storo.vn" />
          </label>
          <label class="col-span-2 text-sm text-slate-600">
            Mô hình tham chiếu
            <select v-model="form.model" class="input mt-1">
              <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
            </select>
            <span class="mt-1 block text-xs text-slate-400">
              Chọn đúng tên model (khớp với API key/IDE) để AI chạy được khi đo thực tế.
            </span>
          </label>
          <label class="col-span-2 text-sm text-slate-600">
            {{ form.captureMode === 'CHAT' ? 'Prompt / nội dung file code' : 'Payload (đầu vào)' }}
            <textarea v-model="form.promptText" rows="5" class="input mt-1" placeholder="Dán nội dung prompt hoặc đoạn code..."></textarea>
          </label>
          <label class="col-span-2 text-sm text-slate-600">
            Kết quả AI trả về (tùy chọn)
            <textarea v-model="form.completionText" rows="3" class="input mt-1" placeholder="Phản hồi của mô hình (nếu có)..."></textarea>
          </label>
        </div>

        <label class="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input v-model="form.dryRun" type="checkbox" class="h-4 w-4" />
          Chạy thử (dry-run) — chỉ ước tính, không ghi nhật ký
        </label>

        <button class="btn-primary mt-4 w-full" :disabled="submitting" @click="ingest">
          {{ submitting ? 'Đang đo...' : 'Đo lường' }}
        </button>
      </section>

      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-800">Kết quả ước tính</h2>
        <div v-if="result" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <MetricCard title="Tổng token" :primary="formatNumber(result.totalTokens)" />
            <MetricCard title="Chi phí tham chiếu" :primary="formatUsd(result.costUsd)" tone="neutral" />
          </div>
          <div class="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <p>Prompt tokens: <strong>{{ formatNumber(result.usage.promptTokens) }}</strong></p>
            <p>Completion tokens: <strong>{{ formatNumber(result.usage.completionTokens) }}</strong></p>
            <p>Overhead hệ thống: <strong>{{ formatNumber(result.usage.systemOverheadTokens) }}</strong></p>
            <p>Hệ số OT: <strong>{{ result.otMultiplier }}</strong> · Mô hình: <strong>{{ result.model }}</strong></p>
            <p>Nguồn: <strong>{{ result.source }}</strong> ·
              {{ result.persisted ? 'đã ghi nhật ký' : 'chưa ghi (dry-run)' }}
            </p>
          </div>
        </div>
        <p v-else class="py-6 text-center text-sm text-slate-400">
          Nhập nội dung và bấm “Đo lường” để xem ước tính token &amp; chi phí.
        </p>
      </section>
    </div>

    <section class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Thống kê theo nguồn dữ liệu</h2>
      <div class="table-scroll">
      <table class="data-table min-w-[480px]">
        <thead>
          <tr class="border-b text-left text-slate-500">
            <th class="py-2">Nguồn</th>
            <th class="text-right">Số request</th>
            <th class="text-right">Tổng token</th>
            <th class="text-right">Chi phí (USD)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in breakdown" :key="row.source" class="border-b last:border-0">
            <td class="py-2">
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{{ row.source }}</span>
            </td>
            <td class="text-right">{{ formatNumber(row.requestCount) }}</td>
            <td class="text-right">{{ formatNumber(row.totalTokens) }}</td>
            <td class="text-right">{{ formatUsd(row.totalCostUsd) }}</td>
          </tr>
          <tr v-if="breakdown.length === 0">
            <td colspan="4" class="py-6 text-center text-slate-400">Chưa có dữ liệu usage.</td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>
  </div>
</template>
