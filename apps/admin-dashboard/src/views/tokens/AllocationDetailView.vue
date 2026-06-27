<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { quotaApi } from '@/api/endpoints';
import type { AddonCycle, QuotaAllocation, TokenAddon } from '@/api/types';
import { formatNumber } from '@/utils/format';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const route = useRoute();
const router = useRouter();
const userId = computed<string>(() => String(route.params.userId));

const allocation = ref<QuotaAllocation | null>(null);
const addons = ref<TokenAddon[]>([]);
const message = ref<string | null>(null);

// Internal token (mỗi nhân viên chỉ 1 token). tokenValue là giá trị đang hiển thị/sửa.
const tokenValue = ref<string>('');
const hasToken = ref<boolean>(false);
const tokenDirty = ref<boolean>(false);
const tokenCopied = ref<boolean>(false);
const tokenSaving = ref<boolean>(false);

// Mặc định để TRỐNG — người dùng tự quyết định nhập giá trị.
const quotaForm = reactive<{
  dailyLimit: number | null;
  weeklyLimit: number | null;
  monthlyLimit: number | null;
  taskLimit: number | null;
}>({ dailyLimit: null, weeklyLimit: null, monthlyLimit: null, taskLimit: null });

const addonForm = reactive<{
  addonTokens: number | null;
  cycleType: AddonCycle;
  startDate: string;
}>({
  addonTokens: null,
  cycleType: 'ONCE',
  startDate: new Date().toISOString().slice(0, 10),
});

const addonValidation = useValidationForm(addonForm, {
  addonTokens: {
    required: true,
    label: 'Số token cấp thêm',
    validator: (v) => (Number(v) > 0 ? null : 'Số token phải lớn hơn 0'),
  },
  startDate: { required: true, label: 'Ngày bắt đầu' },
});

const load = async (): Promise<void> => {
  try {
    const [allocations, addonList, token] = await Promise.all([
      quotaApi.allocations(),
      quotaApi.listAddons(),
      quotaApi.getInternalToken(userId.value),
    ]);
    allocation.value = allocations.find((a) => a.userId === userId.value) ?? null;
    addons.value = addonList.filter((a) => a.userId === userId.value);
    if (allocation.value?.hasQuota) {
      quotaForm.dailyLimit = allocation.value.dailyLimit;
      quotaForm.weeklyLimit = allocation.value.weeklyLimit;
      quotaForm.monthlyLimit = allocation.value.monthlyLimit;
      quotaForm.taskLimit = allocation.value.taskLimit;
    }
    tokenValue.value = token.internalToken ?? '';
    hasToken.value = token.hasToken;
    tokenDirty.value = false;
  } catch {
    message.value = 'Không tải được dữ liệu phân bổ.';
  }
};

const refreshToken = async (): Promise<void> => {
  try {
    const { internalToken } = await quotaApi.generateInternalToken();
    tokenValue.value = internalToken;
    tokenDirty.value = true;
    tokenCopied.value = false;
  } catch {
    toastError('Sinh token mới thất bại.');
  }
};

const copyToken = async (): Promise<void> => {
  if (!tokenValue.value) return;
  try {
    await navigator.clipboard.writeText(tokenValue.value);
    tokenCopied.value = true;
    setTimeout(() => (tokenCopied.value = false), 1500);
  } catch {
    toastError('Trình duyệt chặn quyền clipboard.');
  }
};

const saveToken = async (): Promise<void> => {
  if (!tokenValue.value) return;
  const ok = await confirmSubmit({
    title: 'Lưu Internal Token?',
    text: 'Token mới sẽ thay thế token hiện tại của nhân viên này.',
  });
  if (!ok) return;
  tokenSaving.value = true;
  try {
    const saved = await quotaApi.saveInternalToken(userId.value, tokenValue.value);
    tokenValue.value = saved.internalToken ?? '';
    hasToken.value = saved.hasToken;
    tokenDirty.value = false;
    toastSuccess('Đã lưu internal token.');
  } catch {
    toastError('Lưu token thất bại (token có thể trùng, hãy sinh lại).');
  } finally {
    tokenSaving.value = false;
  }
};

const saveQuota = async (): Promise<void> => {
  const ok = await confirmSubmit({
    title: 'Lưu hạn ngạch chuẩn?',
    text: 'Áp dụng giới hạn token cho nhân viên này.',
  });
  if (!ok) return;
  try {
    await quotaApi.upsert({
      userId: userId.value,
      dailyLimit: Number(quotaForm.dailyLimit) || 0,
      weeklyLimit: Number(quotaForm.weeklyLimit) || 0,
      monthlyLimit: Number(quotaForm.monthlyLimit) || 0,
      taskLimit: Number(quotaForm.taskLimit) || 0,
    });
    toastSuccess('Đã lưu hạn ngạch chuẩn.');
    await load();
  } catch {
    toastError('Lưu hạn ngạch thất bại.');
  }
};

const grantAddon = async (): Promise<void> => {
  if (!addonValidation.validate()) return;
  const ok = await confirmSubmit({
    title: 'Cấp thêm token?',
    text: `Cấp +${formatNumber(Number(addonForm.addonTokens))} token (${addonForm.cycleType}).`,
    confirmText: 'Cấp Addon',
  });
  if (!ok) return;
  try {
    await quotaApi.createAddon({
      userId: userId.value,
      addonTokens: Number(addonForm.addonTokens),
      cycleType: addonForm.cycleType,
      startDate: addonForm.startDate,
    });
    toastSuccess('Đã cấp thêm token.');
    addonForm.addonTokens = null;
    await load();
  } catch {
    toastError('Cấp thêm token thất bại.');
  }
};

