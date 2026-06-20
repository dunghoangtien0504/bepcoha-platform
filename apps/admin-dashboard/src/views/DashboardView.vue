<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { reportsApi } from '@/api/endpoints';
import type {
  AnomalyAlert,
  ModelEfficiencyRow,
  RoiRealReport,
  RoiSummary,
  TaskPerformance,
  TokenWasteReport,
  TrendPoint,
} from '@/api/types';
import LineTrendChart from '@/components/charts/LineTrendChart.vue';
import TaskPerformanceChart from '@/components/charts/TaskPerformanceChart.vue';
import MetricCard from '@/components/common/MetricCard.vue';
import { useOnboardingTour } from '@/composables/useOnboardingTour';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, formatUsd, formatVnd } from '@/utils/format';

const auth = useAuthStore();

const summary = ref<RoiSummary | null>(null);
const trends = ref<TrendPoint[]>([]);
const performance = ref<TaskPerformance[]>([]);
const anomalies = ref<AnomalyAlert[]>([]);
const roiReal = ref<RoiRealReport | null>(null);
const modelMatrix = ref<ModelEfficiencyRow[]>([]);
const tokenWaste = ref<TokenWasteReport | null>(null);
const granularity = ref<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
const loading = ref(true);
const errorMessage = ref<string | null>(null);

const demoToken = 'storo_live_demo_dev_token_0001';
const copied = ref(false);

const ideConfig = `{
  "models": [
    {
      "title": "Claude 3.5 Sonnet (STORO Gateway)",
      "provider": "openai",
      "model": "claude-3-5-sonnet",
      "apiBase": "http://localhost:3900/v1",
      "apiKey": "storo_live_your_internal_token_here",
      "requestOptions": { "headers": { "X-Task-ID": "TERO-102" } }
    }
  ]
}`;

const copyToken = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(demoToken);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    errorMessage.value = 'Trình duyệt chặn quyền clipboard.';
  }
};

/** Định dạng thời lượng ms → ngắn gọn. */
const fmtMs = (ms: number | null): string =>
  ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

const loadTrends = async (): Promise<void> => {
  trends.value = await reportsApi.trends(granularity.value);
};

const loadAll = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = null;
  try {
    const [summaryData, performanceData, anomalyData, roiRealData, matrixData, wasteData] =
      await Promise.all([
        reportsApi.summary(),
        reportsApi.taskPerformance(),
        reportsApi.anomalies(),
        reportsApi.roiReal(),
        reportsApi.modelEfficiency(),
        reportsApi.tokenWaste(),
      ]);
    summary.value = summaryData;
    performance.value = performanceData;
    anomalies.value = anomalyData;
    roiReal.value = roiRealData;
    modelMatrix.value = matrixData;
    tokenWaste.value = wasteData;
    await loadTrends();
  } catch {
    errorMessage.value = 'Không tải được dữ liệu báo cáo. Kiểm tra kết nối Gateway.';
  } finally {
    loading.value = false;
  }
};

const { start } = useOnboardingTour(() => auth.markOnboarded());

onMounted(async () => {
  await loadAll();
  if (auth.needsOnboarding()) {
    setTimeout(start, 600);
  }
});
</script>

