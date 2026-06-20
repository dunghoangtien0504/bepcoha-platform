<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { settingsApi } from '@/api/endpoints';
import type { SystemSetting } from '@/api/types';
import { confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const settings = ref<SystemSetting[]>([]);
const message = ref<string | null>(null);

const load = async (): Promise<void> => {
  try {
    settings.value = await settingsApi.list();
  } catch {
    message.value = 'Không tải được cấu hình.';
  }
};

const save = async (setting: SystemSetting): Promise<void> => {
  const ok = await confirmSubmit({
    title: 'Lưu cấu hình?',
    text: `Cập nhật giá trị cho khóa "${setting.settingKey}".`,
  });
  if (!ok) return;
  try {
    await settingsApi.upsert(setting);
    toastSuccess(`Đã lưu ${setting.settingKey}.`);
  } catch {
    toastError('Lưu cấu hình thất bại.');
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Cấu hình Hệ thống</h1>
      <p class="text-sm text-slate-500">
        Lịch làm việc tiêu chuẩn và hệ số kinh tế dùng để quy đổi giá trị ROI.
      </p>
    </div>

    <p v-if="message" class="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand-dark">{{ message }}</p>

    <section class="card">
      <div class="table-scroll"><table class="data-table">
        <thead>
          <tr class="border-b text-left text-slate-500">
            <th class="py-2">Khóa</th>
            <th>Giá trị</th>
            <th>Mô tả</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="setting in settings" :key="setting.settingKey" class="border-b last:border-0">
            <td class="py-2 font-mono text-xs">{{ setting.settingKey }}</td>
            <td class="py-2"><input v-model="setting.settingValue" class="input w-32" /></td>
            <td class="py-2 text-slate-500">{{ setting.description }}</td>
            <td class="py-2 text-right">
              <button class="btn-primary px-3 py-1 text-xs" @click="save(setting)">Lưu</button>
            </td>
          </tr>
        </tbody>
      </table></div>
    </section>
  </div>
</template>