const revokeAddon = async (id: number): Promise<void> => {
  const ok = await confirmDelete('Thu hồi addon này khỏi nhân viên?');
  if (!ok) return;
  try {
    await quotaApi.revokeAddon(id);
    toastSuccess('Đã thu hồi addon.');
    await load();
  } catch {
    toastError('Thu hồi thất bại.');
  }
};

const goBack = (): void => {
  void router.push({ name: 'token-allocations' });
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <header class="flex items-center gap-3">
      <button class="btn-ghost flex items-center gap-1" @click="goBack">
        <span class="material-symbols-rounded text-[18px]">arrow_back</span> Danh sách
      </button>
      <div>
        <h1 class="text-2xl font-bold text-slate-900">
          {{ allocation?.displayName || allocation?.fullName || userId }}
        </h1>
        <p class="text-sm text-slate-500">
          {{ allocation?.email }}{{ allocation?.title ? ' · ' + allocation.title : '' }}
        </p>
      </div>
    </header>
    <p v-if="message" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{{ message }}</p>

    <section class="card">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">Internal Token (xác thực Gateway)</h2>
        <span
          class="rounded px-2 py-0.5 text-xs"
          :class="hasToken ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
        >
          {{ hasToken ? 'Đã cấp' : 'Chưa cấp' }}
        </span>
      </div>
      <p class="mb-3 text-sm text-slate-500">
        Mỗi nhân viên chỉ có 1 token. Bấm <strong>↻</strong> để sinh token mới, rồi
        <strong>Lưu</strong> để áp dụng. Token dùng cấu hình IDE/VSCode để gọi qua Gateway.
      </p>
      <div class="flex items-center gap-2">
        <code class="flex-1 truncate rounded-lg bg-slate-900 px-3 py-2 text-sm text-emerald-300">
          {{ tokenValue || '— chưa có token —' }}
        </code>
        <button class="btn-ghost flex items-center gap-1 whitespace-nowrap" title="Sinh token mới" @click="refreshToken">
          <span class="material-symbols-rounded text-[18px]">refresh</span>
        </button>
        <button class="btn-ghost whitespace-nowrap" :disabled="!tokenValue" @click="copyToken">
          {{ tokenCopied ? 'Đã chép ✓' : 'Copy' }}
        </button>
        <button
          class="btn-primary whitespace-nowrap"
          :disabled="!tokenValue || tokenSaving || (!tokenDirty && hasToken)"
          @click="saveToken"
        >
          {{ tokenSaving ? 'Đang lưu...' : 'Lưu' }}
        </button>
      </div>
      <p v-if="tokenDirty" class="mt-2 text-xs text-amber-600">
        Token mới chưa được lưu — bấm “Lưu” để áp dụng.
      </p>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-800">Hạn ngạch chuẩn</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-sm text-slate-600">
            Token / ngày
            <input v-model.number="quotaForm.dailyLimit" type="number" min="0" placeholder="Nhập số token" class="input mt-1" />
          </label>
          <label class="text-sm text-slate-600">
            Token / tuần
            <input v-model.number="quotaForm.weeklyLimit" type="number" min="0" placeholder="Nhập số token" class="input mt-1" />
          </label>
          <label class="text-sm text-slate-600">
            Token / tháng
            <input v-model.number="quotaForm.monthlyLimit" type="number" min="0" placeholder="Nhập số token" class="input mt-1" />
          </label>
          <label class="text-sm text-slate-600">
            Token / task
            <input v-model.number="quotaForm.taskLimit" type="number" min="0" placeholder="Nhập số token" class="input mt-1" />
          </label>
        </div>
        <p class="mt-2 text-xs text-slate-400">Để trống = 0 (không giới hạn theo chu kỳ tương ứng).</p>
        <button class="btn-primary mt-4 w-full" @click="saveQuota">Lưu hạn ngạch</button>
      </section>

      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-800">Cấp thêm (Addon — cộng dồn)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="col-span-2 text-sm text-slate-600">
            Số token cấp thêm *
            <input
              v-model.number="addonForm.addonTokens"
              type="number"
              min="0"
              placeholder="Nhập số token cần cấp"
              class="input mt-1"
              :class="addonValidation.fieldClass('addonTokens')"
            />
            <span v-if="addonValidation.errors.addonTokens" class="mt-1 block text-xs text-rose-600">
              {{ addonValidation.errors.addonTokens }}
            </span>
          </label>
          <label class="text-sm text-slate-600">
            Chu kỳ
            <select v-model="addonForm.cycleType" class="input mt-1">
              <option value="ONCE">ONCE</option>
              <option value="DAILY">DAILY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="MONTHLY">MONTHLY</option>
            </select>
          </label>
          <label class="text-sm text-slate-600">
            Ngày bắt đầu *
            <input
              v-model="addonForm.startDate"
              type="date"
              class="input mt-1"
              :class="addonValidation.fieldClass('startDate')"
            />
          </label>
        </div>
        <button class="btn-primary mt-4 w-full" @click="grantAddon">Cấp Addon Nhanh</button>

        <ul class="mt-4 divide-y divide-slate-100 text-sm">
          <li v-for="addon in addons" :key="addon.id" class="flex items-center justify-between py-2">
            <span>
              +{{ formatNumber(addon.addonTokens) }} · {{ addon.cycleType }} · {{ addon.startDate }}
              <span class="ml-1 rounded bg-slate-100 px-2 py-0.5 text-xs">{{ addon.status }}</span>
            </span>
            <button class="text-xs text-rose-600 hover:underline" @click="revokeAddon(addon.id)">
              Thu hồi
            </button>
          </li>
          <li v-if="addons.length === 0" class="py-2 text-slate-400">Chưa có addon nào.</li>
        </ul>
      </section>
    </div>
  </div>
</template>
