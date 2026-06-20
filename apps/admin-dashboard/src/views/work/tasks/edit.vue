<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usersApi, workApi } from '@/api/endpoints';
import type {
  AdminUser,
  ProjectPhase,
  TaskCategory,
  WorkProject,
  WorkTask,
  WorkTaskPayload,
} from '@/api/types';
import AttachmentManager from '@/components/work/AttachmentManager.vue';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_PROGRESS_SOURCE_OPTIONS,
  TASK_STATUS_OPTIONS,
} from '@/utils/work-labels';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const route = useRoute();
const router = useRouter();

const taskId = computed<number | null>(() => {
  const raw = route.params.id;
  if (raw === undefined) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
});
const isEdit = computed(() => taskId.value !== null);

const categories = ref<TaskCategory[]>([]);
const projects = ref<WorkProject[]>([]);
const phases = ref<ProjectPhase[]>([]);
const users = ref<AdminUser[]>([]);
const parentTasks = ref<WorkTask[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const attachmentRef = ref<InstanceType<typeof AttachmentManager> | null>(null);

const form = reactive<{
  taskCategoryId: number | '';
  title: string;
  description: string;
  projectId: number | '';
  projectPhaseId: number | '';
  parentId: number | '';
  priority: WorkTaskPayload['priority'];
  status: WorkTaskPayload['status'];
  assignedToUserId: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number | '';
  progressPercent: number | '';
  progressSource: WorkTaskPayload['progressSource'];
}>({
  taskCategoryId: '',
  title: '',
  description: '',
  projectId: '',
  projectPhaseId: '',
  parentId: '',
  priority: 'medium',
  status: 'todo',
  assignedToUserId: '',
  startDate: '',
  dueDate: '',
  estimatedHours: '',
  progressPercent: '',
  progressSource: 'manual',
});

const validation = useValidationForm(form, {
  title: { required: true, label: 'Tên công việc' },
  taskCategoryId: { required: true, label: 'Loại công việc' },
  startDate: { required: true, label: 'Ngày bắt đầu' },
  dueDate: { required: true, label: 'Hạn hoàn thành' },
});

const loadPhases = async (): Promise<void> => {
  if (form.projectId === '') {
    phases.value = [];
    return;
  }
  try {
    const p = await workApi.project(Number(form.projectId));
    phases.value = p.phases ?? [];
  } catch {
    phases.value = [];
  }
};

const loadParentTasks = async (): Promise<void> => {
  try {
    const params: Record<string, string | number> = { pageSize: 100 };
    if (form.projectId !== '') params.projectId = Number(form.projectId);
    const rows = (await workApi.tasks(params)).rows;
    parentTasks.value = rows.filter((t) => t.id !== taskId.value);
  } catch {
    parentTasks.value = [];
  }
};

const onProjectChange = async (): Promise<void> => {
  form.projectPhaseId = '';
  form.parentId = '';
  await Promise.all([loadPhases(), loadParentTasks()]);
};

const loadRefs = async (): Promise<void> => {
  try {
    categories.value = await workApi.taskCategories();
  } catch {
    /* ignore */
  }
  try {
    projects.value = (await workApi.projects({ pageSize: 100 })).rows;
  } catch {
    /* ignore */
  }
  try {
    users.value = await usersApi.list();
  } catch {
    /* ignore */
  }
};

const loadTask = async (): Promise<void> => {
  if (taskId.value === null) return;
  loading.value = true;
  try {
    const t = await workApi.task(taskId.value);
    form.taskCategoryId = t.taskCategoryId;
    form.title = t.title;
    form.description = t.description ?? '';
    form.projectId = t.projectId ?? '';
    form.priority = t.priority;
    form.status = t.status;
    form.assignedToUserId = t.assignedToUserId ?? '';
    form.startDate = t.startDate ? t.startDate.slice(0, 10) : '';
    form.dueDate = t.dueDate ? t.dueDate.slice(0, 10) : '';
    form.estimatedHours = t.estimatedHours ?? '';
    form.progressPercent = t.progressPercent ?? '';
    form.progressSource = t.progressSource;
    form.parentId = t.parentId ?? '';
    await Promise.all([loadPhases(), loadParentTasks()]);
    form.projectPhaseId = t.projectPhaseId ?? '';
  } catch {
    error.value = 'Không tải được công việc.';
  } finally {
    loading.value = false;
  }
};

const buildPayload = (): WorkTaskPayload | null => {
  if (!validation.validate()) return null;
  return {
    taskCategoryId: Number(form.taskCategoryId),
    projectId: form.projectId === '' ? undefined : Number(form.projectId),
    projectPhaseId: form.projectPhaseId === '' ? undefined : Number(form.projectPhaseId),
    parentId: form.parentId === '' ? undefined : Number(form.parentId),
    priority: form.priority,
    status: form.status,
    assignedToUserId: form.assignedToUserId || undefined,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    startDate: form.startDate,
    dueDate: form.dueDate,
    estimatedHours: form.estimatedHours === '' ? undefined : Number(form.estimatedHours),
    progressPercent: form.progressPercent === '' ? undefined : Number(form.progressPercent),
    progressSource: form.progressSource,
  };
};

const submit = async (): Promise<void> => {
  error.value = null;
  const payload = buildPayload();
  if (!payload) return;
  const ok = await confirmSubmit({
    title: isEdit.value ? 'Cập nhật công việc?' : 'Tạo công việc mới?',
    text: 'Vui lòng kiểm tra lại thông tin trước khi lưu.',
  });
  if (!ok) return;
  saving.value = true;
  try {
    if (isEdit.value && taskId.value !== null) {
      await workApi.updateTask(taskId.value, payload);
      toastSuccess('Đã cập nhật công việc.');
    } else {
      const created = await workApi.createTask(payload);
      if (attachmentRef.value?.hasStaged) {
        await attachmentRef.value.flush(created.id);
      }
      toastSuccess('Đã tạo công việc mới.');
    }
    void router.push({ name: 'work-tasks' });
  } catch {
    error.value = 'Lưu công việc thất bại. Vui lòng kiểm tra dữ liệu nhập.';
    toastError('Lưu công việc thất bại.');
  } finally {
    saving.value = false;
  }
};

const cancel = (): void => {
  void router.push({ name: 'work-tasks' });
};

onMounted(async () => {
  await loadRefs();
  if (isEdit.value) await loadTask();
  else await loadParentTasks();
});
</script>

<template>
  <div class="space-y-6 p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ isEdit ? 'Sửa công việc' : 'Thêm công việc' }}</h1>
        <p class="text-sm text-slate-500">Thông tin công việc, phụ trách và tệp đính kèm.</p>
      </div>
      <button class="btn-ghost" @click="cancel">
        <span class="material-symbols-rounded mr-1 text-[18px]">arrow_back</span>Quay lại
      </button>
    </header>

    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{{ error }}</p>
    <p v-if="loading" class="text-sm text-slate-400">Đang tải…</p>

    <form class="space-y-6" @submit.prevent="submit">
      <section class="card space-y-4">
        <h2 class="text-sm font-semibold text-slate-700">Thông tin công việc</h2>
        <div>
          <label class="label">Tên công việc *</label>
          <input v-model="form.title" class="input" :class="validation.fieldClass('title')" placeholder="Tên công việc" />
          <span v-if="validation.errors.title" class="mt-1 block text-xs text-rose-600">{{ validation.errors.title }}</span>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="label">Loại công việc *</label>
            <select v-model="form.taskCategoryId" class="input" :class="validation.fieldClass('taskCategoryId')">
              <option value="">— Chọn loại —</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.title }}</option>
            </select>
            <span v-if="validation.errors.taskCategoryId" class="mt-1 block text-xs text-rose-600">{{ validation.errors.taskCategoryId }}</span>
          </div>
          <div>
            <label class="label">Dự án</label>
            <select v-model="form.projectId" class="input" @change="onProjectChange">
              <option value="">— Không thuộc dự án —</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title ?? p.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">Giai đoạn</label>
            <select v-model="form.projectPhaseId" class="input" :disabled="form.projectId === ''">
              <option value="">— Không gắn giai đoạn —</option>
              <option v-for="ph in phases" :key="ph.id" :value="ph.id">{{ ph.title }}</option>
            </select>
          </div>
          <div>
            <label class="label">Người phụ trách</label>
            <select v-model="form.assignedToUserId" class="input">
              <option value="">— Chưa chỉ định —</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.fullName }}<template v-if="u.title"> · {{ u.title }}</template>
              </option>
            </select>
          </div>
          <div>
            <label class="label">Ưu tiên</label>
            <select v-model="form.priority" class="input">
              <option v-for="opt in TASK_PRIORITY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Trạng thái</label>
            <select v-model="form.status" class="input">
              <option v-for="opt in TASK_STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Công việc cha</label>
            <select v-model="form.parentId" class="input">
              <option value="">— Không có —</option>
              <option v-for="t in parentTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
            </select>
          </div>
          <div>
            <label class="label">Số giờ ước tính</label>
            <input v-model="form.estimatedHours" type="number" min="0" step="0.5" class="input" placeholder="0" />
          </div>
          <div>
            <label class="label">Tiến độ hoàn thành (%)</label>
            <input v-model="form.progressPercent" type="number" min="0" max="100" step="1" class="input" placeholder="0" />
          </div>
          <div>
            <label class="label">Nguồn cập nhật tiến độ</label>
            <select v-model="form.progressSource" class="input">
              <option v-for="opt in TASK_PROGRESS_SOURCE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Ngày bắt đầu *</label>
            <input v-model="form.startDate" type="date" class="input" :class="validation.fieldClass('startDate')" />
            <span v-if="validation.errors.startDate" class="mt-1 block text-xs text-rose-600">{{ validation.errors.startDate }}</span>
          </div>
          <div>
            <label class="label">Hạn hoàn thành *</label>
            <input v-model="form.dueDate" type="date" class="input" :class="validation.fieldClass('dueDate')" />
            <span v-if="validation.errors.dueDate" class="mt-1 block text-xs text-rose-600">{{ validation.errors.dueDate }}</span>
          </div>
        </div>
        <div>
          <label class="label">Mô tả</label>
          <textarea v-model="form.description" class="input" rows="3" placeholder="Mô tả công việc" />
        </div>
      </section>

      <section class="card">
        <AttachmentManager ref="attachmentRef" entity-type="tasks" :entity-id="taskId" />
      </section>

      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="cancel">Hủy</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span class="material-symbols-rounded mr-1 text-[18px]">save</span>
          {{ saving ? 'Đang lưu…' : 'Lưu công việc' }}
        </button>
      </div>
    </form>
  </div>
</template>
