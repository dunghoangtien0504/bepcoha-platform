<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { integrationsApi } from '@/api/endpoints';
import { http } from '@/api/http';
import type { IntegrationConnection, SyncResult } from '@/api/types';
import { formatDateTime } from '@/utils/format';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const connections = ref<IntegrationConnection[]>([]);
const message = ref<string | null>(null);
const syncing = ref<number | null>(null);

const form = reactive({
  provider: 'JIRA' as 'JIRA' | 'GITLAB' | 'GITHUB',
  name: '',
  baseUrl: '',
  externalProjectKey: '',
  authEmail: '',
  token: '',
  webhookSecret: '',
  defaultBaselineHours: 8,
});

const validation = useValidationForm(form, {
  name: { required: true, label: 'Tên hiển thị' },
  baseUrl: { required: true, label: 'Base URL' },
  token: { required: true, label: 'API Token / PAT' },
});

const placeholderByProvider: Record<string, string> = {
  JIRA: 'https://your-org.atlassian.net  · projectKey: TERO · authEmail bắt buộc',
  GITLAB: 'https://gitlab.com  · projectId số (vd 42)',
  GITHUB: 'https://api.github.com  · projectKey: owner/repo',
};

const webhookUrl = (id: number): string => `${http.defaults.baseURL}/v1/integrations/webhooks/${id}`;

const loadConnections = async (): Promise<void> => {
  try {
    connections.value = await integrationsApi.list();
  } catch {
    message.value = 'Không tải được danh sách kết nối.';
  }
};

const createConnection = async (): Promise<void> => {
  if (!validation.validate()) return;
  const ok = await confirmSubmit({ title: 'Tạo kết nối mới?', text: `Tạo kết nối ${form.provider} "${form.name}".` });
  if (!ok) return;
  try {
    await integrationsApi.create({ ...form });
    toastSuccess('Đã tạo kết nối tích hợp.');
    form.name = '';
    form.baseUrl = '';
    form.externalProjectKey = '';
    form.authEmail = '';
    form.token = '';
    form.webhookSecret = '';
    validation.clearErrors();
    await loadConnections();
  } catch {
    toastError('Tạo kết nối thất bại.');
  }
};

const removeConnection = async (id: number): Promise<void> => {
  const ok = await confirmDelete('Xóa kết nối tích hợp này?');
  if (!ok) return;
  try {
    await integrationsApi.remove(id);
    toastSuccess('Đã xóa kết nối.');
    await loadConnections();
  } catch {
    toastError('Xóa kết nối thất bại.');
  }
};

const runSync = async (id: number): Promise<void> => {
  syncing.value = id;
  message.value = null;
  try {
    const result: SyncResult = await integrationsApi.sync(id);
    message.value = `Đồng bộ xong: lấy ${result.fetched}, tạo mới ${result.created}, cập nhật ${result.updated}.`;
    await loadConnections();
  } catch {
    message.value = 'Đồng bộ thất bại — kiểm tra token/projectKey/baseUrl.';
  } finally {
    syncing.value = null;
  }
};

onMounted(loadConnections);
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Tích hợp Hệ thống Quản lý Dự án / Công việc</h1>
      <p class="text-sm text-slate-500">
        Kết nối Jira / GitLab / GitHub để đồng bộ task về hệ thống và map ROI theo từng ticket.
      </p>
    </div>

    <p v-if="message" class="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand-dark">{{ message }}</p>

    <section class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Tạo kết nối mới</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="label">Provider</label>
          <select v-model="form.provider" class="input">
            <option value="JIRA">Jira</option>
            <option value="GITLAB">GitLab</option>
            <option value="GITHUB">GitHub</option>
          </select>
        </div>
        <div>
          <label class="label">Tên hiển thị</label>
          <input v-model="form.name" class="input" :class="validation.fieldClass('name')" placeholder="VD: Jira STORO" />
          <span v-if="validation.errors.name" class="mt-1 block text-xs text-rose-600">{{ validation.errors.name }}</span>
        </div>
        <div class="md:col-span-2">
          <label class="label">Base URL</label>
          <input v-model="form.baseUrl" class="input" :class="validation.fieldClass('baseUrl')" :placeholder="placeholderByProvider[form.provider]" />
          <span v-if="validation.errors.baseUrl" class="mt-1 block text-xs text-rose-600">{{ validation.errors.baseUrl }}</span>
        </div>
        <div>
          <label class="label">External Project Key</label>
          <input v-model="form.externalProjectKey" class="input" placeholder="TERO / 42 / owner/repo" />
        </div>
        <div>
          <label class="label">Auth Email (Jira)</label>
          <input v-model="form.authEmail" class="input" placeholder="you@company.com" />
        </div>
        <div>
          <label class="label">API Token / PAT</label>
          <input v-model="form.token" type="password" class="input" :class="validation.fieldClass('token')" placeholder="Token bí mật (sẽ được mã hóa)" />
          <span v-if="validation.errors.token" class="mt-1 block text-xs text-rose-600">{{ validation.errors.token }}</span>
        </div>
        <div>
          <label class="label">Webhook Secret (tùy chọn)</label>
          <input v-model="form.webhookSecret" class="input" placeholder="HMAC secret" />
        </div>
        <div>
          <label class="label">Baseline mặc định (giờ)</label>
          <input v-model.number="form.defaultBaselineHours" type="number" min="0" step="0.5" class="input" />
        </div>
      </div>
      <button class="btn-primary mt-4" @click="createConnection">Lưu kết nối</button>
    </section>

    <section class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Kết nối hiện có</h2>
      <div class="table-scroll"><table class="data-table">
        <thead>
          <tr class="border-b text-left text-slate-500">
            <th class="py-2">Provider</th>
            <th>Tên</th>
            <th>Project Key</th>
            <th>Đồng bộ gần nhất</th>
            <th>Webhook URL</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="conn in connections" :key="conn.id" class="border-b last:border-0">
            <td class="py-2 font-medium">{{ conn.provider }}</td>
            <td>{{ conn.name }}</td>
            <td>{{ conn.externalProjectKey ?? '—' }}</td>
            <td>{{ formatDateTime(conn.lastSyncedAt) }}</td>
            <td>
              <code class="text-xs text-slate-500">{{ webhookUrl(conn.id) }}</code>
            </td>
            <td class="text-right">
              <button
                class="btn-primary px-3 py-1 text-xs"
                :disabled="syncing === conn.id"
                @click="runSync(conn.id)"
              >
                {{ syncing === conn.id ? 'Đang đồng bộ…' : 'Sync' }}
              </button>
              <button
                class="ml-2 text-xs text-rose-600 hover:underline"
                @click="removeConnection(conn.id)"
              >
                Xóa
              </button>
            </td>
          </tr>
          <tr v-if="connections.length === 0">
            <td colspan="6" class="py-4 text-center text-slate-400">Chưa có kết nối nào.</td>
          </tr>
        </tbody>
      </table></div>
    </section>

    <section class="card">
      <h2 class="mb-2 font-semibold text-slate-800">API outbound cho hệ thống bên thứ ba</h2>
      <p class="text-sm text-slate-500">
        Hệ thống PM có thể kéo ngược chỉ số tiêu thụ AI / ROI của một task qua API (header
        <code>X-AIGG-Api-Key</code>):
      </p>
      <pre class="mt-2 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">GET /v1/integrations/external/tasks/{taskId}/usage
Header: X-AIGG-Api-Key: your-integration-api-key</pre>
    </section>
  </div>
</template>