<template>
  <div class="space-y-6 p-6">
    <header id="tour-intro" class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Báo cáo Tổng thể ROI & KPI</h1>
        <p class="text-sm text-slate-500">
          Quy đổi token tiêu thụ ra chi phí thực tế và giá trị giờ công tiết kiệm được.
        </p>
      </div>
      <button class="btn-ghost" @click="start">▶ Xem hướng dẫn</button>
    </header>

    <p v-if="errorMessage" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <section v-if="summary" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Tổng chi phí AI"
        :primary="formatVnd(summary.totalAiCostVnd)"
        :secondary="formatUsd(summary.totalAiCostUsd) + ' · ' + formatNumber(summary.totalTokens) + ' tokens'"
      />
      <MetricCard
        title="Giá trị nhân công tiết kiệm"
        :primary="formatVnd(summary.laborValueSavedVnd)"
        :secondary="formatUsd(summary.laborValueSavedUsd)"
        tone="positive"
      />
      <MetricCard
        title="Lợi nhuận ròng công nghệ (Net ROI)"
        :primary="formatVnd(summary.netRoiVnd)"
        :secondary="formatUsd(summary.netRoiUsd)"
        :tone="summary.netRoiVnd >= 0 ? 'positive' : 'negative'"
      />
      <MetricCard
        title="Số request đã xử lý"
        :primary="formatNumber(summary.requestCount)"
        :secondary="'Tỷ giá: 1 USD = ' + formatNumber(summary.usdToVnd) + 'đ'"
      />
    </section>

    <!-- Giải thích cách tính các chỉ số cho người dùng -->
    <section v-if="summary" class="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
      <p class="mb-1 font-semibold text-slate-700">Cách tính chỉ số</p>
      <ul class="list-inside list-disc space-y-1">
        <li><strong>Tổng chi phí AI</strong> = Σ chi phí token (USD) của mọi request, quy ra token theo bảng giá từng model.</li>
        <li>
          <strong>Giá trị nhân công tiết kiệm</strong> = Σ (Baseline − Thực tế) × đơn giá giờ công × hệ số tăng ca (OT),
          chỉ tính các task đã <strong>DONE</strong>.
        </li>
        <li><strong>Net ROI</strong> = Giá trị nhân công tiết kiệm − Tổng chi phí AI.</li>
        <li>
          <strong>Quy đổi VND</strong> = USD × tỷ giá. Hiện tại: 1 USD =
          <strong>{{ formatNumber(summary.usdToVnd) }}đ</strong>.
        </li>
      </ul>
      <p class="mt-2 text-xs text-slate-400">
        Tỷ giá &amp; chế độ quy đổi (API/MANUAL), đơn giá giờ công mặc định, hệ số OT và ngưỡng cảnh báo
        đều khai báo trong <strong>Cấu hình hệ thống</strong> — đổi giá trị là công thức tự tính lại, không hard-code.
      </p>
    </section>

    <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div class="card">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold text-slate-800">Xu hướng tiêu thụ Token & Chi phí</h2>
          <select v-model="granularity" class="input w-auto" @change="loadTrends">
            <option value="DAILY">Theo ngày</option>
            <option value="WEEKLY">Theo tuần</option>
            <option value="MONTHLY">Theo tháng</option>
          </select>
        </div>
        <LineTrendChart :points="trends" />
      </div>

      <div class="card">
        <h2 class="mb-3 font-semibold text-slate-800">
          So sánh hiệu suất: Thủ công vs có AI (giờ công)
        </h2>
        <TaskPerformanceChart :tasks="performance" />
      </div>
    </section>

    <section class="card">
      <h2 class="mb-3 font-semibold text-slate-800">⚠️ Cảnh báo bất thường (Anomaly Alerts)</h2>
      <p v-if="anomalies.length === 0" class="text-sm text-slate-500">
        Không có tác vụ nào bị gắn cờ. Hệ thống đang vận hành lành mạnh.
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="alert in anomalies"
          :key="alert.taskId"
          class="rounded-lg border border-rose-200 bg-rose-50 p-3"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold text-rose-700">{{ alert.taskId }} — {{ alert.title }}</span>
            <span class="rounded bg-rose-200 px-2 py-0.5 text-xs text-rose-800">{{ alert.status }}</span>
          </div>
          <ul class="mt-1 list-inside list-disc text-sm text-rose-700">
            <li v-for="reason in alert.reasons" :key="reason">{{ reason }}</li>
          </ul>
        </li>
      </ul>
    </section>

    <!-- 2.1 ROI thực tế (AI vs Human Cost) -->
    <section v-if="roiReal" class="card">
      <h2 class="font-semibold text-slate-800">💰 ROI thực tế — AI vs Human Cost</h2>
      <p class="mt-0.5 text-xs text-slate-400">{{ roiReal.formula }}</p>
      <div class="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-lg bg-slate-50 p-3">
          <p class="text-xs text-slate-500">Chi phí nhân công (nếu tự làm)</p>
          <p class="text-lg font-bold text-slate-800">{{ formatUsd(roiReal.humanCostUsd) }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
          <p class="text-xs text-slate-500">Chi phí token AI</p>
          <p class="text-lg font-bold text-blue-700">{{ formatUsd(roiReal.aiTokenCostUsd) }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
          <p class="text-xs text-slate-500">Chi phí DEV review</p>
          <p class="text-lg font-bold text-amber-700">{{ formatUsd(roiReal.reviewCostUsd) }}</p>
        </div>
        <div class="rounded-lg p-3" :class="roiReal.savedUsd >= 0 ? 'bg-emerald-50' : 'bg-rose-50'">
          <p class="text-xs text-slate-500">Tiết kiệm ròng</p>
          <p class="text-lg font-bold" :class="roiReal.savedUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'">
            {{ formatVnd(roiReal.savedVnd) }}
          </p>
          <p class="text-xs text-slate-400">{{ formatUsd(roiReal.savedUsd) }}</p>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-400">
        Đơn giá giờ công: {{ formatUsd(roiReal.devRateUsd) }}/h · Review:
        {{ roiReal.reviewHoursPerTask }}h/task · {{ roiReal.taskCount }} task có log AI. Cấu hình tại
        <strong>Cấu hình hệ thống</strong> (default_hourly_rate_usd, roi_review_hours_per_task).
      </p>
    </section>

    <!-- 2.2 Model Efficiency Matrix -->
    <section class="card">
      <h2 class="mb-3 font-semibold text-slate-800">🏆 Hiệu suất Model theo loại công việc</h2>
      <div class="table-scroll">
        <table class="data-table min-w-[760px]">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Loại công việc</th><th>Model</th><th class="text-right">Request</th>
              <th class="text-right">Token TB</th><th class="text-right">Chi phí TB</th><th class="text-right">Tốc độ TB</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in modelMatrix" :key="r.category + r.model" class="border-b last:border-0 hover:bg-slate-50">
              <td class="py-2 font-medium text-slate-700">{{ r.category }}</td>
              <td>{{ r.model }}</td>
              <td class="text-right text-slate-500">{{ r.requests }}</td>
              <td class="text-right text-slate-500">{{ formatNumber(r.avgTokens) }}</td>
              <td class="text-right font-medium text-slate-700">{{ formatUsd(r.avgCostUsd) }}</td>
              <td class="text-right text-slate-500">{{ fmtMs(r.avgDurationMs) }}</td>
              <td class="whitespace-nowrap">
                <span v-if="r.bestCost" class="mr-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Rẻ nhất</span>
                <span v-if="r.bestSpeed" class="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">Nhanh nhất</span>
              </td>
            </tr>
            <tr v-if="modelMatrix.length === 0"><td colspan="7" class="py-6 text-center text-slate-400">Chưa có dữ liệu request AI để xếp hạng.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-slate-400">“Rẻ nhất” = chi phí token TB thấp nhất trong loại; “Nhanh nhất” = thời gian phản hồi TB thấp nhất (chỉ đo được với request realtime/GATEWAY).</p>
    </section>

    <!-- 2.3 Token Waste Tracker -->
    <section v-if="tokenWaste" class="card">
      <h2 class="font-semibold text-slate-800">🔥 Lãng phí Token (Token Waste Tracker)</h2>
      <div class="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">Tổng token</p><p class="text-lg font-bold text-slate-800">{{ formatNumber(tokenWaste.totalTokens) }}</p></div>
        <div class="rounded-lg bg-rose-50 p-3"><p class="text-xs text-slate-500">Token lãng phí</p><p class="text-lg font-bold text-rose-700">{{ formatNumber(tokenWaste.wastedTokens) }}</p><p class="text-xs text-rose-400">{{ tokenWaste.wastePercent }}%</p></div>
        <div class="rounded-lg bg-rose-50 p-3"><p class="text-xs text-slate-500">Chi phí lãng phí</p><p class="text-lg font-bold text-rose-700">{{ formatVnd(tokenWaste.wastedVnd) }}</p><p class="text-xs text-slate-400">{{ formatUsd(tokenWaste.wastedCostUsd) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">Ngưỡng prompt/hội thoại</p><p class="text-lg font-bold text-slate-800">{{ tokenWaste.threshold }}</p></div>
      </div>
      <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full bg-rose-500" :style="{ width: Math.min(tokenWaste.wastePercent, 100) + '%' }"></div>
      </div>
      <div v-if="tokenWaste.offenders.length" class="mt-3">
        <p class="mb-1 text-sm font-semibold text-slate-700">Hội thoại/task lãng phí nhiều nhất</p>
        <ul class="space-y-1 text-sm">
          <li v-for="o in tokenWaste.offenders" :key="o.key" class="flex justify-between border-b border-slate-100 py-1">
            <span class="text-slate-600">{{ o.label }} <span class="text-xs text-slate-400">({{ o.prompts }} prompt)</span></span>
            <span class="font-medium text-rose-600">{{ formatNumber(o.wastedTokens) }} token</span>
          </li>
        </ul>
      </div>
      <p v-else class="mt-2 text-sm text-slate-500">Chưa phát hiện lãng phí (không hội thoại nào vượt {{ tokenWaste.threshold }} prompt).</p>
      <p class="mt-2 text-xs text-slate-400">Ngưỡng cấu hình tại <strong>Cấu hình hệ thống</strong> (waste_max_prompts_per_conversation).</p>
    </section>

    <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div id="tour-token" class="card">
        <h2 class="mb-2 font-semibold text-slate-800">Thẻ căn cước nội bộ (Internal Token)</h2>
        <p class="mb-3 text-sm text-slate-500">
          Mã định danh cá nhân duy nhất để cấu hình xác thực vào IDE.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 truncate rounded-lg bg-slate-900 px-3 py-2 text-sm text-emerald-300">
            {{ demoToken }}
          </code>
          <button class="btn-primary" @click="copyToken">{{ copied ? 'Đã chép ✓' : 'Copy' }}</button>
        </div>
        <div id="tour-discipline" class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Kỷ luật Task ID:</strong> trước mỗi đầu việc mới, đổi X-Task-ID khớp mã thẻ
          công việc trên Jira (hoặc dùng Git Hook tự bóc tách tên branch).
        </div>
      </div>

      <div id="tour-ide" class="card">
        <h2 class="mb-2 font-semibold text-slate-800">Cấu hình IDE (Continue.dev)</h2>
        <pre class="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">{{ ideConfig }}</pre>
      </div>
    </section>
  </div>
</template>
