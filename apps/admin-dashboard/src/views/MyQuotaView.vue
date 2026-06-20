<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { quotaApi } from '@/api/endpoints';
import type { QuotaCycleStatus, QuotaSnapshot } from '@/api/types';
import MetricCard from '@/components/common/MetricCard.vue';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber } from '@/utils/format';

const auth = useAuthStore();
const router = useRouter();

const snapshot = ref<QuotaSnapshot | null>(null);
const message = ref<string | null>(null);

const tokenValue = ref<string>('');
const hasToken = ref<boolean>(false);
const tokenDirty = ref<boolean>(false);
const tokenCopied = ref<boolean>(false);
const tokenSaving = ref<boolean>(false);

const cycleLabel: Record<QuotaCycleStatus['cycle'], string> = {
  DAILY: 'Theo ngày',
  WEEKLY: 'Theo tuần',
  MONTHLY: 'Theo tháng',
  TASK: 'Theo task',
};

// Chỉ hiển thị các chu kỳ định kỳ (bỏ TASK vì phụ thuộc taskId cụ thể).
const cycles = computed<QuotaCycleStatus[]>(
  () => snapshot.value?.cycles.filter((c) => c.cycle !== 'TASK') ?? [],
);

const ideConfig = computed(
  () => `{
  "models": [
    {
      "title": "Claude 3.5 Sonnet (STORO Gateway)",
      "provider": "openai",
      "model": "claude-3-5-sonnet",
      "apiBase": "http://localhost:3900/v1",
      "apiKey": "${tokenValue.value || 'storo_live_...'}",
      "requestOptions": { "headers": { "X-Task-ID": "TERO-102" } }
    }
  ]
}`,
);

const load = async (): Promise<void> => {
  try {
    const [snap, token] = await Promise.all([quotaApi.myQuota(), quotaApi.myInternalToken()]);
    snapshot.value = snap;
    tokenValue.value = token.internalToken ?? '';
    hasToken.value = token.hasToken;
    tokenDirty.value = false;
  } catch {
    message.value = 'Không tải được hạn ngạch của bạn.';
  }
};

const refreshToken = async (): Promise<void> => {
  try {
    const { internalToken } = await quotaApi.generateInternalToken();
    tokenValue.value = internalToken;
    tokenDirty.value = true;
    tokenCopied.value = false;
  } catch {
    message.value = 'Sinh token mới thất bại.';
  }
};

const copyToken = async (): Promise<void> => {
  if (!tokenValue.value) return;
  try {
    await navigator.clipboard.writeText(tokenValue.value);
    tokenCopied.value = true;
    setTimeout(() => (tokenCopied.value = false), 1500);
  } catch {
    message.value = 'Trình duyệt chặn quyền clipboard.';
  }
};

const saveToken = async (): Promise<void> => {
  if (!tokenValue.value) return;
  tokenSaving.value = true;
  try {
    const saved = await quotaApi.saveMyInternalToken(tokenValue.value);
    tokenValue.value = saved.internalToken ?? '';
    hasToken.value = saved.hasToken;
    tokenDirty.value = false;
    message.value = 'Đã lưu internal token.';
  } catch {
    message.value = 'Lưu token thất bại (token có thể trùng, hãy sinh lại).';
  } finally {
    tokenSaving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <header>
      <h1 class="text-2xl font-bold text-slate-900">
        Hạn ngạch của tôi
      </h1>
      <p class="text-sm text-slate-500">
        {{ auth.user?.displayName || auth.user?.fullName }} · {{ auth.user?.email }} — token nội bộ,
        hạn ngạch token và lối tắt tới công việc của bạn.
      </p>
    </header>
    <p v-if="message" class="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
      {{ message }}
    </p>

    <!-- Internal token self-service -->
    <section class="card">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">Internal Token của tôi</h2>
        <span
          class="rounded px-2 py-0.5 text-xs"
          :class="hasToken ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
        >
          {{ hasToken ? 'Đã cấp' : 'Chưa cấp' }}
        </span>
      </div>
      <p class="mb-3 text-sm text-slate-500">
        Dùng token này để cấu hình IDE/VSCode gọi qua Gateway. Bấm <strong>↻</strong> để đổi token
        mới, rồi <strong>Lưu</strong>. Đổi token sẽ vô hiệu token cũ.
      </p>
      <div class="flex items-center gap-2">
        <code class="flex-1 truncate rounded-lg bg-slate-900 px-3 py-2 text-sm text-emerald-300">
          {{ tokenValue || '— chưa có token —' }}
        </code>
        <button class="btn-ghost flex items-center gap-1" title="Sinh token mới" @click="refreshToken">
          <span class="material-symbols-rounded text-[18px]">refresh</span>
        </button>
        <button class="btn-ghost" :disabled="!tokenValue" @click="copyToken">
          {{ tokenCopied ? 'Đã chép ✓' : 'Copy' }}
        </button>
        <button
          class="btn-primary"
          :disabled="!tokenValue || tokenSaving || (!tokenDirty && hasToken)"
          @click="saveToken"
        >
          {{ tokenSaving ? 'Đang lưu...' : 'Lưu' }}
        </button>
      </div>
      <p v-if="tokenDirty" class="mt-2 text-xs text-amber-600">
        Token mới chưa được lưu — bấm “Lưu” để áp dụng.
      </p>

      <div class="mt-4">
        <p class="mb-1 text-sm font-medium text-slate-600">Cấu hình IDE (Continue.dev)</p>
        <pre class="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">{{ ideConfig }}</pre>
      </div>
    </section>

    <!-- Hạn ngạch token theo chu kỳ -->
    <section>
      <h2 class="mb-3 font-semibold text-slate-800">Hạn ngạch token theo chu kỳ</h2>
      <div v-if="cycles.length" class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          v-for="c in cycles"
          :key="c.cycle"
          :title="cycleLabel[c.cycle]"
          :primary="c.unlimited ? 'Không giới hạn' : formatNumber(c.used) + ' / ' + formatNumber(c.limit)"
          :secondary="c.unlimited ? 'Đã dùng ' + formatNumber(c.used) + ' token' : 'token đã dùng / hạn mức'"
          :tone="!c.unlimited && c.used >= c.limit ? 'negative' : 'neutral'"
        />
      </div>
      <p v-else class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Bạn chưa được cấu hình hạn ngạch. Liên hệ quản trị viên để được phân bổ.
      </p>
    </section>

    <!-- Lối tắt -->
    <section class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Lối tắt</h2>
      <div class="flex flex-wrap gap-3">
        <button class="btn-ghost flex items-center gap-1" @click="router.push({ name: 'dashboard' })">
          <span class="material-symbols-rounded text-[18px]">dashboard</span> Dashboard
        </button>
        <button class="btn-ghost flex items-center gap-1" @click="router.push({ name: 'work-projects' })">
          <span class="material-symbols-rounded text-[18px]">folder_managed</span> Dự án của tôi
        </button>
        <button class="btn-ghost flex items-center gap-1" @click="router.push({ name: 'work-tasks' })">
          <span class="material-symbols-rounded text-[18px]">task_alt</span> Công việc của tôi
        </button>
        <button class="btn-ghost flex items-center gap-1" @click="router.push({ name: 'usage' })">
          <span class="material-symbols-rounded text-[18px]">insights</span> Đo lường usage
        </button>
      </div>
    </section>
  </div>
</template>
